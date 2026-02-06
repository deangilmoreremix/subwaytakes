import type { InterviewStyle } from './types';
import { INTERVIEW_STYLE_META, type InterviewStyleMeta } from './interviewStyleSpecs';

/**
 * Build interview style hardening rules from metadata.
 * This function converts style metadata into a string that can be appended to prompts.
 */
export function buildInterviewStyleHardening(style: InterviewStyle | undefined): string {
  if (!style) return '';
  const meta = INTERVIEW_STYLE_META[style];
  if (!meta) return '';

  const lines: string[] = [];

  if (meta.mustInclude?.length) {
    lines.push(`MUST INCLUDE:\n- ${meta.mustInclude.join('\n- ')}`);
  }
  if (meta.forbidden?.length) {
    lines.push(`FORBIDDEN:\n- ${meta.forbidden.join('\n- ')}`);
  }
  if (meta.structureRules?.length) {
    lines.push(`STRUCTURE RULES:\n- ${meta.structureRules.join('\n- ')}`);
  }

  const shape = meta.responseShape;
  if (shape?.hook) lines.push(`HOOK: ${shape.hook}`);
  if (shape?.beats?.length) lines.push(`BEATS:\n- ${shape.beats.join('\n- ')}`);
  if (shape?.closing) lines.push(`CLOSING: ${shape.closing}`);

  return lines.length
    ? `\n\n=== INTERVIEW STYLE HARDENING (${meta.label}) ===\n${lines.join('\n')}`
    : '';
}

/**
 * Get interview style metadata by value.
 */
export function getInterviewStyleMeta(style: InterviewStyle): InterviewStyleMeta | undefined {
  return INTERVIEW_STYLE_META[style];
}

/**
 * Check if a style is subway-safe.
 */
export function isStyleSubwaySafe(style: InterviewStyle | undefined): boolean {
  if (!style) return true;
  return INTERVIEW_STYLE_META[style]?.subwaySafe ?? true;
}

/**
 * Get recommended seconds for a style.
 */
export function getRecommendedSeconds(style: InterviewStyle | undefined): number[] {
  if (!style) return [4, 6, 8];
  return INTERVIEW_STYLE_META[style]?.recommendedSeconds ?? [4, 6, 8];
}

/**
 * Get best-for goals for a style.
 */
export function getStyleGoals(style: InterviewStyle | undefined): ('comments' | 'shares' | 'saves' | 'leads')[] {
  if (!style) return ['shares', 'comments'];
  return INTERVIEW_STYLE_META[style]?.bestFor ?? ['shares', 'comments'];
}
