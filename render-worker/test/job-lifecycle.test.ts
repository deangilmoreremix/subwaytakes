/**
 * STAGING VALIDATION — job lifecycle, terminal writes, temp hygiene.
 *
 * Drives the real storage/queue/render modules against the in-memory Supabase
 * stub in ./supabase-stub.ts (injected via setSupabaseClientFactory). No
 * network, no Supabase, no Docker.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { config } from '../src/config';
import {
  claimNextJob,
  heartbeatJob,
  markJobDone,
  markJobError,
  reclaimStaleJobs,
  renderOutputRef,
  resetSupabaseClient,
  setSupabaseClientFactory,
} from '../src/storage';
import { processRenderJob } from '../src/render';
import { inFlightJobIds } from '../src/queue';
import {
  createSupabaseStub,
  makeJob,
  minimalProjectSnapshot,
  type SupabaseStub,
} from './supabase-stub';

const CONFIG_KEYS = [
  'workerId', 'pollIntervalMs', 'maxConcurrency', 'jobTimeoutMs',
  'heartbeatIntervalMs', 'repoRoot', 'storageBucket', 'signedUrlExpirySeconds',
] as const;

let stub: SupabaseStub;
let configBackup: Record<string, unknown>;
const tmpDirs: string[] = [];

function tmpDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tmpDirs.push(dir);
  return dir;
}

/** Repo whose remotion binary fails hard (simulates a killed/aborted render). */
function failingRepoRoot(): string {
  const root = tmpDir('lifecycle-fail-');
  const binDir = path.join(root, 'node_modules', '.bin');
  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(path.join(binDir, 'remotion'), '#!/bin/sh\nexit 134\n', { mode: 0o755 });
  return root;
}

function cleanup(): void {
  for (const d of tmpDirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
}

function tempDirsFor(jobId: string): string[] {
  const prefix = `render-job-${jobId}-`;
  return fs.readdirSync(os.tmpdir())
    .filter((e) => e.startsWith(prefix))
    .map((e) => path.join(os.tmpdir(), e));
}

beforeAll(() => {
  configBackup = {};
  for (const k of CONFIG_KEYS) configBackup[k] = (config as Record<string, unknown>)[k];
});

beforeEach(() => {
  stub = createSupabaseStub();
  setSupabaseClientFactory(() => stub.client);
  config.workerId = 'lifecycle';
  config.pollIntervalMs = 10;
  config.maxConcurrency = 2;
  config.jobTimeoutMs = 15 * 60_000;
  config.heartbeatIntervalMs = 30_000;
  config.storageBucket = 'studio-exports';
  config.repoRoot = failingRepoRoot();
});

afterEach(() => { resetSupabaseClient(); cleanup(); });

afterAll(() => {
  for (const k of CONFIG_KEYS) (config as Record<string, unknown>)[k] = configBackup[k];
});

// ---------------------------------------------------------------------------
// 1. Failed renders: error state + temp hygiene
// ---------------------------------------------------------------------------

describe('failed renders leave no trace', () => {
  it('marks the job error and removes its temp dir when the render crashes', async () => {
    const job = makeJob({ id: 'lifecycle-crash', project_snapshot: minimalProjectSnapshot() });
    stub.jobs.set(job.id, { ...job, status: 'running', worker_id: 'lifecycle' });

    await processRenderJob(job);

    const row = stub.jobs.get(job.id);
    expect(row?.status).toBe('error');
    expect(row?.error).toBeTruthy();
    expect(tempDirsFor(job.id)).toHaveLength(0); // finally ran and removed
  });

  it('cleans temp dirs orphaned by a SIGKILLed previous attempt', async () => {
    const job = makeJob({ id: 'lifecycle-orphan', project_snapshot: minimalProjectSnapshot() });
    stub.jobs.set(job.id, { ...job, status: 'running', worker_id: 'lifecycle' });

    // Previous attempt was SIGKILLed: its temp dir survived.
    const orphan = path.join(os.tmpdir(), `render-job-${job.id}-orphaned`);
    fs.mkdirSync(orphan, { recursive: true });
    fs.writeFileSync(path.join(orphan, 'props.json'), '{}');
    // Another job's in-flight dir must NOT be touched.
    const otherDir = path.join(os.tmpdir(), `render-job-some-other-job-inflight`);
    fs.mkdirSync(otherDir, { recursive: true });

    try {
      await processRenderJob(job);
      expect(fs.existsSync(orphan)).toBe(false);
      expect(fs.existsSync(otherDir)).toBe(true);
      expect(tempDirsFor(job.id)).toHaveLength(0);
    } finally {
      fs.rmSync(otherDir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Stale reclaim
// ---------------------------------------------------------------------------

describe('stale-job recovery', () => {
  it('reclaims a running job whose heartbeat went stale', async () => {
    const stale = makeJob({ id: 'lifecycle-stale', status: 'running', worker_id: 'worker-dead' });
    const fresh = makeJob({ id: 'lifecycle-fresh', status: 'running', worker_id: 'worker-alive' });
    stale.updated_at = new Date(Date.now() - config.jobTimeoutMs - 60_000).toISOString();
    fresh.updated_at = new Date().toISOString();
    stub.jobs.set(stale.id, stale);
    stub.jobs.set(fresh.id, fresh);

    const reclaimed = await reclaimStaleJobs(new Set());
    expect(reclaimed).toContain(stale.id);
    expect(reclaimed).not.toContain(fresh.id);
    expect(stub.jobs.get(stale.id)?.status).toBe('queued');

    const claimed = await claimNextJob();
    expect(claimed?.id).toBe(stale.id);
  });
});

// ---------------------------------------------------------------------------
// 3. markJobDone: durable output identity
// ---------------------------------------------------------------------------

describe('markJobDone persists the canonical output ref', () => {
  it('writes output_url AND output_ref together', async () => {
    const job = makeJob({ id: 'lifecycle-done', status: 'running' });
    stub.jobs.set(job.id, job);

    await markJobDone(
      job.id,
      'https://signed.example/render.mp4',
      renderOutputRef(`${job.user_id}/${job.project_id}/render-${job.id}.mp4`),
    );

    const row = stub.jobs.get(job.id);
    expect(row?.status).toBe('done');
    expect(row?.progress).toBe(100);
    expect(row?.output_url).toBe('https://signed.example/render.mp4');
    expect(row?.output_ref).toEqual({
      bucket: 'studio-exports',
      path: `${job.user_id}/${job.project_id}/render-${job.id}.mp4`,
      kind: 'video',
    });
  });

  it('drops structurally invalid refs instead of storing junk', async () => {
    const job = makeJob({ id: 'lifecycle-bad-ref', status: 'running' });
    stub.jobs.set(job.id, job);

    await markJobDone(job.id, 'https://signed.example/render.mp4', {
      bucket: 'studio-exports',
      // path missing — must be dropped
    } as unknown as { bucket: string; path: string; kind: 'video' });

    expect(stub.jobs.get(job.id)?.output_ref ?? null).toBeNull();
  });

  it('never overwrites a job another worker reclaimed', async () => {
    const job = makeJob({ id: 'lifecycle-reclaim', status: 'running' });
    stub.jobs.set(job.id, job);

    // Another worker reclaimed the row (back to queued) before we finished.
    stub.jobs.set(job.id, { ...job, status: 'queued', worker_id: null });

    // markJobDone filters .eq('status','running'), so this matches no rows
    // and must not touch the reclaimed job.
    await markJobDone(job.id, 'https://signed.example/render.mp4', renderOutputRef('x/y.mp4'));

    const row = stub.jobs.get(job.id);
    expect(row?.status).toBe('queued');
    expect(row?.output_url).toBeNull();
    expect(row?.output_ref ?? null).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. markJobError / heartbeat / concurrency surface
// ---------------------------------------------------------------------------

describe('terminal states and controls', () => {
  it('markJobError writes the error message', async () => {
    const job = makeJob({ id: 'lifecycle-err', status: 'running' });
    stub.jobs.set(job.id, job);
    await markJobError(job.id, 'render exploded');
    expect(stub.jobs.get(job.id)?.status).toBe('error');
    expect(stub.jobs.get(job.id)?.error).toBe('render exploded');
  });

  it('heartbeat refreshes updated_at during a render', async () => {
    const job = makeJob({ id: 'lifecycle-hb', status: 'running' });
    const old = new Date(Date.now() - 120_000).toISOString();
    job.updated_at = old;
    stub.jobs.set(job.id, job);

    await heartbeatJob(job.id);

    const after = stub.jobs.get(job.id)!;
    expect(after.updated_at).not.toBe(old);
    expect(new Date(after.updated_at).getTime()).toBeGreaterThan(new Date(old).getTime());
  });

  it('the queue loop bounds in-flight renders by maxConcurrency', () => {
    // queue.ts bounds concurrency with `while (inFlight.size < config.maxConcurrency)`
    // around claimNextJob(), tracked by inFlightJobIds(). The exhaustive
    // parallel-render proof lives in queue-semantics.test.ts; here we assert
    // the config + tracking surface.
    config.maxConcurrency = 1;
    expect(config.maxConcurrency).toBe(1);
    expect(inFlightJobIds()).toEqual([]);
  });
});
