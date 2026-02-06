import type { ClipType, InterviewStyle, InterviewerPosition, InterviewerType } from "../../lib/types";

/**
 * State shape for the Clip Builder Wizard.
 * All step data is stored here and evolves as the user progresses.
 */
export type ClipBuilderState = {
  // Step 1: Video Type
  videoType?: ClipType;
  
  // Step 2: Interview Style
  interviewStyle?: InterviewStyle;
  
  // Step 3: Prompt Details
  topic?: string;
  direction?: string;
  
  // Step 4: Advanced / Summary
  durationSeconds?: number;
  language?: string;
  model?: string;
  
  // Subway-specific Card Mic Configuration (only for subway_interview)
  subwayCardMic?: SubwayCardMicConfig;
};

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
