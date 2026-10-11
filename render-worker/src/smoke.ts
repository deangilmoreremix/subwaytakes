#!/usr/bin/env node
/**
 * Acceptance harness for the render worker pipeline.
 *
 * Run with:  npx ts-node src/smoke.ts        (or: npm run smoke)
 *
 * What it does:
 *  (a) generates a 2s test video (x2) + 2s sine audio with ffmpeg
 *  (b) builds a small StudioProject with 2 video clips whose TRIMS must be
 *      visible (2x1s trimmed clips from 2s sources => 2s timeline, not 4s),
 *      1 ambient audio clip and 1 subtitle caption
 *  (c) runs the full pipeline: remotion render -> probe verify -> normalize
 *  (d) prints the ffprobe JSON of the final MP4 and a PASS/FAIL summary
 *
 * Exit code 0 = PASS, 1 = FAIL. All artifacts live under os.tmpdir() and are
 * removed before exit.
 */
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import { AddressInfo } from 'net';
import { config } from './config';
import { validateProjectSnapshot, renderProjectToFile } from './render';
import { probeFile } from './probe';
import { runFfmpeg } from './ffmpeg';

const CLIP_SECONDS = 2;
const TRIM_FROM = 0.5;
const TRIM_TO = 1.5;
// clip1: start 0 + 1s; clip2: start 1 + 1s => 2s timeline. The SOURCES are 2s
// each, so an untrimmed render would be ~4s — this is the trim assertion.
const EXPECTED_DURATION_SECONDS = 2.0;

const checks: { name: string; pass: boolean; detail: string }[] = [];

function check(name: string, pass: boolean, detail: string): void {
  checks.push({ name, pass, detail });
}

const MIME: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
};

function startMediaServer(dir: string): Promise<{ server: http.Server; baseUrl: string }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      const filePath = path.join(dir, path.basename(urlPath));
      if (!filePath.startsWith(dir) || !fs.existsSync(filePath)) {
        res.statusCode = 404;
        res.end('not found');
        return;
      }
      const stat = fs.statSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mime = MIME[ext] || 'application/octet-stream';
      const range = req.headers.range;
      if (range) {
        const match = /bytes=(\d*)-(\d*)/.exec(range);
        if (match) {
          const start = match[1] ? parseInt(match[1], 10) : 0;
          const end = match[2] ? parseInt(match[2], 10) : stat.size - 1;
          res.writeHead(206, {
            'Content-Type': mime,
            'Content-Length': end - start + 1,
            'Content-Range': `bytes ${start}-${end}/${stat.size}`,
            'Accept-Ranges': 'bytes',
          });
          fs.createReadStream(filePath, { start, end }).pipe(res);
          return;
        }
      }
      res.writeHead(200, {
        'Content-Type': mime,
        'Content-Length': stat.size,
        'Accept-Ranges': 'bytes',
      });
      fs.createReadStream(filePath).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

async function main(): Promise<number> {
  console.log('=== render-worker smoke test (acceptance evidence) ===');
  console.log(`repo root: ${config.repoRoot}`);
  console.log(`ffmpeg:    ${config.ffmpegPath}`);

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'render-smoke-'));
  let server: http.Server | null = null;
  let exitCode = 1;

  try {
    // ---- (a) generate test sources with real ffmpeg ----
    console.log('\n[a] generating 2s test sources with ffmpeg...');
    const clipA = path.join(workDir, 'clipA.mp4');
    const clipB = path.join(workDir, 'clipB.mp4');
    const ambient = path.join(workDir, 'ambient.wav');
    await runFfmpeg([
      '-y', '-f', 'lavfi', '-i', `testsrc2=size=540x960:rate=30:duration=${CLIP_SECONDS}`,
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30', clipA,
    ]);
    await runFfmpeg([
      '-y', '-f', 'lavfi', '-i', `smptebars=size=540x960:rate=30:duration=${CLIP_SECONDS}`,
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30', clipB,
    ]);
    await runFfmpeg([
      '-y', '-f', 'lavfi', '-i', `sine=frequency=440:duration=${CLIP_SECONDS}`,
      '-ar', '48000', '-ac', '2', ambient,
    ]);
    console.log(`    sources: ${clipA}, ${clipB}, ${ambient}`);

    // ---- (b) build the StudioProject ----
    const { server: srv, baseUrl } = await startMediaServer(workDir);
    server = srv;
    const now = new Date().toISOString();
    const project = {
      version: 1,
      id: 'smoke-project',
      title: 'Render Worker Smoke Test',
      duration: EXPECTED_DURATION_SECONDS,
      fps: 30,
      width: 1080,
      height: 1920,
      tracks: [
        {
          id: 'video-0',
          kind: 'video',
          name: 'Video',
          muted: false,
          volume: 1,
          clips: [
            {
              id: 'smoke-clip-1',
              assetUrl: `${baseUrl}/clipA.mp4`,
              assetKind: 'uploaded',
              start: 0,
              trimStart: TRIM_FROM,
              trimEnd: TRIM_TO,
              volume: 1,
              fadeIn: 0,
              fadeOut: 0,
            },
            {
              id: 'smoke-clip-2',
              assetUrl: `${baseUrl}/clipB.mp4`,
              assetKind: 'uploaded',
              start: 1,
              trimStart: TRIM_FROM,
              trimEnd: TRIM_TO,
              volume: 1,
              fadeIn: 0,
              fadeOut: 0,
            },
          ],
        },
        {
          id: 'ambient-0',
          kind: 'ambient',
          name: 'Ambient Sound',
          muted: false,
          volume: 0.8,
          clips: [
            {
              id: 'smoke-audio-1',
              assetUrl: `${baseUrl}/ambient.wav`,
              assetKind: 'audio',
              start: 0,
              trimStart: 0,
              trimEnd: CLIP_SECONDS,
              volume: 0.8,
              fadeIn: 0,
              fadeOut: 0,
            },
          ],
        },
      ],
      captions: [
        { id: 'smoke-caption-1', text: 'SMOKE TEST CAPTION', start: 0.2, end: 1.8, kind: 'dialogue' },
      ],
      branding: {
        handle: '@smoketest',
        watermarkText: '@smoketest',
        watermarkPosition: 'top-left',
        accentColor: '#F59E0B',
        showProgressBar: true,
      },
      scenePlan: [],
      createdAt: now,
      updatedAt: now,
    };

    const parsed = validateProjectSnapshot(project);
    if (!parsed.ok) {
      console.error(`PROJECT VALIDATION FAILED: ${parsed.error}`);
      return 1;
    }
    console.log(`[b] project built: 2 video clips trimmed ${TRIM_FROM}-${TRIM_TO}s of ${CLIP_SECONDS}s sources -> expected timeline ${EXPECTED_DURATION_SECONDS}s`);

    // ---- (c) render pipeline (remotion + probe verify + normalize) ----
    console.log('\n[c] running render pipeline (remotion render -> probe -> normalize)...');
    const result = await renderProjectToFile(parsed.project, {
      workDir,
      renderSettings: { width: 1080, height: 1920 },
    });
    console.log(`    final output: ${result.outputPath}`);

    // ---- (d) probe evidence + PASS/FAIL ----
    const probe = await probeFile(result.outputPath);
    console.log('\n[d] ffprobe JSON of final MP4:');
    console.log(JSON.stringify(probe.raw, null, 2));

    const duration = probe.durationSeconds ?? -1;
    check('container is mp4', probe.container.includes('mp4'), probe.container);
    check('video codec h264', probe.videoCodec === 'h264', String(probe.videoCodec));
    check('audio codec aac present', probe.audioCodec === 'aac', String(probe.audioCodec));
    check('dimensions 1080x1920', probe.width === 1080 && probe.height === 1920, `${probe.width}x${probe.height}`);
    check(
      `duration ~= ${EXPECTED_DURATION_SECONDS}s (+/-0.5)`,
      Math.abs(duration - EXPECTED_DURATION_SECONDS) <= 0.5,
      `${duration.toFixed(3)}s — SOURCES are 2s each (untrimmed would be ~4s)`,
    );

    console.log('\n=== SUMMARY ===');
    for (const c of checks) {
      console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}  [${c.detail}]`);
    }
    const passed = checks.every((c) => c.pass);
    console.log(`\nRESULT: ${passed ? 'PASS' : 'FAIL'} (${checks.filter((c) => c.pass).length}/${checks.length} checks)`);
    exitCode = passed ? 0 : 1;
  } catch (err) {
    console.error(`\nSMOKE TEST ERROR: ${(err as Error).message}`);
    exitCode = 1;
  } finally {
    if (server) server.close();
    fs.rmSync(workDir, { recursive: true, force: true });
  }
  return exitCode;
}

void main().then((code) => process.exit(code));
