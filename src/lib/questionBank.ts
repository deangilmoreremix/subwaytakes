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
