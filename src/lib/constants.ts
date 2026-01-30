import type {
  ClipType,
  SubwaySceneType,
  CityStyle,
  EnergyLevel,
  QuestionCategory,
  ModelTier,
  VideoModel,
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
  CharacterPreset,
} from './types';

export const DURATION_OPTIONS = [3, 4, 5, 6, 8] as const;

export const TOPICS: Record<ClipType, string[]> = {
  motivational: [
    'Discipline',
    'Consistency',
    'Confidence',
    'Comeback',
    'Focus',
    'No Excuses',
    'Leadership',
    'Wealth Mindset',
    'Fitness',
    'Purpose',
  ],
  street_interview: [
    'Money',
    'Success',
    'Discipline',
    'Confidence',
    'Failure',
    'Career',
    'Entrepreneurship',
    'Mindset',
    'Relationships',
    'Life Advice',
  ],
  subway_interview: [
    'Money',
    'Dating',
    'Hot Takes',
    'Personal',
    'Career',
    'NYC Life',
    'Life Advice',
    'Relationships',
    'Success',
    'Philosophy',
  ],
};

export const CLIP_TYPE_INFO: Record<ClipType, { title: string; subtitle: string }> = {
  motivational: {
    title: 'Motivational',
    subtitle: 'Cinematic b-roll / kinetic vibe',
  },
  street_interview: {
    title: 'Street Interview',
    subtitle: 'Sidewalk documentary style',
  },
  subway_interview: {
    title: 'Subway Interview',
    subtitle: 'SubwayTakes viral style',
  },
};

export const SUBWAY_SCENES: { value: SubwaySceneType; label: string; description: string }[] = [
  { value: 'platform_waiting', label: 'Platform Waiting', description: 'Subject on platform, train arrives in background' },
  { value: 'inside_train', label: 'Inside Train', description: 'Seated or standing in subway car' },
  { value: 'train_arriving', label: 'Train Arriving', description: 'Dramatic doors opening moment' },
  { value: 'rush_hour', label: 'Rush Hour', description: 'Dense crowd, chaotic energy' },
  { value: 'late_night', label: 'Late Night', description: 'Empty platform, moody lighting' },
  { value: 'walking_through', label: 'Walking Through', description: 'Moving through station' },
];

export const CITY_STYLES: { value: CityStyle; label: string; description: string }[] = [
  { value: 'nyc', label: 'NYC Subway', description: 'MTA aesthetic, tile walls, yellow platform edge' },
  { value: 'london', label: 'London Underground', description: 'Rounded tunnels, Mind the Gap' },
  { value: 'tokyo', label: 'Tokyo Metro', description: 'Clean, modern, organized crowds' },
  { value: 'paris', label: 'Paris Metro', description: 'Art nouveau stations, European style' },
  { value: 'generic', label: 'Generic Urban', description: 'Universal subway look' },
];

export const ENERGY_LEVELS: { value: EnergyLevel; label: string; description: string }[] = [
  { value: 'calm', label: 'Calm', description: 'Relaxed, thoughtful responses' },
  { value: 'conversational', label: 'Conversational', description: 'Natural, friendly vibe' },
  { value: 'high_energy', label: 'High Energy', description: 'Animated, expressive' },
  { value: 'chaotic', label: 'Chaotic', description: 'Wild, unexpected reactions' },
];

export const SPEAKER_STYLES: { value: SpeakerStyle; label: string; description: string }[] = [
  { value: 'intense_coach', label: 'Intense Coach', description: 'Drill sergeant energy, in-your-face motivation' },
  { value: 'calm_mentor', label: 'Calm Mentor', description: 'Wise, measured delivery, thoughtful pauses' },
  { value: 'hype_man', label: 'Hype Man', description: 'High energy, crowd-pumping enthusiasm' },
  { value: 'wise_elder', label: 'Wise Elder', description: 'Experienced, sage-like wisdom delivery' },
  { value: 'corporate_exec', label: 'Corporate Executive', description: 'Polished, professional business leader' },
  { value: 'athlete', label: 'Athlete', description: 'Competitor mindset, physical intensity' },
];

export const MOTIVATIONAL_SETTINGS: { value: MotivationalSetting; label: string; description: string }[] = [
  { value: 'gym', label: 'Gym', description: 'Weight room, heavy equipment, raw energy' },
  { value: 'stage', label: 'Stage', description: 'Conference stage, spotlight, audience silhouettes' },
  { value: 'outdoor', label: 'Outdoor', description: 'Nature backdrop, mountains or ocean' },
  { value: 'studio', label: 'Studio', description: 'Clean podcast studio setup' },
  { value: 'urban_rooftop', label: 'Urban Rooftop', description: 'City skyline, sunset backdrop' },
  { value: 'office', label: 'Office', description: 'Executive office, success environment' },
  { value: 'locker_room', label: 'Locker Room', description: 'Pre-game energy, team environment' },
];

export const CAMERA_STYLES: { value: CameraStyle; label: string; description: string }[] = [
  { value: 'dramatic_push', label: 'Dramatic Push-In', description: 'Slow zoom toward subject, building intensity' },
  { value: 'slow_orbit', label: 'Slow Orbit', description: 'Camera circles subject, epic feel' },
  { value: 'tight_closeup', label: 'Tight Close-Up', description: 'Face fills frame, intimate and intense' },
  { value: 'wide_epic', label: 'Wide Epic', description: 'Subject in grand environment' },
  { value: 'handheld_raw', label: 'Handheld Raw', description: 'Slight shake, documentary authenticity' },
];

export const LIGHTING_MOODS: { value: LightingMood; label: string; description: string }[] = [
  { value: 'golden_hour', label: 'Golden Hour', description: 'Warm, cinematic sunset tones' },
  { value: 'dramatic_shadows', label: 'Dramatic Shadows', description: 'High contrast, moody lighting' },
  { value: 'high_contrast', label: 'High Contrast', description: 'Bold, punchy black and white tones' },
  { value: 'studio_clean', label: 'Studio Clean', description: 'Professional, even lighting' },
  { value: 'moody_backlit', label: 'Moody Backlit', description: 'Silhouette edges, atmospheric' },
];

export const STREET_SCENES: { value: StreetScene; label: string; description: string }[] = [
  { value: 'busy_sidewalk', label: 'Busy Sidewalk', description: 'High foot traffic, urban energy' },
  { value: 'coffee_shop_exterior', label: 'Coffee Shop', description: 'Cafe patio, relaxed vibe' },
  { value: 'park_bench', label: 'Park Bench', description: 'Green space, casual setting' },
  { value: 'crosswalk', label: 'Crosswalk', description: 'Intersection, movement all around' },
  { value: 'shopping_district', label: 'Shopping District', description: 'Storefronts, affluent area' },
  { value: 'quiet_neighborhood', label: 'Quiet Neighborhood', description: 'Residential, intimate feel' },
];

export const INTERVIEW_STYLES: { value: InterviewStyle; label: string; description: string }[] = [
  { value: 'quick_fire', label: 'Quick Fire', description: 'Rapid questions, punchy answers' },
  { value: 'deep_conversation', label: 'Deep Conversation', description: 'Thoughtful, philosophical exchange' },
  { value: 'man_on_street', label: 'Man on Street', description: 'Classic vox pop approach' },
  { value: 'ambush_style', label: 'Ambush Style', description: 'Catch them off guard, raw reactions' },
  { value: 'friendly_chat', label: 'Friendly Chat', description: 'Warm, conversational tone' },
  { value: 'hot_take', label: 'Hot Take', description: 'Bold opinions, controversial stances' },
  { value: 'confessional', label: 'Confessional', description: 'Intimate, vulnerable personal sharing' },
  { value: 'debate_challenge', label: 'Debate Challenge', description: 'Confrontational, defending positions' },
  { value: 'reaction_test', label: 'Reaction Test', description: 'Testing responses to scenarios' },
  { value: 'serious_probe', label: 'Serious Probe', description: 'Investigative, pressing for truth' },
  { value: 'storytelling', label: 'Storytelling', description: 'Narrative focus, personal stories' },
];

export const TIME_OF_DAY_OPTIONS: { value: TimeOfDay; label: string; description: string }[] = [
  { value: 'morning', label: 'Morning', description: 'Fresh daylight, commuter energy' },
  { value: 'midday', label: 'Midday', description: 'Bright, harsh sun, lunch crowds' },
  { value: 'golden_hour', label: 'Golden Hour', description: 'Warm sunset glow' },
  { value: 'dusk', label: 'Dusk', description: 'Blue hour, city lights coming on' },
  { value: 'night', label: 'Night', description: 'Street lights, urban nightlife' },
];

export const QUESTION_CATEGORIES: { value: QuestionCategory; label: string }[] = [
  { value: 'money', label: 'Money & Success' },
  { value: 'dating', label: 'Dating & Relationships' },
  { value: 'personal', label: 'Personal & Self' },
  { value: 'career', label: 'Career' },
  { value: 'hottakes', label: 'Hot Takes' },
  { value: 'philosophy', label: 'Life Philosophy' },
  { value: 'nyc', label: 'NYC Specific' },
];

export const BATCH_SIZE_OPTIONS = [3, 5, 10] as const;

export interface ModelConfig {
  id: VideoModel;
  name: string;
  provider: 'minimax' | 'google';
  tier: ModelTier;
  costPerSecond: number;
  hasSpeech: boolean;
  description: string;
}

export const VIDEO_MODELS: ModelConfig[] = [
  {
    id: 'hailuo-2.3-fast',
    name: 'Hailuo Fast',
    provider: 'minimax',
    tier: 'standard',
    costPerSecond: 0.034,
    hasSpeech: true,
    description: 'Fast generation, good speech quality',
  },
  {
    id: 'hailuo-2.3',
    name: 'Hailuo',
    provider: 'minimax',
    tier: 'standard',
    costPerSecond: 0.059,
    hasSpeech: true,
    description: 'Better quality, natural dialogue',
  },
  {
    id: 'veo-3.1-fast',
    name: 'Veo Fast',
    provider: 'google',
    tier: 'premium',
    costPerSecond: 0.105,
    hasSpeech: true,
    description: 'Premium fast, excellent lip-sync',
  },
  {
    id: 'veo-3.1',
    name: 'Veo Premium',
    provider: 'google',
    tier: 'premium',
    costPerSecond: 0.21,
    hasSpeech: true,
    description: 'Best quality, cinema-grade speech',
  },
];

export const MODEL_TIERS: { value: ModelTier; label: string; description: string; badge?: string }[] = [
  {
    value: 'standard',
    label: 'Standard',
    description: 'MiniMax Hailuo - Fast, affordable, good speech',
  },
  {
    value: 'premium',
    label: 'Premium',
    description: 'Google Veo - Best quality, perfect lip-sync',
    badge: 'Pro',
  },
];

export function getModelForTier(tier: ModelTier, fast: boolean = true): VideoModel {
  if (tier === 'premium') {
    return fast ? 'veo-3.1-fast' : 'veo-3.1';
  }
  return fast ? 'hailuo-2.3-fast' : 'hailuo-2.3';
}

export function getModelConfig(modelId: VideoModel): ModelConfig | undefined {
  return VIDEO_MODELS.find(m => m.id === modelId);
}

export function getPlaceholderText(type: ClipType): string {
  switch (type) {
    case 'motivational':
      return 'Example: For entrepreneurs who feel stuck and need discipline today.';
    case 'street_interview':
      return 'Example: Ask about saving vs spending — keep answers punchy.';
    case 'subway_interview':
      return 'Example: Specific direction like "surprised reaction" or "confident answer"';
  }
}

export function getDefaultDuration(type: ClipType): number {
  return type === 'motivational' ? 5 : 4;
}

export const INTERVIEWER_TYPES: { value: InterviewerType; label: string; description: string }[] = [
  { value: 'podcaster', label: 'Podcaster', description: 'Professional podcast host with branded mic' },
  { value: 'documentary_journalist', label: 'Documentary', description: 'Serious journalist with handheld mic' },
  { value: 'casual_creator', label: 'Content Creator', description: 'Casual YouTuber/TikToker vibe' },
  { value: 'news_reporter', label: 'News Reporter', description: 'Broadcast-style news interviewer' },
  { value: 'hidden_voice_only', label: 'Voice Only', description: 'Off-camera, only mic/hand visible' },
];

export const INTERVIEWER_POSITIONS: { value: InterviewerPosition; label: string; description: string }[] = [
  { value: 'holding_mic', label: 'Holding Mic', description: 'Classic handheld mic toward subject' },
  { value: 'handheld_pov', label: 'POV Shot', description: 'First-person interviewer perspective' },
  { value: 'two_shot_visible', label: 'Two Shot', description: 'Both interviewer and subject visible' },
  { value: 'over_shoulder', label: 'Over Shoulder', description: 'From behind interviewer toward subject' },
];

export const SUBJECT_DEMOGRAPHICS: { value: SubjectDemographic; label: string; description: string }[] = [
  { value: 'any', label: 'Any', description: 'Random diverse subject' },
  { value: 'young_professional', label: 'Young Professional', description: '25-35, career-focused look' },
  { value: 'college_student', label: 'College Student', description: '18-24, student vibe' },
  { value: 'middle_aged', label: 'Middle Aged', description: '40-55, experienced presence' },
  { value: 'senior', label: 'Senior', description: '60+, wisdom and experience' },
  { value: 'business_exec', label: 'Business Executive', description: 'Corporate leader appearance' },
  { value: 'creative_type', label: 'Creative Type', description: 'Artist, designer aesthetic' },
  { value: 'fitness_enthusiast', label: 'Fitness Enthusiast', description: 'Athletic, gym-goer look' },
];

export const SUBJECT_GENDERS: { value: SubjectGender; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];

export const SUBJECT_STYLES: { value: SubjectStyle; label: string; description: string }[] = [
  { value: 'casual', label: 'Casual', description: 'Everyday comfortable clothing' },
  { value: 'streetwear', label: 'Streetwear', description: 'Urban fashion, sneakers, hoodies' },
  { value: 'business_casual', label: 'Business Casual', description: 'Smart casual office attire' },
  { value: 'athletic', label: 'Athletic', description: 'Gym clothes, activewear' },
  { value: 'bohemian', label: 'Bohemian', description: 'Artistic, eclectic style' },
  { value: 'corporate', label: 'Corporate', description: 'Formal business attire, suit' },
];

export interface CharacterPresetConfig {
  value: CharacterPreset;
  label: string;
  description: string;
  interviewer: {
    type: InterviewerType;
    position: InterviewerPosition;
  };
  subject: {
    demographic: SubjectDemographic;
    style: SubjectStyle;
  };
}

export const CHARACTER_PRESETS: CharacterPresetConfig[] = [
  {
    value: 'podcast_pro',
    label: 'Podcast Pro',
    description: 'Professional podcast setup with young professional guest',
    interviewer: { type: 'podcaster', position: 'two_shot_visible' },
    subject: { demographic: 'young_professional', style: 'business_casual' },
  },
  {
    value: 'street_vox',
    label: 'Street Vox Pop',
    description: 'Classic man-on-street with random everyday person',
    interviewer: { type: 'casual_creator', position: 'holding_mic' },
    subject: { demographic: 'any', style: 'casual' },
  },
  {
    value: 'documentary',
    label: 'Documentary Style',
    description: 'Serious journalism with experienced subject',
    interviewer: { type: 'documentary_journalist', position: 'over_shoulder' },
    subject: { demographic: 'middle_aged', style: 'business_casual' },
  },
  {
    value: 'random_encounter',
    label: 'Random Encounter',
    description: 'Spontaneous feel with hidden interviewer',
    interviewer: { type: 'hidden_voice_only', position: 'handheld_pov' },
    subject: { demographic: 'any', style: 'streetwear' },
  },
  {
    value: 'custom',
    label: 'Custom',
    description: 'Choose your own interviewer and subject',
    interviewer: { type: 'casual_creator', position: 'holding_mic' },
    subject: { demographic: 'any', style: 'casual' },
  },
];
