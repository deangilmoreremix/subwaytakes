import { parseSrt, type Caption } from '@remotion/captions';
import type { Clip } from '../timeline/types';

/** Pull transcript text out of whatever shape muapi returned (SRT/plain text in `text`, `outputs[0]`, or `output`). */
export function extractTranscript(prediction: unknown): string {
  if (!prediction || typeof prediction !== 'object') return '';
  const p = prediction as Record<string, unknown>;
  const candidates: unknown[] = [p.text, Array.isArray(p.outputs) ? p.outputs[0] : undefined, p.output, (p.result as Record<string, unknown> | undefined)?.text];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c;
    if (c && typeof c === 'object' && typeof (c as { text?: unknown }).text === 'string') return (c as { text: string }).text;
  }
  return '';
}

const looksLikeSrt = (s: string) => /\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}\s*-->\s*\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}/.test(s);

/** Parse a transcript into timed captions. SRT keeps its timings; plain text is spread evenly over `fallbackDurationMs`. */
export function transcriptToCaptions(transcript: string, fallbackDurationMs: number, chunkWords = 6): Caption[] {
  const t = transcript.trim();
  if (!t) return [];
  if (looksLikeSrt(t)) return parseSrt({ input: t.replace(/\r/g, '') }).captions;
  const words = t.split(/\s+/);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += chunkWords) chunks.push(words.slice(i, i + chunkWords).join(' '));
  const per = fallbackDurationMs / chunks.length;
  return chunks.map((text, i) => ({ text, startMs: Math.round(i * per), endMs: Math.round((i + 1) * per), timestampMs: null, confidence: null }));
}

/**
 * Map captions timed against the clip's SOURCE media onto the timeline.
 * Accounts for the clip's trim and position; clips captions to the visible window and drops slivers (< 3 frames).
 */
export function captionsToClips(captions: Caption[], video: Clip, trackId: string, fps: number, newId: () => string): Clip[] {
  const winStart = video.trimStart;
  const winEnd = video.trimStart + video.duration;
  const out: Clip[] = [];
  for (const c of captions) {
    const s = Math.max(Math.round((c.startMs * fps) / 1000), winStart);
    const e = Math.min(Math.round((c.endMs * fps) / 1000), winEnd);
    if (e - s < 3 || !c.text.trim()) continue;
    out.push({
      id: newId(), trackId, kind: 'caption', label: 'Caption', text: c.text.trim().replace(/\s+/g, ' '),
      start: video.start + (s - winStart), duration: e - s, trimStart: 0, sourceClipId: video.id,
    });
  }
  return out;
}
