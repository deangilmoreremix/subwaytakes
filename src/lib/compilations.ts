import { supabase } from './supabase';
import type {
  Compilation,
  CompilationStatus,
  CompilationClipEntry,
  TransitionType,
  Clip,
} from './types';
import { getUserId } from './auth';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const MAX_CLIPS = 20;
const MIN_CLIPS = 2;

export interface CreateCompilationOptions {
  name?: string;
  clipIds: string[];
  transitionType?: TransitionType;
  transitionDuration?: number;
  templateId?: string | null;
}

export async function createCompilation(options: CreateCompilationOptions): Promise<Compilation> {
  const { clipIds, transitionType = 'crossfade', transitionDuration = 0.3, templateId } = options;

  if (clipIds.length < MIN_CLIPS) {
    throw new Error(`At least ${MIN_CLIPS} clips are required`);
  }
  if (clipIds.length > MAX_CLIPS) {
    throw new Error(`Maximum ${MAX_CLIPS} clips allowed per compilation`);
  }

  const userId = getUserId();

  const { data: clips, error: clipsError } = await supabase
    .from('clips')
    .select('id, status, result_url, duration_seconds, topic, video_type')
    .in('id', clipIds);

  if (clipsError) throw new Error(clipsError.message);
  if (!clips || clips.length !== clipIds.length) {
    throw new Error('One or more clips not found');
  }

  const incomplete = clips.filter(c => c.status !== 'done' || !c.result_url);
  if (incomplete.length > 0) {
    throw new Error(`${incomplete.length} clip(s) are not ready yet`);
  }

  const transitionOverlap = transitionType !== 'cut' ? transitionDuration : 0;
  const orderedClips = clipIds.map(id => clips.find(c => c.id === id)!);
  const totalDuration = Math.round(
    orderedClips.reduce((sum, c) => sum + c.duration_seconds, 0) -
    transitionOverlap * Math.max(0, orderedClips.length - 1)
  );

  const name = options.name || orderedClips.map(c => c.topic).slice(0, 3).join(' + ');

  const compilationInsert: Record<string, unknown> = {
    user_id: userId,
    name,
    status: 'queued',
    transition_type: transitionType,
    transition_duration: transitionDuration,
    total_duration_seconds: totalDuration,
  };
  if (templateId) {
    compilationInsert.template_id = templateId;
  }

  const { data: compilation, error: compilationError } = await supabase
    .from('compilations')
    .insert(compilationInsert)
    .select()
    .single();

  if (compilationError) throw new Error(compilationError.message);

  const junctionInserts = clipIds.map((clipId, i) => ({
    compilation_id: compilation.id,
    clip_id: clipId,
    sequence: i + 1,
  }));

  const { error: junctionError } = await supabase
    .from('compilation_clips')
    .insert(junctionInserts);

  if (junctionError) throw new Error(junctionError.message);

  triggerStitching(compilation.id);

  return compilation as Compilation;
}

async function triggerStitching(compilationId: string): Promise<void> {
  try {
    await supabase
      .from('compilations')
      .update({ status: 'stitching' })
      .eq('id', compilationId);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const response = await fetch(`${SUPABASE_URL}/functions/v1/stitch-clips`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ compilation_id: compilationId }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      await supabase
        .from('compilations')
        .update({ status: 'error', error: `Stitch failed: ${errorText}` })
        .eq('id', compilationId);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    await supabase
      .from('compilations')
      .update({ status: 'error', error: `Stitch failed: ${message}` })
      .eq('id', compilationId);
  }
}

export async function getCompilationById(id: string): Promise<Compilation | null> {
  const { data: compilation, error } = await supabase
    .from('compilations')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!compilation) return null;

  const { data: entries } = await supabase
    .from('compilation_clips')
    .select('*, clip:clips(*)')
    .eq('compilation_id', id)
    .order('sequence', { ascending: true });

  return {
    ...compilation,
    clips: (entries || []) as CompilationClipEntry[],
  } as Compilation;
}

export async function listCompilations(filters?: {
  status?: CompilationStatus;
  limit?: number;
}): Promise<Compilation[]> {
  const userId = getUserId();

  let query = supabase
    .from('compilations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  query = query.limit(filters?.limit || 20);

  const { data, error } = await query;

  if (error) throw new Error(error.message);
  return (data || []) as Compilation[];
}

export async function updateCompilationStatus(
  id: string,
  status: CompilationStatus,
  updates?: Partial<Pick<Compilation, 'final_video_url' | 'caption_file_url' | 'thumbnail_url' | 'error' | 'completed_at'>>
): Promise<Compilation> {
  const userId = getUserId();
  const query = supabase
    .from('compilations')
    .update({ status, ...updates })
    .eq('id', id);
  if (userId) query.eq('user_id', userId);
  const { data, error } = await query.select().single();

  if (error) throw new Error(error.message);
  return data as Compilation;
}

export async function reorderCompilationClips(
  compilationId: string,
  orderedClipIds: string[]
): Promise<void> {
  for (let i = 0; i < orderedClipIds.length; i++) {
    await supabase
      .from('compilation_clips')
      .update({ sequence: i + 1 })
      .eq('compilation_id', compilationId)
      .eq('clip_id', orderedClipIds[i]);
  }
}

export async function addClipToCompilation(compilationId: string, clipId: string): Promise<void> {
  const { data: existing } = await supabase
    .from('compilation_clips')
    .select('sequence')
    .eq('compilation_id', compilationId)
    .order('sequence', { ascending: false })
    .limit(1);

  const nextSequence = existing && existing.length > 0 ? existing[0].sequence + 1 : 1;

  const { error } = await supabase
    .from('compilation_clips')
    .insert({
      compilation_id: compilationId,
      clip_id: clipId,
      sequence: nextSequence,
    });

  if (error) throw new Error(error.message);
}

export async function removeClipFromCompilation(compilationId: string, clipId: string): Promise<void> {
  const { error } = await supabase
    .from('compilation_clips')
    .delete()
    .eq('compilation_id', compilationId)
    .eq('clip_id', clipId);

  if (error) throw new Error(error.message);

  const { data: remaining } = await supabase
    .from('compilation_clips')
    .select('id, clip_id')
    .eq('compilation_id', compilationId)
    .order('sequence', { ascending: true });

  if (remaining) {
    for (let i = 0; i < remaining.length; i++) {
      await supabase
        .from('compilation_clips')
        .update({ sequence: i + 1 })
        .eq('id', remaining[i].id);
    }
  }
}

export async function deleteCompilation(id: string): Promise<void> {
  const userId = getUserId();
  const { error } = await supabase
    .from('compilations')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
}

export async function retryCompilation(id: string): Promise<void> {
  await supabase
    .from('compilations')
    .update({ status: 'queued', error: null })
    .eq('id', id);

  triggerStitching(id);
}

export async function triggerCompilationCompose(
  compilationId: string,
  config?: Record<string, unknown>
): Promise<void> {
  try {
    await supabase
      .from('compilations')
      .update({ overlay_status: 'composing' })
      .eq('id', compilationId);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const response = await fetch(`${SUPABASE_URL}/functions/v1/compose-overlay`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ compilation_id: compilationId, enhancement_config: config }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      await supabase
        .from('compilations')
        .update({ overlay_status: 'error' })
        .eq('id', compilationId);
      throw new Error(`Compose failed: ${errorText}`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Compose failed:')) throw error;
    await supabase
      .from('compilations')
      .update({ overlay_status: 'error' })
      .eq('id', compilationId);
    throw error;
  }
}

export function getCompilationClipCount(clips: CompilationClipEntry[]): number {
  return clips.length;
}

export function getCompilationReadyClips(clips: CompilationClipEntry[]): Clip[] {
  return clips
    .filter(entry => entry.clip && entry.clip.status === 'done' && entry.clip.result_url)
    .map(entry => entry.clip!);
}
