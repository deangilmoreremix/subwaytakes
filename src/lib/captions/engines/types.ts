import type { TimedWord } from '../words';

/** Where the speech is turned into words. Two run on this device for free; the cloud one spends credits and is never chosen silently. */
export type EngineId = 'transformers' | 'whisper_cpp' | 'cloud';
export type ModelSize = 'tiny' | 'base' | 'small';

export interface Progress {
  stage: 'checking' | 'loading_model' | 'decoding_audio' | 'transcribing' | 'building';
  /** 0 to 100 when known */
  percent?: number;
  detail?: string;
}

export interface TranscribeRequest {
  /** a hosted media URL the browser can read (CORS) */
  src: string;
  /** length of the source media in seconds, for limits and progress */
  durationSec: number;
  /** language code, or 'auto' */
  language: string;
  model: ModelSize;
  /** Transformers.js only: force the CPU (WASM) backend instead of the GPU (WebGPU). Default: GPU when the browser has it. */
  device?: 'auto' | 'wasm';
  signal?: AbortSignal;
  onProgress?: (p: Progress) => void;
}

export interface TranscribeResult {
  words: TimedWord[];
  /** the language the engine reports, when it does */
  language?: string;
  engine: EngineId;
  /** false when the engine only knew line times and the words were spread evenly across each line */
  wordTimed: boolean;
}

export interface Availability { ok: boolean; reason?: string }

export interface Transcriber {
  id: EngineId;
  label: string;
  /** one line for the engine picker */
  blurb: string;
  /** costs credits (the cloud engine) */
  paid: boolean;
  isAvailable(): Promise<Availability>;
  transcribe(req: TranscribeRequest): Promise<TranscribeResult>;
}

export const MAX_SOURCE_SECONDS = 10 * 60;

export class TranscribeError extends Error {
  constructor(message: string, public engine: EngineId, public kind: 'unavailable' | 'failed' | 'aborted' | 'too_long' | 'no_speech' | 'source' = 'failed') { super(message); this.name = 'TranscribeError'; }
}

export const MODEL_LABEL: Record<ModelSize, { label: string; blurb: string; approxMb: number }> = {
  tiny: { label: 'Tiny', blurb: 'Fastest, least accurate', approxMb: 40 },
  base: { label: 'Base', blurb: 'Good balance (recommended)', approxMb: 75 },
  small: { label: 'Small', blurb: 'Most accurate, slowest', approxMb: 250 },
};
