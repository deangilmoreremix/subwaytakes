import type { GenerateRequest } from './types';

// ============================================================================
// GENERIC QUALITY RULES - Applied to ALL prompts
// ============================================================================

export const GENERIC_QUALITY_RULES = `
GLOBAL QUALITY RULES:
- Vertical 9:16, realistic documentary feel.
- Single continuous shot (no cuts).
- No text inside the video frame.
- Natural faces and proportions.
`.trim();

export const FINAL_SELF_CHECK = `
FINAL CHECK:
- Verify mandatory constraints are satisfied.
- If a mandatory visual anchor is missing, regenerate the scene.
`.trim();

// ============================================================================
// DURATION PACING - Guides dialogue length based on clip duration
// ============================================================================

export function durationPacing(durationSeconds: number): string {
  if (durationSeconds <= 3) {
    return `
DIALOGUE PACING (<=3s):
- One question (<=8 words).
- One answer (<=12 words).
- No follow-up.
`.trim();
  }
  if (durationSeconds <= 6) {
    return `
DIALOGUE PACING (4-6s):
- One question (<=10 words).
- One answer (2-3 short lines).
- Optional 1-word reaction from interviewer.
`.trim();
  }
  return `
DIALOGUE PACING (8s+):
- One question.
- One follow-up.
- Subject gives 2-4 short lines total.
`.trim();
}

// ============================================================================
// MODE PROMPTS - Controls interview structure based on selected mode
// ============================================================================

export const MODE_PROMPTS: Record<string, string> = {
  standard: `
MODE: STANDARD
STRUCTURE:
- Ask one clear question.
- One follow-up only if time allows.
ENDING:
- End with a simple question to viewers.
`.trim(),

  rapid_fire_round: `
MODE: RAPID FIRE ROUND
STRUCTURE:
- Ask 3-5 rapid questions (very short).
- Subject answers in punchy one-liners.
ENDING:
- End with the spiciest question.
`.trim(),

  myth_busters: `
MODE: MYTH BUSTERS
STRUCTURE:
- Present 1 myth about the topic.
- Subject corrects it with 1-2 short facts.
ENDING:
- "What other myths should we bust?"
`.trim(),

  story_time: `
MODE: STORY TIME
STRUCTURE:
- Start with "This happened to me..."
- 1 vivid detail + turning point + lesson.
ENDING:
- End with the lesson in one sentence.
`.trim(),

  expert_take: `
MODE: EXPERT TAKE
STRUCTURE:
- Subject speaks as someone experienced.
- Give 1 principle + 1 example.
ENDING:
- End with a practical takeaway.
`.trim(),

  // Extended modes from existing system
  hot_take_challenge: `
MODE: HOT TAKE CHALLENGE
STRUCTURE:
- Present a controversial opinion.
- Subject responds with strong take.
- Brief pushback.
ENDING:
- "What's YOUR take?"
`.trim(),

  deep_dive_interview: `
MODE: DEEP DIVE
STRUCTURE:
- Open with thought-provoking question.
- Allow detailed response.
- Follow up with "Tell me more about that."
ENDING:
- Summarize key insight, ask for final thought.
`.trim(),

  would_you_rather: `
MODE: WOULD YOU RATHER
STRUCTURE:
- Present two options.
- Subject picks and explains.
- Brief elaboration.
ENDING:
- "Which would YOU choose?"
`.trim(),

  unpopular_opinion: `
MODE: UNPOPULAR OPINION
STRUCTURE:
- Present contrarian view.
- Subject defends stance.
- Expects pushback energy.
ENDING:
- "Agree or disagree?"
`.trim(),

  roast_me: `
MODE: ROAST ME
STRUCTURE:
- Playful challenge format.
- Subject accepts challenge.
- Give genuine observations.
ENDING:
- "Roast me harder!"
`.trim(),

  truth_or_dare_style: `
MODE: TRUTH OR DARE
STRUCTURE:
- Present truth challenge.
- Subject commits to answer.
- Authentic vulnerability.
ENDING:
- "Truth or dare - you decide."
`.trim(),

  none: `
MODE: FREE FORM
STRUCTURE:
- Open conversational format.
- Let the moment unfold naturally.
ENDING:
- Natural conversation wrap.
`.trim(),
};

export function modeBlock(mode?: string): string {
  if (!mode || mode === 'none') return '';
  return MODE_PROMPTS[mode] || '';
}

// ============================================================================
// HARDCORE PROMPT TEMPLATE - Consistent structure for all prompts
// ============================================================================

export interface PromptHardeningOptions {
  systemRules?: string;
  visualAnchors?: string;
  forbidden?: string;
}

export function hardenPrompt(
  basePrompt: string,
  req: GenerateRequest,
  extra?: PromptHardeningOptions
): string {
  const systemRules = extra?.systemRules?.trim() || '';
  const visualAnchors = extra?.visualAnchors?.trim() || '';
  const forbidden = extra?.forbidden?.trim() || '';

  return `
${GENERIC_QUALITY_RULES}

${systemRules ? `SYSTEM RULES:\n${systemRules}\n` : ''}

${modeBlock(req.interviewMode || req.interviewStyle)}

${durationPacing(req.durationSeconds)}

${visualAnchors ? `VISUAL ANCHORS (CRITICAL):\n${visualAnchors}\n` : ''}

${basePrompt}

${forbidden ? `FORBIDDEN:\n${forbidden}\n` : ''}

${FINAL_SELF_CHECK}
`.trim();
}

// ============================================================================
// NEGATIVE PROMPT MERGING - Safe concatenation
// ============================================================================

export function mergeNegativePrompt(base: string, add?: string): string {
  if (!add) return base;
  return `${base}, ${add}`;
}

// ============================================================================
// WISDOM RULES HELPER
// ============================================================================

export function shouldApplyWisdomRules(req: GenerateRequest): boolean {
  return req.videoType === 'wisdom_interview' || req.targetAgeGroup === 'older_adults';
}
