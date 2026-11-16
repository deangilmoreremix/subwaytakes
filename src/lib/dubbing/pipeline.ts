import * as client from '../muapi/client';
import * as jobs from '../muapi/jobs';
import { extractText } from '../muapi/result';
import { TTS_SLUG, buildTtsInput, type VoiceProvider } from '../muapi/voices';
import { UTILITY } from '../muapi/registry';
import { WRITER_MODELS } from '../recast/pipeline';
import { VOICE_APPROX, VOICE_LIPSYNC_MODELS, buildVoiceLipsyncInput, fitSpeech, plainSpeech, type VoiceLipsyncModel } from '../recast/voice';
import { usdToCredits } from '../credits';
import { DUB_MAX_SECONDS, DUB_MIN_SECONDS, MAX_DUB_LANGUAGES, languageOf } from './languages';
import { buildTranslatePrompt, cleanTranslation, trimToBudget } from './prompts';
import type { ClipJob } from '../muapi/jobs';

export type DubStage = 'transcribe' | 'translate' | 'voice' | 'lipsync';
export interface DubVoice { provider: VoiceProvider; voiceId: string; speed?: number }

/** Persisted in clip_jobs.input.dub so a reload resumes without paying twice for finished steps. */
export interface DubState {
  sourceUrl: string; seconds: number; voice: DubVoice; lipsync: VoiceLipsyncModel; languages: string[];
  words?: string;
  perLang: Record<string, { text?: string; audioUrl?: string; videoUrl?: string; failed?: string }>;
  requests: Record<string, string>;
  warnings: string[];
}
export interface DubOptions {
  sourceUrl: string; seconds: number; voice: DubVoice; lipsync: VoiceLipsyncModel; languages: string[];
  resume?: { job: ClipJob; state: DubState };
  onProgress?: (e: { language: string; stage: DubStage; status: 'running' | 'done' | 'failed' | 'skipped'; detail?: string }) => void;
  signal?: AbortSignal;
}
export interface DubDeps {
  runModel: typeof client.runModel;
  createJob: typeof jobs.createJob;
  patchJob: typeof jobs.patchJob;
  /** optional: pad speech audio to the clip length and host it (browser only) */
  fitAudio?: (url: string, seconds: number) => Promise<string>;
}
/** Attached to the error thrown by runDub, so the caller can resume. */
export const resumeFrom = (e: unknown): { job: ClipJob; state: DubState } | undefined => (e as { dubResume?: { job: ClipJob; state: DubState } } | null)?.dubResume;
export interface DubResult { job: ClipJob; results: Array<{ language: string; url?: string; text?: string; error?: string }>; state: DubState }

/** Why this request cannot start, or null. Checked before anything is paid for. */
export function dubProblem(o: { sourceUrl: string; seconds: number; languages: string[] }): string | null {
  if (!/^https:\/\//.test(o.sourceUrl)) return 'Only clips that were generated here (hosted video) can be dubbed.';
  if (!(o.seconds >= DUB_MIN_SECONDS)) return `The clip is too short to dub (at least ${DUB_MIN_SECONDS} seconds).`;
  if (o.seconds > DUB_MAX_SECONDS) return `The clip is too long to dub (up to ${DUB_MAX_SECONDS} seconds). Trim it first.`;
  if (o.languages.length === 0) return 'Pick at least one language.';
  if (o.languages.length > MAX_DUB_LANGUAGES) return `Pick up to ${MAX_DUB_LANGUAGES} languages at a time.`;
  if (new Set(o.languages).size !== o.languages.length) return 'Each language can only be picked once.';
  if (o.languages.some(l => !languageOf(l))) return 'Unknown language.';
  return null;
}

/** Display estimate in credits (the gateway charges the real, live price per call). */
export const DUB_LLM_APPROX_USD = 0.01;
export function estimateDub(languageCount: number, lipsync: VoiceLipsyncModel): { lines: Array<{ label: string; credits: number }>; total: number } {
  const model = VOICE_LIPSYNC_MODELS.find(m => m.slug === lipsync)!;
  const lines = [
    { label: 'Transcribe the speech', credits: usdToCredits(VOICE_APPROX.whisper) },
    { label: `Translate (${languageCount})`, credits: usdToCredits(DUB_LLM_APPROX_USD) * languageCount },
    { label: `New voice (${languageCount})`, credits: usdToCredits(VOICE_APPROX.tts) * languageCount },
    { label: `${model.label} (${languageCount})`, credits: usdToCredits(model.approxUsd) * languageCount },
  ];
  return { lines, total: lines.reduce((s, l) => s + l.credits, 0) };
}

const errText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

export function newDubState(o: DubOptions): DubState {
  return { sourceUrl: o.sourceUrl, seconds: o.seconds, voice: o.voice, lipsync: o.lipsync, languages: o.languages, perLang: {}, requests: {}, warnings: [] };
}

/**
 * Dub one clip into several languages. The speech is transcribed once; each language is then translated, spoken in the chosen voice and
 * lip-synced onto the clip as its own video. A failure in one language never affects the others and never loses what was already paid for.
 */
export async function runDub(o: DubOptions, deps: DubDeps): Promise<DubResult> {
  const problem = dubProblem(o);
  if (problem) throw new Error(problem);
  const state = o.resume?.state ?? newDubState(o);
  const job = o.resume?.job ?? await deps.createJob('dub', o.lipsync, { dub: state });
  let chain: Promise<unknown> = Promise.resolve();
  const persist = (extra: Partial<ClipJob> = {}) => { chain = chain.then(() => deps.patchJob(job.id, { input: { ...job.input, dub: state }, ...extra })).catch(() => undefined); return chain; };
  const abortCheck = () => { if (o.signal?.aborted) throw new Error('Cancelled'); };
  const keyed = (key: string, intervalMs: number) => ({ signal: o.signal, intervalMs, resumeId: state.requests[key], onSubmitted: (id: string) => { state.requests[key] = id; void persist(); } });
  const emit = (language: string, stage: DubStage, status: 'running' | 'done' | 'failed' | 'skipped', detail?: string) => o.onProgress?.({ language, stage, status, detail });

  try {
    // 1. transcribe once
    if (state.words) emit('all', 'transcribe', 'skipped');
    else {
      emit('all', 'transcribe', 'running');
      const w = await deps.runModel(UTILITY.whisper, { audio_url: state.sourceUrl, response_format: 'text' }, { ...keyed('whisper', 2500), requireUrl: false, timeoutMs: 5 * 60_000 });
      const words = plainSpeech(extractText(w.prediction));
      if (!words) throw new Error('No speech was found in this clip, so there is nothing to dub.');
      state.words = words; await persist(); emit('all', 'transcribe', 'done');
    }
    abortCheck();

    // 2. each language, independently
    for (const lang of state.languages) {
      const ls = (state.perLang[lang] ??= {});
      if (ls.videoUrl) { emit(lang, 'lipsync', 'skipped'); continue; }
      let stage: DubStage = 'translate';
      try {
        if (!ls.text) {
          emit(lang, 'translate', 'running');
          const failures: string[] = [];
          for (const m of WRITER_MODELS) {
            try {
              const r = await deps.runModel(m, { prompt: buildTranslatePrompt(state.words!, lang, state.seconds) }, { signal: o.signal, requireUrl: false, intervalMs: 3000, timeoutMs: 3 * 60_000 });
              const text = cleanTranslation(extractText(r.prediction));
              if (text) { ls.text = text; break; }
              failures.push(`${m}: empty answer`);
            } catch (e) { if (errText(e, '') === 'Cancelled') throw e; failures.push(`${m}: ${errText(e, 'error')}`); }
          }
          if (!ls.text) throw new Error(failures.join('; ') || 'no translation model answered');
          await persist(); emit(lang, 'translate', 'done');
        }
        abortCheck();

        stage = 'voice';
        if (!ls.audioUrl) {
          emit(lang, 'voice', 'running');
          const unit = languageOf(lang)?.unit ?? 'words';
          let say: string; let speed = o.voice.speed;
          if (unit === 'words') {
            const fit = fitSpeech(state.voice.provider, ls.text, state.seconds, state.voice.speed);
            say = fit.text; speed = fit.speed;
            if (fit.trimmed) state.warnings.push(`${languageOf(lang)!.label}: the line was too long for the clip, so it was shortened.`);
          } else {
            const t = trimToBudget(ls.text, lang, state.seconds); say = t.text;
            if (t.trimmed) state.warnings.push(`${languageOf(lang)!.label}: the line was too long for the clip, so it was shortened.`);
          }
          const tts = await deps.runModel(TTS_SLUG[state.voice.provider], buildTtsInput(state.voice.provider, say, state.voice.voiceId, speed), { ...keyed(`${lang}:tts`, 2500), timeoutMs: 5 * 60_000 });
          ls.audioUrl = deps.fitAudio ? await deps.fitAudio(tts.url, state.seconds) : tts.url;
          await persist(); emit(lang, 'voice', 'done');
        }
        abortCheck();

        stage = 'lipsync';
        emit(lang, 'lipsync', 'running');
        const sync = await deps.runModel(state.lipsync, buildVoiceLipsyncInput(state.lipsync, state.sourceUrl, ls.audioUrl), { ...keyed(`${lang}:lipsync`, 5000), timeoutMs: 15 * 60_000 });
        ls.videoUrl = sync.url; delete ls.failed; await persist(); emit(lang, 'lipsync', 'done');
      } catch (e) {
        if (errText(e, '') === 'Cancelled') throw e;
        ls.failed = errText(e, 'failed');
        state.warnings.push(`${languageOf(lang)!.label} could not be finished (${ls.failed}). The other languages are not affected.`);
        await persist(); emit(lang, stage, 'failed', ls.failed);
      }
    }

    const results = state.languages.map(language => ({ language, url: state.perLang[language]?.videoUrl, text: state.perLang[language]?.text, error: state.perLang[language]?.videoUrl ? undefined : state.perLang[language]?.failed }));
    const first = results.find(r => r.url);
    const done: Partial<ClipJob> = first
      ? { status: 'completed', stage: 'done', output_url: first.url ?? null }
      : { status: 'failed', stage: 'failed', error: results.map(r => r.error).filter(Boolean).join('; ').slice(0, 500) || 'no language finished' };
    await persist(done); await chain;
    return { job: { ...job, ...done } as ClipJob, results, state };
  } catch (e) {
    const error = errText(e, 'Dubbing failed');
    emit('all', 'transcribe', 'failed', error);
    await chain;
    const cancelled = error === 'Cancelled';
    await deps.patchJob(job.id, { input: { ...job.input, dub: state }, ...(cancelled ? { stage: 'paused' } : { status: 'failed', stage: 'failed', error }) });
    // hand the saved state back with the error, so a cancelled run can be resumed without paying again for finished steps
    if (e instanceof Error) Object.assign(e, { dubResume: { job, state } });
    throw e;
  }
}
