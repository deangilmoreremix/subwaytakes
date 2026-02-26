/**
 * Content Filter Module for Age-Appropriate Content Control
 * Filters topics, modes, and questions based on age groups
 */

import type { AgeGroup, ContentRating, InterviewMode } from './types';
import { 
  AGE_GROUP_CONFIGS, 
  TOPIC_AGE_MAP, 
  MODE_AGE_RULES,
  filterTopicsByAge as filterTopicsByAgeConst,
  filterModesByAge as filterModesByAgeConst,
  INTERVIEW_MODES,
} from './constants';

// === MATURE WORD FILTER ===

// List of mature/adult words to filter out for younger audiences
export const MATURE_WORD_LIST = [
  // Explicit adult content
  'sex', 'sexual', 'sexually', 'fuck', 'fucking', 'fucker', 'fucks', 'fck',
  'shit', 'shitting', 'shitty', 'bullshit', 'ass', 'asses', 'asshole', 'assholes',
  'bitch', 'bitches', 'bitchy', 'bitching', 'damn', 'damned', 'goddamn', 'hell',
  'bastard', 'bastards', 'crap', 'crappy', 'piss', 'pissing', 'dick', 'dicks',
  'cock', 'cocks', 'cunt', 'cunts', 'pussy', 'pussies', 'whore', 'whores',
  'slut', 'sluts', 'slutty', 'nigger', 'nigga', 'faggot', 'faggots', 'faggy',
  'retard', 'retarded', 'spastic', 'dyke', 'tranny', 'shemale', 'handjob',
  'blowjob', 'fucked', 'suck', 'sucks', 'sucking', 'sucked', 'motherfucker',
  
  // Mild mature (filter for PG-13 and below)
  'drunk', 'drunked', 'getting drunk', 'hangover', 'weed', 'stoned', 'high',
  'pot', 'marijuana', 'cocaine', 'drugs', 'drug', 'pill', 'pills', ' LSD',
  'alcohol', 'beer', 'wine', 'shots', 'getting wasted', 'wasted', 'party',
  'parties', 'partying', 'hookup', 'hookups', 'one night stand', 'casual',
  'nude', 'naked', 'nsfw', 'nsfl', 'explicit', 'adult', 'xxx', 'porn',
  'masturbat', 'orgasm', 'sexy', 'sexiest', 'kiss', 'kissing', 'making out',
  'tongue', 'deepthroat', 'throat',
  
  // Violence/gore (age-restricted)
  'kill', 'kills', 'killing', 'killed', 'murder', 'murdered', 'murderer',
  'die', 'dies', 'died', 'dying', 'death', 'dead', 'suicide', 'suicidal',
  'stab', 'stabbed', 'stabbing', 'shoot', 'shot', 'shooting', 'gun', 'guns',
  'bomb', 'bombing', 'explode', 'exploded', 'explosion', 'blood', 'bloody',
  'gore', 'gory', 'rip', 'torn', 'tear', 'torn apart', 'broken', 'break',
  
  // Mature themes
  'divorce', 'divorced', 'cheating', 'cheater', 'cheated', 'affair',
  'therapy', 'therapist', 'counseling', 'depressed', 'depression', 'anxiety',
  'anxious', 'panic', 'abuse', 'abusive', 'trauma', 'traumatic', 'rape',
  'raped', 'molest', 'molested', 'harass', 'harassment', 'stalk', 'stalked',
];

// Regex patterns for mature word detection
const MATURE_WORD_PATTERNS = MATURE_WORD_LIST.map(word =>
  new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
);

// === AGE GROUP HIERARCHY ===

// Order of strictness: kids < teens < older_adults < adults
export const AGE_GROUP_HIERARCHY: AgeGroup[] = [
  'kids',
  'teens',
  'older_adults',
  'adults',
];

// Content rating thresholds by age group
export const AGE_GROUP_RATINGS: Record<AgeGroup, ContentRating[]> = {
  kids: ['G'],
  teens: ['G', 'PG'],
  older_adults: ['G', 'PG', 'PG-13'],
  adults: ['G', 'PG', 'PG-13', 'R'],
  all_ages: ['G'],
};

// Get the strictness level of an age group
export function getAgeGroupStrictness(ageGroup: AgeGroup): number {
  if (ageGroup === 'all_ages') return 0;
  return AGE_GROUP_HIERARCHY.indexOf(ageGroup);
}

// Check if content is appropriate for the age group
export function isContentAgeAppropriate(
  content: { ageGroups?: AgeGroup[]; contentRating?: ContentRating },
  ageGroup: AgeGroup
): boolean {
  if (content.ageGroups && content.ageGroups.length > 0) {
    if (ageGroup === 'all_ages') return content.ageGroups.includes('kids');
    return content.ageGroups.includes(ageGroup);
  }
  
  // If content has a rating, check against allowed ratings
  if (content.contentRating) {
    const allowedRatings = AGE_GROUP_RATINGS[ageGroup];
    const ratingOrder: ContentRating[] = ['G', 'PG', 'PG-13', 'R'];
    const contentRatingIndex = ratingOrder.indexOf(content.contentRating);
    const maxAllowedIndex = Math.max(...allowedRatings.map(r => ratingOrder.indexOf(r)));
    
    return contentRatingIndex <= maxAllowedIndex;
  }
  
  // Default: allow content for all ages
  return true;
}

// === TOPIC FILTERING ===

/**
 * Filter topics based on age group
 */
export function filterTopicsByAge(topics: string[], ageGroup: AgeGroup): string[] {
  return filterTopicsByAgeConst(topics, ageGroup);
}

/**
 * Get topics that are NOT appropriate for an age group
 */
export function getInappropriateTopics(topics: string[], ageGroup: AgeGroup): string[] {
  return topics.filter(topic => {
    const allowedGroups = TOPIC_AGE_MAP[topic] || [];
    return !allowedGroups.includes(ageGroup) && ageGroup !== 'all_ages';
  });
}

// === MODE FILTERING ===

/**
 * Filter interview modes based on age group
 */
export function filterModesByAge(ageGroup: AgeGroup): { mode: InterviewMode; label: string; description: string; emoji: string }[] {
  const filtered = filterModesByAgeConst(INTERVIEW_MODES, ageGroup);
  return filtered.map(m => ({
    mode: m.value,
    label: m.label,
    description: m.description,
    emoji: m.emoji,
  }));
}

/**
 * Check if a specific mode is allowed for an age group
 */
export function isModeAllowed(mode: InterviewMode, ageGroup: AgeGroup): boolean {
  const modeRule = MODE_AGE_RULES.find(r => r.mode === mode);
  if (!modeRule) return false;
  
  return modeRule.allowedAgeGroups.includes(ageGroup);
}

/**
 * Get modes that require parental guidance for an age group
 */
export function getModesRequiringGuidance(ageGroup: AgeGroup): InterviewMode[] {
  if (ageGroup === 'kids') {
    // Kids mode doesn't allow any restricted modes, so return empty
    return [];
  }
  
  return MODE_AGE_RULES
    .filter(r => r.requiresParentalGuidance && r.allowedAgeGroups.includes(ageGroup))
    .map(r => r.mode);
}

// === QUESTION FILTERING ===

export interface QuestionWithAge {
  id: string;
  category: string;
  question: string;
  ageGroups: AgeGroup[];
  contentRating: ContentRating;
  isTrending?: boolean;
}

/**
 * Filter questions based on age group
 */
export function filterQuestionsByAge(questions: QuestionWithAge[], ageGroup: AgeGroup): QuestionWithAge[] {
  return questions.filter(q => 
    isContentAgeAppropriate({ ageGroups: q.ageGroups, contentRating: q.contentRating }, ageGroup)
  );
}

/**
 * Get age-appropriate follow-up questions for a topic
 */
export function getAgeAppropriateQuestions(
  questions: QuestionWithAge[],
  ageGroup: AgeGroup,
  limit: number = 5
): QuestionWithAge[] {
  return filterQuestionsByAge(questions, ageGroup).slice(0, limit);
}

// === CONTENT SANITIZATION ===

/**
 * Sanitize content by replacing mature words with asterisks
 */
export function sanitizeForAge(content: string, ageGroup: AgeGroup): string {
  let sanitized = content;
  
  // For kids and all_ages, filter all mature words
  if (ageGroup === 'kids' || ageGroup === 'all_ages') {
    MATURE_WORD_PATTERNS.forEach(pattern => {
      sanitized = sanitized.replace(pattern, match => '*'.repeat(match.length));
    });
  }
  
  // For teens, filter explicit words but allow mild mature
  if (ageGroup === 'teens') {
    const explicitPatterns = MATURE_WORD_LIST.slice(0, 50).map(word => 
      new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
    );
    explicitPatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, match => '*'.repeat(match.length));
    });
  }
  
  return sanitized;
}

/**
 * Check if content contains mature words
 */
export function containsMatureWords(content: string, ageGroup: AgeGroup): boolean {
  const patterns = ageGroup === 'kids' || ageGroup === 'all_ages' 
    ? MATURE_WORD_PATTERNS 
    : MATURE_WORD_PATTERNS.slice(0, 50);
  
  return patterns.some(pattern => pattern.test(content));
}

/**
 * Get a warning message if content is not age-appropriate
 */
export function getAgeAppropriatenessWarning(
  topic: string,
  ageGroup: AgeGroup
): string | null {
  const allowedGroups = TOPIC_AGE_MAP[topic];
  
  if (!allowedGroups) {
    return null;
  }
  
  if (!allowedGroups.includes(ageGroup)) {
    const config = AGE_GROUP_CONFIGS[ageGroup];
    return `This topic may not be appropriate for ${config.displayName} (${config.ageRange}). Consider a different topic or age group.`;
  }
  
  return null;
}

// === CONTENT SUGGESTIONS ===

/**
 * Get suggested topics for an age group
 */
export function getSuggestedTopics(ageGroup: AgeGroup): string[] {
  const allowedTopics = Object.entries(TOPIC_AGE_MAP)
    .filter(([, groups]) => groups.includes(ageGroup) || ageGroup === 'all_ages')
    .map(([topic]) => topic);
  
  return allowedTopics.slice(0, 15);
}

/**
 * Get trending topics for an age group
 */
export function getTrendingTopicsForAge(ageGroup: AgeGroup): string[] {
  // For now, return subset of age-appropriate topics
  const topics = getSuggestedTopics(ageGroup);
  
  // Prioritize certain topics for different age groups
  if (ageGroup === 'kids') {
    return ['Dreams', 'Teamwork', 'Friends', 'Sports', 'Imagination', 'Kindness'];
  }
  if (ageGroup === 'teens') {
    return ['Social Media', 'Dating', 'College', 'Sleep Schedules', 'Friends', 'Mental Health'];
  }
  if (ageGroup === 'older_adults') {
    return ['Career', 'Money', 'Retirement', 'Life Lessons', 'Wisdom', 'Relationships'];
  }
  if (ageGroup === 'adults') {
    return ['Career', 'Money', 'Success', 'Philosophy', 'Life Advice', 'Relationships'];
  }
  
  return topics.slice(0, 6);
}

// === VALIDATION HELPERS ===

/**
 * Validate that a topic is appropriate for the age group
 */
export function validateTopicAgeAppropriate(topic: string, ageGroup: AgeGroup): { valid: boolean; message?: string } {
  if (!topic || topic.trim().length === 0) {
    return { valid: true };
  }
  
  const warning = getAgeAppropriatenessWarning(topic, ageGroup);
  
  if (warning) {
    return { valid: false, message: warning };
  }
  
  return { valid: true };
}

/**
 * Validate that a mode is allowed for the age group
 */
export function validateModeAgeAllowed(mode: InterviewMode, ageGroup: AgeGroup): { valid: boolean; message?: string } {
  if (!mode || mode === 'none') {
    return { valid: true };
  }
  
  if (!isModeAllowed(mode, ageGroup)) {
    const config = AGE_GROUP_CONFIGS[ageGroup];
    return { 
      valid: false, 
      message: `The "${mode}" mode is not available for ${config.displayName}. Please select a different mode.` 
    };
  }
  
  return { valid: true };
}

/**
 * Validate that content doesn't contain mature words
 */
export function validateNoMatureWords(content: string, ageGroup: AgeGroup): { valid: boolean; message?: string } {
  if (containsMatureWords(content, ageGroup)) {
    return { 
      valid: false, 
      message: 'The content contains inappropriate language. Please revise for a family-friendly audience.' 
    };
  }
  
  return { valid: true };
}

/**
 * Get age-appropriate description for a clip
 */
export function getAgeGroupDescription(ageGroup: AgeGroup): string {
  const config = AGE_GROUP_CONFIGS[ageGroup];
  return `${config.icon} ${config.displayName} (${config.ageRange}) - ${config.description}`;
}
