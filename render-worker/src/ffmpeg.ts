import { spawn } from 'child_process';
import fs from 'fs';
import { config } from './config';
import { probeFile } from './probe';

/**
 * FFmpeg helpers for the render worker.
 *
 * Everything here goes through the system FFmpeg binary (FFMPEG_PATH).
 * The delivery spec is enforced by `normalizeToDeliverySpec` — the encode
 * gate every render must pass before upload.
 */

export function runFfmpeg(args: string[], options: { timeoutMs?: number; cwd?: string } = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(config.ffmpegPath, args, {
      stdio: ['ignore', 'ignore', 'pipe'],
      cwd: options.cwd,
    });
    let stderr = '';
    child.stderr.on('data', (d) => {
      stderr += d.toString();
      if (stderr.length > 20000) stderr = stderr.slice(-20000);
    });
    const timer = options.timeoutMs
      ? setTimeout(() => {
          child.kill('SIGKILL');
          reject(new Error(`ffmpeg timed out after ${options.timeoutMs}ms`));
        }, options.timeoutMs)
      : null;
    child.on('error', (err) => {
      if (timer) clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.trim().slice(-800)}`));
    });
  });
}

function escapeFilterPath(p: string): string {
  // ffmpeg filter graph escaping for paths on linux
  return p.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'");
}

/**
 * Video filter that letterboxes any input to exactly WxH.
 */
function scalePadFilter(width: number, height: number, fps: number): string {
  return [
    `scale=${width}:${height}:force_original_aspect_ratio=decrease`,
    `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`,
    `fps=${fps}`,
    'format=yuv420p',
    'setsar=1',
  ].join(',');
}

/**
 * THE ENCODE GATE — normalize any render to the exact delivery spec:
 *   H.264 (libx264, crf 20, medium) + AAC 128k 48kHz stereo,
 *   1080x1920 (letterboxed), 30fps, yuv420p, +faststart MP4.
 *
 * Decision: we ALWAYS run this, even when the Remotion output already looks
 * compliant. Re-encoding once is cheap for interview-length videos and
 * guarantees the delivery contract (players reject mixed SaaS/pix_fmt,
 * missing faststart breaks progressive download in the app's <video> tags).
 * Skipping it would mean trusting the renderer's encoder settings forever.
 */
export async function normalizeToDeliverySpec(input: string, output: string): Promise<void> {
  const { outputWidth: w, outputHeight: h, outputFps: fps, outputCrf: crf } = config;
  await runFfmpeg([
    '-y',
    '-i', input,
    '-vf', scalePadFilter(w, h, fps),
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', crf,
    '-pix_fmt', 'yuv420p',
    '-r', String(fps),
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '48000',
    '-ac', '2',
    '-movflags', '+faststart',
    output,
  ]);
}

export type StitchTransitionType = 'xfade' | 'fade' | 'dissolve' | 'slide' | 'zoom' | 'blur' | 'none';

/** Map a friendly transition name to an xfade transition (unsupported -> fade). */
export function xfadeTransitionName(type: StitchTransitionType): 'fade' | 'fadeblack' {
  if (type === 'zoom') return 'fadeblack';
  // xfade has no 'slide'/'blur'/'dissolve'/'xfade' transitions — fall back to a
  // plain fade, which is the closest supported visual.
  return 'fade';
}

export interface ConcatWithTransitionOptions {
  type: StitchTransitionType;
  /** Transition duration in seconds. */
  duration: number;
  workDir: string;
}

/**
 * Concatenate N videos with a transition between each pair.
 *
 * Implementation notes:
 * - xfade requires all inputs to share codec, resolution, fps, pixel format
 *   and timebase, so every input is first normalized to the delivery
 *   parameters (into `workDir`) before the xfade chain is applied.
 * - Offsets are cumulative: offset_k = (sum of durations of clips 0..k) - (k+1)*T.
 * - Audio is chained with acrossfade in lockstep; inputs without audio are
 *   concatenated video-only.
 * - type 'none' uses the concat demuxer but still RE-ENCODES to the
 *   normalized params (never -c copy across mismatched inputs — that
 *   corrupts output).
 */
export async function concatWithTransition(
  inputPaths: string[],
  output: string,
  options: ConcatWithTransitionOptions,
): Promise<void> {
  if (inputPaths.length === 0) throw new Error('concatWithTransition: no inputs');
  const { outputWidth: w, outputHeight: h, outputFps: fps } = config;

  if (inputPaths.length === 1) {
    await normalizeToDeliverySpec(inputPaths[0], output);
    return;
  }

  // ---- normalize every input to identical params ----
  const normalized: string[] = [];
  for (let i = 0; i < inputPaths.length; i++) {
    const out = `${options.workDir}/norm-${i}.mp4`;
    await runFfmpeg([
      '-y',
      '-i', inputPaths[i],
      '-vf', scalePadFilter(w, h, fps),
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '18',
      '-pix_fmt', 'yuv420p',
      '-r', String(fps),
      '-c:a', 'aac',
      '-b:a', '128k',
      '-ar', '48000',
      '-ac', '2',
      out,
    ]);
    normalized.push(out);
  }

  if (options.type === 'none') {
    // Re-encoded hard-cut concat (concat demuxer over the normalized files).
    const listFile = `${options.workDir}/concat.txt`;
    const list = normalized.map((p) => `file '${escapeFilterPath(p)}'`).join('\n');
    fs.writeFileSync(listFile, list);
    await runFfmpeg([
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', listFile,
      '-vf', scalePadFilter(w, h, fps),
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', config.outputCrf,
      '-pix_fmt', 'yuv420p',
      '-r', String(fps),
      '-c:a', 'aac',
      '-b:a', '128k',
      '-ar', '48000',
      '-movflags', '+faststart',
      output,
    ]);
    return;
  }

  // ---- probe durations for offset math ----
  const probes = await Promise.all(normalized.map((p) => probeFile(p)));
  const durations = probes.map((p) => p.durationSeconds ?? 0);
  const minDuration = Math.min(...durations);
  if (minDuration < 0.2) {
    // Degenerate input — a transition longer than a clip cannot be scheduled.
    throw new Error('concatWithTransition: input shorter than 0.2s');
  }
  // Clamp the transition to at most half of the shortest clip.
  const t = Math.max(0.1, Math.min(options.duration, minDuration / 2));

  const hasAudio = probes.every((p) => p.audioCodec !== null);

  // ---- build filter_complex ----
  const filters: string[] = [];
  let offset = 0;
  let lastVideoLabel = '[0:v]';
  let lastAudioLabel = hasAudio ? '[0:a]' : '';
  for (let i = 1; i < normalized.length; i++) {
    offset += durations[i - 1] - t;
    const outV = i === normalized.length - 1 ? '[vout]' : `[vx${i}]`;
    filters.push(
      `${lastVideoLabel}[${i}:v]xfade=transition=${xfadeTransitionName(options.type)}:duration=${t}:offset=${offset.toFixed(3)}${outV}`,
    );
    lastVideoLabel = outV;
    if (hasAudio) {
      const outA = i === normalized.length - 1 ? '[aout]' : `[ax${i}]`;
      filters.push(`${lastAudioLabel}[${i}:a]acrossfade=d=${t}:c1=tri:c2=tri${outA}`);
      lastAudioLabel = outA;
    }
  }

  const args: string[] = ['-y'];
  for (const p of normalized) args.push('-i', p);
  args.push('-filter_complex', filters.join(';'));
  args.push('-map', lastVideoLabel);
  if (hasAudio) args.push('-map', lastAudioLabel);
  args.push(
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', config.outputCrf,
    '-pix_fmt', 'yuv420p',
    '-r', String(fps),
  );
  if (hasAudio) {
    args.push('-c:a', 'aac', '-b:a', '128k', '-ar', '48000');
  }
  args.push('-movflags', '+faststart', output);
  await runFfmpeg(args);
}

/**
 * Normalize the audio of a file (used for interview audio mixing):
 * loudnorm to -16 LUFS (single-pass; two-pass loudnorm is the ideal but
 * requires a measurement pass — single-pass is fine for ambient/dialogue
 * mixing here), video stream is copied untouched.
 */
export async function normalizeAudio(
  input: string,
  output: string,
  options: { loudnorm?: boolean } = {},
): Promise<void> {
  const args: string[] = ['-y', '-i', input];
  if (options.loudnorm) {
    // loudnorm upsamples to 192kHz internally; the -ar output option
    // resamples back to 48kHz (an in-filter aresample breaks filter-graph
    // negotiation on ffmpeg 4.4).
    args.push(
      '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-ar', '48000',
    );
  } else {
    args.push('-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-ar', '48000');
  }
  args.push(output);
  await runFfmpeg(args);
}
