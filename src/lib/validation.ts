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

// ============================================================
// PRE-GENERATION VALIDATION
// Validates the full set of creation options before any API
// call is made. Returns a list of all issues found.
// ============================================================

import type { ClipType, ModelTier } from './types';
import {
  VIDEO_TYPE_SPECS,
  getEffectiveDurationCap,
  PLATFORM_EXPORT_SPECS,
} from './videoTypeSpecs';

export interface PreGenerationIssue {
  field: string;
  severity: 'error' | 'warning';
  message: string;
}

export interface PreGenerationValidationResult {
  valid: boolean;
  issues: PreGenerationIssue[];
  warnings: PreGenerationIssue[];
  effectiveDurationSeconds: number;
}

export interface PreGenerationOptions {
  videoType: ClipType;
  topic: string;
  durationSeconds: number;
  modelTier?: ModelTier;
  anglePrompt?: string;
  interviewQuestion?: string;
  speechScript?: string;
  batchSize?: number;
  exportPlatforms?: string[];
  sceneType?: string;
  cityStyle?: string;
  energyLevel?: string;
  interviewStyle?: string;
}

export function validatePreGeneration(opts: PreGenerationOptions): PreGenerationValidationResult {
  const issues: PreGenerationIssue[] = [];
  const warnings: PreGenerationIssue[] = [];

  const spec = VIDEO_TYPE_SPECS[opts.videoType];

  if (!spec) {
    issues.push({
      field: 'videoType',
      severity: 'error',
      message: `Unknown video type: "${opts.videoType}". Must be one of: subway_interview, street_interview, motivational, studio_interview, wisdom_interview`,
    });
    return { valid: false, issues, warnings, effectiveDurationSeconds: opts.durationSeconds };
  }

  // Topic validation
  const topicResult = validateTopicInput(opts.topic);
  if (!topicResult.valid) {
    issues.push({ field: 'topic', severity: 'error', message: topicResult.error! });
  }

  // Duration validation against global limits
  const durationResult = validateDuration(opts.durationSeconds);
  if (!durationResult.valid) {
    issues.push({ field: 'durationSeconds', severity: 'error', message: durationResult.error! });
  }

  // Duration validation against video type limits
  if (opts.durationSeconds < spec.minDurationSeconds) {
    issues.push({
      field: 'durationSeconds',
      severity: 'error',
      message: `${spec.label} requires a minimum duration of ${spec.minDurationSeconds}s`,
    });
  }
  if (opts.durationSeconds > spec.maxDurationSeconds) {
    issues.push({
      field: 'durationSeconds',
      severity: 'error',
      message: `${spec.label} supports a maximum duration of ${spec.maxDurationSeconds}s`,
    });
  }

  // Provider / model tier duration cap warnings
  const tier = opts.modelTier ?? 'standard';
  const { wasCapped, capReason, effectiveDuration } = getEffectiveDurationCap(opts.durationSeconds, tier);
  if (wasCapped) {
    warnings.push({
      field: 'durationSeconds',
      severity: 'warning',
      message: capReason!,
    });
  }

  // Required scene / city / energy / interview style
  if (spec.requiresScene && !opts.sceneType) {
    warnings.push({
      field: 'sceneType',
      severity: 'warning',
      message: `${spec.label} works best with a scene type selected`,
    });
  }
  if (spec.requiresCityStyle && !opts.cityStyle) {
    warnings.push({
      field: 'cityStyle',
      severity: 'warning',
      message: `${spec.label} works best with a city style selected`,
    });
  }
  if (spec.requiresEnergyLevel && !opts.energyLevel) {
    warnings.push({
      field: 'energyLevel',
      severity: 'warning',
      message: `${spec.label} works best with an energy level selected`,
    });
  }
  if (spec.requiresInterviewStyle && !opts.interviewStyle) {
    warnings.push({
      field: 'interviewStyle',
      severity: 'warning',
      message: `${spec.label} requires an interview style for best results`,
    });
  }

  // Batch support
  if (opts.batchSize !== undefined && opts.batchSize > 1 && !spec.supportsBatch) {
    issues.push({
      field: 'batchSize',
      severity: 'error',
      message: `${spec.label} does not support batch generation`,
    });
  }

  // Optional field length checks
  const angleResult = validateAnglePrompt(opts.anglePrompt);
  if (!angleResult.valid) {
    issues.push({ field: 'anglePrompt', severity: 'error', message: angleResult.error! });
  }

  const questionResult = validateInterviewQuestion(opts.interviewQuestion);
  if (!questionResult.valid) {
    issues.push({ field: 'interviewQuestion', severity: 'error', message: questionResult.error! });
  }

  const scriptResult = validateSpeechScript(opts.speechScript);
  if (!scriptResult.valid) {
    issues.push({ field: 'speechScript', severity: 'error', message: scriptResult.error! });
  }

  // Prompt length against spec
  if (opts.anglePrompt && opts.anglePrompt.length > spec.maxPromptLength) {
    issues.push({
      field: 'anglePrompt',
      severity: 'error',
      message: `Angle prompt exceeds the ${spec.maxPromptLength}-character maximum for ${spec.label}`,
    });
  }

  if (opts.speechScript && opts.speechScript.length > spec.maxSpeechScriptLength) {
    issues.push({
      field: 'speechScript',
      severity: 'error',
      message: `Speech script exceeds the ${spec.maxSpeechScriptLength}-character maximum for ${spec.label}`,
    });
  }

  // Export platform duration compatibility
  if (opts.exportPlatforms && opts.exportPlatforms.length > 0) {
    for (const platformId of opts.exportPlatforms) {
      const platformSpec = PLATFORM_EXPORT_SPECS.find(p => p.platform === platformId);
      if (platformSpec && effectiveDuration > platformSpec.maxDurationSeconds) {
        warnings.push({
          field: 'exportPlatforms',
          severity: 'warning',
          message: `Video duration (${effectiveDuration}s) exceeds ${platformSpec.label} limit of ${platformSpec.maxDurationSeconds}s`,
        });
      }
    }
  }

  const errors = issues.filter(i => i.severity === 'error');
  return {
    valid: errors.length === 0,
    issues: errors,
    warnings,
    effectiveDurationSeconds: effectiveDuration,
  };
}

// ============================================================
// OUTPUT VERIFICATION
// Validates a completed video result against its spec before
// marking the clip as done.
// ============================================================

export interface VideoOutputResult {
  url: string;
  videoType: ClipType;
  requestedDurationSeconds: number;
  modelTier: 'standard' | 'premium';
  isDemo?: boolean;
}

export interface OutputVerificationResult {
  valid: boolean;
  issues: string[];
  warnings: string[];
  status: 'done' | 'demo' | 'error';
}

export function verifyVideoOutput(result: VideoOutputResult): OutputVerificationResult {
  const issues: string[] = [];
  const warnings: string[] = [];

  if (!result.url || result.url.trim().length === 0) {
    issues.push('No result URL returned from the generation provider');
  }

  if (result.url && !result.url.startsWith('http') && !result.url.startsWith('data:')) {
    issues.push(`Result URL has an unexpected format: "${result.url.slice(0, 60)}..."`);
  }

  const spec = VIDEO_TYPE_SPECS[result.videoType];
  if (!spec) {
    issues.push(`Cannot verify output: unknown video type "${result.videoType}"`);
  }

  const { wasCapped, capReason, effectiveDuration } = getEffectiveDurationCap(
    result.requestedDurationSeconds,
    result.modelTier
  );

  if (wasCapped) {
    warnings.push(`Duration was capped: ${capReason}. Effective duration: ${effectiveDuration}s`);
  }

  if (result.isDemo) {
    warnings.push('This clip used a demo video because no API key was configured or generation failed');
  }

  const status: OutputVerificationResult['status'] =
    issues.length > 0 ? 'error' : result.isDemo ? 'demo' : 'done';

  return {
    valid: issues.length === 0,
    issues,
    warnings,
    status,
  };
}

// ============================================================
// RUNTIME MONITORING
// Tracks clip status transitions and detects anomalies.
// ============================================================

export type ClipLifecycleStatus = 'queued' | 'running' | 'done' | 'demo' | 'error';

export interface ClipLifecycleEvent {
  clipId: string;
  fromStatus: ClipLifecycleStatus | null;
  toStatus: ClipLifecycleStatus;
  timestamp: number;
}

const VALID_STATUS_TRANSITIONS: Record<ClipLifecycleStatus, ClipLifecycleStatus[]> = {
  queued: ['running', 'error'],
  running: ['done', 'demo', 'error'],
  done: [],
  demo: [],
  error: ['queued'],
};

export function validateStatusTransition(
  from: ClipLifecycleStatus | null,
  to: ClipLifecycleStatus
): { valid: boolean; reason: string | null } {
  if (from === null) {
    return { valid: true, reason: null };
  }
  const allowed = VALID_STATUS_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    return {
      valid: false,
      reason: `Invalid status transition: "${from}" -> "${to}". Allowed transitions from "${from}": [${allowed.join(', ') || 'none'}]`,
    };
  }
  return { valid: true, reason: null };
}

export function buildValidationSummary(result: PreGenerationValidationResult): string {
  if (result.valid && result.warnings.length === 0) {
    return 'All checks passed';
  }
  const parts: string[] = [];
  if (!result.valid) {
    parts.push(`${result.issues.length} error${result.issues.length !== 1 ? 's' : ''}`);
  }
  if (result.warnings.length > 0) {
    parts.push(`${result.warnings.length} warning${result.warnings.length !== 1 ? 's' : ''}`);
  }
  return parts.join(', ');
}
