import { describe, it, expect } from 'vitest';
import vision from '../muapi/__fixtures__/real-vision-result.json';
import { extractText } from '../muapi/result';
import { fallbackTimestamps, parsePlanJson, selectTimestamps } from './plan';
import { APPROX_COSTS, estimateRecast, imageBudget, outputSeconds, validateRefs, validateSource } from './limits';
import { buildSheetPrompt, buildWriterPrompt, ensureReferenceKey, normalizeLabels, refLabel } from './prompts';

describe('parsePlanJson', () => {
  it('parses the REAL gemini-video-vision answer (fenced JSON)', () => {
    const p = parsePlanJson(extractText(vision));
    expect(p.summary).toMatch(/subway/i);
    expect(p.timestamps).toEqual([0.8, 1.5, 2.5, 3.2]);
  });
  it('tolerates chatter, bare JSON and numeric strings', () => {
    expect(parsePlanJson('Sure! {"summary":"x","timestamps":["1.5", 2]} hope that helps').timestamps).toEqual([1.5, 2]);
    expect(parsePlanJson('{"timestamps":[1]}').summary).toBe('');
  });
  it('never throws on garbage', () => {
    expect(parsePlanJson('no json here')).toEqual({ summary: '', timestamps: [] });
    expect(parsePlanJson('{"timestamps": "nope"}').timestamps).toEqual([]);
    expect(parsePlanJson('{ broken')).toEqual({ summary: '', timestamps: [] });
    expect(parsePlanJson('')).toEqual({ summary: '', timestamps: [] });
  });
});

describe('selectTimestamps', () => {
  it('keeps the real answer for a 5s clip (all inside 0.1..4.9)', () => { expect(selectTimestamps([0.8, 1.5, 2.5, 3.2], 5)).toEqual([0.8, 1.5, 2.5, 3.2]); });
  it('drops edges, dedupes near-duplicates, sorts and caps', () => {
    expect(selectTimestamps([4.95, 0.05, 2, 2.1, 1, 3, 4, 4.5], 5, 3)).toEqual([1, 2, 3]);
  });
  it('falls back to 15/50/85% when nothing is usable', () => {
    expect(selectTimestamps([], 10)).toEqual([1.5, 5, 8.5]);
    expect(selectTimestamps([99, -1], 10)).toEqual(fallbackTimestamps(10));
  });
});

describe('validateSource / validateRefs', () => {
  it('accepts the real 5s, 2.5MB mp4', () => { expect(validateSource(5.02, 2_565_909, 'video/mp4')).toBeNull(); });
  it.each([
    [[3, 1e6, 'video/mp4'], /at least 4/], [[16, 1e6, 'video/mp4'], /15s or shorter/], [[5, 60e6, 'video/mp4'], /50 MB/],
    [[5, 1e6, 'image/png'], /MP4 or MOV/], [[NaN, 1e6, 'video/mp4'], /length/],
  ] as const)('rejects %j', (a, re) => { expect(validateSource(...(a as [number, number, string]))).toMatch(re); });
  it('refs: count and file rules', () => {
    expect(validateRefs(0)).toMatch(/at least one/);
    expect(validateRefs(9)).toMatch(/at most 8/);
    expect(validateRefs(2, [{ size: 1000, type: 'image/png' }])).toBeNull();
    expect(validateRefs(1, [{ size: 1000, type: 'image/gif' }])).toMatch(/JPEG, PNG or WebP/);
    expect(validateRefs(1, [{ size: 11e6, type: 'image/png' }])).toMatch(/10 MB/);
  });
});

describe('imageBudget / outputSeconds', () => {
  it('Wan: 10 images total, plates shrink as sheets grow', () => {
    expect(imageBudget('wan', 1, 4)).toEqual({ plates: 4, error: null });
    expect(imageBudget('wan', 8, 4)).toEqual({ plates: 2, error: null });
    expect(imageBudget('wan', 10, 4)).toEqual({ plates: 0, error: null });
  });
  it('Seedance: 30 images, never more than 4 plates', () => { expect(imageBudget('seedance', 8, 4).plates).toBe(4); });
  it('errors before spending when sheets alone exceed the limit', () => {
    expect(imageBudget('wan', 11, 4).error).toMatch(/at most 10/);
  });
  it('output length = source rounded up; Wan enforces depth + output <= 30s', () => {
    expect(outputSeconds('wan', 5.02)).toEqual({ seconds: 5, error: null });         // a 20ms tail is not worth +20% cost
    expect(outputSeconds('wan', 5.4)).toEqual({ seconds: 6, error: null });          // 0.4s would be cut: round up instead
    expect(outputSeconds('seedance', 4.2)).toEqual({ seconds: 4, error: null });     // Seedance minimum is 4s
    expect(outputSeconds('seedance', 4.0)).toEqual({ seconds: 4, error: null });
    expect(outputSeconds('wan', 15)).toEqual({ seconds: 15, error: null });          // 15 + 15 = 30 ok
    expect(outputSeconds('wan', 15.5).error).toMatch(/30s/);                         // 15.5 + 16 > 30
  });
});

describe('estimateRecast', () => {
  it('render cost scales with the output length (Wan measured live: 6s = $1.10)', () => {
    const render = (m: 'wan' | 'seedance', sec: number) => estimateRecast(m, 1, 4, {}, sec).lines.find(([k]) => k.startsWith('Render'))![1];
    expect(render('wan', 6)).toBeCloseTo(1.1, 4);
    expect(render('wan', 12)).toBeCloseTo(2.2, 4);
    expect(render('seedance', 5)).toBeCloseTo(1.7, 4);
    expect(estimateRecast('wan', 1, 4, {}, 5).total).toBeCloseTo(0.2 + 0.004 + 0.24 + 0.09 + 0.0001 + 0.9167, 3);
  });
  it('live numbers override the approximations and lines add up', () => {
    const r = estimateRecast('wan', 2, 3, { render: 0.75, depth: 0.1 });
    expect(r.total).toBeCloseTo(r.lines.reduce((n, [, v]) => n + v, 0), 4);
    expect(r.lines.find(([k]) => k.startsWith('Render'))?.[1]).toBe(0.75);
    expect(APPROX_COSTS.depth).toBe(0.2);
  });
});

describe('prompts', () => {
  const base = { sheets: 2, plates: 3, seconds: 5, mode: 'motion_transfer' as const };
  it('labels differ per model', () => {
    expect(refLabel('seedance', 'image', 2)).toBe('@image2');
    expect(refLabel('wan', 'video', 1)).toBe('Video1');
  });
  it('writer prompt maps characters then plates, and states the mode', () => {
    const wan = buildWriterPrompt({ ...base, model: 'wan', brief: 'make it rainy' });
    expect(wan).toContain('Image1, Image2');           // characters
    expect(wan).toContain('Image3, Image4, Image5');   // plates follow the sheets
    expect(wan).toContain('Video1');
    expect(wan).toMatch(/make it rainy/);
    expect(wan).toMatch(/do not keep the identity/);
    expect(buildWriterPrompt({ ...base, model: 'seedance', mode: 'object_swap' })).toMatch(/Replace only the requested/);
    expect(buildWriterPrompt({ ...base, model: 'seedance' })).toContain('@image1, @image2');
  });
  it('never names a provider', () => { expect(buildWriterPrompt({ ...base, model: 'wan' })).not.toMatch(/seedance|wan 3|openai|gemini|muapi/i); });
  it('seedance gets a reference key if the writer forgot; wan gets plain labels', () => {
    expect(ensureReferenceKey('A prompt.', 'seedance', 1, 2)).toMatch(/^REFERENCE KEY: @video1 is the motion reference\. @image1 is a character sheet\. @image2 is a clean scene plate\. @image3/);
    expect(ensureReferenceKey('has @video1 already', 'seedance', 1, 0)).toBe('has @video1 already');
    expect(normalizeLabels('Use @image1 and @Video1', 'wan')).toBe('Use Image1 and Video1');
    expect(normalizeLabels('Use @image1', 'seedance')).toBe('Use @image1');
  });
  it('sheet prompt keeps or changes the outfit', () => {
    expect(buildSheetPrompt()).toMatch(/same outfit/);
    expect(buildSheetPrompt('red coat')).toMatch(/red coat/);
  });
});
