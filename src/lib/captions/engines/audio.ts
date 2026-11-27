import { downmixToMono } from '../../audio/wav';
import { MAX_SOURCE_SECONDS, TranscribeError, type EngineId } from './types';

export const SAMPLE_RATE = 16_000;

/** Linear resampling of mono samples (good enough for speech recognition). Pure. */
export function resampleLinear(samples: Float32Array, from: number, to: number): Float32Array {
  if (from === to || samples.length === 0) return samples;
  const n = Math.max(1, Math.round((samples.length * to) / from));
  const out = new Float32Array(n);
  const ratio = from / to;
  for (let i = 0; i < n; i++) {
    const pos = i * ratio; const i0 = Math.floor(pos); const i1 = Math.min(samples.length - 1, i0 + 1); const f = pos - i0;
    out[i] = samples[i0] * (1 - f) + samples[i1] * f;
  }
  return out;
}

/** Peak-normalise quiet audio a little so small models hear it (never amplifies noise more than 8x). */
export function normalizeLevel(samples: Float32Array): Float32Array {
  let peak = 0; for (let i = 0; i < samples.length; i++) { const a = Math.abs(samples[i]); if (a > peak) peak = a; }
  if (peak < 1e-4 || peak > 0.5) return samples;
  const g = Math.min(8, 0.8 / peak); const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) out[i] = samples[i] * g;
  return out;
}

/** Download a media file and return its audio as 16 kHz mono floats. Browser only (Web Audio). */
export async function decodeToMono16k(src: string, engine: EngineId, signal?: AbortSignal): Promise<{ samples: Float32Array; seconds: number }> {
  let res: Response;
  try { res = await fetch(src, { signal }); } catch { if (signal?.aborted) throw new TranscribeError('Cancelled', engine, 'aborted'); throw new TranscribeError('Could not download the clip to read its audio. The file may not allow it (CORS), or you are offline.', engine, 'source'); }
  if (!res.ok) throw new TranscribeError(`Could not download the clip (${res.status}).`, engine, 'source');
  const data = await res.arrayBuffer();
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  try {
    let decoded: AudioBuffer;
    try { decoded = await ctx.decodeAudioData(data); } catch { throw new TranscribeError('This clip has no audio this browser can read.', engine, 'no_speech'); }
    if (decoded.duration > MAX_SOURCE_SECONDS) throw new TranscribeError(`This clip is ${Math.round(decoded.duration / 60)} minutes long. On-device captions work on clips up to ${MAX_SOURCE_SECONDS / 60} minutes.`, engine, 'too_long');
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, i) => decoded.getChannelData(i));
    const mono = downmixToMono(channels);
    return { samples: normalizeLevel(resampleLinear(mono, decoded.sampleRate, SAMPLE_RATE)), seconds: decoded.duration };
  } finally { void ctx.close(); }
}
