/**
 * Input validation utilities for SubwayTakes
 * Ensures all user inputs meet requirements before processing
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// Maximum lengths for various input types
export const MAX_LENGTHS = {
  interviewQuestion: 500,
  anglePrompt: 1000,
  speechScript: 2000,
  topicInput: 200,
  batchSize: 10,
  minDuration: 3,
  maxDuration: 160,
} as const;

/**
 * Validate interview question length
 */
export function validateInterviewQuestion(question: string | null | undefined): ValidationResult {
  if (!question || question.trim().length === 0) {
    return { valid: true }; // Empty is allowed (optional field)
  }
  
  if (question.length > MAX_LENGTHS.interviewQuestion) {
    return {
      valid: false,
      error: `Interview question must be ${MAX_LENGTHS.interviewQuestion} characters or less`,
    };
  }
  
  return { valid: true };
}

/**
 * Validate angle prompt length
 */
export function validateAnglePrompt(prompt: string | null | undefined): ValidationResult {
  if (!prompt || prompt.trim().length === 0) {
    return { valid: true }; // Empty is allowed (optional field)
  }
  
  if (prompt.length > MAX_LENGTHS.anglePrompt) {
    return {
      valid: false,
      error: `Angle prompt must be ${MAX_LENGTHS.anglePrompt} characters or less`,
    };
  }
  
  return { valid: true };
}

/**
 * Validate speech script length
 */
export function validateSpeechScript(script: string | null | undefined): ValidationResult {
  if (!script || script.trim().length === 0) {
    return { valid: true }; // Empty is allowed (optional field)
  }
  
  if (script.length > MAX_LENGTHS.speechScript) {
    return {
      valid: false,
      error: `Speech script must be ${MAX_LENGTHS.speechScript} characters or less`,
    };
  }
  
  return { valid: true };
}

/**
 * Validate topic input
 */
export function validateTopicInput(topic: string | null | undefined): ValidationResult {
  if (!topic || topic.trim().length === 0) {
    return {
      valid: false,
      error: 'Topic is required',
    };
  }
  
  if (topic.length > MAX_LENGTHS.topicInput) {
    return {
      valid: false,
      error: `Topic must be ${MAX_LENGTHS.topicInput} characters or less`,
    };
  }
  
  return { valid: true };
}

/**
 * Validate batch size
 */
export function validateBatchSize(size: number): ValidationResult {
  if (size < 1 || size > MAX_LENGTHS.batchSize) {
    return {
      valid: false,
      error: `Batch size must be between 1 and ${MAX_LENGTHS.batchSize}`,
    };
  }
  
  return { valid: true };
}

/**
 * Validate duration
 */
export function validateDuration(duration: number): ValidationResult {
  if (duration < MAX_LENGTHS.minDuration || duration > MAX_LENGTHS.maxDuration) {
    return {
      valid: false,
      error: `Duration must be between ${MAX_LENGTHS.minDuration} and ${MAX_LENGTHS.maxDuration} seconds`,
    };
  }
  
  return { valid: true };
}

/**
 * Validate clip creation options
 */
export interface ClipCreationOptions {
  topic?: string;
  anglePrompt?: string;
  interviewQuestion?: string;
  speechScript?: string;
  duration?: number;
  batchSize?: number;
}

export function validateClipCreationOptions(options: ClipCreationOptions): ValidationResult {
  // Validate topic
  const topicValidation = validateTopicInput(options.topic);
  if (!topicValidation.valid) {
    return topicValidation;
  }
  
  // Validate angle prompt
  const angleValidation = validateAnglePrompt(options.anglePrompt);
  if (!angleValidation.valid) {
    return angleValidation;
  }
  
  // Validate interview question
  const questionValidation = validateInterviewQuestion(options.interviewQuestion);
  if (!questionValidation.valid) {
    return questionValidation;
  }
  
  // Validate speech script
  const scriptValidation = validateSpeechScript(options.speechScript);
  if (!scriptValidation.valid) {
    return scriptValidation;
  }
  
  // Validate duration
  if (options.duration !== undefined) {
    const durationValidation = validateDuration(options.duration);
    if (!durationValidation.valid) {
      return durationValidation;
    }
  }
  
  // Validate batch size
  if (options.batchSize !== undefined) {
    const batchValidation = validateBatchSize(options.batchSize);
    if (!batchValidation.valid) {
      return batchValidation;
    }
  }
  
  return { valid: true };
}

/**
 * Get character count with visual indicator
 */
export function getCharacterCountInfo(
  current: number,
  max: number
): { text: string; color: string } {
  const remaining = max - current;
  
  if (remaining < 0) {
    return {
      text: `${Math.abs(remaining)} over limit`,
      color: 'text-red-500',
    };
  }
  
  if (remaining < max * 0.1) {
    return {
      text: `${remaining} remaining`,
      color: 'text-amber-500',
    };
  }
  
  return {
    text: `${remaining} remaining`,
    color: 'text-zinc-500',
  };
}

/**
 * Sanitize and validate input in one step
 */
export function sanitizeAndValidate(
  input: string | null | undefined,
  validator: (val: string | null | undefined) => ValidationResult,
  sanitizer: (val: string | null | undefined) => string
): { value: string; validation: ValidationResult } {
  const sanitized = sanitizer(input);
  const validation = validator(sanitized);
  
  return {
    value: sanitized,
    validation,
  };
}

// === AGE-APPROPRIATE VALIDATION ===

import type { AgeGroup, InterviewMode } from './types';
import { TOPIC_AGE_MAP, MODE_AGE_RULES } from './constants';

/**
 * Validate that a topic is appropriate for the age group
 */
export function validateTopicAgeAppropriate(topic: string, ageGroup: AgeGroup): ValidationResult {
  if (!topic || topic.trim().length === 0) {
    return { valid: true }; // Empty is allowed, will be caught by other validation
  }
  
  const allowedGroups = TOPIC_AGE_MAP[topic];
  
  if (!allowedGroups) {
    // Unknown topic, allow it but log warning
    return { valid: true };
  }
  
  if (!allowedGroups.includes(ageGroup) && ageGroup !== 'all_ages') {
    return {
      valid: false,
      error: `The topic "${topic}" is not appropriate for the selected age group. Please choose a different topic or age group.`,
    };
  }
  
  return { valid: true };
}

/**
 * Validate that a mode is allowed for the age group
 */
export function validateModeAgeAllowed(mode: InterviewMode | null | undefined, ageGroup: AgeGroup): ValidationResult {
  if (!mode || mode === 'none') {
    return { valid: true }; // No mode selected, that's fine
  }
  
  const modeRule = MODE_AGE_RULES.find(r => r.mode === mode);
  
  if (!modeRule) {
    return { valid: true }; // Unknown mode, allow it
  }
  
  if (!modeRule.allowedAgeGroups.includes(ageGroup)) {
    return {
      valid: false,
      error: `The "${mode}" mode is not available for the selected age group. Please select a different mode.`,
    };
  }
  
  return { valid: true };
}

/**
 * Validate age group selection
 */
export function validateAgeGroup(ageGroup: AgeGroup | null | undefined): ValidationResult {
  const validGroups: AgeGroup[] = ['kids', 'teens', 'adults', 'older_adults', 'all_ages'];
  
  if (!ageGroup || !validGroups.includes(ageGroup)) {
    return {
      valid: false,
      error: 'Please select a valid age group',
    };
  }
  
  return { valid: true };
}

/**
 * Validate content for mature words based on age group
 */
export function validateNoMatureWords(
  content: string,
  ageGroup: AgeGroup,
  matureWordPatterns?: RegExp[]
): ValidationResult {
  // For kids and all_ages, be more strict
  const strictGroups: AgeGroup[] = ['kids', 'all_ages'];
  const isStrict = strictGroups.includes(ageGroup);
  
  if (!content || content.trim().length === 0) {
    return { valid: true };
  }
  
  // Common mature word patterns to check
  const maturePatterns = [
    /\b(sex|sexual|sexy)\b/i,
    /\b(fuck|fucking|fucker|fucks|fck)\b/i,
    /\b(shit|bullshit|shitting)\b/i,
    /\b(ass|asshole|asses)\b/i,
    /\b(bitch|bitches|bitchy)\b/i,
    /\b(damn|damned|goddamn)\b/i,
    /\b(hell)\b/i,
    /\b(nude|naked)\b/i,
    /\b(drunk|stoned|high|weed)\b/i,
  ];
  
  const patternsToUse = matureWordPatterns || maturePatterns;
  
  for (const pattern of patternsToUse) {
    if (pattern.test(content)) {
      if (isStrict) {
        return {
          valid: false,
          error: 'Content contains inappropriate language. Please revise for a family-friendly audience.',
        };
      }
    }
  }
  
  return { valid: true };
}

/**
 * Comprehensive age-appropriate validation for clip creation
 */
export interface AgeAppropriateValidationOptions {
  topic?: string;
  interviewQuestion?: string;
  anglePrompt?: string;
  speechScript?: string;
  ageGroup?: AgeGroup;
  interviewMode?: InterviewMode;
}

export function validateAgeAppropriateContent(options: AgeAppropriateValidationOptions): ValidationResult {
  // Validate age group first
  if (options.ageGroup) {
    const ageGroupValidation = validateAgeGroup(options.ageGroup);
    if (!ageGroupValidation.valid) {
      return ageGroupValidation;
    }
  }
  
  // Validate topic for age group
  if (options.topic && options.ageGroup) {
    const topicValidation = validateTopicAgeAppropriate(options.topic, options.ageGroup);
    if (!topicValidation.valid) {
      return topicValidation;
    }
  }
  
  // Validate mode for age group
  if (options.interviewMode && options.ageGroup) {
    const modeValidation = validateModeAgeAllowed(options.interviewMode, options.ageGroup);
    if (!modeValidation.valid) {
      return modeValidation;
    }
  }
  
  // Validate interview question for mature words
  if (options.interviewQuestion && options.ageGroup) {
    const matureValidation = validateNoMatureWords(options.interviewQuestion, options.ageGroup);
    if (!matureValidation.valid) {
      return matureValidation;
    }
  }
  
  // Validate angle prompt for mature words
  if (options.anglePrompt && options.ageGroup) {
    const matureValidation = validateNoMatureWords(options.anglePrompt, options.ageGroup);
    if (!matureValidation.valid) {
      return matureValidation;
    }
  }
  
  // Validate speech script for mature words
  if (options.speechScript && options.ageGroup) {
    const matureValidation = validateNoMatureWords(options.speechScript, options.ageGroup);
    if (!matureValidation.valid) {
      return matureValidation;
    }
  }
  
  return { valid: true };
}

/**
 * Get warning message if content may not be age-appropriate
 */
export function getAgeAppropriatenessWarning(topic: string, ageGroup: AgeGroup): string | null {
  const allowedGroups = TOPIC_AGE_MAP[topic];
  
  if (!allowedGroups) {
    return null;
  }
  
  if (!allowedGroups.includes(ageGroup) && ageGroup !== 'all_ages') {
    return `This topic may not be appropriate for ${ageGroup.replace('_', ' ')}. Consider a different topic or age group.`;
  }
  
  return null;
}
