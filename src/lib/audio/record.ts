/**
 * Recording your own voice for a line (free): pure helpers for the teleprompter and the limits, and the small browser wrapper that
 * records the microphone and turns it into a mono WAV that the lip-sync models accept.
 */
import { downmixToMono, encodeWav } from './wav';

export const MIN_RECORD_SEC = 1;
/** Lip-sync audio is capped well below what the models accept: one line, not a monologue. */
export const MAX_RECORD_SEC = 90;
export const DEFAULT_WPM = 150;
export const WPM_RANGE = { min: 90, max: 220 } as const;

export interface TeleprompterPlan { words: string[]; msPerWord: number; totalMs: number }

/** Split a script into words and decide how long each is highlighted at the chosen speed. Pure. */
export function teleprompterPlan(script: string, wpm = DEFAULT_WPM): TeleprompterPlan {
  const rate = Math.min(WPM_RANGE.max, Math.max(WPM_RANGE.min, Number.isFinite(wpm) ? wpm : DEFAULT_WPM));
  const words = script.trim().split(/\s+/).filter(Boolean);
  const msPerWord = Math.round(60000 / rate);
  return { words, msPerWord, totalMs: words.length * msPerWord };
}

/** Which word is being read at `elapsedMs` (-1 before the start, the last index when finished). Pure. */
export function activeWord(plan: TeleprompterPlan, elapsedMs: number): number {
  if (!plan.words.length || elapsedMs < 0) return -1;
  return Math.min(plan.words.length - 1, Math.floor(elapsedMs / plan.msPerWord));
}

/** "0:07" */
export function clock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Why this recording cannot be used, or null. Pure. */
export function recordingProblem(seconds: number, peak: number): string | null {
  if (!Number.isFinite(seconds) || seconds < MIN_RECORD_SEC) return 'That was too short. Record at least a second.';
  if (seconds > MAX_RECORD_SEC) return `That is longer than ${MAX_RECORD_SEC} seconds. Record one line at a time.`;
  if (peak < 0.02) return 'It sounds silent. Check your microphone and record again.';
  return null;
}

/** Loudest sample (0 to 1) of a recording; a near-silent one is refused before it is uploaded. Pure. */
export function peakOf(samples: Float32Array): number {
  let p = 0;
  for (let i = 0; i < samples.length; i++) { const a = Math.abs(samples[i]); if (a > p) p = a; }
  return p;
}

/** The first recorder container this browser can make (audio/webm is Chrome and Firefox, audio/mp4 is Safari). */
export function pickRecorderMime(isSupported: (t: string) => boolean): string | null {
  for (const t of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']) if (isSupported(t)) return t;
  return null;
}

export const recordingSupported = (): boolean =>
  typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';

/** Friendly text for the ways getUserMedia fails. */
export function micErrorText(e: unknown): string {
  const name = e instanceof DOMException ? e.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Microphone access was blocked. Allow it in your browser\'s site settings, then try again.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No microphone was found. Plug one in and try again.';
  if (name === 'NotReadableError') return 'Your microphone is being used by another app. Close it and try again.';
  return e instanceof Error && e.message ? e.message : 'Could not start the microphone.';
}

/** Decode a recorded blob and write it as a mono 16-bit WAV (what the lip-sync models take). Browser only. */
export async function recordingToWav(blob: Blob): Promise<{ wav: Blob; seconds: number; peak: number }> {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AC();
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, i) => decoded.getChannelData(i));
    const mono = downmixToMono(channels);
    return { wav: new Blob([encodeWav(mono, decoded.sampleRate) as BlobPart], { type: 'audio/wav' }), seconds: mono.length / decoded.sampleRate, peak: peakOf(mono) };
  } finally { void ctx.close(); }
}
