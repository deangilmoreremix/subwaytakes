import * as client from './client';
import * as jobs from './jobs';
import { prepareAudio } from '../audio/prepare';
import { uploadMedia } from '../storage';
import { TTS_SLUG, buildTtsInput, type VoiceProvider } from './voices';
import type { ClipJob } from './jobs';

export type LipsyncModel = 'omnihuman-2-0' | 'kling-v2-avatar-standard';
export type LipsyncStage = 'voice' | 'prepare' | 'render';

export const LIPSYNC_MODELS: Array<{ slug: LipsyncModel; label: string; tier: 'best' | 'balanced'; minAudioSec: number; maxPrompt: number }> = [
  // OmniHuman: audio 4-300s, wav/mp3, <15MB; prompt <= 300 chars (muapi model metadata).
  { slug: 'omnihuman-2-0', label: 'OmniHuman 2.0', tier: 'best', minAudioSec: 4, maxPrompt: 300 },
  // Kling Avatar publishes no limits; pad to the same 4s floor, which is harmless if it accepts shorter audio.
  { slug: 'kling-v2-avatar-standard', label: 'Kling Avatar', tier: 'balanced', minAudioSec: 4, maxPrompt: 500 },
];

export const MAX_SCRIPT_CHARS = 600;

export interface Speaker { portrait_url?: string | null; voice_provider?: VoiceProvider | null; voice_id?: string | null; voice_speed?: number }

export interface LipsyncOptions {
  speaker: Speaker;
  script: string;
  model: LipsyncModel;
  /** short scene/motion hint for the render prompt */
  scene?: string;
  onStage?: (s: LipsyncStage) => void;
  signal?: AbortSignal;
}

/** Everything the pipeline touches, injectable for tests. */
export interface LipsyncDeps {
  runModel: typeof client.runModel;
  prepareAudio: typeof prepareAudio;
  uploadMedia: typeof uploadMedia;
  createJob: typeof jobs.createJob;
  patchJob: typeof jobs.patchJob;
}
const realDeps: LipsyncDeps = { runModel: client.runModel, prepareAudio, uploadMedia, createJob: jobs.createJob, patchJob: jobs.patchJob };

/** Pure: validate inputs before spending anything. Returns an error message or null. */
export function validateLipsync(o: Pick<LipsyncOptions, 'speaker' | 'script' | 'model'>): string | null {
  if (!o.speaker.portrait_url) return 'This character has no portrait yet. Upload or generate one in Cast.';
  if (!/^https:\/\//.test(o.speaker.portrait_url)) return 'The portrait must be a hosted https image.';
  if (!o.speaker.voice_provider || !o.speaker.voice_id) return 'This character has no voice yet. Pick one in Cast.';
  if (!o.script.trim()) return 'The script is empty.';
  if (o.script.length > MAX_SCRIPT_CHARS) return `The script is too long (${o.script.length}/${MAX_SCRIPT_CHARS} characters).`;
  if (!LIPSYNC_MODELS.some(m => m.slug === o.model)) return `Unknown lipsync model ${o.model}.`;
  return null;
}

/** Pure: request body for the render step. */
export function buildRenderInput(model: LipsyncModel, imageUrl: string, audioUrl: string, scene?: string): Record<string, unknown> {
  const def = LIPSYNC_MODELS.find(m => m.slug === model)!;
  const input: Record<string, unknown> = { image_url: imageUrl, audio_url: audioUrl };
  const prompt = (scene ?? '').trim().slice(0, def.maxPrompt);
  if (prompt) input.prompt = prompt;
  return input;
}

/** Image -> voice -> (pad) -> talking video. Persists a clip_jobs row and surfaces the real error of any failed stage. */
export async function runLipsyncJob(o: LipsyncOptions, deps: LipsyncDeps = realDeps): Promise<ClipJob & { audioSeconds: number }> {
  const problem = validateLipsync(o);
  if (problem) throw new Error(problem);
  const def = LIPSYNC_MODELS.find(m => m.slug === o.model)!;
  // validateLipsync guarantees these are present
  const sp = { portrait_url: o.speaker.portrait_url as string, voice_provider: o.speaker.voice_provider as VoiceProvider, voice_id: o.speaker.voice_id as string, voice_speed: o.speaker.voice_speed };

  const job = await deps.createJob('lipsync', o.model, { script: o.script, take: o.script, voice: `${sp.voice_provider}:${sp.voice_id}`, portrait_url: sp.portrait_url });
  let stage: LipsyncStage = 'voice';
  const setStage = async (s: LipsyncStage) => { stage = s; o.onStage?.(s); await deps.patchJob(job.id, { stage: s }); };
  try {
    await setStage('voice');
    const tts = await deps.runModel(TTS_SLUG[sp.voice_provider], buildTtsInput(sp.voice_provider, o.script, sp.voice_id, sp.voice_speed), { signal: o.signal, intervalMs: 2500 });

    await setStage('prepare');
    const prepared = await deps.prepareAudio(tts.url, def.minAudioSec, o.signal);
    const audioUrl = prepared.padded ? await deps.uploadMedia(prepared.blob, 'voice.wav') : tts.url;

    await setStage('render');
    const render = await deps.runModel(o.model, buildRenderInput(o.model, sp.portrait_url, audioUrl, o.scene), { signal: o.signal, intervalMs: 5000, timeoutMs: 20 * 60_000 });

    const done = { request_id: render.requestId, status: 'completed' as const, stage: 'done', output_url: render.url };
    await deps.patchJob(job.id, done);
    return { ...job, ...done, audioSeconds: prepared.durationSec };
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Lipsync generation failed';
    await deps.patchJob(job.id, { status: 'failed', stage: `failed:${stage}`, error });
    throw e;
  }
}

/** Pure: total of per-step estimates (USD). Missing/invalid numbers count as unknown -> null. */
export function sumCost(parts: Array<number | null | undefined>): number | null {
  let total = 0;
  for (const p of parts) { if (typeof p !== 'number' || !Number.isFinite(p)) return null; total += p; }
  return Math.round(total * 10000) / 10000;
}

/** Live estimate (TTS + render) before the user commits. */
export async function estimateLipsync(speaker: Speaker, script: string, model: LipsyncModel): Promise<number | null> {
  if (!speaker.voice_provider || !speaker.voice_id || !script.trim()) return null;
  const read = (r: Record<string, unknown>) => (typeof r.cost === 'number' ? r.cost : null);
  const [tts, render] = await Promise.all([
    client.muapi.estimate(TTS_SLUG[speaker.voice_provider], buildTtsInput(speaker.voice_provider, script, speaker.voice_id, speaker.voice_speed)).then(read),
    client.muapi.estimate(model, buildRenderInput(model, speaker.portrait_url ?? 'https://example.com/portrait.png', 'https://example.com/voice.wav')).then(read),
  ]);
  return sumCost([tts, render]);
}
