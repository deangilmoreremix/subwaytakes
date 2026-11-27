// Single source of truth for muapi models used by SubwayTakes.
// Slugs verified against https://api.muapi.ai/openapi.json (see scripts/check-registry.mjs).

export type Pipeline = 'native' | 'lipsync' | 'recast';
export type Tier = 'best' | 'balanced' | 'fast' | 'budget';
export type Aspect = '9:16' | '16:9' | '1:1';

export interface VideoModel {
  slug: string;
  label: string;
  pipeline: Pipeline;
  tier: Tier;
  mode: 'text' | 'image';
  /** Native audio/speech generated in-shot */
  nativeAudio: boolean;
  aspects: Aspect[];
  /** Allowed durations (seconds) if the API enforces a list, else min/max */
  durations?: number[];
  minDuration?: number;
  maxDuration?: number;
  resolutions?: string[];
}

const ALL_ASPECTS: Aspect[] = ['9:16', '16:9', '1:1'];

export const NATIVE_MODELS: VideoModel[] = [
  { slug: 'veo3.1-text-to-video', label: 'Veo 3.1', pipeline: 'native', tier: 'best', mode: 'text', nativeAudio: true, aspects: ['9:16', '16:9'], minDuration: 4, maxDuration: 8, resolutions: ['720p', '1080p', '4k'] },
  { slug: 'veo3.1-image-to-video', label: 'Veo 3.1 (image)', pipeline: 'native', tier: 'best', mode: 'image', nativeAudio: true, aspects: ['9:16', '16:9'], minDuration: 4, maxDuration: 8, resolutions: ['720p', '1080p', '4k'] },
  { slug: 'veo3.1-fast-text-to-video', label: 'Veo 3.1 Fast', pipeline: 'native', tier: 'fast', mode: 'text', nativeAudio: true, aspects: ['9:16', '16:9'], minDuration: 4, maxDuration: 8, resolutions: ['720p', '1080p', '4k'] },
  { slug: 'veo3.1-fast-image-to-video', label: 'Veo 3.1 Fast (image)', pipeline: 'native', tier: 'fast', mode: 'image', nativeAudio: true, aspects: ['9:16', '16:9'], minDuration: 4, maxDuration: 8, resolutions: ['720p', '1080p', '4k'] },
  { slug: 'kling-v3.0-pro-text-to-video', label: 'Kling 3.0 Pro', pipeline: 'native', tier: 'best', mode: 'text', nativeAudio: true, aspects: ALL_ASPECTS, minDuration: 3, maxDuration: 15 },
  { slug: 'kling-v3-turbo-standard-text-to-video', label: 'Kling 3 Turbo', pipeline: 'native', tier: 'fast', mode: 'text', nativeAudio: true, aspects: ALL_ASPECTS, minDuration: 3, maxDuration: 15 },
  { slug: 'kling-v3-turbo-standard-image-to-video', label: 'Kling 3 Turbo (image)', pipeline: 'native', tier: 'fast', mode: 'image', nativeAudio: true, aspects: ALL_ASPECTS, minDuration: 3, maxDuration: 15 },
  { slug: 'seedance-2-text-to-video', label: 'Seedance 2', pipeline: 'native', tier: 'balanced', mode: 'text', nativeAudio: true, aspects: ALL_ASPECTS, minDuration: 4, maxDuration: 15, resolutions: ['720p', '1080p', '4k'] },
  { slug: 'seedance-2-text-to-video-fast', label: 'Seedance 2 Fast', pipeline: 'native', tier: 'budget', mode: 'text', nativeAudio: true, aspects: ALL_ASPECTS, minDuration: 4, maxDuration: 15 },
  { slug: 'seedance-2-image-to-video', label: 'Seedance 2 (image)', pipeline: 'native', tier: 'balanced', mode: 'image', nativeAudio: true, aspects: ALL_ASPECTS, minDuration: 4, maxDuration: 15 },
  { slug: 'openai-sora-2-standard-text-to-video', label: 'Sora 2', pipeline: 'native', tier: 'best', mode: 'text', nativeAudio: true, aspects: ['9:16', '16:9'], minDuration: 4, maxDuration: 12 },
  { slug: 'openai-sora-2-standard-image-to-video', label: 'Sora 2 (image)', pipeline: 'native', tier: 'best', mode: 'image', nativeAudio: true, aspects: ['9:16', '16:9'], minDuration: 4, maxDuration: 12 },
];

/** Lipsync pipeline: still -> TTS -> talking video */
export const STILL_MODELS = [
  { slug: 'gpt-image-2-text-to-image', label: 'GPT Image 2', tier: 'best' as Tier },
  { slug: 'flux-dev-image', label: 'Flux Dev', tier: 'balanced' as Tier },
];
export const TTS_MODELS = [
  { slug: 'elevenlabs-tts-turbo-2-5', label: 'ElevenLabs Turbo 2.5', tier: 'best' as Tier },
  { slug: 'minimax-speech-2.6-turbo', label: 'MiniMax Speech 2.6 Turbo', tier: 'budget' as Tier },
];
export const LIPSYNC_MODELS = [
  { slug: 'omnihuman-2-0', label: 'OmniHuman 2.0', tier: 'best' as Tier, input: 'image+audio' as const },
  { slug: 'kling-v2-avatar-standard', label: 'Kling Avatar', tier: 'balanced' as Tier, input: 'image+audio' as const },
  { slug: 'sync-lipsync', label: 'Sync Lipsync (video)', tier: 'fast' as Tier, input: 'video+audio' as const },
];

/** Recast (open-genjutsu workflow) */
export const RECAST = {
  upload: 'upload_file',
  depth: 'depth-anything',
  vision: 'gemini-video-vision',
  cleanFrames: 'nano-banana-2-edit',
  characterSheet: 'gpt-image-2-image-to-image',
  prompt: 'gemini-2-5-flash',
  render: { full: 'seedance-2.5-omni-reference', lite: 'wan3.0-reference-to-video' },
  limits: { minSeconds: 4, maxSeconds: 15, maxSourceMb: 50, maxCharacters: 8, maxCharacterMb: 10 },
} as const;

export const UTILITY = { captions: 'ai-captions', whisper: 'openai-whisper', llm: 'gemini-2-5-flash' } as const;

/** Every slug the app can call; checked against openapi.json by scripts/check-registry.mjs */
export function allSlugs(): string[] {
  return [
    ...NATIVE_MODELS.map(m => m.slug),
    ...STILL_MODELS.map(m => m.slug),
    ...TTS_MODELS.map(m => m.slug),
    ...LIPSYNC_MODELS.map(m => m.slug),
    RECAST.upload, RECAST.depth, RECAST.vision, RECAST.cleanFrames, RECAST.characterSheet, RECAST.prompt,
    RECAST.render.full, RECAST.render.lite,
    UTILITY.captions, UTILITY.whisper,
  ];
}

const TIER_ORDER: Tier[] = ['best', 'balanced', 'fast', 'budget'];

/** Pick a native model for a tier; falls back to the nearest cheaper tier, then any. */
export function chooseNativeModel(tier: Tier, mode: 'text' | 'image', aspect: Aspect): VideoModel {
  const pool = NATIVE_MODELS.filter(m => m.mode === mode && m.aspects.includes(aspect));
  if (pool.length === 0) throw new Error(`No ${mode} model supports ${aspect}`);
  const start = TIER_ORDER.indexOf(tier);
  for (let i = 0; i < TIER_ORDER.length; i++) {
    const t = TIER_ORDER[(start + i) % TIER_ORDER.length];
    const hit = pool.find(m => m.tier === t);
    if (hit) return hit;
  }
  return pool[0];
}

export function clampDuration(model: VideoModel, seconds: number): number {
  if (model.durations?.length) {
    return model.durations.reduce((a, b) => (Math.abs(b - seconds) < Math.abs(a - seconds) ? b : a));
  }
  return Math.min(model.maxDuration ?? seconds, Math.max(model.minDuration ?? 1, Math.round(seconds)));
}
