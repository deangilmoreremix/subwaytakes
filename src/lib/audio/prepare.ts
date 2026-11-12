import { downmixToMono, encodeWav, padToMinDuration } from './wav';

export interface PreparedAudio { blob: Blob; durationSec: number; padded: boolean; sourceSec: number }

/**
 * Download an audio URL, decode it, pad with silence to `minSeconds`, and return a WAV blob.
 * Needed because OmniHuman rejects audio shorter than 4 seconds. Browser only (Web Audio).
 */
export async function prepareAudio(url: string, minSeconds: number, signal?: AbortSignal): Promise<PreparedAudio> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Could not download the voice audio (${res.status}).`);
  const data = await res.arrayBuffer();
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  try {
    const decoded = await ctx.decodeAudioData(data);
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, i) => decoded.getChannelData(i));
    const mono = downmixToMono(channels);
    const out = padToMinDuration(mono, decoded.sampleRate, minSeconds);
    const wav = encodeWav(out.samples, decoded.sampleRate);
    return { blob: new Blob([wav.buffer as ArrayBuffer], { type: 'audio/wav' }), durationSec: out.durationSec, padded: out.padded, sourceSec: mono.length / decoded.sampleRate };
  } finally {
    void ctx.close();
  }
}
