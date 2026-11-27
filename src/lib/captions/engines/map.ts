import type { TimedWord } from '../words';

// Pure converters from what each engine returns to our TimedWord list (milliseconds against the source media).

/** Transformers.js word chunks: `{ text: ' word', timestamp: [startSec, endSec | null] }`. */
export interface HfChunk { text: string; timestamp: [number | null, number | null] }
export function hfChunksToWords(chunks: HfChunk[], durationSec: number): TimedWord[] {
  const out: TimedWord[] = [];
  for (const c of chunks) {
    const text = (c.text ?? '').trim();
    if (!text) continue;
    const s = c.timestamp?.[0]; let e = c.timestamp?.[1];
    if (s == null || !Number.isFinite(s)) continue;
    if (e == null || !Number.isFinite(e)) e = Math.min(durationSec, s + 0.4);   // the model leaves the last word open-ended
    out.push({ text, startMs: Math.round(s * 1000), endMs: Math.round(e * 1000) });
  }
  return out;
}

/** whisper.cpp tokens: pieces of words. A token whose text starts with a space begins a new word. Special tokens look like `[_BEG_]` or `<|...|>`. */
export interface CppToken { text: string; offsets: { from: number; to: number } }
const SPECIAL = /^\s*(\[_[A-Z_0-9]+\]|<\|[^|]*\|>|\[[A-Z_ ]+\])\s*$/;
export function cppTokensToWords(items: Array<{ tokens: CppToken[] }>): TimedWord[] {
  const out: TimedWord[] = [];
  let cur: TimedWord | null = null;
  for (const item of items) for (const t of item.tokens ?? []) {
    if (!t.text || SPECIAL.test(t.text)) continue;
    const startsWord = /^\s/.test(t.text) || cur === null;
    const piece = t.text.replace(/^\s+/, '');
    if (!piece) continue;
    if (startsWord) { if (cur) out.push(cur); cur = { text: piece, startMs: t.offsets.from, endMs: t.offsets.to }; }
    else { cur!.text += piece; cur!.endMs = Math.max(cur!.endMs, t.offsets.to); }
  }
  if (cur) out.push(cur);
  return out;
}

/** Lines with only line times (SRT from the cloud engine): spread the words evenly across each line. */
export function spreadLines(lines: Array<{ text: string; startMs: number; endMs: number }>): TimedWord[] {
  const out: TimedWord[] = [];
  for (const l of lines) {
    const ws = l.text.split(/\s+/).filter(Boolean);
    if (!ws.length) continue;
    const step = Math.max(1, (l.endMs - l.startMs) / ws.length);
    ws.forEach((w, i) => out.push({ text: w, startMs: Math.round(l.startMs + i * step), endMs: Math.round(l.startMs + (i + 1) * step) }));
  }
  return out;
}

/** Map a UI language code to Whisper's (it uses 'auto' for detection and plain ISO codes otherwise). */
export function whisperLanguage(code: string): string | undefined { return !code || code === 'auto' ? undefined : code.split('-')[0].toLowerCase(); }
