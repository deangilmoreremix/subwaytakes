import { supabase } from './supabase';
import type {
  Clip,
  ClipType,
  SubwaySceneType,
  CityStyle,
  EnergyLevel,
  ModelTier,
  SpeakerStyle,
  MotivationalSetting,
  CameraStyle,
  LightingMood,
  StreetScene,
  InterviewStyle,
  TimeOfDay,
  InterviewerType,
  InterviewerPosition,
  SubjectDemographic,
  SubjectGender,
  SubjectStyle,
} from './types';
import { generateUserId } from './format';
import { createClipPlan, createVariationPrompt, createBatchVariationPrompt } from './promptEngine';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function triggerGeneration(clip: Clip, modelTier?: ModelTier, speechScript?: string): Promise<void> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-video`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clip_id: clip.id,
        video_type: clip.video_type,
        prompt: clip.provider_prompt,
        negative_prompt: clip.negative_prompt,
        duration_seconds: clip.duration_seconds,
        model_tier: modelTier || clip.model_tier || 'standard',
        speech_script: speechScript || clip.speech_script || undefined,
      }),
    });

    if (!response.ok) {
      console.error('Generation trigger failed:', await response.text());
    }
  } catch (error) {
    console.error('Failed to trigger generation:', error);
  }
}

export interface CreateClipOptions {
  videoType: ClipType;
  topic: string;
  durationSeconds: number;
  anglePrompt?: string;
  interviewQuestion?: string;
  sceneType?: SubwaySceneType;
  cityStyle?: CityStyle;
  energyLevel?: EnergyLevel;
  speakerStyle?: SpeakerStyle;
  motivationalSetting?: MotivationalSetting;
  cameraStyle?: CameraStyle;
  lightingMood?: LightingMood;
  streetScene?: StreetScene;
  interviewStyle?: InterviewStyle;
  timeOfDay?: TimeOfDay;
  modelTier?: ModelTier;
  speechScript?: string;
  interviewerType?: InterviewerType;
  interviewerPosition?: InterviewerPosition;
  subjectDemographic?: SubjectDemographic;
  subjectGender?: SubjectGender;
  subjectStyle?: SubjectStyle;
}

export async function createClip(options: CreateClipOptions): Promise<Clip> {
  const {
    videoType,
    topic,
    durationSeconds,
    anglePrompt,
    interviewQuestion,
    sceneType,
    cityStyle,
    energyLevel,
    speakerStyle,
    motivationalSetting,
    cameraStyle,
    lightingMood,
    streetScene,
    interviewStyle,
    timeOfDay,
    modelTier = 'standard',
    speechScript,
    interviewerType,
    interviewerPosition,
    subjectDemographic,
    subjectGender,
    subjectStyle,
  } = options;

  const userId = generateUserId();
  const plan = createClipPlan({
    videoType,
    topic,
    durationSeconds,
    anglePrompt,
    interviewQuestion,
    sceneType,
    cityStyle,
    energyLevel,
    speakerStyle,
    motivationalSetting,
    cameraStyle,
    lightingMood,
    streetScene,
    interviewStyle,
    timeOfDay,
    interviewerType,
    interviewerPosition,
    subjectDemographic,
    subjectGender,
    subjectStyle,
  });

  const { data, error } = await supabase
    .from('clips')
    .insert({
      user_id: userId,
      video_type: videoType,
      topic,
      duration_seconds: durationSeconds,
      angle_prompt: anglePrompt || null,
      interview_question: interviewQuestion || null,
      scene_type: sceneType || null,
      city_style: cityStyle || null,
      energy_level: energyLevel || null,
      speaker_style: speakerStyle || null,
      motivational_setting: motivationalSetting || null,
      camera_style: cameraStyle || null,
      lighting_mood: lightingMood || null,
      street_scene: streetScene || null,
      interview_style: interviewStyle || null,
      time_of_day: timeOfDay || null,
      interviewer_type: interviewerType || null,
      interviewer_position: interviewerPosition || null,
      subject_demographic: subjectDemographic || null,
      subject_gender: subjectGender || null,
      subject_style: subjectStyle || null,
      provider: modelTier === 'premium' ? 'google' : 'minimax',
      status: 'queued',
      provider_prompt: plan.provider_prompt,
      negative_prompt: plan.negative_prompt,
      model_tier: modelTier,
      speech_script: speechScript || null,
      has_speech: !!speechScript,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  const clip = data as Clip;
  triggerGeneration(clip, modelTier, speechScript);

  return clip;
}

export async function createClipBatch(
  options: CreateClipOptions,
  batchSize: number
): Promise<Clip[]> {
  const userId = generateUserId();
  const batchId = crypto.randomUUID();
  const modelTier = options.modelTier || 'standard';

  const basePlan = createClipPlan({
    videoType: options.videoType,
    topic: options.topic,
    durationSeconds: options.durationSeconds,
    anglePrompt: options.anglePrompt,
    interviewQuestion: options.interviewQuestion,
    sceneType: options.sceneType,
    cityStyle: options.cityStyle,
    energyLevel: options.energyLevel,
    speakerStyle: options.speakerStyle,
    motivationalSetting: options.motivationalSetting,
    cameraStyle: options.cameraStyle,
    lightingMood: options.lightingMood,
    streetScene: options.streetScene,
    interviewStyle: options.interviewStyle,
    timeOfDay: options.timeOfDay,
    interviewerType: options.interviewerType,
    interviewerPosition: options.interviewerPosition,
    subjectDemographic: options.subjectDemographic,
    subjectGender: options.subjectGender,
    subjectStyle: options.subjectStyle,
  });

  const clipInserts = Array.from({ length: batchSize }, (_, i) => {
    const sequence = i + 1;
    const prompt = sequence === 1
      ? basePlan.provider_prompt
      : createBatchVariationPrompt(basePlan.provider_prompt, sequence, batchSize);

    return {
      user_id: userId,
      video_type: options.videoType,
      topic: options.topic,
      duration_seconds: options.durationSeconds,
      angle_prompt: options.anglePrompt || null,
      interview_question: options.interviewQuestion || null,
      scene_type: options.sceneType || null,
      city_style: options.cityStyle || null,
      energy_level: options.energyLevel || null,
      speaker_style: options.speakerStyle || null,
      motivational_setting: options.motivationalSetting || null,
      camera_style: options.cameraStyle || null,
      lighting_mood: options.lightingMood || null,
      street_scene: options.streetScene || null,
      interview_style: options.interviewStyle || null,
      time_of_day: options.timeOfDay || null,
      interviewer_type: options.interviewerType || null,
      interviewer_position: options.interviewerPosition || null,
      subject_demographic: options.subjectDemographic || null,
      subject_gender: options.subjectGender || null,
      subject_style: options.subjectStyle || null,
      batch_id: batchId,
      batch_sequence: sequence,
      provider: modelTier === 'premium' ? 'google' : 'minimax',
      status: 'queued' as const,
      provider_prompt: prompt,
      negative_prompt: basePlan.negative_prompt,
      model_tier: modelTier,
      speech_script: options.speechScript || null,
      has_speech: !!options.speechScript,
    };
  });

  const { data, error } = await supabase
    .from('clips')
    .insert(clipInserts)
    .select();

  if (error) throw new Error(error.message);

  const clips = data as Clip[];
  clips.forEach(clip => triggerGeneration(clip, modelTier, options.speechScript));

  return clips;
}

export async function getClipById(id: string): Promise<Clip | null> {
  const { data, error } = await supabase
    .from('clips')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as Clip | null;
}

export async function listClips(filters?: {
  type?: ClipType | 'all';
  search?: string;
  limit?: number;
}): Promise<Clip[]> {
  const userId = generateUserId();
  let query = supabase
    .from('clips')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (filters?.type && filters.type !== 'all') {
    query = query.eq('video_type', filters.type);
  }

  if (filters?.search) {
    // Use parameterized queries to prevent SQL injection
    const searchTerm = `%${filters.search}%`;
    query = query.or(`topic.ilike.${searchTerm},angle_prompt.ilike.${searchTerm},interview_question.ilike.${searchTerm}`);
  }

  if (filters?.limit) {
    query = query.limit(filters.limit);
  } else {
    query = query.limit(50);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);
  return (data || []) as Clip[];
}

export async function listClipsGroupedByBatch(filters?: {
  type?: ClipType | 'all';
  search?: string;
}): Promise<{ batches: Map<string, Clip[]>; singles: Clip[] }> {
  const clips = await listClips({ ...filters, limit: 100 });

  const batches = new Map<string, Clip[]>();
  const singles: Clip[] = [];

  for (const clip of clips) {
    if (clip.batch_id) {
      const existing = batches.get(clip.batch_id) || [];
      existing.push(clip);
      batches.set(clip.batch_id, existing);
    } else {
      singles.push(clip);
    }
  }

  for (const [batchId, batchClips] of batches) {
    batches.set(batchId, batchClips.sort((a, b) => (a.batch_sequence || 0) - (b.batch_sequence || 0)));
  }

  return { batches, singles };
}

export async function updateClipStatus(
  id: string,
  status: Clip['status'],
  updates?: Partial<Pick<Clip, 'result_url' | 'error' | 'provider_job_id'>>
): Promise<Clip> {
  const { data, error } = await supabase
    .from('clips')
    .update({ status, ...updates })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Clip;
}

export async function regenerateClip(
  originalClipId: string,
  mode: 'regenerate' | 'variation'
): Promise<Clip> {
  const original = await getClipById(originalClipId);
  if (!original) throw new Error('Original clip not found');

  const userId = generateUserId();
  let providerPrompt = original.provider_prompt || '';
  const modelTier = original.model_tier || 'standard';

  if (mode === 'variation' && providerPrompt) {
    providerPrompt = createVariationPrompt(providerPrompt);
  }

  const { data, error } = await supabase
    .from('clips')
    .insert({
      user_id: userId,
      video_type: original.video_type,
      topic: original.topic,
      duration_seconds: original.duration_seconds,
      angle_prompt: original.angle_prompt,
      interview_question: original.interview_question,
      scene_type: original.scene_type,
      city_style: original.city_style,
      energy_level: original.energy_level,
      speaker_style: original.speaker_style,
      motivational_setting: original.motivational_setting,
      camera_style: original.camera_style,
      lighting_mood: original.lighting_mood,
      street_scene: original.street_scene,
      interview_style: original.interview_style,
      time_of_day: original.time_of_day,
      interviewer_type: original.interviewer_type,
      interviewer_position: original.interviewer_position,
      subject_demographic: original.subject_demographic,
      subject_gender: original.subject_gender,
      subject_style: original.subject_style,
      provider: modelTier === 'premium' ? 'google' : 'minimax',
      status: 'queued',
      provider_prompt: providerPrompt,
      negative_prompt: original.negative_prompt,
      model_tier: modelTier,
      speech_script: original.speech_script,
      has_speech: original.has_speech,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  const clip = data as Clip;
  triggerGeneration(clip, modelTier, original.speech_script || undefined);

  return clip;
}

export async function deleteBatch(batchId: string): Promise<void> {
  const { error } = await supabase
    .from('clips')
    .delete()
    .eq('batch_id', batchId);

  if (error) throw new Error(error.message);
}
