import type { ClipType } from './types';

export interface VideoTypeSpec {
  type: ClipType;
  label: string;
  aspectRatio: '9:16' | '16:9' | '1:1';
  minDurationSeconds: number;
  maxDurationSeconds: number;
  recommendedDurationSeconds: number[];
  allowedProviders: ('minimax' | 'google')[];
  requiresScene: boolean;
  requiresCityStyle: boolean;
  requiresEnergyLevel: boolean;
  requiresInterviewStyle: boolean;
  maxPromptLength: number;
  maxSpeechScriptLength: number;
  supportsBatch: boolean;
  outputFormat: 'mp4';
  outputResolution: { width: number; height: number };
  businessRules: string[];
}

export const VIDEO_TYPE_SPECS: Record<ClipType, VideoTypeSpec> = {
  subway_interview: {
    type: 'subway_interview',
    label: 'Subway Interview',
    aspectRatio: '9:16',
    minDurationSeconds: 3,
    maxDurationSeconds: 160,
    recommendedDurationSeconds: [6, 8, 15, 30],
    allowedProviders: ['minimax', 'google'],
    requiresScene: true,
    requiresCityStyle: true,
    requiresEnergyLevel: true,
    requiresInterviewStyle: false,
    maxPromptLength: 10000,
    maxSpeechScriptLength: 5000,
    supportsBatch: true,
    outputFormat: 'mp4',
    outputResolution: { width: 1080, height: 1920 },
    businessRules: [
      'Must include a subway scene context',
      'City style defines visual tone',
      'Batch generation limited to 10 clips',
    ],
  },
  street_interview: {
    type: 'street_interview',
    label: 'Street Interview',
    aspectRatio: '9:16',
    minDurationSeconds: 3,
    maxDurationSeconds: 160,
    recommendedDurationSeconds: [6, 8, 15, 30],
    allowedProviders: ['minimax', 'google'],
    requiresScene: true,
    requiresCityStyle: false,
    requiresEnergyLevel: true,
    requiresInterviewStyle: false,
    maxPromptLength: 10000,
    maxSpeechScriptLength: 5000,
    supportsBatch: false,
    outputFormat: 'mp4',
    outputResolution: { width: 1080, height: 1920 },
    businessRules: [
      'Must include a street scene context',
      'Energy level affects pacing of the clip',
    ],
  },
  motivational: {
    type: 'motivational',
    label: 'Motivational',
    aspectRatio: '9:16',
    minDurationSeconds: 3,
    maxDurationSeconds: 160,
    recommendedDurationSeconds: [8, 15, 30, 60],
    allowedProviders: ['minimax', 'google'],
    requiresScene: false,
    requiresCityStyle: false,
    requiresEnergyLevel: true,
    requiresInterviewStyle: false,
    maxPromptLength: 10000,
    maxSpeechScriptLength: 5000,
    supportsBatch: false,
    outputFormat: 'mp4',
    outputResolution: { width: 1080, height: 1920 },
    businessRules: [
      'High-energy speaker archetypes perform best',
      'Speech script strongly recommended for this type',
    ],
  },
  studio_interview: {
    type: 'studio_interview',
    label: 'Studio Interview',
    aspectRatio: '9:16',
    minDurationSeconds: 3,
    maxDurationSeconds: 160,
    recommendedDurationSeconds: [15, 30, 60, 90],
    allowedProviders: ['minimax', 'google'],
    requiresScene: false,
    requiresCityStyle: false,
    requiresEnergyLevel: false,
    requiresInterviewStyle: true,
    maxPromptLength: 10000,
    maxSpeechScriptLength: 5000,
    supportsBatch: false,
    outputFormat: 'mp4',
    outputResolution: { width: 1080, height: 1920 },
    businessRules: [
      'Studio setup and lighting define visual quality',
      'Interview style shapes conversation flow',
    ],
  },
  wisdom_interview: {
    type: 'wisdom_interview',
    label: 'Wisdom Interview',
    aspectRatio: '9:16',
    minDurationSeconds: 3,
    maxDurationSeconds: 160,
    recommendedDurationSeconds: [30, 60, 90],
    allowedProviders: ['minimax', 'google'],
    requiresScene: false,
    requiresCityStyle: false,
    requiresEnergyLevel: false,
    requiresInterviewStyle: false,
    maxPromptLength: 10000,
    maxSpeechScriptLength: 5000,
    supportsBatch: false,
    outputFormat: 'mp4',
    outputResolution: { width: 1080, height: 1920 },
    businessRules: [
      'Designed for 55+ age demographic content',
      'Slower pacing recommended',
      'Avoid high-energy interview modes',
    ],
  },
};

export interface PlatformExportSpec {
  platform: string;
  label: string;
  width: number;
  height: number;
  maxDurationSeconds: number;
  aspectRatio: string;
}

export const PLATFORM_EXPORT_SPECS: PlatformExportSpec[] = [
  { platform: 'tiktok', label: 'TikTok', width: 1080, height: 1920, maxDurationSeconds: 180, aspectRatio: '9:16' },
  { platform: 'instagram_reel', label: 'Instagram Reel', width: 1080, height: 1920, maxDurationSeconds: 90, aspectRatio: '9:16' },
  { platform: 'youtube_shorts', label: 'YouTube Shorts', width: 1080, height: 1920, maxDurationSeconds: 60, aspectRatio: '9:16' },
  { platform: 'instagram_post', label: 'Instagram Post', width: 1080, height: 1080, maxDurationSeconds: 60, aspectRatio: '1:1' },
  { platform: 'facebook', label: 'Facebook', width: 1280, height: 720, maxDurationSeconds: 240, aspectRatio: '16:9' },
  { platform: 'youtube', label: 'YouTube', width: 1920, height: 1080, maxDurationSeconds: 600, aspectRatio: '16:9' },
  { platform: 'twitter', label: 'Twitter / X', width: 1280, height: 720, maxDurationSeconds: 140, aspectRatio: '16:9' },
];

export interface ModelProviderSpec {
  provider: 'minimax' | 'google';
  tier: 'standard' | 'premium';
  model: string;
  maxDurationSeconds: number;
  supportsAudio: boolean;
  aspectRatio: '9:16';
}

export const MODEL_PROVIDER_SPECS: ModelProviderSpec[] = [
  {
    provider: 'minimax',
    tier: 'standard',
    model: 'hailuo-2.3-fast',
    maxDurationSeconds: 160,
    supportsAudio: true,
    aspectRatio: '9:16',
  },
  {
    provider: 'google',
    tier: 'premium',
    model: 'veo-3.1-fast',
    maxDurationSeconds: 8,
    supportsAudio: true,
    aspectRatio: '9:16',
  },
];

export function getSpecForType(videoType: ClipType): VideoTypeSpec {
  return VIDEO_TYPE_SPECS[videoType];
}

export function getProviderSpec(tier: 'standard' | 'premium'): ModelProviderSpec {
  return MODEL_PROVIDER_SPECS.find(s => s.tier === tier)!;
}

export function getEffectiveDurationCap(
  requestedSeconds: number,
  tier: 'standard' | 'premium'
): { effectiveDuration: number; wasCapped: boolean; capReason: string | null } {
  const providerSpec = getProviderSpec(tier);
  if (requestedSeconds > providerSpec.maxDurationSeconds) {
    return {
      effectiveDuration: providerSpec.maxDurationSeconds,
      wasCapped: true,
      capReason: `${providerSpec.model} supports a maximum of ${providerSpec.maxDurationSeconds}s`,
    };
  }
  return { effectiveDuration: requestedSeconds, wasCapped: false, capReason: null };
}
