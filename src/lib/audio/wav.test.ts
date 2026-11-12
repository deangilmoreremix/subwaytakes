import { describe, it, expect } from 'vitest';
import { downmixToMono, encodeWav, padToMinDuration, readWavHeader } from './wav';

const tone = (sec: number, sr = 44100) => Float32Array.from({ length: Math.round(sec * sr) }, (_, i) => 0.5 * Math.sin((2 * Math.PI * 440 * i) / sr));

describe('padToMinDuration', () => {
  it('pads a 3.79s clip (the real ElevenLabs line) up to 4.0s with trailing silence', () => {
    const src = tone(3.79);
    const r = padToMinDuration(src, 44100, 4);
    expect(r.padded).toBe(true);
    expect(r.durationSec).toBeGreaterThanOrEqual(4);
    expect(r.samples.slice(0, src.length)).toEqual(src);                       // original audio untouched
    expect(Array.from(r.samples.slice(src.length)).every(x => x === 0)).toBe(true); // padding is silent
  });
  it('leaves long-enough audio untouched (same array, not padded)', () => {
    const src = tone(5);
    const r = padToMinDuration(src, 44100, 4);
    expect(r.padded).toBe(false);
    expect(r.samples).toBe(src);
  });
  it('handles empty input', () => {
    const r = padToMinDuration(new Float32Array(0), 16000, 4);
    expect(r.samples.length).toBe(64000);
  });
});

describe('encodeWav', () => {
  it('writes a valid 16-bit mono PCM header whose duration matches the samples', () => {
    const wav = encodeWav(tone(4.4), 44100);
    expect(readWavHeader(wav)).toMatchObject({ sampleRate: 44100, channels: 1, bits: 16 });
    expect(readWavHeader(wav).durationSec).toBeCloseTo(4.4, 2);
    expect(wav.length).toBe(44 + Math.round(4.4 * 44100) * 2);
  });
  it('clips out-of-range samples instead of wrapping', () => {
    const wav = encodeWav(Float32Array.from([2, -2, 0]), 8000);
    const v = new DataView(wav.buffer);
    expect([v.getInt16(44, true), v.getInt16(46, true), v.getInt16(48, true)]).toEqual([32767, -32768, 0]);
  });
  it('rejects non-WAV data when reading', () => {
    expect(() => readWavHeader(new Uint8Array(64))).toThrow();
  });
});

describe('downmixToMono', () => {
  it('averages channels and passes mono through', () => {
    const l = Float32Array.from([1, 0]), r = Float32Array.from([0, 1]);
    expect(Array.from(downmixToMono([l, r]))).toEqual([0.5, 0.5]);
    expect(downmixToMono([l])).toBe(l);
  });
});
