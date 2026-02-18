import express, { Request, Response, NextFunction } from 'express';
import ffmpeg from 'fluent-ffmpeg';
import axios from 'axios';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
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

async function downloadVideo(videoUrl: string): Promise<string> {
  const tempPath = `/tmp/downloads/${uuidv4()}.mp4`;
  const downloadDir = path.dirname(tempPath);

  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  }

  const response = await axios({
    method: 'GET',
    url: videoUrl,
    responseType: 'stream',
    timeout: 300000
  });

  const writer = fs.createWriteStream(tempPath);
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', () => resolve(tempPath));
    writer.on('error', reject);
  });
}

function safeCleanup(...paths: (string | undefined)[]) {
  for (const p of paths) {
    if (p && fs.existsSync(p)) {
      try { fs.unlinkSync(p); } catch {}
    }
  }
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

app.post('/generate-thumbnail', async (req: Request, res: Response): Promise<void> => {
  const { videoUrl, options } = req.body as { videoUrl: string; options?: ThumbnailOptions };

  if (!videoUrl) {
    res.status(400).json({ error: 'videoUrl is required' });
    return;
  }

  const thumbnailId = uuidv4();
  const outputPath = `/tmp/thumbnails/${thumbnailId}.jpg`;
  let inputPath: string | undefined;

  try {
    inputPath = await downloadVideo(videoUrl);

    const width = options?.width || 1280;
    const height = options?.height || 720;
    const timestamp = options?.timestamp || '00:00:01';
    const quality = options?.quality || 2;

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath!)
        .screenshots({
          timestamps: [timestamp],
          filename: `${thumbnailId}.jpg`,
          folder: '/tmp/thumbnails',
          size: `${width}x${height}`,
          quality
        })
        .on('end', resolve)
        .on('error', reject);
    });

    if (options?.text) {
      const textPos = options.textPosition || { x: width / 2, y: height / 2 };
      const fontSize = options.textFontSize || 48;
      const textColor = options.textColor || 'white';

      const overlayOutput = `/tmp/thumbnails/${thumbnailId}_overlay.jpg`;
      await new Promise<void>((resolve, reject) => {
        ffmpeg(outputPath)
          .videoFilters(
            `drawtext=text='${options.text!.replace(/'/g, "\\'")}':x=${textPos.x}:y=${textPos.y}:fontsize=${fontSize}:fontcolor=${textColor}:fontfile=/usr/share/fonts/ttf-dejavu/DejaVuSans.ttf:box=1:boxcolor=black@0.5:boxborderw=8`
          )
          .outputOptions(['-y'])
          .output(overlayOutput)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });

      if (fs.existsSync(overlayOutput)) {
        fs.renameSync(overlayOutput, outputPath);
      }
    }

    const thumbnailBuffer = fs.readFileSync(outputPath);
    const base64Thumbnail = thumbnailBuffer.toString('base64');

    safeCleanup(inputPath, outputPath);

    res.json({
      success: true,
      thumbnail: `data:image/jpeg;base64,${base64Thumbnail}`,
      thumbnailId
    });
  } catch (error: any) {
    safeCleanup(inputPath, outputPath);
    console.error('Error generating thumbnail:', error);
    res.status(500).json({ error: error.message || 'Failed to generate thumbnail' });
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
  const outputPath = `/tmp/thumbnails/${frameId}.jpg`;
  let inputPath: string | undefined;

  try {
    inputPath = await downloadVideo(videoUrl);

    const outputWidth = width || 1280;
    const outputHeight = height || 720;
    const quality = frameQuality || 2;

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath!)
        .screenshots({
          timestamps: [timestamp],
          filename: `${frameId}.jpg`,
          folder: '/tmp/thumbnails',
          size: `${outputWidth}x${outputHeight}`,
          quality
        })
        .on('end', resolve)
        .on('error', reject);
    });

    const frameBuffer = fs.readFileSync(outputPath);
    const base64Frame = frameBuffer.toString('base64');

    safeCleanup(inputPath, outputPath);

    res.json({
      success: true,
      frame: `data:image/jpeg;base64,${base64Frame}`,
      frameId,
      timestamp
    });
  } catch (error: any) {
    safeCleanup(inputPath, outputPath);
    console.error('Error extracting frame:', error);
    res.status(500).json({ error: error.message || 'Failed to extract frame' });
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
  const outputPath = `/tmp/outputs/${watermarkId}.mp4`;
  let inputPath = videoFile?.path;

  try {
    if (req.body.videoUrl) {
      inputPath = await downloadVideo(req.body.videoUrl);
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

    let command = ffmpeg(inputPath);

    if (emoji) {
      command = command
        .videoFilters(
          `drawtext=text='${emoji}':x=${pos.x}:y=${pos.y}:fontsize=${watermarkSize}:fontcolor=white@${watermarkOpacity}:fontfile=/usr/share/fonts/ttf-dejavu/DejaVuSans.ttf`
        );
    }

    if (text) {
      command = command
        .videoFilters(
          `drawtext=text='${text.replace(/'/g, "\\'")}':x=${pos.x}:y=${pos.y + 60}:fontsize=${watermarkSize}:fontcolor=white@${watermarkOpacity}:fontfile=/usr/share/fonts/ttf-dejavu/DejaVuSans.ttf:box=1:boxcolor=black@0.3`
        );
    }

    await new Promise<void>((resolve, reject) => {
      command
        .outputOptions(['-c:a', 'copy', '-y'])
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    const videoBuffer = fs.readFileSync(outputPath);
    const base64Video = videoBuffer.toString('base64');

    safeCleanup(inputPath, outputPath);

    res.json({
      success: true,
      video: `data:video/mp4;base64,${base64Video}`,
      watermarkId
    });
  } catch (error: any) {
    safeCleanup(inputPath, outputPath);
    console.error('Error adding watermark:', error);
    res.status(500).json({ error: error.message || 'Failed to add watermark' });
  }
});

app.post('/stitch-videos', async (req: Request, res: Response): Promise<void> => {
  const { videoUrls, transitionType, transitionDuration } = req.body as {
    videoUrls: string[];
    transitionType?: 'fade' | 'crossfade' | 'none';
    transitionDuration?: number;
  };

  if (!videoUrls || videoUrls.length === 0) {
    res.status(400).json({ error: 'videoUrls array is required' });
    return;
  }

  const stitchId = uuidv4();
  const outputPath = `/tmp/outputs/${stitchId}.mp4`;
  const downloadedPaths: string[] = [];
  let concatFile: string | undefined;

  try {
    for (const url of videoUrls) {
      const dlPath = await downloadVideo(url);
      downloadedPaths.push(dlPath);
    }

    concatFile = `/tmp/${stitchId}_concat.txt`;
    const concatContent = downloadedPaths.map(p => `file '${p}'`).join('\n');
    fs.writeFileSync(concatFile, concatContent);

    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(concatFile!)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputOptions(['-c', 'copy', '-y'])
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    const videoBuffer = fs.readFileSync(outputPath);
    const base64Video = videoBuffer.toString('base64');

    safeCleanup(...downloadedPaths, concatFile, outputPath);

    res.json({
      success: true,
      video: `data:video/mp4;base64,${base64Video}`,
      stitchId,
      videoCount: videoUrls.length
    });
  } catch (error: any) {
    safeCleanup(...downloadedPaths, concatFile, outputPath);
    console.error('Error stitching videos:', error);
    res.status(500).json({ error: error.message || 'Failed to stitch videos' });
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
  const outputPath = `/tmp/outputs/${captionId}.mp4`;
  let inputPath: string | undefined;

  try {
    inputPath = await downloadVideo(videoUrl);

    const fontSize = captionStyle?.fontSize || 48;
    const fontColor = captionStyle?.fontColor || 'white';
    const bgColor = captionStyle?.backgroundColor || 'black@0.5';

    let yPosition = '(h-text_h)/2';
    if (captionStyle?.position === 'top') {
      yPosition = '50';
    } else if (captionStyle?.position === 'bottom') {
      yPosition = 'h-text_h-50';
    }

    const drawtext = `drawtext=text='${captionText.replace(/'/g, "\\'")}':fontfile=/usr/share/fonts/ttf-dejavu/DejaVuSans-Bold.ttf:fontsize=${fontSize}:fontcolor=${fontColor}:x=(w-text_w)/2:y=${yPosition}:box=1:boxcolor=${bgColor}:boxborderw=10`;

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath!)
        .videoFilters(drawtext)
        .outputOptions(['-c:a', 'copy', '-y'])
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    const videoBuffer = fs.readFileSync(outputPath);
    const base64Video = videoBuffer.toString('base64');

    safeCleanup(inputPath, outputPath);

    res.json({
      success: true,
      video: `data:video/mp4;base64,${base64Video}`,
      captionId
    });
  } catch (error: any) {
    safeCleanup(inputPath, outputPath);
    console.error('Error adding captions:', error);
    res.status(500).json({ error: error.message || 'Failed to add captions' });
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
  const outputPath = `/tmp/outputs/${convertId}.${format}`;
  let inputPath: string | undefined;

  try {
    inputPath = await downloadVideo(videoUrl);

    const crf = quality === 'low' ? '28' : quality === 'high' ? '18' : '23';

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath!)
        .outputOptions(['-crf', crf, '-y'])
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    const videoBuffer = fs.readFileSync(outputPath);
    const base64Video = videoBuffer.toString('base64');

    safeCleanup(inputPath, outputPath);

    res.json({
      success: true,
      video: `data:video/${format};base64,${base64Video}`,
      convertId,
      format
    });
  } catch (error: any) {
    safeCleanup(inputPath, outputPath);
    console.error('Error converting video:', error);
    res.status(500).json({ error: error.message || 'Failed to convert video' });
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
  const outputPath = `/tmp/outputs/${trimId}.mp4`;
  let inputPath: string | undefined;

  try {
    inputPath = await downloadVideo(videoUrl);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath!)
        .setStartTime(startTime)
        .setDuration(endTime)
        .outputOptions(['-c', 'copy', '-y'])
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    const videoBuffer = fs.readFileSync(outputPath);
    const base64Video = videoBuffer.toString('base64');

    safeCleanup(inputPath, outputPath);

    res.json({
      success: true,
      video: `data:video/mp4;base64,${base64Video}`,
      trimId,
      startTime,
      endTime
    });
  } catch (error: any) {
    safeCleanup(inputPath, outputPath);
    console.error('Error trimming video:', error);
    res.status(500).json({ error: error.message || 'Failed to trim video' });
  }
});

app.post('/get-video-info', async (req: Request, res: Response): Promise<void> => {
  const { videoUrl } = req.body as { videoUrl: string };

  if (!videoUrl) {
    res.status(400).json({ error: 'videoUrl is required' });
    return;
  }

  let inputPath: string | undefined;

  try {
    inputPath = await downloadVideo(videoUrl);

    const metadata = await new Promise<any>((resolve, reject) => {
      ffmpeg.ffprobe(inputPath!, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });

    const videoStream = metadata.streams.find((s: any) => s.codec_type === 'video');
    const audioStream = metadata.streams.find((s: any) => s.codec_type === 'audio');

    safeCleanup(inputPath);

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
          fps: parseFrameRate(videoStream.r_frame_rate),
          aspectRatio: videoStream.display_aspect_ratio,
        } : null,
        audio: audioStream ? {
          codec: audioStream.codec_name,
          sampleRate: audioStream.sample_rate,
          channels: audioStream.channels,
        } : null,
      }
    });
  } catch (error: any) {
    safeCleanup(inputPath);
    console.error('Error getting video info:', error);
    res.status(500).json({ error: error.message || 'Failed to get video info' });
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
