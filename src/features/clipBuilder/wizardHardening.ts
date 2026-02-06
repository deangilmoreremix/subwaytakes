import type { WizardState } from "./clipBuilder.types";
import { PERSONAS } from "./data/personas";
import { VIBES } from "./data/vibes";

/**
 * Subway Card Mic Rule - Mandatory for subway_interview
 */
export const SUBWAY_CARD_MIC_RULE = `
CARD-MIC RULE (MANDATORY FOR SUBWAY):
- The interviewer holds a transit card (Metro Card, Subway Ticket, or Transit Pass) like a microphone
- The card must be rectangular, flat, and clearly visible in the frame
- The card is extended toward the subject in the foreground plane
- NO traditional microphones, lav mics, boom poles, or phones allowed
- The card replaces the microphone - it IS the microphone
`.trim();

/**
 * Subway Negative Prompt
 */
export const SUBWAY_NEGATIVE_PROMPT = `
No handheld microphones, no lav mics, no boom poles, no phone-as-mic.
The card must be visible and used as the actual microphone.
`.trim();

/**
 * Global Negative Prompt
 */
export const GLOBAL_NEGATIVE_PROMPT = `
No text overlays, no watermarks, no logos, no title cards.
No shaky cam unless handheld documentary style intended.
No excessive zooms, no quick cuts that break continuity.
`.trim();

/**
 * Anti-Generic Rule
 */
export const ANTI_GENERIC_RULE = `
ANTI-GENERIC RULE (MANDATORY):
- Avoid vague phrases like "it depends", "just be yourself", "follow your dreams"
- Avoid generic advice that could apply to anyone
- Include at least 1 concrete detail (example, number, scenario, or specific mistake)
- Make it sound like a real person's authentic answer, not AI-generated text
`.trim();

/**
 * Build hard rules based on video type
 */
export function buildTypeHardRules(state: WizardState): string[] {
  const rules: string[] = [];

  if (state.videoType === "subway_interview") {
    rules.push(SUBWAY_CARD_MIC_RULE);
    rules.push(`
FRAMING RULE (MANDATORY):
- The card-microphone must occupy ~8-12% of frame height
- The card must be in the foreground plane, closest to camera
- Shallow depth of field on subject, card remains in focus
- Card positioned between interviewer and subject, clearly visible
- Over-the-shoulder shot or two-shot with card centered
    `.trim());
  }

  return rules;
}

/**
 * Build persona-based guardrails
 */
export function buildPersonaSection(state: WizardState): string {
  const persona = state.personaId ? PERSONAS.find((p) => p.id === state.personaId) : null;

  if (!persona) return "";

  const sections: string[] = [];

  // Persona description
  sections.push(`AUDIENCE PERSONA: ${persona.label} - ${persona.description}`);

  // Age-appropriate rules
  if (persona.ageGroup === "kids") {
    sections.push(`
KIDS SAFETY RULES (MANDATORY):
- No adult themes, dating, relationships, or romantic content
- No drugs, alcohol, or mature topics
- No explicit language of any kind
- Keep responses wholesome, playful, and educational
- Focus on fun, positive, age-appropriate content
    `.trim());
  }

  if (persona.ageGroup === "teens") {
    sections.push(`
TEENS CONTENT GUIDELINES:
- Can include trending topics and youth culture
- Relatable, authentic voice
- Avoid overly corporate or outdated references
    `.trim());
  }

  if (persona.ageGroup === "older_adults") {
    sections.push(`
WISDOM/AUDIENCE MODE:
- Thoughtful, reflective tone
- Life experience and lessons
- Respectful, measured delivery
- Legacy and wisdom sharing
    `.trim());
  }

  // Guardrails
  if (persona.guardrails.length > 0) {
    sections.push(`CONTENT GUARDRAILS: ${persona.guardrails.join(", ")}`);
  }

  return sections.join("\n\n");
}

/**
 * Build vibe-based style rules
 */
export function buildVibeSection(state: WizardState): string {
  const vibe = state.vibeId ? VIBES.find((v) => v.id === state.vibeId) : null;

  if (!vibe) return "";

  const sections: string[] = [];

  sections.push(`VIBE PRESET: ${vibe.label} - ${vibe.description}`);
  sections.push(`TARGET DURATION: ${vibe.durationRange[0]}-${vibe.durationRange[1]} seconds`);
  sections.push(`ENERGY LEVEL: ${vibe.energyLevel}`);

  // Energy-specific rules
  if (vibe.energyLevel === "high_energy") {
    sections.push(`
ENERGY DIRECTION:
- Fast pacing, punchy delivery
- Energetic back-and-forth
- Quick reactions and responses
- Dynamic, engaging content
    `.trim());
  }

  if (vibe.energyLevel === "calm") {
    sections.push(`
ENERGY DIRECTION:
- Slower, thoughtful pacing
- Measured responses
- Contemplative tone
- Calm, reflective content
    `.trim());
  }

  if (vibe.energyLevel === "conversational") {
    sections.push(`
ENERGY DIRECTION:
- Natural, chatty tone
- Relaxed pacing
- Relatable delivery
- Like talking to a friend
    `.trim());
  }

  return sections.join("\n\n");
}

/**
 * Build dialogue structure from topic/question
 */
export function buildDialogueStructure(state: WizardState): string {
  const question = state.question || (state.topic ? `Ask about: ${state.topic}` : "");

  if (!question) return "";

  const sections: string[] = [];

  sections.push(`
DIALOGUE STRUCTURE (MANDATORY):
- Interviewer asks EXACTLY one question: "${question}"
- Subject gives a concise answer with a clear opinion or story
- Include one micro-beat: (pause / smirk / laugh / surprised look / reaction)
- No rambling, no long monologues, no abstract generalities
- Make it sound like a real person speaking naturally
  `.trim());

  // Spice modifiers
  if (state.spiceTags?.includes("spicy")) {
    sections.push(`
SPICE MODIFIER: Push for a controversial or bold take
- Don't accept safe answers
- Dig deeper for the real opinion
    `.trim());
  }

  if (state.spiceTags?.includes("gentle")) {
    sections.push(`
GENTLE MODIFIER: Soft, supportive approach
- Allow for thoughtful pauses
- Accept partial answers
- Warm, encouraging tone
    `.trim());
  }

  if (state.spiceTags?.includes("funny")) {
    sections.push(`
FUNNY MODIFIER: Find the humor angle
- Look for funny contradictions
- Light-hearted responses
- Comedic timing
    `.trim());
  }

  if (state.spiceTags?.includes("direct")) {
    sections.push(`
DIRECT MODIFIER: No beating around the bush
- Get straight to the point
- Expect direct answers
- No hedging
    `.trim());
  }

  if (state.spiceTags?.includes("serious")) {
    sections.push(`
SERIOUS MODIFIER: Deep, meaningful answers
- Expect thoughtful responses
- Reflective tone
- Meaningful insights
    `.trim());
  }

  if (state.spiceTags?.includes("controversial")) {
    sections.push(`
CONTROVERSIAL MODIFIER: Touch the third rail
- Ask the uncomfortable question
- Expect strong opinions
- Don't shy away from tension
    `.trim());
  }

  return sections.join("\n\n");
}

/**
 * Build the complete hardened prompt
 */
export function buildHardenedPrompt(state: WizardState): string {
  const parts: string[] = [];

  // 1. Type hard rules
  const typeRules = buildTypeHardRules(state);
  if (typeRules.length > 0) {
    parts.push("=== TYPE REQUIREMENTS ===");
    parts.push(typeRules.join("\n\n"));
  }

  // 2. Persona guardrails
  const personaSection = buildPersonaSection(state);
  if (personaSection) {
    parts.push("=== AUDIENCE & GUARDRAILS ===");
    parts.push(personaSection);
  }

  // 3. Vibe/style rules
  const vibeSection = buildVibeSection(state);
  if (vibeSection) {
    parts.push("=== VIBE & STYLE ===");
    parts.push(vibeSection);
  }

  // 4. Dialogue structure
  const dialogueSection = buildDialogueStructure(state);
  if (dialogueSection) {
    parts.push("=== DIALOGUE REQUIREMENTS ===");
    parts.push(dialogueSection);
  }

  // 5. Anti-generic
  parts.push("=== QUALITY GATES ===");
  parts.push(ANTI_GENERIC_RULE);

  // 6. Format reminder
  parts.push(`
OUTPUT FORMAT:
- 1 vertical 9:16 clip
- Clear question followed by answer
- Caption text included
- Natural, authentic dialogue
`.trim());

  return parts.filter(Boolean).join("\n\n---\n");
}

/**
 * Build the negative prompt
 */
export function buildNegativePrompt(state: WizardState): string {
  const parts: string[] = [GLOBAL_NEGATIVE_PROMPT];

  if (state.videoType === "subway_interview") {
    parts.push(SUBWAY_NEGATIVE_PROMPT);
  }

  return parts.join(", ");
}
