import type { ClipType, InterviewStyle, InterviewerPosition, InterviewerType, AgeGroup, EnergyLevel, EmotionalTone } from "../../lib/types";

/**
 * State shape for the enhanced Clip Builder Wizard.
 * All step data is stored here and evolves as the user progresses.
 */
export interface WizardState {
  // Step 1: Video Type
  videoType?: ClipType;

  // Step 2: Audience & Vibe
  personaId?: string;
  vibeId?: string;
  ageGroup?: AgeGroup;
  energyLevel?: EnergyLevel;

  // Step 3: Topic & Question
  topic?: string;
  question?: string;
  spiceTags?: string[];

  // Step 4: Style (optional override)
  interviewStyle?: InterviewStyle;

  // Advanced (collapsed by default)
  modelTier?: 'standard' | 'premium';
  language?: string;
  captionStyle?: string;
  exportPlatforms?: string[];
  productPlacement?: boolean;

  // Subway Card Mic (auto-set for subway)
  subwayCardMic?: SubwayCardMicConfig;

  // Derived values from persona/vibe selection
  tone?: EmotionalTone;
  durationSeconds?: number;
}

/**
 * Backward compatible type name (deprecated, use WizardState)
 */
export type ClipBuilderState = WizardState;

export type SubwayCardMicConfig = {
  enabled: boolean;
  cardType: "metro_card" | "subway_ticket" | "transit_pass";
  cardDesign: "plain" | "minimal" | "blank";
  mustBeVisible: boolean;
  framingHint: InterviewerPosition;
  interviewerTypeHint: InterviewerType;
};

export const DEFAULT_SUBWAY_CARD_MIC: SubwayCardMicConfig = {
  enabled: true,
  cardType: "subway_ticket",
  cardDesign: "blank",
  mustBeVisible: true,
  framingHint: "holding_mic",
  interviewerTypeHint: "hidden_voice_only",
};

/**
 * Step types for the wizard
 */
export type WizardStepId = 'type' | 'audience' | 'topic' | 'style' | 'summary';

/**
 * Step configuration for the wizard
 */
export interface WizardStep {
  id: WizardStepId;
  label: string;
  canSkip?: boolean;
}
