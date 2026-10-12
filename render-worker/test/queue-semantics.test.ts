/**
 * STAGING VALIDATION SUITE — queue semantics.
 *
 * Runs the real render-worker storage/queue/render modules against the
 * in-memory Supabase stub in ./supabase-stub.ts (injected through
 * `setSupabaseClientFactory`, the one test seam in src/). No network, no
 * Supabase, no Docker.
 *
 * Guarantees proven here (mirrors the Phase 3 checklist):
 *   - exactly-once claim of a queued job (concurrent claimers)
 *   - heartbeat refreshes updated_at; stale 'running' jobs are reclaimed
 *   - terminal writes: done / error, never left 'running'
 *   - MAX_CONCURRENCY bounds in-flight renders
 *   - startup fails loudly on missing Supabase config; auth wiring
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import * as http from 'http';

import { config } from '../src/config';
import {
  claimNextJob,
  createSignedRenderUrl,
  fetchProjectSnapshot,
  heartbeatJob,
  markJobDone,
  markJobError,
  queueDepth,
  reclaimStaleJobs,
  resetSupabaseClient,
  resolveAssetUrl,
  sanitizeStoragePath,
  setSupabaseClientFactory,
  updateJobProgress,
  uploadRender,
  type RenderJobRow,
} from '../src/storage';
import { processRenderJob } from '../src/render';
import { inFlightJobIds, startQueueLoop, stopQueueLoop } from '../src/queue';
import {
  createSupabaseStub,
  delay,
  makeJob,
  minimalProjectSnapshot,
  type SupabaseStub,
} from './supabase-stub';

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

const CONFIG_KEYS = [
  'workerId',
  'pollIntervalMs',
  'maxConcurrency',
  'jobTimeoutMs',
  'heartbeatIntervalMs',
  'repoRoot',
  'storageBucket',
  'signedUrlExpirySeconds',
] as const;

let stub: SupabaseStub;
let configBackup: Record<string, unknown>;
const tmpDirs: string[] = [];

function tmpDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tmpDirs.push(dir);
  return dir;
}

/** A repo root whose `node_modules/.bin/remotion` just sleeps and exits. */
function fakeRepoRoot(options: { sleepMs?: number; exitCode?: number } = {}): string {
  const root = tmpDir(`fake-repo-${options.sleepMs ?? 0}-`);
  const binDir = path.join(root, 'node_modules', '.bin');
  fs.mkdirSync(binDir, { recursive: true });
  const bin = path.join(binDir, 'remotion');
  fs.writeFileSync(
    bin,
    `#!${process.execPath}\nsetTimeout(() => process.exit(${options.exitCode ?? 0}), ${options.sleepMs ?? 0});\n`,
    { mode: 0o755 },
  );
  return root;
}

/** A repo root with no remotion CLI at all (spawn-less failure path). */
function emptyRepoRoot(): string {
  const root = tmpDir('empty-repo-');
  fs.mkdirSync(path.join(root, 'node_modules', '.bin'), { recursive: true });
  return root;
}

function setWorkerId(value: string): void {
  Object.defineProperty(config, 'workerId', { configurable: true, writable: true, enumerable: true, value });
}

/** Highest number of rows simultaneously in 'running' per the stub's log. */
function maxConcurrentRunning(s: SupabaseStub): number {
  const events: { at: number; delta: number }[] = [];
  for (const t of s.transitions) {
    if (t.from === 'running') events.push({ at: t.at, delta: -1 });
    if (t.to === 'running') events.push({ at: t.at, delta: 1 });
  }
  events.sort((a, b) => a.at - b.at);
  let current = 0;
  let max = 0;
  for (const e of events) {
    current += e.delta;
    max = Math.max(max, current);
  }
  return max;
}

beforeEach(() => {
  configBackup = {};
  for (const key of CONFIG_KEYS) configBackup[key] = (config as unknown as Record<string, unknown>)[key];
  stub = createSupabaseStub({ latencyMs: 0 });
  setSupabaseClientFactory(() => stub.client);
  config.jobTimeoutMs = 15 * 60 * 1000;
});

afterEach(async () => {
  stopQueueLoop();
  setSupabaseClientFactory(null);
  resetSupabaseClient();
  for (const key of CONFIG_KEYS) {
    (config as unknown as Record<string, unknown>)[key] = configBackup[key];
  }
  setWorkerId(configBackup.workerId as string);
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
  tmpDirs.length = 0;
});

// ---------------------------------------------------------------------------
// 1. Claim is exactly-once
// ---------------------------------------------------------------------------

describe('claimNextJob is exactly-once', () => {
  it('5 concurrent claimers over 1 queued job: exactly one wins the guarded UPDATE', async () => {
    stub.latencyMs = 5; // concurrent statements interleave on the wire
    stub.insertJob(makeJob({ id: 'job-a', status: 'queued' }));

    // Distinct worker identities, as if 5 worker processes raced.
    let racer = 0;
    const originalWorkerId = config.workerId as string;
    Object.defineProperty(config, 'workerId', { configurable: true, get: () => `racer-${++racer}` });

    let results: (RenderJobRow | null)[];
    try {
      results = await Promise.all(Array.from({ length: 5 }, () => claimNextJob()));
    } finally {
      setWorkerId(originalWorkerId);
    }

    const winners = results.filter((r): r is RenderJobRow => r !== null);
    expect(winners).toHaveLength(1);
    expect(winners[0]!.id).toBe('job-a');

    // Every claimer selected the SAME queued row — without the guarded
    // UPDATE they would all have claimed it.
    const claimSelects = stub.calls.filter(
      (c) => c.op === 'select' && c.table === 'studio_render_jobs' && c.columns === '*',
    );
    expect(claimSelects).toHaveLength(5);
    expect(claimSelects.every((c) => c.candidateId === 'job-a')).toBe(true);

    // ...and exactly one of the 5 guarded UPDATEs matched a row.
    const claimUpdates = stub.calls.filter(
      (c) => c.op === 'update' && c.table === 'studio_render_jobs' && c.payload?.status === 'running',
    );
    expect(claimUpdates).toHaveLength(5);
    expect(claimUpdates.filter((c) => c.matched === 1)).toHaveLength(1);
    expect(claimUpdates.filter((c) => c.matched === 0)).toHaveLength(4);

    const row = stub.jobs.get('job-a')!;
    expect(row.status).toBe('running');
    expect(row.worker_id).toBe(winners[0]!.worker_id);
    expect(row.worker_id).toMatch(/^racer-\d+$/);
  });

  it('a lost race never yields a row — even when PostgREST answers 406/PGRST116', async () => {
    // postgrest-js 2.x turns a zero-row `.single()` into a 406 error rather
    // than null, so the worker can also surface this as `claim update failed`.
    // Either way exactly one job is claimed and it is never claimed twice.
    stub.latencyMs = 5;
    stub.strictSingleEmpty = true;
    stub.insertJob(makeJob({ id: 'job-b', status: 'queued' }));

    const settled = await Promise.allSettled(Array.from({ length: 5 }, () => claimNextJob()));
    const winners = settled.filter(
      (r): r is PromiseFulfilledResult<RenderJobRow | null> =>
        r.status === 'fulfilled' && r.value !== null,
    );
    expect(winners).toHaveLength(1);
    expect(winners[0]!.value!.id).toBe('job-b');

    const row = stub.jobs.get('job-b')!;
    expect(row.status).toBe('running');
    expect(new Set([row.worker_id]).size).toBe(1);
    const claimUpdates = stub.calls.filter((c) => c.payload?.status === 'running');
    expect(claimUpdates.filter((c) => c.matched === 1)).toHaveLength(1);
  });

  it('claims the oldest queued job first and stops when the queue drains', async () => {
    const base = Date.now();
    stub.insertJob(
      makeJob({ id: 'job-newer', created_at: new Date(base + 5000).toISOString(), updated_at: new Date(base + 5000).toISOString() }),
    );
    stub.insertJob(
      makeJob({ id: 'job-older', created_at: new Date(base).toISOString(), updated_at: new Date(base).toISOString() }),
    );
    stub.insertJob(
      makeJob({ id: 'job-oldest', created_at: new Date(base - 5000).toISOString(), updated_at: new Date(base - 5000).toISOString() }),
    );
    setWorkerId('worker-1');

    expect((await claimNextJob())!.id).toBe('job-oldest');
    expect((await claimNextJob())!.id).toBe('job-older');
    expect((await claimNextJob())!.id).toBe('job-newer');
    expect(await claimNextJob()).toBeNull();
    expect(stub.jobs.get('job-oldest')!.worker_id).toBe('worker-1');
  });

  it('a claim sets worker_id and updated_at (heartbeat baseline)', async () => {
    const old = new Date(Date.now() - 60_000).toISOString();
    stub.insertJob(makeJob({ id: 'job-c', created_at: old, updated_at: old }));
    const claimed = await claimNextJob();
    expect(claimed!.status).toBe('running');
    expect(claimed!.worker_id).toBe(config.workerId);
    expect(new Date(claimed!.updated_at).getTime()).toBeGreaterThan(new Date(old).getTime());
  });
});

// ---------------------------------------------------------------------------
// 2. Heartbeat + stale reclaim
// ---------------------------------------------------------------------------

describe('heartbeat and stale recovery', () => {
  it('heartbeatJob bumps updated_at without touching status/progress', async () => {
    const before = new Date(Date.now() - 60_000).toISOString();
    stub.insertJob(makeJob({ id: 'hb-1', status: 'running', progress: 42, worker_id: 'w-1', updated_at: before }));

    await heartbeatJob('hb-1');

    const row = stub.jobs.get('hb-1')!;
    expect(new Date(row.updated_at).getTime()).toBeGreaterThan(new Date(before).getTime());
    expect(row.status).toBe('running');
    expect(row.progress).toBe(42);
  });

  it('heartbeat is guarded to running rows (no resurrection of dead rows)', async () => {
    const before = new Date(Date.now() - 60_000).toISOString();
    stub.insertJob(makeJob({ id: 'hb-2', status: 'error', progress: 0, updated_at: before }));
    await heartbeatJob('hb-2');
    expect(stub.jobs.get('hb-2')!.updated_at).toBe(before);
  });

  it('updateJobProgress clamps to 0..100 and also refreshes updated_at', async () => {
    const before = new Date(Date.now() - 60_000).toISOString();
    stub.insertJob(makeJob({ id: 'prog-1', status: 'running', updated_at: before }));

    await updateJobProgress('prog-1', 55);
    expect(stub.jobs.get('prog-1')!.progress).toBe(55);
    expect(new Date(stub.jobs.get('prog-1')!.updated_at).getTime()).toBeGreaterThan(
      new Date(before).getTime(),
    );

    await updateJobProgress('prog-1', 150);
    expect(stub.jobs.get('prog-1')!.progress).toBe(100);
    await updateJobProgress('prog-1', -10);
    expect(stub.jobs.get('prog-1')!.progress).toBe(0);
  });

  it('reclaimStaleJobs resets stale running jobs and leaves fresh ones alone', async () => {
    const staleAt = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    const freshAt = new Date().toISOString();
    stub.insertJob(makeJob({ id: 'stale-1', status: 'running', worker_id: 'dead-worker', updated_at: staleAt }));
    stub.insertJob(makeJob({ id: 'fresh-1', status: 'running', worker_id: 'live-worker', updated_at: freshAt }));
    stub.insertJob(makeJob({ id: 'queued-1', status: 'queued' }));

    const reclaimed = await reclaimStaleJobs(new Set());

    expect(reclaimed).toEqual(['stale-1']);
    const stale = stub.jobs.get('stale-1')!;
    expect(stale.status).toBe('queued');
    expect(stale.worker_id).toBeNull();

    const fresh = stub.jobs.get('fresh-1')!;
    expect(fresh.status).toBe('running');
    expect(fresh.worker_id).toBe('live-worker');
    expect(fresh.updated_at).toBe(freshAt);
    expect(stub.jobs.get('queued-1')!.status).toBe('queued');
  });

  it('reclaimStaleJobs skips jobs currently in flight in this process', async () => {
    const staleAt = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    stub.insertJob(makeJob({ id: 'mine-1', status: 'running', worker_id: config.workerId, updated_at: staleAt }));
    stub.insertJob(makeJob({ id: 'theirs-1', status: 'running', worker_id: 'other-worker', updated_at: staleAt }));

    const reclaimed = await reclaimStaleJobs(new Set(['mine-1']));

    expect(reclaimed).toEqual(['theirs-1']);
    expect(stub.jobs.get('mine-1')!.status).toBe('running');
    expect(stub.jobs.get('mine-1')!.worker_id).toBe(config.workerId);
  });

  it('a reclaimed job is claimable again (crash recovery loop)', async () => {
    const staleAt = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    stub.insertJob(makeJob({ id: 'revive-1', status: 'running', worker_id: 'dead-worker', updated_at: staleAt }));
    setWorkerId('replacement-worker');

    expect(await reclaimStaleJobs(new Set())).toEqual(['revive-1']);
    const claimed = await claimNextJob();
    expect(claimed!.id).toBe('revive-1');
    expect(claimed!.worker_id).toBe('replacement-worker');
  });

  it('a long render keeps refreshing updated_at (heartbeat) instead of being reclaimed', async () => {
    config.repoRoot = fakeRepoRoot({ sleepMs: 250 });
    config.heartbeatIntervalMs = 20;
    const job = stub.insertJob(
      makeJob({ id: 'long-1', status: 'running', progress: 5, worker_id: config.workerId }),
    );
    const updatedAtAfterClaim = job.updated_at;

    const running = processRenderJob(job);
    await delay(140); // mid-render: the fake remotion CLI is still "rendering"

    const midFlight = stub.jobs.get('long-1')!;
    expect(midFlight.status).toBe('running');
    expect(new Date(midFlight.updated_at).getTime()).toBeGreaterThan(
      new Date(updatedAtAfterClaim).getTime(),
    );
    const heartbeats = stub.calls.filter(
      (c) => c.op === 'update' && c.payload && 'updated_at' in c.payload && !('progress' in c.payload),
    );
    expect(heartbeats.length).toBeGreaterThan(0);

    await running;
    expect(stub.jobs.get('long-1')!.status).toBe('error');
  });
});

// ---------------------------------------------------------------------------
// 3. Terminal states
// ---------------------------------------------------------------------------

describe('terminal states: done / error', () => {
  it('markJobDone writes status, progress and output_url and clears error', async () => {
    const before = new Date(Date.now() - 60_000).toISOString();
    stub.insertJob(
      makeJob({ id: 'done-1', status: 'running', progress: 85, worker_id: 'w-1', updated_at: before }),
    );

    await markJobDone(
      'done-1',
      'https://stub.supabase.test/storage/v1/object/sign/studio-exports/u/p/render-done-1.mp4?token=x',
    );

    const row = stub.jobs.get('done-1')!;
    expect(row.status).toBe('done');
    expect(row.progress).toBe(100);
    expect(row.output_url).toContain('/studio-exports/u/p/render-done-1.mp4');
    expect(row.error).toBeNull();
    expect(new Date(row.updated_at).getTime()).toBeGreaterThan(new Date(before).getTime());
    expect(row.status).not.toBe('running');
  });

  it('markJobError writes status/error and resets progress to 0', async () => {
    const before = new Date(Date.now() - 60_000).toISOString();
    stub.insertJob(makeJob({ id: 'err-1', status: 'running', progress: 63, worker_id: 'w-1', updated_at: before }));

    await markJobError('err-1', 'Render verification failed: dimensions are 640x360, expected 1080x1920');

    const row = stub.jobs.get('err-1')!;
    expect(row.status).toBe('error');
    expect(row.error).toContain('dimensions are 640x360');
    expect(row.progress).toBe(0);
    expect(row.status).not.toBe('running');
    expect(new Date(row.updated_at).getTime()).toBeGreaterThan(new Date(before).getTime());
  });

  it('markJobError never overwrites a job another worker already reclaimed', async () => {
    const staleAt = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    stub.insertJob(makeJob({ id: 'err-2', status: 'running', worker_id: 'other-worker', updated_at: staleAt }));
    await reclaimStaleJobs(new Set()); // another worker reclaimed it

    await markJobError('err-2', 'render failed');

    const row = stub.jobs.get('err-2')!;
    expect(row.status).toBe('queued');
    expect(row.error).toBeNull();
  });

  it('a failing job settles as error, not running — render step throws (no remotion CLI)', async () => {
    config.repoRoot = emptyRepoRoot();
    const job = stub.insertJob(makeJob({ id: 'fail-1', status: 'running', worker_id: config.workerId }));
    const tmp = os.tmpdir();
    const leaked = () => fs.readdirSync(tmp).filter((f) => f.startsWith(`render-job-fail-1-`));
    expect(leaked()).toHaveLength(0);

    await processRenderJob(job); // must not throw — the pipeline owns the failure

    const row = stub.jobs.get('fail-1')!;
    expect(row.status).toBe('error');
    expect(row.progress).toBe(0);
    expect(row.error).toContain('remotion CLI not found');
    expect(row.status).not.toBe('running');

    // progress 5 was written before the render step blew up
    const progressUpdates = stub.calls.filter((c) => c.payload && 'progress' in c.payload);
    expect(progressUpdates.some((c) => c.payload!.progress === 5)).toBe(true);

    // the finally block removed the temp dir
    expect(leaked()).toHaveLength(0);
  });

  it('a job whose render produces no output settles as error (never done)', async () => {
    config.repoRoot = fakeRepoRoot({ sleepMs: 0 });
    const job = stub.insertJob(makeJob({ id: 'fail-2', status: 'running', worker_id: config.workerId }));

    await processRenderJob(job);

    const row = stub.jobs.get('fail-2')!;
    expect(row.status).toBe('error');
    expect(row.error).toContain('remotion render produced no output file');
    expect(row.output_url).toBeNull();
    expect(row.progress).toBe(0);
  });

  it('the success tail (upload -> signed url -> markJobDone) settles the row as done', async () => {
    const workDir = tmpDir('life-tail-');
    const filePath = path.join(workDir, 'final.mp4');
    fs.writeFileSync(filePath, Buffer.alloc(2048, 3));
    const job = stub.insertJob(makeJob({ id: 'life-1', status: 'running', worker_id: config.workerId }));
    const storagePath = `${job.user_id}/${job.project_id}/render-${job.id}.mp4`;

    const cleanPath = await uploadRender(storagePath, filePath);
    const signedUrl = await createSignedRenderUrl(cleanPath);
    await markJobDone(job.id, signedUrl);

    const row = stub.jobs.get('life-1')!;
    expect(row.status).toBe('done');
    expect(row.progress).toBe(100);
    expect(row.output_url).toBe(signedUrl);
    expect(row.output_url).toContain(`/studio-exports/${job.user_id}/${job.project_id}/render-${job.id}.mp4`);
  });

  it('an invalid project_snapshot settles as error without touching remotion', async () => {
    config.repoRoot = emptyRepoRoot();
    const job = stub.insertJob(
      makeJob({
        id: 'fail-3',
        status: 'running',
        worker_id: config.workerId,
        project_snapshot: { ...minimalProjectSnapshot(), duration: 0, tracks: [], captions: [] },
      }),
    );

    await processRenderJob(job);

    const row = stub.jobs.get('fail-3')!;
    expect(row.status).toBe('error');
    expect(row.error).toContain('invalid project_snapshot');
    expect(row.progress).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 4. Storage upload + signed URLs (private bucket)
// ---------------------------------------------------------------------------

describe('storage upload and signed URLs', () => {
  it('uploadRender uploads to the private studio-exports bucket with mp4 content type', async () => {
    const workDir = tmpDir('upload-');
    const filePath = path.join(workDir, 'final.mp4');
    fs.writeFileSync(filePath, Buffer.alloc(1024, 7));
    const job = makeJob({ id: 'up-1' });
    stub.insertJob(job);
    const storagePath = `${job.user_id}/${job.project_id}/render-${job.id}.mp4`;

    const returned = await uploadRender(storagePath, filePath);
    expect(returned).toBe(storagePath);

    const upload = stub.calls.find((c) => c.op === 'upload')!;
    expect(upload.bucket).toBe('studio-exports');
    expect(upload.contentType).toBe('video/mp4');
    expect(upload.upsert).toBe(true);
    expect(upload.bytes).toBe(1024);

    const object = stub.bucket('studio-exports').objects.get(storagePath);
    expect(object).toBeDefined();
    expect(object!.bytes).toBe(1024);
  });

  it('createSignedRenderUrl asks for the configured 7-day expiry', async () => {
    const workDir = tmpDir('sign-');
    const filePath = path.join(workDir, 'final.mp4');
    fs.writeFileSync(filePath, Buffer.alloc(16));
    const storagePath = 'u-1/p-1/render-sign-1.mp4';
    await uploadRender(storagePath, filePath);

    const url = await createSignedRenderUrl(storagePath);

    const call = stub.calls.find((c) => c.op === 'createSignedUrl')!;
    expect(call.expiresIn).toBe(config.signedUrlExpirySeconds);
    expect(config.signedUrlExpirySeconds).toBe(604800);
    expect(url).toContain('/storage/v1/object/sign/studio-exports/u-1/p-1/render-sign-1.mp4');
    expect(url).toContain('expires_in=604800');
  });

  it('createSignedRenderUrl fails loudly when nothing was uploaded', async () => {
    await expect(createSignedRenderUrl('u/p/render-missing.mp4')).rejects.toThrow(/signed url/);
  });

  it('sanitizeStoragePath strips traversal segments and rejects empty paths', () => {
    expect(sanitizeStoragePath('u/../p/render.mp4')).toBe('u/p/render.mp4');
    expect(sanitizeStoragePath('  /u//p/  ')).toBe('u/p');
    expect(() => sanitizeStoragePath('../..')).toThrow(/invalid storage path/);
  });

  it('queueDepth counts queued and running rows', async () => {
    stub.insertJob(makeJob({ id: 'q-1', status: 'queued' }));
    stub.insertJob(makeJob({ id: 'q-2', status: 'queued' }));
    stub.insertJob(makeJob({ id: 'r-1', status: 'running' }));
    stub.insertJob(makeJob({ id: 'd-1', status: 'done' }));
    expect(await queueDepth()).toEqual({ queued: 2, running: 1 });
  });

  it('resolveAssetUrl re-signs private bucket URLs and passes CDN URLs through', async () => {
    const workDir = tmpDir('asset-');
    const filePath = path.join(workDir, 'clip.mp4');
    fs.writeFileSync(filePath, Buffer.from('fake-bytes'));
    // the asset lives in the private `studio-uploads` bucket (user footage)
    await stub
      .bucket('studio-uploads')
      .upload('u-1/assets/clip.mp4', fs.createReadStream(filePath), { contentType: 'video/mp4' });

    const external = await resolveAssetUrl('https://cdn.example.com/clip.mp4');
    expect(external).toBe('https://cdn.example.com/clip.mp4');

    const signed = await resolveAssetUrl(
      'https://stub.supabase.test/storage/v1/object/authenticated/studio-uploads/u-1/assets/clip.mp4',
    );
    expect(signed).toContain('/storage/v1/object/sign/');
    expect(signed).toContain('expires_in=3600');

    // uploadRender put the object in studio-exports; the bucket in the URL is
    // studio-uploads, so signing it must fail loudly (no silent fallthrough).
    await expect(
      resolveAssetUrl('https://stub.supabase.test/storage/v1/object/authenticated/studio-uploads/missing.mp4'),
    ).rejects.toThrow(/could not sign storage asset/);
  });

  it('fetchProjectSnapshot falls back to studio_projects when a row has no snapshot', async () => {
    stub.projects.push({ id: '22222222-2222-2222-2222-222222222222', project: minimalProjectSnapshot() });
    const project = (await fetchProjectSnapshot('22222222-2222-2222-2222-222222222222')) as Record<
      string,
      unknown
    >;
    expect(project.title).toBe('Stub project');

    // a missing row: contract mode => null data, strict (real PostgREST 406)
    // => the worker surfaces "project fetch failed: ..."
    expect(await fetchProjectSnapshot('does-not-exist')).toBeUndefined();
    stub.strictSingleEmpty = true;
    await expect(fetchProjectSnapshot('does-not-exist')).rejects.toThrow(/project fetch failed/);
    stub.strictSingleEmpty = false;
  });
});

// ---------------------------------------------------------------------------
// 5. Concurrency gate
// ---------------------------------------------------------------------------

describe('MAX_CONCURRENCY gate', () => {
  // There is no ConcurrencyGate class: queue.ts bounds concurrency with
  // `while (inFlight.size < config.maxConcurrency)` around claimNextJob().
  // These tests drive the REAL poll loop and measure how many rows are ever
  // 'running' at the same time, so the gate is observed, not assumed.
  it('never runs more than MAX_CONCURRENCY renders in parallel', async () => {
    config.maxConcurrency = 2;
    config.pollIntervalMs = 25;
    config.heartbeatIntervalMs = 30_000;
    config.repoRoot = fakeRepoRoot({ sleepMs: 180 });

    const base = Date.now();
    for (let i = 0; i < 3; i++) {
      stub.insertJob(
        makeJob({
          id: `gate-${i}`,
          status: 'queued',
          created_at: new Date(base + i * 1000).toISOString(),
          updated_at: new Date(base + i * 1000).toISOString(),
        }),
      );
    }

    startQueueLoop(5);
    await delay(1500);
    stopQueueLoop();
    await delay(50);

    expect(maxConcurrentRunning(stub)).toBe(2);
    expect(inFlightJobIds()).toEqual([]);

    // every job eventually settled (none stay 'running')
    for (const job of stub.jobs.values()) {
      expect(job.status).toBe('error');
      expect(job.progress).toBe(0);
    }
  }, 20000);

  it('MAX_CONCURRENCY=1 serializes claims', async () => {
    config.maxConcurrency = 1;
    config.pollIntervalMs = 25;
    config.repoRoot = fakeRepoRoot({ sleepMs: 120 });

    const base = Date.now();
    for (let i = 0; i < 3; i++) {
      stub.insertJob(
        makeJob({
          id: `serial-${i}`,
          status: 'queued',
          created_at: new Date(base + i * 1000).toISOString(),
          updated_at: new Date(base + i * 1000).toISOString(),
        }),
      );
    }

    startQueueLoop(5);
    await delay(1500);
    stopQueueLoop();
    await delay(50);

    expect(maxConcurrentRunning(stub)).toBe(1);
    expect(inFlightJobIds()).toEqual([]);
    const runningUpdates = stub.calls.filter((c) => c.payload?.status === 'running');
    expect(runningUpdates).toHaveLength(3);
  }, 20000);
});

// ---------------------------------------------------------------------------
// 6. Startup config validation
// ---------------------------------------------------------------------------

describe('startup configuration validation', () => {
  it('missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY fail loudly naming both', async () => {
    const savedUrl = process.env.SUPABASE_URL;
    const savedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      vi.resetModules(); // fresh module graph => the boot-time guard re-runs
      const freshStorage = await import('../src/storage');
      const freshQueue = await import('../src/queue');
      const missing = /SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/;

      expect(() => freshStorage.getSupabase()).toThrow(missing);
      await expect(freshStorage.claimNextJob()).rejects.toThrow(missing);
      await expect(freshStorage.reclaimStaleJobs(new Set())).rejects.toThrow(missing);
      await expect(freshStorage.updateJobProgress('x', 50)).rejects.toThrow(missing);
      await expect(freshStorage.heartbeatJob('x')).rejects.toThrow(missing);
      await expect(freshStorage.markJobDone('x', 'https://example.com/x.mp4')).rejects.toThrow(missing);
      await expect(freshStorage.markJobError('x', 'boom')).rejects.toThrow(missing);
      await expect(freshStorage.uploadRender('u/p/a.mp4', '/nonexistent.mp4')).rejects.toThrow(missing);
      await expect(freshStorage.createSignedRenderUrl('u/p/a.mp4')).rejects.toThrow(missing);
      await expect(freshStorage.fetchProjectSnapshot('p')).rejects.toThrow(missing);

      // and the queue loop refuses to poll, instead of erroring forever
      freshQueue.startQueueLoop(5);
      await delay(150);
      freshQueue.stopQueueLoop();
      expect(freshQueue.inFlightJobIds()).toEqual([]);
      expect(warn.mock.calls.flat().join('\n')).toContain('SUPABASE_URL');
    } finally {
      warn.mockRestore();
      if (savedUrl === undefined) delete process.env.SUPABASE_URL;
      else process.env.SUPABASE_URL = savedUrl;
      if (savedKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      else process.env.SUPABASE_SERVICE_ROLE_KEY = savedKey;
    }
  }, 20000);

  it('queue polling is disabled and warns when Supabase is not configured', async () => {
    const savedUrl = process.env.SUPABASE_URL;
    const savedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      vi.resetModules(); // fresh module graph => fresh `supabaseConfigured`
      const freshConfig = await import('../src/config');
      expect(freshConfig.supabaseConfigured).toBe(false);
      const freshStorage = await import('../src/storage');
      const freshQueue = await import('../src/queue');
      freshStorage.setSupabaseClientFactory(() => stub.client);

      freshQueue.startQueueLoop(5);
      await delay(150);
      freshQueue.stopQueueLoop();

      expect(stub.calls).toHaveLength(0); // never touched the "DB"
      expect(warn.mock.calls.flat().join('\n')).toContain('SUPABASE_URL');
      expect(warn.mock.calls.flat().join('\n')).toContain('SUPABASE_SERVICE_ROLE_KEY');
      expect(freshQueue.inFlightJobIds()).toEqual([]);
    } finally {
      warn.mockRestore();
      if (savedUrl === undefined) delete process.env.SUPABASE_URL;
      else process.env.SUPABASE_URL = savedUrl;
      if (savedKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      else process.env.SUPABASE_SERVICE_ROLE_KEY = savedKey;
    }
  });
});

// ---------------------------------------------------------------------------
// 7. API auth wiring (src/index.ts)
// ---------------------------------------------------------------------------

describe('API auth wiring (src/index.ts)', () => {
  let originalListen: typeof http.Server.prototype.listen;
  let suppressListen = false;

  beforeAll(() => {
    const proto = http.Server.prototype as unknown as {
      listen: typeof http.Server.prototype.listen;
    };
    originalListen = proto.listen;
    // src/index.ts calls app.listen() at module scope; neutralise it so the
    // test suite never binds a real port or keeps a handle alive — but still
    // run the listen callback so the boot logs are produced.
    proto.listen = function patched(this: http.Server, ...args: unknown[]) {
      if (!suppressListen) {
        return (originalListen as (...a: unknown[]) => unknown).apply(this, args as []);
      }
      const listening = args.find((a) => typeof a === 'function') as undefined | (() => void);
      if (listening) setImmediate(listening);
      return this;
    };
  });

  afterAll(() => {
    (http.Server.prototype as unknown as { listen: unknown }).listen = originalListen;
  });

  async function bootWorker(): Promise<{
    baseUrl: string;
    shutdown: () => Promise<void>;
  }> {
    vi.resetModules();
    const genStorage = await import('../src/storage');
    genStorage.setSupabaseClientFactory(() => stub.client);
    suppressListen = true;
    const index = await import('../src/index');
    const genQueue = await import('../src/queue');
    suppressListen = false;

    const server = http.createServer(index.default);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const { port } = server.address() as { port: number };
    return {
      baseUrl: `http://127.0.0.1:${port}`,
      shutdown: async () => {
        server.closeAllConnections?.();
        server.close();
        // startQueueLoop(2000) hides its start-up timer in an untracked
        // setTimeout; wait for it to fire, then clear the interval it creates.
        await delay(2400);
        genQueue.stopQueueLoop();
      },
    };
  }

  it('rejects a missing bearer with 401, a wrong key with 403, and accepts the right one with 200', async () => {
    process.env.WORKER_API_KEY = 'staging-test-key';
    const { baseUrl, shutdown } = await bootWorker();
    try {
      const noHeader = await fetch(`${baseUrl}/status`);
      expect(noHeader.status).toBe(401);

      const wrongScheme = await fetch(`${baseUrl}/status`, {
        headers: { authorization: 'Basic stubbed' },
      });
      expect(wrongScheme.status).toBe(401);

      const wrongKey = await fetch(`${baseUrl}/status`, {
        headers: { authorization: 'Bearer wrong-key' },
      });
      expect(wrongKey.status).toBe(403);
      expect((await wrongKey.json()).error).toMatch(/Invalid API key/);

      const rightKey = await fetch(`${baseUrl}/status`, {
        headers: { authorization: 'Bearer staging-test-key' },
      });
      expect(rightKey.status).toBe(200);
      const body = (await rightKey.json()) as { service: string; queue: { maxConcurrency: number } };
      expect(body.service).toBe('render-worker');
      expect(body.queue.maxConcurrency).toBe(config.maxConcurrency);

      // /health stays open for orchestrators
      const health = await fetch(`${baseUrl}/health`);
      expect(health.status).toBe(200);
    } finally {
      delete process.env.WORKER_API_KEY;
      await shutdown();
    }
  }, 30000);

  it('runs open when WORKER_API_KEY is unset, and reports both modes at boot', async () => {
    delete process.env.WORKER_API_KEY;
    const logs: string[] = [];
    const log = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(' '));
    });

    const { baseUrl, shutdown } = await bootWorker();
    try {
      const open = await fetch(`${baseUrl}/status`);
      expect(open.status).toBe(200);
      const wrongKey = await fetch(`${baseUrl}/status`, {
        headers: { authorization: 'Bearer nope' },
      });
      expect(wrongKey.status).toBe(200); // no key configured => open service

      expect(logs.join('\n')).toContain('Auth: disabled (no WORKER_API_KEY set)');
      expect(logs.join('\n')).toContain('Supabase: configured');
    } finally {
      log.mockRestore();
      await shutdown();
    }
  }, 30000);
});
