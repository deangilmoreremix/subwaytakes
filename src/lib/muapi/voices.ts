export type VoiceProvider = 'elevenlabs' | 'minimax';
export interface Voice { id: string; label: string; provider: VoiceProvider }

export const TTS_SLUG: Record<VoiceProvider, string> = { elevenlabs: 'elevenlabs-tts-turbo-2-5', minimax: 'minimax-speech-2.6-turbo' };
export const SPEED_RANGE: Record<VoiceProvider, [number, number]> = { elevenlabs: [0.7, 1.2], minimax: [0.5, 2] };

/** Fallback if the live voice list cannot be fetched (subset of muapi's published ElevenLabs list). */
export const FALLBACK_ELEVEN: Voice[] = [
  { id: 'UgBBYS2sOqTuMpoF3BR0', label: 'Mark - Casual, Relaxed and Light', provider: 'elevenlabs' },
  { id: 'ZQe5CZNOzWyzPSCn5a3c', label: 'James - Husky, Engaging and Bold', provider: 'elevenlabs' },
  { id: 'N2lVS1w4EtoT3dr4eOWO', label: 'Callum - Husky Trickster', provider: 'elevenlabs' },
  { id: 'nPczCjzI2devNBz1zQrb', label: 'Nathan - Virtual Radio Host', provider: 'elevenlabs' },
  { id: 'FGY2WhTYpPnrIDTdsKH5', label: 'Laura - Enthusiast, Quirky Attitude', provider: 'elevenlabs' },
  { id: 'scOwDtmlLZohaFMFCHFe', label: 'Eve - Authentic, Energetic and Happy', provider: 'elevenlabs' },
  { id: 'DYkrAHD8iwork3YSUBbs', label: 'Finn - Youthful, Eager and Energetic', provider: 'elevenlabs' },
  { id: 'lcMyyd2HUfFzxdCaC4Ta', label: 'Lucy - Fresh and Casual', provider: 'elevenlabs' },
];

/** English MiniMax voices that exist in muapi's published voice list. */
export const MINIMAX_VOICES: Voice[] = [
  ['Casual_Guy', 'Casual Guy'], ['Deep_Voice_Man', 'Deep Voice Man'], ['English_Comedian', 'Comedian'], ['English_Aussie_Bloke', 'Aussie Bloke'],
  ['English_Jovialman', 'Jovial Man'], ['English_magnetic_voiced_man', 'Magnetic Man'], ['English_Trustworth_Man', 'Trustworthy Man'],
  ['English_Upbeat_Woman', 'Upbeat Woman'], ['English_PlayfulGirl', 'Playful Girl'], ['Lively_Girl', 'Lively Girl'],
  ['English_expressive_narrator', 'Expressive Narrator'], ['Friendly_Person', 'Friendly Person'],
].map(([id, label]) => ({ id, label, provider: 'minimax' as const }));

/** Pure: pull the ElevenLabs voice list out of muapi's model metadata. Returns [] if the shape is unexpected. */
export function parseElevenVoices(meta: unknown): Voice[] {
  const props = (meta as { input_schema?: { schemas?: { input_data?: { properties?: Record<string, { enum?: unknown }> } } } })?.input_schema?.schemas?.input_data?.properties;
  const list = props?.voice_id?.enum;
  if (!Array.isArray(list)) return [];
  return list.flatMap(v => {
    const o = v as { label?: unknown; value?: unknown };
    return typeof o?.value === 'string' && typeof o?.label === 'string' ? [{ id: o.value, label: o.label, provider: 'elevenlabs' as const }] : [];
  });
}

export function clampSpeed(provider: VoiceProvider, speed: number | undefined): number {
  const [lo, hi] = SPEED_RANGE[provider];
  const s = Number.isFinite(speed) ? (speed as number) : 1;
  return Math.min(hi, Math.max(lo, s));
}

/** Pure: the muapi request body for a TTS call. */
export function buildTtsInput(provider: VoiceProvider, text: string, voiceId: string, speed?: number): Record<string, unknown> {
  const t = text.trim();
  if (!t) throw new Error('There is nothing to say: the script is empty.');
  if (!voiceId) throw new Error('Pick a voice for this character first.');
  if (provider === 'elevenlabs') return { prompt: t, voice_id: voiceId, speed: clampSpeed('elevenlabs', speed) };
  return { prompt: t, voice_id: voiceId, speed: clampSpeed('minimax', speed), emotion: 'neutral', format: 'mp3', sample_rate: 32000, bitrate: 128000 };
}
