import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";
import { z } from "npm:zod@3.23.8";

// ============================================================
// SECTION 1: CONFIGURATION
//
// WHY: Centralise all tunables so nothing is scattered across
//      the handler.  ALLOWED_ORIGINS is an explicit allowlist
//      read from the environment.  A wildcard ("*") is NEVER
//      used because it would let any website make credentialed
//      requests to this function.
// ============================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWED_ORIGINS: string[] = (
  Deno.env.get("ALLOWED_ORIGINS") || "http://localhost:5173,http://localhost:3000"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const MAX_PAGE_SIZE = 50;

// ============================================================
// SECTION 2: CORS
//
// WHY: The browser sends an Origin header with every request.
//      We compare it against the allowlist and only reflect it
//      back if it matches.  An unrecognised origin gets an empty
//      string, which the browser treats as a rejection.
//
//      The Vary: Origin header is required so that CDN / proxy
//      caches don't serve a response intended for origin A to
//      origin B.
// ============================================================

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Client-Info, Apikey, X-Request-Id",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

// ============================================================
// SECTION 3: REQUEST ID
//
// WHY: Every response includes a unique request_id.  If a user
//      reports a problem we can correlate their error payload to
//      our server logs without exposing stack traces.
//      We honour a client-supplied X-Request-Id (useful for
//      distributed tracing) but generate one if missing.
// ============================================================

function getRequestId(req: Request): string {
  return req.headers.get("X-Request-Id") || crypto.randomUUID();
}

// ============================================================
// SECTION 4: SAFE ERROR RESPONSES
//
// WHY: We NEVER leak internal details (stack traces, column
//      names, SQL errors) to the caller.  We return a short
//      human-readable message plus the request_id for support.
// ============================================================

function errorResponse(
  status: number,
  message: string,
  requestId: string,
  cors: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({ error: message, request_id: requestId }),
    {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    }
  );
}

// ============================================================
// SECTION 5: AUTHENTICATION
//
// WHY: The single most important control.  We extract the JWT
//      from the Authorization header, then call getUser() which
//      hits the Supabase Auth server to *validate* the token.
//
//      We NEVER:
//      - trust a user_id sent in the request body
//      - compare the bearer token to the service role key
//        (that pattern lets anyone who leaks the key bypass auth)
//      - decode the JWT locally without server-side verification
//
//      The user_id used for every downstream query is derived
//      EXCLUSIVELY from the verified token.
// ============================================================

interface AuthenticatedUser {
  userId: string;
  email: string | undefined;
}

async function authenticateRequest(
  req: Request,
  requestId: string,
  cors: Record<string, string>
): Promise<AuthenticatedUser | Response> {
  const authHeader = req.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return errorResponse(
      401,
      "Missing or malformed Authorization header",
      requestId,
      cors
    );
  }

  const token = authHeader.slice(7);

  if (!token || token.length < 10) {
    return errorResponse(401, "Invalid token", requestId, cors);
  }

  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const {
    data: { user },
    error,
  } = await authClient.auth.getUser();

  if (error || !user) {
    return errorResponse(401, "Invalid or expired token", requestId, cors);
  }

  return { userId: user.id, email: user.email };
}

// ============================================================
// SECTION 6: ADMIN SUPABASE CLIENT
//
// WHY: After authentication we switch to the service-role
//      client for database operations.  This client bypasses RLS,
//      which is intentional -- the function itself enforces
//      ownership checks in application code (belt-and-suspenders
//      with RLS still active as a safety net).
//
//      We create a single instance per request to avoid stale
//      connections.
// ============================================================

function getAdminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

// ============================================================
// SECTION 7: ZOD SCHEMAS
//
// WHY: TypeScript interfaces vanish at runtime.  A malicious
//      caller can send ANY JSON.  Zod provides runtime
//      validation:
//
//      .strict()  -- rejects unexpected fields.  Without this,
//                    an attacker could inject "user_id", "status",
//                    "result_url", or other privileged fields.
//
//      .max()     -- prevents oversized payloads that could be
//                    used for denial-of-service or stored XSS.
//
//      enum()     -- whitelists valid values, preventing
//                    injection through free-text fields.
// ============================================================

const VIDEO_TYPES = [
  "subway_interview",
  "street_interview",
  "motivational",
  "studio_interview",
  "wisdom_interview",
] as const;

const MODEL_TIERS = ["standard", "premium"] as const;

const CreateClipSchema = z
  .object({
    video_type: z.enum(VIDEO_TYPES),
    topic: z.string().min(1).max(500),
    duration_seconds: z.number().int().min(1).max(60),
    angle_prompt: z.string().max(2000).optional(),
    interview_question: z.string().max(1000).optional(),
    scene_type: z.string().max(100).optional(),
    city_style: z.string().max(100).optional(),
    energy_level: z.string().max(100).optional(),
    model_tier: z.enum(MODEL_TIERS).optional(),
    speaker_style: z.string().max(100).optional(),
    motivational_setting: z.string().max(100).optional(),
    camera_style: z.string().max(100).optional(),
    lighting_mood: z.string().max(100).optional(),
    street_scene: z.string().max(100).optional(),
    interview_style: z.string().max(100).optional(),
    time_of_day: z.string().max(100).optional(),
    studio_setup: z.string().max(100).optional(),
    studio_lighting: z.string().max(100).optional(),
    wisdom_tone: z.string().max(100).optional(),
    wisdom_format: z.string().max(100).optional(),
    wisdom_demographic: z.string().max(100).optional(),
    wisdom_setting: z.string().max(100).optional(),
    target_age_group: z.string().max(50).optional(),
    neighborhood: z.string().max(100).optional(),
    subway_line: z.string().max(50).optional(),
    caption_style: z.string().max(100).optional(),
    language: z.string().max(50).optional(),
    niche: z.string().max(100).optional(),
    interview_format: z.string().max(100).optional(),
    duration_preset: z.string().max(50).optional(),
    interview_mode: z.string().max(100).optional(),
    custom_location: z.string().max(500).optional(),
    scenario_description: z.string().max(2000).optional(),
  })
  .strict();

const UpdateClipSchema = z
  .object({
    topic: z.string().min(1).max(500).optional(),
    angle_prompt: z.string().max(2000).nullable().optional(),
    interview_question: z.string().max(1000).nullable().optional(),
    caption_style: z.string().max(100).nullable().optional(),
  })
  .strict();

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
  video_type: z.enum(VIDEO_TYPES).optional(),
  status: z.string().max(20).optional(),
});

// ============================================================
// SECTION 8: ROUTE HANDLERS
//
// WHY: Each handler receives the verified userId from Section 5.
//      Every database query filters by userId so a user can ONLY
//      see/modify their own rows.
//
//      For UPDATE and DELETE we perform an explicit ownership
//      check BEFORE the mutation.  If the row doesn't exist or
//      belongs to someone else, we return 404 (not 403) to
//      prevent attackers from enumerating valid IDs (IDOR
//      prevention).
// ============================================================

async function handleListClips(
  userId: string,
  url: URL,
  requestId: string,
  cors: Record<string, string>
): Promise<Response> {
  const params = PaginationSchema.safeParse({
    page: url.searchParams.get("page") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    video_type: url.searchParams.get("video_type") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
  });

  if (!params.success) {
    return errorResponse(400, "Invalid query parameters", requestId, cors);
  }

  const { page, limit, video_type, status } = params.data;
  const offset = (page - 1) * limit;

  const db = getAdminClient();

  let query = db
    .from("clips")
    .select(
      "id, video_type, topic, duration_seconds, status, created_at, result_url, thumbnail_url, model_tier",
      { count: "exact" }
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (video_type) query = query.eq("video_type", video_type);
  if (status) query = query.eq("status", status);

  const { data, error, count } = await query;

  if (error) {
    console.error(`[${requestId}] List clips error:`, error.message);
    return errorResponse(500, "Failed to fetch clips", requestId, cors);
  }

  return new Response(
    JSON.stringify({
      data,
      total: count,
      page,
      limit,
      request_id: requestId,
    }),
    { headers: { ...cors, "Content-Type": "application/json" } }
  );
}

async function handleCreateClip(
  userId: string,
  body: unknown,
  requestId: string,
  cors: Record<string, string>
): Promise<Response> {
  const parsed = CreateClipSchema.safeParse(body);
  if (!parsed.success) {
    const messages = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return errorResponse(400, messages, requestId, cors);
  }

  const db = getAdminClient();

  const { data, error } = await db
    .from("clips")
    .insert({
      ...parsed.data,
      user_id: userId,
    })
    .select("id, video_type, topic, status, created_at")
    .single();

  if (error) {
    console.error(`[${requestId}] Create clip error:`, error.message);
    return errorResponse(500, "Failed to create clip", requestId, cors);
  }

  return new Response(
    JSON.stringify({ data, request_id: requestId }),
    {
      status: 201,
      headers: { ...cors, "Content-Type": "application/json" },
    }
  );
}

async function handleUpdateClip(
  userId: string,
  clipId: string,
  body: unknown,
  requestId: string,
  cors: Record<string, string>
): Promise<Response> {
  if (!z.string().uuid().safeParse(clipId).success) {
    return errorResponse(400, "Valid clip id (UUID) is required", requestId, cors);
  }

  const parsed = UpdateClipSchema.safeParse(body);
  if (!parsed.success) {
    const messages = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return errorResponse(400, messages, requestId, cors);
  }

  if (Object.keys(parsed.data).length === 0) {
    return errorResponse(400, "No fields to update", requestId, cors);
  }

  const db = getAdminClient();

  const { data: existing } = await db
    .from("clips")
    .select("id, user_id")
    .eq("id", clipId)
    .maybeSingle();

  if (!existing || existing.user_id !== userId) {
    return errorResponse(404, "Clip not found", requestId, cors);
  }

  const { data, error } = await db
    .from("clips")
    .update(parsed.data)
    .eq("id", clipId)
    .eq("user_id", userId)
    .select("id, video_type, topic, status")
    .single();

  if (error) {
    console.error(`[${requestId}] Update clip error:`, error.message);
    return errorResponse(500, "Failed to update clip", requestId, cors);
  }

  return new Response(
    JSON.stringify({ data, request_id: requestId }),
    { headers: { ...cors, "Content-Type": "application/json" } }
  );
}

async function handleDeleteClip(
  userId: string,
  clipId: string,
  requestId: string,
  cors: Record<string, string>
): Promise<Response> {
  if (!z.string().uuid().safeParse(clipId).success) {
    return errorResponse(400, "Valid clip id (UUID) is required", requestId, cors);
  }

  const db = getAdminClient();

  const { data: existing } = await db
    .from("clips")
    .select("id, user_id")
    .eq("id", clipId)
    .maybeSingle();

  if (!existing || existing.user_id !== userId) {
    return errorResponse(404, "Clip not found", requestId, cors);
  }

  const { error } = await db
    .from("clips")
    .delete()
    .eq("id", clipId)
    .eq("user_id", userId);

  if (error) {
    console.error(`[${requestId}] Delete clip error:`, error.message);
    return errorResponse(500, "Failed to delete clip", requestId, cors);
  }

  return new Response(
    JSON.stringify({ success: true, request_id: requestId }),
    { headers: { ...cors, "Content-Type": "application/json" } }
  );
}

// ============================================================
// SECTION 9: MAIN HANDLER
//
// WHY: The outer try/catch guarantees we NEVER return a raw
//      stack trace.  Unhandled exceptions produce a generic 500
//      with the request_id for log correlation.
//
//      Flow:
//      1. CORS preflight           (unauthenticated, fast-path)
//      2. Authenticate             (reject bad/missing tokens)
//      3. Route by HTTP method     (GET/POST/PATCH/DELETE)
//      4. Each handler validates   (Zod schemas)
//      5. Each handler authorises  (ownership checks)
//      6. Respond with safe JSON
// ============================================================

Deno.serve(async (req: Request) => {
  const requestId = getRequestId(req);
  const cors = getCorsHeaders(req);

  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const authResult = await authenticateRequest(req, requestId, cors);
    if (authResult instanceof Response) return authResult;
    const { userId } = authResult;

    const url = new URL(req.url);
    const clipId = url.searchParams.get("id") || "";

    switch (req.method) {
      case "GET":
        return await handleListClips(userId, url, requestId, cors);

      case "POST": {
        let body: unknown;
        try {
          body = await req.json();
        } catch {
          return errorResponse(400, "Invalid JSON body", requestId, cors);
        }
        return await handleCreateClip(userId, body, requestId, cors);
      }

      case "PATCH": {
        let body: unknown;
        try {
          body = await req.json();
        } catch {
          return errorResponse(400, "Invalid JSON body", requestId, cors);
        }
        return await handleUpdateClip(userId, clipId, body, requestId, cors);
      }

      case "DELETE":
        return await handleDeleteClip(userId, clipId, requestId, cors);

      default:
        return errorResponse(405, "Method not allowed", requestId, cors);
    }
  } catch (err) {
    console.error(
      `[${requestId}] Unhandled error:`,
      err instanceof Error ? err.message : "Unknown"
    );
    return errorResponse(500, "Internal server error", requestId, cors);
  }
});
