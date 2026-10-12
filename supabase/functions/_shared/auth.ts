import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { HttpError } from "./cors.ts";

/**
 * Shared authentication helpers for edge functions.
 */

export class AuthError extends HttpError {
  constructor(message = "Unauthorized") {
    super(401, message);
    this.name = "AuthError";
  }
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

function bearerToken(req: Request): string | null {
  const header = req.headers.get("Authorization");
  if (!header) return null;
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : header.trim();
  return token.length > 0 ? token : null;
}

/**
 * Validate the caller's Supabase access token.
 * Throws AuthError (401) when the Authorization header is missing or invalid.
 */
export async function requireUser(req: Request): Promise<{ userId: string }> {
  const token = bearerToken(req);
  if (!token) {
    throw new AuthError("Authorization header is required");
  }

  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const anonKey = requiredEnv("SUPABASE_ANON_KEY");

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await authClient.auth.getUser(token);
  const user = data?.user;
  if (error || !user) {
    throw new AuthError("Invalid or expired token");
  }

  return { userId: user.id };
}

/**
 * True when the request carries the service-role key (internal function-to-
 * function calls, e.g. generate-video -> stitch-episode).
 */
export function internalCall(req: Request): boolean {
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const token = bearerToken(req);
  if (!serviceRoleKey || !token) return false;
  return token === serviceRoleKey;
}

/** Service-role client (bypasses RLS; must be paired with explicit ownership checks). */
export function serviceClient(): SupabaseClient {
  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
