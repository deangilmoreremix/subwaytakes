import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { config } from './config';
import { probeFile, verifyDelivery, ProbeInfo } from './probe';
import { normalizeToDeliverySpec } from './ffmpeg';
import {
  RenderJobRow,
  fetchProjectOwner,
  fetchProjectSnapshot,
  heartbeatJob,
  markJobDone,
  markJobError,
  resolveMediaRef,
  resolveAssetUrl,
  updateJobProgress,
  uploadRender,
  createSignedRenderUrl,
  type MediaRefLike,
} from './storage';

/**
 * Render pipeline: claimed job -> validated snapshot -> Remotion render ->
 * probe verification -> ffmpeg normalize (encode gate) -> Storage upload +
 * signed URL -> job 'done'. Any failure marks the job 'error'.
 *
 * The snapshot validation below intentionally re-implements the structural
 * rules of src/studio/types.ts (`parseProject`) instead of importing them:
 * the worker is a separate deployable and the DB payload is untrusted.
 *
 * MEDIA: every clip ref is re-signed here, worker-side, with the service-role
 * client AFTER an ownership check against the project row's user_id (see
 * `resolveProjectMedia`). The resolved URLs only ever reach the Remotion props
 * file — they are never written back to the database.
 */

// ---------------------------------------------------------------------------
// Project schema (mirror of src/studio/types.ts — keep in sync)
// ---------------------------------------------------------------------------

export type StudioTrackKind = 'video' | 'narration' | 'music' | 'ambient' | 'subtitle';

export interface StudioClip {
  id: string;
  assetUrl: string;
  /** Canonical identity (bucket + path). Persist THIS; assetUrl is derived. */
  assetRef?: MediaRefLike;
  assetKind: 'generated' | 'uploaded' | 'audio';
  beatId?: string;
  shotType?: string;
  start: number;
  trimStart: number;
  trimEnd: number;
  sourceDuration?: number;
  volume: number;
  fadeIn: number;
  fadeOut: number;
  label?: string;
  portrait?: boolean;
}

export interface StudioTrack {
  id: string;
  kind: StudioTrackKind;
  name: string;
  clips: StudioClip[];
  muted: boolean;
  volume: number;
  locked?: boolean;
}

export interface StudioCaption {
  id: string;
  text: string;
  start: number;
  end: number;
  kind: 'dialogue' | 'hook' | 'lower_third';
  speaker?: string;
}

export interface StudioBranding {
  handle: string;
  /** Canonical identity of the logo asset (bucket + path). */
  logoRef?: MediaRefLike;
  logoUrl?: string;
  watermarkText: string;
  watermarkPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  accentColor: string;
  showProgressBar: boolean;
}

export interface StudioProject {
  version: number;
  id: string;
  title: string;
  duration: number;
  fps: number;
  width: number;
  height: number;
  tracks: StudioTrack[];
  captions: StudioCaption[];
  branding: StudioBranding;
  scenePlan: unknown[];
  createdAt: string;
  updatedAt: string;
}

export interface RenderSettings {
  width: number;
  height: number;
  fps: number;
}

const TRACK_KINDS: StudioTrackKind[] = ['video', 'narration', 'music', 'ambient', 'subtitle'];
const BEAT_IDS = [
  'opening_hook', 'interviewer_intro', 'guest_responds',
  'interviewer_challenges', 'guest_expands', 'reaction_moment', 'closing_statement',
];

// ---------------------------------------------------------------------------
// Validation (same structural rules as parseProject in src/studio/types.ts)
// ---------------------------------------------------------------------------

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}
function str(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback;
}
function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}
function randomId(): string {
  return randomUUID();
}

const MEDIA_REF_KINDS = ['video', 'audio', 'image'];

/** Accept only structurally valid refs (mirrors isMediaRef in mediaRefs.ts). */
function parseMediaRef(value: unknown): MediaRefLike | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const r = value as Record<string, unknown>;
  if (typeof r.bucket !== 'string' || r.bucket.length === 0) return undefined;
  if (typeof r.path !== 'string' || r.path.length === 0) return undefined;
  if (typeof r.kind !== 'string' || !MEDIA_REF_KINDS.includes(r.kind)) return undefined;
  return { bucket: r.bucket, path: r.path, kind: r.kind };
}

function isLoopbackHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '::1' ||
    h === '[::1]' ||
    h.startsWith('127.')
  );
}

/**
 * assetUrl must be fetchable by headless Chromium:
 * - https:// URLs (Supabase storage or any CDN) — always allowed;
 * - http:// only for loopback (local smoke tests);
 * - empty string = placeholder clip (allowed, renders a label card).
 */
function isValidAssetUrl(url: string): boolean {
  if (url === '') return true;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol === 'https:') return true;
  if (parsed.protocol === 'http:' && isLoopbackHost(parsed.hostname)) return true;
  return false;
}

export type ParseResult = { ok: true; project: StudioProject } | { ok: false; error: string };

export function validateProjectSnapshot(input: unknown): ParseResult {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'project_snapshot is not an object' };
  }
  const r = input as Record<string, unknown>;

  const version = num(r.version, 1);
  if (version > 1) {
    return { ok: false, error: `unsupported project version ${version} (max 1)` };
  }

  const rawTracks = Array.isArray(r.tracks) ? r.tracks : [];
  const tracks: StudioTrack[] = [];
  for (const [i, t] of rawTracks.entries()) {
    if (!t || typeof t !== 'object') continue;
    const tr = t as Record<string, unknown>;
    const kind = TRACK_KINDS.includes(tr.kind as StudioTrackKind) ? (tr.kind as StudioTrackKind) : null;
    if (!kind) continue;
    const rawClips = Array.isArray(tr.clips) ? tr.clips : [];
    const clips: StudioClip[] = [];
    for (const [j, raw] of rawClips.entries()) {
      if (!raw || typeof raw !== 'object') continue;
      const c = raw as Record<string, unknown>;
      const trimStart = Math.max(0, num(c.trimStart, 0));
      const trimEnd = Math.max(trimStart + 0.1, num(c.trimEnd, trimStart + 5));
      const start = Math.max(0, num(c.start, 0));
      const assetUrl = str(c.assetUrl, '');
      if (!isValidAssetUrl(assetUrl)) {
        return {
          ok: false,
          error: `track ${i} clip ${j} has invalid assetUrl "${assetUrl}" (must be https, or http on loopback)`,
        };
      }
      const assetRef = parseMediaRef(c.assetRef);
      clips.push({
        id: str(c.id, randomId()),
        assetUrl,
        ...(assetRef ? { assetRef } : {}),
        assetKind: (['generated', 'uploaded', 'audio'] as const).includes(c.assetKind as never)
          ? (c.assetKind as StudioClip['assetKind'])
          : 'generated',
        beatId: BEAT_IDS.includes(c.beatId as never) ? str(c.beatId, '') : undefined,
        shotType: c.shotType === undefined ? undefined : str(c.shotType, ''),
        start,
        trimStart,
        trimEnd,
        sourceDuration: c.sourceDuration === undefined ? undefined : num(c.sourceDuration, trimEnd),
        volume: Math.min(1, Math.max(0, num(c.volume, 1))),
        fadeIn: Math.max(0, num(c.fadeIn, 0)),
        fadeOut: Math.max(0, num(c.fadeOut, 0)),
        label: c.label === undefined ? undefined : str(c.label, ''),
        portrait: c.portrait === undefined ? undefined : bool(c.portrait, false),
      });
    }
    clips.sort((a, b) => a.start - b.start);
    tracks.push({
      id: str(tr.id, `${kind}-${i}`),
      kind,
      name: str(tr.name, kind),
      clips,
      muted: bool(tr.muted, false),
      volume: Math.min(1, Math.max(0, num(tr.volume, 1))),
      locked: bool(tr.locked, false),
    });
  }

  const captions: StudioCaption[] = [];
  for (const c of Array.isArray(r.captions) ? r.captions : []) {
    if (!c || typeof c !== 'object') continue;
    const cr = c as Record<string, unknown>;
    const start = Math.max(0, num(cr.start, 0));
    captions.push({
      id: str(cr.id, randomId()),
      text: str(cr.text, ''),
      start,
      end: Math.max(start + 0.1, num(cr.end, start + 2)),
      kind: (['dialogue', 'hook', 'lower_third'] as const).includes(cr.kind as never)
        ? (cr.kind as StudioCaption['kind'])
        : 'dialogue',
      speaker: cr.speaker === undefined ? undefined : str(cr.speaker, ''),
    });
  }
  captions.sort((a, b) => a.start - b.start);

  const rawBranding = (r.branding && typeof r.branding === 'object' ? r.branding : {}) as Record<string, unknown>;
  if (rawBranding.watermarkText !== undefined && typeof rawBranding.watermarkText !== 'string') {
    return { ok: false, error: 'branding.watermarkText must be a string' };
  }
  const logoRef = parseMediaRef(rawBranding.logoRef);
  const branding: StudioBranding = {
    handle: str(rawBranding.handle, '@subwaytakes'),
    ...(logoRef ? { logoRef } : {}),
    logoUrl: rawBranding.logoUrl === undefined ? undefined : str(rawBranding.logoUrl, ''),
    watermarkText: str(rawBranding.watermarkText, str(rawBranding.handle, '@subwaytakes')),
    watermarkPosition: (['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).includes(
      rawBranding.watermarkPosition as never,
    )
      ? (rawBranding.watermarkPosition as StudioBranding['watermarkPosition'])
      : 'top-left',
    accentColor: str(rawBranding.accentColor, '#F59E0B'),
    showProgressBar: bool(rawBranding.showProgressBar, true),
  };

  const project: StudioProject = {
    version: 1,
    id: str(r.id, randomId()),
    title: str(r.title, 'Untitled Subway Interview'),
    duration: Math.max(0, num(r.duration, 0)),
    fps: Math.min(60, Math.max(12, num(r.fps, 30))),
    width: num(r.width, config.outputWidth),
    height: num(r.height, config.outputHeight),
    tracks,
    captions,
    branding,
    scenePlan: Array.isArray(r.scenePlan) ? r.scenePlan : [],
    createdAt: str(r.createdAt, new Date().toISOString()),
    updatedAt: str(r.updatedAt, new Date().toISOString()),
  };

  // duration must cover every clip + caption (mirrors parseProject)
  for (const t of tracks) {
    for (const c of t.clips) {
      project.duration = Math.max(project.duration, c.start + (c.trimEnd - c.trimStart));
    }
  }
  for (const c of captions) {
    project.duration = Math.max(project.duration, c.end);
  }

  // A render with no timeline content is a client bug — fail fast.
  if (project.duration <= 0) {
    return { ok: false, error: 'project timeline is empty (duration 0)' };
  }

  return { ok: true, project };
}

/** Master timeline duration in seconds (trimmed clips + captions). */
export function timelineDurationSeconds(project: StudioProject): number {
  return project.duration;
}

export function parseRenderSettings(raw: unknown): RenderSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    width: num(r.width, config.outputWidth),
    height: num(r.height, config.outputHeight),
    fps: Math.min(60, Math.max(12, num(r.fps, config.outputFps))),
  };
}

/** Does the project contain any audible audio clips (drives AAC verification)? */
export function hasAudioContent(project: StudioProject): boolean {
  return project.tracks.some(
    (t) => (t.kind === 'narration' || t.kind === 'music' || t.kind === 'ambient') && !t.muted
      && t.clips.some((c) => c.assetUrl !== '' || c.assetRef !== undefined),
  );
}

// ---------------------------------------------------------------------------
// Remotion render
// ---------------------------------------------------------------------------

function remotionBin(): string {
  const bin = path.join(config.repoRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'remotion.cmd' : 'remotion');
  if (!fs.existsSync(bin)) {
    throw new Error(`remotion CLI not found at ${bin} (check REPO_ROOT / repo npm install)`);
  }
  return bin;
}

export interface RenderProjectOptions {
  workDir: string;
  renderSettings?: RenderSettings;
  /**
   * Owner of the project row (queue path). Required whenever the snapshot
   * carries media refs: a ref is only signed when its path starts with this
   * user id.
   */
  ownerUserId?: string;
}

export interface RenderProjectResult {
  outputPath: string;
  probe: ProbeInfo;
  expectedDurationSeconds: number;
  width: number;
  height: number;
}

/**
 * Resolve every media identity of a project to a short-lived, fetchable URL
 * and return a COPY — the input project is never mutated.
 *
 * - `clip.assetRef` / `branding.logoRef` (canonical identity) is signed with
 *   the service-role client, but ONLY after the ownership check against
 *   `ownerUserId` (see resolveMediaRef). A ref without an owner is a hard
 *   error: private media must never be resolvable cross-user.
 * - a persisted `clip.assetUrl` is re-signed when it points at our own
 *   storage (again ownership-checked when an owner is known) and passed
 *   through when it is an external CDN URL.
 * - nothing is persisted: the returned URLs live in the props file only.
 */
export async function resolveProjectMedia(
  project: StudioProject,
  options: { ownerUserId?: string } = {},
): Promise<StudioProject> {
  const ownerUserId = options.ownerUserId;
  const signedProject: StudioProject = JSON.parse(JSON.stringify(project));

  for (const track of signedProject.tracks) {
    for (const clip of track.clips) {
      if (clip.assetRef) {
        clip.assetUrl = await resolveMediaRef(clip.assetRef, ownerUserId ?? '');
        continue;
      }
      if (clip.assetUrl) {
        clip.assetUrl = await resolveAssetUrl(clip.assetUrl, ownerUserId);
      }
    }
  }

  const branding = signedProject.branding;
  if (branding.logoRef) {
    branding.logoUrl = await resolveMediaRef(branding.logoRef, ownerUserId ?? '');
  } else if (branding.logoUrl) {
    branding.logoUrl = await resolveAssetUrl(branding.logoUrl, ownerUserId);
  }

  return signedProject;
}

/**
 * Core pipeline (no DB): validate -> props file -> remotion render ->
 * probe verify -> normalize to delivery spec. Returns the FINAL mp4 path.
 */
export async function renderProjectToFile(
  project: StudioProject,
  options: RenderProjectOptions,
): Promise<RenderProjectResult> {
  const { workDir } = options;
  const settings: RenderSettings = options.renderSettings ?? {
    width: config.outputWidth,
    height: config.outputHeight,
    fps: config.outputFps,
  };
  fs.mkdirSync(workDir, { recursive: true });

  // 1. Rewrite Supabase storage asset URLs / refs into short-lived signed URLs
  //    so headless Chromium can fetch private bucket objects. Worker-side
  //    only: these URLs never reach the database.
  const signedProject = await resolveProjectMedia(project, {
    ownerUserId: options.ownerUserId,
  });

  // 2. Props go through a FILE — never argv (payloads are tens of KB+).
  const propsPath = path.join(workDir, 'props.json');
  fs.writeFileSync(propsPath, JSON.stringify({ project: signedProject }));

  const rawOut = path.join(workDir, 'remotion-raw.mp4');
  const finalOut = path.join(workDir, 'final.mp4');

  // 3. Remotion render (local repo install, Chromium headless).
  const args = [
    'render',
    config.remotionEntry,
    'SubwayEditor',
    rawOut,
    `--props=${propsPath}`,
    '--codec=h264',
    '--pixel-format=yuv420p',
    `--concurrency=${config.remotionConcurrency}`,
    `--timeout=${config.renderTimeoutMs}`,
    '--log=info',
  ];
  await new Promise<void>((resolve, reject) => {
    const child = spawn(remotionBin(), args, { cwd: config.repoRoot });
    let stderr = '';
    child.stderr.on('data', (d) => {
      stderr += d.toString();
      if (stderr.length > 40000) stderr = stderr.slice(-40000);
    });
    child.stdout.on('data', () => { /* Remotion logs on stderr */ });
    // Hard kill a bit after Remotion's own --timeout so a hung render
    // cannot wedge the worker slot.
    const hardKill = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`remotion render exceeded hard timeout (${config.renderTimeoutMs}ms + slack)`));
    }, config.renderTimeoutMs + 120000);
    child.on('error', (err) => {
      clearTimeout(hardKill);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(hardKill);
      if (code === 0) resolve();
      else reject(new Error(`remotion render exited ${code}: ${stderr.trim().slice(-1500)}`));
    });
  });

  if (!fs.existsSync(rawOut)) {
    throw new Error('remotion render produced no output file');
  }

  // 4. Verify the RAW render before spending time on normalization.
  const expectedDurationSeconds = timelineDurationSeconds(signedProject);
  const rawProbe = await probeFile(rawOut);
  const rawVerify = verifyDelivery(rawProbe, {
    durationSeconds: expectedDurationSeconds,
    width: settings.width,
    height: settings.height,
    fps: settings.fps,
    requireAudio: false,
  });
  if (!rawVerify.ok) {
    throw new Error(rawVerify.error);
  }

  // 5. Encode gate: normalize to the exact delivery spec (always re-encodes
  //    once — see the comment on normalizeToDeliverySpec).
  await normalizeToDeliverySpec(rawOut, finalOut);

  // 6. Verify the FINAL file too, including the AAC audio requirement when
  //    the timeline actually contains audio.
  const finalProbe = await probeFile(finalOut);
  const finalVerify = verifyDelivery(finalProbe, {
    durationSeconds: expectedDurationSeconds,
    width: settings.width,
    height: settings.height,
    fps: settings.fps,
    requireAudio: hasAudioContent(signedProject),
  });
  if (!finalVerify.ok) {
    throw new Error(finalVerify.error);
  }

  return {
    outputPath: finalOut,
    probe: finalProbe,
    expectedDurationSeconds,
    width: settings.width,
    height: settings.height,
  };
}

// ---------------------------------------------------------------------------
// Job orchestration
// ---------------------------------------------------------------------------

export async function processRenderJob(job: RenderJobRow): Promise<void> {
  // All temp artifacts live under os.tmpdir() and are removed in finally.
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), `render-job-${job.id}-`));
  let heartbeat: NodeJS.Timeout | null = null;

  try {
    const rawSnapshot = job.project_snapshot ?? (await fetchProjectSnapshot(job.project_id));
    const parsed = validateProjectSnapshot(rawSnapshot);
    if (!parsed.ok) {
      throw new Error(`invalid project_snapshot: ${parsed.error}`);
    }

    await updateJobProgress(job.id, 5);

    // Owner of the media: read from the project ROW (never from the client).
    // Every clip ref is checked against it before it is signed.
    const ownerUserId = await resolveJobOwner(job);

    // Heartbeat: any progress update refreshes updated_at (DB trigger also
    // bumps it), but we bump explicitly every HEARTBEAT_INTERVAL_MS so long
    // ffmpeg/remotion phases cannot look stale to the reclaimer.
    heartbeat = setInterval(() => {
      heartbeatJob(job.id).catch((err) => {
        console.error(`[worker] heartbeat failed for job ${job.id}: ${err.message}`);
      });
    }, config.heartbeatIntervalMs);

    const settings = parseRenderSettings(job.render_settings);

    const result = await renderProjectToFile(parsed.project, {
      workDir,
      renderSettings: settings,
      ownerUserId,
    });
    await updateJobProgress(job.id, 85);

    // Upload: <user_id>/<project_id>/render-<job_id>.mp4 (private bucket).
    const storagePath = `${job.user_id}/${job.project_id}/render-${job.id}.mp4`;
    await uploadRender(storagePath, result.outputPath);

    // 7-day signed URL is what the app stores/uses.
    const signedUrl = await createSignedRenderUrl(storagePath);
    await markJobDone(job.id, signedUrl);

    console.log(
      `[worker] job ${job.id} done in ${result.probe.durationSeconds?.toFixed(2)}s -> ${storagePath}`,
    );
  } catch (err) {
    const message = (err as Error).message || String(err);
    console.error(`[worker] job ${job.id} failed: ${message}`);
    try {
      await markJobError(job.id, message);
    } catch (markErr) {
      console.error(`[worker] could not mark job ${job.id} as error: ${(markErr as Error).message}`);
    }
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    // Temp props/render/normalize files never outlive the job — on success AND
    // on every failure path (validation, ownership, remotion, probe, ffmpeg,
    // upload), because every artifact was written inside workDir.
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

/**
 * Media owner for a job. `studio_projects.user_id` is the authority; the job
 * row's own user_id is only a fallback for snapshot-only jobs whose project
 * row is gone (re-logged so it is visible in the worker logs).
 */
async function resolveJobOwner(job: RenderJobRow): Promise<string> {
  try {
    return await fetchProjectOwner(job.project_id);
  } catch (err) {
    const fallback = typeof job.user_id === 'string' ? job.user_id : '';
    if (!fallback) throw err;
    console.warn(
      `[worker] job ${job.id}: could not read the project owner (${(err as Error).message}); ` +
        `falling back to the job row user_id`,
    );
    return fallback;
  }
}
