import { runModel } from '../muapi/client';
import { UTILITY } from '../muapi/registry';
import { extractTranscript, transcriptToCaptions } from './captions';
import type { Caption } from '@remotion/captions';

/** Transcribe a publicly reachable clip with muapi Whisper (SRT output). Throws with a clear message on failure. */
export async function transcribeClip(src: string, durationMs: number, opts: { language?: string; signal?: AbortSignal } = {}): Promise<Caption[]> {
  if (!/^https?:\/\//i.test(src)) throw new Error('Captions need a hosted clip URL (generated clips only for now).');
  const input: Record<string, unknown> = { audio_url: src, response_format: 'srt' };
  if (opts.language) input.language = opts.language;
  const { prediction } = await runModel(UTILITY.whisper, input, { requireUrl: false, signal: opts.signal, intervalMs: 2500, timeoutMs: 5 * 60_000 });
  const transcript = extractTranscript(prediction);
  if (!transcript) throw new Error('Whisper returned no transcript. The clip may have no speech.');
  const captions = transcriptToCaptions(transcript, durationMs);
  if (!captions.length) throw new Error('No captions could be parsed from the transcript.');
  return captions;
}
