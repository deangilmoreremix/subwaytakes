/** Recast voice stage helpers (pure): give the new performer their own voice and re-animate the mouth. */
import { SPEED_RANGE, clampSpeed, type VoiceProvider } from '../muapi/voices';
import { WORDS_PER_SECOND } from '../interview';

export type VoiceLipsyncModel = 'veed-lipsync' | 'sync-lipsync' | 'creatify-lipsync' | 'volcengine-video-to-video-lip-sync';

export const VOICE_LIPSYNC_MODELS: Array<{ slug: VoiceLipsyncModel; label: string; approxUsd: number; note: string }> = [
  { slug: 'veed-lipsync', label: 'VEED Lipsync', approxUsd: 0.04, note: 'Cheapest, default' },
  { slug: 'sync-lipsync', label: 'Sync Lipsync', approxUsd: 0.08, note: 'Higher fidelity' },
  { slug: 'creatify-lipsync', label: 'Creatify Lipsync', approxUsd: 0.11, note: '' },
  { slug: 'volcengine-video-to-video-lip-sync', label: 'Volcengine Lipsync', approxUsd: 0.10, note: 'Lite mode' },
];

export interface VoiceOptions {
  provider: VoiceProvider;
  voiceId: string;
  speed?: number;
  lipsync: VoiceLipsyncModel;
  /** If set, skips Whisper and speaks exactly this. */
  script?: string;
}

/** Cost lines (USD) for the voice stage; Whisper is ~$0.012, TTS ~$0.05, lipsync per model. */
export const VOICE_APPROX = { whisper: 0.012, tts: 0.05 };
export function estimateVoice(lipsync: VoiceLipsyncModel): Array<[string, number]> {
  const m = VOICE_LIPSYNC_MODELS.find(x => x.slug === lipsync)!;
  return [['Transcribe speech', VOICE_APPROX.whisper], ['New voice', VOICE_APPROX.tts], [m.label, m.approxUsd]];
}

/** Whisper may answer as plain text or SRT: reduce either to the spoken words. */
export function plainSpeech(raw: string): string {
  return raw
    .split(/\r?\n/)
    .filter(l => l.trim() && !/^\d+$/.test(l.trim()) && !/-->/.test(l))
    .join(' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Pure: pick a TTS speed and trim the words so the line fits the clip. Estimated at WORDS_PER_SECOND at speed 1.
 * Speeds up within the provider's range first; only trims words if the fastest allowed speed still overruns.
 */
export function fitSpeech(provider: VoiceProvider, text: string, seconds: number, baseSpeed = 1): { text: string; speed: number; trimmed: boolean; sped: boolean } {
  const base = clampSpeed(provider, baseSpeed);
  const words = text.trim().split(/\s+/).filter(Boolean);
  const maxSpeed = SPEED_RANGE[provider][1];
  const estSeconds = (n: number, speed: number) => n / WORDS_PER_SECOND / speed;
  let speed = base;
  if (estSeconds(words.length, speed) > seconds) speed = Math.min(maxSpeed, Math.ceil(((words.length / WORDS_PER_SECOND) / seconds) * 20) / 20);
  speed = Math.max(speed, base);
  let n = words.length;
  while (n > 1 && estSeconds(n, speed) > seconds) n--;
  return { text: words.slice(0, n).join(' '), speed: clampSpeed(provider, speed), trimmed: n < words.length, sped: speed > base };
}

/** Pure: body for a video-to-video lipsync call. */
export function buildVoiceLipsyncInput(model: VoiceLipsyncModel, videoUrl: string, audioUrl: string): Record<string, unknown> {
  if (model === 'volcengine-video-to-video-lip-sync') return { video_url: videoUrl, audio_url: audioUrl, mode: 'lite' };
  return { video_url: videoUrl, audio_url: audioUrl };
}
