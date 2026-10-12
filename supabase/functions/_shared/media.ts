import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { HttpError } from "./cors.ts";
import { NotFoundError } from "./ownership.ts";

/**
 * Shared media helpers for the Studio edge functions (Deno side).
 *
 * The browser twin lives in src/studio/mediaRefs.ts (+ src/lib/mediaAccess.ts)
 * and cannot be imported here (the edge runtime does not compile the Vite
 * app), so the canonical shapes are duplicated deliberately: keep the two in
 * sync, they are tested against each other by tests/studio/mediaRefs.test.ts
 * and supabase/functions/tests/media_test.ts.
 *
 * RULES (see src/studio/mediaRefs.ts for the long version):
 * - A MediaRef (bucket + path) is the only canonical identity of an asset.
 * - URLs are ALWAYS derived on demand and short-lived: 1 hour by default,
 *   never the 7-day URLs early versions persisted as the asset identity.
 * - Studio objects live under `<user_id>/...` paths so ownership can be
 *   verified from the path alone (defense in depth on top of RLS).
 */

export type MediaKind = "video" | "audio" | "image";

export interface MediaRef {
  /** Storage bucket id: 'videos' (shared), 'studio-uploads', 'studio-exports'. */
  bucket: string;
  /** Object path inside the bucket, e.g. '<user_id>/<project_id>/clip.mp4'. */
  path: string;
  kind: MediaKind;
}

/**
 * Buckets the media-sign endpoint will sign for. Anything else is a 400 —
 * signing arbitrary buckets would turn the endpoint into a generic URL
 * minting service for the whole (shared) project.
 */
export const MEDIA_BUCKETS = ["videos", "studio-uploads", "studio-exports"] as const;

export type MediaBucket = (typeof MEDIA_BUCKETS)[number];

/** TTL bounds for derived signed URLs (seconds). Never long-lived. */
export const MIN_SIGN_TTL_SECONDS = 60;
export const MAX_SIGN_TTL_SECONDS = 3600;
/** Default lifetime of derived signed URLs: 1 hour. */
export const DEFAULT_SIGN_TTL_SECONDS = 3600;

export interface SignedRef {
  url: string;
  expiresAt: number;
}

/** True when the bucket is one the Studio media endpoints may sign. */
export function isMediaBucket(value: unknown): value is MediaBucket {
  return typeof value === "string" && (MEDIA_BUCKETS as readonly string[]).includes(value);
}

/** Validate a caller-supplied bucket against the allowlist (400 otherwise). */
export function assertMediaBucket(value: unknown): MediaBucket {
  if (!isMediaBucket(value)) {
    throw new HttpError(400, `bucket must be one of: ${MEDIA_BUCKETS.join(", ")}`);
  }
  return value;
}

/**
 * Validate a caller-supplied object path: a relative POSIX path, no `..`
 * traversal, no leading slash, bounded length.
 */
export function assertMediaPath(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpError(400, "path is required and must be a non-empty string");
  }
  if (value.length > 1024) {
    throw new HttpError(400, "path is too long");
  }
  if (value.startsWith("/") || value.includes("\\")) {
    throw new HttpError(400, "path must be a relative storage path");
  }
  const segments = value.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new HttpError(400, "path must not contain empty or relative segments");
  }
  return value;
}

/** Clamp a requested TTL into [60, 3600] seconds; junk falls back to 1 hour. */
export function clampSignTtl(requested: unknown): number {
  if (typeof requested !== "number" || !Number.isFinite(requested)) {
    return DEFAULT_SIGN_TTL_SECONDS;
  }
  const rounded = Math.round(requested);
  if (rounded <= 0) return MIN_SIGN_TTL_SECONDS;
  return Math.min(MAX_SIGN_TTL_SECONDS, Math.max(MIN_SIGN_TTL_SECONDS, rounded));
}

/** Structural twin of src/studio/mediaRefs.ts#isMediaRef. */
export function isMediaRef(value: unknown): value is MediaRef {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.bucket === "string" &&
    r.bucket.length > 0 &&
    typeof r.path === "string" &&
    r.path.length > 0 &&
    (r.kind === "video" || r.kind === "audio" || r.kind === "image")
  );
}

/** Does this storage path belong to the given user? `<user_id>/...` only. */
export function isOwnedPath(path: string, userId: string): boolean {
  if (!path || !userId) return false;
  const first = path.split("/")[0];
  return first === userId;
}

/**
 * Recover a canonical ref from a Supabase storage URL. Handles signed
 * (`/object/sign/<bucket>/<path>?token=…`), authenticated
 * (`/object/authenticated/…`) and public (`/object/public/…`) URLs, which is
 * what lets URL-only (legacy) records heal: the ref can be rebuilt and signed
 * again. Returns null for external URLs (those are their own identity).
 */
export function refFromUrl(url: unknown, kind: MediaKind = "video"): MediaRef | null {
  if (typeof url !== "string" || url.length === 0) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const match = parsed.pathname.match(
    /\/storage\/v1\/object\/(sign|authenticated|public)\/([^/]+)\/(.+)$/,
  );
  if (!match) return null;
  const bucket = decodeURIComponent(match[2]);
  const path = decodeURIComponent(match[3]);
  if (!bucket || !path) return null;
  return { bucket, path, kind };
}

/**
 * Sign a media ref with the service-role client and return the URL plus its
 * expiry (epoch ms). The bucket is validated against the allowlist first.
 */
export async function signRef(
  client: SupabaseClient,
  ref: MediaRef,
  ttlSeconds: number = DEFAULT_SIGN_TTL_SECONDS,
): Promise<SignedRef> {
  if (!isMediaRef(ref)) {
    throw new HttpError(400, "Invalid media ref");
  }
  const bucket = assertMediaBucket(ref.bucket);
  const path = assertMediaPath(ref.path);
  const ttl = clampSignTtl(ttlSeconds);

  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrl(path, ttl);

  const url = data?.signedUrl;
  if (error || typeof url !== "string" || !/^https?:\/\//i.test(url)) {
    throw new HttpError(500, `Could not sign ${bucket}/${path}: ${error?.message ?? "no signed URL returned"}`);
  }

  return { url, expiresAt: Date.now() + ttl * 1000 };
}

// ---------------------------------------------------------------------------
// Ownership of refs
// ---------------------------------------------------------------------------

/** Minimal structural view of the studio_projects query used for ownership. */
interface ProjectRefsQueryClient {
  from(
    table: "studio_projects",
  ): {
    select(
      columns: "project",
    ): {
      eq(
        column: "user_id",
        value: string,
      ): Promise<{
        data: Array<{ project?: unknown }> | null;
        error: { message: string } | null;
      }>;
    };
  };
}

function clipMatchesRef(clip: unknown, ref: MediaRef): boolean {
  if (!clip || typeof clip !== "object") return false;
  const assetRef = (clip as { assetRef?: unknown }).assetRef;
  return (
    isMediaRef(assetRef) &&
    assetRef.bucket === ref.bucket &&
    assetRef.path === ref.path
  );
}

/** Does a project JSON payload reference this ref on any clip or the logo? */
export function projectContainsRef(project: unknown, ref: MediaRef): boolean {
  if (!project || typeof project !== "object") return false;
  const p = project as { tracks?: unknown; branding?: unknown };

  if (Array.isArray(p.tracks)) {
    for (const track of p.tracks) {
      const clips = (track as { clips?: unknown } | null)?.clips;
      if (Array.isArray(clips) && clips.some((clip) => clipMatchesRef(clip, ref))) {
        return true;
      }
    }
  }

  const logoRef = (p.branding as { logoRef?: unknown } | null | undefined)?.logoRef;
  return (
    isMediaRef(logoRef) &&
    logoRef.bucket === ref.bucket &&
    logoRef.path === ref.path
  );
}

/**
 * Authorize signing a ref on behalf of userId, else throw:
 * - the path starts with `<user_id>/` (every Studio write is user-scoped), or
 * - one of the caller's studio_projects rows already references this exact
 *   ref on a clip (any stored path whose first segment is not the caller's
 *   user id). All Studio writes are `<uid>/…`-scoped, so this is the rare
 *   out-of-band case.
 *
 * Everything else is a 404 "Not found" — no existence leak.
 */
export async function assertRefOwnedOrThrow(
  ref: MediaRef,
  userId: string,
  client: SupabaseClient,
): Promise<void> {
  if (!isMediaRef(ref)) {
    throw new HttpError(400, "Invalid media ref");
  }
  assertMediaBucket(ref.bucket);
  assertMediaPath(ref.path);

  if (isOwnedPath(ref.path, userId)) return;

  const query = client as unknown as ProjectRefsQueryClient;
  const { data, error } = await query
    .from("studio_projects")
    .select("project")
    .eq("user_id", userId);

  if (error) {
    throw new HttpError(500, `Failed to verify media ownership: ${error.message ?? "unknown error"}`);
  }

  for (const row of data ?? []) {
    if (projectContainsRef(row?.project, ref)) return;
  }

  throw new NotFoundError("Not found");
}

// ---------------------------------------------------------------------------
// Render snapshot validation
// ---------------------------------------------------------------------------

/**
 * Every clip ref in a project snapshot must be owned by the project owner.
 * External http(s) asset URLs stay allowed (their own identity). Returns the
 * human-readable list of offenders; empty means "ok to render".
 */
export function findUnownedClipRefs(project: unknown, ownerUserId: string): string[] {
  if (!project || typeof project !== "object" || !ownerUserId) return [];
  const tracks = (project as { tracks?: unknown }).tracks;
  if (!Array.isArray(tracks)) return [];

  const offenders: string[] = [];
  tracks.forEach((track, trackIndex) => {
    const clips = (track as { clips?: unknown } | null)?.clips;
    if (!Array.isArray(clips)) return;
    clips.forEach((clip, clipIndex) => {
      if (!clip || typeof clip !== "object") return;
      const c = clip as { assetRef?: unknown; beatId?: unknown; id?: unknown };
      const ref = c.assetRef;
      if (ref === undefined || ref === null) return;
      if (!isMediaRef(ref)) {
        offenders.push(`tracks[${trackIndex}].clips[${clipIndex}] has a malformed assetRef`);
        return;
      }
      if (isOwnedPath(ref.path, ownerUserId)) return;
      offenders.push(
        `tracks[${trackIndex}].clips[${clipIndex}] (beat ${String(c.beatId ?? "none")}) ` +
          `references ${ref.bucket}/${ref.path}, which is not owned by this project`,
      );
    });
  });
  return offenders;
}
