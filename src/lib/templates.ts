import { supabase } from './supabase';

export interface VideoTemplate {
  id: string;
  user_id: string;
  name: string;
  template_type: 'subway_takes' | 'custom';
  format: 'vertical' | 'landscape' | 'square';
  resolution_width: number;
  resolution_height: number;
  fps: number;
  watermark_text: string;
  watermark_position: string;
  watermark_font_size: number;
  watermark_color: string;
  watermark_opacity: number;
  logo_enabled: boolean;
  logo_position: string;
  episode_prefix_format: string;
  caption_font: string;
  caption_font_size: number;
  caption_color: string;
  caption_bg_opacity: number;
  caption_position: string;
  reaction_text_enabled: boolean;
  reaction_text_position: string;
  reaction_text_font_size: number;
  color_temperature: 'warm' | 'neutral' | 'cool';
  saturation_adjust: number;
  contrast_adjust: number;
  vignette_enabled: boolean;
  progress_bar_enabled: boolean;
  progress_bar_color: string;
  is_default: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export async function fetchTemplates(): Promise<VideoTemplate[]> {
  const { data, error } = await supabase
    .from('video_templates')
    .select('*')
    .order('is_system', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching templates:', error);
    return [];
  }
  return data || [];
}

export async function fetchDefaultTemplate(): Promise<VideoTemplate | null> {
  const { data } = await supabase
    .from('video_templates')
    .select('*')
    .eq('is_default', true)
    .eq('is_system', true)
    .maybeSingle();
  return data;
}

export async function fetchTemplateById(id: string): Promise<VideoTemplate | null> {
  const { data } = await supabase
    .from('video_templates')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  return data;
}

export async function createTemplate(
  template: Omit<VideoTemplate, 'id' | 'created_at' | 'updated_at' | 'is_system'>
): Promise<VideoTemplate | null> {
  const { data, error } = await supabase
    .from('video_templates')
    .insert({ ...template, is_system: false })
    .select()
    .maybeSingle();

  if (error) {
    console.error('Error creating template:', error);
    return null;
  }
  return data;
}

export async function updateTemplate(
  id: string,
  updates: Partial<VideoTemplate>
): Promise<VideoTemplate | null> {
  const { data, error } = await supabase
    .from('video_templates')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) {
    console.error('Error updating template:', error);
    return null;
  }
  return data;
}

export async function deleteTemplate(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('video_templates')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting template:', error);
    return false;
  }
  return true;
}

export async function duplicateTemplate(
  id: string,
  newName: string,
  userId: string
): Promise<VideoTemplate | null> {
  const source = await fetchTemplateById(id);
  if (!source) return null;

  const { id: _id, created_at: _ca, updated_at: _ua, is_system: _is, is_default: _id2, ...rest } = source;
  return createTemplate({
    ...rest,
    name: newName,
    user_id: userId,
    is_default: false,
  });
}

export async function triggerComposeOverlay(episodeId: string): Promise<void> {
  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/compose-overlay`;
  await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ episode_id: episodeId }),
  });
}
