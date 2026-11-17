import { describe, expect, it } from 'vitest';
import { resampleLinear, normalizeLevel } from './audio';
import { cppTokensToWords, hfChunksToWords, spreadLines, whisperLanguage } from './map';
import { transcribe, TranscribeError, type EngineId, type Transcriber } from './index';
import { recognitionCtor, startDictation } from './webSpeech';
import { cppModel } from './whisperCpp';

describe('audio helpers', () => {
  it('resamples to the right length and keeps a constant signal', () => {
    const out = resampleLinear(new Float32Array(48000).fill(0.25), 48000, 16000);
    expect(out.length).toBe(16000); expect(out[100]).toBeCloseTo(0.25, 5);
  });
  it('is a no-op at the same rate and survives empty input', () => { const a = new Float32Array(10); expect(resampleLinear(a, 16000, 16000)).toBe(a); expect(resampleLinear(new Float32Array(0), 44100, 16000).length).toBe(0); });
  it('raises quiet audio but never loud audio or silence', () => {
    const q = normalizeLevel(new Float32Array([0.05, -0.05])); expect(Math.abs(q[0])).toBeGreaterThan(0.3);
    const loud = new Float32Array([0.9]); expect(normalizeLevel(loud)).toBe(loud);
    const s = new Float32Array([0, 0]); expect(normalizeLevel(s)).toBe(s);
  });
});

describe('engine output mapping', () => {
  it('maps Transformers.js word chunks and closes open-ended words', () => {
    const w = hfChunksToWords([{ text: ' Hello', timestamp: [0, 0.5] }, { text: ' world', timestamp: [0.6, null] }, { text: ' ', timestamp: [1, 2] }], 10);
    expect(w).toEqual([{ text: 'Hello', startMs: 0, endMs: 500 }, { text: 'world', startMs: 600, endMs: 1000 }]);
  });
  it('joins whisper.cpp sub-word tokens into words and skips special tokens', () => {
    const tok = (text: string, from: number, to: number) => ({ text, offsets: { from, to } });
    const w = cppTokensToWords([{ tokens: [tok('[_BEG_]', 0, 0), tok(' Pine', 0, 200), tok('apple', 200, 500), tok(' belongs', 520, 900), tok(',', 900, 920), tok(' on', 950, 1100), tok('<|endoftext|>', 1100, 1100)] }]);
    expect(w.map(x => x.text)).toEqual(['Pineapple', 'belongs,', 'on']); expect(w[0]).toMatchObject({ startMs: 0, endMs: 500 });
  });
  it('spreads cloud line times across words', () => {
    const w = spreadLines([{ text: 'one two three four', startMs: 1000, endMs: 3000 }]);
    expect(w.map(x => x.startMs)).toEqual([1000, 1500, 2000, 2500]); expect(w[3].endMs).toBe(3000);
  });
  it('picks language codes and models', () => {
    expect(whisperLanguage('auto')).toBeUndefined(); expect(whisperLanguage('pt-BR')).toBe('pt'); expect(cppModel('base', 'en')).toBe('base.en'); expect(cppModel('small', 'es')).toBe('small');
  });
});

const fake = (id: EngineId, behaviour: 'ok' | 'fail' | 'off' | 'nospeech' | 'abort'): Transcriber & { calls: number } => {
  const t = { id, label: id, blurb: '', paid: id === 'cloud', calls: 0,
    async isAvailable() { return behaviour === 'off' ? { ok: false, reason: 'nope' } : { ok: true }; },
    async transcribe() {
      t.calls++;
      if (behaviour === 'fail') throw new Error('boom');
      if (behaviour === 'nospeech') throw new TranscribeError('none', id, 'no_speech');
      if (behaviour === 'abort') throw new TranscribeError('x', id, 'aborted');
      return { words: [{ text: id, startMs: 0, endMs: 100 }], engine: id, wordTimed: true };
    } };
  return t;
};
const req = { src: 'https://x/y.mp4', durationSec: 5, language: 'auto', model: 'base' as const };

describe('engine selection and fallback', () => {
  const mk = (a: ReturnType<typeof fake>, b: ReturnType<typeof fake>, c = fake('cloud', 'ok')) => ({ transformers: a, whisper_cpp: b, cloud: c });
  it('falls back from the first on-device engine to the second and reports it', async () => {
    const a = fake('transformers', 'fail'), b = fake('whisper_cpp', 'ok'); const seen: string[] = [];
    const r = await transcribe(req, { engine: 'transformers', engines: mk(a, b), onFallback: (f, t) => seen.push(`${f}>${t}`) });
    expect(r.engine).toBe('whisper_cpp'); expect(seen).toEqual(['transformers>whisper_cpp']);
  });
  it('skips an unavailable engine without running it', async () => {
    const a = fake('transformers', 'off'), b = fake('whisper_cpp', 'ok'); const r = await transcribe(req, { engine: 'transformers', engines: mk(a, b) });
    expect(a.calls).toBe(0); expect(r.engine).toBe('whisper_cpp');
  });
  it('never falls back to the paid cloud engine automatically', async () => {
    const c = fake('cloud', 'ok');
    await expect(transcribe(req, { engine: 'transformers', engines: mk(fake('transformers', 'fail'), fake('whisper_cpp', 'fail'), c) })).rejects.toThrow('boom');
    expect(c.calls).toBe(0);
  });
  it('does not fall back on cancel or no-speech', async () => {
    const b = fake('whisper_cpp', 'ok');
    await expect(transcribe(req, { engine: 'transformers', engines: mk(fake('transformers', 'nospeech'), b) })).rejects.toMatchObject({ kind: 'no_speech' });
    await expect(transcribe(req, { engine: 'transformers', engines: mk(fake('transformers', 'abort'), b) })).rejects.toMatchObject({ kind: 'aborted' });
    expect(b.calls).toBe(0);
  });
  it('can be told not to fall back, and cloud runs alone', async () => {
    const b = fake('whisper_cpp', 'ok');
    await expect(transcribe(req, { engine: 'transformers', fallback: false, engines: mk(fake('transformers', 'fail'), b) })).rejects.toThrow('boom'); expect(b.calls).toBe(0);
    expect((await transcribe(req, { engine: 'cloud', engines: mk(fake('transformers', 'ok'), b) })).engine).toBe('cloud');
  });
  it('reports the last error when every engine is unavailable', async () => {
    await expect(transcribe(req, { engine: 'transformers', engines: mk(fake('transformers', 'off'), fake('whisper_cpp', 'off')) })).rejects.toMatchObject({ kind: 'unavailable' });
  });
});

describe('Web Speech dictation wrapper', () => {
  it('is unsupported without the API', () => { expect(recognitionCtor({})).toBeNull(); expect(startDictation('en', { onText() {}, onError() {}, onEnd() {} }, {})).toBeNull(); });
  it('collects final text, shows interim text, maps errors', () => {
    let inst: { onresult: (e: unknown) => void; onerror: (e: { error: string }) => void; started: boolean } | null = null;
    class R { lang = ''; continuous = false; interimResults = false; onresult: ((e: unknown) => void) | null = null; onerror: ((e: { error: string }) => void) | null = null; onend: (() => void) | null = null; started = false; start() { this.started = true; inst = this as never; } stop() {} abort() {} }
    const out: Array<[string, string]> = []; const errs: string[] = [];
    const d = startDictation('auto', { onText: (f, i) => out.push([f, i]), onError: m => errs.push(m), onEnd() {} }, { SpeechRecognition: R });
    expect(d).not.toBeNull(); expect(inst!.started).toBe(true);
    const res = (t: string, fin: boolean) => Object.assign([{ transcript: t }], { isFinal: fin });
    inst!.onresult({ resultIndex: 0, results: [res('hello there', true), res('how are', false)] });
    expect(out[out.length - 1]).toEqual(['hello there', 'how are']);
    inst!.onerror({ error: 'not-allowed' }); expect(errs[0]).toMatch(/permission/);
  });
});
