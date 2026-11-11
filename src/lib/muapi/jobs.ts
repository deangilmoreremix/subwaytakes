import { supabase } from '../supabase';
import { runModel, type Prediction } from './client';
import { NATIVE_MODELS, chooseNativeModel, clampDuration, type Tier } from './registry';
import { buildNativePrompt, type TakeSpec } from './prompt';

export interface ClipJob {
  id: string;
  pipeline: 'native' | 'lipsync' | 'recast';
  model: string;
  request_id: string | null;
  stage: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  input: Record<string, unknown>;
  output_url: string | null;
  error: string | null;
  created_at: string;
}

async function createJob(pipeline: ClipJob['pipeline'], model: string, input: Record<string, unknown>): Promise<ClipJob> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const { data, error } = await supabase.from('clip_jobs').insert({ user_id: user.id, pipeline, model, input, status: 'processing', stage: 'generating' }).select().single();
  if (error) throw error;
  return data as ClipJob;
}

async function patchJob(id: string, patch: Partial<ClipJob>) {
  await supabase.from('clip_jobs').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
}

export async function listJobs(limit = 30): Promise<ClipJob[]> {
  const { data, error } = await supabase.from('clip_jobs').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []) as ClipJob[];
}

export interface NativeOptions {
  spec: TakeSpec;
  tier: Tier;
  /** Optional reference still for image-to-video */
  imageUrl?: string;
  /** Override the tier-based model */
  modelSlug?: string;
  onUpdate?: (p: Prediction) => void;
  signal?: AbortSignal;
}

/** Native-audio pipeline: one muapi call produces the speaking clip. */
export async function runNativeJob(o: NativeOptions): Promise<ClipJob> {
  const mode = o.imageUrl ? 'image' : 'text';
  const model = NATIVE_MODELS.find(m => m.slug === o.modelSlug) ?? chooseNativeModel(o.tier, mode, o.spec.aspect);
  const slug = model.slug;
  const input: Record<string, unknown> = {
    prompt: buildNativePrompt(o.spec),
    aspect_ratio: o.spec.aspect,
    duration: clampDuration(model, o.spec.durationSeconds),
  };
  if (o.imageUrl) input.image_url = o.imageUrl;

  const job = await createJob('native', slug, { ...input, take: o.spec.take });
  try {
    const { requestId, url } = await runModel(slug, input, { onUpdate: o.onUpdate, signal: o.signal });
    const done = { request_id: requestId, status: 'completed' as const, stage: 'done', output_url: url };
    await patchJob(job.id, done);
    return { ...job, ...done };
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Generation failed';
    await patchJob(job.id, { status: 'failed', stage: 'failed', error });
    throw e;
  }
}
