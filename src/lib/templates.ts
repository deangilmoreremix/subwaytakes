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
  logo_url: string | null;
  logo_width: number;
  logo_height: number;
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

export async function uploadTemplateLogo(
  templateId: string,
  file: File
): Promise<string | null> {
  const ext = file.name.split('.').pop() || 'png';
  const path = `logos/${templateId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('template-logos')
    .upload(path, file, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    console.error('Logo upload error:', uploadError);
    return null;
  }

  const { data: { publicUrl } } = supabase.storage
    .from('template-logos')
    .getPublicUrl(path);

  await updateTemplate(templateId, { logo_url: publicUrl } as Partial<VideoTemplate>);
  return publicUrl;
}

export async function removeTemplateLogo(templateId: string): Promise<boolean> {
  const result = await updateTemplate(templateId, { logo_url: null } as Partial<VideoTemplate>);
  return result !== null;
}

export interface ComposeConfig {
  watermark?: boolean;
  lowerThird?: boolean;
  lowerThirdStyle?: string;
  lowerThirdName?: string;
  lowerThirdTitle?: string;
  captions?: boolean;
  captionAnimation?: string;
  musicTrackId?: string | null;
  musicVolume?: number;
  sfxEnabled?: boolean;
  colorGrade?: string;
  endcard?: boolean;
  endcardStyle?: string;
  progressBar?: boolean;
}

export async function triggerComposeOverlay(episodeId: string, config?: ComposeConfig): Promise<void> {
  try {
    await supabase
      .from('episodes')
      .update({ overlay_status: 'composing' })
      .eq('id', episodeId);

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/compose-overlay`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ episode_id: episodeId, enhancement_config: config }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      await supabase
        .from('episodes')
        .update({ overlay_status: 'error' })
        .eq('id', episodeId);
      throw new Error(`Compose failed: ${errorText}`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Compose failed:')) throw error;
    await supabase
      .from('episodes')
      .update({ overlay_status: 'error' })
      .eq('id', episodeId);
    throw error;
  }
}

export async function triggerClipCompose(clipId: string, config?: ComposeConfig): Promise<void> {
  try {
    await supabase
      .from('clips')
      .update({ overlay_status: 'composing' })
      .eq('id', clipId);

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/compose-overlay`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ clip_id: clipId, enhancement_config: config }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      await supabase
        .from('clips')
        .update({ overlay_status: 'error' })
        .eq('id', clipId);
      throw new Error(`Compose failed: ${errorText}`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Compose failed:')) throw error;
    await supabase
      .from('clips')
      .update({ overlay_status: 'error' })
      .eq('id', clipId);
    throw error;
  }
}

export async function assignTemplateToClip(clipId: string, templateId: string): Promise<boolean> {
  const { error } = await supabase
    .from('clips')
    .update({ template_id: templateId })
    .eq('id', clipId);

  if (error) {
    console.error('Error assigning template to clip:', error);
    return false;
  }
  return true;
}

export async function createVideoExport(
  parentId: string,
  parentType: 'clip' | 'episode' | 'compilation',
  platform: string,
  userId: string
): Promise<string | null> {
  const specs: Record<string, { width: number; height: number }> = {
    tiktok: { width: 1080, height: 1920 },
    instagram_reel: { width: 1080, height: 1920 },
    youtube_shorts: { width: 1080, height: 1920 },
    instagram_post: { width: 1080, height: 1080 },
    facebook: { width: 1280, height: 720 },
    youtube: { width: 1920, height: 1080 },
    twitter: { width: 1280, height: 720 },
  };

  const spec = specs[platform] || specs.tiktok;

  const { data, error } = await supabase
    .from('video_exports')
    .insert({
      user_id: userId,
      parent_id: parentId,
      parent_type: parentType,
      platform,
      width: spec.width,
      height: spec.height,
      status: 'queued',
    })
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('Error creating export:', error);
    return null;
  }

  const exportId = data?.id || null;

  if (exportId) {
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-video`;
      await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation: 'convert',
          export_id: exportId,
          parent_id: parentId,
          parent_type: parentType,
          platform,
          width: spec.width,
          height: spec.height,
        }),
      });
    } catch (err) {
      console.error('Failed to trigger export processing:', err);
    }
  }

  return exportId;
}

export async function getExportsForContent(
  parentId: string,
  parentType: 'clip' | 'episode' | 'compilation'
): Promise<Array<{
  id: string;
  platform: string;
  status: string;
  url: string | null;
  width: number;
  height: number;
  created_at: string;
}>> {
  const { data, error } = await supabase
    .from('video_exports')
    .select('id, platform, status, url, width, height, created_at')
    .eq('parent_id', parentId)
    .eq('parent_type', parentType)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching exports:', error);
    return [];
  }
  return data || [];
}
