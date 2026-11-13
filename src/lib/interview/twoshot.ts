/** Two-shot with a host image: one starting still (host + guest side by side), then image-to-video with the dialogue. */
import * as client from '../muapi/client';
import * as jobs from '../muapi/jobs';
import { NATIVE_MODELS, clampDuration } from '../muapi/registry';
import { uploadMedia } from '../storage';
import { buildNativePrompt, buildTwoShotStillPrompt, effectiveHostDescription, type HostCharacter, type TakeSpec } from './index';
import type { ClipJob } from '../muapi/jobs';

export const STILL_MODEL = 'gpt-image-2-image-to-image';
export const STILL_APPROX_USD = 0.09;
export type TwoShotStage = 'still' | 'animate';

export interface TwoShotDeps {
  runModel: typeof client.runModel;
  /** copy a muapi output URL into our own storage so a retry does not repay the still */
  hostStill: (url: string) => Promise<string>;
  createJob: typeof jobs.createJob;
  patchJob: typeof jobs.patchJob;
}

export interface TwoShotOptions {
  spec: TakeSpec;
  host: HostCharacter & { portrait_url: string };
  /** optional guest Cast portrait */
  guestPortraitUrl?: string;
  /** an image-to-video slug from NATIVE_MODELS */
  modelSlug: string;
  /** reuse a previously generated still (skips the image step) */
  stillUrl?: string;
  onStage?: (s: TwoShotStage) => void;
  signal?: AbortSignal;
}

/** Pure: why this can't run, or null. */
export function validateTwoShot(o: Pick<TwoShotOptions, 'spec' | 'host' | 'modelSlug'>): string | null {
  const m = NATIVE_MODELS.find(x => x.slug === o.modelSlug);
  if (!m || m.mode !== 'image') return 'Pick an image-to-video model for a host with a portrait.';
  if (!m.aspects.includes(o.spec.aspect)) return `${m.label} does not support ${o.spec.aspect}.`;
  if (!/^https:\/\//.test(o.host.portrait_url)) return 'The host portrait must be a hosted https image.';
  return null;
}

/** Pure: request bodies, exposed for tests and cost estimates. */
export function buildStillInput(spec: TakeSpec, hostPortrait: string, guestPortrait?: string): Record<string, unknown> {
  return {
    prompt: buildTwoShotStillPrompt(spec, { guestHasReference: !!guestPortrait }),
    images_list: guestPortrait ? [hostPortrait, guestPortrait] : [hostPortrait],
    aspect_ratio: spec.aspect === '1:1' ? '1:1' : spec.aspect, resolution: '1K', quality: 'medium',
  };
}
export function buildAnimateInput(spec: TakeSpec, slug: string, stillUrl: string, host: HostCharacter): Record<string, unknown> {
  const m = NATIVE_MODELS.find(x => x.slug === slug)!;
  return { prompt: buildNativePrompt({ ...spec, hostDescription: effectiveHostDescription(spec, host) }), image_url: stillUrl, aspect_ratio: spec.aspect, duration: clampDuration(m, spec.durationSeconds) };
}

export async function runTwoShotImageJob(o: TwoShotOptions, deps: TwoShotDeps = realDeps): Promise<ClipJob> {
  const problem = validateTwoShot(o);
  if (problem) throw new Error(problem);
  const job = await deps.createJob('native', o.modelSlug, { take: o.spec.take, route: 'image', hostId: o.host.id ?? null, stillUrl: o.stillUrl ?? null });
  let stage: TwoShotStage = 'still';
  const setStage = async (s: TwoShotStage, extra: Record<string, unknown> = {}) => { stage = s; o.onStage?.(s); await deps.patchJob(job.id, { stage: s, input: { ...job.input, ...extra } }); };
  try {
    let still = o.stillUrl;
    if (!still) {
      await setStage('still');
      const r = await deps.runModel(STILL_MODEL, buildStillInput(o.spec, o.host.portrait_url, o.guestPortraitUrl), { signal: o.signal, intervalMs: 4000, timeoutMs: 6 * 60_000 });
      still = await deps.hostStill(r.url);
      job.input = { ...job.input, stillUrl: still };
      await deps.patchJob(job.id, { input: job.input });
    }
    await setStage('animate', { stillUrl: still });
    const v = await deps.runModel(o.modelSlug, buildAnimateInput(o.spec, o.modelSlug, still, o.host), { signal: o.signal, intervalMs: 5000, timeoutMs: 15 * 60_000 });
    const done = { request_id: v.requestId, status: 'completed' as const, stage: 'done', output_url: v.url };
    await deps.patchJob(job.id, done);
    return { ...job, ...done };
  } catch (e) {
    const error = e instanceof Error && e.message ? e.message : 'Two-shot generation failed';
    await deps.patchJob(job.id, { status: 'failed', stage: `failed:${stage}`, error });
    throw e;
  }
}

const realDeps: TwoShotDeps = {
  runModel: client.runModel, createJob: jobs.createJob, patchJob: jobs.patchJob,
  hostStill: async url => { const res = await fetch(url); if (!res.ok) throw new Error(`Could not download the starting image (${res.status}).`); return uploadMedia(await res.blob(), 'twoshot-still.png'); },
};
