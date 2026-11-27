/**
 * The paid steps of a narrated video: ONE voice call for the whole script, then one picture per scene.
 * Order matters for money: the voice comes first (a failure there stops before any picture is bought), and a failed picture never costs the
 * rest: that scene borrows a neighbouring picture and a warning says so (never a stock or invented image). If no picture can be made at all the
 * voice that was paid for is still returned so the caller can keep it. Dependencies are injected so the whole flow is tested without a network.
 */
import * as client from '../muapi/client';
import { getMediaInfo } from '../timeline/media';
import { TTS_SLUG, buildTtsInput, type VoiceProvider } from '../muapi/voices';
import { planNarrated, sceneFrames, scenePrompt, type NarratedInput, type NarratedStyleId, type PlacedScene } from './index';
import { checkText } from '../safety';

export const IMAGE_SLUG = 'gpt-image-2-text-to-image';

export interface NarratedOptions {
  input: NarratedInput;
  style: NarratedStyleId;
  aspect: '9:16' | '16:9' | '1:1';
  fps: number;
  /** a synthetic voice, or leave out and pass recordedAudioUrl to use the customer's own recording (free) */
  voice?: { provider: VoiceProvider; voiceId: string; speed?: number };
  recordedAudioUrl?: string;
  signal?: AbortSignal;
  onStage?: (label: string, done: number, total: number) => void;
}
export interface NarratedDeps {
  runModel: typeof client.runModel;
  audioSeconds: (url: string) => Promise<number>;
}
export const realDeps: NarratedDeps = { runModel: client.runModel, audioSeconds: url => getMediaInfo(url).then(i => i.durationSec) };

export interface NarratedResult {
  audioUrl: string;
  audioFrames: number;
  scenes: PlacedScene[];
  /** scenes that borrowed a neighbour's picture because their own could not be made */
  warnings: string[];
  /** how many pictures were really made */
  made: number;
}

/** Everything that can be checked for free before anything is bought. Returns an error message or null. */
export function narratedProblem(o: Pick<NarratedOptions, 'input' | 'voice' | 'recordedAudioUrl'>): string | null {
  const plan = planNarrated(o.input);
  if (plan.problem) return plan.problem;
  if (o.recordedAudioUrl !== undefined && !/^https:\/\//.test(o.recordedAudioUrl)) return 'The recording must be a hosted https audio file.';
  if (o.recordedAudioUrl === undefined && !o.voice?.voiceId) return 'Pick a voice, or record your own.';
  const blocked = checkText(plan.script);
  if (!blocked.ok) return blocked.message;
  return null;
}

export async function runNarrated(o: NarratedOptions, deps: NarratedDeps = realDeps): Promise<NarratedResult> {
  const problem = narratedProblem(o);
  if (problem) throw new Error(problem);
  const plan = planNarrated(o.input);
  const total = plan.beats.length + 1;
  const check = (): void => { if (o.signal?.aborted) throw new Error('Cancelled'); };

  // 1. the voice (or the customer's own recording): a failure here stops before any picture is paid for
  check(); o.onStage?.('Writing the voice', 0, total);
  let audioUrl: string;
  if (o.recordedAudioUrl) audioUrl = o.recordedAudioUrl;
  else {
    const v = o.voice!;
    const tts = await deps.runModel(TTS_SLUG[v.provider], buildTtsInput(v.provider, plan.script, v.voiceId, v.speed), { signal: o.signal, intervalMs: 2500 });
    audioUrl = tts.url;
  }
  const seconds = await deps.audioSeconds(audioUrl);
  const audioFrames = Math.max(1, Math.round(seconds * o.fps));
  const frames = sceneFrames(plan.beats, audioFrames);

  // 2. one picture per scene, one at a time; a failed scene does not stop the rest
  const urls: Array<string | null> = [];
  const failures: string[] = [];
  for (const [i, beat] of plan.beats.entries()) {
    check(); o.onStage?.(`Picture ${i + 1} of ${plan.beats.length}`, i + 1, total);
    const prompt = scenePrompt(beat, o.style, o.aspect, o.input.kind);
    try {
      const r = await deps.runModel(IMAGE_SLUG, { prompt, aspect_ratio: o.aspect, resolution: '1K', quality: 'low' }, { signal: o.signal, intervalMs: 3000 });
      if (!/^https:\/\//.test(r.url)) throw new Error('muapi returned a picture that is not a hosted https link');
      urls.push(r.url);
    } catch (e) {
      if (e instanceof Error && e.message === 'Cancelled') throw e;
      urls.push(null); failures.push(`Picture ${i + 1}: ${e instanceof Error ? e.message : 'failed'}`);
    }
  }

  // 3. fill the gaps from the nearest picture that was made (earlier first, then later); never invent one
  const made = urls.filter(Boolean).length;
  const scenes: PlacedScene[] = [];
  const warnings: string[] = [];
  if (made > 0) {
    for (const [i, beat] of plan.beats.entries()) {
      let url = urls[i];
      if (!url) {
        for (let d = 1; !url && d < urls.length; d++) url = urls[i - d] ?? urls[i + d] ?? null;
        warnings.push(`Scene ${i + 1} reuses a neighbouring picture. ${failures.find(f => f.startsWith(`Picture ${i + 1}:`)) ?? ''}`.trim());
      }
      scenes.push({ text: beat, imageUrl: url!, frames: frames[i] });
    }
  } else warnings.push(...failures);
  return { audioUrl, audioFrames, scenes, warnings, made };
}
