/**
 * SubwayTakes Studio — versioned project JSON format.
 *
 * This is the single source of truth shared by:
 * - the timeline editor UI (src/pages/studio, src/components/studio)
 * - the Remotion composition used for preview (@remotion/player)
 * - the Remotion composition used for server rendering (remotion/src)
 * - the render worker (render-worker)
 * - the Supabase table `studio_projects.project` (jsonb)
 *
 * RULES:
 * - `version` must be bumped on any breaking schema change.
 * - `parseProject(json)` validates untrusted JSON (from DB or URL props) and
 *   MUST be used before rendering.
 * - Time is stored in seconds (float) at the project level and converted to
 *   frames (30fps default) at render time.
 */

export const PROJECT_FORMAT_VERSION = 1;

export type StudioTrackKind = 'video' | 'narration' | 'music' | 'ambient' | 'subtitle';

export type ShotType =
  | 'host'
  | 'guest'
  | 'two_shot'
  | 'reaction'
  | 'environment';

export type BeatId =
  | 'opening_hook'
  | 'interviewer_intro'
  | 'guest_responds'
  | 'interviewer_challenges'
  | 'guest_expands'
  | 'reaction_moment'
  | 'closing_statement';

/** A single media item placed on a track. Times are in seconds on the timeline. */
export interface StudioClip {
  id: string;
  /** Asset URL (Supabase storage public URL or remote CDN). Empty = placeholder. */
  assetUrl: string;
  /** Asset kind: generated AI clip, user upload, or pure audio asset. */
  assetKind: 'generated' | 'uploaded' | 'audio';
  /** Which beat of the interview preset this clip belongs to (if any). */
  beatId?: BeatId;
  shotType?: ShotType;
  /** Timeline placement (seconds from timeline start). */
  start: number;
  /** In/out points inside the source asset (seconds). trimStart + (trimEnd-trimStart) = on-timeline length. */
  trimStart: number;
  trimEnd: number;
  /** Duration of the source asset (seconds), used for clamping trims. */
  sourceDuration?: number;
  /** Per-clip volume 0..1 (video clips also carry their embedded audio). */
  volume: number;
  /** Fade in/out applied to this clip, in seconds (0 = hard cut). */
  fadeIn: number;
  fadeOut: number;
  /** Display label in the editor. */
  label?: string;
  /** True when the asset is known to be a portrait 9:16 clip. */
  portrait?: boolean;
}

export interface StudioTrack {
  id: string;
  kind: StudioTrackKind;
  name: string;
  clips: StudioClip[];
  muted: boolean;
  /** Track-level volume 0..1 combined multiplicatively with clip volume. */
  volume: number;
  locked?: boolean;
}

export interface StudioCaption {
  id: string;
  text: string;
  /** Seconds on the master timeline. */
  start: number;
  end: number;
  /** 'dialogue' = normal caption, 'hook' = opening title card, 'lower_third' = name plate. */
  kind: 'dialogue' | 'hook' | 'lower_third';
  /** Optional speaker name for lower thirds. */
  speaker?: string;
}

export interface StudioBranding {
  handle: string;
  logoUrl?: string;
  watermarkText: string;
  watermarkPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  accentColor: string;
  showProgressBar: boolean;
}

export interface StudioScenePlanEntry {
  beatId: BeatId;
  shotType: ShotType;
  dialogue: string;
  speaker: 'host' | 'guest' | 'none';
  cameraDirection: string;
  prompt: string;
  /** Set when a generated clip exists for this beat. */
  clipId?: string;
}

export interface StudioProject {
  version: number;
  id: string;
  title: string;
  /** Master timeline duration in seconds (>= last clip end). */
  duration: number;
  fps: number;
  width: number;
  height: number;
  tracks: StudioTrack[];
  captions: StudioCaption[];
  branding: StudioBranding;
  /** The AI-generated 7-beat script, if any. */
  scenePlan: StudioScenePlanEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface StudioProjectRow {
  id: string;
  user_id: string;
  title: string;
  project: StudioProject;
  version: number;
  created_at: string;
  updated_at: string;
}

export type RenderJobStatus = 'queued' | 'running' | 'done' | 'error';

export interface StudioRenderJobRow {
  id: string;
  user_id: string;
  project_id: string;
  status: RenderJobStatus;
  progress: number;
  output_url: string | null;
  captioned_output_url: string | null;
  error: string | null;
  worker_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MuapiCaptionJobRow {
  id: string;
  user_id: string;
  project_id: string;
  render_job_id: string | null;
  mode: 'styled' | 'editable';
  muapi_request_id: string | null;
  language: string;
  theme: string;
  status: RenderJobStatus;
  output_url: string | null;
  captions: StudioCaption[] | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

export function createEmptyTrack(kind: StudioTrackKind, name: string, index: number): StudioTrack {
  return {
    id: `${kind}-${index}`,
    kind,
    name,
    clips: [],
    muted: kind === 'music' || kind === 'ambient',
    volume: kind === 'video' ? 1 : 0.6,
    locked: false,
  };
}

export function createDefaultBranding(): StudioBranding {
  return {
    handle: '@subwaytakes',
    watermarkText: '@subwaytakes',
    watermarkPosition: 'top-left',
    accentColor: '#F59E0B',
    showProgressBar: true,
  };
}

export function createEmptyProject(id: string, title = 'Untitled Subway Interview'): StudioProject {
  const now = new Date().toISOString();
  return {
    version: PROJECT_FORMAT_VERSION,
    id,
    title,
    duration: 0,
    fps: 30,
    width: 1080,
    height: 1920,
    tracks: [
      createEmptyTrack('video', 'Video', 0),
      createEmptyTrack('narration', 'Narration', 1),
      createEmptyTrack('music', 'Music', 2),
      createEmptyTrack('ambient', 'Ambient Sound', 3),
      createEmptyTrack('subtitle', 'Subtitles', 4),
    ],
    captions: [],
    branding: createDefaultBranding(),
    scenePlan: [],
    createdAt: now,
    updatedAt: now,
  };
}

// ---------------------------------------------------------------------------
// Validation / parsing (defends the renderer against untrusted JSON)
// ---------------------------------------------------------------------------

export interface ParseResult {
  ok: boolean
  project?: StudioProject;
  error?: string;
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function str(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

const TRACK_KINDS: StudioTrackKind[] = ['video', 'narration', 'music', 'ambient', 'subtitle'];
const BEAT_IDS: BeatId[] = [
  'opening_hook', 'interviewer_intro', 'guest_responds',
  'interviewer_challenges', 'guest_expands', 'reaction_moment', 'closing_statement',
];

function parseClip(raw: unknown): StudioClip | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const trimStart = Math.max(0, num(r.trimStart, 0));
  const trimEnd = Math.max(trimStart + 0.1, num(r.trimEnd, trimStart + 5));
  return {
    id: str(r.id, crypto.randomUUID()),
    assetUrl: str(r.assetUrl, ''),
    assetKind: (['generated', 'uploaded', 'audio'] as const).includes(r.assetKind as never)
      ? (r.assetKind as StudioClip['assetKind'])
      : 'generated',
    beatId: BEAT_IDS.includes(r.beatId as BeatId) ? (r.beatId as BeatId) : undefined,
    shotType: r.shotType as ShotType | undefined,
    start: Math.max(0, num(r.start, 0)),
    trimStart,
    trimEnd,
    sourceDuration: r.sourceDuration === undefined ? undefined : num(r.sourceDuration, trimEnd),
    volume: Math.min(1, Math.max(0, num(r.volume, 1))),
    fadeIn: Math.max(0, num(r.fadeIn, 0)),
    fadeOut: Math.max(0, num(r.fadeOut, 0)),
    label: r.label === undefined ? undefined : str(r.label, ''),
    portrait: r.portrait === undefined ? undefined : bool(r.portrait, false),
  };
}

/**
 * Parse and sanitize a project from untrusted JSON (DB row, URL props, file).
 * Returns a normalized project or a descriptive error — never throws.
 */
export function parseProject(input: unknown): ParseResult {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'Project payload is not an object' };
  }
  const r = input as Record<string, unknown>;
  const version = num(r.version, PROJECT_FORMAT_VERSION);
  if (version > PROJECT_FORMAT_VERSION) {
    return { ok: false, error: `Unsupported project version ${version} (max ${PROJECT_FORMAT_VERSION})` };
  }

  const rawTracks = Array.isArray(r.tracks) ? r.tracks : [];
  const tracks: StudioTrack[] = [];
  for (const [i, t] of rawTracks.entries()) {
    if (!t || typeof t !== 'object') continue;
    const tr = t as Record<string, unknown>;
    const kind = TRACK_KINDS.includes(tr.kind as StudioTrackKind)
      ? (tr.kind as StudioTrackKind)
      : null;
    if (!kind) continue;
    const clips = (Array.isArray(tr.clips) ? tr.clips : [])
      .map(parseClip)
      .filter((c): c is StudioClip => c !== null)
      .sort((a, b) => a.start - b.start);
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
      id: str(cr.id, crypto.randomUUID()),
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

  const scenePlan: StudioScenePlanEntry[] = [];
  for (const s of Array.isArray(r.scenePlan) ? r.scenePlan : []) {
    if (!s || typeof s !== 'object') continue;
    const sr = s as Record<string, unknown>;
    scenePlan.push({
      beatId: BEAT_IDS.includes(sr.beatId as BeatId) ? (sr.beatId as BeatId) : 'opening_hook',
      shotType: (sr.shotType as ShotType) || 'host',
      dialogue: str(sr.dialogue, ''),
      speaker: (['host', 'guest', 'none'] as const).includes(sr.speaker as never)
        ? (sr.speaker as StudioScenePlanEntry['speaker'])
        : 'none',
      cameraDirection: str(sr.cameraDirection, ''),
      prompt: str(sr.prompt, ''),
      clipId: sr.clipId === undefined ? undefined : str(sr.clipId, ''),
    });
  }

  const rawBranding = (r.branding && typeof r.branding === 'object' ? r.branding : {}) as Record<string, unknown>;
  const branding: StudioBranding = {
    handle: str(rawBranding.handle, '@subwaytakes'),
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

  let duration = num(r.duration, 0);
  for (const t of tracks) {
    for (const c of t.clips) {
      duration = Math.max(duration, c.start + (c.trimEnd - c.trimStart));
    }
  }

  const project: StudioProject = {
    version: PROJECT_FORMAT_VERSION,
    id: str(r.id, crypto.randomUUID()),
    title: str(r.title, 'Untitled Subway Interview'),
    duration,
    fps: Math.min(60, Math.max(12, num(r.fps, 30))),
    width: num(r.width, 1080),
    height: num(r.height, 1920),
    tracks,
    captions,
    branding,
    scenePlan,
    createdAt: str(r.createdAt, new Date().toISOString()),
    updatedAt: str(r.updatedAt, new Date().toISOString()),
  };

  return { ok: true, project };
}

/** On-timeline length of a clip in seconds. */
export function clipLength(clip: StudioClip): number {
  return Math.max(0, clip.trimEnd - clip.trimStart);
}

/** Last timeline position used by any clip, in seconds. */
export function projectContentDuration(project: StudioProject): number {
  let end = 0;
  for (const track of project.tracks) {
    for (const clip of track.clips) {
      end = Math.max(end, clip.start + clipLength(clip));
    }
  }
  return end;
}

/** Clamp all trims/starts so clips never overlap illegally and stay >= 0. */
export function sanitizeProject(project: StudioProject): StudioProject {
  const next: StudioProject = {
    ...project,
    tracks: project.tracks.map((track) => ({
      ...track,
      clips: [...track.clips]
        .map((clip) => ({
          ...clip,
          start: Math.max(0, clip.start),
          trimStart: Math.max(0, clip.trimStart),
          trimEnd: Math.max(clip.trimStart + 0.1, clip.trimEnd),
          volume: Math.min(1, Math.max(0, clip.volume)),
          fadeIn: Math.max(0, clip.fadeIn),
          fadeOut: Math.max(0, clip.fadeOut),
        }))
        .sort((a, b) => a.start - b.start),
    })),
  };
  next.duration = Math.max(next.duration, projectContentDuration(next));
  return next;
}
