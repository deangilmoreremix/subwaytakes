import type { AgeGroup, EmotionalTone, EnergyLevel, InterviewStyle } from "../../../lib/types";

/**
 * Audience Persona definitions.
 * Each persona auto-sets age group, tone, energy, and guardrails.
 */
export interface Persona {
  id: string;
  label: string;
  emoji: string;
  description: string;
  ageGroup: AgeGroup;
  tone: EmotionalTone;
  energyLevel: EnergyLevel;
  guardrails: string[];
  defaultInterviewStyle: InterviewStyle;
  bestFor: 'shares' | 'comments' | 'saves';
}

export const PERSONAS: Persona[] = [
  {
    id: "all_ages_viral",
    label: "All Ages",
    emoji: "🔥",
    description: "Viral takes that work for everyone",
    ageGroup: "all_ages",
    tone: "excited",
    energyLevel: "high_energy",
    guardrails: ["No explicit content", "Family-friendly"],
    defaultInterviewStyle: "hot_take",
    bestFor: "shares",
  },
  {
    id: "adults_real_talk",
    label: "Adults",
    emoji: "🧑",
    description: "Real talk, no filter, honest opinions",
    ageGroup: "adults",
    tone: "neutral",
    energyLevel: "conversational",
    guardrails: ["Mature topics allowed", "Realistic advice"],
    defaultInterviewStyle: "man_on_street",
    bestFor: "comments",
  },
  {
    id: "wisdom_55_plus",
    label: "55+ Wisdom",
    emoji: "👵",
    description: "Life lessons, reflective advice, legacy",
    ageGroup: "older_adults",
    tone: "thoughtful",
    energyLevel: "calm",
    guardrails: ["Respectful tone", "No controversial topics"],
    defaultInterviewStyle: "deep_conversation",
    bestFor: "saves",
  },
  {
    id: "teens_opinions",
    label: "Teens",
    emoji: "🎓",
    description: "Bold opinions, trending topics, youth energy",
    ageGroup: "teens",
    tone: "passionate",
    energyLevel: "high_energy",
    guardrails: ["Relatable content", "Trending topics okay"],
    defaultInterviewStyle: "quick_fire",
    bestFor: "shares",
  },
  {
    id: "kids_friendly",
    label: "Kids",
    emoji: "🌟",
    description: "Family-friendly, wholesome, fun",
    ageGroup: "kids",
    tone: "playful",
    energyLevel: "conversational",
    guardrails: [
      "No adult themes",
      "No dating/relationships",
      "No drugs/alcohol",
      "Educational and positive",
    ],
    defaultInterviewStyle: "storytelling",
    bestFor: "saves",
  },
];

export function getPersonaById(id: string): Persona | undefined {
  return PERSONAS.find((p) => p.id === id);
}

export function getPersonasForVideoType(_videoType: string): Persona[] {
  // Filter personas based on video type if needed
  // For now, return all personas
  return PERSONAS;
}
