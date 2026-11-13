import * as client from '../muapi/client';
import * as jobs from '../muapi/jobs';
import { extractText } from '../muapi/result';
import type { ClipJob } from '../muapi/jobs';
import { uploadMedia } from '../storage';
import { MAX_PLATES, RECAST_MODELS, imageBudget, outputSeconds, validateRefs, type RecastMode, type RecastModel } from './limits';
import { parsePlanJson, selectTimestamps } from './plan';
import { MAX_RENDER_PROMPT, PLATE_PROMPT, WRITER_SYSTEM, buildSheetPrompt, buildWriterPrompt, ensureReferenceKey, normalizeLabels } from './prompts';

export type RecastStage = 'depth' | 'plan' | 'frames' | 'plates' | 'sheets' | 'prompt' | 'render';
export const RECAST_STAGES: Array<{ id: RecastStage; label: string }> = [
  { id: 'depth', label: 'Reading the motion' }, { id: 'plan', label: 'Finding clean backgrounds' }, { id: 'frames', label: 'Grabbing frames' },
  { id: 'plates', label: 'Removing the people' }, { id: 'sheets', label: 'Building character sheets' }, { id: 'prompt', label: 'Writing the render prompt' }, { id: 'render', label: 'Rendering the new performer' },
];

export type StageStatus = 'running' | 'done' | 'skipped' | 'failed';
export interface StageEvent { stage: RecastStage; status: StageStatus; detail?: string }

/** Everything we persist (in clip_jobs.input.recast) so a reload can resume. */
export interface RecastState {
  sourceUrl: string; sourceSeconds: number; refs: string[];
  mode: RecastMode; model: RecastModel; outfit?: string; brief?: string;
  stages: {
    depth?: { requestId?: string; url?: string };
    plan?: { summary: string; timestamps: number[] };
    frames?: { urls: string[] };
    plates?: { urls: string[] };
    sheets?: { urls: string[] };
    prompt?: { text: string; contactSheetUrl?: string };
    render?: { requestId?: string; url?: string };
  };
  warnings: string[];
}

export interface RecastOptions {
  sourceUrl: string; sourceSeconds: number; refs: string[];
  mode: RecastMode; model: RecastModel; outfit?: string; brief?: string;
  /** resume an interrupted job */ resume?: { job: ClipJob; state: RecastState };
  onStage?: (e: StageEvent) => void; onWarning?: (w: string) => void; signal?: AbortSignal;
}

export interface RecastDeps {
  runModel: typeof client.runModel;
  uploadMedia: (blob: Blob, name: string) => Promise<string>;
  /** grab JPEG frames from a hosted video at the given seconds */
  extractFrames: (videoUrl: string, seconds: number[]) => Promise<Blob[]>;
  /** labelled contact sheet (JPEG) of hosted images */
  buildContactSheet: (items: Array<{ url: string; label: string }>) => Promise<Blob>;
  createJob: typeof jobs.createJob;
  patchJob: typeof jobs.patchJob;
}

export interface RecastResult { job: ClipJob; url: string; seconds: number; warnings: string[]; state: RecastState }

/**
 * Prompt-writer models, tried in order. Providers retire models without notice (live test: gemini-2-5-flash and
 * gemini-3-5-flash both failed as deprecated; gemini-3-7-flash returned a transient 500), so never rely on one.
 * gemini-3-6-flash was verified live with an image input.
 */
export const WRITER_MODELS = ['gemini-3-6-flash', 'gemini-3-8-flash', 'gemini-3-7-flash', 'gemini-2-5-flash'] as const;

export const PLAN_PROMPT = 'You are preparing a video for performer replacement. Return ONLY JSON with keys "summary" (one sentence describing the scene) and "timestamps" (an array of up to 4 numbers: seconds from the start of the moments where the BACKGROUND is clearest and least blocked by people). Avoid frames near the first or last 5% of the video.';

/** Pure: body for the final render call. */
export function buildRenderInput(model: RecastModel, prompt: string, images: string[], depthUrl: string, seconds: number): Record<string, unknown> {
  const base = { prompt: prompt.slice(0, MAX_RENDER_PROMPT), images_list: images, videos_list: [depthUrl], aspect_ratio: 'adaptive', duration: seconds, resolution: '720p' };
  return model === 'wan' ? { ...base, thinking_mode: false, enable_audio: false } : base;
}

/** Pure: a deterministic prompt used only if the writer model fails. */
export function buildFallbackPrompt(i: { model: RecastModel; sheets: number; plates: number; seconds: number; brief?: string; outfit?: string; sceneSummary?: string }): string {
  const lab = (n: number) => (i.model === 'seedance' ? `@image${n}` : `Image${n}`);
  const vid = i.model === 'seedance' ? '@video1' : 'Video1';
  const chars = Array.from({ length: i.sheets }, (_, k) => lab(k + 1)).join(', ');
  const scenes = Array.from({ length: i.plates }, (_, k) => lab(i.sheets + k + 1)).join(', ');
  return [
    `REFERENCE KEY: ${vid} is the motion reference (depth). ${chars} are character sheets of the new performer.${scenes ? ` ${scenes} show the empty location.` : ''}`,
    `SCENE AND CAST: ${i.sceneSummary ? `${i.sceneSummary} ` : ''}The new performer from ${chars} appears in the location, wearing ${i.outfit?.trim() || 'the outfit shown in the sheets'}.`,
    `MOTION REFERENCE: Follow the body motion, timing and gestures of ${vid} exactly, for ${i.seconds} seconds.`,
    'CAMERA: Match the handheld camera movement and framing of the motion reference.',
    'CONSISTENCY AND PHYSICS: Keep the face, hair and clothing identical in every frame. Natural lighting, realistic motion, no extra people, no text.',
    `PRIORITY ORDER: identity first, then motion fidelity, then background.${i.brief?.trim() ? ` User brief: ${i.brief.trim()}` : ''}`,
  ].join('\n');
}

const errText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

export async function runRecastJob(o: RecastOptions, deps: RecastDeps): Promise<RecastResult> {
  // ---- checks that must pass before any money is spent
  const refProblem = validateRefs(o.refs.length);
  if (refProblem) throw new Error(refProblem);
  const budget = imageBudget(o.model, o.refs.length, MAX_PLATES);
  if (budget.error) throw new Error(budget.error);
  const out = outputSeconds(o.model, o.sourceSeconds);
  if (out.error) throw new Error(out.error);
  if (!/^https:\/\//.test(o.sourceUrl)) throw new Error('The source clip must be hosted at an https URL.');

  const def = RECAST_MODELS[o.model];
  const state: RecastState = o.resume?.state ?? { sourceUrl: o.sourceUrl, sourceSeconds: o.sourceSeconds, refs: o.refs, mode: o.mode, model: o.model, outfit: o.outfit, brief: o.brief, stages: {}, warnings: [] };
  const job = o.resume?.job ?? await deps.createJob('recast', def.slug, { take: 'Recast', recast: state });

  // serialise persistence so concurrent stages cannot overwrite each other with stale copies
  let chain: Promise<unknown> = Promise.resolve();
  const persist = (extra: Partial<ClipJob> = {}) => { chain = chain.then(() => deps.patchJob(job.id, { ...extra, input: { ...job.input, recast: state } })).catch(() => undefined); return chain; };
  const warn = (w: string) => { state.warnings.push(w); o.onWarning?.(w); };
  const emit = (stage: RecastStage, status: StageStatus, detail?: string) => o.onStage?.({ stage, status, detail });
  const abortCheck = () => { if (o.signal?.aborted) throw new Error('Cancelled'); };
  let current: RecastStage = 'depth';
  const opts = { signal: o.signal };

  try {
    // 1. depth ---------------------------------------------------------------
    current = 'depth';
    if (state.stages.depth?.url) emit('depth', 'skipped');
    else {
      emit('depth', 'running');
      const r = await deps.runModel('depth-anything', { video_url: state.sourceUrl }, { ...opts, intervalMs: 4000, resumeId: state.stages.depth?.requestId, onSubmitted: id => { state.stages.depth = { requestId: id }; void persist(); } });
      state.stages.depth = { requestId: r.requestId, url: r.url }; await persist(); emit('depth', 'done');
    }
    abortCheck();

    // 2. plan (non-fatal: a cheap analysis must not kill a paid run) ----------------
    current = 'plan';
    if (state.stages.plan) emit('plan', 'skipped');
    else {
      emit('plan', 'running');
      let summary = ''; let candidates: number[] = [];
      try {
        const r = await deps.runModel('gemini-video-vision', { model: 'gemini-2.5-flash', video_url: state.sourceUrl, prompt: PLAN_PROMPT }, { ...opts, requireUrl: false, intervalMs: 3000 });
        const plan = parsePlanJson(extractText(r.prediction)); summary = plan.summary; candidates = plan.timestamps;
        if (!candidates.length) warn('The scene analysis was unclear, so evenly spaced frames were used for the backgrounds.');
      } catch (e) { warn(`Scene analysis failed (${errText(e, 'unknown error')}), so evenly spaced frames were used.`); }
      state.stages.plan = { summary, timestamps: selectTimestamps(candidates, state.sourceSeconds, MAX_PLATES) }; await persist(); emit('plan', 'done');
    }
    abortCheck();

    // 3. frames --------------------------------------------------------------
    current = 'frames';
    const wanted = state.stages.plan!.timestamps.slice(0, budget.plates);
    if (state.stages.frames) emit('frames', 'skipped');
    else if (!wanted.length) { state.stages.frames = { urls: [] }; await persist(); emit('frames', 'skipped', 'no room for background images'); }
    else {
      emit('frames', 'running');
      const blobs = await deps.extractFrames(state.sourceUrl, wanted);
      const urls = await Promise.all(blobs.map((b, i) => deps.uploadMedia(b, `frame-${i + 1}.jpg`)));
      state.stages.frames = { urls }; await persist(); emit('frames', 'done');
    }
    abortCheck();

    // 4 + 5. plates and character sheets (independent, run together) ------------------
    current = 'plates';
    const doPlates = async () => {
      if (state.stages.plates) { emit('plates', 'skipped'); return; }
      emit('plates', 'running');
      const frames = state.stages.frames!.urls;
      const cleaned = await Promise.all(frames.map(async (f, i) => {
        try { return (await deps.runModel('nano-banana-2-edit', { prompt: PLATE_PROMPT, images_list: [f], aspect_ratio: 'Auto', resolution: '1k', output_format: 'jpg' }, { ...opts, intervalMs: 3000 })).url; }
        catch (e1) {
          try { return (await deps.runModel('gpt-image-2-image-to-image', { prompt: PLATE_PROMPT, images_list: [f], aspect_ratio: 'auto', resolution: '1K', quality: 'medium' }, { ...opts, intervalMs: 3000 })).url; }
          catch (e2) { warn(`Background ${i + 1} could not be cleaned (${errText(e1, 'error')}; retry: ${errText(e2, 'error')}) and was skipped.`); return null; }
        }
      }));
      state.stages.plates = { urls: cleaned.filter((u): u is string => !!u) }; await persist(); emit('plates', 'done');
    };
    const doSheets = async () => {
      if (state.stages.sheets) { emit('sheets', 'skipped'); return; }
      emit('sheets', 'running');
      const urls = await Promise.all(state.refs.map(async (ref, i) => {
        try { return (await deps.runModel('gpt-image-2-image-to-image', { prompt: buildSheetPrompt(state.outfit), images_list: [ref], aspect_ratio: '16:9', resolution: '2K', quality: 'high' }, { ...opts, intervalMs: 4000 })).url; }
        catch (e) { warn(`Character sheet ${i + 1} failed (${errText(e, 'error')}), so the original photo is used instead.`); return ref; }
      }));
      state.stages.sheets = { urls }; await persist(); emit('sheets', 'done');
    };
    await Promise.all([doPlates(), doSheets()]);
    abortCheck();

    // 6. prompt ----------------------------------------------------------------
    current = 'prompt';
    const sheets = state.stages.sheets!.urls, plates = state.stages.plates!.urls;
    if (state.stages.prompt?.text) emit('prompt', 'skipped');
    else {
      emit('prompt', 'running');
      let text = '';
      let contactSheetUrl: string | undefined;
      try {
        const items = [...sheets.map((u, i) => ({ url: u, label: `Image${i + 1} (character)` })), ...plates.map((u, i) => ({ url: u, label: `Image${sheets.length + i + 1} (scene)` }))];
        contactSheetUrl = await deps.uploadMedia(await deps.buildContactSheet(items), 'contact-sheet.jpg');
        const writerInput = { prompt: buildWriterPrompt({ model: o.model, mode: state.mode, sheets: sheets.length, plates: plates.length, seconds: out.seconds, brief: state.brief, outfit: state.outfit, sceneSummary: state.stages.plan!.summary }), image_url: contactSheetUrl, system_prompt: WRITER_SYSTEM };
        const failures: string[] = [];
        for (const m of WRITER_MODELS) {
          try {
            const r = await deps.runModel(m, writerInput, { ...opts, requireUrl: false, intervalMs: 3000, timeoutMs: 4 * 60_000 });
            text = extractText(r.prediction).trim();
            if (text) break;
            failures.push(`${m}: empty answer`);
          } catch (e) { if (errText(e, '') === 'Cancelled') throw e; failures.push(`${m}: ${errText(e, 'error')}`); }
        }
        if (!text) throw new Error(failures.join('; ') || 'no writer model answered');
        if (!text) throw new Error('the writer returned nothing');
      } catch (e) {
        warn(`The prompt writer failed (${errText(e, 'error')}), so a standard prompt was used.`);
        text = buildFallbackPrompt({ model: o.model, sheets: sheets.length, plates: plates.length, seconds: out.seconds, brief: state.brief, outfit: state.outfit, sceneSummary: state.stages.plan!.summary });
      }
      text = normalizeLabels(ensureReferenceKey(text, o.model, sheets.length, plates.length), o.model);
      state.stages.prompt = { text, contactSheetUrl }; await persist(); emit('prompt', 'done');
    }
    abortCheck();

    // 7. render ----------------------------------------------------------------
    current = 'render';
    let url = state.stages.render?.url;
    if (url) emit('render', 'skipped');
    else {
      emit('render', 'running');
      const input = buildRenderInput(o.model, state.stages.prompt!.text, [...sheets, ...plates], state.stages.depth!.url!, out.seconds);
      const r = await deps.runModel(def.slug, input, { ...opts, intervalMs: 6000, timeoutMs: 30 * 60_000, resumeId: state.stages.render?.requestId, onSubmitted: id => { state.stages.render = { requestId: id }; void persist(); } });
      url = r.url; state.stages.render = { requestId: r.requestId, url }; emit('render', 'done');
    }

    const done: Partial<ClipJob> = { request_id: state.stages.render?.requestId ?? null, status: 'completed', stage: 'done', output_url: url };
    await persist(done); await chain;
    return { job: { ...job, ...done } as ClipJob, url: url!, seconds: out.seconds, warnings: state.warnings, state };
  } catch (e) {
    const error = errText(e, 'Recast failed');
    emit(current, 'failed', error);
    await chain;
    // keep status 'processing' for a user cancel so it can be resumed; mark failed for real errors
    const cancelled = error === 'Cancelled';
    await deps.patchJob(job.id, { input: { ...job.input, recast: state }, ...(cancelled ? { stage: `paused:${current}` } : { status: 'failed', stage: `failed:${current}`, error }) });
    throw e;
  }
}

/** Jobs that were interrupted and can be resumed. */
export async function listResumableRecasts(): Promise<Array<{ job: ClipJob; state: RecastState }>> {
  const all = await jobs.listJobs(50);
  return all.filter(j => j.pipeline === 'recast' && j.status === 'processing' && (j.input as { recast?: RecastState }).recast)
    .map(j => ({ job: j, state: (j.input as { recast: RecastState }).recast }));
}

export const realRecastDeps = (extra: Pick<RecastDeps, 'extractFrames' | 'buildContactSheet'>): RecastDeps => ({
  runModel: client.runModel, uploadMedia, createJob: jobs.createJob, patchJob: jobs.patchJob, ...extra,
});
