import { spawn } from 'child_process';
import { config } from './config';

/**
 * ffprobe wrapper + delivery verification. Runs:
 *   ffprobe -v error -print_format json -show_format -show_streams <file>
 */

/** Stream entry from ffprobe JSON output (all fields optional/lenient). */
export interface FfprobeStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
  pix_fmt?: string;
}

/** Format entry from ffprobe JSON output. */
export interface FfprobeFormat {
  format_name?: string;
  duration?: string;
}

/** Raw ffprobe JSON payload. */
export interface FfprobeJson {
  streams?: FfprobeStream[];
  format?: FfprobeFormat;
}

export interface ProbeInfo {
  /** e.g. "mov,mp4,m4a,3gp,3g2,mj2" */
  container: string;
  durationSeconds: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  /** Pixel format of the video stream, e.g. "yuv420p" (players reject others). */
  pixFmt?: string;
  raw: FfprobeJson;
}

export function runProbe(filePath: string): Promise<FfprobeJson> {
  return new Promise((resolve, reject) => {
    const args = [
      '-v', 'error',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath,
    ];
    const child = spawn(config.ffprobePath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe exited ${code}: ${stderr.trim().slice(0, 500)}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (err) {
        reject(new Error(`ffprobe JSON parse failed: ${(err as Error).message}`));
      }
    });
  });
}

function parseFrameRate(rateStr: unknown): number | null {
  if (typeof rateStr !== 'string' || !rateStr) return null;
  const parts = rateStr.split('/');
  if (parts.length === 2) {
    const num = parseFloat(parts[0]);
    const den = parseFloat(parts[1]);
    if (Number.isFinite(num) && Number.isFinite(den) && den !== 0) {
      return Math.round((num / den) * 100) / 100;
    }
  }
  const parsed = parseFloat(rateStr);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function probeFile(filePath: string): Promise<ProbeInfo> {
  const raw = await runProbe(filePath);
  const video = (raw.streams ?? []).find((s) => s.codec_type === 'video') ?? null;
  const audio = (raw.streams ?? []).find((s) => s.codec_type === 'audio') ?? null;
  const duration = raw.format?.duration !== undefined ? parseFloat(raw.format.duration) : null;
  return {
    container: typeof raw.format?.format_name === 'string' ? raw.format.format_name : '',
    durationSeconds: duration !== null && Number.isFinite(duration) ? duration : null,
    videoCodec: video?.codec_name ?? null,
    audioCodec: audio?.codec_name ?? null,
    width: video?.width ?? null,
    height: video?.height ?? null,
    fps: video ? parseFrameRate(video.r_frame_rate) : null,
    pixFmt: typeof video?.pix_fmt === 'string' ? video.pix_fmt : undefined,
    raw,
  };
}

export interface VerifyOptions {
  /** Expected timeline duration in seconds (trimmed timeline, not source). */
  durationSeconds: number;
  width: number;
  height: number;
  /** Require an AAC audio stream (projects with audio tracks). */
  requireAudio?: boolean;
  /** Expected frame rate (delivery spec). Checked when the probe reports one. */
  fps?: number;
  /** Expected pixel format (delivery spec). Checked when the probe reports one. */
  pixFmt?: string;
}

export interface VerifyResult {
  ok: boolean;
  error?: string;
}

const DURATION_TOLERANCE_SECONDS = 0.5;
const FPS_TOLERANCE = 0.5;
/** Players (and Safari in particular) refuse 10-bit / non-4:2:0 sources. */
const REQUIRED_PIXEL_FORMAT = 'yuv420p';

/**
 * Verify a rendered file against the delivery spec BEFORE it is accepted.
 * Any mismatch fails the job — we never mark a job 'done' on a bad render.
 */
export function verifyDelivery(probe: ProbeInfo, options: VerifyOptions): VerifyResult {
  const failures: string[] = [];

  if (!probe.container.includes('mp4')) {
    failures.push(`container is "${probe.container || 'unknown'}", expected mp4`);
  }
  if (probe.videoCodec !== 'h264') {
    failures.push(`video codec is "${probe.videoCodec ?? 'none'}", expected h264`);
  }
  if (probe.width !== options.width || probe.height !== options.height) {
    failures.push(
      `dimensions are ${probe.width ?? '?'}x${probe.height ?? '?'}, expected ${options.width}x${options.height}`,
    );
  }
  if (probe.durationSeconds === null) {
    failures.push('could not determine duration');
  } else if (Math.abs(probe.durationSeconds - options.durationSeconds) > DURATION_TOLERANCE_SECONDS) {
    failures.push(
      `duration ${probe.durationSeconds.toFixed(3)}s is not within ${DURATION_TOLERANCE_SECONDS}s of expected ${options.durationSeconds.toFixed(3)}s`,
    );
  }
  if (options.fps !== undefined && probe.fps !== null) {
    if (Math.abs(probe.fps - options.fps) > FPS_TOLERANCE) {
      failures.push(`frame rate is ${probe.fps}, expected ${options.fps} (delivery spec)`);
    }
  }
  const requiredPixFmt = options.pixFmt ?? REQUIRED_PIXEL_FORMAT;
  if (probe.pixFmt !== undefined && probe.pixFmt !== requiredPixFmt) {
    failures.push(`pixel format is "${probe.pixFmt}", expected ${requiredPixFmt}`);
  }
  if (options.requireAudio && probe.audioCodec !== 'aac') {
    failures.push(`audio codec is "${probe.audioCodec ?? 'none'}", expected aac`);
  }

  if (failures.length > 0) {
    return { ok: false, error: `Render verification failed: ${failures.join('; ')}` };
  }
  return { ok: true };
}
