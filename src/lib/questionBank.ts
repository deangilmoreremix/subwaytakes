import { supabase } from './supabase';
import { generateUserId } from './format';

export interface QuestionBankItem {
  id: string;
  category: string;
  question: string;
  is_trending: boolean;
  usage_count: number;
  created_at: string;
  user_id: string | null;
  is_custom: boolean;
  hook_type: string | null;
  energy_level: string | null;
  notes: string | null;
}

export type HookType = 'provocative' | 'personal' | 'hypothetical' | 'opinion' | 'story';
export type QuestionEnergyLevel = 'low' | 'medium' | 'high' | 'chaotic';

export const HOOK_TYPES: { id: HookType; label: string; description: string }[] = [
  { id: 'provocative', label: 'Provocative', description: 'Challenges assumptions or sparks debate' },
  { id: 'personal', label: 'Personal', description: 'Asks about experiences or feelings' },
  { id: 'hypothetical', label: 'Hypothetical', description: 'What-if scenarios' },
  { id: 'opinion', label: 'Opinion', description: 'Seeks hot takes or preferences' },
  { id: 'story', label: 'Story', description: 'Prompts storytelling responses' },
];

export const ENERGY_LEVELS: { id: QuestionEnergyLevel; label: string }[] = [
  { id: 'low', label: 'Low - Thoughtful' },
  { id: 'medium', label: 'Medium - Conversational' },
  { id: 'high', label: 'High - Energetic' },
  { id: 'chaotic', label: 'Chaotic - Wild' },
];

export async function listQuestions(options?: {
  category?: string;
  trendingOnly?: boolean;
  includeCustom?: boolean;
  limit?: number;
}): Promise<QuestionBankItem[]> {
  const userId = generateUserId();

  let query = supabase
    .from('question_bank')
    .select('*')
    .order('is_trending', { ascending: false })
    .order('usage_count', { ascending: false })
    .order('created_at', { ascending: false });

  if (options?.category) {
    query = query.eq('category', options.category);
  }

  if (options?.trendingOnly) {
    query = query.eq('is_trending', true);
  }

  if (options?.includeCustom !== false) {
    query = query.or(`is_custom.eq.false,user_id.eq.${userId}`);
  } else {
    query = query.eq('is_custom', false);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);
  return (data || []) as QuestionBankItem[];
}

export async function getQuestionById(id: string): Promise<QuestionBankItem | null> {
  const { data, error } = await supabase
    .from('question_bank')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as QuestionBankItem | null;
}

export async function createQuestion(question: {
  category: string;
  question: string;
  hook_type?: string;
  energy_level?: string;
  notes?: string;
}): Promise<QuestionBankItem> {
  const userId = generateUserId();

  const { data, error } = await supabase
    .from('question_bank')
    .insert({
      ...question,
      user_id: userId,
      is_custom: true,
      is_trending: false,
      usage_count: 0,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as QuestionBankItem;
}

export async function updateQuestion(
  id: string,
  updates: Partial<Pick<QuestionBankItem, 'question' | 'category' | 'is_trending' | 'hook_type' | 'energy_level' | 'notes'>>
): Promise<QuestionBankItem> {
  const { data, error } = await supabase
    .from('question_bank')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as QuestionBankItem;
}

export async function deleteQuestion(id: string): Promise<void> {
  const { error } = await supabase
    .from('question_bank')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function incrementUsageCount(id: string): Promise<void> {
  const { data, error: fetchError } = await supabase
    .from('question_bank')
    .select('usage_count')
    .eq('id', id)
    .maybeSingle();

  if (!fetchError && data) {
    await supabase
      .from('question_bank')
      .update({ usage_count: (data.usage_count || 0) + 1 })
      .eq('id', id);
  }
}

export async function toggleTrending(id: string, isTrending: boolean): Promise<QuestionBankItem> {
  return updateQuestion(id, { is_trending: isTrending });
}

export async function searchQuestions(searchTerm: string): Promise<QuestionBankItem[]> {
  const userId = generateUserId();

  const { data, error } = await supabase
    .from('question_bank')
    .select('*')
    .or(`is_custom.eq.false,user_id.eq.${userId}`)
    .ilike('question', `%${searchTerm}%`)
    .order('is_trending', { ascending: false })
    .order('usage_count', { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return (data || []) as QuestionBankItem[];
}

export function getQuestionCategories(): string[] {
  return [
    'money',
    'dating',
    'personal',
    'career',
    'hottakes',
    'philosophy',
    'nyc',
    'fitness',
    'tech',
    'socialmedia',
    'food',
    'music',
    'sports',
    'travel',
    'family',
    'friendship',
    'hustle',
    'mentalhealth',
    'generational',
  ];
}

// === AGE-APPROPRIATE QUESTION BANK ===

import type { AgeGroup } from './types';
import { TOPIC_AGE_MAP, AGE_GROUP_CONFIGS } from './constants';

// Age-appropriate question sets by category
const AGE_APPROPRIATE_QUESTIONS: Record<AgeGroup, Record<string, string[]>> = {
  kids: {
    money: [
      'If you could buy one thing with your allowance, what would it be and why?',
      'What would you do with $100?',
      'Is it better to save or spend your money?',
    ],
    personal: [
      'What do you want to be when you grow up?',
      'What makes you happy?',
      'What is your favorite thing to do with your friends?',
    ],
    career: [
      'What would you do if you had your own business?',
      'What skills do you need to be good at your dream job?',
    ],
    philosophy: [
      'What does it mean to be a good friend?',
      'Why is it important to try new things?',
      'What makes someone brave?',
    ],
    hottakes: [
      'Is pizza the best food ever?',
      'Should homework be banned?',
      'Are video games good for you?',
    ],
    dating: [], // Not appropriate for kids
    nyc: [
      'What is your favorite place in NYC?',
      'Have you been on the subway? What was it like?',
    ],
  },
  teens: {
    money: [
      'Is college worth the debt?',
      'How should teens start saving?',
      'Should high schools teach financial literacy?',
    ],
    personal: [
      'What is your biggest fear about the future?',
      'How do you handle pressure from social media?',
      'What is one thing you wish adults understood about teens?',
    ],
    career: [
      'What career would you choose if money was not a factor?',
      'Is it better to go to college or start working?',
      'What skill are you learning right now?',
    ],
    philosophy: [
      'Does social media make us more or less connected?',
      'What does success mean to you?',
      'Is it better to be liked or respected?',
    ],
    hottakes: [
      'Is it okay to lie to your parents?',
      'Should the voting age be lowered?',
      'Are grades an accurate measure of intelligence?',
    ],
    dating: [
      'What is the ideal first date?',
      'Is dating in high school worth it?',
      'What makes a relationship healthy?',
    ],
    nyc: [
      'What is the most tourist thing a New Yorker can do?',
      'Which NYC neighborhood would you want to live in?',
    ],
  },
  older_adults: {
    money: [
      'How are you preparing for retirement?',
      'What is the biggest financial mistake people make?',
      'Should you invest in real estate now?',
      'What advice would you give about saving for the future?',
    ],
    personal: [
      'What advice would you give your younger self?',
      'What is the biggest life lesson you have learned?',
      'How do you maintain work-life balance?',
      'What does legacy mean to you?',
    ],
    career: [
      'What is the key to career longevity?',
      'How do you mentor younger colleagues?',
      'What would you do differently in your career?',
      'How do you stay relevant in your industry?',
    ],
    philosophy: [
      'What does it mean to live a meaningful life?',
      'When did you accept that life is hard?',
      'What is the most important value to pass on?',
      'What wisdom would you share with younger generations?',
    ],
    hottakes: [
      'Is the American Dream still alive?',
      'Should parents be able to control adult children?',
      'Is success measured by money or happiness?',
      'Has social media made us more disconnected?',
    ],
    dating: [
      'What is the secret to lasting relationships?',
      'How do you know when to get married?',
      'Is it better to be single than in a bad relationship?',
      'What is the key to a long marriage?',
    ],
    nyc: [
      'How has NYC changed over the decades?',
      'What is your favorite NYC memory?',
      'Is NYC rent finally going to crash?',
      'What is the future of NYC?',
    ],
    // Older adult specific topics
    retirement: [
      'When did you know it was time to retire?',
      'What do you wish you had done differently in retirement?',
      'How do you stay active and engaged in retirement?',
    ],
    life_lessons: [
      'What is the most important lesson life has taught you?',
      'What would you tell your 20-year-old self?',
      'How do you handle regret?',
    ],
    wisdom: [
      'What does wisdom mean to you?',
      'How do you share your wisdom with younger generations?',
      'What is worth fighting for in life?',
    ],
    parenting: [
      'What is the key to raising good children?',
      'How do you support adult children without controlling them?',
      'What do you wish you knew about parenting earlier?',
    ],
    legacy: [
      'What do you want your legacy to be?',
      'How do you want to be remembered?',
      'What is more important: wealth or relationships?',
    ],
    health: [
      'What is the most important health advice for younger people?',
      'How do you stay healthy as you age?',
      'What health lessons have you learned?',
    ],
    hobbies: [
      'What new hobbies have you picked up in retirement?',
      'How do you stay mentally sharp?',
      'What advice would you give about finding purpose?',
    ],
  },
  adults: {
    money: [
      'How are you preparing for retirement?',
      'What is the biggest financial mistake people make?',
      'Should you invest in real estate now?',
    ],
    personal: [
      'What would you tell your 20-year-old self?',
      'How do you balance family and career?',
      'What is the key to a long marriage?',
    ],
    career: [
      'Is it too late to pivot careers?',
      'How do you stay relevant in your industry?',
      'What makes a good leader?',
    ],
    philosophy: [
      'What does it mean to live a meaningful life?',
      'When did you accept that life is hard?',
      'What is the most important value to pass on?',
    ],
    hottakes: [
      'Is the American Dream still alive?',
      'Should parents be able to control adult children?',
      'Is success measured by money or happiness?',
    ],
    dating: [
      'What is the secret to lasting relationships?',
      'How do you know when to get married?',
      'Is it better to be single than in a bad relationship?',
    ],
    nyc: [
      'Is NYC rent finally going to crash?',
      'What is the future of NYC?',
      'Should there be rent control?',
    ],
  },
  all_ages: {
    money: [
      'What is the best way to save money?',
      'Is it better to give or receive?',
      'What can you do with $1 today?',
    ],
    personal: [
      'What is the best advice you have ever received?',
      'What makes a good day?',
      'What are you grateful for?',
    ],
    career: [
      'What is your dream job?',
      'What skills are important for any job?',
    ],
    philosophy: [
      'What does it mean to be successful?',
      'How do you handle failure?',
      'What is the key to happiness?',
    ],
    hottakes: [
      'Is pineapple on pizza acceptable?',
      'Which is better: cats or dogs?',
      'Is cereal a soup?',
    ],
    dating: [
      'What makes someone a good friend?',
      'What do you look for in a partner?',
    ],
    nyc: [
      'What is your favorite NYC spot?',
      'What makes NYC special?',
    ],
  },
};

/**
 * Get age-appropriate questions for a category
 */
export function getAgeAppropriateQuestions(
  category: string,
  ageGroup: AgeGroup,
  limit: number = 5
): string[] {
  const ageQuestions = AGE_APPROPRIATE_QUESTIONS[ageGroup];
  if (!ageQuestions) {
    // Fallback to all_ages
    return AGE_APPROPRIATE_QUESTIONS.all_ages[category] || [];
  }
  
  const questions = ageQuestions[category] || [];
  return questions.slice(0, limit);
}

/**
 * Get all age-appropriate questions by category
 */
export function getAllAgeAppropriateQuestions(ageGroup: AgeGroup): Record<string, string[]> {
  return AGE_APPROPRIATE_QUESTIONS[ageGroup] || AGE_APPROPRIATE_QUESTIONS.all_ages;
}

/**
 * Filter questions by age group
 */
export function filterQuestionsByAge(
  questions: QuestionBankItem[],
  ageGroup: AgeGroup
): QuestionBankItem[] {
  // For kids and all_ages, filter out dating-related questions
  if (ageGroup === 'kids') {
    return questions.filter(q => q.category !== 'dating');
  }
  
  // For all_ages, be more selective
  if (ageGroup === 'all_ages') {
    return questions.filter(q => 
      q.category !== 'dating' &&
      q.category !== 'hottakes' // Filter controversial hot takes
    );
  }
  
  // For other age groups, allow all questions
  return questions;
}

/**
 * Get trending questions for an age group
 */
export function getTrendingQuestionsForAge(
  ageGroup: AgeGroup,
  limit: number = 10
): QuestionBankItem[] {
  // This would normally fetch from database with age filtering
  // For now, return empty array - actual implementation would query the database
  return [];
}

/**
 * Get suggested questions based on topic and age group
 */
export function getSuggestedQuestions(
  topic: string,
  ageGroup: AgeGroup
): string[] {
  // Map topic to category
  const topicCategoryMap: Record<string, string> = {
    'Money': 'money',
    'Career': 'career',
    'Dating': 'dating',
    'Relationships': 'dating',
    'Success': 'personal',
    'Discipline': 'personal',
    'Confidence': 'personal',
    'Failure': 'personal',
    'Mindset': 'philosophy',
    'Philosophy': 'philosophy',
    'Hot Takes': 'hottakes',
    'NYC Life': 'nyc',
    'NYC Rent': 'nyc',
    'Food Takes': 'hottakes',
    'Social Media': 'personal',
    'Work From Home': 'career',
    'Side Hustles': 'money',
    'Entrepreneurship': 'career',
    'Life Advice': 'personal',
    'Purpose': 'philosophy',
  };
  
  const category = topicCategoryMap[topic] || 'personal';
  return getAgeAppropriateQuestions(category, ageGroup, 5);
}

/**
 * Validate that a question is age-appropriate
 */
export function validateQuestionAgeAppropriate(
  question: string,
  ageGroup: AgeGroup
): { valid: boolean; message?: string } {
  // Check for inappropriate content based on age group
  const inappropriatePatterns = {
    kids: [
      /\b(dating|romance|boyfriend|girlfriend|kiss|love)\b/i,
      /\b(sex|adult|mature)\b/i,
    ],
    teens: [],
    older_adults: [],
    adults: [],
    all_ages: [
      /\b(sex|adults only|mature)\b/i,
    ],
  };
  
  const patterns = inappropriatePatterns[ageGroup] || [];
  
  for (const pattern of patterns) {
    if (pattern.test(question)) {
      return {
        valid: false,
        message: 'This question may not be appropriate for the selected age group.',
      };
    }
  }
  
  return { valid: true };
}
