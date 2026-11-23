/**
 * Faceless narrated videos: a script is read aloud over a few generated pictures that drift slowly, with the words on screen.
 * No talking face, so it is the cheapest kind of video the app makes (one voice call and a handful of images).
 * This file is pure: the script and its scenes, timing, prompts and timeline placement. The paid calls are in pipeline.ts.
 *
 * Text rules: a quote or a verse is spoken and shown EXACTLY as given (it comes from the verified libraries or the customer's own typing),
 * never rewritten, never trimmed; only the pictures are generated.
 */
import type { Clip, Project } from '../timeline/types';
import { addClip, newId, projectDuration } from '../timeline/ops';

export type NarratedKind = 'story' | 'listicle' | 'quote' | 'verse';
export const KINDS: ReadonlyArray<{ id: NarratedKind; label: string; hint: string }> = [
  { id: 'story', label: 'Story', hint: 'Your own text, read over pictures' },
  { id: 'listicle', label: 'List', hint: '"5 things..." with one picture per item' },
  { id: 'quote', label: 'Quote', hint: 'A verified quote from the library, spoken word for word' },
  { id: 'verse', label: 'Verse', hint: 'A verse from the library, spoken word for word' },
];

export const MIN_SCENES = 3;
export const MAX_SCENES = 6;
export const MIN_WORDS = 6;
export const MAX_SCRIPT_CHARS = 900;       // one voice call; longer scripts are refused rather than cut
export const MIN_SCENE_FRAMES = 45;        // 1.5 s at 30 fps
export const WORDS_PER_SECOND = 2.5;

export type StillMotion = 'in' | 'out' | 'left' | 'right';
export const MOTIONS: readonly StillMotion[] = ['in', 'out', 'left', 'right'];
const MOTION_CYCLE: readonly StillMotion[] = ['in', 'left', 'out', 'right'];
export const isMotion = (v: unknown): v is StillMotion => typeof v === 'string' && (MOTIONS as readonly string[]).includes(v);

export interface NarratedInput { kind: NarratedKind; text?: string; title?: string; items?: readonly string[]; attribution?: string }
export interface NarratedPlan { script: string; beats: string[]; problem: string | null }

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const words = (s: string) => (clean(s) ? clean(s).split(' ').length : 0);

/** Sentences, keeping their end marks. */
function sentences(text: string): string[] {
  return clean(text).match(/[^.!?…]+[.!?…]+["')\]]*|[^.!?…]+$/g)?.map(clean).filter(Boolean) ?? [];
}

/** Group sentences into at most `max` beats of similar length (never splitting a sentence, never reordering). */
function groupBeats(parts: string[], max: number): string[] {
  if (parts.length <= max) return parts;
  const total = parts.reduce((n, p) => n + words(p), 0);
  const target = total / max;
  const out: string[] = []; let cur: string[] = []; let n = 0;
  for (const [i, p] of parts.entries()) {
    cur.push(p); n += words(p);
    const left = parts.length - i - 1, slots = max - out.length - 1;
    if (out.length < max - 1 && (n >= target || left <= slots) && left >= slots) { out.push(cur.join(' ')); cur = []; n = 0; }
  }
  if (cur.length) out.push(cur.join(' '));
  return out;
}

/** Break one long sentence into pieces at commas or between words when there are too few sentences to make scenes from. */
function splitLong(parts: string[], min: number): string[] {
  let out = parts;
  while (out.length < min) {
    const i = out.reduce((best, p, k) => (words(p) > words(out[best]) ? k : best), 0);
    const p = out[i];
    if (words(p) < 8) break;
    const mid = Math.floor(p.length / 2);
    const comma = [...p.matchAll(/[,;:]\s/g)].map(m => m.index! + 1).sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid))[0];
    let cut = comma;
    if (cut === undefined) { cut = p.indexOf(' ', mid); if (cut < 0) cut = p.lastIndexOf(' ', mid); }
    out = [...out.slice(0, i), clean(p.slice(0, cut)), clean(p.slice(cut)), ...out.slice(i + 1)];
  }
  return out;
}

/** The script that is spoken and shown, and the scenes it is split into. Returns a problem (and nothing else useful) when it cannot be made. */
export function planNarrated(i: NarratedInput): NarratedPlan {
  const fail = (problem: string): NarratedPlan => ({ script: '', beats: [], problem });
  let beats: string[];
  if (i.kind === 'listicle') {
    const items = (i.items ?? []).map(clean).filter(Boolean);
    if (items.length < 2) return fail('A list needs at least two items.');
    if (items.length > MAX_SCENES - 1) return fail(`A list can have at most ${MAX_SCENES - 1} items (one picture each, plus the title).`);
    const title = clean(i.title ?? '');
    if (!title) return fail('Give the list a title, for example "Five things I wish I knew".');
    beats = [title.replace(/[.!?]*$/, '.'), ...items.map((it, k) => `Number ${k + 1}. ${it.replace(/[.!?]*$/, '.')}`)];
  } else if (i.kind === 'quote' || i.kind === 'verse') {
    const text = clean(i.text ?? '');
    if (!text) return fail(i.kind === 'quote' ? 'Pick a quote in the Take tab first (Find a quote).' : 'Pick a verse in the Take tab first (Find a verse).');
    const tail = clean(i.attribution ?? '');
    beats = splitLong(sentences(text), MIN_SCENES - (tail ? 1 : 0));
    beats = groupBeats(beats, MAX_SCENES - (tail ? 1 : 0));
    if (tail) beats.push(tail.replace(/[.!?]*$/, '.'));
  } else {
    const text = clean(i.text ?? '');
    if (words(text) < MIN_WORDS) return fail(`Write at least ${MIN_WORDS} words to narrate.`);
    beats = groupBeats(splitLong(sentences(text), MIN_SCENES), MAX_SCENES);
  }
  const script = beats.join(' ');
  if (script.length > MAX_SCRIPT_CHARS) return fail(`That is too long to narrate in one go (${script.length}/${MAX_SCRIPT_CHARS} characters). Shorten it.`);
  if (beats.length < MIN_SCENES && i.kind !== 'quote' && i.kind !== 'verse') return fail('Write a little more so there is something to show in each picture.');
  return { script, beats, problem: null };
}

/** Frames per scene that add up to exactly `totalFrames`, in proportion to how many words each scene has, never shorter than the minimum. */
export function sceneFrames(beats: readonly string[], totalFrames: number, min = MIN_SCENE_FRAMES): number[] {
  const n = beats.length;
  if (n === 0) return [];
  const total = Math.max(totalFrames, min * n);
  const w = beats.map(b => Math.max(1, words(b)));
  const sum = w.reduce((a, b) => a + b, 0);
  const spare = total - min * n;
  const raw = w.map(x => (spare * x) / sum);
  const out = raw.map(r => min + Math.floor(r));
  let left = total - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, k) => [r - Math.floor(r), k] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; left > 0; k = (k + 1) % n, left--) out[order[k][1]]++;
  return out;
}

/** Rough spoken length (seconds) before the real voice exists, for cost and length hints. */
export const estimateSeconds = (script: string): number => Math.max(2, Math.round((words(script) / WORDS_PER_SECOND) * 10) / 10);

export const NARRATED_STYLES = [
  { id: 'cinematic', label: 'Cinematic', phrase: 'cinematic photograph, soft natural light, shallow depth of field, rich colour' },
  { id: 'illustration', label: 'Illustration', phrase: 'hand-painted storybook illustration, warm colours, gentle texture' },
  { id: 'watercolor', label: 'Watercolour', phrase: 'loose watercolour painting, soft edges, paper texture' },
  { id: 'animated3d', label: '3D animated', phrase: 'polished 3D animated film still, soft lighting, smooth shading' },
  { id: 'noir', label: 'Black and white', phrase: 'high-contrast black and white photograph, deep shadows, fine grain' },
] as const;
export type NarratedStyleId = (typeof NARRATED_STYLES)[number]['id'];
export const DEFAULT_STYLE: NarratedStyleId = 'cinematic';
export const styleOf = (id: unknown) => NARRATED_STYLES.find(s => s.id === id) ?? NARRATED_STYLES[0];

/**
 * The picture for one scene. Faceless on purpose: scenes, places, objects, nature, hands and silhouettes, never a close-up face, never a real person,
 * never text. Verse scenes show no people or figures at all (so no holy figure can be drawn); the wording avoids naming any, which the content screen would block.
 */
export function scenePrompt(beat: string, style: unknown, aspect: '9:16' | '16:9' | '1:1', kind: NarratedKind): string {
  const sacred = kind === 'verse' ? ' Show only landscapes, light, nature or everyday objects, with no people or figures at all.' : '';
  return [
    `A picture that illustrates this line of narration, by mood and subject: "${clean(beat).slice(0, 240)}".`,
    `${styleOf(style).phrase}, ${aspect} framing.`,
    `No close-up faces, no real or famous people, no children, no logos, no brand names, no text, no letters, no watermarks.${sacred}`,
  ].join(' ');
}

export interface PlacedScene { text: string; imageUrl: string; frames: number }

/** Put the finished pictures and the voice on the timeline after what is already there, with a slow drift on each picture and the words as captions. */
export function addNarratedClips(p: Project, a: { scenes: readonly PlacedScene[]; audioUrl: string; audioFrames: number; label: string }): Project {
  const video = p.tracks.find(t => t.kind === 'video'), sound = p.tracks.find(t => t.kind === 'audio'), cap = p.tracks.find(t => t.kind === 'caption');
  if (!video || !sound || a.scenes.length === 0) return p;
  const start = projectDuration(p);
  let next = p, at = start;
  a.scenes.forEach((s, i) => {
    const base: Clip = { id: newId('scene'), trackId: video.id, kind: 'video', label: s.text.slice(0, 60), start: at, duration: s.frames, trimStart: 0, src: s.imageUrl, volume: 0, still: { motion: MOTION_CYCLE[i % MOTION_CYCLE.length] } };
    next = addClip(next, base);
    if (cap) next = addClip(next, { id: newId('cap'), trackId: cap.id, kind: 'caption', label: s.text.slice(0, 40), start: at, duration: s.frames, trimStart: 0, text: s.text });
    at += s.frames;
  });
  return addClip(next, { id: newId('voice'), trackId: sound.id, kind: 'audio', label: a.label.slice(0, 60), start, duration: Math.max(1, a.audioFrames), trimStart: 0, sourceFrames: a.audioFrames, src: a.audioUrl, volume: 1 });
}
