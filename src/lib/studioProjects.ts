/**
 * SubwayTakes Studio — persistence + backend access.
 *
 * Tables (see supabase/migrations/20261011090000_studio_projects_and_render_jobs.sql):
 *   studio_projects     — versioned timeline JSON (RLS: own rows only)
 *   studio_render_jobs  — server render queue (enqueued through the edge fn)
 *   muapi_caption_jobs  — MuAPI AI Captions jobs (styled + editable)
 * Storage:
 *   videos          — shared bucket (Studio scenes/captions live under a
 *                     `<uid>/scenes|/captioned/…` prefix)
 *   studio-uploads  — private bucket, one folder per user + project
 *   studio-exports  — private bucket, render outputs under `<uid>/…`
 *
 * MEDIA MODEL (src/studio/mediaRefs.ts): clips persist a canonical `assetRef`
 * (bucket + path) next to `assetUrl`. `assetUrl` is SESSION state — a 1-hour
 * signed URL derived through the `media-sign` edge function (or an external
 * CDN URL, which is its own identity). Never persist a long-lived URL as the
 * identity of an asset.
 *
 * The timeline editor mapping lives here too (see the "Timeline editor
 * mapping" section at the bottom).
 */

import type {
  BeatId,
  StudioCaption,
  StudioProject,
  StudioRenderJobRow,
  StudioTrackKind,
} from '../studio/types';
import { PROJECT_FORMAT_VERSION, clipLength, parseProject } from '../studio/types';
import { INTERVIEW_BEATS } from '../studio/interviewPreset';
import { cueListForEditor } from './studioCaptions';
import { supabase } from './supabase';
import { callEdgeFunction } from './edgeFunctions';
import { getUserId } from './auth';
import type { TimelineAction, TimelineRow } from '@xzdarcy/timeline-engine';
import type { MediaRef, MediaKind } from '../studio/mediaRefs';
import {
  SIGNED_URL_TTL_SECONDS,
  isMediaRef,
  mediaRefFromStorageUrl,
} from '../studio/mediaRefs';
import { MediaUrlResolver, type MediaSigner } from './mediaAccess';

export const UPLOAD_BUCKET = 'studio-uploads';
/** Re-export of the canonical TTL: derived URLs live for 1 hour, never longer. */
export { SIGNED_URL_TTL_SECONDS };

const EPSILON = 0.005;

function authedUserId(action: string): string {
  try {
    return getUserId();
  } catch {
    throw new Error(`Not authenticated — sign in before you can ${action}`);
  }
}

export function describeError(error: unknown, fallback = 'Unexpected error'): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  const err = error as { message?: unknown; error_description?: unknown } | null;
  if (err && typeof err.message === 'string' && err.message) return err.message;
  if (err && typeof err.error_description === 'string' && err.error_description) return err.error_description;
  return fallback;
}

/** 401/404 and RLS misses must never leak project existence. */
export function isAccessDenied(error: unknown): boolean {
  const err = error as { status?: unknown; code?: unknown; message?: unknown } | null;
  if (!err) return false;
  if (err.status === 401 || err.status === 404) return true;
  if (err.code === 'PGRST301' || err.code === '42501') return true;
  const message = typeof err.message === 'string' ? err.message : '';
  return /401|403|404|not authenticated|JWT|row-level security/i.test(message);
}

export const ACCESS_DENIED_MESSAGE = 'Project not found or access denied';

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

/** Insert a new project row and return its id (row id === project.id). */
export async function createProject(project: StudioProject): Promise<string> {
  const user_id = authedUserId('create a project');
  const { data, error } = await supabase
    .from('studio_projects')
    .insert({
      id: project.id,
      user_id,
      title: project.title,
      project,
      version: PROJECT_FORMAT_VERSION,
    })
    .select('id')
    .single();

  if (error) throw new Error(describeError(error, 'Could not create project'));
  if (!data?.id) throw new Error('Could not create project: no id returned');
  return data.id as string;
}

/** Load + validate a project by id (RLS scoped). Throws on missing/denied. */
export async function loadProject(id: string): Promise<StudioProject> {
  if (id === 'new') throw new Error(ACCESS_DENIED_MESSAGE);
  const { data, error } = await supabase
    .from('studio_projects')
    .select('project')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(isAccessDenied(error) ? ACCESS_DENIED_MESSAGE : describeError(error));
  if (!data?.project) throw new Error(ACCESS_DENIED_MESSAGE);

  const parsed = parseProject(data.project);
  if (!parsed.ok || !parsed.project) {
    throw new Error(parsed.error ?? 'Project payload could not be parsed');
  }
  return parsed.project;
}

/**
 * Persist the project JSON + title.
 *
 * The payload is healed first (`recoverProjectRefs`): any clip that only has a
 * URL — legacy projects, freshly generated scenes, uploads — gains its
 * canonical ref, so what is persisted is identity, not a URL that expires.
 */
export async function saveProject(id: string, project: StudioProject): Promise<void> {
  const withRefs = recoverProjectRefs(project);
  const payload = { ...withRefs, updatedAt: new Date().toISOString() };
  const { error } = await supabase
    .from('studio_projects')
    .update({ project: payload, title: payload.title, updated_at: payload.updatedAt })
    .eq('id', id);

  if (error) {
    throw new Error(isAccessDenied(error) ? ACCESS_DENIED_MESSAGE : describeError(error));
  }
}

// ---------------------------------------------------------------------------
// Uploads
// ---------------------------------------------------------------------------

function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
  return cleaned || 'asset';
}

/** What an upload produces: the canonical ref plus a 1-hour session URL. */
export interface UploadedFootage {
  /** Canonical identity of the uploaded object (bucket + path). Persist THIS. */
  ref: MediaRef;
  /** Derived session URL for immediate playback (expires in 1 hour). */
  url: string;
  /** Object path inside the bucket (same as `ref.path`). */
  path: string;
}

/**
 * Upload footage to the private `studio-uploads` bucket and return BOTH the
 * canonical ref ({ bucket: 'studio-uploads', path, kind }) and a 1-hour
 * session URL. The ref is what gets persisted on the clip; the URL is derived
 * state that `media-sign` can always re-mint (see refreshProjectMedia).
 */
export async function uploadFootageRef(
  projectId: string,
  file: File,
  beatId?: BeatId,
): Promise<UploadedFootage> {
  const userId = authedUserId('upload footage');
  const kind: MediaKind = 'video';
  const path = `${userId}/${projectId}/${beatId ?? 'clip'}-${Date.now()}-${sanitizeFileName(file.name)}`;

  const { error: uploadError } = await supabase.storage
    .from(UPLOAD_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type || undefined });
  if (uploadError) throw new Error(describeError(uploadError, 'Upload failed'));

  const { data, error: signError } = await supabase.storage
    .from(UPLOAD_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (signError || !data?.signedUrl) {
    throw new Error(describeError(signError, 'Could not sign the uploaded asset URL'));
  }

  return { ref: { bucket: UPLOAD_BUCKET, path, kind }, url: data.signedUrl, path };
}

/**
 * Upload footage and return the session URL only.
 *
 * Kept for the existing upload panel; new call sites should use
 * `uploadFootageRef` so the clip can persist the canonical `assetRef` next to
 * the URL (the ref survives URL expiry, the URL does not).
 */
export async function uploadFootage(
  projectId: string,
  file: File,
  beatId?: BeatId,
): Promise<string> {
  const uploaded = await uploadFootageRef(projectId, file, beatId);
  return uploaded.url;
}

// ---------------------------------------------------------------------------
// Media URL resolution (refs are canonical, URLs are derived)
// ---------------------------------------------------------------------------

let sharedResolver: MediaUrlResolver | null = null;

/** Process-wide resolver used by the media helpers below (default signer). */
export function mediaResolver(signer?: MediaSigner): MediaUrlResolver {
  if (signer || !sharedResolver) {
    if (signer) return new MediaUrlResolver(signer);
    sharedResolver = new MediaUrlResolver();
  }
  return sharedResolver;
}

function kindForTrack(trackKind: StudioTrackKind): MediaKind {
  return trackKind === 'video' ? 'video' : 'audio';
}

/**
 * Heal a project that only has URLs (legacy records, or uploads that never
 * stored a ref): recover a canonical ref from every Supabase storage URL so
 * the asset can be re-signed after the persisted URL expires. External CDN
 * URLs are left untouched — they are their own identity.
 */
export function recoverProjectRefs(project: StudioProject): StudioProject {
  return {
    ...project,
    tracks: project.tracks.map((track) => ({
      ...track,
      clips: track.clips.map((clip) => {
        if (isMediaRef(clip.assetRef)) return clip;
        const recovered = clip.assetUrl
          ? mediaRefFromStorageUrl(clip.assetUrl, kindForTrack(track.kind))
          : null;
        return recovered ? { ...clip, assetRef: recovered } : clip;
      }),
    })),
    branding: isMediaRef(project.branding.logoRef) || !project.branding.logoUrl
      ? project.branding
      : {
          ...project.branding,
          logoRef: mediaRefFromStorageUrl(project.branding.logoUrl, 'image') ?? undefined,
        },
  };
}

/**
 * Replace the in-memory session URLs of a project with freshly signed ones.
 * `resolvedUrls` is keyed like `MediaUrlResolver.resolveProject`
 * (`clip.assetUrl || clip.assetRef.path`, plus `'branding.logo'`).
 */
export function applyResolvedMediaUrls(
  project: StudioProject,
  resolvedUrls: Map<string, string>,
): StudioProject {
  if (resolvedUrls.size === 0) return project;

  const urlFor = (clip: { assetUrl: string; assetRef?: MediaRef }): string | undefined =>
    resolvedUrls.get(clip.assetUrl || clip.assetRef?.path || '');

  let changed = false;
  const tracks = project.tracks.map((track) => ({
    ...track,
    clips: track.clips.map((clip) => {
      const fresh = urlFor(clip);
      if (!fresh || fresh === clip.assetUrl) return clip;
      changed = true;
      return { ...clip, assetUrl: fresh };
    }),
  }));

  const logoUrl = resolvedUrls.get('branding.logo');
  const branding = logoUrl && logoUrl !== project.branding.logoUrl
    ? { ...project.branding, logoUrl }
    : project.branding;
  if (branding !== project.branding) changed = true;

  return changed ? { ...project, tracks, branding } : project;
}

/**
 * Resolve every media URL of a project to a fresh session URL (and heal refs
 * for legacy URL-only records). Returns a new project — nothing is persisted
 * here; callers still save through `saveProject`.
 */
export async function refreshProjectMedia(
  project: StudioProject,
  resolver: MediaUrlResolver = mediaResolver(),
): Promise<StudioProject> {
  const healed = recoverProjectRefs(project);
  try {
    const resolvedUrls = await resolver.resolveProject(healed);
    return applyResolvedMediaUrls(healed, resolvedUrls);
  } catch {
    // Keep the last known URLs rather than blanking the timeline.
    return healed;
  }
}

// ---------------------------------------------------------------------------
// Render jobs
// ---------------------------------------------------------------------------

export interface RenderJobEnqueueResponse {
  job_id?: string | null;
  id?: string | null;
  status?: string | null;
  error?: string | null;
}

/** Enqueue a server-side render through the `render-project` edge function. */
export async function enqueueRender(projectId: string): Promise<string> {
  const response = await callEdgeFunction<RenderJobEnqueueResponse>('render-project', {
    project_id: projectId,
  });
  const jobId = response?.job_id ?? response?.id ?? null;
  if (!jobId) throw new Error(response?.error ?? 'Render worker did not return a job id');
  return jobId;
}

/** Latest render job for a project (used to re-attach to a running job). */
export async function loadLatestRenderJob(projectId: string): Promise<StudioRenderJobRow | null> {
  const { data, error } = await supabase
    .from('studio_render_jobs')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(describeError(error, 'Could not load render jobs'));
  return (data as StudioRenderJobRow | null) ?? null;
}

/** Render job row plus the ref columns the migration adds (canonical identity). */
export interface StudioRenderJobRowWithRefs extends StudioRenderJobRow {
  output_ref?: MediaRef | null;
  captioned_output_ref?: MediaRef | null;
}

/**
 * Sign one job output: prefer the canonical ref, recover one from a legacy
 * storage URL when the ref is missing, and pass external URLs through. On any
 * failure the last known URL is kept (never blank a finished job).
 */
export async function resolveJobMediaUrl(
  url: string | null | undefined,
  ref: MediaRef | null | undefined,
  kind: MediaKind,
  resolver: MediaUrlResolver = mediaResolver(),
): Promise<string | null> {
  if ((!url || url.length === 0) && !ref) return null;
  try {
    const resolved = await resolver.resolveAsset(url ?? undefined, ref ?? undefined, kind);
    return resolved.url || null;
  } catch {
    return url ?? null;
  }
}

export interface ResolvedRenderJobMedia {
  outputUrl: string | null;
  captionedOutputUrl: string | null;
}

/**
 * Map a render job's `output_ref` / `captioned_output_ref` columns to fresh
 * signed URLs. Consumers (`loadLatestRenderJob` / `watchRenderJob` readers,
 * the export + caption panels) get URLs that stay playable for an hour and can
 * always be re-derived — the row keeps both ref and last URL.
 */
export async function resolveRenderJobMedia(
  job: StudioRenderJobRowWithRefs | null | undefined,
  resolver: MediaUrlResolver = mediaResolver(),
): Promise<ResolvedRenderJobMedia> {
  if (!job) return { outputUrl: null, captionedOutputUrl: null };
  const [outputUrl, captionedOutputUrl] = await Promise.all([
    resolveJobMediaUrl(job.output_url, job.output_ref ?? null, 'video', resolver),
    resolveJobMediaUrl(job.captioned_output_url, job.captioned_output_ref ?? null, 'video', resolver),
  ]);
  return { outputUrl, captionedOutputUrl };
}

/** Same mapping for MuAPI caption jobs (styled output ref + last URL). */
export async function resolveCaptionJobMedia(
  job: { output_url?: string | null; output_ref?: MediaRef | null } | null | undefined,
  resolver: MediaUrlResolver = mediaResolver(),
): Promise<string | null> {
  if (!job) return null;
  return resolveJobMediaUrl(job.output_url, job.output_ref ?? null, 'video', resolver);
}

const RENDER_JOB_POLL_MS = 3000;

/**
 * Subscribe to a render job row (postgres_changes) and return an unsubscribe
 * function. The current row is fetched immediately and re-fetched every 3s:
 * the render worker lives outside the browser's realtime connection, and the
 * table may not be part of the realtime publication, so the poll is a safety
 * net that guarantees the UI advances.
 */
export function watchRenderJob(
  jobId: string,
  onChange: (job: StudioRenderJobRow) => void,
  options: { initial?: boolean; pollMs?: number } = {},
): () => void {
  let active = true;
  const pollMs = options.pollMs ?? RENDER_JOB_POLL_MS;

  const channel = supabase
    .channel(`studio-render-${jobId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'studio_render_jobs', filter: `id=eq.${jobId}` },
      (payload) => {
        const row = payload.new as StudioRenderJobRow | null;
        if (row) onChange(row);
      },
    )
    .subscribe();

  const fetchRow = async () => {
    try {
      const { data } = await supabase
        .from('studio_render_jobs')
        .select('*')
        .eq('id', jobId)
        .maybeSingle();
      if (active && data) onChange(data as StudioRenderJobRow);
    } catch {
      /* the realtime subscription still delivers updates */
    }
  };

  if (options.initial !== false) void fetchRow();
  const poll = pollMs > 0 ? window.setInterval(() => void fetchRow(), pollMs) : null;

  return () => {
    active = false;
    if (poll) window.clearInterval(poll);
    void supabase.removeChannel(channel);
  };
}

// ---------------------------------------------------------------------------
// Scene generation (MuAPI video models per beat)
// ---------------------------------------------------------------------------

export type SceneGenerationModel = 'veo3' | 'seedance' | 'kling';
export type SceneJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export const SCENE_MODELS: Array<{ id: SceneGenerationModel; label: string }> = [
  { id: 'veo3', label: 'Veo 3' },
  { id: 'seedance', label: 'Seedance' },
  { id: 'kling', label: 'Kling' },
];

export interface SceneSubmitResponse {
  request_id?: string | null;
  id?: string | null;
  clip_id?: string | null;
  status?: string | null;
  error?: string | null;
}

export interface SceneStatusResponse {
  status?: string | null;
  /** 1-hour signed URL for immediate playback (session state). */
  assetUrl?: string | null;
  /** Canonical identity of the stored clip — persist THIS. */
  assetRef?: MediaRef | null;
  output_url?: string | null;
  clipId?: string | null;
  clip_id?: string | null;
  error?: string | null;
}

export interface SceneJobState {
  status: SceneJobStatus;
  outputUrl: string | null;
  outputRef: MediaRef | null;
  clipId: string | null;
  error: string | null;
}

function normalizeSceneStatus(raw: string | null | undefined): SceneJobStatus {
  const value = (raw ?? '').toLowerCase();
  if (value === 'done' || value === 'completed' || value === 'succeeded' || value === 'success') {
    return 'completed';
  }
  if (value === 'failed' || value === 'error' || value === 'cancelled') return 'failed';
  if (value === 'queued' || value === 'pending' || value === 'submitted') return 'pending';
  return 'processing';
}

/** Submit a text-to-video generation for one beat. Returns the request id. */
export async function generateScene(
  projectId: string,
  beatId: BeatId,
  prompt: string,
  model: SceneGenerationModel,
): Promise<string> {
  const response = await callEdgeFunction<SceneSubmitResponse>('generate-scene', {
    project_id: projectId,
    beat_id: beatId,
    prompt,
    model,
  });
  const requestId = response?.request_id ?? response?.id ?? null;
  if (!requestId) throw new Error(response?.error ?? 'Video model did not return a request id');
  return requestId;
}

/**
 * Poll a beat's generation through the `scene-status` edge function. When the
 * job is done the server has stored the clip (canonical ref + 1-hour signed
 * URL) and wired it into the project row, and returns both.
 */
export async function pollSceneStatus(
  projectId: string,
  beatId: BeatId,
  requestId: string,
): Promise<SceneJobState> {
  const response = await callEdgeFunction<SceneStatusResponse>('scene-status', {
    project_id: projectId,
    beat_id: beatId,
    request_id: requestId,
  });
  return {
    status: normalizeSceneStatus(response?.status),
    outputUrl: response?.assetUrl ?? response?.output_url ?? null,
    outputRef: isMediaRef(response?.assetRef) ? (response?.assetRef as MediaRef) : null,
    clipId: response?.clipId ?? response?.clip_id ?? null,
    error: response?.error ?? null,
  };
}

// ---------------------------------------------------------------------------
// MuAPI captions
// ---------------------------------------------------------------------------

export type MuapiCaptionMode = 'styled' | 'editable';

export interface CaptionSubmitPayload {
  projectId: string;
  mode: MuapiCaptionMode;
  language: string;
  theme: string;
  /** Public(ly reachable) video/audio URL to transcribe or caption. */
  videoUrl: string;
  renderJobId?: string | null;
  /**
   * Optional: the server resolves this clip from the project and signs a
   * 1-hour URL from its canonical ref, so MuAPI never needs a public bucket.
   */
  clipId?: string | null;
}

export interface CaptionSubmitResponse {
  job_id?: string | null;
  id?: string | null;
  muapi_request_id?: string | null;
  status?: string | null;
  error?: string | null;
}

export interface CaptionStatusResponse {
  status?: string | null;
  output_url?: string | null;
  /** Canonical identity of the captioned output (bucket + path). */
  output_ref?: MediaRef | null;
  captions?: StudioCaption[] | null;
  error?: string | null;
}

export interface CaptionJobState {
  status: SceneJobStatus;
  outputUrl: string | null;
  outputRef: MediaRef | null;
  captions: StudioCaption[];
  error: string | null;
}

/** Submit a MuAPI caption job (transcribe for the editor, or burn styled captions). */
export async function captionSubmit(payload: CaptionSubmitPayload): Promise<string> {
  const response = await callEdgeFunction<CaptionSubmitResponse>('muapi-captions', {
    action: 'submit',
    project_id: payload.projectId,
    mode: payload.mode,
    language: payload.language,
    theme: payload.theme,
    video_url: payload.videoUrl,
    render_job_id: payload.renderJobId ?? null,
    ...(payload.clipId ? { clip_id: payload.clipId } : {}),
  });
  const jobId = response?.job_id ?? response?.id ?? null;
  if (!jobId) throw new Error(response?.error ?? 'Caption job did not return a job id');
  return jobId;
}

/** Poll a MuAPI caption job. */
export async function captionPoll(projectId: string, jobId: string): Promise<CaptionJobState> {
  const response = await callEdgeFunction<CaptionStatusResponse>('muapi-captions', {
    action: 'status',
    project_id: projectId,
    job_id: jobId,
  });
  return {
    status: normalizeSceneStatus(response?.status),
    outputUrl: response?.output_url ?? null,
    outputRef: isMediaRef(response?.output_ref) ? (response.output_ref as MediaRef) : null,
    captions: Array.isArray(response?.captions) ? (response.captions as StudioCaption[]) : [],
    error: response?.error ?? null,
  };
}

// ---------------------------------------------------------------------------
// Plan (AI interview script)
// ---------------------------------------------------------------------------

export interface InterviewPlanBeat {
  beatId?: BeatId;
  shotType?: string;
  dialogue?: string;
  speaker?: 'host' | 'guest' | 'none';
  cameraDirection?: string;
  /** The planner's text-to-video prompt for this beat. */
  videoPrompt?: string;
  prompt?: string;
  targetDuration?: number;
}

export interface InterviewPlan {
  title?: string;
  hookQuestion?: string;
  handle?: string;
  beats?: InterviewPlanBeat[];
}

export interface InterviewPlanResponse {
  plan?: InterviewPlan | null;
  error?: string;
  message?: string;
}

/**
 * Ask the planner edge function for the 7-beat script. The response is wrapped
 * as `{ plan: { title, hookQuestion, handle, beats[] } }`; the wrapper is
 * unwrapped here so callers see a flat plan object.
 */
export async function planInterview(input: {
  topic: string;
  hostDescription: string;
  guestDescription: string;
  environment: string;
  language?: string;
  handle?: string;
}): Promise<InterviewPlan> {
  const response = await callEdgeFunction<InterviewPlanResponse>('plan-interview', {
    topic: input.topic,
    host_description: input.hostDescription,
    guest_description: input.guestDescription,
    environment: input.environment,
    ...(input.language ? { language: input.language } : {}),
    ...(input.handle ? { handle: input.handle } : {}),
  });
  const plan = response?.plan;
  if (!plan) {
    throw new Error(response?.error ?? response?.message ?? 'Planner did not return a plan');
  }
  return plan;
}

// ---------------------------------------------------------------------------
// Timeline editor mapping
// ---------------------------------------------------------------------------

/**
 * `@xzdarcy/react-timeline-editor` model:
 *   editorData: TimelineRow[]      — row  = { id, actions: TimelineAction[] }
 *   action: { id, start, end, effectId, selected?, flexible?, movable? }
 * `start`/`end` are timeline seconds because the editor runs with `scale = 1`
 * (one scale unit = one second) and `scaleWidth = 100` (pixels per second).
 *
 * StudioProject ⇄ editorData:
 *   row.id        = StudioTrack.id
 *   action.id     = StudioClip.id (captions: StudioCaption.id)
 *   action.start  = clip.start                (caption: caption.start)
 *   action.end    = clip.start + clipLength() (caption: caption.end)
 *   action.effectId = StudioTrack.kind (drives the row colour)
 *   resizing an action therefore edits the clip trim window, dragging edits
 *   clip.start; the `subtitle` row is derived from `project.captions`.
 */

export interface EditorItemSnapshot {
  actionId: string;
  rowId: string;
  trackId: string;
  trackKind: StudioTrackKind;
  item: 'clip' | 'caption';
  start: number;
  end: number;
  trimStart: number;
  trimEnd: number;
}

export interface StudioEditorMapping {
  rows: TimelineRow[];
  items: EditorItemSnapshot[];
}

export interface EditorEdit {
  actionId: string;
  rowId: string;
  trackId: string;
  trackKind: StudioTrackKind;
  item: 'clip' | 'caption';
  start: number;
  end: number;
  previous: EditorItemSnapshot;
}

export const STUDIO_TRACK_STYLE: Record<
  StudioTrackKind,
  { label: string; bar: string; text: string; dot: string; chip: string }
> = {
  video: {
    label: 'Video',
    bar: 'bg-amber-500/25 border-amber-500/60',
    text: 'text-amber-200',
    dot: 'bg-amber-400',
    chip: 'text-amber-300 border-amber-500/40 bg-amber-500/10',
  },
  narration: {
    label: 'Narration',
    bar: 'bg-sky-500/25 border-sky-500/60',
    text: 'text-sky-200',
    dot: 'bg-sky-400',
    chip: 'text-sky-300 border-sky-500/40 bg-sky-500/10',
  },
  music: {
    label: 'Music',
    bar: 'bg-violet-500/25 border-violet-500/60',
    text: 'text-violet-200',
    dot: 'bg-violet-400',
    chip: 'text-violet-300 border-violet-500/40 bg-violet-500/10',
  },
  ambient: {
    label: 'Ambient',
    bar: 'bg-emerald-500/25 border-emerald-500/60',
    text: 'text-emerald-200',
    dot: 'bg-emerald-400',
    chip: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10',
  },
  subtitle: {
    label: 'Subtitles',
    bar: 'bg-rose-500/25 border-rose-500/60',
    text: 'text-rose-200',
    dot: 'bg-rose-400',
    chip: 'text-rose-300 border-rose-500/40 bg-rose-500/10',
  },
};

export const AUDIO_TRACK_KINDS: StudioTrackKind[] = ['narration', 'music', 'ambient'];

/** Build the timeline editor rows for a project plus a diffable snapshot. */
export function projectToEditorData(
  project: StudioProject,
  selectedId: string | null,
): StudioEditorMapping {
  const rows: TimelineRow[] = [];
  const items: EditorItemSnapshot[] = [];

  for (const track of project.tracks) {
    if (track.kind === 'subtitle') {
      const cueRow = (cueListForEditor(project.captions)[0] ?? { id: track.id, actions: [] }) as {
        id: string;
        actions: TimelineAction[];
      };
      rows.push({
        id: track.id,
        actions: cueRow.actions.map((action) => ({ ...action, selected: selectedId === action.id })),
      });
      for (const caption of project.captions) {
        items.push({
          actionId: caption.id,
          rowId: track.id,
          trackId: track.id,
          trackKind: track.kind,
          item: 'caption',
          start: caption.start,
          end: caption.end,
          trimStart: 0,
          trimEnd: caption.end - caption.start,
        });
      }
      continue;
    }

    const clips = [...track.clips].sort((a, b) => a.start - b.start);
    rows.push({
      id: track.id,
      actions: clips.map((clip) => ({
        id: clip.id,
        start: clip.start,
        end: clip.start + clipLength(clip),
        effectId: track.kind,
        flexible: !track.locked,
        movable: !track.locked,
        selected: selectedId === clip.id,
      })),
    });

    for (const clip of clips) {
      items.push({
        actionId: clip.id,
        rowId: track.id,
        trackId: track.id,
        trackKind: track.kind,
        item: 'clip',
        start: clip.start,
        end: clip.start + clipLength(clip),
        trimStart: clip.trimStart,
        trimEnd: clip.trimEnd,
      });
    }
  }

  return { rows, items };
}

/** Compare an editor changelist against the snapshot it was built from. */
export function diffEditorData(
  mapping: StudioEditorMapping,
  rows: TimelineRow[],
): EditorEdit[] {
  const edits: EditorEdit[] = [];
  for (const row of rows) {
    for (const action of row.actions) {
      const previous = mapping.items.find((item) => item.actionId === action.id);
      if (!previous) continue;
      const startChanged = Math.abs(action.start - previous.start) > EPSILON;
      const endChanged = Math.abs(action.end - previous.end) > EPSILON;
      if (!startChanged && !endChanged) continue;
      edits.push({
        actionId: action.id,
        rowId: row.id,
        trackId: previous.trackId,
        trackKind: previous.trackKind,
        item: previous.item,
        start: action.start,
        end: action.end,
        previous,
      });
    }
  }
  return edits;
}

// ---------------------------------------------------------------------------
// Beat helpers
// ---------------------------------------------------------------------------

export interface BeatTiming {
  beatId: BeatId;
  label: string;
  shotType: string;
  start: number;
  end: number;
  duration: number;
  clipId?: string;
}

/** Timeline position of each beat (video clip when present, preset otherwise). */
export function beatTimings(project: StudioProject): BeatTiming[] {
  const videoTrack = project.tracks.find((track) => track.kind === 'video');
  const byBeat = new Map<BeatId, BeatTiming>();
  videoTrack?.clips.forEach((clip) => {
    if (!clip.beatId || byBeat.has(clip.beatId)) return;
    byBeat.set(clip.beatId, {
      beatId: clip.beatId,
      label: clip.label ?? clip.beatId,
      shotType: clip.shotType ?? 'host',
      start: clip.start,
      end: clip.start + clipLength(clip),
      duration: clipLength(clip),
      clipId: clip.id,
    });
  });

  let fallbackCursor = 0;
  return INTERVIEW_BEATS.map((beat) => {
    const existing = byBeat.get(beat.beatId);
    if (existing) return existing;
    const timing: BeatTiming = {
      beatId: beat.beatId,
      label: beat.label,
      shotType: beat.shotType,
      start: fallbackCursor,
      end: fallbackCursor + beat.targetDuration,
      duration: beat.targetDuration,
    };
    fallbackCursor += beat.targetDuration;
    return timing;
  });
}

/** Video-track clip that belongs to a beat (if any). */
export function clipForBeat(project: StudioProject, beatId: BeatId) {
  const videoTrack = project.tracks.find((track) => track.kind === 'video');
  return videoTrack?.clips.find((clip) => clip.beatId === beatId);
}

/** Total timeline length in seconds (clips + captions). */
export function projectDurationSeconds(project: StudioProject): number {
  return Math.max(
    project.duration,
    ...project.tracks.flatMap((track) => track.clips.map((clip) => clip.start + clipLength(clip))),
    ...project.captions.map((caption) => caption.end),
    0,
  );
}
