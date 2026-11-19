import { describe, expect, it } from 'vitest';
import type { Clip } from '../timeline/types';
import { CAPTION_PRESETS, DEFAULT_CAPTION_STYLE, PRESET_CATEGORIES, isCustomised, presetOf, styleFromPreset } from './presets';
import { MOTION_ENGINES, POSITION_MAX, POSITION_MIN, clampPosition } from './model';
import { FONT_META, nearestWeight } from './fontData';
import { detectScript, fontForScript, isRtl, isSpaceless, joinWords, styleForText, supportsCase } from './scripts';
import { activeWordIndex, buildLines, clipText, ensureWords, normalizeWords, wordsToClips, type TimedWord } from './words';
import { addWordAfter, convertCase, countMatches, deleteWord, editWord, findReplace, mergeWithNext, nudgeBoundary, nudgeWord, resegment, splitClip, transcriptText } from './edit';
import { exportCaptions, toAss, toJson, toSrt, toTxt, toVtt } from './exports';

const FPS = 30;
let n = 0; const id = () => `id${++n}`;
const tw = (text: string, s: number, e: number): TimedWord => ({ text, startMs: s, endMs: e });
const video: Clip = { id: 'v', trackId: 'v1', kind: 'video', label: 'v', start: 0, duration: 300, trimStart: 0, sourceFrames: 300, src: 'https://x/v.mp4' };
const SENTENCE: TimedWord[] = [tw('Pineapple', 100, 600), tw('belongs', 650, 1000), tw('on', 1050, 1200), tw('pizza,', 1250, 1700), tw('and', 1800, 1950), tw('anyone', 2000, 2400), tw('who', 2450, 2600), tw('disagrees.', 2650, 3300)];
const caps = (words: TimedWord[] = SENTENCE, opts = {}) => wordsToClips(words, video, 'c1', FPS, id, opts);

describe('presets', () => {
  it('has a large library in the four categories, with unique ids', () => {
    expect(CAPTION_PRESETS.length).toBeGreaterThanOrEqual(33); expect(new Set(CAPTION_PRESETS.map(p => p.id)).size).toBe(CAPTION_PRESETS.length);
    for (const cat of PRESET_CATEGORIES) expect(CAPTION_PRESETS.filter(p => p.category === cat).length, cat).toBeGreaterThanOrEqual(5);
  });
  it('includes the six named styles and every preset uses a real engine and font', () => {
    for (const name of ['hormozi', 'mrbeast', 'karaoke', 'minimal', 'bounce', 'classic', 'code_terminal']) expect(CAPTION_PRESETS.some(p => p.id === name), name).toBe(true);
    const engines = MOTION_ENGINES.map(e => e.id);
    for (const p of CAPTION_PRESETS) { expect(engines, p.id).toContain(p.style.engine); expect(FONT_META[p.style.font], p.id).toBeTruthy(); expect(p.style.colors.text).toMatch(/^#[0-9a-f]{6}$/i); expect(p.style.colors.highlight).toMatch(/^#[0-9a-f]{6}$/i); expect(p.style.size).toBeGreaterThan(30); }
  });
  it('every motion engine is used by at least one preset (nothing is dead code)', () => { for (const e of MOTION_ENGINES) expect(CAPTION_PRESETS.some(p => p.style.engine === e.id), e.id).toBe(true); });
  it('builds full styles from presets and knows when one is customised', () => {
    const s = styleFromPreset('mrbeast'); expect(s.presetId).toBe('mrbeast'); expect(s.engine).toBe('pop_spring'); expect(isCustomised(s)).toBe(false);
    expect(isCustomised({ ...s, size: s.size + 4 })).toBe(true); expect(isCustomised({ ...s, positionY: 40 })).toBe(false);
    expect(presetOf('nope').id).toBe('hormozi'); expect(DEFAULT_CAPTION_STYLE.presetId).toBe('hormozi');
  });
  it('clamps the caption position', () => { expect(clampPosition(-5)).toBe(POSITION_MIN); expect(clampPosition(500)).toBe(POSITION_MAX); expect(clampPosition(33.4)).toBe(33); });
  it('weights fall back to ones the family has', () => { expect(nearestWeight('anton', 900)).toBe(400); expect(nearestWeight('inter', 880)).toBe(900); expect(nearestWeight('inter', 120)).toBe(300); });
});

describe('scripts and fonts', () => {
  it('detects the writing system of a transcript', () => {
    expect(detectScript('Hello there')).toBe('latin'); expect(detectScript('こんにちは世界')).toBe('japanese'); expect(detectScript('안녕하세요')).toBe('korean'); expect(detectScript('你好世界')).toBe('chinese');
    expect(detectScript('مرحبا بالعالم')).toBe('arabic'); expect(detectScript('नमस्ते दुनिया')).toBe('devanagari'); expect(detectScript('สวัสดีชาวโลก')).toBe('thai'); expect(detectScript('שלום עולם')).toBe('hebrew'); expect(detectScript('Привет мир')).toBe('cyrillic');
  });
  it('a mostly-Latin line with one foreign word stays Latin; Japanese with kanji is Japanese', () => { expect(detectScript('I love sushi 寿司 so much')).toBe('latin'); expect(detectScript('日本語のテキスト')).toBe('japanese'); });
  it('picks a font that has the letters, and knows right-to-left and spaceless scripts', () => {
    expect(fontForScript('japanese', 'anton')).toBe('noto_jp'); expect(fontForScript('arabic', 'inter')).toBe('noto_arabic'); expect(fontForScript('latin', 'anton')).toBe('anton'); expect(fontForScript('cyrillic', 'anton')).toBe('montserrat');
    expect(isRtl('arabic')).toBe(true); expect(isRtl('hebrew')).toBe(true); expect(isRtl('latin')).toBe(false); expect(isSpaceless('japanese')).toBe(true); expect(isSpaceless('korean')).toBe(false);
    expect(joinWords(['今日', 'は'], 'japanese')).toBe('今日は'); expect(joinWords(['a', 'b'], 'latin')).toBe('a b');
  });
  it('does not uppercase scripts without case', () => { expect(supportsCase('japanese')).toBe(false); expect(styleForText({ ...DEFAULT_CAPTION_STYLE, uppercase: true }, 'こんにちは').upper).toBe(false); expect(styleForText({ ...DEFAULT_CAPTION_STYLE, uppercase: true }, 'hello').upper).toBe(true); });
  it('every script font is a real font entry', () => { for (const k of ['noto_jp', 'noto_kr', 'noto_sc', 'noto_arabic', 'noto_devanagari', 'noto_thai', 'noto_hebrew'] as const) expect(FONT_META[k].scripts.length).toBe(1); });
});

describe('building captions from timed words', () => {
  it('cleans raw words: merges punctuation, fixes backwards times and gives every word a duration', () => {
    const w = normalizeWords([tw('Hello', 0, 300), tw(',', 300, 320), tw('world', 200, 200), tw('', 0, 0), tw('!', 500, 510)]);
    expect(w.map(x => x.text)).toEqual(['Hello,', 'world!']); expect(w[1].startMs).toBeGreaterThanOrEqual(w[0].endMs - 1); for (const x of w) expect(x.endMs - x.startMs).toBeGreaterThanOrEqual(40);
  });
  it('groups into lines by word limit, character limit, pauses and sentence ends', () => {
    expect(buildLines(SENTENCE, { maxWords: 3 }).map(l => l.length)).toEqual([3, 3, 2]);
    expect(buildLines([tw('a', 0, 100), tw('b', 2000, 2100)], { maxWords: 9 }).length).toBe(2);
    expect(buildLines([tw('One', 0, 100), tw('two.', 100, 200), tw('Three', 200, 300), tw('four', 300, 400)], { maxWords: 9 }).map(l => l.length)).toEqual([2, 2]);
    expect(buildLines([tw('supercalifragilistic', 0, 100), tw('expialidocious', 100, 200)], { maxChars: 25 }).length).toBe(2);
  });
  it('turns words into caption clips with word times relative to each clip', () => {
    const clips = caps(SENTENCE, { maxWords: 4 });
    expect(clips.length).toBe(2); expect(clips[0].kind).toBe('caption'); expect(clips[0].sourceClipId).toBe('v'); expect(clips[0].text).toBe('Pineapple belongs on pizza,');
    expect(clips[0].words![0].s).toBe(0); expect(clips[0].words!.every(w => w.e > w.s && w.s >= 0 && w.e <= clips[0].duration)).toBe(true);
    expect(clips[1].start).toBeGreaterThanOrEqual(clips[0].start + 1); expect(clips[0].start + clips[0].duration).toBeLessThanOrEqual(clips[1].start + 1);
  });
  it('respects the video clip\'s trim and position, and drops words outside the visible window', () => {
    const trimmed: Clip = { ...video, start: 60, trimStart: 30, duration: 60 };   // shows source frames 30..90 = 1s..3s, at timeline frame 60
    const clips = wordsToClips(SENTENCE, trimmed, 'c1', FPS, id, { maxWords: 9 });
    const joined = clips.map(c => c.text).join(' ');
    expect(joined).not.toMatch(/Pineapple/); expect(joined).toMatch(/pizza/); expect(clips[0].start).toBeGreaterThanOrEqual(60); for (const c of clips) expect(c.start + c.duration).toBeLessThanOrEqual(120);
  });
  it('spreads older text-only captions evenly and finds the spoken word at a frame', () => {
    const old: Clip = { id: 'o', trackId: 'c1', kind: 'caption', label: 'Caption', start: 0, duration: 60, trimStart: 0, text: 'one two three' };
    const w = ensureWords(old); expect(w.map(x => x.t)).toEqual(['one', 'two', 'three']); expect(w[0].s).toBe(0); expect(w[2].e).toBe(60);
    expect(activeWordIndex(w, -1)).toBe(-1); expect(activeWordIndex(w, 0)).toBe(0); expect(activeWordIndex(w, 25)).toBe(1); expect(activeWordIndex(w, 59)).toBe(2);
  });
  it('handles Japanese without inserting spaces', () => {
    const jp = wordsToClips([tw('今日', 0, 400), tw('は', 400, 600), tw('晴れ', 600, 1000)], video, 'c1', FPS, id, { maxWords: 9 });
    expect(jp[0].text).toBe('今日は晴れ');
  });
});

describe('editing the transcript', () => {
  const base = () => caps(SENTENCE, { maxWords: 4 });
  it('edits, deletes and adds words and keeps the clip text in step', () => {
    let c = base(); const first = c[0].id;
    c = editWord(c, first, 0, 'Pineapples'); expect(clipText(c[0])).toBe('Pineapples belongs on pizza,');
    c = deleteWord(c, first, 1); expect(clipText(c[0])).toBe('Pineapples on pizza,');
    c = addWordAfter(c, first, 0, 'really'); expect(clipText(c[0])).toBe('Pineapples really on pizza,'); expect(c[0].words!.every(w => w.e > w.s)).toBe(true);
    c = editWord(c, first, 0, '   '); expect(clipText(c[0])).toBe('really on pizza,');
  });
  it('removes a caption when its last word is deleted, and never mutates its input', () => {
    const one = wordsToClips([tw('Hi', 0, 300)], video, 'c1', FPS, id); const snapshot = JSON.stringify(one);
    expect(deleteWord(one, one[0].id, 0)).toEqual([]); expect(JSON.stringify(one)).toBe(snapshot);
  });
  it('splits a caption at a word and merges it back', () => {
    const c = base(); const split = splitClip(c, c[0].id, 2, id);
    expect(split.length).toBe(3); expect(clipText(split[0])).toBe('Pineapple belongs'); expect(clipText(split[1])).toBe('on pizza,'); expect(split[1].start).toBeGreaterThan(split[0].start);
    expect(split[0].start + split[0].duration).toBe(split[1].start); expect(split[1].words![0].s).toBe(0);
    const merged = mergeWithNext(split, split[0].id); expect(merged.length).toBe(2); expect(clipText(merged[0])).toBe('Pineapple belongs on pizza,'); expect(merged[0].duration).toBe(c[0].duration);
    expect(splitClip(c, c[0].id, 0, id)).toBe(c); expect(splitClip(c, c[0].id, 99, id)).toBe(c);
  });
  it('nudges a caption boundary by 0.1 s without overlapping neighbours or collapsing', () => {
    const c = base(); const a = c[0], b = c[1];
    const later = nudgeBoundary(c, a.id, 'end', 3); expect(later[0].duration).toBeLessThanOrEqual(b.start - a.start);
    const earlier = nudgeBoundary(c, b.id, 'start', -3); expect(earlier[1].start).toBeGreaterThanOrEqual(a.start + a.duration);
    const squeeze = nudgeBoundary(c, a.id, 'end', -1000); expect(squeeze[0].duration).toBeGreaterThanOrEqual(3);
    const startLater = nudgeBoundary(c, a.id, 'start', 3); expect(startLater[0].start).toBe(a.start + 3); expect(startLater[0].words![0].s).toBe(0);
  });
  it('nudges one word\'s timing inside its neighbours', () => {
    const c = base(); const moved = nudgeWord(c, c[0].id, 1, 'start', 3); expect(moved[0].words![1].s).toBe(c[0].words![1].s + 3);
    const clamped = nudgeWord(c, c[0].id, 1, 'start', -999); expect(clamped[0].words![1].s).toBeGreaterThanOrEqual(c[0].words![0].s);
  });
  it('finds and replaces words and phrases, with case and punctuation handling', () => {
    const c = base();
    expect(countMatches(c, 'pizza')).toBe(1); expect(countMatches(c, 'PIZZA')).toBe(1); expect(countMatches(c, 'PIZZA', { matchCase: true })).toBe(0);
    const r = findReplace(c, 'pizza', 'pasta'); expect(r.count).toBe(1); expect(r.clips.map(clipText).join(' ')).toMatch(/pasta,?/);
    const phrase = findReplace(c, 'belongs on', 'goes on top of'); expect(phrase.count).toBe(1); expect(clipText(phrase.clips[0])).toBe('Pineapple goes on top of pizza,');
    expect(phrase.clips[0].words!.every(w => w.e > w.s)).toBe(true); expect(findReplace(c, 'zzz', 'y').count).toBe(0); expect(findReplace(c, '   ', 'y').count).toBe(0);
    expect(findReplace(c, 'pizza', '').clips.map(clipText).join(' ')).not.toMatch(/pizza/);
  });
  it('converts case: upper, lower, title and sentence', () => {
    const c = base();
    expect(clipText(convertCase(c, 'upper')[0])).toBe('PINEAPPLE BELONGS ON PIZZA,'); expect(clipText(convertCase(c, 'lower')[0])).toBe('pineapple belongs on pizza,');
    expect(clipText(convertCase(c, 'title')[0])).toBe('Pineapple Belongs On Pizza,');
    const s = convertCase(c, 'sentence'); expect(clipText(s[0])).toBe('Pineapple belongs on pizza,'); expect(clipText(s[1])).toBe('and anyone who disagrees.');
    const afterStop = convertCase(caps([tw('Done.', 0, 300), tw('next', 400, 700), tw('thing', 750, 1000)], { maxWords: 1 }), 'sentence'); expect(afterStop.map(clipText)).toEqual(['Done.', 'Next', 'thing']);
  });
  it('copies the transcript, one caption per line', () => { expect(transcriptText(base())).toBe('Pineapple belongs on pizza,\nand anyone who disagrees.'); });
  it('re-lines everything with a different word limit while keeping every word and its time', () => {
    const c = base(); const wide = resegment(c, FPS, { maxWords: 8 }, id); const narrow = resegment(c, FPS, { maxWords: 2 }, id);
    const all = (cl: Clip[]) => cl.flatMap(k => (k.words ?? []).map(w => w.t)).join(' ');
    expect(all(wide)).toBe(all(c)); expect(all(narrow)).toBe(all(c)); expect(narrow.length).toBeGreaterThan(wide.length);
    for (const k of narrow) expect(k.words!.length).toBeLessThanOrEqual(2);
    const start = (cl: Clip[]) => Math.min(...cl.map(k => k.start)); expect(start(narrow)).toBe(start(c));
  });
  it('leaves non-caption clips alone', () => { const mixed = [video, ...base()]; expect(convertCase(mixed, 'upper')[0]).toBe(video); expect(resegment(mixed, FPS, { maxWords: 2 }, id)[0]).toBe(video); });
});

describe('exports', () => {
  const clips = caps(SENTENCE, { maxWords: 4 }); const style = styleFromPreset('karaoke');
  it('writes SRT with numbered cues and comma times', () => {
    const srt = toSrt(clips, FPS); expect(srt).toMatch(/^1\n00:00:00,\d{3} --> 00:00:0\d,\d{3}\nPineapple belongs on pizza,\n\n2\n/); expect((srt.match(/-->/g) ?? []).length).toBe(2);
  });
  it('writes VTT with a header and dot times', () => { const vtt = toVtt(clips, FPS); expect(vtt.startsWith('WEBVTT\n\n')).toBe(true); expect(vtt).toMatch(/00:00:00\.\d{3} --> /); expect(vtt).not.toMatch(/\d,\d{3}/); });
  it('writes the plain transcript', () => { expect(toTxt(clips)).toBe('Pineapple belongs on pizza,\nand anyone who disagrees.\n'); });
  it('writes JSON with word times in seconds', () => {
    const j = JSON.parse(toJson(clips, FPS, style)); expect(j.captions.length).toBe(2); expect(j.captions[0].words[0]).toMatchObject({ text: 'Pineapple' }); expect(j.captions[0].words[0].end).toBeGreaterThan(j.captions[0].words[0].start); expect(j.style.presetId).toBe('karaoke');
  });
  it('writes ASS with the style, a position, and per-word karaoke tags', () => {
    const ass = toAss(clips, FPS, style);
    expect(ass).toContain('[Script Info]'); expect(ass).toContain('PlayResX: 1080'); expect(ass).toMatch(/Style: Caption,Montserrat,80,/); expect(ass).toMatch(/Dialogue: 0,0:00:00\.\d{2},0:00:0\d\.\d{2},Caption,,0,0,0,,\{\\kf\d+\}PINEAPPLE/);
    expect(ass.match(/\{\\kf\d+\}/g)!.length).toBe(8);   // karaoke_fill uses the wipe tag, one per word
    expect(toAss(clips, FPS, styleFromPreset('hormozi'))).toMatch(/\{\\k\d+\}/);
    const high = toAss(clips, FPS, { ...style, positionY: 50 }); expect(high).toMatch(/,60,60,960,1/);
  });
  it('ASS colours are BGR, and text with braces or backslashes cannot inject tags', () => {
    const evil = [{ ...clips[0], words: [{ t: '{\\an8}hi\\N', s: 0, e: 10 }], text: '{\\an8}hi' }];
    const ass = toAss(evil, FPS, { ...style, colors: { ...style.colors, highlight: '#112233' } });
    expect(ass).toMatch(/&H00332211/); expect(ass).not.toMatch(/\{\\an8\}/); expect(ass).not.toMatch(/hi\\N/);
  });
  it('does not uppercase ASS text for scripts without case, and uses a script font', () => {
    const jp = wordsToClips([tw('こんにちは', 0, 800)], video, 'c1', FPS, id); expect(toAss(jp, FPS, styleFromPreset('hormozi'))).toMatch(/Style: Caption,Noto Sans JP,/);
  });
  it('exportCaptions dispatches by format, and every format writes something for a non-empty transcript', () => {
    for (const f of ['srt', 'vtt', 'txt', 'ass', 'json'] as const) expect(exportCaptions(f, clips, FPS, style).length, f).toBeGreaterThan(20);
    for (const f of ['srt', 'vtt', 'txt', 'ass', 'json'] as const) expect(() => exportCaptions(f, [], FPS, style), f).not.toThrow();
  });
  it('ignores non-caption and empty clips', () => { expect(toSrt([video, { ...clips[0], text: '', words: [] }], FPS)).toBe(''); });
});

import { getCachedTranscript, listVersions, putCachedTranscript, saveVersion, transcriptKey, type KV } from './cache';
const memKv = (): KV & { data: Record<string, string> } => { const data: Record<string, string> = {}; return { data, getItem: k => data[k] ?? null, setItem: (k, v) => { data[k] = v; }, removeItem: k => { delete data[k]; } }; };

describe('transcript cache and caption versions', () => {
  it('finds a transcript by media, engine, model and language (ignoring the URL query)', () => {
    const kv = memKv(); const k = transcriptKey('https://x/a.mp4?token=1', 'transformers', 'base', 'en');
    putCachedTranscript({ key: k, words: [{ text: 'hi', startMs: 0, endMs: 100 }], wordTimed: true, engine: 'transformers' }, 1, kv);
    expect(getCachedTranscript(transcriptKey('https://x/a.mp4?token=2', 'transformers', 'base', 'en'), kv)?.words[0].text).toBe('hi');
    expect(getCachedTranscript(transcriptKey('https://x/a.mp4', 'transformers', 'small', 'en'), kv)).toBeNull();
  });
  it('keeps only the newest transcripts and survives corrupt or missing storage', () => {
    const kv = memKv(); for (let i = 0; i < 20; i++) putCachedTranscript({ key: `k${i}`, words: [], wordTimed: true, engine: 'x' }, i, kv);
    expect(JSON.parse(kv.data['subwaytakes.transcripts.v1']).length).toBe(12); expect(getCachedTranscript('k19', kv)).not.toBeNull(); expect(getCachedTranscript('k0', kv)).toBeNull();
    kv.data['subwaytakes.transcripts.v1'] = '{oops'; expect(getCachedTranscript('k19', kv)).toBeNull(); expect(getCachedTranscript('k', null)).toBeNull();
    expect(() => putCachedTranscript({ key: 'z', words: [], wordTimed: true, engine: 'x' }, 1, null)).not.toThrow();
  });
  it('keeps the last 5 versions per project, newest first, without touching other projects', () => {
    const kv = memKv(); const st = styleFromPreset('hormozi');
    for (let i = 0; i < 7; i++) saveVersion('p1', { id: `v${i}`, at: i, label: `v${i}`, clips: [], style: st }, kv);
    saveVersion('p2', { id: 'o', at: 0, label: 'o', clips: [], style: st }, kv);
    expect(listVersions('p1', kv).map(v => v.id)).toEqual(['v6', 'v5', 'v4', 'v3', 'v2']); expect(listVersions('p2', kv).length).toBe(1);
  });
});

describe('review fixes', () => {
  const cap = (id: string, start: number, dur: number, words: Array<[string, number, number]>, src?: string): Clip => ({ id, trackId: 'c1', kind: 'caption', label: 'C', start, duration: dur, trimStart: 0, text: words.map(w => w[0]).join(' '), words: words.map(([t, s, e]) => ({ t, s, e })), sourceClipId: src });
  it('split never leaves a word that ends before it starts', () => {
    const out = splitClip([cap('a', 0, 40, [['A', 0, 5], ['B', 30, 36], ['C', 37, 39]])], 'a', 2, () => 'n');
    for (const c of out) for (const w of c.words!) expect(w.e).toBeGreaterThan(w.s);
  });
  it('re-segmenting never mixes two shots into one line', () => {
    const out = resegment([cap('a', 0, 30, [['x', 0, 10], ['y', 12, 28]], 'S1'), cap('b', 30, 30, [['z', 0, 10], ['w', 12, 28]], 'S2')], 30, { maxWords: 8 }, (() => { let i = 0; return () => `n${i++}`; })());
    const caps = out.filter(c => c.kind === 'caption');
    expect(caps.map(c => c.sourceClipId)).toEqual(['S1', 'S2']); expect(caps.map(c => c.text)).toEqual(['x y', 'z w']);
  });
  it('ASS keeps the silence before the first word, and VTT escapes markup', () => {
    const c = cap('a', 0, 60, [['hello', 15, 30]]);
    expect(toAss([c], 30, styleFromPreset('hormozi'))).toMatch(/,,\{\\k50\}\{\\k\d+\}HELLO|,,\{\\k50\}\{\\k\d+\}hello/);
    expect(toVtt([cap('b', 0, 30, [['a<b', 0, 10], ['&', 11, 20]])], 30)).toContain('a&lt;b &amp;');
  });
});

import { splitAt, trimClip, updateClip } from '../timeline/ops';
import type { Project } from '../timeline/types';
describe('trimming and splitting a caption on the timeline keeps its words in time', () => {
  const cap = (over: Partial<Clip> = {}): Clip => ({ id: 'c', trackId: 'c1', kind: 'caption', label: 'C', start: 100, duration: 60, trimStart: 0, text: 'one two three four', words: [{ t: 'one', s: 0, e: 14 }, { t: 'two', s: 15, e: 29 }, { t: 'three', s: 30, e: 44 }, { t: 'four', s: 45, e: 59 }], ...over });
  const proj = (c: Clip): Project => ({ fps: 30, tracks: [{ id: 'c1', kind: 'caption', name: 'Captions' }], clips: [c] });
  it('a left trim moves the word times with the edge, drops words that ended and keeps the text in step', () => {
    const out = trimClip(proj(cap()), 'c', 'left', 20).clips[0];
    expect(out.start).toBe(120); expect(out.duration).toBe(40);
    expect(out.words!.map(w => w.t)).toEqual(['two', 'three', 'four']); expect(out.words![0].s).toBe(0);   // "two" was at 15 to 29: now it is the first word, it keeps its place against the speech
    expect(out.words![1]).toMatchObject({ t: 'three', s: 10, e: 24 }); expect(out.text).toBe('two three four');
  });
  it('extending a caption to the left shifts the words later and keeps all of them', () => {
    const out = trimClip(proj(cap()), 'c', 'left', -10).clips[0]; expect(out.start).toBe(90); expect(out.words!.map(w => w.s)).toEqual([10, 25, 40, 55]);
  });
  it('a right trim drops words that start after the new end and clips the last one', () => {
    const out = trimClip(proj(cap()), 'c', 'right', -25).clips[0]; expect(out.duration).toBe(35);
    expect(out.words!.map(w => w.t)).toEqual(['one', 'two', 'three']); expect(out.words![2].e).toBeLessThanOrEqual(35); expect(out.text).toBe('one two three');
  });
  it('a split gives each half only its own words, timed against its own start', () => {
    const out = splitAt(proj(cap()), 130, 'c').clips.sort((a, b) => a.start - b.start);
    expect(out).toHaveLength(2); expect(out[0].words!.map(w => w.t)).toEqual(['one', 'two']); expect(out[1].words!.map(w => w.t)).toEqual(['three', 'four']);
    expect(out[1].words![0].s).toBe(0); expect(out[0].text).toBe('one two'); expect(out[1].text).toBe('three four');
    for (const h of out) for (const w of h.words!) { expect(w.s).toBeGreaterThanOrEqual(0); expect(w.e).toBeLessThanOrEqual(h.duration); expect(w.e).toBeGreaterThan(w.s); }
  });
  it('a split that would leave one side with no words changes nothing', () => { const p = proj(cap({ words: [{ t: 'one', s: 0, e: 10 }], text: 'one' })); expect(splitAt(p, 150, 'c')).toBe(p); });
  it('captions from before words existed (text only) still trim and split like any clip', () => {
    const old = cap({ words: undefined }); expect(trimClip(proj(old), 'c', 'left', 10).clips[0].words).toBeUndefined(); expect(splitAt(proj(old), 130, 'c').clips).toHaveLength(2);
  });
  it('editing the text in the Clip tab drops the stored words so the preview and the export use the new text', () => {
    const out = updateClip(proj(cap()), 'c', { text: 'fixed typo here', words: undefined }).clips[0]; expect(out.words).toBeUndefined();
    expect(ensureWords(out).map(w => w.t)).toEqual(['fixed', 'typo', 'here']); expect(clipText(out)).toBe('fixed typo here');
  });
});
