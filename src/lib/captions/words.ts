import type { Clip } from '../timeline/types';
import type { CaptionWord } from './model';
import { detectScript, isSpaceless, joinWords, type Script } from './scripts';

/** A word as the speech engines return it: times in milliseconds against the SOURCE media. */
export interface TimedWord { text: string; startMs: number; endMs: number }

const PUNCT_ONLY = /^[\s.,!?;:…。、！？，、"'”’)\]}»-]+$/;
const SENTENCE_END = /[.!?…。！？]["'”’)]*$/;

/** Clean a raw word list: trim, merge stray punctuation into the previous word, fix times that run backwards, make every word last at least 40 ms. */
export function normalizeWords(input: TimedWord[]): TimedWord[] {
  const out: TimedWord[] = [];
  for (const w of input) {
    const text = (w.text ?? '').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const prev = out[out.length - 1];
    if (PUNCT_ONLY.test(text) && prev) { prev.text += text; prev.endMs = Math.max(prev.endMs, w.endMs); continue; }
    let start = Number.isFinite(w.startMs) ? Math.max(0, w.startMs) : (prev?.endMs ?? 0);
    if (prev && start < prev.startMs) start = prev.endMs;
    let end = Number.isFinite(w.endMs) ? w.endMs : start + 200;
    if (end < start + 40) end = start + 40;
    out.push({ text, startMs: Math.round(start), endMs: Math.round(end) });
  }
  // a word must not start before the one before it ends
  for (let i = 1; i < out.length; i++) if (out[i].startMs < out[i - 1].endMs) out[i - 1].endMs = Math.max(out[i - 1].startMs + 40, out[i].startMs);
  return out;
}

export interface LineOptions { maxWords: number; maxChars: number; maxGapMs: number }
export const DEFAULT_LINE: LineOptions = { maxWords: 4, maxChars: 30, maxGapMs: 700 };

/** Group words into lines: a new line after a pause, after the word or character limit, or after a sentence end (once the line has two words). */
export function buildLines(words: TimedWord[], opts: Partial<LineOptions> = {}): TimedWord[][] {
  const o = { ...DEFAULT_LINE, ...opts };
  const lines: TimedWord[][] = []; let cur: TimedWord[] = [];
  const chars = (l: TimedWord[]) => l.reduce((n, w) => n + w.text.length + 1, 0);
  for (const w of words) {
    const last = cur[cur.length - 1];
    const gap = last ? w.startMs - last.endMs : 0;
    if (cur.length && (cur.length >= o.maxWords || chars(cur) + w.text.length > o.maxChars || gap > o.maxGapMs)) { lines.push(cur); cur = []; }
    cur.push(w);
    if (cur.length >= 2 && SENTENCE_END.test(w.text)) { lines.push(cur); cur = []; }
  }
  if (cur.length) lines.push(cur);
  return lines;
}

const toFrames = (ms: number, fps: number) => Math.round((ms * fps) / 1000);
const MIN_CLIP = 3;
const HOLD = 6;   // frames a line stays after its last word, if the next line is not already there

/**
 * Timed words (against the source media) to caption clips on the timeline. Accounts for the video clip's trim and position, drops words outside
 * the visible window, and gives every clip word times relative to its own start.
 */
export function wordsToClips(words: TimedWord[], video: Clip, trackId: string, fps: number, newId: () => string, opts: Partial<LineOptions> = {}): Clip[] {
  const winStart = video.trimStart, winEnd = video.trimStart + video.duration;
  const visible = normalizeWords(words).filter(w => toFrames(w.endMs, fps) > winStart && toFrames(w.startMs, fps) < winEnd);
  const lines = buildLines(visible, opts);
  const out: Clip[] = [];
  lines.forEach((line, i) => {
    const s0 = Math.max(toFrames(line[0].startMs, fps), winStart);
    const nextStart = lines[i + 1] ? Math.max(toFrames(lines[i + 1][0].startMs, fps), winStart) : winEnd;
    const lastEnd = toFrames(line[line.length - 1].endMs, fps);
    const e0 = Math.min(Math.max(lastEnd, s0 + MIN_CLIP) + HOLD, Math.max(nextStart, lastEnd), winEnd);
    const e = Math.max(e0, Math.min(s0 + MIN_CLIP, winEnd));
    if (e - s0 < MIN_CLIP) return;
    const cw: CaptionWord[] = line.map(w => ({ t: w.text, s: Math.max(0, toFrames(w.startMs, fps) - s0), e: Math.min(e - s0, Math.max(toFrames(w.endMs, fps) - s0, toFrames(w.startMs, fps) - s0 + 1)) }));
    const script = detectScript(line.map(w => w.text).join(' '));
    out.push({ id: newId(), trackId, kind: 'caption', label: 'Caption', text: joinWords(cw.map(x => x.t), script), words: cw, start: video.start + (s0 - winStart), duration: e - s0, trimStart: 0, sourceClipId: video.id });
  });
  return out;
}

/** Words for a caption clip that has none (older captions, or a cloud transcript with only line times): spread evenly across the clip. */
export function ensureWords(clip: Clip): CaptionWord[] {
  if (clip.words?.length) return clip.words;
  const text = (clip.text ?? '').trim();
  if (!text) return [];
  const script = detectScript(text);
  const tokens = isSpaceless(script) ? [text] : text.split(/\s+/);
  const per = clip.duration / tokens.length;
  return tokens.map((t, i) => ({ t, s: Math.round(i * per), e: Math.round((i + 1) * per) }));
}

/** The index of the word being spoken at a frame (relative to the clip start): the last word that has begun. -1 before the first word. */
export function activeWordIndex(words: readonly CaptionWord[], frame: number): number {
  let idx = -1;
  for (let i = 0; i < words.length; i++) { if (words[i].s <= frame) idx = i; else break; }
  return idx;
}

/** Text of a clip as shown (words joined for its script), falling back to the stored text. */
export function clipText(clip: Clip): string {
  if (!clip.words?.length) return (clip.text ?? '').trim();
  return joinWords(clip.words.map(w => w.t), detectScript(clip.words.map(w => w.t).join(' '))).trim();
}

export const scriptOfClips = (clips: Clip[]): Script => detectScript(clips.map(clipText).join(' '));
