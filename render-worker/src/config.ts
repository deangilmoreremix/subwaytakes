import os from 'os';
import path from 'path';

/**
 * Worker configuration. Every value is overridable via env vars — see
 * render-worker/.env.example for the full list.
 */
function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const WORKER_VERSION = '1.0.0';

/** Repo root that contains node_modules/.bin/remotion + remotion/src/index.ts. */
function resolveRepoRoot(): string {
  if (process.env.REPO_ROOT && process.env.REPO_ROOT.trim() !== '') {
    return path.resolve(process.env.REPO_ROOT);
  }
  // dist/config.js -> <repo>/render-worker/dist -> <repo>
  // src/config.ts   -> <repo>/render-worker/src   -> <repo>
  return path.resolve(__dirname, '..', '..');
}

export const config = {
  port: intEnv('PORT', 3010),
  workerVersion: WORKER_VERSION,

  // ---- auth ----
  // When WORKER_API_KEY is empty the service runs OPEN (same convention as
  // thumbnail-service when API_KEY is unset) — only acceptable behind a
  // private network; set the key in production.
  workerApiKey: process.env.WORKER_API_KEY || '',

  // ---- supabase (service role bypasses RLS; worker owns the queue) ----
  supabaseUrl: (process.env.SUPABASE_URL || '').replace(/\/+$/, ''),
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',

  // ---- paths ----
  repoRoot: resolveRepoRoot(),
  ffmpegPath: process.env.FFMPEG_PATH || '/usr/bin/ffmpeg',
  ffprobePath: process.env.FFPROBE_PATH || '/usr/bin/ffprobe',

  // ---- queue ----
  pollIntervalMs: intEnv('POLL_INTERVAL_MS', 3000),
  maxConcurrency: Math.max(1, intEnv('MAX_CONCURRENCY', 1)),
  jobTimeoutMs: intEnv('JOB_TIMEOUT_MS', 15 * 60 * 1000),
  heartbeatIntervalMs: intEnv('HEARTBEAT_INTERVAL_MS', 30 * 1000),

  // ---- remotion ----
  // Remotion --timeout flag is in MILLISECONDS.
  renderTimeoutMs: intEnv('RENDER_TIMEOUT_MS', 600000),
  remotionConcurrency: Math.max(1, intEnv('REMOTION_CONCURRENCY', 2)),
  // Bundler entry registering the "SubwayEditor" composition (relative to
  // repoRoot). Defaults to the repo Remotion root, which registers the
  // SubwayEditor composition (remotion/src/Root.tsx). The worker bridge entry
  // (render-worker/src/remotion-entry.tsx) remains as a fallback override.
  remotionEntry: process.env.REMOTION_ENTRY || 'remotion/src/index.ts',

  // ---- delivery spec (the encode gate) ----
  outputWidth: intEnv('OUTPUT_WIDTH', 1080),
  outputHeight: intEnv('OUTPUT_HEIGHT', 1920),
  outputFps: intEnv('OUTPUT_FPS', 30),
  outputCrf: process.env.OUTPUT_CRF || '20',
  storageBucket: process.env.STORAGE_BUCKET || 'studio-exports',
  signedUrlExpirySeconds: intEnv('SIGNED_URL_EXPIRY_SECONDS', 604800),

  workerId: `${os.hostname()}-${process.pid}`,
};

export const supabaseConfigured = Boolean(config.supabaseUrl && config.supabaseServiceRoleKey);
