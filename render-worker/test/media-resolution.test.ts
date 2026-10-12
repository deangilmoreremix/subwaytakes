/**
 * STAGING VALIDATION SUITE — media resolution, ownership and temp cleanup.
 *
 * Proves the Phase 6 media contract of the render worker:
 *   - every clip ref / persisted storage URL is re-signed worker-side with the
 *     SERVICE-ROLE client (injected here through setSupabaseClientFactory),
 *   - a ref whose path does not start with the project row's user_id is
 *     REFUSED (private media must never be resolvable cross-user) — which
 *     fails the job instead of rendering somebody else's footage,
 *   - the resolved URLs only ever reach the Remotion props file: the DB row's
 *     snapshot is untouched,
 *   - temp dirs/files are removed on every injected failure path (media
 *     resolution, remotion, ffprobe, ffmpeg normalize).
 *
 * No Supabase, no Docker, no network: test/supabase-stub.ts is the fake
 * storage/queue client.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { config } from '../src/config';
import {
  createSignedRenderUrl,
  fetchProjectOwner,
  isPathOwnedBy,
  parseStorageUrl,
  resetSupabaseClient,
  resolveAssetUrl,
  resolveMediaRef,
  setSupabaseClientFactory,
  type RenderJobRow,
} from '../src/storage';
import { processRenderJob, resolveProjectMedia, validateProjectSnapshot } from '../src/render';
import { createSupabaseStub, makeJob, minimalProjectSnapshot, type SupabaseStub } from './supabase-stub';

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

const OWNER = '11111111-1111-1111-1111-111111111111';
const PROJECT_ID = '22222222-2222-2222-2222-222222222222';
const CLIP_PATH = `${OWNER}/${PROJECT_ID}/scene-opening_hook.mp4`;
const CLIP_URL = `https://cdn.example.com/legacy-clip.mp4`;

const CONFIG_KEYS = ['repoRoot', 'ffmpegPath', 'ffprobePath', 'heartbeatIntervalMs'] as const;

let stub: SupabaseStub;
let configBackup: Record<string, unknown>;
const tmpDirs: string[] = [];

function tmpDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tmpDirs.push(dir);
  return dir;
}

function leakedTempDirs(jobId: string): string[] {
  return fs.readdirSync(os.tmpdir()).filter((f) => f.startsWith(`render-job-${jobId}-`));
}

/** Seed the project row the worker reads the media owner from. */
function seedProjectRow(overrides: Record<string, unknown> = {}): void {
  stub.projects.push({ id: PROJECT_ID, project: minimalProjectSnapshot(), user_id: OWNER, ...overrides });
}

/** Seed a private object in the stub storage backend. */
async function seedObject(objectPath: string, bucket = 'studio-uploads'): Promise<void> {
  const dir = tmpDir('object-');
  const file = path.join(dir, 'asset.bin');
  fs.writeFileSync(file, Buffer.from('media-bytes'));
  await stub.bucket(bucket).upload(objectPath, fs.createReadStream(file), { contentType: 'video/mp4' });
}

/**
 * Fake remotion CLI. `--props` is copied into the capture dir (so the test can
 * assert exactly which URLs the renderer was handed) and the output file is
 * either created with the real system ffmpeg or left missing.
 */
function fakeRepoRoot(
  options: { captureDir: string; produceRealMp4?: boolean; exitCode?: number } = {
    captureDir: '',
  },
): string {
  const root = tmpDir(`fake-repo-media-`);
  const binDir = path.join(root, 'node_modules', '.bin');
  fs.mkdirSync(binDir, { recursive: true });
  const bin = path.join(binDir, 'remotion');
  const script = [
    `#!${process.execPath}`,
    "const fs = require('fs');",
    "const path = require('path');",
    "const { spawnSync } = require('child_process');",
    'const args = process.argv.slice(2);',
    'const out = args[3];',
    'const propsArg = args.find((a) => a.startsWith("--props="));',
    'const capture = process.env.FAKE_CAPTURE_DIR;',
    'if (capture && propsArg) {',
    '  fs.mkdirSync(capture, { recursive: true });',
    '  fs.copyFileSync(propsArg.slice(8), path.join(capture, "props.json"));',
    '  fs.writeFileSync(path.join(capture, "argv.json"), JSON.stringify(args));',
    '}',
    options.produceRealMp4
      ? "spawnSync('/usr/bin/ffmpeg', ['-y','-f','lavfi','-i','testsrc2=size=1080x1920:rate=30:duration=1'," +
        "'-f','lavfi','-i','sine=frequency=440:duration=1','-c:v','libx264','-preset','veryfast'," +
        "'-pix_fmt','yuv420p','-r','30','-c:a','aac','-b:a','128k','-ar','48000','-ac','2', out], { stdio: 'ignore' });"
      : '',
    `process.exit(${options.exitCode ?? 0});`,
  ].join('\n');
  fs.writeFileSync(bin, `${script}\n`, { mode: 0o755 });
  return root;
}

/** A job whose snapshot uses canonical refs (one video clip + one logo). */
function refJob(id: string, clipPath: string = CLIP_PATH): RenderJobRow {
  const snapshot = minimalProjectSnapshot();
  const track = snapshot.tracks[0] as unknown as Record<string, unknown>;
  track.clips = [
    {
      id: 'clip-1',
      assetUrl: '',
      assetRef: { bucket: 'studio-uploads', path: clipPath, kind: 'video' },
      assetKind: 'uploaded',
      start: 0,
      trimStart: 0,
      trimEnd: 1,
      volume: 1,
      fadeIn: 0,
      fadeOut: 0,
    },
  ];
  (snapshot as unknown as Record<string, unknown>).branding = {
    handle: '@stub',
    logoRef: { bucket: 'studio-uploads', path: CLIP_PATH, kind: 'image' },
    watermarkText: '@stub',
    watermarkPosition: 'top-left',
    accentColor: '#F59E0B',
    showProgressBar: true,
  };
  // inserted as 'running' like a claimed job, so terminal writes apply
  return makeJob({ id, status: 'running', worker_id: 'media-test-worker', project_snapshot: snapshot });
}

const HAVE_SYSTEM_FFMPEG = (() => {
  try {
    return fs.existsSync('/usr/bin/ffmpeg') && fs.existsSync('/usr/bin/ffprobe');
  } catch {
    return false;
  }
})();

beforeEach(() => {
  configBackup = {};
  for (const key of CONFIG_KEYS) configBackup[key] = (config as unknown as Record<string, unknown>)[key];
  stub = createSupabaseStub({ latencyMs: 0 });
  setSupabaseClientFactory(() => stub.client);
  config.heartbeatIntervalMs = 30_000;
});

afterEach(() => {
  setSupabaseClientFactory(null);
  resetSupabaseClient();
  for (const key of CONFIG_KEYS) {
    (config as unknown as Record<string, unknown>)[key] = configBackup[key];
  }
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
  tmpDirs.length = 0;
});

// ---------------------------------------------------------------------------
// 1. Pure ownership / URL helpers
// ---------------------------------------------------------------------------

describe('storage path ownership helpers', () => {
  it('isPathOwnedBy compares the first path segment to the owner', () => {
    expect(isPathOwnedBy('u-1/p/clip.mp4', 'u-1')).toBe(true);
    expect(isPathOwnedBy('u-2/p/clip.mp4', 'u-1')).toBe(false);
    expect(isPathOwnedBy('clip.mp4', 'u-1')).toBe(false);
    expect(isPathOwnedBy('u-1/p/clip.mp4', '')).toBe(false);
    expect(isPathOwnedBy('', 'u-1')).toBe(false);
  });

  it('parseStorageUrl recovers bucket+path from sign/authenticated/public URLs only', () => {
    const host = 'https://stub.supabase.test';
    expect(parseStorageUrl(`${host}/storage/v1/object/sign/studio-uploads/u-1/a.mp4?token=x`, host)).toEqual({
      bucket: 'studio-uploads',
      path: 'u-1/a.mp4',
    });
    expect(parseStorageUrl(`${host}/storage/v1/object/authenticated/videos/u-1/b.mp4`, host)).toEqual({
      bucket: 'videos',
      path: 'u-1/b.mp4',
    });
    expect(parseStorageUrl(`${host}/storage/v1/object/public/studio-exports/u-1/c.mp4`, host)).toEqual({
      bucket: 'studio-exports',
      path: 'u-1/c.mp4',
    });
    // external CDN URLs are their own identity — never parsed
    expect(parseStorageUrl('https://cdn.example.com/clip.mp4', host)).toBeNull();
    // another host is not our storage
    expect(parseStorageUrl(`${host}/storage/v1/object/sign/b/p.mp4`, 'https://other.supabase.test')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. Ref resolution (injected storage client)
// ---------------------------------------------------------------------------

describe('media ref resolution with an injected storage client', () => {
  it('signs an owned ref and never mutates the input project', async () => {
    seedProjectRow();
    await seedObject(CLIP_PATH);

    const project = validateProjectSnapshot(refJob('resolve-1').project_snapshot);
    expect(project.ok).toBe(true);
    if (!project.ok) return;
    const originalUrl = project.project.tracks[0]!.clips[0]!.assetUrl;

    const resolved = await resolveProjectMedia(project.project, { ownerUserId: OWNER });

    const signed = resolved.tracks[0]!.clips[0]!.assetUrl;
    expect(signed).toContain('/storage/v1/object/sign/studio-uploads/');
    expect(signed).toContain(CLIP_PATH);
    expect(signed).toContain('expires_in=3600');
    // the caller's project is untouched (worker-side resolution only)
    expect(project.project.tracks[0]!.clips[0]!.assetUrl).toBe(originalUrl);
    // the branding logo is resolved too
    expect(resolved.branding.logoUrl).toContain('/storage/v1/object/sign/');
  });

  it('re-signs a legacy persisted storage URL for the owner and passes CDN URLs through', async () => {
    await seedObject(CLIP_PATH);

    const signed = await resolveAssetUrl(
      `https://stub.supabase.test/storage/v1/object/authenticated/studio-uploads/${CLIP_PATH}`,
      OWNER,
    );
    expect(signed).toContain('/storage/v1/object/sign/studio-uploads/');

    expect(await resolveAssetUrl(CLIP_URL, OWNER)).toBe(CLIP_URL);
    // without an owner the legacy path still resolves (direct-render endpoint),
    // but a ref NEVER does — see the next test.
    expect(
      await resolveAssetUrl(`https://stub.supabase.test/storage/v1/object/authenticated/studio-uploads/${CLIP_PATH}`),
    ).toContain('/storage/v1/object/sign/');
  });

  it('refuses to sign media that is not owned by the project owner', async () => {
    await seedObject(CLIP_PATH);
    const foreignUrl = 'https://stub.supabase.test/storage/v1/object/authenticated/studio-uploads/other-user/p/clip.mp4';

    await expect(
      resolveMediaRef({ bucket: 'studio-uploads', path: 'other-user/p/clip.mp4', kind: 'video' }, OWNER),
    ).rejects.toThrow(/ownership check failed/);

    await expect(resolveAssetUrl(foreignUrl, OWNER)).rejects.toThrow(/ownership check failed/);

    // a ref can never be signed without an owner at all
    await expect(
      resolveProjectMedia(validateProjectSnapshot(refJob('no-owner').project_snapshot).project!, {}),
    ).rejects.toThrow(/ownership check failed/);
  });

  it('resolves only structurally valid refs from an untrusted snapshot', () => {
    const snapshot = minimalProjectSnapshot();
    const track = snapshot.tracks[0] as unknown as Record<string, unknown>;
    track.clips = [
      {
        id: 'clip-ref',
        assetUrl: '',
        assetRef: { bucket: 'studio-uploads', path: CLIP_PATH, kind: 'video' },
        assetKind: 'uploaded',
        start: 0,
        trimStart: 0,
        trimEnd: 1,
        volume: 1,
        fadeIn: 0,
        fadeOut: 0,
      },
      {
        id: 'clip-bad-ref',
        assetUrl: 'https://cdn.example.com/ok.mp4',
        // kind 'folder' is not a media kind -> the ref is dropped, URL kept
        assetRef: { bucket: 'studio-uploads', path: 'x/y.mp4', kind: 'folder' },
        assetKind: 'generated',
        start: 1,
        trimStart: 0,
        trimEnd: 1,
        volume: 1,
        fadeIn: 0,
        fadeOut: 0,
      },
    ];
    const parsed = validateProjectSnapshot(snapshot);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.project.tracks[0]!.clips[0]!.assetRef).toEqual({
      bucket: 'studio-uploads',
      path: CLIP_PATH,
      kind: 'video',
    });
    expect(parsed.project.tracks[0]!.clips[1]!.assetRef).toBeUndefined();
    expect(parsed.project.tracks[0]!.clips[1]!.assetUrl).toBe('https://cdn.example.com/ok.mp4');
  });

  it('fetchProjectOwner reads the project row and refuses when it is missing', async () => {
    seedProjectRow();
    expect(await fetchProjectOwner(PROJECT_ID)).toBe(OWNER);

    stub.projects.length = 0;
    await expect(fetchProjectOwner(PROJECT_ID)).rejects.toThrow(/project owner fetch failed|no owner/);
  });
});

// ---------------------------------------------------------------------------
// 3. Job-level behaviour: refs reach the props, unowned media fails the job
// ---------------------------------------------------------------------------

describe('processRenderJob media handling', () => {
  it('hands the renderer FRESH signed URLs and never persists them back', async () => {
    seedProjectRow();
    await seedObject(CLIP_PATH);
    const captureDir = tmpDir('capture-');
    config.repoRoot = fakeRepoRoot({ captureDir, exitCode: 1 }); // render fails, props are still captured
    process.env.FAKE_CAPTURE_DIR = captureDir;

    const job = stub.insertJob(refJob('media-props'));
    const before = JSON.stringify(job.project_snapshot);

    try {
      await processRenderJob(job);

      const props = JSON.parse(fs.readFileSync(path.join(captureDir, 'props.json'), 'utf8')) as {
        project: { tracks: { clips: { assetUrl: string }[] }[]; branding: { logoUrl?: string } };
      };
      expect(props.project.tracks[0]!.clips[0]!.assetUrl).toContain('/storage/v1/object/sign/studio-uploads/');
      expect(props.project.branding.logoUrl).toContain('/storage/v1/object/sign/');

      // the DB snapshot is byte-identical: resolved URLs never go back
      expect(JSON.stringify(stub.jobs.get(job.id)!.project_snapshot)).toBe(before);
      // ...and nothing was uploaded to the exports bucket for a failed render
      expect(stub.calls.some((c) => c.op === 'upload' && c.bucket === config.storageBucket)).toBe(false);
    } finally {
      delete process.env.FAKE_CAPTURE_DIR;
    }
  });

  it('fails the job (never renders) when a snapshot ref is not owned by the project owner', async () => {
    seedProjectRow();
    await seedObject(CLIP_PATH);
    config.repoRoot = fakeRepoRoot({ captureDir: tmpDir('capture-unowned-') });

    const unowned = refJob('media-unowned', 'other-user/22222222-2222-2222-2222-222222222222/clip.mp4');
    const job = stub.insertJob(unowned);
    expect(leakedTempDirs(job.id)).toHaveLength(0);

    await processRenderJob(job);

    const row = stub.jobs.get(job.id)!;
    expect(row.status).toBe('error');
    expect(row.progress).toBe(0);
    expect(row.error).toMatch(/ownership check failed/);
    expect(row.error).toContain('other-user');
    // remotion was never started, nothing uploaded to exports, temp dir removed
    expect(stub.calls.some((c) => c.op === 'upload' && c.bucket === config.storageBucket)).toBe(false);
    expect(leakedTempDirs(job.id)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 4. Temp cleanup on injected failure paths
// ---------------------------------------------------------------------------

describe('temp cleanup on failure paths', () => {
  it('removes the work dir when remotion exits non-zero', async () => {
    seedProjectRow();
    await seedObject(CLIP_PATH);
    config.repoRoot = fakeRepoRoot({ captureDir: tmpDir('capture-fail-'), exitCode: 3 });

    const job = stub.insertJob(refJob('cleanup-render-fail'));
    await processRenderJob(job);

    const row = stub.jobs.get(job.id)!;
    expect(row.status).toBe('error');
    expect(row.error).toMatch(/remotion render exited 3/);
    expect(leakedTempDirs(job.id)).toHaveLength(0);
  });

  it('removes the work dir when the media ownership check throws (before any render)', async () => {
    seedProjectRow();
    config.repoRoot = fakeRepoRoot({ captureDir: tmpDir('capture-own-') });

    const job = stub.insertJob(refJob('cleanup-ownership', 'stranger/clip.mp4'));
    await processRenderJob(job);

    expect(stub.jobs.get(job.id)!.status).toBe('error');
    expect(leakedTempDirs(job.id)).toHaveLength(0);
  });

  it('removes the work dir when the probe step fails', async () => {
    seedProjectRow();
    await seedObject(CLIP_PATH);
    config.repoRoot = fakeRepoRoot({ captureDir: tmpDir('capture-probe-'), produceRealMp4: HAVE_SYSTEM_FFMPEG });
    // a fake ffprobe that always fails, reached after remotion "rendered"
    const probeDir = tmpDir('fake-ffprobe-');
    const probeBin = path.join(probeDir, 'ffprobe');
    fs.writeFileSync(probeBin, `#!${process.execPath}\nprocess.exit(1);\n`, { mode: 0o755 });
    config.ffprobePath = probeBin;

    const job = stub.insertJob(refJob('cleanup-probe-fail'));
    await processRenderJob(job);

    const row = stub.jobs.get(job.id)!;
    expect(row.status).toBe('error');
    if (HAVE_SYSTEM_FFMPEG) {
      expect(row.error).toMatch(/ffprobe exited 1/);
    }
    expect(leakedTempDirs(job.id)).toHaveLength(0);
  });

  it('removes the work dir when the ffmpeg normalize step fails', async () => {
    seedProjectRow();
    await seedObject(CLIP_PATH);
    config.repoRoot = fakeRepoRoot({ captureDir: tmpDir('capture-norm-'), produceRealMp4: HAVE_SYSTEM_FFMPEG });
    // a fake ffmpeg that always fails: normalization (the encode gate) rejects
    const ffmpegDir = tmpDir('fake-ffmpeg-');
    const ffmpegBin = path.join(ffmpegDir, 'ffmpeg');
    fs.writeFileSync(ffmpegBin, `#!${process.execPath}\nprocess.exit(2);\n`, { mode: 0o755 });
    config.ffmpegPath = ffmpegBin;

    const job = stub.insertJob(refJob('cleanup-normalize-fail'));
    await processRenderJob(job);

    const row = stub.jobs.get(job.id)!;
    expect(row.status).toBe('error');
    if (HAVE_SYSTEM_FFMPEG) {
      expect(row.error).toMatch(/ffmpeg exited 2/);
    }
    expect(leakedTempDirs(job.id)).toHaveLength(0);
  });

  it('removes the work dir when remotion produces no output file', async () => {
    seedProjectRow();
    await seedObject(CLIP_PATH);
    config.repoRoot = fakeRepoRoot({ captureDir: tmpDir('capture-empty-') });

    const job = stub.insertJob(refJob('cleanup-no-output'));
    await processRenderJob(job);

    expect(stub.jobs.get(job.id)!.error).toMatch(/produced no output file/);
    expect(leakedTempDirs(job.id)).toHaveLength(0);
  });

  it('a real end-to-end render marks the job done with a fresh signed output URL', async () => {
    if (!HAVE_SYSTEM_FFMPEG) {
      console.warn('[media-resolution] NOTE: no system ffmpeg — skipping the real render tail');
      return;
    }
    seedProjectRow();
    await seedObject(CLIP_PATH);
    config.repoRoot = fakeRepoRoot({ captureDir: tmpDir('capture-real-'), produceRealMp4: true });
    config.ffmpegPath = '/usr/bin/ffmpeg';
    config.ffprobePath = '/usr/bin/ffprobe';

    const job = stub.insertJob(refJob('media-real'));
    await processRenderJob(job);

    const row = stub.jobs.get(job.id)!;
    expect(row.status).toBe('done');
    expect(row.progress).toBe(100);
    expect(row.output_url).toContain('/storage/v1/object/sign/studio-exports/');
    expect(leakedTempDirs(job.id)).toHaveLength(0);

    // the uploaded object lives under <owner>/<project>/render-<job>.mp4
    const object = stub.bucket('studio-exports').objects.get(`${OWNER}/${PROJECT_ID}/render-media-real.mp4`);
    expect(object).toBeDefined();
    expect(object!.bytes).toBeGreaterThan(0);
    await expect(createSignedRenderUrl(`${OWNER}/${PROJECT_ID}/render-media-real.mp4`)).resolves.toContain(
      '/storage/v1/object/sign/studio-exports/',
    );
  }, 60000);
});
