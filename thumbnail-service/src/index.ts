import express, { Request, Response, NextFunction } from 'express';
import ffmpeg, { ScreenshotsConfig } from 'fluent-ffmpeg';
import axios from 'axios';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { spawn, execFileSync } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const API_KEY = process.env.API_KEY || '';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer({
  dest: '/tmp/uploads',
  limits: { fileSize: 500 * 1024 * 1024 }
});

const FFMPEG_PATH = process.env.FFMPEG_PATH || '/usr/bin/ffmpeg';
const FFPROBE_PATH = process.env.FFPROBE_PATH || '/usr/bin/ffprobe';

ffmpeg.setFfmpegPath(FFMPEG_PATH);
ffmpeg.setFfprobePath(FFPROBE_PATH);

const tempDirs = ['/tmp/uploads', '/tmp/outputs', '/tmp/thumbnails', '/tmp/downloads'];
tempDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Constants / temp-dir discipline
// ---------------------------------------------------------------------------

/** Delivery parameters every stitched/composed video is normalized to. */
const DELIVERY_WIDTH = 1080;
const DELIVERY_HEIGHT = 1920;
const DELIVERY_FPS = 30;
const TRANSITION_DEFAULT_SECONDS = 1;
const MAX_STITCH_INPUTS = 20;
/** Hard cap for downloaded sources (content-length + streaming guard). */
const MAX_DOWNLOAD_BYTES = 600 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 300000;

/**
 * Per-request temp directory. Every endpoint creates one, works inside it,
 * and removes it in a finally block — nothing can leak past a request.
 */
function makeWorkDir(kind: 'outputs' | 'thumbnails' | 'downloads'): string {
  const dir = path.join('/tmp', kind, uuidv4());
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupDir(dir: string | undefined): void {
  if (!dir) return;
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
}

function safeCleanup(...paths: (string | undefined)[]) {
  for (const p of paths) {
    if (p && fs.existsSync(p)) {
      try { fs.unlinkSync(p); } catch { /* best effort */ }
    }
  }
}

const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10);
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10);

const requestCounts = new Map<string, { count: number; resetAt: number }>();

function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = requestCounts.get(ip);

  if (!entry || now > entry.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    next();
    return;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    res.status(429).json({ error: 'Too many requests. Please try again later.' });
    return;
  }

  entry.count++;
  next();
}

function authenticate(req: Request, res: Response, next: NextFunction): void {
  if (!API_KEY) {
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  if (token !== API_KEY) {
    res.status(403).json({ error: 'Invalid API key' });
    return;
  }

  next();
}

app.use(rateLimiter);

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', service: 'thumbnail-service' });
});

app.use(authenticate);

interface ThumbnailOptions {
  width?: number;
  height?: number;
  timestamp?: string;
  emoji?: string;
  emojiPosition?: { x: number; y: number };
  emojiSize?: number;
  text?: string;
  textPosition?: { x: number; y: number };
  textFontSize?: number;
  textColor?: string;
  quality?: number;
}

interface WatermarkOptions {
  emoji?: string;
  text?: string;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  opacity?: number;
  size?: number;
}

/** A timed drawtext overlay for /compose-overlays. */
interface OverlaySpec {
  text?: string;
  emoji?: string;
  position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right' | 'center';
  /** Seconds on the master timeline; undefined = visible for the whole video. */
  startTime?: number;
  endTime?: number;
  fontSize?: number;
  color?: string;
  opacity?: number;
  /** Draw a semi-opaque box behind the text (drawtext box=1). */
  boxEnabled?: boolean;
  /** drawtext boxcolor, e.g. 'black@0.6'. */
  boxColor?: string;
  boxBorderWidth?: number;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Run the system ffmpeg binary directly (complex filter graphs). */
function runFfmpeg(args: string[], timeoutMs = 0): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(FFMPEG_PATH, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (d) => {
      stderr += d.toString();
      if (stderr.length > 20000) stderr = stderr.slice(-20000);
    });
    const timer = timeoutMs
      ? setTimeout(() => {
          child.kill('SIGKILL');
          reject(new Error(`ffmpeg timed out after ${timeoutMs}ms`));
        }, timeoutMs)
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

/** Probe a file with ffprobe (streams + format). */
interface ProbeStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
  display_aspect_ratio?: string;
  sample_rate?: string | number;
  channels?: number;
}

interface ProbeFormat {
  duration?: string;
  size?: number;
  bit_rate?: number;
  format_name?: string;
}

interface ProbeData {
  streams: ProbeStream[];
  format: ProbeFormat;
}

function probeMedia(file: string): Promise<ProbeData> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(file, (err, data) => {
      if (err) reject(err);
      else resolve(data as unknown as ProbeData);
    });
  });
}

/** Letterbox/pad filter to the delivery resolution. */
function deliveryScalePadFilter(): string {
  return [
    `scale=${DELIVERY_WIDTH}:${DELIVERY_HEIGHT}:force_original_aspect_ratio=decrease`,
    `pad=${DELIVERY_WIDTH}:${DELIVERY_HEIGHT}:(ow-iw)/2:(oh-ih)/2:black`,
    `fps=${DELIVERY_FPS}`,
    'format=yuv420p',
    'setsar=1',
  ].join(',');
}

/**
 * Validate a remote video URL before fetching it:
 * - https only
 * - no embedded credentials
 * - no localhost / private / link-local / metadata addresses
 * Returns the parsed URL; throws a descriptive Error otherwise.
 */
function assertSafeVideoUrl(videoUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(videoUrl);
  } catch {
    throw new Error('Invalid video URL');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('Only https:// video URLs are allowed');
  }
  if (parsed.username !== '' || parsed.password !== '') {
    throw new Error('URLs with embedded credentials are not allowed');
  }
  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '::1' ||
    host === '0.0.0.0' ||
    host === '169.254.169.254' ||
    host.endsWith('.internal') ||
    host.endsWith('.local') ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^0\./.test(host) ||
    /^fe80:/i.test(host) ||
    /^fc00:/i.test(host) ||
    /^fd/i.test(host)
  ) {
    throw new Error(`Blocked video URL host: ${host}`);
  }
  const private172 = /^172\.(\d{1,3})\./.exec(host);
  if (private172) {
    const second = parseInt(private172[1], 10);
    if (second >= 16 && second <= 31) {
      throw new Error(`Blocked video URL host: ${host}`);
    }
  }
  return parsed;
}

/**
 * Download a remote video into `destDir` with SSRF guards:
 * URL validation, 600MB size cap (content-length + streaming guard) and a
 * 300s timeout. The partial file is always removed on failure.
 */
async function downloadVideo(videoUrl: string, destDir: string): Promise<string> {
  const parsed = assertSafeVideoUrl(videoUrl);

  // Reject oversized files up front when the server tells us the size.
  try {
    const head = await axios.head(parsed.toString(), {
      timeout: 30000,
      maxRedirects: 5,
      validateStatus: (s) => s >= 200 && s < 300,
    });
    const declared = Number(head.headers['content-length'] ?? 0);
    if (declared > MAX_DOWNLOAD_BYTES) {
      throw new Error(
        `Video is too large (${Math.round(declared / 1024 / 1024)}MB > ${MAX_DOWNLOAD_BYTES / 1024 / 1024}MB limit)`,
      );
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('too large')) throw err;
    // HEAD not supported / blocked — fall through to the streaming guard.
  }

  const tempPath = path.join(destDir, `${uuidv4()}.mp4`);
  const response = await axios({
    method: 'GET',
    url: parsed.toString(),
    responseType: 'stream',
    timeout: DOWNLOAD_TIMEOUT_MS,
    maxRedirects: 5,
    maxContentLength: MAX_DOWNLOAD_BYTES,
    maxBodyLength: MAX_DOWNLOAD_BYTES,
  });

  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(tempPath);
    let settled = false;
    let received = 0;

    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      writer.destroy();
      try { fs.unlinkSync(tempPath); } catch { /* best effort */ }
      try { response.data.destroy(); } catch { /* best effort */ }
      reject(err);
    };

    response.data.on('data', (chunk: Buffer) => {
      received += chunk.length;
      if (received > MAX_DOWNLOAD_BYTES) {
        fail(new Error(`Video exceeds ${MAX_DOWNLOAD_BYTES / 1024 / 1024}MB download limit`));
      }
    });
    response.data.on('error', fail);
    writer.on('error', fail);
    writer.on('close', () => {
      if (!settled) {
        settled = true;
        resolve(tempPath);
      }
    });
    response.data.pipe(writer);
  });
}

/** Escape text for use inside an ffmpeg drawtext option value. */
function escapeDrawtext(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/%/g, '\\%')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\r?\n/g, ' ');
}

/**
 * Locate a DejaVu font for drawtext. Uses fc-list first (works on both
 * Debian and Alpine images), then well-known paths. Throws a clear error
 * when no font exists so callers can fail with an actionable 500.
 */
function findDejaVuFont(): string {
  try {
    const out = execFileSync('fc-list', [], { encoding: 'utf8', timeout: 5000 });
    for (const line of out.split('\n')) {
      if (/DejaVuSans-Bold\.ttf/i.test(line)) {
        const m = line.match(/(\/[^:]+\.ttf)/);
        if (m && fs.existsSync(m[1])) return m[1];
      }
    }
    for (const line of out.split('\n')) {
      if (/DejaVuSans\.ttf/i.test(line)) {
        const m = line.match(/(\/[^:]+\.ttf)/);
        if (m && fs.existsSync(m[1])) return m[1];
      }
    }
  } catch {
    /* fc-list missing or timed out — try known paths */
  }
  const candidates = [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/ttf-dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/ttf-dejavu/DejaVuSans.ttf',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error(
    'No DejaVu font available — install fontconfig + fonts-dejavu (Debian: fonts-dejavu-core, Alpine: ttf-dejavu)',
  );
}

function parseFrameRate(rateStr: string): number {
  if (!rateStr) return 0;
  const parts = rateStr.split('/');
  if (parts.length === 2) {
    const num = parseFloat(parts[0]);
    const den = parseFloat(parts[1]);
    if (!isNaN(num) && !isNaN(den) && den !== 0) {
      return Math.round((num / den) * 100) / 100;
    }
  }
  const parsed = parseFloat(rateStr);
  return isNaN(parsed) ? 0 : parsed;
}

function calculatePosition(
  videoWidth: number,
  videoHeight: number,
  position: string
): { x: number; y: number } {
  const margin = 50;
  switch (position) {
    case 'top-left':
      return { x: margin, y: margin };
    case 'top-right':
      return { x: videoWidth - margin, y: margin };
    case 'bottom-left':
      return { x: margin, y: videoHeight - margin };
    case 'bottom-right':
      return { x: videoWidth - margin, y: videoHeight - margin };
    case 'center':
    default:
      return { x: videoWidth / 2, y: videoHeight / 2 };
  }
}

// ---------------------------------------------------------------------------
// Stitching: real transitions (xfade) + safe concat
// ---------------------------------------------------------------------------

type StitchTransition = 'fade' | 'crossfade' | 'dissolve' | 'slide' | 'zoom' | 'blur' | 'none';

/** xfade transition names for each requested type (unsupported -> fade). */
function xfadeTransitionName(type: StitchTransition): 'fade' | 'fadeblack' {
  if (type === 'zoom') return 'fadeblack';
  // xfade has no slide/blur/dissolve transitions — fade is the closest.
  return 'fade';
}

function normalizeTransitionType(raw: unknown): StitchTransition {
  const allowed: StitchTransition[] = ['fade', 'crossfade', 'dissolve', 'slide', 'zoom', 'blur', 'none'];
  return allowed.includes(raw as StitchTransition) ? (raw as StitchTransition) : 'fade';
}

/** Re-encode a single input to identical params (xfade requires this). */
async function normalizeInputForStitch(input: string, out: string): Promise<void> {
  await runFfmpeg([
    '-y',
    '-i', input,
    '-vf', deliveryScalePadFilter(),
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-r', String(DELIVERY_FPS),
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '48000',
    '-ac', '2',
    out,
  ]);
}

/**
 * Concat with a real transition. Every input is first normalized to the
 * delivery params (same codec/fps/pix_fmt/timebase), then chained pairwise
 * with xfade (offsets = cumulative durations minus the transition length).
 * Inputs without audio are concatenated video-only.
 */
async function xfadeConcat(
  inputPaths: string[],
  output: string,
  transition: StitchTransition,
  durationSeconds: number,
  workDir: string,
): Promise<void> {
  const normalized: string[] = [];
  for (let i = 0; i < inputPaths.length; i++) {
    const out = path.join(workDir, `norm-${i}.mp4`);
    await normalizeInputForStitch(inputPaths[i], out);
    normalized.push(out);
  }

  if (normalized.length === 1) {
    await runFfmpeg([
      '-y', '-i', normalized[0],
      '-vf', deliveryScalePadFilter(),
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
      '-pix_fmt', 'yuv420p', '-r', String(DELIVERY_FPS),
      '-c:a', 'aac', '-b:a', '128k', '-ar', '48000',
      '-movflags', '+faststart', output,
    ]);
    return;
  }

  const probes = await Promise.all(normalized.map((p) => probeMedia(p)));
  const durations = probes.map((p) => parseFloat(p.format?.duration ?? '0') || 0);
  const minDuration = Math.min(...durations);
  if (minDuration < 0.2) {
    throw new Error('Video input shorter than 0.2s — cannot apply transition');
  }
  // Never schedule a transition longer than half of the shortest clip.
  const t = Math.max(0.1, Math.min(durationSeconds, minDuration / 2));
  const hasAudio = probes.every((p) => p.streams?.some((s) => s.codec_type === 'audio'));

  const filters: string[] = [];
  let offset = 0;
  let lastVideo = '[0:v]';
  let lastAudio = hasAudio ? '[0:a]' : '';
  for (let i = 1; i < normalized.length; i++) {
    offset += durations[i - 1] - t;
    const outV = i === normalized.length - 1 ? '[vout]' : `[vx${i}]`;
    filters.push(
      `${lastVideo}[${i}:v]xfade=transition=${xfadeTransitionName(transition)}:duration=${t}:offset=${offset.toFixed(3)}${outV}`,
    );
    lastVideo = outV;
    if (hasAudio) {
      const outA = i === normalized.length - 1 ? '[aout]' : `[ax${i}]`;
      filters.push(`${lastAudio}[${i}:a]acrossfade=d=${t}:c1=tri:c2=tri${outA}`);
      lastAudio = outA;
    }
  }

  const args: string[] = ['-y'];
  for (const p of normalized) args.push('-i', p);
  args.push('-filter_complex', filters.join(';'));
  args.push('-map', lastVideo);
  if (hasAudio) args.push('-map', lastAudio);
  args.push(
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
    '-pix_fmt', 'yuv420p', '-r', String(DELIVERY_FPS),
  );
  if (hasAudio) args.push('-c:a', 'aac', '-b:a', '128k', '-ar', '48000');
  args.push('-movflags', '+faststart', output);
  await runFfmpeg(args);
}

/**
 * Hard-cut concat via the concat demuxer — but ALWAYS re-encoded to the
 * delivery params. -c copy across mismatched inputs corrupts the output.
 */
async function concatReencode(inputPaths: string[], output: string, workDir: string): Promise<void> {
  const normalized: string[] = [];
  for (let i = 0; i < inputPaths.length; i++) {
    const out = path.join(workDir, `norm-${i}.mp4`);
    await normalizeInputForStitch(inputPaths[i], out);
    normalized.push(out);
  }

  if (normalized.length === 1) {
    await runFfmpeg([
      '-y', '-i', normalized[0],
      '-vf', deliveryScalePadFilter(),
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
      '-pix_fmt', 'yuv420p', '-r', String(DELIVERY_FPS),
      '-c:a', 'aac', '-b:a', '128k', '-ar', '48000',
      '-movflags', '+faststart', output,
    ]);
    return;
  }

  const listFile = path.join(workDir, 'concat.txt');
  fs.writeFileSync(listFile, normalized.map((p) => `file '${p}'`).join('\n'));
  await runFfmpeg([
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', listFile,
    '-vf', deliveryScalePadFilter(),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
    '-pix_fmt', 'yuv420p', '-r', String(DELIVERY_FPS),
    '-c:a', 'aac', '-b:a', '128k', '-ar', '48000',
    '-movflags', '+faststart',
    output,
  ]);
}

app.post('/generate-thumbnail', async (req: Request, res: Response): Promise<void> => {
  const { videoUrl, options } = req.body as { videoUrl: string; options?: ThumbnailOptions };

  if (!videoUrl) {
    res.status(400).json({ error: 'videoUrl is required' });
    return;
  }

  const thumbnailId = uuidv4();
  const workDir = makeWorkDir('thumbnails');
  const outputPath = path.join(workDir, `${thumbnailId}.jpg`);

  try {
    const inputPath = await downloadVideo(videoUrl, workDir);

    const width = options?.width || 1280;
    const height = options?.height || 720;
    const timestamp = options?.timestamp || '00:00:01';
    const quality = options?.quality || 2;
    // `quality` is a valid runtime screenshots option but is missing from the
    // installed @types/fluent-ffmpeg ScreenshotsConfig — assert to keep the
    // runtime behavior with a clean typecheck.
    const screenshotConfig = {
      timestamps: [timestamp],
      filename: `${thumbnailId}.jpg`,
      folder: workDir,
      size: `${width}x${height}`,
      quality,
    } as ScreenshotsConfig;

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .screenshots(screenshotConfig)
        .on('end', () => resolve())
        .on('error', reject);
    });

    if (options?.text) {
      const textPos = options.textPosition || { x: width / 2, y: height / 2 };
      const fontSize = options.textFontSize || 48;
      const textColor = options.textColor || 'white';
      const fontFile = findDejaVuFont();

      const overlayOutput = path.join(workDir, `${thumbnailId}_overlay.jpg`);
      await new Promise<void>((resolve, reject) => {
        ffmpeg(outputPath)
          .videoFilters(
            `drawtext=text='${escapeDrawtext(options.text!)}':x=${textPos.x}:y=${textPos.y}:fontsize=${fontSize}:fontcolor=${textColor}:fontfile=${fontFile}:box=1:boxcolor=black@0.5:boxborderw=8`
          )
          .outputOptions(['-y'])
          .output(overlayOutput)
          .on('end', () => resolve())
          .on('error', reject)
          .run();
      });

      if (fs.existsSync(overlayOutput)) {
        fs.renameSync(overlayOutput, outputPath);
      }
    }

    const thumbnailBuffer = fs.readFileSync(outputPath);
    const base64Thumbnail = thumbnailBuffer.toString('base64');

    res.json({
      success: true,
      thumbnail: `data:image/jpeg;base64,${base64Thumbnail}`,
      thumbnailId
    });
  } catch (error) {
    console.error('Error generating thumbnail:', error);
    res.status(500).json({ error: (error as Error).message || 'Failed to generate thumbnail' });
  } finally {
    cleanupDir(workDir);
  }
});

app.post('/extract-frame', async (req: Request, res: Response): Promise<void> => {
  const { videoUrl, timestamp, width, height, quality: frameQuality } = req.body as {
    videoUrl: string;
    timestamp: string;
    width?: number;
    height?: number;
    quality?: number;
  };

  if (!videoUrl || !timestamp) {
    res.status(400).json({ error: 'videoUrl and timestamp are required' });
    return;
  }

  const frameId = uuidv4();
  const workDir = makeWorkDir('thumbnails');
  const outputPath = path.join(workDir, `${frameId}.jpg`);

  try {
    const inputPath = await downloadVideo(videoUrl, workDir);

    const outputWidth = width || 1280;
    const outputHeight = height || 720;
    const quality = frameQuality || 2;
    const screenshotConfig = {
      timestamps: [timestamp],
      filename: `${frameId}.jpg`,
      folder: workDir,
      size: `${outputWidth}x${outputHeight}`,
      quality,
    } as ScreenshotsConfig;

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .screenshots(screenshotConfig)
        .on('end', () => resolve())
        .on('error', reject);
    });

    const frameBuffer = fs.readFileSync(outputPath);
    const base64Frame = frameBuffer.toString('base64');

    res.json({
      success: true,
      frame: `data:image/jpeg;base64,${base64Frame}`,
      frameId,
      timestamp
    });
  } catch (error) {
    console.error('Error extracting frame:', error);
    res.status(500).json({ error: (error as Error).message || 'Failed to extract frame' });
  } finally {
    cleanupDir(workDir);
  }
});

app.post('/add-watermark', upload.single('video'), async (req: Request, res: Response): Promise<void> => {
  const { emoji, text, position, opacity, size } = req.body as WatermarkOptions;
  const videoFile = req.file;

  if (!videoFile && !req.body.videoUrl) {
    res.status(400).json({ error: 'Video file or videoUrl is required' });
    return;
  }

  if (!emoji && !text) {
    res.status(400).json({ error: 'Either emoji or text watermark is required' });
    return;
  }

  const watermarkId = uuidv4();
  const workDir = makeWorkDir('outputs');
  const outputPath = path.join(workDir, `${watermarkId}.mp4`);
  let inputPath = videoFile?.path;

  try {
    if (req.body.videoUrl) {
      inputPath = await downloadVideo(req.body.videoUrl, workDir);
    }

    if (!inputPath) {
      res.status(500).json({ error: 'Could not process video input' });
      return;
    }

    const probeData = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      ffmpeg.ffprobe(inputPath!, (err, metadata) => {
        if (err) reject(err);
        else resolve({ width: metadata.streams[0].width || 1280, height: metadata.streams[0].height || 720 });
      });
    });

    const pos = calculatePosition(probeData.width, probeData.height, position || 'bottom-right');
    const watermarkOpacity = opacity || 0.8;
    const watermarkSize = size || 50;
    const fontFile = findDejaVuFont();

    let command = ffmpeg(inputPath);

    if (emoji) {
      command = command
        .videoFilters(
          `drawtext=text='${escapeDrawtext(emoji)}':x=${pos.x}:y=${pos.y}:fontsize=${watermarkSize}:fontcolor=white@${watermarkOpacity}:fontfile=${fontFile}`
        );
    }

    if (text) {
      command = command
        .videoFilters(
          `drawtext=text='${escapeDrawtext(text)}':x=${pos.x}:y=${pos.y + 60}:fontsize=${watermarkSize}:fontcolor=white@${watermarkOpacity}:fontfile=${fontFile}:box=1:boxcolor=black@0.3`
        );
    }

    await new Promise<void>((resolve, reject) => {
      command
        .outputOptions(['-c:a', 'copy', '-y'])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', reject)
        .run();
    });

    const videoBuffer = fs.readFileSync(outputPath);
    const base64Video = videoBuffer.toString('base64');

    res.json({
      success: true,
      video: `data:video/mp4;base64,${base64Video}`,
      watermarkId
    });
  } catch (error) {
    console.error('Error adding watermark:', error);
    res.status(500).json({ error: (error as Error).message || 'Failed to add watermark' });
  } finally {
    cleanupDir(workDir);
    // Multer uploads live in /tmp/uploads (outside workDir).
    safeCleanup(videoFile?.path);
  }
});

app.post('/stitch-videos', async (req: Request, res: Response): Promise<void> => {
  const { videoUrls, transitionType, transitionDuration } = req.body as {
    videoUrls: string[];
    transitionType?: StitchTransition;
    transitionDuration?: number;
  };

  if (!videoUrls || videoUrls.length === 0) {
    res.status(400).json({ error: 'videoUrls array is required' });
    return;
  }
  if (videoUrls.length > MAX_STITCH_INPUTS) {
    res.status(400).json({ error: `Too many videos (max ${MAX_STITCH_INPUTS})` });
    return;
  }

  const stitchId = uuidv4();
  const workDir = makeWorkDir('outputs');
  const outputPath = path.join(workDir, `${stitchId}.mp4`);

  try {
    // All downloads land inside the per-request workDir.
    const downloadedPaths: string[] = [];
    for (const url of videoUrls) {
      downloadedPaths.push(await downloadVideo(url, workDir));
    }

    // Real transitions: normalize every input to identical params, then
    // chain xfade pairwise with cumulative offsets. 'none' uses the concat
    // demuxer but still re-encodes (never -c copy on mismatched inputs).
    const transition = normalizeTransitionType(transitionType);
    const duration = Math.max(0.1, Math.min(10, Number(transitionDuration) || TRANSITION_DEFAULT_SECONDS));

    if (transition === 'none') {
      await concatReencode(downloadedPaths, outputPath, workDir);
    } else {
      await xfadeConcat(downloadedPaths, outputPath, transition, duration, workDir);
    }

    const videoBuffer = fs.readFileSync(outputPath);
    const base64Video = videoBuffer.toString('base64');

    res.json({
      success: true,
      video: `data:video/mp4;base64,${base64Video}`,
      stitchId,
      videoCount: videoUrls.length,
      transitionType: transition,
      transitionDuration: transition === 'none' ? 0 : duration
    });
  } catch (error) {
    console.error('Error stitching videos:', error);
    res.status(500).json({ error: (error as Error).message || 'Failed to stitch videos' });
  } finally {
    cleanupDir(workDir);
  }
});

app.post('/compose-overlays', async (req: Request, res: Response): Promise<void> => {
  const { videoUrl, overlays } = req.body as {
    videoUrl: string;
    overlays?: OverlaySpec[];
  };

  if (!videoUrl || !overlays || !Array.isArray(overlays) || overlays.length === 0) {
    res.status(400).json({ error: 'videoUrl and a non-empty overlays array are required' });
    return;
  }
  if (overlays.length > 20) {
    res.status(400).json({ error: 'Too many overlays (max 20)' });
    return;
  }

  const composeId = uuidv4();
  const workDir = makeWorkDir('outputs');
  const outputPath = path.join(workDir, `${composeId}.mp4`);

  try {
    const inputPath = await downloadVideo(videoUrl, workDir);
    const fontFile = findDejaVuFont();

    const filters: string[] = [];
    for (const [i, overlay] of overlays.entries()) {
      const text = typeof overlay.text === 'string' && overlay.text !== ''
        ? overlay.text
        : typeof overlay.emoji === 'string' ? overlay.emoji : '';
      if (!text) {
        res.status(400).json({ error: `overlay ${i} needs text or emoji` });
        return;
      }
      const fontSize = Math.max(8, Math.min(400, Number(overlay.fontSize) || 48));
      const color = typeof overlay.color === 'string' && overlay.color !== '' ? overlay.color : 'white';
      const opacity = overlay.opacity === undefined ? 1 : Math.max(0, Math.min(1, Number(overlay.opacity)));
      const startTime = overlay.startTime === undefined ? 0 : Number(overlay.startTime);
      const endTime = overlay.endTime === undefined ? undefined : Number(overlay.endTime);

      const margin = 50;
      let posExpr: string;
      switch (overlay.position) {
        case 'top-left':
          posExpr = `x=${margin}:y=${margin}`;
          break;
        case 'top-center':
          posExpr = `x=(w-text_w)/2:y=${margin}`;
          break;
        case 'top-right':
          posExpr = `x=w-text_w-${margin}:y=${margin}`;
          break;
        case 'bottom-left':
          posExpr = `x=${margin}:y=h-text_h-${margin}`;
          break;
        case 'bottom-center':
          posExpr = `x=(w-text_w)/2:y=h-text_h-${margin}`;
          break;
        case 'bottom-right':
          posExpr = `x=w-text_w-${margin}:y=h-text_h-${margin}`;
          break;
        case 'center':
        default:
          posExpr = 'x=(w-text_w)/2:y=(h-text_h)/2';
          break;
      }

      // Timed overlays: only visible between startTime and endTime (seconds).
      let enableExpr = '';
      if (endTime !== undefined && Number.isFinite(endTime)) {
        enableExpr = `:enable='between(t,${Math.max(0, startTime)},${endTime})'`;
      } else if (Number.isFinite(startTime) && startTime > 0) {
        enableExpr = `:enable='gte(t,${startTime})'`;
      }

      // Optional background box behind the text (drawtext box=1).
      let boxExpr = '';
      if (overlay.boxEnabled) {
        const boxColor = typeof overlay.boxColor === 'string' && overlay.boxColor !== ''
          ? overlay.boxColor
          : 'black@0.6';
        const boxBorderWidth = Math.max(0, Math.min(200, Number(overlay.boxBorderWidth) || 24));
        boxExpr = `:box=1:boxcolor=${boxColor}:boxborderw=${boxBorderWidth}`;
      }

      filters.push(
        `drawtext=text='${escapeDrawtext(text)}':fontfile=${fontFile}:fontsize=${fontSize}:fontcolor=${color}@${opacity}:${posExpr}${boxExpr}${enableExpr}`,
      );
    }

    await runFfmpeg([
      '-y',
      '-i', inputPath,
      '-vf', filters.join(','),
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '20',
      '-pix_fmt', 'yuv420p',
      '-r', String(DELIVERY_FPS),
      '-c:a', 'aac',
      '-b:a', '128k',
      '-ar', '48000',
      '-movflags', '+faststart',
      outputPath,
    ]);

    const videoBuffer = fs.readFileSync(outputPath);
    const base64Video = videoBuffer.toString('base64');

    res.json({
      success: true,
      video: `data:video/mp4;base64,${base64Video}`,
      composeId,
      overlayCount: overlays.length
    });
  } catch (error) {
    console.error('Error composing overlays:', error);
    const message = (error as Error).message || 'Failed to compose overlays';
    // Font problems are an operator issue — say so explicitly.
    res.status(500).json({ error: message });
  } finally {
    cleanupDir(workDir);
  }
});

app.post('/add-captions', async (req: Request, res: Response): Promise<void> => {
  const { videoUrl, captionText, captionStyle } = req.body as {
    videoUrl: string;
    captionText: string;
    captionStyle?: {
      fontSize?: number;
      fontColor?: string;
      position?: 'top' | 'bottom' | 'center';
      backgroundColor?: string;
    };
  };

  if (!videoUrl || !captionText) {
    res.status(400).json({ error: 'videoUrl and captionText are required' });
    return;
  }

  const captionId = uuidv4();
  const workDir = makeWorkDir('outputs');
  const outputPath = path.join(workDir, `${captionId}.mp4`);

  try {
    const inputPath = await downloadVideo(videoUrl, workDir);

    const fontSize = captionStyle?.fontSize || 48;
    const fontColor = captionStyle?.fontColor || 'white';
    const bgColor = captionStyle?.backgroundColor || 'black@0.5';
    const fontFile = findDejaVuFont();

    let yPosition = '(h-text_h)/2';
    if (captionStyle?.position === 'top') {
      yPosition = '50';
    } else if (captionStyle?.position === 'bottom') {
      yPosition = 'h-text_h-50';
    }

    const drawtext = `drawtext=text='${escapeDrawtext(captionText)}':fontfile=${fontFile}:fontsize=${fontSize}:fontcolor=${fontColor}:x=(w-text_w)/2:y=${yPosition}:box=1:boxcolor=${escapeDrawtext(bgColor)}:boxborderw=10`;

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .videoFilters(drawtext)
        .outputOptions(['-c:a', 'copy', '-y'])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', reject)
        .run();
    });

    const videoBuffer = fs.readFileSync(outputPath);
    const base64Video = videoBuffer.toString('base64');

    res.json({
      success: true,
      video: `data:video/mp4;base64,${base64Video}`,
      captionId
    });
  } catch (error) {
    console.error('Error adding captions:', error);
    res.status(500).json({ error: (error as Error).message || 'Failed to add captions' });
  } finally {
    cleanupDir(workDir);
  }
});

app.post('/convert-video', async (req: Request, res: Response): Promise<void> => {
  const { videoUrl, format, quality } = req.body as {
    videoUrl: string;
    format: 'mp4' | 'webm' | 'mov' | 'avi';
    quality?: 'low' | 'medium' | 'high';
  };

  if (!videoUrl || !format) {
    res.status(400).json({ error: 'videoUrl and format are required' });
    return;
  }

  const convertId = uuidv4();
  const workDir = makeWorkDir('outputs');
  const outputPath = path.join(workDir, `${convertId}.${format}`);

  try {
    const inputPath = await downloadVideo(videoUrl, workDir);

    const crf = quality === 'low' ? '28' : quality === 'high' ? '18' : '23';

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath!)
        .outputOptions(['-crf', crf, '-y'])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', reject)
        .run();
    });

    const videoBuffer = fs.readFileSync(outputPath);
    const base64Video = videoBuffer.toString('base64');

    res.json({
      success: true,
      video: `data:video/${format};base64,${base64Video}`,
      convertId,
      format
    });
  } catch (error) {
    console.error('Error converting video:', error);
    res.status(500).json({ error: (error as Error).message || 'Failed to convert video' });
  } finally {
    cleanupDir(workDir);
  }
});

app.post('/trim-video', async (req: Request, res: Response): Promise<void> => {
  const { videoUrl, startTime, endTime } = req.body as {
    videoUrl: string;
    startTime: string;
    endTime: string;
  };

  if (!videoUrl || !startTime || !endTime) {
    res.status(400).json({ error: 'videoUrl, startTime, and endTime are required' });
    return;
  }

  const trimId = uuidv4();
  const workDir = makeWorkDir('outputs');
  const outputPath = path.join(workDir, `${trimId}.mp4`);

  try {
    const inputPath = await downloadVideo(videoUrl, workDir);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath!)
        .setStartTime(startTime)
        .setDuration(endTime)
        .outputOptions(['-c', 'copy', '-y'])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', reject)
        .run();
    });

    const videoBuffer = fs.readFileSync(outputPath);
    const base64Video = videoBuffer.toString('base64');

    res.json({
      success: true,
      video: `data:video/mp4;base64,${base64Video}`,
      trimId,
      startTime,
      endTime
    });
  } catch (error) {
    console.error('Error trimming video:', error);
    res.status(500).json({ error: (error as Error).message || 'Failed to trim video' });
  } finally {
    cleanupDir(workDir);
  }
});

app.post('/get-video-info', async (req: Request, res: Response): Promise<void> => {
  const { videoUrl } = req.body as { videoUrl: string };

  if (!videoUrl) {
    res.status(400).json({ error: 'videoUrl is required' });
    return;
  }

  const workDir = makeWorkDir('downloads');

  try {
    const inputPath = await downloadVideo(videoUrl, workDir);

    const metadata = await probeMedia(inputPath);

    const videoStream = metadata.streams.find((s) => s.codec_type === 'video');
    const audioStream = metadata.streams.find((s) => s.codec_type === 'audio');

    res.json({
      success: true,
      info: {
        duration: metadata.format.duration,
        size: metadata.format.size,
        bitrate: metadata.format.bit_rate,
        format: metadata.format.format_name,
        video: videoStream ? {
          codec: videoStream.codec_name,
          width: videoStream.width,
          height: videoStream.height,
          fps: parseFrameRate(videoStream.r_frame_rate ?? ''),
          aspectRatio: videoStream.display_aspect_ratio,
        } : null,
        audio: audioStream ? {
          codec: audioStream.codec_name,
          sampleRate: audioStream.sample_rate,
          channels: audioStream.channels,
        } : null,
      }
    });
  } catch (error) {
    console.error('Error getting video info:', error);
    res.status(500).json({ error: (error as Error).message || 'Failed to get video info' });
  } finally {
    cleanupDir(workDir);
  }
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Thumbnail service running on port ${PORT}`);
  console.log(`FFmpeg path: ${FFMPEG_PATH}`);
  console.log(`FFprobe path: ${FFPROBE_PATH}`);
  console.log(`Auth: ${API_KEY ? 'enabled' : 'disabled (no API_KEY set)'}`);
  console.log(`Rate limit: ${RATE_LIMIT_MAX} requests per ${RATE_LIMIT_WINDOW_MS / 1000}s`);
});

export default app;
