import { supabase } from './supabase';
import { getUserId } from './auth';

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

export async function listQuestions(options?: {
  category?: string;
  trendingOnly?: boolean;
  includeCustom?: boolean;
  limit?: number;
}): Promise<QuestionBankItem[]> {
  const userId = getUserId();

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

// === AGE-APPROPRIATE QUESTION BANK ===

