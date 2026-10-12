/**
 * COMPOSITION PARITY — timeline edits provably reach the MP4.
 *
 * Real Remotion render via renderProjectToFile, then ffprobe + pixel proof.
 * The fixtures are rendered ONCE in beforeAll and reused across assertions
 * (a Remotion render dominates the runtime, so renders are shared):
 *
 *   - `boxed`   : 2 trimmed clips + fade-in + a BOXED-style dialogue caption
 *   - `minimal` : identical, but the caption uses the MINIMAL style
 *   - `plain`   : identical, with NO caption at all
 *
 * Assertions:
 *   1. container/codec/dimensions/fps/duration (duration = TRIMMED timeline)
 *   2. caption burn-in: boxed vs plain at the same instant on the same source
 *      clip (a true A/B — the caption darkens the caption band via its chip)
 *   3. fade-in: the first frames of clip 1 are darker than later ones
 *   4. caption style: boxed vs minimal produces measurably different pixels
 *      in the caption band (the chip is the difference)
 *
 * Sources are generated locally with ffmpeg and served from a loopback media
 * server (same approach as src/smoke.ts). Skips with a NOTE when no capable
 * ffmpeg / Chromium is available.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import { spawn, spawnSync } from 'child_process';
import { AddressInfo } from 'net';

import { config } from '../src/config';
import { renderProjectToFile, validateProjectSnapshot } from '../src/render';
import { probeFile } from '../src/probe';
import { runFfmpeg } from '../src/ffmpeg';

// ---------------------------------------------------------------------------
// Capability discovery (skip-with-NOTE)
// ---------------------------------------------------------------------------

function ffmpegOk(): boolean {
  try {
    const r = spawnSync(config.ffmpegPath, ['-encoders'], { encoding: 'utf8' });
    if (r.status !== 0) return false;
    return (r.stdout || '').includes('libx264') && (r.stdout || '').includes('aac');
  } catch {
    return false;
  }
}

function chromiumOk(): boolean {
  try {
    // vitest runs with cwd = render-worker/, so the repo root is one level up
    const abs = path.resolve(
      process.cwd(),
      '..',
      'node_modules/.remotion/chrome-headless-shell/linux64/chrome-headless-shell-linux64/chrome-headless-shell',
    );
    if (!fs.existsSync(abs)) return false;
    return spawnSync(abs, ['--version'], { encoding: 'utf8' }).status === 0;
  } catch {
    return false;
  }
}

const READY = ffmpegOk() && chromiumOk() && fs.existsSync(config.ffmpegPath);
const itIf = READY ? it : it.skip;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SOURCE_SECONDS = 3;
const TRIM_FROM = 0.5;
const TRIM_TO = 2.0; // 1.5s per clip → 3.0s timeline from 3s sources

/** Measured: the dialogue caption band lives at y≈1500–1700 in 1080×1920. */
const CAPTION_REGION = '880:200:100:1500';
/** Middle band: no watermark (top-left), no caption (bottom). */
const MID_REGION = '800:600:140:700';

/** Probe instant: inside clip 1 (0–1.5s) and inside the caption window. */
const PROBE_AT = 1.0;

let workDir = '';
let server: http.Server | null = null;
let baseUrl = '';
const rendered: Record<'boxed' | 'minimal' | 'plain', string> = {
  boxed: '',
  minimal: '',
  plain: '',
};

function startMediaServer(dir: string): Promise<string> {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || '').split('?')[0]);
      const filePath = path.join(dir, path.basename(urlPath));
      if (!filePath.startsWith(dir) || !fs.existsSync(filePath)) {
        res.statusCode = 404;
        res.end('not found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'video/mp4',
        'Content-Length': fs.statSync(filePath).size,
        'Accept-Ranges': 'bytes',
      });
      fs.createReadStream(filePath).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address() as AddressInfo;
      resolve(`http://127.0.0.1:${port}`);
    });
    server = srv;
  });
}

/** Mean luma (0–255) of a cropped region of one frame. */
async function regionMeanLuma(file: string, atSeconds: number, crop: string): Promise<number> {
  const out = await new Promise<Buffer>((resolve, reject) => {
    const child = spawn(config.ffmpegPath, [
      '-v', 'error',
      '-ss', String(atSeconds),
      '-i', file,
      '-frames:v', '1',
      '-vf', `crop=${crop},format=gray`,
      '-f', 'rawvideo',
      '-',
    ]);
    const chunks: Buffer[] = [];
    child.stdout.on('data', (c: Buffer) => chunks.push(c));
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error(`ffmpeg crop exited ${code}`)),
    );
  });
  if (out.length === 0) throw new Error('no frame bytes');
  let sum = 0;
  for (const byte of out) sum += byte;
  return sum / out.length;
}

type Variant = 'boxed' | 'minimal' | 'plain';

function buildProject(variant: Variant, mediaBase: string) {
  const now = new Date().toISOString();
  return {
    version: 1,
    id: 'parity',
    title: 'Parity',
    duration: 3,
    fps: 30,
    width: 1080,
    height: 1920,
    tracks: [{
      id: 'video-0', kind: 'video', name: 'Video', muted: false, volume: 1,
      clips: [
        { id: 'c1', assetUrl: `${mediaBase}/clipA.mp4`, assetKind: 'uploaded', start: 0,
          trimStart: TRIM_FROM, trimEnd: TRIM_TO, volume: 1, fadeIn: 0.5, fadeOut: 0 },
        { id: 'c2', assetUrl: `${mediaBase}/clipB.mp4`, assetKind: 'uploaded', start: 1.5,
          trimStart: TRIM_FROM, trimEnd: TRIM_TO, volume: 1, fadeIn: 0, fadeOut: 0 },
      ],
    }],
    captions:
      variant === 'plain'
        ? []
        : [{ id: 'cap', text: 'PARITY', start: 0.5, end: 1.4, kind: 'dialogue', style: variant }],
    branding: { handle: '@parity', watermarkText: '@parity', watermarkPosition: 'top-left', accentColor: '#F59E0B', showProgressBar: true },
    scenePlan: [],
    createdAt: now,
    updatedAt: now,
  };
}

async function renderVariant(variant: Variant): Promise<void> {
  const parsed = validateProjectSnapshot(buildProject(variant, baseUrl));
  if (!parsed.ok) throw new Error(`snapshot rejected for ${variant}: ${parsed.error}`);
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), `parity-${variant}-`));
  const result = await renderProjectToFile(parsed.project, {
    workDir: outDir,
    renderSettings: { width: 1080, height: 1920, fps: 30 },
  });
  rendered[variant] = result.outputPath;
}

beforeAll(async () => {
  if (!READY) return;
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parity-sources-'));
  await runFfmpeg([
    '-y', '-f', 'lavfi', '-i', `testsrc2=size=540x960:rate=30:duration=${SOURCE_SECONDS}`,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30', path.join(workDir, 'clipA.mp4'),
  ]);
  await runFfmpeg([
    '-y', '-f', 'lavfi', '-i', `smptebars=size=540x960:rate=30:duration=${SOURCE_SECONDS}`,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30', path.join(workDir, 'clipB.mp4'),
  ]);
  baseUrl = await startMediaServer(workDir);
  await renderVariant('boxed');
  await renderVariant('minimal');
  await renderVariant('plain');
}, 480000);

afterAll(() => {
  if (server) server.close();
  // remove every rendered file, work dir and variant temp dirs
  for (const file of Object.values(rendered)) {
    if (file && fs.existsSync(file)) {
      try {
        fs.rmSync(path.dirname(file), { recursive: true, force: true });
      } catch { /* ignore */ }
    }
  }
  for (const dir of fs.readdirSync(os.tmpdir())) {
    if (dir.startsWith('parity-')) {
      try { fs.rmSync(path.join(os.tmpdir(), dir), { recursive: true, force: true }); } catch { /* ignore */ }
    }
  }
});

// ---------------------------------------------------------------------------
// The assertions (all read the cached renders)
// ---------------------------------------------------------------------------

describe('composition parity (real render, pixel proof)', () => {
  itIf('duration equals the TRIMMED timeline, not the sources', { timeout: 120000 }, async () => {
    const probe = await probeFile(rendered.boxed);
    expect(probe.container).toContain('mp4');
    expect(probe.videoCodec).toBe('h264');
    expect(probe.audioCodec).toBe('aac');
    expect(probe.width).toBe(1080);
    expect(probe.height).toBe(1920);
    expect(probe.fps).not.toBeNull();
    expect(Math.abs((probe.fps ?? 0) - 30)).toBeLessThanOrEqual(0.5);
    // 2 × 1.5s trims of 3s sources. Un-trimmed would be ~6s.
    expect(Math.abs((probe.durationSeconds ?? 0) - 3.0)).toBeLessThanOrEqual(0.5);
  });

  itIf('the caption is burned in (A/B vs a no-caption render of the same source)', { timeout: 120000 }, async () => {
    const withCaption = await regionMeanLuma(rendered.boxed, PROBE_AT, CAPTION_REGION);
    const withoutCaption = await regionMeanLuma(rendered.plain, PROBE_AT, CAPTION_REGION);
    // The boxed caption's dark chip measurably darkens the caption band.
    expect(Math.abs(withCaption - withoutCaption)).toBeGreaterThan(3);
    expect(withCaption).toBeLessThan(withoutCaption);
  });

  itIf('the fade-in darkens the first frames of the first clip', { timeout: 120000 }, async () => {
    const early = await regionMeanLuma(rendered.boxed, 0.05, MID_REGION);
    const later = await regionMeanLuma(rendered.boxed, 0.6, MID_REGION);
    expect(early).toBeLessThan(later);
  });

  itIf('the caption style changes the rendered pixels (boxed vs minimal)', { timeout: 120000 }, async () => {
    const boxedInside = await regionMeanLuma(rendered.boxed, PROBE_AT, CAPTION_REGION);
    const minimalInside = await regionMeanLuma(rendered.minimal, PROBE_AT, CAPTION_REGION);
    // boxed draws a black chip behind the text → measurably darker band
    expect(Math.abs(boxedInside - minimalInside)).toBeGreaterThan(2);
    expect(boxedInside).toBeLessThan(minimalInside);
  });
});
