import type { EnergyLevel } from "../../../lib/types";

/**
 * Vibe preset definitions.
 * Each vibe sets duration range and energy level automatically.
 */
export interface VibePreset {
  id: string;
  label: string;
  emoji: string;
  description: string;
  durationRange: [number, number]; // [min, max] in seconds
  energyLevel: EnergyLevel;
}

export const VIBES: VibePreset[] = [
  {
    id: "viral_punchy",
    label: "Viral & Punchy",
    emoji: "⚡",
    description: "Short, punchy, high energy - perfect for shares",
    durationRange: [4, 6],
    energyLevel: "high_energy",
  },
  {
    id: "thoughtful_calm",
    label: "Thoughtful & Calm",
    emoji: "🧠",
    description: "Slower pace, reflective - great for saves",
    durationRange: [6, 8],
    energyLevel: "calm",
  },
  {
    id: "bold_opinionated",
    label: "Bold & Opinionated",
    emoji: "🔥",
    description: "Strong takes, confident delivery - sparks comments",
    durationRange: [3, 5],
    energyLevel: "high_energy",
  },
  {
    id: "emotional_heartfelt",
    label: "Emotional & Heartfelt",
    emoji: "❤️",
    description: "Warm, touching, memorable - high saves",
    durationRange: [6, 8],
    energyLevel: "conversational",
  },
  {
    id: "conversational",
    label: "Conversational",
    emoji: "💬",
    description: "Natural chat vibe, relatable",
    durationRange: [5, 7],
    energyLevel: "conversational",
  },
];

export function getVibeById(id: string): VibePreset | undefined {
  return VIBES.find((v) => v.id === id);
}

export function getVibesForVideoType(_videoType: string): VibePreset[] {
  // Filter vibes based on video type if needed
  // For now, return all vibes
  return VIBES;
}
