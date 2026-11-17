import type { Clip } from '../timeline/types';
import type { CaptionWord } from './model';
import { NUDGE_FRAMES } from './model';
import { detectScript, joinWords } from './scripts';
import { buildLines, ensureWords, clipText, type LineOptions, type TimedWord } from './words';

// Pure edit operations for the transcript editor. Every function takes the project's clips and returns new ones (the input is never mutated).
// Caption clips carry word times in frames relative to their own start.

const MIN_CLIP = 3;
const isCaption = (c: Clip): boolean => c.kind === 'caption';

function textOf(words: CaptionWord[]): string { return joinWords(words.map(w => w.t), detectScript(words.map(w => w.t).join(' '))); }
function withWords(c: Clip, words: CaptionWord[]): Clip { return { ...c, words, text: textOf(words) }; }
const swap = (clips: Clip[], id: string, fn: (c: Clip) => Clip | null): Clip[] => clips.flatMap(c => { if (c.id !== id) return [c]; const r = fn(c); return r ? [r] : []; });
const captionsOnTrack = (clips: Clip[], c: Clip): Clip[] => clips.filter(x => isCaption(x) && x.trackId === c.trackId).sort((a, b) => a.start - b.start);

/** Words of a clip, filling in even timings for older captions that have none. */
function wordsOf(c: Clip): CaptionWord[] { return ensureWords(c).map(w => ({ ...w })); }

/** Change the text of one word. An empty text deletes it. */
export function editWord(clips: Clip[], id: string, index: number, text: string): Clip[] {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t) return deleteWord(clips, id, index);
  return swap(clips, id, c => { const w = wordsOf(c); if (!w[index]) return c; w[index] = { ...w[index], t }; return withWords(c, w); });
}

/** Remove one word. A clip with no words left is removed. */
export function deleteWord(clips: Clip[], id: string, index: number): Clip[] {
  return swap(clips, id, c => { const w = wordsOf(c); if (!w[index]) return c; w.splice(index, 1); return w.length ? withWords(c, w) : null; });
}

/** Insert a word after another, taking half of that word's time. */
export function addWordAfter(clips: Clip[], id: string, index: number, text: string): Clip[] {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t) return clips;
  return swap(clips, id, c => {
    const w = wordsOf(c); const ref = w[index]; if (!ref) return c;
    const mid = Math.max(ref.s + 1, Math.floor((ref.s + ref.e) / 2));
    const next: CaptionWord = { t, s: mid, e: Math.max(mid + 1, ref.e) };
    w[index] = { ...ref, e: mid };
    w.splice(index + 1, 0, next);
    return withWords(c, w);
  });
}

/** Split a caption into two at a word (the word starts the second caption). */
export function splitClip(clips: Clip[], id: string, atWord: number, newId: () => string): Clip[] {
  const c = clips.find(x => x.id === id); if (!c) return clips;
  const w = wordsOf(c);
  if (atWord < 1 || atWord >= w.length) return clips;
  const cut = Math.min(Math.max(w[atWord].s, MIN_CLIP), c.duration - MIN_CLIP);
  if (cut < MIN_CLIP || c.duration - cut < MIN_CLIP) return clips;
  const left = w.slice(0, atWord).map(x => { const s = Math.min(x.s, cut - 1); return { ...x, s, e: Math.max(s + 1, Math.min(x.e, cut)) }; });
  const right = w.slice(atWord).map(x => ({ t: x.t, s: Math.max(0, x.s - cut), e: Math.max(1, x.e - cut) }));
  const a: Clip = withWords({ ...c, duration: cut }, left);
  const b: Clip = withWords({ ...c, id: newId(), start: c.start + cut, duration: c.duration - cut }, right);
  return clips.flatMap(x => (x.id === id ? [a, b] : [x]));
}

/** Join a caption with the one after it on the same track. */
export function mergeWithNext(clips: Clip[], id: string): Clip[] {
  const c = clips.find(x => x.id === id); if (!c) return clips;
  const list = captionsOnTrack(clips, c); const i = list.findIndex(x => x.id === id);
  const n = list[i + 1]; if (!n) return clips;
  const shift = n.start - c.start;
  const merged = withWords({ ...c, duration: n.start + n.duration - c.start }, [...wordsOf(c), ...wordsOf(n).map(x => ({ ...x, s: x.s + shift, e: x.e + shift }))]);
  return clips.filter(x => x.id !== n.id).map(x => (x.id === id ? merged : x));
}

/** Move a caption's start or end by a number of frames (0.1 s = 3 frames at 30 fps), without overlapping its neighbours or shrinking it below a few frames. */
export function nudgeBoundary(clips: Clip[], id: string, edge: 'start' | 'end', frames: number = NUDGE_FRAMES): Clip[] {
  const c = clips.find(x => x.id === id); if (!c) return clips;
  const list = captionsOnTrack(clips, c); const i = list.findIndex(x => x.id === id);
  const prev = list[i - 1], next = list[i + 1];
  if (edge === 'start') {
    const lo = prev ? prev.start + prev.duration : 0;
    const start = Math.min(Math.max(c.start + frames, lo), c.start + c.duration - MIN_CLIP);
    const d = start - c.start; if (!d) return clips;
    const w = wordsOf(c).map(x => ({ ...x, s: Math.max(0, x.s - d), e: Math.max(1, x.e - d) }));
    return swap(clips, id, k => withWords({ ...k, start, duration: c.duration - d }, w));
  }
  const hi = next ? next.start : Number.POSITIVE_INFINITY;
  const end = Math.min(Math.max(c.start + c.duration + frames, c.start + MIN_CLIP), hi);
  const duration = end - c.start; if (duration === c.duration) return clips;
  const w = wordsOf(c).map(x => ({ ...x, s: Math.min(x.s, duration - 1), e: Math.min(x.e, duration) }));
  return swap(clips, id, k => withWords({ ...k, duration }, w));
}

/** Move one word's start or end (the word timings inside a caption). Stays between its neighbours. */
export function nudgeWord(clips: Clip[], id: string, index: number, edge: 'start' | 'end', frames: number = NUDGE_FRAMES): Clip[] {
  return swap(clips, id, c => {
    const w = wordsOf(c); const x = w[index]; if (!x) return c;
    if (edge === 'start') x.s = Math.min(Math.max(x.s + frames, w[index - 1]?.s ?? 0), x.e - 1);
    else x.e = Math.max(Math.min(x.e + frames, w[index + 1]?.e ?? c.duration), x.s + 1);
    return withWords(c, w);
  });
}

const strip = (s: string): string => s.toLowerCase().replace(/[.,!?;:…"'”’“()[\]{}-]+/g, '');

export interface FindOptions { matchCase?: boolean; wholeWord?: boolean }

/** Count where `find` appears (a word or a phrase) across all captions, in reading order. */
export function countMatches(clips: Clip[], find: string, o: FindOptions = {}): number {
  return findReplace(clips, find, find, o).count;
}

/**
 * Find and replace a word or phrase. Matching ignores punctuation around words; case matters only with `matchCase`. A phrase can run across
 * the words of one caption. The replacement keeps the first matched word's start and the last one's end, split evenly across the new words.
 */
export function findReplace(clips: Clip[], find: string, replace: string, o: FindOptions = {}): { clips: Clip[]; count: number } {
  const needle = find.trim().split(/\s+/).filter(Boolean);
  if (!needle.length) return { clips, count: 0 };
  const norm = (s: string) => (o.matchCase ? s.replace(/[.,!?;:…"'”’“()[\]{}-]+/g, '') : strip(s));
  const n = needle.map(norm);
  let count = 0;
  const out = clips.map(c => {
    if (!isCaption(c)) return c;
    const w = wordsOf(c); const res: CaptionWord[] = []; let changed = false;
    for (let i = 0; i < w.length;) {
      const window = w.slice(i, i + n.length);
      const hit = window.length === n.length && window.every((x, k) => (o.wholeWord === false ? norm(x.t).includes(n[k]) : norm(x.t) === n[k]));
      if (!hit) { res.push(w[i]); i++; continue; }
      count++; changed = true;
      const toks = replace.trim().split(/\s+/).filter(Boolean);
      if (toks.length) {
        const s = window[0].s, e = window[window.length - 1].e, per = (e - s) / toks.length;
        toks.forEach((t, k) => res.push({ t, s: Math.round(s + k * per), e: Math.max(Math.round(s + (k + 1) * per), Math.round(s + k * per) + 1) }));
      }
      i += n.length;
    }
    return changed ? (res.length ? withWords(c, res) : null) : c;
  }).filter((c): c is Clip => c !== null);
  return { clips: out, count };
}

export type CaseMode = 'upper' | 'lower' | 'title' | 'sentence';

/** Change the case of every caption word. Sentence case capitalises the first word and each word after a sentence end. */
export function convertCase(clips: Clip[], mode: CaseMode): Clip[] {
  let capNext = true;
  const cap = (s: string) => s.replace(/^([^\p{L}]*)(\p{L})/u, (_, a: string, b: string) => a + b.toUpperCase());
  return clips.map(c => {
    if (!isCaption(c)) return c;
    const w = wordsOf(c).map(x => {
      let t = x.t;
      if (mode === 'upper') t = t.toUpperCase();
      else if (mode === 'lower') t = t.toLowerCase();
      else if (mode === 'title') t = cap(t.toLowerCase());
      else { t = t.toLowerCase(); if (capNext) t = cap(t); capNext = /[.!?…]["'”’)]*$/.test(t); }
      return { ...x, t };
    });
    return withWords(c, w);
  });
}

/** Plain transcript, one caption per line, for the clipboard. */
export function transcriptText(clips: Clip[]): string {
  return clips.filter(isCaption).sort((a, b) => a.start - b.start).map(clipText).filter(Boolean).join('\n');
}

/** Rebuild the caption clips with a different line length (max words per line), keeping every word's time and the clips' track and source. */
export function resegment(clips: Clip[], fps: number, opts: Partial<LineOptions>, newId: () => string): Clip[] {
  const caps = clips.filter(isCaption).sort((a, b) => a.start - b.start);
  if (!caps.length) return clips;
  const words: TimedWord[] = []; const owner = new Map<TimedWord, Clip>();
  for (const c of caps) for (const w of wordsOf(c)) { const t: TimedWord = { text: w.t, startMs: ((c.start + w.s) * 1000) / fps, endMs: ((c.start + w.e) * 1000) / fps }; words.push(t); owner.set(t, c); }
  const lines = buildLines(words, opts).flatMap(line => {   // never mix words of two different shots in one line (it would carry only the first shot's id)
    const out: TimedWord[][] = []; let cur: TimedWord[] = [];
    for (const w of line) { if (cur.length && owner.get(cur[0])!.sourceClipId !== owner.get(w)!.sourceClipId) { out.push(cur); cur = []; } cur.push(w); }
    if (cur.length) out.push(cur); return out;
  });
  const toF = (ms: number) => Math.round((ms * fps) / 1000);
  const rebuilt: Clip[] = lines.map((line, i) => {
    const base = owner.get(line[0])!;
    const s = toF(line[0].startMs); const nextS = lines[i + 1] ? toF(lines[i + 1][0].startMs) : Number.POSITIVE_INFINITY;
    const e = Math.max(Math.min(toF(line[line.length - 1].endMs) + 6, nextS), s + MIN_CLIP);
    const cw = line.map(x => ({ t: x.text, s: Math.max(0, toF(x.startMs) - s), e: Math.min(e - s, Math.max(toF(x.endMs) - s, toF(x.startMs) - s + 1)) }));
    return { ...base, id: newId(), start: s, duration: e - s, words: cw, text: textOf(cw) };
  });
  return [...clips.filter(c => !isCaption(c)), ...rebuilt];
}
