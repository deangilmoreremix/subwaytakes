/** Pure audio helpers (no DOM) so they can be unit-tested in Node. */

/** Average all channels into one. */
export function downmixToMono(channels: Float32Array[]): Float32Array {
  if (channels.length === 1) return channels[0];
  const out = new Float32Array(channels[0].length);
  for (const ch of channels) for (let i = 0; i < out.length; i++) out[i] += ch[i] / channels.length;
  return out;
}

/** Append trailing silence so the clip lasts at least `minSeconds`. Returns the input untouched if already long enough. */
export function padToMinDuration(samples: Float32Array, sampleRate: number, minSeconds: number): { samples: Float32Array; padded: boolean; durationSec: number } {
  const need = Math.ceil(minSeconds * sampleRate);
  if (samples.length >= need) return { samples, padded: false, durationSec: samples.length / sampleRate };
  const out = new Float32Array(need);
  out.set(samples);
  return { samples: out, padded: true, durationSec: need / sampleRate };
}

/** 16-bit PCM mono WAV. */
export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const bytes = samples.length * 2;
  const buf = new ArrayBuffer(44 + bytes);
  const v = new DataView(buf);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + bytes, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, bytes, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(buf);
}

/** Read a WAV header back (used by tests and sanity checks). */
export function readWavHeader(b: Uint8Array): { sampleRate: number; channels: number; bits: number; dataBytes: number; durationSec: number } {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const tag = (o: number) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE' || tag(36) !== 'data') throw new Error('Not a PCM WAV file');
  const sampleRate = v.getUint32(24, true), channels = v.getUint16(22, true), bits = v.getUint16(34, true), dataBytes = v.getUint32(40, true);
  return { sampleRate, channels, bits, dataBytes, durationSec: dataBytes / (sampleRate * channels * (bits / 8)) };
}
