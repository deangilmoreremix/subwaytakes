/**
 * Canonical media references for SubwayTakes Studio.
 *
 * PROBLEM THIS SOLVES: early versions stored a 7-day signed URL directly in
 * project JSON / job rows as the identity of a media asset. When the URL
 * expired the asset was permanently unreachable. Since the shared `videos`
 * bucket (and our `studio-uploads` / `studio-exports` buckets) are PRIVATE,
 * URLs must always be derived on demand and must never be the identity of an
 * asset.
 *
 * RULES:
 * - A `MediaRef` (bucket + path) is the ONLY canonical identity. It never
 *   expires. Persist refs, not URLs.
 * - `assetUrl` on clips is a SESSION value: a short-lived signed URL derived
 *   from `assetRef` (or an external/legacy http(s) URL). It may be refreshed
 *   at any time without semantic loss.
 * - Objects created by one user live under `<user_id>/...` paths so ownership
 *   can be verified from the path alone (defense in depth on top of RLS).
 */

export type MediaKind = 'video' | 'audio' | 'image';

export interface MediaRef {
  /** Storage bucket id, e.g. 'videos' (shared), 'studio-uploads', 'studio-exports'. */
  bucket: string;
  /** Object path inside the bucket, e.g. '<user_id>/<project_id>/scene-beat.mp4'. */
  path: string;
  kind: MediaKind;
}

/** Default lifetime of derived signed URLs (seconds). */
export const SIGNED_URL_TTL_SECONDS = 3600;

/** Refresh derived URLs when less than this remains (seconds). */
export const SIGNED_URL_REFRESH_MARGIN_SECONDS = 300;

/** Stable key for a ref (used for caching). */
export function mediaRefKey(ref: MediaRef): string {
  return `${ref.bucket}:${ref.path}`;
}

export function isMediaRef(value: unknown): value is MediaRef {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.bucket === 'string' &&
    r.bucket.length > 0 &&
    typeof r.path === 'string' &&
    r.path.length > 0 &&
    (r.kind === 'video' || r.kind === 'audio' || r.kind === 'image')
  );
}

/**
 * Best-effort recovery of a canonical ref from a Supabase storage URL.
 *
 * Handles signed URLs (`/storage/v1/object/sign/<bucket>/<path>?token=…`,
 * `/object/authenticated/<bucket>/<path>?token=…`) and public URLs
 * (`/object/public/<bucket>/<path>`). This is what makes projects created by
 * the old "persist the signed URL" architecture recoverable after the URL
 * expires: we can rebuild the ref and sign a fresh URL.
 *
 * Returns null when the URL is not a recognizable Supabase storage URL
 * (e.g. an external CDN link), in which case the URL itself is the identity.
 */
export function mediaRefFromStorageUrl(url: string, kind: MediaKind = 'video'): MediaRef | null {
  if (typeof url !== 'string' || url.length === 0) return null;
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

  // Cross-segment paths (folder/file) must stay intact; a trailing query
  // (token) is already stripped by URL.pathname.
  return { bucket, path, kind };
}

/**
 * Does this storage path belong to the given user? Studio objects are written
 * under `<user_id>/...`. Used as a path-level ownership guard wherever a
 * caller may influence which object gets signed or downloaded.
 */
export function isPathOwnedBy(path: string, userId: string): boolean {
  if (!path || !userId) return false;
  const first = path.split('/')[0];
  return first === userId;
}

/** True when a derived URL must be refreshed (unknown or about to expire). */
export function needsRefresh(expiresAt: number | undefined, nowMs: number = Date.now()): boolean {
  if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) return true;
  return expiresAt - nowMs <= SIGNED_URL_REFRESH_MARGIN_SECONDS * 1000;
}
