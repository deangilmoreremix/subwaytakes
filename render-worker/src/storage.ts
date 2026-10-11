import fs from 'fs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config, supabaseConfigured } from './config';

/**
 * Supabase access layer for the render worker. Uses the SERVICE ROLE key
 * (bypasses RLS) — the worker is the only component allowed to move jobs
 * between queue states.
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
    .eq('id', jobId);
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

/**
 * Resolve an asset URL for the renderer. Private Supabase storage URLs cannot
 * be fetched by headless Chromium (no Authorization header), so any
 * `<SUPABASE_URL>/storage/v1/object/...` asset is re-signed here with the
 * service-role client. External/CDN URLs are returned unchanged.
 */
export async function resolveAssetUrl(assetUrl: string): Promise<string> {
  if (!config.supabaseUrl) return assetUrl;
  let parsed: URL;
  try {
    parsed = new URL(assetUrl);
  } catch {
    return assetUrl;
  }
  const supabaseHost = new URL(config.supabaseUrl).host;
  if (parsed.host !== supabaseHost) return assetUrl;

  const marker = '/storage/v1/object/';
  const idx = parsed.pathname.indexOf(marker);
  if (idx === -1) return assetUrl;

  // /storage/v1/object/{public|authenticated}/<bucket>/<path...>
  const remainder = parsed.pathname.slice(idx + marker.length).split('/').filter(Boolean);
  if (remainder.length < 3) return assetUrl;
  const bucket = decodeURIComponent(remainder[1] ?? '');
  const objectPath = remainder.slice(2).map(decodeURIComponent).join('/');
  if (!bucket || !objectPath) return assetUrl;

  const supabase = requireClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(objectPath, 3600);
  if (error || !data?.signedUrl) {
    throw new Error(
      `could not sign storage asset ${objectPath} in bucket ${bucket}: ${error?.message ?? 'no signed url returned'}`,
    );
  }
  return data.signedUrl;
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
