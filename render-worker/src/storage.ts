import fs from 'fs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config, supabaseConfigured } from './config';

/**
 * Supabase access layer for the render worker. Uses the SERVICE ROLE key
 * (bypasses RLS) — the worker is the only component allowed to move jobs
 * between queue states and to re-sign private media for a render.
 */

export interface RenderJobRow {
  id: string;
  user_id: string;
  project_id: string;
  status: 'queued' | 'running' | 'done' | 'error';
  progress: number;
  output_url: string | null;
  captioned_output_url: string | null;
  error: string | null;
  worker_id: string | null;
  /** Snapshot of the project JSON at enqueue time (jsonb, NOT NULL). */
  project_snapshot: unknown;
  /** { width?, height?, fps?, ... } (jsonb, default {}). */
  render_settings: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

let client: SupabaseClient | null = null;

/**
 * Optional client factory injected by tests (see render-worker/test). It
 * defaults to null, in which case behavior is exactly as before: a single
 * lazily-created client built from SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
 * with @supabase/supabase-js. Production never installs a factory.
 */
let clientFactory: (() => SupabaseClient) | null = null;

/** Install a client factory (test seam). `null` restores the default client. */
export function setSupabaseClientFactory(factory: (() => SupabaseClient) | null): void {
  clientFactory = factory;
  client = null;
}

/** Drop the cached client so the next call re-creates (or re-injects) it. */
export function resetSupabaseClient(): void {
  client = null;
}

export function getSupabase(): SupabaseClient {
  if (!supabaseConfigured) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for queue operations');
  }
  if (!client) {
    client = clientFactory
      ? clientFactory()
      : createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
  }
  return client;
}

function requireClient(): SupabaseClient {
  try {
    return getSupabase();
  } catch (err) {
    throw new Error(`Supabase not configured: ${(err as Error).message}`);
  }
}

// ---------------------------------------------------------------------------
// Queue: claim / reclaim / progress
// ---------------------------------------------------------------------------

/**
 * Claim the oldest queued job. PostgREST cannot do an atomic
 * `UPDATE ... WHERE id = (SELECT ...) RETURNING`, so we do it in two steps
 * with an optimistic guard:
 *   1. SELECT oldest queued job
 *   2. UPDATE ... WHERE id = ? AND status = 'queued' RETURNING *
 * If step 2 returns no row, another worker won the race — caller gets null
 * and retries on the next poll.
 */
export async function claimNextJob(): Promise<RenderJobRow | null> {
  const supabase = requireClient();

  const { data: queued, error: selErr } = await supabase
    .from('studio_render_jobs')
    .select('*')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(1);

  if (selErr) throw new Error(`claim select failed: ${selErr.message}`);
  if (!queued || queued.length === 0) return null;

  const candidate = queued[0] as RenderJobRow;

  const { data: claimed, error: updErr } = await supabase
    .from('studio_render_jobs')
    .update({
      status: 'running',
      worker_id: config.workerId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', candidate.id)
    .eq('status', 'queued')
    .select()
    .single();

  if (updErr) throw new Error(`claim update failed: ${updErr.message}`);
  if (!claimed) return null; // lost the race to another worker

  return claimed as RenderJobRow;
}

/**
 * Stale job recovery: any job stuck in 'running' whose updated_at is older
 * than JOB_TIMEOUT_MS has no live heartbeat — its worker died mid-render.
 * Reset those back to 'queued' so another poll picks them up.
 * Jobs currently in flight in THIS process are skipped (their heartbeat is
 * still ticking, and we do not want to steal our own work).
 */
export async function reclaimStaleJobs(excludeIds: Set<string>): Promise<string[]> {
  const supabase = requireClient();
  const cutoff = new Date(Date.now() - config.jobTimeoutMs).toISOString();

  const { data: stale, error } = await supabase
    .from('studio_render_jobs')
    .select('id, worker_id')
    .eq('status', 'running')
    .lt('updated_at', cutoff);

  if (error) throw new Error(`stale scan failed: ${error.message}`);

  const ids = (stale || []).map((r: { id: string }) => r.id).filter((id: string) => !excludeIds.has(id));
  if (ids.length === 0) return [];

  const { error: updErr } = await supabase
    .from('studio_render_jobs')
    .update({
      status: 'queued',
      worker_id: null,
      updated_at: new Date().toISOString(),
    })
    .in('id', ids)
    .eq('status', 'running');

  if (updErr) throw new Error(`stale reclaim failed: ${updErr.message}`);
  return ids;
}

/** Progress update — also refreshes updated_at (the queue heartbeat). */
export async function updateJobProgress(jobId: string, progress: number): Promise<void> {
  const supabase = requireClient();
  const clamped = Math.max(0, Math.min(100, Math.round(progress)));
  const { error } = await supabase
    .from('studio_render_jobs')
    .update({ progress: clamped, updated_at: new Date().toISOString() })
    .eq('id', jobId)
    .eq('status', 'running');
  if (error) throw new Error(`progress update failed: ${error.message}`);
}

/** Heartbeat while a render is running (bumps updated_at via the update). */
export async function heartbeatJob(jobId: string): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase
    .from('studio_render_jobs')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', jobId)
    .eq('status', 'running');
  if (error) throw new Error(`heartbeat failed: ${error.message}`);
}

export async function markJobDone(jobId: string, outputUrl: string): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase
    .from('studio_render_jobs')
    .update({
      status: 'done',
      output_url: outputUrl,
      progress: 100,
      error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)
    .eq('status', 'running'); // never overwrite a job another worker reclaimed
  if (error) throw new Error(`mark done failed: ${error.message}`);
}

export async function markJobError(jobId: string, message: string): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase
    .from('studio_render_jobs')
    .update({
      status: 'error',
      error: message.slice(0, 2000),
      progress: 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)
    .eq('status', 'running'); // never overwrite a job another worker reclaimed
  if (error) throw new Error(`mark error failed: ${error.message}`);
}

/** Fallback snapshot source if a job row ever lacks project_snapshot. */
export async function fetchProjectSnapshot(projectId: string): Promise<unknown> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from('studio_projects')
    .select('project')
    .eq('id', projectId)
    .single();
  if (error) throw new Error(`project fetch failed: ${error.message}`);
  return data?.project;
}

/**
 * Owner of a project row — the identity every media ref of that project must
 * belong to. Read with the service-role client (the queue path never trusts a
 * client-supplied user id), and a hard error when the row is missing: without
 * an owner we cannot prove the render is only touching the owner's media.
 */
export async function fetchProjectOwner(projectId: string): Promise<string> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from('studio_projects')
    .select('user_id')
    .eq('id', projectId)
    .single();
  if (error) throw new Error(`project owner fetch failed: ${error.message}`);
  const owner = (data as { user_id?: unknown } | null)?.user_id;
  if (typeof owner !== 'string' || owner.length === 0) {
    throw new Error(`project ${projectId} has no owner — refusing to resolve its media`);
  }
  return owner;
}

// ---------------------------------------------------------------------------
// Storage: upload + signed URLs
// ---------------------------------------------------------------------------

/** Sanitize a `<user_id>/<project_id>/file.mp4` storage path. */
export function sanitizeStoragePath(rawPath: string): string {
  const segments = rawPath
    .split('/')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s !== '.' && s !== '..');
  if (segments.length === 0) throw new Error('invalid storage path');
  return segments.join('/');
}

export async function uploadRender(storagePath: string, filePath: string): Promise<string> {
  const supabase = requireClient();
  const cleanPath = sanitizeStoragePath(storagePath);
  const { error } = await supabase.storage
    .from(config.storageBucket)
    .upload(cleanPath, fs.createReadStream(filePath), {
      contentType: 'video/mp4',
      upsert: true,
    });
  if (error) throw new Error(`storage upload failed: ${error.message}`);
  return cleanPath;
}

export async function createSignedRenderUrl(storagePath: string): Promise<string> {
  const supabase = requireClient();
  const cleanPath = sanitizeStoragePath(storagePath);
  const { data, error } = await supabase.storage
    .from(config.storageBucket)
    .createSignedUrl(cleanPath, config.signedUrlExpirySeconds);
  if (error) throw new Error(`signed url failed: ${error.message}`);
  if (!data?.signedUrl) throw new Error('signed url missing from response');
  return data.signedUrl;
}

// ---------------------------------------------------------------------------
// Media resolution (worker-side only — never persisted back)
// ---------------------------------------------------------------------------

/** Canonical media reference: bucket + object path (mirrors src/studio/mediaRefs.ts). */
export interface MediaRefLike {
  bucket: string;
  path: string;
  kind?: string;
}

/** Lifetime of a render-session signed URL (seconds). */
export const RENDER_SIGNED_URL_TTL_SECONDS = 3600;

/**
 * Does this storage path belong to the given user? Studio objects are written
 * under `<user_id>/...`, so the first path segment IS the ownership proof.
 * Mirrors `isPathOwnedBy` in src/studio/mediaRefs.ts.
 */
export function isPathOwnedBy(path: string, userId: string): boolean {
  if (!path || !userId) return false;
  return path.split('/')[0] === userId;
}

/** True when the value looks like a usable media ref (defensive guard). */
function isMediaRefLike(value: unknown): value is MediaRefLike {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.bucket === 'string' &&
    r.bucket.length > 0 &&
    typeof r.path === 'string' &&
    r.path.length > 0
  );
}

const STORAGE_MARKERS = ['/storage/v1/object/sign/', '/storage/v1/object/authenticated/', '/storage/v1/object/public/'];

interface ParsedStorageUrl {
  bucket: string;
  path: string;
}

/**
 * Recover `{bucket, path}` from one of our own storage URLs (signed,
 * authenticated or public). Returns null for external CDN URLs — those are
 * their own identity and are passed through untouched.
 */
export function parseStorageUrl(assetUrl: string, supabaseUrl: string): ParsedStorageUrl | null {
  let parsed: URL;
  try {
    parsed = new URL(assetUrl);
  } catch {
    return null;
  }
  if (!supabaseUrl) return null;
  try {
    if (parsed.host !== new URL(supabaseUrl).host) return null;
  } catch {
    return null;
  }
  for (const marker of STORAGE_MARKERS) {
    const idx = parsed.pathname.indexOf(marker);
    if (idx === -1) continue;
    // the marker already carries the mode (sign|authenticated|public), so what
    // is left is <bucket>/<path...>
    const remainder = parsed.pathname.slice(idx + marker.length).split('/').filter(Boolean);
    if (remainder.length < 2) return null; // needs a bucket and a path
    const bucket = decodeURIComponent(remainder[0] ?? '');
    const objectPath = remainder.slice(1).map(decodeURIComponent).join('/');
    if (!bucket || !objectPath) return null;
    return { bucket, path: objectPath };
  }
  return null;
}

/** Short-lived signed URL for an object we have already proven the owner owns. */
async function signObject(bucket: string, objectPath: string): Promise<string> {
  const supabase = requireClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(objectPath, RENDER_SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    throw new Error(
      `could not sign storage asset ${objectPath} in bucket ${bucket}: ${error?.message ?? 'no signed url returned'}`,
    );
  }
  return data.signedUrl;
}

/**
 * Resolve a canonical media ref to a short-lived signed URL, refusing to sign
 * anything the project owner does not own.
 *
 * Private media must never be resolvable cross-user: `path` must start with
 * `<ownerUserId>/`, otherwise this throws and the job fails.
 */
export async function resolveMediaRef(
  ref: MediaRefLike,
  ownerUserId: string,
): Promise<string> {
  // runtime guard: the payload comes from a DB row, not from our own types
  if (!isMediaRefLike(ref)) {
    throw new Error('media ref is malformed (a non-empty bucket and path are required)');
  }
  if (!isPathOwnedBy(ref.path, ownerUserId)) {
    throw new Error(
      `media ownership check failed for ${ref.bucket}/${ref.path}: ` +
        `path is not owned by project owner ${ownerUserId}`,
    );
  }
  return signObject(ref.bucket, ref.path);
}

/**
 * Resolve a clip's persisted `assetUrl` for the renderer. Private Supabase
 * storage URLs cannot be fetched by headless Chromium (no Authorization
 * header), so any `<SUPABASE_URL>/storage/v1/object/...` asset is re-signed
 * here with the service-role client — after the same ownership check a ref
 * gets. External/CDN URLs are returned unchanged (never signed, never owned).
 *
 * `ownerUserId` is optional so the authenticated direct-render endpoint can
 * resolve legacy URLs without a DB row; the queue path always passes it.
 */
export async function resolveAssetUrl(
  assetUrl: string,
  ownerUserId?: string,
): Promise<string> {
  if (!assetUrl || !config.supabaseUrl) return assetUrl;
  const parsed = parseStorageUrl(assetUrl, config.supabaseUrl);
  if (!parsed) return assetUrl; // external CDN URL — its own identity
  if (ownerUserId && !isPathOwnedBy(parsed.path, ownerUserId)) {
    throw new Error(
      `media ownership check failed for ${parsed.bucket}/${parsed.path}: ` +
        `path is not owned by project owner ${ownerUserId}`,
    );
  }
  return signObject(parsed.bucket, parsed.path);
}

// ---------------------------------------------------------------------------
// Introspection for /health and /status
// ---------------------------------------------------------------------------

export async function queueDepth(): Promise<{ queued: number | null; running: number | null }> {
  if (!supabaseConfigured) return { queued: null, running: null };
  const supabase = requireClient();
  const [{ count: queued }, { count: running }] = await Promise.all([
    supabase.from('studio_render_jobs').select('id', { count: 'exact', head: true }).eq('status', 'queued'),
    supabase.from('studio_render_jobs').select('id', { count: 'exact', head: true }).eq('status', 'running'),
  ]);
  return { queued: queued ?? null, running: running ?? null };
}
