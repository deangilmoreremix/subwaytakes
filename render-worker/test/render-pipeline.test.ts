/**
 * STAGING VALIDATION SUITE — render pipeline (encode gate + probe verification).
 *
 * Proves the delivery contract end to end:
 *   normalizeToDeliverySpec takes a deliberately NON-compliant source
 *   (640x360, 24fps, mono 44.1 kHz audio) and emits a spec-compliant MP4
 *   (1080x1920, h264, aac 48kHz stereo, 30fps, +faststart), and
 *   verifyDelivery REJECTS files that do not comply — which is what stops the
 *   worker from ever marking an unedited/unsuitable render as 'done'.
 *
 * NOTE ON THIS ENVIRONMENT: `ffmpeg`/`ffprobe` are not installed here (not at
 * /usr/bin/ffmpeg and not on PATH — verified by resolveBinary() below). The
 * real-encode assertions are therefore marked skipped and the suite instead
 * unit-tests the argument construction of the encode command plus the pure
 * verification logic. On a machine with ffmpeg (the Docker image installs it)
 * the same tests run for real.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

import { config } from '../src/config';
import { normalizeToDeliverySpec, runFfmpeg } from '../src/ffmpeg';
import { probeFile, verifyDelivery, type ProbeInfo } from '../src/probe';

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

const tmpDirs: string[] = [];
let configBackup: Record<string, unknown>;

function tmpDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tmpDirs.push(dir);
  return dir;
}

/**
 * Locate a usable ffmpeg/ffprobe pair. The worker runs the SYSTEM binaries
 * (/usr/bin/ffmpeg per the Dockerfile), so candidates are:
 *   - the configured FFMPEG_PATH / FFMPEG_PROBE_PATH directories
 *   - /usr/bin, /usr/local/bin
 *   - whatever `which ffmpeg` reports
 *   - the ffmpeg builds bundled in node_modules (@remotion/compositor-*)
 * A candidate only counts when it can run the delivery-spec encode gate:
 * the scale/pad/fps/format/setsar filters, the testsrc2 source, and the
 * libx264 + aac encoders. (The @remotion builds shipped in this repo are
 * trimmed down and fail that check — see the NOTE below.)
 */
const REQUIRED_FILTERS = ['scale', 'pad', 'fps', 'format', 'setsar', 'testsrc2'];
const REQUIRED_ENCODERS = ['libx264', 'aac'];

function binaryFeatures(bin: string, args: string[]): Set<string> | null {
  const run = spawnSync(bin, args, { encoding: 'utf8', timeout: 30000 });
  if (run.error || run.status !== 0) return null;
  const names = new Set<string>();
  for (const line of run.stdout.split('\n')) {
    const parts = line.trim().split(/\s+/);
    if (parts.length > 1 && /^[.A-Z]+$/.test(parts[0]!)) names.add(parts[1]!);
  }
  return names;
}

interface Candidate {
  ffmpeg: string;
  ffprobe: string;
  reason: string;
}

function inspect(dir: string): Candidate {
  const ffmpeg = path.join(dir, 'ffmpeg');
  const ffprobe = path.join(dir, 'ffprobe');
  const candidate: Candidate = { ffmpeg, ffprobe, reason: '' };
  if (!fs.existsSync(ffmpeg)) {
    candidate.reason = 'ffmpeg missing';
    return candidate;
  }
  if (!fs.existsSync(ffprobe)) {
    candidate.reason = 'ffprobe missing';
    return candidate;
  }
  const filters = binaryFeatures(ffmpeg, ['-hide_banner', '-filters']);
  if (!filters) {
    candidate.reason = 'ffmpeg -filters failed';
    return candidate;
  }
  const missingFilters = REQUIRED_FILTERS.filter((f) => !filters.has(f));
  if (missingFilters.length > 0) {
    candidate.reason = `missing filters: ${missingFilters.join(', ')}`;
    return candidate;
  }
  const encoders = binaryFeatures(ffmpeg, ['-hide_banner', '-encoders']);
  if (!encoders) {
    candidate.reason = 'ffmpeg -encoders failed';
    return candidate;
  }
  const missingEncoders = REQUIRED_ENCODERS.filter((e) => !encoders.has(e));
  if (missingEncoders.length > 0) {
    candidate.reason = `missing encoders: ${missingEncoders.join(', ')}`;
    return candidate;
  }
  return candidate;
}

function candidateDirs(): { dir: string; note: string }[] {
  const dirs: { dir: string; note: string }[] = [];
  const seen = new Set<string>();
  const push = (dir: string, note: string) => {
    if (!dir || seen.has(dir)) return;
    seen.add(dir);
    dirs.push({ dir, note });
  };
  push(path.dirname(config.ffmpegPath), `configured FFMPEG_PATH (${config.ffmpegPath})`);
  push('/usr/bin', '/usr/bin');
  push('/usr/local/bin', '/usr/local/bin');
  const which = spawnSync('which', ['ffmpeg'], { encoding: 'utf8' });
  if (which.status === 0) {
    const found = which.stdout.split('\n').map((l) => l.trim()).filter(Boolean)[0];
    if (found) push(path.dirname(found), `which ffmpeg (${found})`);
  }
  const remotionRoot = path.join(config.repoRoot, 'node_modules', '@remotion');
  try {
    for (const entry of fs.readdirSync(remotionRoot)) {
      if (entry.startsWith('compositor-')) {
        push(path.join(remotionRoot, entry), `node_modules/@remotion/${entry}`);
      }
    }
  } catch {
    /* repo has no @remotion install — fine */
  }
  return dirs;
}

const CANDIDATES = candidateDirs().map((c) => ({ ...inspect(c.dir), note: c.note }));
const CAPABLE = CANDIDATES.find((c) => c.reason === '') ?? null;
const FFMPEG = CAPABLE?.ffmpeg ?? null;
const FFPROBE = CAPABLE?.ffprobe ?? null;
const HAVE_FFMPEG = FFMPEG !== null && FFPROBE !== null;
const itReal = HAVE_FFMPEG ? it : it.skip;

/** Install a fake ffmpeg/ffprobe that records argv or prints canned JSON. */
function installFakeBinary(
  name: 'ffmpeg' | 'ffprobe',
  body: string,
): { dir: string; binary: string } {
  const dir = tmpDir(`fake-${name}-`);
  const binary = path.join(dir, name);
  fs.writeFileSync(binary, `#!${process.execPath}\n${body}\n`, { mode: 0o755 });
  return { dir, binary };
}

beforeEach(() => {
  configBackup = {
    ffmpegPath: config.ffmpegPath,
    ffprobePath: config.ffprobePath,
    outputWidth: config.outputWidth,
    outputHeight: config.outputHeight,
    outputFps: config.outputFps,
    outputCrf: config.outputCrf,
  };
});

afterEach(() => {
  Object.assign(config, configBackup);
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
  tmpDirs.length = 0;
});

/** Offsets of the top-level MP4 atoms (used for the +faststart assertion). */
function atomOffsets(buffer: Buffer, wanted: string[]): Record<string, number> {
  const found: Record<string, number> = {};
  let offset = 0;
  while (offset + 8 <= buffer.length) {
    const size = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    if (wanted.includes(type) && !(type in found)) found[type] = offset;
    if (size < 8 || offset + size > buffer.length) break;
    offset += size;
  }
  return found;
}

describe('binary discovery', () => {
  it('inspects every candidate location and requires the delivery-spec capability set', () => {
    expect(CANDIDATES.length).toBeGreaterThan(0);
    for (const c of CANDIDATES) {
      expect(typeof c.reason).toBe('string');
      if (c.reason === '') {
        expect(c.ffmpeg).toContain('ffmpeg');
        expect(c.ffprobe).toContain('ffprobe');
      }
    }
    // a directory with no binaries at all must be reported, not silently used
    const empty = inspect('/definitely/not/a/directory');
    expect(empty.reason).toBe('ffmpeg missing');
  });

  it('NOTE: documents whether a capable ffmpeg exists in this environment', () => {
    if (HAVE_FFMPEG) {
      console.log(
        `[render-pipeline] NOTE: capable binaries found (ffmpeg=${FFMPEG}, ffprobe=${FFPROBE}) — ` +
          'running the REAL encode + probe assertions below.',
      );
    } else {
      const lines = [
        '[render-pipeline] NOTE: no ffmpeg/ffprobe capable of the delivery spec in this environment',
        ...CANDIDATES.map((c) => `  ${c.note}: ${c.reason || 'capable'}`),
        '  => the real-encode tests below are SKIPPED; the encode-command',
        '     argument construction and the probe verification logic are',
        '     unit-tested instead. render-worker/Dockerfile installs the system',
        '     ffmpeg, so the same tests run for real on staging.',
      ];
      console.warn(lines.join('\n'));
    }
    expect(typeof HAVE_FFMPEG).toBe('boolean');
  });
});

// ---------------------------------------------------------------------------
// Encoder argument construction (always runs)
// ---------------------------------------------------------------------------

describe('normalizeToDeliverySpec builds the encode gate', () => {
  it('passes the full delivery spec to ffmpeg, once, over a single input', async () => {
    const { dir, binary } = installFakeBinary(
      'ffmpeg',
      "const fs = require('fs');\n" +
        "fs.appendFileSync(process.env.FAKE_FFMPEG_ARGS, JSON.stringify(process.argv.slice(2)) + '\\n');",
    );
    const argsFile = path.join(dir, 'args.jsonl');
    fs.writeFileSync(argsFile, '');
    const input = path.join(dir, 'remotion-raw.mp4');
    const output = path.join(dir, 'final.mp4');
    fs.writeFileSync(input, 'raw');

    config.ffmpegPath = binary;
    process.env.FAKE_FFMPEG_ARGS = argsFile;
    try {
      await normalizeToDeliverySpec(input, output);
    } finally {
      delete process.env.FAKE_FFMPEG_ARGS;
    }

    const lines = fs.readFileSync(argsFile, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(1); // exactly one ffmpeg invocation
    const args = JSON.parse(lines[0]!) as string[];

    const valueAfter = (flag: string): string => {
      const idx = args.indexOf(flag);
      expect(idx, `missing ${flag}`).toBeGreaterThan(-1);
      return args[idx + 1]!;
    };

    expect(args[0]).toBe('-y');
    expect(valueAfter('-i')).toBe(input);
    expect(args[args.length - 1]).toBe(output);
    expect(args.filter((a) => a === '-i')).toHaveLength(1);

    // letterbox/pad to exactly 1080x1920 @ 30fps, yuv420p, SAR 1:1
    const filter = valueAfter('-vf');
    expect(filter).toContain('scale=1080:1920:force_original_aspect_ratio=decrease');
    expect(filter).toContain('pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black');
    expect(filter).toContain('fps=30');
    expect(filter).toContain('format=yuv420p');
    expect(filter).toContain('setsar=1');

    // h264 / crf 20 / medium preset
    expect(valueAfter('-c:v')).toBe('libx264');
    expect(valueAfter('-preset')).toBe('medium');
    expect(valueAfter('-crf')).toBe(String(config.outputCrf));
    expect(valueAfter('-pix_fmt')).toBe('yuv420p');
    expect(valueAfter('-r')).toBe(String(config.outputFps));

    // aac 128k 48kHz stereo
    expect(valueAfter('-c:a')).toBe('aac');
    expect(valueAfter('-b:a')).toBe('128k');
    expect(valueAfter('-ar')).toBe('48000');
    expect(valueAfter('-ac')).toBe('2');

    // progressive download: moov before mdat
    expect(valueAfter('-movflags')).toBe('+faststart');
  });

  it('honours the configured output size/fps (no hardcoded 1080x1920)', async () => {
    const { dir, binary } = installFakeBinary(
      'ffmpeg',
      "const fs = require('fs');\n" +
        "fs.appendFileSync(process.env.FAKE_FFMPEG_ARGS, JSON.stringify(process.argv.slice(2)) + '\\n');",
    );
    const argsFile = path.join(dir, 'args.jsonl');
    config.ffmpegPath = binary;
    config.outputWidth = 720;
    config.outputHeight = 1280;
    config.outputFps = 24;
    process.env.FAKE_FFMPEG_ARGS = argsFile;
    try {
      await normalizeToDeliverySpec('in.mp4', 'out.mp4');
    } finally {
      delete process.env.FAKE_FFMPEG_ARGS;
    }
    const args = JSON.parse(fs.readFileSync(argsFile, 'utf8').trim()) as string[];
    const filter = args[args.indexOf('-vf') + 1]!;
    expect(filter).toContain('scale=720:1280:force_original_aspect_ratio=decrease');
    expect(filter).toContain('pad=720:1280:');
    expect(filter).toContain('fps=24');
    expect(args[args.indexOf('-r') + 1]).toBe('24');
  });

  it('runFfmpeg surfaces a non-zero exit code as a failure', async () => {
    const { binary } = installFakeBinary('ffmpeg', 'process.exit(3);');
    config.ffmpegPath = binary;
    await expect(runFfmpeg(['-version'])).rejects.toThrow(/ffmpeg exited 3/);
  });
});

// ---------------------------------------------------------------------------
// Probe + verification logic (always runs)
// ---------------------------------------------------------------------------

describe('probe verification rejects non-compliant files', () => {
  function makeProbe(overrides: Partial<ProbeInfo> = {}): ProbeInfo {
    return {
      container: 'mov,mp4,m4a,3gp,3g2,mj2',
      durationSeconds: 2,
      videoCodec: 'h264',
      audioCodec: 'aac',
      width: 1080,
      height: 1920,
      fps: 30,
      raw: {},
      ...overrides,
    };
  }

  it('accepts a spec-compliant file', () => {
    const result = verifyDelivery(makeProbe(), {
      durationSeconds: 2,
      width: 1080,
      height: 1920,
      requireAudio: true,
    });
    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('rejects a 640x360 render (unedited/unsuitable video)', () => {
    const result = verifyDelivery(makeProbe({ width: 640, height: 360 }), {
      durationSeconds: 2,
      width: 1080,
      height: 1920,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('640x360');
    expect(result.error).toContain('1080x1920');
  });

  it('rejects a non-h264 video codec, a missing aac track, and a wrong duration', () => {
    const badCodec = verifyDelivery(makeProbe({ videoCodec: 'vp9' }), {
      durationSeconds: 2,
      width: 1080,
      height: 1920,
    });
    expect(badCodec.ok).toBe(false);
    expect(badCodec.error).toContain('vp9');

    const noAudio = verifyDelivery(makeProbe({ audioCodec: null }), {
      durationSeconds: 2,
      width: 1080,
      height: 1920,
      requireAudio: true,
    });
    expect(noAudio.ok).toBe(false);
    expect(noAudio.error).toContain('expected aac');

    const offDuration = verifyDelivery(makeProbe({ durationSeconds: 12.4 }), {
      durationSeconds: 2,
      width: 1080,
      height: 1920,
    });
    expect(offDuration.ok).toBe(false);
    expect(offDuration.error).toContain('duration 12.400s');

    const unknownDuration = verifyDelivery(makeProbe({ durationSeconds: null }), {
      durationSeconds: 2,
      width: 1080,
      height: 1920,
    });
    expect(unknownDuration.ok).toBe(false);
    expect(unknownDuration.error).toContain('could not determine duration');

    const badContainer = verifyDelivery(makeProbe({ container: 'matroska,webm' }), {
      durationSeconds: 2,
      width: 1080,
      height: 1920,
    });
    expect(badContainer.ok).toBe(false);
    expect(badContainer.error).toContain('matroska,webm');
  });

  it('runs a 640x360 ffprobe payload through probeFile and fails the delivery gate', async () => {
    const { dir, binary } = installFakeBinary(
      'ffprobe',
      "process.stdout.write(JSON.stringify(require(process.env.FAKE_PROBE_JSON)));",
    );
    const jsonFile = path.join(dir, 'probe.json');
    fs.writeFileSync(
      jsonFile,
      JSON.stringify({
        streams: [
          {
            codec_type: 'video',
            codec_name: 'h264',
            width: 640,
            height: 360,
            r_frame_rate: '24/1',
            pix_fmt: 'yuv420p',
          },
        ],
        format: { format_name: 'mov,mp4,m4a,3gp,3g2,mj2', duration: '2.000000' },
      }),
    );
    config.ffprobePath = binary;
    process.env.FAKE_PROBE_JSON = jsonFile;
    try {
      const probe = await probeFile(path.join(dir, 'unedited.mp4'));
      expect(probe.width).toBe(640);
      expect(probe.height).toBe(360);
      expect(probe.fps).toBe(24);
      expect(probe.container).toContain('mp4');
      expect(probe.audioCodec).toBeNull();

      const verify = verifyDelivery(probe, {
        durationSeconds: 2,
        width: 1080,
        height: 1920,
        requireAudio: true,
      });
      expect(verify.ok).toBe(false);
      expect(verify.error).toContain('640x360');
      expect(verify.error).toContain('expected aac');
    } finally {
      delete process.env.FAKE_PROBE_JSON;
    }
  });

  it('runProbe surfaces a non-zero ffprobe exit code as a failure', async () => {
    const { binary } = installFakeBinary('ffprobe', 'process.exit(1);');
    config.ffprobePath = binary;
    await expect(probeFile('whatever.mp4')).rejects.toThrow(/ffprobe exited 1/);
  });
});

// ---------------------------------------------------------------------------
// Real encode + probe (skipped without ffmpeg — see the NOTE above)
// ---------------------------------------------------------------------------

describe('real ffmpeg normalize + probe (delivery spec)', () => {
  itReal('normalizes a deliberately non-compliant 640x360 24fps mono clip to the delivery spec', async () => {
    config.ffmpegPath = FFMPEG!;
    config.ffprobePath = FFPROBE!;
    const dir = tmpDir('pipeline-');

    // --- a NON-compliant source: 640x360, 24fps, mono 44.1kHz mp3-ish audio ---
    const bad = path.join(dir, 'noncompliant.mp4');
    await runFfmpeg([
      '-y',
      '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=24:duration=2',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-pix_fmt', 'yuv420p', '-r', '24',
      '-c:a', 'aac', '-b:a', '96k', '-ar', '44100', '-ac', '1',
      bad,
    ]);

    const before = await probeFile(bad);
    expect(before.width).toBe(640);
    expect(before.height).toBe(360);
    expect(before.fps).toBe(24);
    expect(before.audioCodec).toBe('aac');

    // the pre-normalize render must FAIL the delivery gate ...
    const beforeVerify = verifyDelivery(before, {
      durationSeconds: 2,
      width: config.outputWidth,
      height: config.outputHeight,
      requireAudio: true,
    });
    expect(beforeVerify.ok).toBe(false);
    expect(beforeVerify.error).toContain('640x360');

    // ... and normalize must actually correct it
    const out = path.join(dir, 'final.mp4');
    await normalizeToDeliverySpec(bad, out);

    const probe = await probeFile(out);
    expect(probe.container).toContain('mp4');
    expect(probe.videoCodec).toBe('h264');
    expect(probe.width).toBe(config.outputWidth);
    expect(probe.height).toBe(config.outputHeight);
    expect(probe.fps).toBeCloseTo(config.outputFps, 1);
    expect(probe.audioCodec).toBe('aac');

    const after = verifyDelivery(probe, {
      durationSeconds: 2,
      width: config.outputWidth,
      height: config.outputHeight,
      requireAudio: true,
    });
    expect(after.ok).toBe(true);
    expect(probe.durationSeconds).not.toBeNull();
    expect(Math.abs(probe.durationSeconds! - 2)).toBeLessThanOrEqual(0.5);

    // +faststart: the moov atom precedes the media data
    const atoms = atomOffsets(fs.readFileSync(out), ['moov', 'mdat']);
    expect(atoms.moov).toBeDefined();
    expect(atoms.mdat).toBeDefined();
    expect(atoms.moov!).toBeLessThan(atoms.mdat!);

    // letterboxing: a 16:9 source padded into 1080x1920 must leave the top
    // rows black rather than stretching the picture
    const corner = path.join(dir, 'corner.rgb');
    await runFfmpeg([
      '-y', '-i', out, '-vf', 'crop=4:4:0:0', '-frames:v', '1',
      '-f', 'rawvideo', '-pix_fmt', 'rgb24', corner,
    ]);
    const raw = fs.readFileSync(corner);
    expect(raw).toHaveLength(48); // 4x4 rgb
    expect([...raw].every((b) => b === 0)).toBe(true);
  }, 120000);

  itReal('a compliant file stays compliant after normalization (idempotent gate)', async () => {
    config.ffmpegPath = FFMPEG!;
    config.ffprobePath = FFPROBE!;
    const dir = tmpDir('pipeline-ok-');
    const src = path.join(dir, 'already-good.mp4');
    await runFfmpeg([
      '-y',
      '-f', 'lavfi', '-i', 'testsrc2=size=1080x1920:rate=30:duration=1',
      '-f', 'lavfi', '-i', 'sine=frequency=330:duration=1',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-pix_fmt', 'yuv420p', '-r', '30',
      '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2',
      src,
    ]);
    const out = path.join(dir, 'final.mp4');
    await normalizeToDeliverySpec(src, out);
    const probe = await probeFile(out);
    const verify = verifyDelivery(probe, {
      durationSeconds: 1,
      width: 1080,
      height: 1920,
      requireAudio: true,
    });
    expect(verify.ok).toBe(true);
  }, 120000);
});
