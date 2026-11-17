import { decodeToMono16k } from './audio';
import { cppTokensToWords, whisperLanguage } from './map';
import { MAX_SOURCE_SECONDS, TranscribeError, type Availability, type ModelSize, type Transcriber, type TranscribeRequest, type TranscribeResult } from './types';

// whisper.cpp compiled to WebAssembly, through @remotion/whisper-web (Remotion licence: free for a solo founder / small team). Needs cross-origin isolation.
type Mod = typeof import('@remotion/whisper-web');
let mod: Promise<Mod> | null = null;
const load = () => (mod ??= import('@remotion/whisper-web'));

/** English-only models are faster and a bit more accurate for English; the multilingual ones handle everything else. */
export function cppModel(size: ModelSize, language: string): 'tiny' | 'tiny.en' | 'base' | 'base.en' | 'small' | 'small.en' {
  return (language === 'en' ? `${size}.en` : size) as ReturnType<typeof cppModel>;
}

export const whisperCppEngine: Transcriber = {
  id: 'whisper_cpp', label: 'On this device (whisper.cpp)', blurb: 'Free fallback. Slower, but runs where the other engine cannot. Needs a secure, isolated page.', paid: false,
  async isAvailable(): Promise<Availability> {
    try {
      const m = await load();
      const r = await m.canUseWhisperWeb('base');
      return r.supported ? { ok: true } : { ok: false, reason: r.reason === 'not-cross-origin-isolated' ? 'This page is not cross-origin isolated, which whisper.cpp needs.' : (r.detailedReason ?? 'This browser cannot run whisper.cpp.') };
    } catch (e) { return { ok: false, reason: e instanceof Error ? e.message : 'whisper.cpp could not load.' }; }
  },
  async transcribe(req: TranscribeRequest): Promise<TranscribeResult> {
    if (req.durationSec > MAX_SOURCE_SECONDS) throw new TranscribeError(`On-device captions work on clips up to ${MAX_SOURCE_SECONDS / 60} minutes.`, 'whisper_cpp', 'too_long');
    const m = await load();
    const lang = whisperLanguage(req.language);
    const model = cppModel(req.model, lang ?? 'auto');
    req.onProgress?.({ stage: 'decoding_audio' });
    const { samples } = await decodeToMono16k(req.src, 'whisper_cpp', req.signal);
    if (req.signal?.aborted) throw new TranscribeError('Cancelled', 'whisper_cpp', 'aborted');
    req.onProgress?.({ stage: 'loading_model', percent: 0 });
    try {
      await m.downloadWhisperModel({ model, onProgress: p => req.onProgress?.({ stage: 'loading_model', percent: Math.round(p.progress * 100) }) });
    } catch (e) { throw new TranscribeError(`Could not download the whisper.cpp model: ${e instanceof Error ? e.message : String(e)}`, 'whisper_cpp'); }
    if (req.signal?.aborted) throw new TranscribeError('Cancelled', 'whisper_cpp', 'aborted');
    req.onProgress?.({ stage: 'transcribing', percent: 0 });
    try {
      // whisper.cpp cannot be interrupted mid-run, so Cancel stops waiting for it and throws it away.
      const run = m.transcribe({ channelWaveform: samples, model, language: (lang ?? 'auto') as never, onProgress: p => req.onProgress?.({ stage: 'transcribing', percent: Math.round(p * 100) }), threads: Math.max(1, Math.min(4, (navigator.hardwareConcurrency ?? 4) - 1)) });
      const out = await Promise.race([run, new Promise<never>((_, rej) => req.signal?.addEventListener('abort', () => rej(new TranscribeError('Cancelled', 'whisper_cpp', 'aborted'))))]);
      const words = cppTokensToWords(out.transcription as never);
      if (!words.length) throw new TranscribeError('No speech was found in this clip.', 'whisper_cpp', 'no_speech');
      return { words, language: out.result?.language, engine: 'whisper_cpp', wordTimed: true };
    } catch (e) { if (e instanceof TranscribeError) throw e; throw new TranscribeError(e instanceof Error ? e.message : 'whisper.cpp failed.', 'whisper_cpp'); }
  },
};
