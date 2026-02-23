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
  StudioSetup,
  StudioLighting,
  WisdomTone,
  WisdomFormat,
  WisdomDemographic,
  WisdomSetting,
  SupportedLanguage,
  NicheCategory,
  InterviewFormat,
  DurationPreset,
  ProductPlacementConfig,
  ExportPlatform,
  SocialDynamicsConfig,
} from './types';
import { getUserId } from './auth';
import { createClipPlan, createVariationPrompt, createBatchVariationPrompt } from './promptEngine';
import {
  validateClipCreationOptions,
  validateBatchSize,
} from './validation';
import {
  sanitizeTopicInput,
  sanitizeAnglePrompt,
  sanitizeInterviewQuestion,
  sanitizeSpeechScript,
  containsDangerousContent,
} from './sanitize';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

interface BackendPromptResult {
  provider_prompt: string;
  negative_prompt: string;
  template_id: string | null;
  source: string;
}

async function buildPromptFromBackend(
  options: CreateClipOptions,
  sanitizedTopic: string,
  sanitizedAngle?: string,
  sanitizedQuestion?: string,
): Promise<BackendPromptResult | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(`${SUPABASE_URL}/functions/v1/build-prompt`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        video_type: options.videoType,
        topic: sanitizedTopic,
        duration_seconds: options.durationSeconds,
        angle_prompt: sanitizedAngle || undefined,
        interview_question: sanitizedQuestion || undefined,
        scene_type: options.sceneType || undefined,
        city_style: options.cityStyle || undefined,
        energy_level: options.energyLevel || undefined,
        speaker_style: options.speakerStyle || undefined,
        motivational_setting: options.motivationalSetting || undefined,
        camera_style: options.cameraStyle || undefined,
        lighting_mood: options.lightingMood || undefined,
        street_scene: options.streetScene || undefined,
        interview_style: options.interviewStyle || undefined,
        time_of_day: options.timeOfDay || undefined,
        interviewer_type: options.interviewerType || undefined,
        interviewer_position: options.interviewerPosition || undefined,
        subject_demographic: options.subjectDemographic || undefined,
        subject_gender: options.subjectGender || undefined,
        subject_style: options.subjectStyle || undefined,
        subway_line: options.subwayLine || undefined,
        neighborhood: options.neighborhood || undefined,
        studio_setup: options.studioSetup || undefined,
        studio_lighting: options.studioLighting || undefined,
        wisdom_tone: options.wisdomTone || undefined,
        wisdom_format: options.wisdomFormat || undefined,
        wisdom_demographic: options.wisdomDemographic || undefined,
        wisdom_setting: options.wisdomSetting || undefined,
        target_age_group: options.targetAgeGroup || undefined,
        custom_location: options.customLocation || undefined,
        scenario_description: options.scenarioDescription || undefined,
        social_dynamics: options.socialDynamics || undefined,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = await response.json();
    if (!data.provider_prompt) return null;

    return {
      provider_prompt: data.provider_prompt,
      negative_prompt: data.negative_prompt || '',
      template_id: data.template_id || null,
      source: data.source || 'backend',
    };
  } catch {
    return null;
  }
}

async function triggerGeneration(clip: Clip, modelTier?: ModelTier, speechScript?: string): Promise<void> {
  try {
    await supabase
      .from('clips')
      .update({ status: 'running' })
      .eq('id', clip.id);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

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
        interview_style: clip.interview_style,
        energy_level: clip.energy_level,
        scene_type: clip.scene_type,
        city_style: clip.city_style,
        camera_style: clip.camera_style,
        lighting_mood: clip.lighting_mood,
        speaker_style: clip.speaker_style,
        studio_setup: clip.studio_setup,
        studio_lighting: clip.studio_lighting,
        time_of_day: clip.time_of_day,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      await supabase
        .from('clips')
        .update({ status: 'error', error: `Generation trigger failed: ${errorText}` })
        .eq('id', clip.id);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    await supabase
      .from('clips')
      .update({ status: 'error', error: `Failed to trigger generation: ${message}` })
      .eq('id', clip.id);
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
  studioSetup?: StudioSetup;
  studioLighting?: StudioLighting;
  wisdomTone?: WisdomTone;
  wisdomFormat?: WisdomFormat;
  wisdomDemographic?: WisdomDemographic;
  wisdomSetting?: WisdomSetting;
  subwayLine?: string;
  subwayEnhancements?: Record<string, unknown>;
  neighborhood?: string;
  streetEnhancements?: Record<string, unknown>;
  motivationalEnhancements?: Record<string, unknown>;
  speakerArchetype?: string;
  targetAgeGroup?: string;
  effects?: Record<string, unknown>;
  // New feature fields
  language?: SupportedLanguage;
  niche?: NicheCategory;
  interview_format?: InterviewFormat;
  duration_preset?: DurationPreset;
  caption_style?: string;
  export_platforms?: ExportPlatform[];
  product_placement?: ProductPlacementConfig;
  customLocation?: string;
  scenarioDescription?: string;
  socialDynamics?: SocialDynamicsConfig;
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
    studioSetup,
    studioLighting,
    wisdomTone,
    wisdomFormat,
    wisdomDemographic,
    wisdomSetting,
    language,
    niche,
    interview_format,
    duration_preset,
    caption_style,
    export_platforms,
    product_placement,
    customLocation,
    scenarioDescription,
    socialDynamics,
  } = options;

  const {
    subwayLine,
    subwayEnhancements,
    neighborhood,
    streetEnhancements,
    motivationalEnhancements,
    speakerArchetype,
    targetAgeGroup,
  } = options;

  // Validate inputs
  const validation = validateClipCreationOptions({
    topic,
    anglePrompt,
    interviewQuestion,
    speechScript,
    duration: durationSeconds,
  });

  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid input');
  }

  // Sanitize all text inputs to prevent XSS
  const sanitizedTopic = sanitizeTopicInput(topic);
  const sanitizedAngle = sanitizeAnglePrompt(anglePrompt);
  const sanitizedQuestion = sanitizeInterviewQuestion(interviewQuestion);
  const sanitizedScript = sanitizeSpeechScript(speechScript);

  // Check for dangerous content
  if (
    containsDangerousContent(sanitizedTopic) ||
    containsDangerousContent(sanitizedAngle) ||
    containsDangerousContent(sanitizedQuestion) ||
    containsDangerousContent(sanitizedScript)
  ) {
    throw new Error('Input contains potentially dangerous content');
  }

  const userId = getUserId();

  const backendResult = await buildPromptFromBackend(
    options, sanitizedTopic, sanitizedAngle, sanitizedQuestion
  );

  let providerPrompt: string;
  let negativePrompt: string;

  if (backendResult) {
    providerPrompt = backendResult.provider_prompt;
    negativePrompt = backendResult.negative_prompt;
  } else {
    const plan = createClipPlan({
      videoType,
      topic: sanitizedTopic,
      durationSeconds,
      anglePrompt: sanitizedAngle,
      interviewQuestion: sanitizedQuestion,
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
      studioSetup,
      studioLighting,
      wisdomTone,
      wisdomFormat,
      wisdomDemographic,
      wisdomSetting,
    });
    providerPrompt = plan.provider_prompt;
    negativePrompt = plan.negative_prompt;
  }

  const { data, error } = await supabase
    .from('clips')
    .insert({
      user_id: userId,
      video_type: videoType,
      topic: sanitizedTopic,
      duration_seconds: durationSeconds,
      angle_prompt: sanitizedAngle || null,
      interview_question: sanitizedQuestion || null,
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
      studio_setup: studioSetup || null,
      studio_lighting: studioLighting || null,
      wisdom_tone: wisdomTone || null,
      wisdom_format: wisdomFormat || null,
      wisdom_demographic: wisdomDemographic || null,
      wisdom_setting: wisdomSetting || null,
      provider: modelTier === 'premium' ? 'google' : 'minimax',
      status: 'queued',
      provider_prompt: providerPrompt,
      negative_prompt: negativePrompt,
      model_tier: modelTier,
      speech_script: sanitizedScript || null,
      has_speech: !!sanitizedScript,
      language: language || null,
      niche: niche || null,
      interview_format: interview_format || null,
      duration_preset: duration_preset || null,
      caption_style: caption_style || null,
      export_platforms: export_platforms || null,
      product_placement: product_placement || null,
      custom_location: customLocation || null,
      scenario_description: scenarioDescription || null,
      social_dynamics: socialDynamics || null,
      subway_line: subwayLine || null,
      subway_enhancements: subwayEnhancements || null,
      neighborhood: neighborhood || null,
      street_enhancements: streetEnhancements || null,
      motivational_enhancements: motivationalEnhancements || null,
      speaker_archetype: speakerArchetype || null,
      target_age_group: targetAgeGroup || null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  const clip = data as Clip;
  triggerGeneration(clip, modelTier, sanitizedScript);

  return clip;
}

export async function createClipBatch(
  options: CreateClipOptions,
  batchSize: number
): Promise<Clip[]> {
  // Validate batch size
  const batchValidation = validateBatchSize(batchSize);
  if (!batchValidation.valid) {
    throw new Error(batchValidation.error || 'Invalid batch size');
  }

  // Validate inputs
  const validation = validateClipCreationOptions({
    topic: options.topic,
    anglePrompt: options.anglePrompt,
    interviewQuestion: options.interviewQuestion,
    speechScript: options.speechScript,
    duration: options.durationSeconds,
    batchSize,
  });

  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid input');
  }

  // Sanitize all text inputs
  const sanitizedTopic = sanitizeTopicInput(options.topic);
  const sanitizedAngle = sanitizeAnglePrompt(options.anglePrompt);
  const sanitizedQuestion = sanitizeInterviewQuestion(options.interviewQuestion);
  const sanitizedScript = sanitizeSpeechScript(options.speechScript);

  // Check for dangerous content
  if (
    containsDangerousContent(sanitizedTopic) ||
    containsDangerousContent(sanitizedAngle) ||
    containsDangerousContent(sanitizedQuestion) ||
    containsDangerousContent(sanitizedScript)
  ) {
    throw new Error('Input contains potentially dangerous content');
  }

  const userId = getUserId();
  const batchId = crypto.randomUUID();
  const modelTier = options.modelTier || 'standard';

  const basePlan = createClipPlan({
    videoType: options.videoType,
    topic: sanitizedTopic,
    durationSeconds: options.durationSeconds,
    anglePrompt: sanitizedAngle,
    interviewQuestion: sanitizedQuestion,
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
      topic: sanitizedTopic,
      duration_seconds: options.durationSeconds,
      angle_prompt: sanitizedAngle || null,
      interview_question: sanitizedQuestion || null,
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
      speech_script: sanitizedScript || null,
      has_speech: !!sanitizedScript,
      language: options.language || null,
      niche: options.niche || null,
      interview_format: options.interview_format || null,
      duration_preset: options.duration_preset || null,
      caption_style: options.caption_style || null,
      export_platforms: options.export_platforms || null,
      product_placement: options.product_placement || null,
      custom_location: options.customLocation || null,
      scenario_description: options.scenarioDescription || null,
      social_dynamics: options.socialDynamics || null,
    };
  });

  const { data, error } = await supabase
    .from('clips')
    .insert(clipInserts)
    .select();

  if (error) throw new Error(error.message);

  const clips = data as Clip[];
  clips.forEach(clip => triggerGeneration(clip, modelTier, sanitizedScript));

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
  const userId = getUserId();
  let query = supabase
    .from('clips')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (filters?.type && filters.type !== 'all') {
    query = query.eq('video_type', filters.type);
  }

  if (filters?.search) {
    const sanitized = filters.search.replace(/[%_,().]/g, '');
    if (sanitized.length > 0) {
      const searchTerm = `%${sanitized}%`;
      query = query.or(`topic.ilike.${searchTerm},angle_prompt.ilike.${searchTerm},interview_question.ilike.${searchTerm}`);
    }
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
  const userId = getUserId();
  if (!userId) throw new Error('Not authenticated');
  const { data, error } = await supabase
    .from('clips')
    .update({ status, ...updates })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Clip not found or access denied');
  return data as Clip;
}

export async function regenerateClip(
  originalClipId: string,
  mode: 'regenerate' | 'variation'
): Promise<Clip> {
  const original = await getClipById(originalClipId);
  if (!original) throw new Error('Original clip not found');

  const userId = getUserId();
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
      subway_line: original.subway_line,
      subway_enhancements: original.subway_enhancements,
      neighborhood: original.neighborhood,
      street_enhancements: original.street_enhancements,
      motivational_enhancements: original.motivational_enhancements,
      speaker_archetype: original.speaker_archetype,
      target_age_group: original.target_age_group,
      language: original.language,
      niche: original.niche,
      interview_format: original.interview_format,
      duration_preset: original.duration_preset,
      caption_style: original.caption_style,
      export_platforms: original.export_platforms,
      product_placement: original.product_placement,
      custom_location: original.custom_location,
      scenario_description: original.scenario_description,
      social_dynamics: original.social_dynamics,
      studio_setup: original.studio_setup,
      studio_lighting: original.studio_lighting,
      template_id: original.template_id,
      effects: original.effects,
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

export async function retryClip(clipId: string): Promise<Clip> {
  const clip = await getClipById(clipId);
  if (!clip) throw new Error('Clip not found');

  const { data, error } = await supabase
    .from('clips')
    .update({ status: 'queued', error: null })
    .eq('id', clipId)
    .select()
    .single();

  if (error) throw new Error(error.message);

  const updated = data as Clip;
  triggerGeneration(updated, updated.model_tier || 'standard', updated.speech_script || undefined);
  return updated;
}

export async function deleteBatch(batchId: string): Promise<void> {
  const userId = getUserId();
  const { error } = await supabase
    .from('clips')
    .delete()
    .eq('batch_id', batchId)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
}
