import { decodeToMono16k } from './audio';
import { hfChunksToWords, whisperLanguage, type HfChunk } from './map';
import { MAX_SOURCE_SECONDS, TranscribeError, type Availability, type ModelSize, type Transcriber, type TranscribeRequest, type TranscribeResult } from './types';

/** Whisper models with word timestamps (ONNX), served from the Hugging Face hub and cached by the browser. */
export const HF_MODELS: Record<ModelSize, string> = {
  tiny: 'onnx-community/whisper-tiny_timestamped',
  base: 'onnx-community/whisper-base_timestamped',
  small: 'onnx-community/whisper-small_timestamped',
};

export const transformersEngine: Transcriber = {
  id: 'transformers', label: 'On this device (Whisper)', blurb: 'Free, private. Downloads a model once, then runs in your browser.', paid: false,
  async isAvailable(): Promise<Availability> {
    if (typeof Worker === 'undefined' || typeof WebAssembly === 'undefined') return { ok: false, reason: 'This browser cannot run on-device models.' };
    if (typeof indexedDB === 'undefined' && typeof caches === 'undefined') return { ok: false, reason: 'Browser storage is blocked, so the model cannot be saved.' };
    return { ok: true };
  },
  async transcribe(req: TranscribeRequest): Promise<TranscribeResult> {
    if (req.durationSec > MAX_SOURCE_SECONDS) throw new TranscribeError(`On-device captions work on clips up to ${MAX_SOURCE_SECONDS / 60} minutes.`, 'transformers', 'too_long');
    req.onProgress?.({ stage: 'decoding_audio' });
    const { samples } = await decodeToMono16k(req.src, 'transformers', req.signal);
    if (req.signal?.aborted) throw new TranscribeError('Cancelled', 'transformers', 'aborted');
    const worker = new Worker(new URL('./transformers.worker.ts', import.meta.url), { type: 'module' });
    const lang = whisperLanguage(req.language);
    const model = HF_MODELS[req.model] ;
    return await new Promise<TranscribeResult>((resolve, reject) => {
      const finish = (fn: () => void) => { req.signal?.removeEventListener('abort', onAbort); worker.terminate(); fn(); };
      const onAbort = () => finish(() => reject(new TranscribeError('Cancelled', 'transformers', 'aborted')));
      req.signal?.addEventListener('abort', onAbort);
      worker.onerror = e => finish(() => reject(new TranscribeError(e.message || 'The on-device model crashed.', 'transformers')));
      worker.onmessage = (ev: MessageEvent<{ type: string; percent?: number; webgpu?: boolean; chunks?: HfChunk[]; message?: string }>) => {
        const m = ev.data;
        if (m.type === 'probe') {
          req.onProgress?.({ stage: 'loading_model', percent: 0, detail: `${m.webgpu && req.device !== 'wasm' ? 'GPU' : 'CPU'} mode` });
          worker.postMessage({ type: 'run', model, samples, language: lang, device: m.webgpu && req.device !== 'wasm' ? 'webgpu' : 'wasm' }, [samples.buffer]);
        } else if (m.type === 'load') req.onProgress?.({ stage: 'loading_model', percent: Math.round(m.percent ?? 0) });
        else if (m.type === 'transcribing') req.onProgress?.({ stage: 'transcribing' });
        else if (m.type === 'done') {
          const words = hfChunksToWords(m.chunks ?? [], req.durationSec);
          finish(() => words.length ? resolve({ words, engine: 'transformers', wordTimed: true }) : reject(new TranscribeError('No speech was found in this clip.', 'transformers', 'no_speech')));
        } else if (m.type === 'error') finish(() => reject(new TranscribeError(m.message ?? 'Transcription failed.', 'transformers')));
      };
      req.onProgress?.({ stage: 'loading_model', percent: 0 });
      worker.postMessage({ type: 'probe' });
    });
  },
};
