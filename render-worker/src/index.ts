import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import dotenv from 'dotenv';
import { config, supabaseConfigured, WORKER_VERSION } from './config';
import { validateProjectSnapshot, parseRenderSettings, renderProjectToFile } from './render';
import { queueDepth } from './storage';
import { startQueueLoop, stopQueueLoop, drainQueue, queueStatus, inFlightJobIds } from './queue';

dotenv.config();

const app = express();
app.use(express.json({ limit: '25mb' }));

const API_KEY = config.workerApiKey;

function authenticate(req: Request, res: Response, next: NextFunction): void {
  // Same convention as thumbnail-service: when WORKER_API_KEY is unset the
  // service runs open (acceptable only behind a private network).
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

function binaryVersion(bin: string, args: string[]): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.on('error', () => resolve('unavailable'));
    child.on('close', () => {
      const firstLine = out.split('\n').find((l) => l.trim() !== '') ?? '';
      resolve(firstLine.trim() || 'unknown');
    });
  });
}

/** Locate the Remotion Chromium binary (cache dir or system install). */
export function findChromiumBinary(): string | null {
  if (process.env.REMOTION_BROWSER_EXECUTABLE && fs.existsSync(process.env.REMOTION_BROWSER_EXECUTABLE)) {
    return process.env.REMOTION_BROWSER_EXECUTABLE;
  }
  const systemPaths = ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'];
  for (const p of systemPaths) {
    if (fs.existsSync(p)) return p;
  }
  const cacheDirs = [
    path.join(os.homedir(), '.cache', 'remotion'),
    path.join(config.repoRoot, 'node_modules', '.remotion'),
  ];
  for (const cacheDir of cacheDirs) {
  if (fs.existsSync(cacheDir)) {
    const entries = fs.readdirSync(cacheDir, { withFileTypes: true }).filter((e) => e.isDirectory());
    for (const entry of entries) {
      const dir = path.join(cacheDir, entry.name);
      const stack = [dir];
      while (stack.length > 0) {
        const current = stack.pop()!;
        let children: fs.Dirent[] = [];
        try {
          children = fs.readdirSync(current, { withFileTypes: true });
        } catch {
          continue;
        }
        for (const child of children) {
          const childPath = path.join(current, child.name);
          if (child.isDirectory()) stack.push(childPath);
          else if (child.name === 'chrome-headless-shell' || child.name === 'chrome') return childPath;
        }
      }
    }
  }
  }
  return null;
}

/**
 * `remotion browser ensure` — needs network on first boot (or a pre-baked
 * image; see render-worker/Dockerfile). Failure is non-fatal: /health
 * reports chromium presence and renders fail loudly if it is missing.
 */
export async function ensureChromium(): Promise<boolean> {
  const existing = findChromiumBinary();
  if (existing) {
    console.log(`[worker] chromium present: ${existing}`);
    return true;
  }
  const remotionBin = path.join(
    config.repoRoot,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'remotion.cmd' : 'remotion',
  );
  if (!fs.existsSync(remotionBin)) {
    console.warn('[worker] remotion CLI not found — skipping browser ensure');
    return false;
  }
  console.log('[worker] running `remotion browser ensure` (requires network on first boot)...');
  await new Promise<void>((resolve) => {
    const child = spawn(remotionBin, ['browser', 'ensure'], { cwd: config.repoRoot });
    child.stderr.on('data', (d) => process.stderr.write(d));
    child.on('error', () => resolve());
    child.on('close', (code) => {
      if (code !== 0) console.error(`[worker] remotion browser ensure exited ${code}`);
      resolve();
    });
  });
  return findChromiumBinary() !== null;
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

// /health is OPEN (no auth) so orchestrators can probe it.
app.get('/health', async (_req: Request, res: Response) => {
  const [ffmpegVersion, ffprobeVersion, depth] = await Promise.all([
    binaryVersion(config.ffmpegPath, ['-version']),
    binaryVersion(config.ffprobePath, ['-version']),
    queueDepth(),
  ]);
  res.json({
    status: 'healthy',
    service: 'render-worker',
    version: WORKER_VERSION,
    workerId: config.workerId,
    ffmpegVersion,
    ffprobeVersion,
    chromium: findChromiumBinary() !== null,
    queue: {
      queued: depth.queued,
      running: depth.running,
      inFlight: inFlightJobIds(),
      maxConcurrency: config.maxConcurrency,
      supabaseConfigured,
    },
  });
});

app.use(authenticate);

app.get('/status', (_req: Request, res: Response) => {
  res.json({
    service: 'render-worker',
    version: WORKER_VERSION,
    workerId: config.workerId,
    supabaseConfigured,
    config: {
      repoRoot: config.repoRoot,
      ffmpegPath: config.ffmpegPath,
      ffprobePath: config.ffprobePath,
      pollIntervalMs: config.pollIntervalMs,
      jobTimeoutMs: config.jobTimeoutMs,
      heartbeatIntervalMs: config.heartbeatIntervalMs,
      renderTimeoutMs: config.renderTimeoutMs,
      remotionConcurrency: config.remotionConcurrency,
      deliverySpec: {
        width: config.outputWidth,
        height: config.outputHeight,
        fps: config.outputFps,
        videoCodec: 'h264/libx264',
        audioCodec: 'aac 128k 48kHz',
      },
      storageBucket: config.storageBucket,
      signedUrlExpirySeconds: config.signedUrlExpirySeconds,
    },
    queue: queueStatus(),
  });
});

// Direct render (smoke tests / manual runs) — runs the pipeline WITHOUT the
// queue and without touching the DB.
app.post('/render', async (req: Request, res: Response): Promise<void> => {
  const { project } = req.body as { project?: unknown; output?: string };
  const parsed = validateProjectSnapshot(project);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'render-direct-'));
  try {
    const settings = parseRenderSettings((req.body as { renderSettings?: unknown }).renderSettings);
    const result = await renderProjectToFile(parsed.project, { workDir, renderSettings: settings });
    res.json({
      success: true,
      outputPath: result.outputPath,
      expectedDurationSeconds: result.expectedDurationSeconds,
      probe: result.probe,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message || 'render failed' });
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

const server = app.listen(config.port, () => {
  console.log(`Render worker running on port ${config.port}`);
  console.log(`Repo root: ${config.repoRoot}`);
  console.log(`FFmpeg: ${config.ffmpegPath} | FFprobe: ${config.ffprobePath}`);
  console.log(`Auth: ${API_KEY ? 'enabled (WORKER_API_KEY)' : 'disabled (no WORKER_API_KEY set)'}`);
  console.log(`Supabase: ${supabaseConfigured ? 'configured' : 'NOT configured — direct renders only'}`);
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[worker] port ${config.port} in use — another worker on this host?`);
  } else {
    console.error(`[worker] server error: ${err.message}`);
  }
  process.exit(1);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`[worker] ${signal} received — draining queue...`);
  stopQueueLoop();
  await drainQueue();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 30000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

void (async () => {
  await ensureChromium();
  startQueueLoop();
})();

export default app;
