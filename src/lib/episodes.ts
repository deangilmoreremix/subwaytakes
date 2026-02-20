import { supabase } from './supabase';
import type {
  Episode,
  EpisodeShot,
  EpisodeScript,
  CharacterBible,
  CityStyle,
  EpisodeStatus,
  ShotType,
  CameraDirection,
  Beat,
  InterviewMode,
} from './types';
import { getUserId } from './auth';
import { getOrCreateDefaultHost, generateRandomGuest, DEFAULT_HOST } from './characters';
import { generateScript } from './scriptEngine';
import { buildAllShotPrompts } from './episodePromptEngine';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const CAMERA_MAP: Record<ShotType, CameraDirection> = {
  cold_open: 'two-shot',
  guest_answer: 'close-up',
  follow_up: 'two-shot',
  reaction: 'close-up',
  b_roll: 'wide',
  close: 'two-shot',
};

async function triggerShotGeneration(shot: EpisodeShot): Promise<void> {
  try {
    await supabase
      .from('episode_shots')
      .update({ status: 'running' })
      .eq('id', shot.id);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-video`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clip_id: shot.id,
        video_type: 'episode_shot',
        prompt: shot.provider_prompt,
        negative_prompt: 'no distorted faces, no extra limbs, no unreadable text, no watermarks, no logos, no text overlays',
        duration_seconds: shot.duration_seconds,
        model_tier: 'premium',
        speech_script: shot.dialogue || undefined,
        is_episode_shot: true,
        episode_id: shot.episode_id,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      await supabase
        .from('episode_shots')
        .update({ status: 'error', error: errorText })
        .eq('id', shot.id);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    await supabase
      .from('episode_shots')
      .update({ status: 'error', error: message })
      .eq('id', shot.id);
  }
}

export interface CreateEpisodeOptions {
  topic: string;
  cityStyle?: CityStyle;
  hostCharacterId?: string;
  guestCharacterId?: string;
  customScript?: EpisodeScript;
  beats?: Beat[];
  interviewMode?: InterviewMode;
  templateId?: string | null;
}

export async function createEpisode(options: CreateEpisodeOptions): Promise<Episode> {
  const userId = getUserId();
  const { topic, cityStyle = 'nyc', hostCharacterId, guestCharacterId, customScript } = options;

  let script: EpisodeScript;
  if (customScript) {
    script = customScript;
  } else {
    script = await generateScript(topic);
  }

  let hostCharacter: Omit<CharacterBible, 'id' | 'user_id' | 'created_at'>;
  let guestCharacter: Omit<CharacterBible, 'id' | 'user_id' | 'created_at'>;
  let hostId: string | null = hostCharacterId || null;
  let guestId: string | null = guestCharacterId || null;

  if (hostCharacterId) {
    const { data } = await supabase
      .from('character_bibles')
      .select('*')
      .eq('id', hostCharacterId)
      .maybeSingle();
    hostCharacter = data || DEFAULT_HOST;
  } else {
    const defaultHost = await getOrCreateDefaultHost();
    hostCharacter = defaultHost;
    hostId = defaultHost.id;
  }

  if (guestCharacterId) {
    const { data } = await supabase
      .from('character_bibles')
      .select('*')
      .eq('id', guestCharacterId)
      .maybeSingle();
    guestCharacter = data || generateRandomGuest();
  } else {
    guestCharacter = generateRandomGuest();
  }

  const shotPrompts = buildAllShotPrompts(cityStyle, hostCharacter, guestCharacter, script);
  const totalDuration = shotPrompts.reduce((sum, s) => sum + s.duration, 0);

  const episodeInsert: Record<string, unknown> = {
    user_id: userId,
    script_id: script.id,
    host_character_id: hostId,
    guest_character_id: guestId,
    status: 'queued',
    city_style: cityStyle,
    total_duration_seconds: totalDuration,
  };
  if (options.templateId) {
    episodeInsert.template_id = options.templateId;
  }

  const { data: episode, error: episodeError } = await supabase
    .from('episodes')
    .insert(episodeInsert)
    .select()
    .single();

  if (episodeError) throw new Error(episodeError.message);

  const shotInserts = shotPrompts.map(shot => ({
    episode_id: episode.id,
    shot_type: shot.shotType,
    sequence: shot.sequence,
    duration_seconds: shot.duration,
    dialogue: shot.dialogue,
    speaker: shot.speaker,
    camera_direction: CAMERA_MAP[shot.shotType],
    provider_prompt: shot.prompt,
    status: 'queued' as const,
  }));

  const { data: shots, error: shotsError } = await supabase
    .from('episode_shots')
    .insert(shotInserts)
    .select();

  if (shotsError) throw new Error(shotsError.message);

  await supabase
    .from('episodes')
    .update({ status: 'generating' })
    .eq('id', episode.id);

  for (const shot of shots as EpisodeShot[]) {
    triggerShotGeneration(shot);
  }

  return {
    ...episode,
    script,
    shots: shots as EpisodeShot[],
  } as Episode;
}

export async function getEpisodeById(id: string): Promise<Episode | null> {
  const { data: episode, error } = await supabase
    .from('episodes')
    .select(`
      *,
      script:episode_scripts(*),
      host_character:character_bibles!episodes_host_character_id_fkey(*),
      guest_character:character_bibles!episodes_guest_character_id_fkey(*)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!episode) return null;

  const { data: shots } = await supabase
    .from('episode_shots')
    .select('*')
    .eq('episode_id', id)
    .order('sequence', { ascending: true });

  return {
    ...episode,
    shots: shots || [],
  } as Episode;
}

export async function listEpisodes(filters?: {
  status?: EpisodeStatus;
  limit?: number;
}): Promise<Episode[]> {
  const userId = getUserId();

  let query = supabase
    .from('episodes')
    .select(`
      *,
      script:episode_scripts(topic, hook_question)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.limit) {
    query = query.limit(filters.limit);
  } else {
    query = query.limit(20);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);
  return (data || []) as Episode[];
}

export async function updateEpisodeStatus(
  id: string,
  status: EpisodeStatus,
  updates?: Partial<Pick<Episode, 'final_video_url' | 'caption_file_url' | 'thumbnail_url' | 'error' | 'completed_at'>>
): Promise<Episode> {
  const { data, error } = await supabase
    .from('episodes')
    .update({ status, ...updates })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Episode;
}

export async function checkEpisodeCompletion(episodeId: string): Promise<boolean> {
  const { data: shots } = await supabase
    .from('episode_shots')
    .select('status')
    .eq('episode_id', episodeId);

  if (!shots || shots.length === 0) return false;

  const allDone = shots.every(s => s.status === 'done');
  const anyError = shots.some(s => s.status === 'error');

  if (anyError) {
    await updateEpisodeStatus(episodeId, 'error', {
      error: 'One or more shots failed to generate',
    });
    return true;
  }

  if (allDone) {
    await updateEpisodeStatus(episodeId, 'stitching');
    triggerStitching(episodeId);
    return true;
  }

  return false;
}

async function triggerStitching(episodeId: string): Promise<void> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const response = await fetch(`${SUPABASE_URL}/functions/v1/stitch-episode`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ episode_id: episodeId }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      await updateEpisodeStatus(episodeId, 'error', { error: `Stitch failed: ${errorText}` });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    await updateEpisodeStatus(episodeId, 'error', { error: `Stitch failed: ${message}` });
  }
}

export async function retryEpisodeShot(shotId: string): Promise<void> {
  const { data: shot } = await supabase
    .from('episode_shots')
    .select('*')
    .eq('id', shotId)
    .maybeSingle();

  if (!shot) throw new Error('Shot not found');

  await supabase
    .from('episode_shots')
    .update({ status: 'queued', error: null })
    .eq('id', shotId);

  triggerShotGeneration(shot as EpisodeShot);
}

export async function deleteEpisode(id: string): Promise<void> {
  const { error } = await supabase
    .from('episodes')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function regenerateEpisode(episodeId: string): Promise<Episode> {
  const original = await getEpisodeById(episodeId);
  if (!original) throw new Error('Episode not found');

  return createEpisode({
    topic: original.script?.topic || 'hottakes',
    cityStyle: original.city_style,
    hostCharacterId: original.host_character_id || undefined,
    guestCharacterId: original.guest_character_id || undefined,
  });
}

export function calculateEpisodeCost(durationSeconds: number, modelTier: 'standard' | 'premium' = 'premium'): number {
  const costPerSecond = modelTier === 'premium' ? 0.105 : 0.034;
  return durationSeconds * costPerSecond;
}

export function getEstimatedGenerationTime(shotCount: number = 6): string {
  const timePerShot = 45;
  const stitchTime = 30;
  const totalSeconds = (shotCount * timePerShot) + stitchTime;
  const minutes = Math.ceil(totalSeconds / 60);
  return `~${minutes} minutes`;
}
