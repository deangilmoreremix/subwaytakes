import { buildCorsHeaders, handleOptions, HttpError, jsonResponse } from "../_shared/cors.ts";
import { requireUser, serviceClient } from "../_shared/auth.ts";
import {
  assertMediaBucket,
  assertMediaPath,
  assertRefOwnedOrThrow,
  clampSignTtl,
  isMediaRef,
  signRef,
  type MediaKind,
  type MediaRef,
} from "../_shared/media.ts";

/**
 * media-sign — derive a short-lived signed URL for a private media object.
 *
 * POST /functions/v1/media-sign
 * Body: { bucket, path, kind?: "video"|"audio"|"image", ttl_seconds?: number }
 * 200: { signedUrl, expiresAt, bucket, path }
 * 400: unknown bucket / invalid path / out-of-range ttl (clamped, not rejected)
 * 401: missing or invalid Authorization header
 * 404: the caller may not access this object (no existence leak)
 * 500: signing failed
 *
 * WHY THIS EXISTS: project JSON and job rows persist canonical refs
 * (bucket + path), never URLs. URLs are derived here on demand with a
 * 1-hour lifetime, after the same ownership rules the render pipeline uses.
 * The function performs no database writes, so it is safe to call on project
 * load, on tab focus and before every export/render.
 */

interface MediaSignBody {
  bucket?: unknown;
  path?: unknown;
  kind?: unknown;
  ttl_seconds?: unknown;
}

const MEDIA_KINDS: MediaKind[] = ["video", "audio", "image"];

function parseKind(value: unknown): MediaKind {
  return MEDIA_KINDS.includes(value as MediaKind) ? (value as MediaKind) : "video";
}

/**
 * Handler exported separately from the Deno.serve wiring so it can be driven
 * directly in tests (same pattern as plan-interview / generate-scene).
 */
export async function handleMediaSignRequest(req: Request): Promise<Response> {
  const cors = buildCorsHeaders(req.headers.get("Origin"));

  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "POST is required" }, 405, cors);
  }

  try {
    const { userId } = await requireUser(req);

    let body: MediaSignBody;
    try {
      const parsed = await req.json();
      // A valid-JSON-but-not-an-object body (null, array, primitive) must be a
      // 400, not a TypeError 500 when the fields are read.
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return jsonResponse({ error: "Request body must be a JSON object" }, 400, cors);
      }
      body = parsed as MediaSignBody;
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400, cors);
    }

    // Order matters: bucket/path validation first (cheap, 400), then ownership
    // (404 without leaking whether the object exists).
    const bucket = assertMediaBucket(body.bucket);
    const path = assertMediaPath(body.path);
    const ttl = clampSignTtl(body.ttl_seconds);

    const ref: MediaRef = { bucket, path, kind: parseKind(body.kind) };
    if (!isMediaRef(ref)) {
      return jsonResponse({ error: "Invalid media ref" }, 400, cors);
    }

    const supabase = serviceClient();
    await assertRefOwnedOrThrow(ref, userId, supabase);

    const signed = await signRef(supabase, ref, ttl);

    return jsonResponse(
      {
        signedUrl: signed.url,
        expiresAt: signed.expiresAt,
        bucket,
        path,
      },
      200,
      cors,
    );
  } catch (error) {
    console.error("Media sign error:", error);
    if (error instanceof HttpError) {
      return jsonResponse({ error: error.message }, error.status, cors);
    }
    const message = error instanceof Error && error.message ? error.message : "Could not sign media URL";
    return jsonResponse({ error: message }, 500, cors);
  }
}

Deno.serve(handleMediaSignRequest);
