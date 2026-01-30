export type ClipType = 'motivational' | 'street_interview' | 'subway_interview';
export type ClipStatus = 'queued' | 'running' | 'done' | 'error';
export type ModelTier = 'standard' | 'premium';
export type VideoModel = 'hailuo-2.3-fast' | 'hailuo-2.3' | 'veo-3.1-fast' | 'veo-3.1';

export type SubwaySceneType =
  | 'platform_waiting'
  | 'inside_train'
  | 'train_arriving'
  | 'rush_hour'
  | 'late_night'
  | 'walking_through';

export type CityStyle = 'nyc' | 'london' | 'tokyo' | 'paris' | 'generic';

export type EnergyLevel = 'calm' | 'conversational' | 'high_energy' | 'chaotic';

export type SpeakerStyle =
  | 'intense_coach'
  | 'calm_mentor'
  | 'hype_man'
  | 'wise_elder'
  | 'corporate_exec'
  | 'athlete';

export type MotivationalSetting =
  | 'gym'
  | 'stage'
  | 'outdoor'
  | 'studio'
  | 'urban_rooftop'
  | 'office'
  | 'locker_room';

export type CameraStyle =
  | 'dramatic_push'
  | 'slow_orbit'
  | 'tight_closeup'
  | 'wide_epic'
  | 'handheld_raw';

export type LightingMood =
  | 'golden_hour'
  | 'dramatic_shadows'
  | 'high_contrast'
  | 'studio_clean'
  | 'moody_backlit';

export type StreetScene =
  | 'busy_sidewalk'
  | 'coffee_shop_exterior'
  | 'park_bench'
  | 'crosswalk'
  | 'shopping_district'
  | 'quiet_neighborhood';

export type InterviewStyle =
  | 'quick_fire'
  | 'deep_conversation'
  | 'man_on_street'
  | 'ambush_style'
  | 'friendly_chat'
  | 'hot_take'
  | 'confessional'
  | 'debate_challenge'
  | 'reaction_test'
  | 'serious_probe'
  | 'storytelling';

export type TimeOfDay =
  | 'morning'
  | 'midday'
  | 'golden_hour'
  | 'dusk'
  | 'night';

export type InterviewerType =
  | 'podcaster'
  | 'documentary_journalist'
  | 'casual_creator'
  | 'news_reporter'
  | 'hidden_voice_only';

export type InterviewerPosition =
  | 'holding_mic'
  | 'handheld_pov'
  | 'two_shot_visible'
  | 'over_shoulder';

export type SubjectDemographic =
  | 'young_professional'
  | 'college_student'
  | 'middle_aged'
  | 'senior'
  | 'business_exec'
  | 'creative_type'
  | 'fitness_enthusiast'
  | 'any';

export type SubjectGender = 'male' | 'female' | 'any';

export type SubjectStyle =
  | 'streetwear'
  | 'business_casual'
  | 'athletic'
  | 'bohemian'
  | 'corporate'
  | 'casual';

export type CharacterPreset =
  | 'podcast_pro'
  | 'street_vox'
  | 'documentary'
  | 'random_encounter'
  | 'custom';

export type QuestionCategory =
  | 'money'
  | 'dating'
  | 'personal'
  | 'career'
  | 'hottakes'
  | 'philosophy'
  | 'nyc';

export type EpisodeStatus = 'queued' | 'generating' | 'stitching' | 'done' | 'error';

export type ShotType = 'cold_open' | 'guest_answer' | 'follow_up' | 'reaction' | 'b_roll' | 'close';

export type ShotStatus = 'queued' | 'running' | 'done' | 'error';

export type CharacterRole = 'host' | 'guest';

export type Speaker = 'host' | 'guest';

export type CameraDirection = 'two-shot' | 'close-up' | 'medium' | 'wide' | 'over-shoulder';

export interface Clip {
  id: string;
  user_id: string;
  video_type: ClipType;
  topic: string;
  duration_seconds: number;
  angle_prompt: string | null;
  interview_question: string | null;
  scene_type: SubwaySceneType | null;
  city_style: CityStyle | null;
  energy_level: EnergyLevel | null;
  speaker_style: SpeakerStyle | null;
  motivational_setting: MotivationalSetting | null;
  camera_style: CameraStyle | null;
  lighting_mood: LightingMood | null;
  street_scene: StreetScene | null;
  interview_style: InterviewStyle | null;
  time_of_day: TimeOfDay | null;
  batch_id: string | null;
  batch_sequence: number | null;
  provider: string;
  provider_job_id: string | null;
  status: ClipStatus;
  provider_prompt: string | null;
  negative_prompt: string | null;
  result_url: string | null;
  error: string | null;
  created_at: string;
  model_tier: ModelTier | null;
  model_used: VideoModel | null;
  has_speech: boolean;
  speech_script: string | null;
  interviewer_type: InterviewerType | null;
  interviewer_position: InterviewerPosition | null;
  subject_demographic: SubjectDemographic | null;
  subject_gender: SubjectGender | null;
  subject_style: SubjectStyle | null;
}

export interface Question {
  id: string;
  category: QuestionCategory;
  question: string;
  is_trending: boolean;
  usage_count: number;
  created_at: string;
}

export interface ClipPlan {
  provider_prompt: string;
  negative_prompt: string;
  video_type: ClipType;
  topic: string;
  duration_seconds: number;
  aspect_ratio: string;
  variation_hint: string;
}

export interface GenerateRequest {
  videoType: ClipType;
  topic: string;
  durationSeconds: number;
  anglePrompt?: string;
  aspectRatio?: string;
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

export interface ClipBatch {
  batchId: string;
  clips: Clip[];
  name?: string;
  createdAt: string;
}

export interface CharacterBible {
  id: string;
  user_id: string;
  name: string;
  role: CharacterRole;
  age_range: string;
  gender: string;
  ethnicity: string;
  clothing_style: string;
  hair_description: string;
  distinguishing_features: string | null;
  energy_persona: string;
  voice_style: string;
  is_default: boolean;
  created_at: string;
}

export interface EpisodeScript {
  id: string;
  user_id: string;
  topic: string;
  hook_question: string;
  guest_answer: string;
  follow_up_question: string;
  follow_up_answer: string;
  reaction_line: string;
  close_punchline: string;
  is_generated: boolean;
  created_at: string;
}

export interface Episode {
  id: string;
  user_id: string;
  script_id: string | null;
  host_character_id: string | null;
  guest_character_id: string | null;
  status: EpisodeStatus;
  city_style: CityStyle;
  total_duration_seconds: number;
  final_video_url: string | null;
  caption_file_url: string | null;
  thumbnail_url: string | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
  script?: EpisodeScript;
  host_character?: CharacterBible;
  guest_character?: CharacterBible;
  shots?: EpisodeShot[];
}

export interface EpisodeShot {
  id: string;
  episode_id: string;
  shot_type: ShotType;
  sequence: number;
  duration_seconds: number;
  dialogue: string | null;
  speaker: Speaker | null;
  camera_direction: CameraDirection;
  provider_prompt: string | null;
  status: ShotStatus;
  result_url: string | null;
  error: string | null;
  created_at: string;
}

export interface ShotConfig {
  type: ShotType;
  sequence: number;
  duration: number;
  speaker: Speaker | null;
  camera: CameraDirection;
  description: string;
}

export const SHOT_CONFIGS: ShotConfig[] = [
  { type: 'cold_open', sequence: 1, duration: 6, speaker: 'host', camera: 'two-shot', description: 'Host asks hook question' },
  { type: 'guest_answer', sequence: 2, duration: 8, speaker: 'guest', camera: 'close-up', description: 'Guest delivers main answer' },
  { type: 'follow_up', sequence: 3, duration: 6, speaker: 'host', camera: 'two-shot', description: 'Quick back-and-forth' },
  { type: 'reaction', sequence: 4, duration: 4, speaker: 'host', camera: 'close-up', description: 'Host reaction shot' },
  { type: 'b_roll', sequence: 5, duration: 4, speaker: null, camera: 'wide', description: 'Subway ambience' },
  { type: 'close', sequence: 6, duration: 8, speaker: 'host', camera: 'two-shot', description: 'That\'s a TAKE moment' },
];

export interface CreateEpisodeRequest {
  topic: string;
  cityStyle: CityStyle;
  hostCharacterId?: string;
  guestCharacterId?: string;
  customScript?: Partial<EpisodeScript>;
}
