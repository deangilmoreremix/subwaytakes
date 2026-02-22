import { supabase } from './supabase';

export interface PromptTemplate {
  id: string;
  video_type: string;
  version: number;
  base_prompt: string;
  negative_prompt: string;
  is_active: boolean;
  metadata: Record<string, unknown> | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PromptFragment {
  id: string;
  category: string;
  key: string;
  value: string;
  video_types: string[] | null;
  is_active: boolean;
  metadata: Record<string, unknown> | null;
  user_id: string | null;
  created_at: string;
}

export interface SystemPrompt {
  id: string;
  video_type: string;
  version: number;
  system_prompt: string;
  user_prompt_template: string;
  is_active: boolean;
  metadata: Record<string, unknown> | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchPromptTemplates(): Promise<PromptTemplate[]> {
  const { data, error } = await supabase
    .from('prompt_templates')
    .select('*')
    .order('video_type')
    .order('version', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchPromptFragments(): Promise<PromptFragment[]> {
  const { data, error } = await supabase
    .from('prompt_fragments')
    .select('*')
    .order('category')
    .order('key');
  if (error) throw error;
  return data || [];
}

export async function fetchSystemPrompts(): Promise<SystemPrompt[]> {
  const { data, error } = await supabase
    .from('system_prompts')
    .select('*')
    .order('video_type')
    .order('version', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function updatePromptTemplate(
  id: string,
  updates: Partial<Pick<PromptTemplate, 'base_prompt' | 'negative_prompt' | 'is_active' | 'metadata'>>
): Promise<void> {
  const { error } = await supabase
    .from('prompt_templates')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function updatePromptFragment(
  id: string,
  updates: Partial<Pick<PromptFragment, 'value' | 'is_active' | 'video_types'>>
): Promise<void> {
  const { error } = await supabase
    .from('prompt_fragments')
    .update(updates)
    .eq('id', id);
  if (error) throw error;
}

export async function updateSystemPrompt(
  id: string,
  updates: Partial<Pick<SystemPrompt, 'system_prompt' | 'user_prompt_template' | 'is_active' | 'metadata'>>
): Promise<void> {
  const { error } = await supabase
    .from('system_prompts')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export const VIDEO_TYPE_LABELS: Record<string, string> = {
  subway_interview: 'Subway',
  street_interview: 'Street',
  motivational: 'Motivational',
  studio_interview: 'Studio',
  wisdom_interview: 'Wisdom',
};

export const VIDEO_TYPE_COLORS: Record<string, string> = {
  subway_interview: 'amber',
  street_interview: 'emerald',
  motivational: 'red',
  studio_interview: 'sky',
  wisdom_interview: 'orange',
};
