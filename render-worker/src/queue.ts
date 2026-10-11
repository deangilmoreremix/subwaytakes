import { config, supabaseConfigured } from './config';
import { RenderJobRow, claimNextJob, reclaimStaleJobs } from './storage';
import { processRenderJob } from './render';

/**
 * Queue loop: polls `studio_render_jobs` for queued jobs, claims them, and
 * runs the render pipeline. Concurrency is bounded by MAX_CONCURRENCY
 * (default 1 — a single render at a time keeps Chromium/ffmpeg CPU predictable).
 */

const inFlight = new Map<string, Promise<void>>();
let timer: NodeJS.Timeout | null = null;
let missingConfigLogged = false;

export function inFlightJobIds(): string[] {
  return [...inFlight.keys()];
}

export function queueStatus(): { inFlight: string[]; maxConcurrency: number; running: boolean } {
  return { inFlight: inFlightJobIds(), maxConcurrency: config.maxConcurrency, running: timer !== null };
}

/** Wait until all in-flight renders settle (used by graceful shutdown). */
export async function drainQueue(): Promise<void> {
  await Promise.allSettled([...inFlight.values()]);
}

async function pollOnce(): Promise<void> {
  if (!supabaseConfigured) {
    if (!missingConfigLogged) {
      missingConfigLogged = true;
      console.warn('[queue] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — queue polling disabled');
    }
    return;
  }

  try {
    // 1. Reclaim stale 'running' jobs (worker died without heartbeat).
    const reclaimed = await reclaimStaleJobs(new Set(inFlight.keys()));
    if (reclaimed.length > 0) {
      console.warn(`[queue] reclaimed ${reclaimed.length} stale job(s): ${reclaimed.join(', ')}`);
    }

    // 2. Claim + start up to MAX_CONCURRENCY jobs.
    while (inFlight.size < config.maxConcurrency) {
      const job: RenderJobRow | null = await claimNextJob();
      if (!job) break;
      console.log(`[queue] claimed job ${job.id} (project ${job.project_id})`);
      const promise = processRenderJob(job).finally(() => {
        inFlight.delete(job.id);
      });
      inFlight.set(job.id, promise);
    }

    console.debug(
      `[queue] poll complete: ${inFlight.size} in flight, max ${config.maxConcurrency}`,
    );
  } catch (err) {
    console.error(`[queue] poll failed: ${(err as Error).message}`);
  }
}

/** Start polling after a short delay so the HTTP server is up first. */
export function startQueueLoop(delayMs = 2000): void {
  if (timer) return;
  setTimeout(() => {
    void pollOnce();
    timer = setInterval(() => void pollOnce(), config.pollIntervalMs);
    console.log(
      `[queue] loop started — polling every ${config.pollIntervalMs}ms, max concurrency ${config.maxConcurrency}, stale timeout ${config.jobTimeoutMs}ms`,
    );
  }, delayMs);
}

export function stopQueueLoop(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
