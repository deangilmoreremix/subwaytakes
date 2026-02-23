import type {
  ClipType,
  SubwaySceneType,
  CityStyle,
  TransitCardType,
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
  InterviewFormat,
  DurationPreset,
  DurationConfig,
  ProductPlacementConfig,
  SupportedLanguage,
  CaptionStyleConfig,
  ExportPlatform,
  ExportConfig,
  NicheCategory,
  KeywordConfig,
  GeneratedInterview,
  TimeOfDay,
  InterviewerType,
  InterviewerPosition,
  SubjectDemographic,
  SubjectGender,
  SubjectStyle,
  CharacterPreset,
  InterviewMode,
  StudioSetup,
  StudioLighting,
  RerollIntensity,
  SubscriptionTier,
  DebateStance,
  DebateDepth,
  DebateResolution,
  DebateLoopConfig,
  CaptionConfig,
  SubwayLine,
  LinePersonality,
  PlotTwistType,
  CrowdReactionType,
  AmbientSound,
  Season,
  WeatherCondition,
  HolidayTheme,
  CityEvent,
  PivotDirection,
  Neighborhood,
  NeighborhoodPersonality,
  SpeakerArchetype,
  StreetPlotTwistType,
  BystanderReactionType,
  UrbanAmbientSound,
  StreetLocation,
  StreetFestival,
  TransformationScene,
  BreakthroughType,
  EventPhase,
  LiveChallengeType,
  CTAPivotType,
  AchievementContextType,
  MotivationalMusicType,
  CrossStreetPivotType,
  AgeGroup,
  AgeGroupConfig,
} from './types';

export const DURATION_OPTIONS = [3, 4, 5, 6, 8] as const;

export const TOPICS: Record<ClipType, string[]> = {
  motivational: [
    // Original 10 topics
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
    // NEW 55+ wisdom topics
    'Life Purpose',
    'Finding Meaning',
    'Legacy',
    'Resilience',
    'Gratitude',
    'Second Acts',
    'Mentorship',
    'Growth',
    'Wisdom',
    'Transformation',
    'Retirement',
    'Family',
    'Health',
    'Relationships',
    'Regrets',
    'Freedom',
    'Boundaries',
    'Scams',
    'Healthcare',
    'Loneliness',
    'Purpose',
    'Second Marriages',
    'Empty Nest',
    'Late Career',
    'Reinvention',
    'Patience',
    'Forgiveness',
    'Acceptance',
    'Hope',
    'Peace',
    'Joy',
    'Contentment',
    'Humility',
    'Kindness',
    'Generosity',
    'Compassion',
    'Courage',
    'Faith',
    'Spirituality',
    'Community',
    'Friendship',
    'Marriage',
    'Parenting',
    'Grandchildren',
    'Aging',
    'Change',
    'Loss',
    'Recovery',
    'Beginnings',
    'Endings',
    'Balance',
    'Simplicity',
  ],
  street_interview: [
    // Original 10 topics
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
    // NEW 55+ wisdom topics
    'Life Lessons',
    'Retirement',
    'Family',
    'Health',
    'Legacy',
    'Purpose',
    'Regrets',
    'Freedom',
    'Wisdom',
    'Boundaries',
    'Scams',
    'Healthcare',
    'Loneliness',
    'Second Marriages',
    'Empty Nest',
    'Late Career',
    'Mentorship',
    'Reinvention',
    'Patience',
    'Forgiveness',
    'Acceptance',
    'Hope',
    'Peace',
    'Joy',
    'Contentment',
    'Humility',
    'Kindness',
    'Generosity',
    'Compassion',
    'Courage',
    'Faith',
    'Spirituality',
    'Community',
    'Friendship',
    'Marriage',
    'Parenting',
    'Grandchildren',
    'Aging',
    'Change',
    'Loss',
    'Recovery',
    'Beginnings',
    'Endings',
    'Balance',
    'Simplicity',
    'Memory',
    'Nostalgia',
    'Tradition',
    'Respect',
    'Honesty',
    'Integrity',
    'Trust',
    'Communication',
    'Listening',
    'Understanding',
  ],
  subway_interview: [
    // Original 10 topics
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
    // Original SubwayTakes-style specific topics (10)
    'Hydration Myths',
    'Coffee Culture',
    'Sleep Schedules',
    'Social Media',
    'Side Hustles',
    'NYC Rent',
    'Food Takes',
    'Transportation',
    'Winter vs Summer',
    'Work From Home',
    // NEW 55+ wisdom topics
    'Life Lessons',
    'Retirement',
    'Family',
    'Health',
    'Legacy',
    'Purpose',
    'Regrets',
    'Freedom',
    'Wisdom',
    'Boundaries',
    'Scams',
    'Healthcare',
    'Loneliness',
    'Second Marriages',
    'Empty Nest',
    'Late Career',
    'Mentorship',
    'Reinvention',
    'Patience',
    'Forgiveness',
    'Acceptance',
    'Hope',
    'Peace',
    'Joy',
    'Contentment',
    'Humility',
    'Kindness',
    'Generosity',
    'Compassion',
    'Courage',
    'Faith',
    'Spirituality',
    'Community',
    'Friendship',
    'Marriage',
    'Parenting',
    'Grandchildren',
    'Aging',
    'Change',
    'Loss',
    'Recovery',
    'Beginnings',
    'Endings',
    'Balance',
    'Simplicity',
    'Memory',
    'Nostalgia',
    'Tradition',
    'Respect',
    'Honesty',
    'Integrity',
    'Trust',
    'Communication',
    'Listening',
    'Understanding',
  ],
  studio_interview: [
    // Original 10 topics
    'Money',
    'Dating',
    'Hot Takes',
    'Personal',
    'Career',
    'Success',
    'Relationships',
    'Philosophy',
    'Entrepreneurship',
    'Life Advice',
    // NEW 55+ wisdom topics
    'Life Lessons',
    'Retirement',
    'Family',
    'Health',
    'Legacy',
    'Purpose',
    'Regrets',
    'Freedom',
    'Wisdom',
    'Boundaries',
    'Scams',
    'Healthcare',
    'Loneliness',
    'Second Marriages',
    'Empty Nest',
    'Late Career',
    'Mentorship',
    'Reinvention',
    'Patience',
    'Forgiveness',
    'Acceptance',
    'Hope',
    'Peace',
    'Joy',
    'Contentment',
    'Humility',
    'Kindness',
    'Generosity',
    'Compassion',
    'Courage',
    'Faith',
    'Spirituality',
    'Community',
    'Friendship',
    'Marriage',
    'Parenting',
    'Grandchildren',
    'Aging',
    'Change',
    'Loss',
    'Recovery',
    'Beginnings',
    'Endings',
    'Balance',
    'Simplicity',
    'Memory',
    'Nostalgia',
    'Tradition',
    'Respect',
    'Honesty',
    'Integrity',
    'Trust',
    'Communication',
    'Listening',
    'Understanding',
  ],
  wisdom_interview: [
    // 55+ life wisdom topics
    'Life Lessons',
    'Retirement',
    'Family',
    'Health',
    'Relationships',
    'Legacy',
    'Purpose',
    'Regrets',
    'Freedom',
    'Wisdom',
    'Boundaries',
    'Scams',
    'Healthcare',
    'Loneliness',
    'Purpose',
    'Second Marriages',
    'Empty Nest',
    'Late Career',
    'Mentorship',
    'Reinvention',
    'Patience',
    'Forgiveness',
    'Acceptance',
    'Hope',
    'Peace',
    'Joy',
    'Contentment',
    'Humility',
    'Kindness',
    'Generosity',
    'Compassion',
    'Courage',
    'Faith',
    'Spirituality',
    'Community',
    'Friendship',
    'Marriage',
    'Parenting',
    'Grandchildren',
    'Aging',
    'Change',
    'Loss',
    'Recovery',
    'Beginnings',
    'Endings',
    'Balance',
    'Simplicity',
    'Memory',
    'Nostalgia',
    'Tradition',
    'Respect',
    'Honesty',
    'Integrity',
    'Trust',
    'Communication',
    'Listening',
    'Understanding',
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
  studio_interview: {
    title: 'Studio Interview',
    subtitle: 'Professional studio setup',
  },
  wisdom_interview: {
    title: 'Wisdom',
    subtitle: '55+ life experience & advice',
  },
};

// Interview Modes - 10 viral modes
export const INTERVIEW_MODES: { value: InterviewMode; label: string; description: string; emoji: string }[] = [
  { value: 'hot_take_challenge', label: 'Hot Take Challenge', description: 'Controversial opinions, debate format', emoji: '🔥' },
  { value: 'rapid_fire_round', label: 'Rapid Fire Round', description: 'Quick succession questions', emoji: '⚡' },
  { value: 'deep_dive_interview', label: 'Deep Dive Interview', description: 'Long-form philosophical', emoji: '🧠' },
  { value: 'myth_busters', label: 'Myth Busters', description: 'Debunking common beliefs', emoji: '🔍' },
  { value: 'would_you_rather', label: 'Would You Rather', description: 'Choice-based scenarios', emoji: '🤔' },
  { value: 'story_time', label: 'Story Time', description: 'Narrative personal stories', emoji: '📖' },
  { value: 'unpopular_opinion', label: 'Unpopular Opinion', description: 'Defending controversial stances', emoji: '📢' },
  { value: 'roast_me', label: 'Roast Me', description: 'Self-deprecating humor', emoji: '😅' },
  { value: 'truth_or_dare_style', label: 'Truth or Dare Style', description: 'Risk/reveal format', emoji: '🎲' },
  { value: 'expert_take', label: 'Expert Take', description: 'Authority perspective on trending topics', emoji: '💼' },
  { value: 'none', label: 'Standard', description: 'Classic interview format', emoji: '🎤' },
];

// Studio Setup Options
export const STUDIO_SETUPS: { value: StudioSetup; label: string; description: string }[] = [
  { value: 'podcast_desk', label: 'Podcast Desk', description: 'Classic podcast table setup with mics' },
  { value: 'living_room', label: 'Living Room', description: 'Comfortable couch/chairs, casual vibe' },
  { value: 'minimalist_stage', label: 'Minimalist Stage', description: 'Clean backdrop, professional look' },
  { value: 'late_night', label: 'Late Night', description: 'Desk with city backdrop, talk show style' },
  { value: 'roundtable', label: 'Roundtable', description: 'Multiple guests in circular arrangement' },
  { value: 'fireside', label: 'Fireside', description: 'Intimate, warm setting with soft lighting' },
  { value: 'news_desk', label: 'News Desk', description: 'Broadcast journalism style, authoritative' },
  { value: 'creative_loft', label: 'Creative Loft', description: 'Artistic, industrial vibe with exposed brick' },
];

// Studio Lighting Options
export const STUDIO_LIGHTING: { value: StudioLighting; label: string; description: string }[] = [
  { value: 'three_point', label: 'Three Point', description: 'Classic professional lighting setup' },
  { value: 'dramatic_key', label: 'Dramatic Key', description: 'High contrast, single strong key light' },
  { value: 'soft_diffused', label: 'Soft Diffused', description: 'Flattering, even lighting for all faces' },
  { value: 'colored_accent', label: 'Colored Accent', description: 'RGB accent lights for modern vibe' },
  { value: 'natural_window', label: 'Natural Window', description: 'Window light simulation, airy feel' },
  { value: 'cinematic', label: 'Cinematic', description: 'Movie-quality dramatic lighting' },
];

// Reroll Intensity Config
export const REROLL_INTENSITY_CONFIG: Record<RerollIntensity, {
  description: string;
  tokenCost: number;
  promptModifiers: string[];
  color: string;
}> = {
  mild: {
    description: 'Slight variation, same vibe',
    tokenCost: 15,
    promptModifiers: ['subtle variation', 'fresh take on same concept'],
    color: 'blue',
  },
  medium: {
    description: 'Noticeably different approach',
    tokenCost: 25,
    promptModifiers: ['bold reinterpretation', 'unexpected angle'],
    color: 'yellow',
  },
  spicy: {
    description: 'High energy, controversial',
    tokenCost: 40,
    promptModifiers: ['provocative stance', 'polarizing opinion', 'viral-worthy reaction'],
    color: 'orange',
  },
  nuclear: {
    description: 'Maximum chaos, unforgettable',
    tokenCost: 60,
    promptModifiers: ['extreme controversy', 'shocking revelation', 'meme-worthy moment', 'breaks the internet potential'],
    color: 'red',
  },
};

// Token Costs
export const TOKEN_COSTS = {
  generate_clip_standard: 10,
  generate_clip_premium: 25,
  generate_clip_studio: 40,
  reroll_clip: 15,
  spicier_reroll: 25,
  viral_analysis: 5,
  batch_series_3: 25,
  batch_series_5: 40,
  batch_series_10: 75,
} as const;

// Subscription Plans
export interface SubscriptionPlan {
  tier: SubscriptionTier;
  monthlyTokens: number;
  monthlyPrice: number;
  features: string[];
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    tier: 'free',
    monthlyTokens: 50,
    monthlyPrice: 0,
    features: ['Standard models', 'Basic interview modes', '5 clips/month'],
  },
  {
    tier: 'creator',
    monthlyTokens: 200,
    monthlyPrice: 19,
    features: ['Premium models', 'All interview modes', 'Viral scoring', 'Rerolls'],
  },
  {
    tier: 'pro',
    monthlyTokens: 500,
    monthlyPrice: 49,
    features: ['Studio interviews', 'Batch generation', 'Priority processing', 'API access'],
  },
  {
    tier: 'studio',
    monthlyTokens: 2000,
    monthlyPrice: 149,
    features: ['Unlimited team seats', 'Custom branding', 'Dedicated support', 'White-label options'],
  },
];

// SubwayTakes Debate Loop Configuration
export const DEBATE_STANCE_OPTIONS: { value: DebateStance; label: string; description: string }[] = [
  { value: 'auto', label: 'Auto', description: 'Intelligently choose agree/disagree per topic' },
  { value: 'always_agree', label: 'Always Agree', description: 'Interviewer always supports the take' },
  { value: 'always_disagree', label: 'Always Disagree', description: 'Interviewer always challenges the take' },
];

export const DEBATE_DEPTH_OPTIONS: { value: DebateDepth; label: string; description: string; emoji: string }[] = [
  { value: 'light', label: 'Light', description: 'Quick reaction, minimal back-and-forth', emoji: '☕' },
  { value: 'medium', label: 'Medium', description: 'Standard debate with 2-3 exchanges', emoji: '🔥' },
  { value: 'spicy', label: 'Spicy', description: 'Intense debate, pushes boundaries', emoji: '🌶️' },
];

export const DEBATE_RESOLUTION_OPTIONS: { value: DebateResolution; label: string; description: string }[] = [
  { value: 'agreement', label: 'Agreement', description: 'Both sides find common ground' },
  { value: 'agree_to_disagree', label: 'Agree to Disagree', description: 'Respectful disagreement at the end' },
  { value: 'twist', label: 'Plot Twist', description: 'Surprising revelation or reversal' },
];

// Default debate loop config
export const DEFAULT_DEBATE_LOOP: DebateLoopConfig = {
  format: 'take_discussion',
  stance: 'auto',
  depth: 'medium',
  replies: 2,
  resolution: 'agree_to_disagree',
};

// Default caption config for SubwayTakes style
export const DEFAULT_CAPTION_CONFIG: CaptionConfig = {
  style: 'burn_in',
  emphasizePhrases: [],
  maxWordsPerLine: 8,
  timingOffset: 0.2,
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

// Re-export for backward compatibility - canonical source is interviewStyleSpecs.ts
export { INTERVIEW_STYLES } from './interviewStyleSpecs';

// Interview Formats
export const INTERVIEW_FORMATS: { value: InterviewFormat; label: string; description: string; icon: string }[] = [
  { value: 'solo', label: 'Solo', description: 'Single subject, medium shot', icon: '👤' },
  { value: 'face_to_face', label: 'Face to Face', description: 'Interviewer + subject, two-shot', icon: '👥' },
  { value: 'reporter_style', label: 'Reporter', description: 'Reporter with mic, handheld', icon: '🎤' },
  { value: 'full_body', label: 'Full Body', description: 'Subject full frame, street setting', icon: '🚶' },
  { value: 'pov_interviewer', label: 'POV Interviewer', description: 'First-person POV', icon: '👁️' },
  { value: 'group', label: 'Group', description: 'Multiple people, panel', icon: '👥👥' },
];

// Duration Presets
export const DURATION_PRESETS: { value: DurationPreset; label: string; min: number; max: number; description: string }[] = [
  { value: 'hook', label: 'Hook (8-15s)', min: 8, max: 15, description: 'Short, punchy, viral-ready' },
  { value: 'quick', label: 'Quick (15-30s)', min: 15, max: 30, description: 'Brief but engaging' },
  { value: 'standard', label: 'Standard (30-60s)', min: 30, max: 60, description: 'Balanced content' },
  { value: 'deep', label: 'Deep (60-90s)', min: 60, max: 90, description: 'More detailed' },
  { value: 'long_form', label: 'Long Form (90-160s)', min: 90, max: 160, description: 'Full storytelling' },
];

// Language Options
export const LANGUAGE_OPTIONS: { code: SupportedLanguage; name: string; nativeName: string; flag: string }[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇧🇷' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
];

// Caption Presets
export const CAPTION_PRESETS: Record<string, CaptionStyleConfig> = {
  standard: {
    fontFamily: 'Inter',
    fontSize: 24,
    fontWeight: 600,
    textColor: '#FFFFFF',
    backgroundColor: '#000000',
    backgroundOpacity: 0.6,
    position: 'bottom',
    animationStyle: 'static',
    highlightWords: [],
  },
  tiktok: {
    fontFamily: 'Montserrat',
    fontSize: 28,
    fontWeight: 700,
    textColor: '#FFFFFF',
    backgroundColor: '#000000',
    backgroundOpacity: 0.7,
    position: 'bottom',
    animationStyle: 'pop',
    highlightWords: [{ word: '🔥', color: '#FFD700' }],
  },
  youtube: {
    fontFamily: 'Roboto',
    fontSize: 26,
    fontWeight: 500,
    textColor: '#FFFFFF',
    backgroundColor: '#000000',
    backgroundOpacity: 0.5,
    position: 'bottom',
    animationStyle: 'slide',
    highlightWords: [],
  },
  attention_grabber: {
    fontFamily: 'Inter',
    fontSize: 32,
    fontWeight: 800,
    textColor: '#FFD700',
    backgroundColor: '#000000',
    backgroundOpacity: 0.8,
    position: 'center',
    animationStyle: 'pop',
    highlightWords: [{ word: 'WAIT', color: '#FF4444' }],
  },
  minimalist: {
    fontFamily: 'Inter',
    fontSize: 22,
    fontWeight: 500,
    textColor: '#FFFFFF',
    backgroundColor: '#000000',
    backgroundOpacity: 0,
    position: 'bottom',
    animationStyle: 'typewriter',
    highlightWords: [],
  },
};

// Platform Export Specs
export const PLATFORM_SPECS: Record<ExportPlatform, { name: string; aspectRatio: string; resolution: string; maxDuration: number; }> = {
  tiktok: { name: 'TikTok', aspectRatio: '9:16', resolution: '1080x1920', maxDuration: 180 },
  instagram_reel: { name: 'Instagram Reels', aspectRatio: '9:16', resolution: '1080x1920', maxDuration: 90 },
  youtube_shorts: { name: 'YouTube Shorts', aspectRatio: '9:16', resolution: '1080x1920', maxDuration: 60 },
  instagram_post: { name: 'Instagram Post', aspectRatio: '4:5', resolution: '1080x1350', maxDuration: 60 },
  facebook: { name: 'Facebook', aspectRatio: '16:9', resolution: '1920x1080', maxDuration: 240 },
  youtube: { name: 'YouTube', aspectRatio: '16:9', resolution: '1920x1080', maxDuration: 43200 },
};

// Niche Categories
export const NICHE_CONFIGS: { value: NicheCategory; label: string; icon: string; defaultKeywords: string[] }[] = [
  { value: 'money', label: 'Money & Finance', icon: '💰', defaultKeywords: ['investing', 'saving', 'budgeting', 'crypto'] },
  { value: 'business', label: 'Business', icon: '💼', defaultKeywords: ['startup', 'entrepreneurship', 'marketing', 'sales'] },
  { value: 'fitness', label: 'Fitness', icon: '💪', defaultKeywords: ['workout', 'nutrition', 'weight loss', 'muscle'] },
  { value: 'relationships', label: 'Relationships', icon: '❤️', defaultKeywords: ['dating', 'marriage', 'friendship', 'love'] },
  { value: 'crypto', label: 'Crypto', icon: '🪙', defaultKeywords: ['bitcoin', 'ethereum', 'trading', 'defi'] },
  { value: 'motivation', label: 'Motivation', icon: '🔥', defaultKeywords: ['success', 'mindset', 'habits', 'productivity'] },
  { value: 'local_services', label: 'Local Services', icon: '🏪', defaultKeywords: ['plumber', 'restaurant', 'contractor', 'cleaning'] },
  { value: 'personal_brand', label: 'Personal Brand', icon: '⭐', defaultKeywords: ['influencer', 'content creator', 'online business'] },
  { value: 'tech', label: 'Tech', icon: '💻', defaultKeywords: ['AI', 'software', 'gadgets', 'programming'] },
  { value: 'health', label: 'Health', icon: '🏥', defaultKeywords: ['wellness', 'mental health', 'diet', 'sleep'] },
  { value: 'education', label: 'Education', icon: '📚', defaultKeywords: ['learning', 'career', 'skills', 'college'] },
  { value: 'entertainment', label: 'Entertainment', icon: '🎬', defaultKeywords: ['movies', 'music', 'celebrities', 'gaming'] },
  { value: 'food', label: 'Food', icon: '🍔', defaultKeywords: ['recipes', 'restaurants', 'cooking', 'nutrition'] },
  { value: 'travel', label: 'Travel', icon: '✈️', defaultKeywords: ['vacation', 'destinations', 'hotels', 'budget travel'] },
  { value: 'fashion', label: 'Fashion', icon: '👗', defaultKeywords: ['style', 'clothing', 'trends', 'shopping'] },
  { value: 'gaming', label: 'Gaming', icon: '🎮', defaultKeywords: ['video games', 'esports', 'streaming', 'gaming tips'] },
];


export const TIME_OF_DAY_OPTIONS: { value: TimeOfDay; label: string; description: string; emoji: string }[] = [
  { value: 'early_morning', label: '5AM Club', description: 'Quiet platforms, sleepy commuters, early risers', emoji: '🌅' },
  { value: 'morning_rush', label: 'Morning Rush', description: 'Packed trains, coffee-fueled, hurried energy', emoji: '☕' },
  { value: 'midday', label: 'Midday', description: 'Bright, harsh sun, lunch crowds', emoji: '☀️' },
  { value: 'evening_rush', label: 'Evening Rush', description: 'Tired commuters, heading home, social energy', emoji: '🌆' },
  { value: 'late_night', label: 'Late Night', description: 'Empty platforms, mysterious, night owls', emoji: '🌙' },
  { value: 'weekend', label: 'Weekend', description: 'Relaxed, tourists, different vibe', emoji: '🎉' },
  { value: 'golden_hour', label: 'Golden Hour', description: 'Warm sunset glow, cinematic', emoji: '🌇' },
  { value: 'dusk', label: 'Dusk', description: 'Blue hour, city lights coming on', emoji: '🌃' },
  { value: 'night', label: 'Night', description: 'Street lights, urban nightlife', emoji: '🌜' },
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
    case 'studio_interview':
      return 'Example: Professional discussion on career growth with expert insights';
    case 'wisdom_interview':
      return 'Example: Ask about life lessons, retirement wisdom, or family advice';
  }
}

export function getDefaultDuration(type: ClipType): number {
  return type === 'motivational' ? 5 : type === 'wisdom_interview' ? 6 : 4;
}

export const INTERVIEWER_TYPES: { value: InterviewerType; label: string; description: string }[] = [
  { value: 'podcaster', label: 'Podcaster', description: 'Professional podcast host with branded mic' },
  { value: 'documentary_journalist', label: 'Documentary', description: 'Serious journalist with handheld mic' },
  { value: 'casual_creator', label: 'Content Creator', description: 'Casual YouTuber/TikToker vibe' },
  { value: 'news_reporter', label: 'News Reporter', description: 'Broadcast-style news interviewer' },
  { value: 'hidden_voice_only', label: 'Voice Only', description: 'Off-camera, only mic/hand visible' },
];

export const SUBJECT_DEMOGRAPHICS: { value: SubjectDemographic; label: string; description: string }[] = [
  { value: 'any', label: 'Any', description: 'Random everyday person' },
  { value: 'young_professional', label: 'Young Professional', description: 'Late 20s to mid 30s' },
  { value: 'college_student', label: 'College Student', description: 'Early 20s' },
  { value: 'middle_aged', label: 'Middle Aged', description: '40s to 50s' },
  { value: 'senior', label: 'Senior', description: '60+' },
  { value: 'business_exec', label: 'Business Executive', description: 'Leadership presence' },
  { value: 'creative_type', label: 'Creative', description: 'Artistic appearance' },
  { value: 'fitness_enthusiast', label: 'Fitness Enthusiast', description: 'Athletic build' },
];

export const SUBJECT_GENDERS: { value: SubjectGender; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];

export const SUBJECT_STYLES: { value: SubjectStyle; label: string; description: string }[] = [
  { value: 'casual', label: 'Casual', description: 'Relaxed everyday clothing' },
  { value: 'streetwear', label: 'Streetwear', description: 'Urban fashion, sneakers' },
  { value: 'business_casual', label: 'Business Casual', description: 'Polished professional' },
  { value: 'athletic', label: 'Athletic', description: 'Gym clothes, activewear' },
  { value: 'bohemian', label: 'Bohemian', description: 'Artistic, eclectic' },
  { value: 'corporate', label: 'Corporate', description: 'Business suit' },
];

export const SUBJECT_POSITIONS: { value: InterviewerPosition; label: string; description: string }[] = [
  { value: 'holding_mic', label: 'Holding Mic', description: 'Classic interview framing' },
  { value: 'handheld_pov', label: 'Handheld POV', description: 'Documentary immersive feel' },
  { value: 'two_shot_visible', label: 'Two Shot', description: 'Both faces visible' },
  { value: 'over_shoulder', label: 'Over Shoulder', description: 'Focus on subject face' },
];

export const INTERVIEW_MODES_CONFIG: { value: InterviewMode; label: string; description: string; defaultDuration: number }[] = [
  { value: 'hot_take_challenge', label: 'Hot Take Challenge', description: 'Controversial opinions', defaultDuration: 4 },
  { value: 'rapid_fire_round', label: 'Rapid Fire Round', description: 'Quick succession', defaultDuration: 3 },
  { value: 'deep_dive_interview', label: 'Deep Dive Interview', description: 'Long-form', defaultDuration: 6 },
  { value: 'myth_busters', label: 'Myth Busters', description: 'Debunking', defaultDuration: 5 },
  { value: 'would_you_rather', label: 'Would You Rather', description: 'Choice-based', defaultDuration: 4 },
  { value: 'story_time', label: 'Story Time', description: 'Narrative', defaultDuration: 5 },
  { value: 'unpopular_opinion', label: 'Unpopular Opinion', description: 'Controversial', defaultDuration: 4 },
  { value: 'roast_me', label: 'Roast Me', description: 'Self-deprecating', defaultDuration: 3 },
  { value: 'truth_or_dare_style', label: 'Truth or Dare Style', description: 'Risk/reveal', defaultDuration: 4 },
  { value: 'expert_take', label: 'Expert Take', description: 'Authority perspective', defaultDuration: 5 },
  { value: 'none', label: 'Standard', description: 'Classic format', defaultDuration: 4 },
];

export const SEASONS: { value: Season; label: string }[] = [
  { value: 'spring', label: 'Spring' },
  { value: 'summer', label: 'Summer' },
  { value: 'fall', label: 'Fall' },
  { value: 'winter', label: 'Winter' },
];

export const WEATHER_CONDITIONS: { value: WeatherCondition; label: string }[] = [
  { value: 'clear', label: 'Clear' },
  { value: 'rainy', label: 'Rainy' },
  { value: 'snowy', label: 'Snowy' },
  { value: 'humid', label: 'Humid' },
  { value: 'windy', label: 'Windy' },
];

export const HOLIDAY_THEMES: { value: HolidayTheme; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'christmas', label: 'Christmas' },
  { value: 'new_years', label: "New Year's" },
  { value: 'halloween', label: 'Halloween' },
  { value: 'thanksgiving', label: 'Thanksgiving' },
  { value: 'pride', label: 'Pride' },
  { value: 'summer_break', label: 'Summer Break' },
];

export const CITY_EVENTS: { value: CityEvent; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'marathon', label: 'Marathon' },
  { value: 'fashion_week', label: 'Fashion Week' },
  { value: 'sports_playoffs', label: 'Sports Playoffs' },
  { value: 'concert', label: 'Concert' },
  { value: 'protest', label: 'Protest' },
  { value: 'election', label: 'Election' },
];

// Age Group configurations
export const AGE_GROUP_CONFIGS: Record<AgeGroup, AgeGroupConfig> = {
  kids: {
    ageGroup: 'kids',
    displayName: 'Kids',
    icon: '🧸',
    description: 'Family-friendly content for children',
    ageRange: '0-12',
    contentRating: 'G',
    allowedContentRatings: ['G'],
    color: 'green',
  },
  teens: {
    ageGroup: 'teens',
    displayName: 'Teens',
    icon: '🎮',
    description: 'Appropriate for teenagers',
    ageRange: '13-17',
    contentRating: 'PG',
    allowedContentRatings: ['G', 'PG'],
    color: 'blue',
  },
  adults: {
    ageGroup: 'adults',
    displayName: 'Adults',
    icon: '💼',
    description: 'General adult audience',
    ageRange: '18-54',
    contentRating: 'PG-13',
    allowedContentRatings: ['G', 'PG', 'PG-13'],
    color: 'purple',
  },
  older_adults: {
    ageGroup: 'older_adults',
    displayName: '55+',
    icon: '👴',
    description: 'Content suitable for older adults',
    ageRange: '55+',
    contentRating: 'PG',
    allowedContentRatings: ['G', 'PG'],
    color: 'amber',
  },
  all_ages: {
    ageGroup: 'all_ages',
    displayName: 'All Ages',
    icon: '🌍',
    description: 'Universal content for everyone',
    ageRange: 'All',
    contentRating: 'G',
    allowedContentRatings: ['G'],
    color: 'emerald',
  },
};

// Age-appropriate topics
export const AGE_APPROPRIATE_TOPICS: Record<AgeGroup, string[]> = {
  kids: [
    'Friendship',
    'School',
    'Family',
    'Sports',
    'Hobbies',
    'Kindness',
    'Sharing',
    'Learning',
    'Imagination',
    'Play',
  ],
  teens: [
    'Friendship',
    'Dating',
    'School',
    'Career',
    'Self Confidence',
    'Social Media',
    'Sports',
    'Music',
    'Mental Health',
    'Future',
  ],
  adults: [
    'Career',
    'Money',
    'Relationships',
    'Marriage',
    'Parenting',
    'Home',
    'Work Life Balance',
    'Health',
    'Success',
    'Growth',
  ],
  older_adults: [
    'Retirement',
    'Health',
    'Family',
    'Legacy',
    'Wisdom',
    'Relationships',
    'Purpose',
    'Freedom',
    'Gratitude',
    'Life Lessons',
  ],
  all_ages: [
    'Happiness',
    'Kindness',
    'Friendship',
    'Family',
    'Learning',
    'Growth',
    'Respect',
    'Honesty',
    'Courage',
    'Love',
  ],
};

export interface CharacterPresetConfig {
  value: CharacterPreset;
  label: string;
  description: string;
  interviewer: { type: InterviewerType; position: InterviewerPosition };
  subject: { demographic: SubjectDemographic; style: SubjectStyle };
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
  // 55+ wisdom presets
  {
    value: 'wisdom_seeker',
    label: 'Wisdom Seeker',
    description: 'Seeking life lessons from experienced voices',
    interviewer: { type: 'casual_creator', position: 'holding_mic' },
    subject: { demographic: 'senior', style: 'casual' },
  },
  {
    value: 'wisdom_mentor',
    label: 'Wisdom Mentor',
    description: 'Experienced mentor sharing life lessons',
    interviewer: { type: 'documentary_journalist', position: 'over_shoulder' },
    subject: { demographic: 'middle_aged', style: 'business_casual' },
  },
  {
    value: 'grandparent_wisdom',
    label: 'Grandparent Wisdom',
    description: 'Family wisdom across generations',
    interviewer: { type: 'casual_creator', position: 'holding_mic' },
    subject: { demographic: 'senior', style: 'casual' },
  },
  {
    value: 'custom',
    label: 'Custom',
    description: 'Choose your own interviewer and subject',
    interviewer: { type: 'casual_creator', position: 'holding_mic' },
    subject: { demographic: 'any', style: 'casual' },
  },
];

// === SUBWAY ENHANCEMENT CONSTANTS ===

// 7. Subway Line Personality Matching
export const SUBWAY_LINES: { value: SubwayLine; label: string; color: string; description: string; personality: string }[] = [
  { value: '1', label: '1 Train', color: '#EE352E', description: 'Broadway-Seventh Avenue Local', personality: 'Fast, direct, business-minded, no-nonsense' },
  { value: '2', label: '2 Train', color: '#EE352E', description: 'Broadway-Seventh Avenue Express', personality: 'Express speed, Bronx to Brooklyn, diverse' },
  { value: '3', label: '3 Train', color: '#EE352E', description: 'Broadway-Seventh Avenue Express', personality: 'Harlem to Brooklyn, cultural, energetic' },
  { value: '4', label: '4 Train', color: '#00933C', description: 'Lexington Avenue Express', personality: 'Crowded, Upper East Side, power commuters' },
  { value: '5', label: '5 Train', color: '#00933C', description: 'Lexington Avenue Express', personality: 'Bronx express, working class, lively' },
  { value: '6', label: '6 Train', color: '#00933C', description: 'Lexington Avenue Local', personality: 'The local, intimate, neighborhood feel' },
  { value: '7', label: '7 Train', color: '#B933AD', description: 'Flushing Local/Express', personality: 'International, Queens diversity, food, culture' },
  { value: 'A', label: 'A Train', color: '#0039A6', description: 'Eighth Avenue Express', personality: 'The legend, artsy, downtown cool, jazz vibe' },
  { value: 'C', label: 'C Train', color: '#0039A6', description: 'Eighth Avenue Local', personality: 'Local arts, Brooklyn neighborhoods, chill' },
  { value: 'E', label: 'E Train', color: '#0039A6', description: 'Eighth Avenue Local', personality: 'Queens to Manhattan, airport, diverse' },
  { value: 'B', label: 'B Train', color: '#FF6319', description: 'Sixth Avenue Express', personality: 'Express, midtown business, fast-paced' },
  { value: 'D', label: 'D Train', color: '#FF6319', description: 'Sixth Avenue Express', personality: 'Bronx to Brooklyn, gritty, authentic' },
  { value: 'F', label: 'F Train', color: '#FF6319', description: 'Sixth Avenue Local', personality: 'Brooklyn hip, Park Slope, creative' },
  { value: 'M', label: 'M Train', color: '#FF6319', description: 'Sixth Avenue Local', personality: 'Queens/Brooklyn connector, underdog' },
  { value: 'N', label: 'N Train', color: '#FCCC0A', description: 'Broadway Express', personality: 'Bright, theater district, tourist-friendly' },
  { value: 'Q', label: 'Q Train', color: '#FCCC0A', description: 'Broadway Express', personality: 'Second Avenue, modern, Upper East Side' },
  { value: 'R', label: 'R Train', color: '#FCCC0A', description: 'Broadway Local', personality: 'The workhorse, all boroughs, reliable' },
  { value: 'W', label: 'W Train', color: '#FCCC0A', description: 'Broadway Local', personality: 'Short run, dependable, local feel' },
  { value: 'J', label: 'J Train', color: '#996633', description: 'Nassau Street Express', personality: 'Historic, gritty, authentic NYC' },
  { value: 'Z', label: 'Z Train', color: '#996633', description: 'Nassau Street Express', personality: 'Runs express, skip some stations' },
  { value: 'G', label: 'G Train', color: '#6CBE45', description: 'Crosstown Local', personality: 'Brooklyn cross, hipster, local hero' },
  { value: 'L', label: 'L Train', color: '#A7A9AC', description: 'Canarsie Local', personality: 'Williamsburg cool, trendsetter, young energy' },
  { value: 'S', label: 'S Train', color: '#808183', description: 'Shuttle', personality: 'Short hop, tourists, transition' },
  { value: 'any', label: 'Any Line', color: '#808183', description: 'Random selection', personality: 'Surprise me with variety' },
];

export const LINE_PERSONALITIES: Record<SubwayLine, { vibe: string; typicalRiders: string[]; energy: 'fast' | 'moderate' | 'slow'; atmosphere: string }> = {
  '1': {
    vibe: 'The reliable workhorse',
    typicalRiders: ['Business professionals', 'Students', 'Local commuters'],
    energy: 'fast',
    atmosphere: 'Direct, no-nonsense, efficient',
  },
  '2': {
    vibe: 'The express explorer',
    typicalRiders: ['Bronx residents', 'Brooklynites', 'Express seekers'],
    energy: 'fast',
    atmosphere: 'Fast-moving, diverse crowd',
  },
  '3': {
    vibe: 'The cultural connector',
    typicalRiders: ['Harlem residents', 'Culture seekers', 'South Brooklyn locals'],
    energy: 'moderate',
    atmosphere: 'Energetic, diverse, cultural',
  },
  '4': {
    vibe: 'The power commuter',
    typicalRiders: ['Wall Street professionals', 'Doctors', 'Lawyers'],
    energy: 'fast',
    atmosphere: 'Crowded, ambitious, driven',
  },
  '5': {
    vibe: 'The working class hero',
    typicalRiders: ['Working class', ' Bronx residents', 'Budget commuters'],
    energy: 'moderate',
    atmosphere: 'Lively, diverse, practical',
  },
  '6': {
    vibe: 'The neighborhood local',
    typicalRiders: ['Upper East Siders', 'Local shoppers', 'Casual travelers'],
    energy: 'slow',
    atmosphere: 'Intimate, local feel, relaxed',
  },
  '7': {
    vibe: 'The international express',
    typicalRiders: ['Queens residents', 'Foodies', 'Airport travelers'],
    energy: 'moderate',
    atmosphere: 'Diverse, international, vibrant',
  },
  'A': {
    vibe: 'The legendary downtown',
    typicalRiders: ['Downtown creatives', 'Artists', 'Nightlife crowd'],
    energy: 'fast',
    atmosphere: 'Cool, artsy, jazz-infused',
  },
  'C': {
    vibe: 'The local arts line',
    typicalRiders: ['Brooklyn locals', 'Artists', 'Chill commuters'],
    energy: 'slow',
    atmosphere: 'Relaxed, artistic, neighborhood-focused',
  },
  'E': {
    vibe: 'The connector',
    typicalRiders: ['Queens workers', 'Midtown commuters', 'Airport travelers'],
    energy: 'moderate',
    atmosphere: 'Diverse, practical, reliable',
  },
  'B': {
    vibe: 'The express professional',
    typicalRiders: ['Midtown workers', 'Express seekers', 'Busy commuters'],
    energy: 'fast',
    atmosphere: 'Fast-paced, business-focused',
  },
  'D': {
    vibe: 'The gritty authentic',
    typicalRiders: ['Bronx to Brooklyn', 'Authentic NYC fans', 'Gritty vibe lovers'],
    energy: 'moderate',
    atmosphere: 'Gritty, real, unapologetic',
  },
  'F': {
    vibe: 'The creative connector',
    typicalRiders: ['Park Slope families', 'Artists', 'Creative professionals'],
    energy: 'moderate',
    atmosphere: 'Hip, family-friendly, creative',
  },
  'M': {
    vibe: 'The underdog',
    typicalRiders: ['Midtown to Brooklyn', 'Practical commuters', 'Efficient travelers'],
    energy: 'moderate',
    atmosphere: 'Underrated, reliable, practical',
  },
  'N': {
    vibe: 'The bright express',
    typicalRiders: ['Theater district regulars', 'Tourists', 'Bright personalities'],
    energy: 'moderate',
    atmosphere: 'Bright, fun, tourist-friendly',
  },
  'W': {
    vibe: 'The reliable local',
    typicalRiders: ['Astoria residents', 'Queens commuters', 'Dependable riders'],
    energy: 'moderate',
    atmosphere: 'Reliable, local, steady',
  },
  'Q': {
    vibe: 'The modern luxury',
    typicalRiders: ['Upper East Siders', 'Modern professionals', 'Second Avenue riders'],
    energy: 'moderate',
    atmosphere: 'Modern, upscale, smooth',
  },
  'R': {
    vibe: 'The workhorse',
    typicalRiders: ['All boroughs', 'Reliable commuters', 'Students'],
    energy: 'moderate',
    atmosphere: 'Reliable, all-purpose, dependable',
  },
  'J': {
    vibe: 'The historic line',
    typicalRiders: ['Jamaica residents', 'Historic NYC fans', 'Authentic borough riders'],
    energy: 'moderate',
    atmosphere: 'Historic, gritty, old-school NYC',
  },
  'Z': {
    vibe: 'The phantom express',
    typicalRiders: ['Express seekers', 'Rare sight', 'NYC transit enthusiasts'],
    energy: 'fast',
    atmosphere: 'Mysterious, rare, elusive',
  },
  'G': {
    vibe: 'The local hero',
    typicalRiders: ['Brooklyn crossers', 'Hipsters', 'Local Brooklyn riders'],
    energy: 'slow',
    atmosphere: 'Chill, local, Brooklyn pride',
  },
  'L': {
    vibe: 'The trendsetter',
    typicalRiders: ['Williamsburg residents', 'Trendsetters', 'Young professionals'],
    energy: 'moderate',
    atmosphere: 'Cool, trendy, young energy',
  },
  'S': {
    vibe: 'The short hopper',
    typicalRiders: ['Times Square shoppers', 'Tourists', 'Short-distance travelers'],
    energy: 'slow',
    atmosphere: 'Quick, simple, transitional',
  },
  'any': {
    vibe: 'The wildcard',
    typicalRiders: ['Adventurous riders', 'Transit enthusiasts', 'Surprise seekers'],
    energy: 'moderate',
    atmosphere: 'Surprising, varied, unpredictable',
  },
};

export const NEIGHBORHOOD_PERSONALITIES: Record<Neighborhood, NeighborhoodPersonality> = {
  soho: {
    neighborhood: 'soho',
    vibe: 'Trendy upscale',
    typicalPeople: ['Fashion professionals', 'Art gallery workers', 'Young professionals', 'Tourists'],
    atmosphere: 'Upscale, artistic, crowded but polished',
    visualCues: ['Cast-iron buildings', 'High-end boutiques', 'Cobblestone streets', 'Street art'],
  },
  harlem: {
    neighborhood: 'harlem',
    vibe: 'Cultural heartbeat',
    typicalPeople: ['Jazz musicians', 'Community activists', 'Longtime residents', 'Culture seekers'],
    atmosphere: 'Rich history, soulful energy, welcoming community',
    visualCues: ['Historic brownstones', 'Jazz club signage', 'Street vendors', 'Churches'],
  },
  williamsburg: {
    neighborhood: 'williamsburg',
    vibe: 'Hipster heaven',
    typicalPeople: ['Artists', 'Musicians', 'Foodies', 'Creative entrepreneurs'],
    atmosphere: 'Trendy, alternative, artistic energy',
    visualCues: ['Vintage shops', 'Street art', 'Craft breweries', 'Boutique coffee shops'],
  },
  fidi: {
    neighborhood: 'fidi',
    vibe: 'Financial powerhouse',
    typicalPeople: ['Wall Street traders', 'Corporate executives', 'Lawyers', 'Finance professionals'],
    atmosphere: 'Fast-paced, power suits, briefcase carrying, ambitious',
    visualCues: ['Skyscrapers', 'Stock tickers', 'Busy intersections', 'Suited professionals'],
  },
  times_square: {
    neighborhood: 'times_square',
    vibe: 'Tourist central',
    typicalPeople: ['Tourists', 'Performer hopefuls', 'Entertainment workers', 'Photo seekers'],
    atmosphere: 'Bustling, overwhelming, bright lights, energy overload',
    visualCues: ['Neon signs', 'Costumed characters', 'Tour groups', 'Broadway marquees'],
  },
  chelsea: {
    neighborhood: 'chelsea',
    vibe: 'Art district',
    typicalPeople: ['Gallery owners', 'Art collectors', 'High-end shoppers', 'Creative directors'],
    atmosphere: 'Sophisticated, artistic, polished',
    visualCues: ['Art galleries', 'High-end boutiques', 'The High Line', 'Modern architecture'],
  },
  east_village: {
    neighborhood: 'east_village',
    vibe: 'Counterculture roots',
    typicalPeople: ['Bohemians', 'Students', 'Artists', 'Bar regulars'],
    atmosphere: 'Gritty but gentrified, alternative history, diverse',
    visualCues: ['Bicycle messengers', 'Vintage shops', 'Dive bars', 'Ethnic restaurants'],
  },
};

export const STREET_LOCATIONS: { value: StreetLocation; label: string; description: string }[] = [
  { value: 'coffee_shop', label: 'Coffee Shop', description: 'Classic street interview location' },
  { value: 'park', label: 'Park', description: 'Central Park or neighborhood park' },
  { value: 'landmark', label: 'Landmark', description: 'Iconic NYC location' },
  { value: 'street_corner', label: 'Street Corner', description: 'Classic intersection' },
  { value: 'shopping_area', label: 'Shopping Area', description: 'Commercial district' },
];

export const STREET_FESTIVALS: { value: StreetFestival; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'street_fair', label: 'Street Fair' },
  { value: 'farmers_market', label: 'Farmers Market' },
  { value: 'art_walk', label: 'Art Walk' },
  { value: 'food_festival', label: 'Food Festival' },
  { value: 'parade', label: 'Parade' },
];

// Motivational enhancement constants
export const MOTIVATIONAL_MUSIC: { value: MotivationalMusicType; label: string; description: string }[] = [
  { value: 'epic_orchestral', label: 'Epic Orchestral', description: 'Full orchestra, building intensity' },
  { value: 'ambient_electronic', label: 'Ambient Electronic', description: 'Modern, atmospheric' },
  { value: 'piano_inspirational', label: 'Piano', description: 'Simple, emotional piano' },
  { value: 'rock_anthem', label: 'Rock Anthem', description: 'Guitar-driven energy' },
  { value: 'minimal', label: 'Minimal', description: 'Sparse, focused' },
];

export const ACHIEVEMENT_TYPES: { value: AchievementContextType; label: string; description: string }[] = [
  { value: 'championship', label: 'Championship', description: 'Sports victory context' },
  { value: 'award_ceremony', label: 'Award Ceremony', description: 'Recognition moment' },
  { value: 'graduation', label: 'Graduation', description: 'Academic achievement' },
  { value: 'grand_opening', label: 'Grand Opening', description: 'New venture launch' },
  { value: 'record_breaking', label: 'Record Breaking', description: 'Major achievement' },
  { value: 'comeback_victory', label: 'Comeback Victory', description: 'Triumph after struggle' },
  { value: 'lifetime_achievement', label: 'Lifetime Achievement', description: 'Legacy recognition' },
];

export const BREAKTHROUGH_TYPES: { value: BreakthroughType; label: string; description: string; emoji: string }[] = [
  { value: 'mic_drop', label: 'Mic Drop', description: 'Powerful closing statement', emoji: '🎤' },
  { value: 'mentor_appears', label: 'Mentor Appears', description: 'Unexpected guidance shows up', emoji: '👴' },
  { value: 'crowd_erupts', label: 'Crowd Erupts', description: 'Audience reaction peak', emoji: '👏' },
  { value: 'visual_metaphor', label: 'Visual Metaphor', description: 'Poignant visual moment', emoji: '🎬' },
  { value: 'silence_pregnant', label: 'Pregnant Silence', description: 'Meaningful pause', emoji: '🤫' },
  { value: 'camera_freeze', label: 'Camera Freeze', description: 'Dramatic freeze frame', emoji: '📸' },
  { value: 'lighting_shift', label: 'Lighting Shift', description: 'Atmospheric change', emoji: '💡' },
];

export const LIVE_CHALLENGE_TYPES: { value: LiveChallengeType; label: string; description: string; emoji: string }[] = [
  { value: 'stand_up', label: 'Stand Up', description: 'Audience participation', emoji: '🙋' },
  { value: 'raise_hand', label: 'Raise Hand', description: 'Virtual show of hands', emoji: '✋' },
  { value: 'hashtag_display', label: 'Hashtag', description: 'Social media engagement', emoji: '#️⃣' },
  { value: 'thirty_day_challenge', label: '30-Day Challenge', description: 'Commit to action', emoji: '📅' },
  { value: 'commitment_moment', label: 'Commitment', description: 'Personal pledge', emoji: '🤝' },
];

export const EVENT_PHASES: { value: EventPhase; label: string; description: string; emoji: string }[] = [
  { value: 'pre_event', label: 'Pre-Event', description: 'Building anticipation', emoji: '⏰' },
  { value: 'mid_event', label: 'Mid Event', description: 'Active participation', emoji: '🎯' },
  { value: 'peak_moment', label: 'Peak', description: 'Climax energy', emoji: '🔥' },
  { value: 'closing', label: 'Closing', description: 'Final moments', emoji: '🏁' },
];

export const TRANSFORMATION_SCENES: { value: TransformationScene; label: string; description: string }[] = [
  { value: 'before', label: 'Before', description: 'Starting state' },
  { value: 'during', label: 'During', description: 'Journey moment' },
  { value: 'after', label: 'After', description: 'Transformed state' },
];

export const AUDIENCE_REACTIONS: { value: 'cheering' | 'inspired' | 'moved' | 'energized' | 'contemplative'; label: string; emoji: string }[] = [
  { value: 'cheering', label: 'Cheering', emoji: '👏' },
  { value: 'inspired', label: 'Inspired', emoji: '✨' },
  { value: 'moved', label: 'Moved', emoji: '😭' },
  { value: 'energized', label: 'Energized', emoji: '⚡' },
  { value: 'contemplative', label: 'Contemplative', emoji: '🤔' },
];

export const CTA_PIVOT_TYPES: { value: CTAPivotType; label: string; description: string; emoji: string }[] = [
  { value: 'story_to_advice', label: 'Story to Advice', description: 'Narrative leads to guidance', emoji: '📖' },
  { value: 'write_this_down', label: 'Write This Down', description: 'Important takeaway moment', emoji: '✍️' },
  { value: 'final_challenge', label: 'Final Challenge', description: 'Call to action', emoji: '🎯' },
  { value: 'join_movement', label: 'Join Movement', description: 'Community building', emoji: '🤝' },
  { value: 'share_message', label: 'Share Message', description: 'Spread the word', emoji: '📢' },
];

export const PIVOT_DIRECTIONS: { value: PivotDirection; label: string; description: string }[] = [
  { value: 'deeper', label: 'Deeper', description: 'Explore topic more deeply' },
  { value: 'challenge', label: 'Challenge', description: 'Introduce opposing viewpoint' },
  { value: 'personal', label: 'Personal', description: 'Shift to personal experience' },
  { value: 'philosophical', label: 'Philosophical', description: 'Move to deeper meaning' },
  { value: 'comedic', label: 'Comedic', description: 'Add humor' },
];

export const CROSS_STREET_PIVOT_TYPES: { value: CrossStreetPivotType; label: string; description: string }[] = [
  { value: 'deeper', label: 'Deeper', description: 'Explore topic more deeply' },
  { value: 'challenge', label: 'Challenge', description: 'Introduce opposing viewpoint' },
  { value: 'personal', label: 'Personal', description: 'Shift to personal experience' },
  { value: 'philosophical', label: 'Philosophical', description: 'Move to deeper meaning' },
  { value: 'comedic', label: 'Comedic', description: 'Add humor' },
];

export const CROWD_REACTION_TYPES: { value: CrowdReactionType; label: string; emoji: string }[] = [
  { value: 'agree', label: 'Agree', emoji: '👍' },
  { value: 'disagree', label: 'Disagree', emoji: '👎' },
  { value: 'shocked', label: 'Shocked', emoji: '😱' },
  { value: 'amused', label: 'Amused', emoji: '😄' },
  { value: 'confused', label: 'Confused', emoji: '😕' },
  { value: 'neutral', label: 'Neutral', emoji: '😐' },
];

export const AMBIENT_SOUNDS: { value: AmbientSound; label: string }[] = [
  { value: 'train_rumble', label: 'Train Rumble' },
  { value: 'announcements', label: 'Announcements' },
  { value: 'footsteps', label: 'Footsteps' },
  { value: 'conversations', label: 'Conversations' },
  { value: 'turnstiles', label: 'Turnstiles' },
  { value: 'platform_buzzer', label: 'Platform Buzzer' },
];

export const SOUND_INTENSITIES: { value: 'faint' | 'present' | 'prominent'; label: string }[] = [
  { value: 'faint', label: 'Faint' },
  { value: 'present', label: 'Present' },
  { value: 'prominent', label: 'Prominent' },
];

export const PLOT_TWIST_TYPES: { value: PlotTwistType; label: string; description: string }[] = [
  { value: 'missed_connection', label: 'Missed Connection', description: 'Train cuts off key moment' },
  { value: 'stranger_interruption', label: 'Stranger Interruption', description: 'Random person jumps in' },
  { value: 'train_arrival_cut', label: 'Train Arrival', description: 'Dramatic cut at key moment' },
  { value: 'recognition_moment', label: 'Recognition', description: 'Subject recognizes interviewer' },
  { value: 'unexpected_exit', label: 'Unexpected Exit', description: 'Subject walks away' },
  { value: 'double_take', label: 'Double Take', description: 'Background reaction steals scene' },
  { value: 'phone_interruption', label: 'Phone Call', description: 'Call interrupts' },
  { value: 'none', label: 'None', description: 'No twist' },
];

export const POLL_QUESTION_TYPES: { value: 'agree_disagree' | 'this_or_that' | 'rating' | 'would_you_rather'; label: string }[] = [
  { value: 'agree_disagree', label: 'Agree/Disagree' },
  { value: 'this_or_that', label: 'This or That' },
  { value: 'rating', label: 'Rating' },
  { value: 'would_you_rather', label: 'Would You Rather' },
];

export const SEASON_OPTIONS: { value: Season; label: string }[] = [
  { value: 'spring', label: 'Spring' },
  { value: 'summer', label: 'Summer' },
  { value: 'fall', label: 'Fall' },
  { value: 'winter', label: 'Winter' },
];

export const WEATHER_OPTIONS: { value: WeatherCondition; label: string }[] = [
  { value: 'clear', label: 'Clear' },
  { value: 'rainy', label: 'Rainy' },
  { value: 'snowy', label: 'Snowy' },
  { value: 'humid', label: 'Humid' },
  { value: 'windy', label: 'Windy' },
];

export const HOLIDAY_OPTIONS: { value: HolidayTheme; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'christmas', label: 'Christmas' },
  { value: 'new_years', label: "New Year's" },
  { value: 'halloween', label: 'Halloween' },
  { value: 'thanksgiving', label: 'Thanksgiving' },
  { value: 'pride', label: 'Pride' },
  { value: 'summer_break', label: 'Summer Break' },
];

export const TRAIN_ARRIVAL_EFFECTS: { value: 'interrupt' | 'tension' | 'transition' | 'backdrop'; label: string }[] = [
  { value: 'interrupt', label: 'Interrupt' },
  { value: 'tension', label: 'Build Tension' },
  { value: 'transition', label: 'Transition' },
  { value: 'backdrop', label: 'Backdrop Only' },
];

export const URBAN_AMBIENT_SOUNDS: { value: UrbanAmbientSound; label: string }[] = [
  { value: 'traffic', label: 'Traffic' },
  { value: 'construction', label: 'Construction' },
  { value: 'street_performer', label: 'Street Performer' },
  { value: 'sirens', label: 'Sirens' },
  { value: 'pedestrians', label: 'Pedestrians' },
  { value: 'weather_audio', label: 'Weather' },
];

export const STREET_PLOT_TWIST_TYPES: { value: StreetPlotTwistType; label: string }[] = [
  { value: 'car_horn_interruption', label: 'Car Horn' },
  { value: 'dog_approaches', label: 'Dog Approaches' },
  { value: 'vendor_interruption', label: 'Vendor Interruption' },
  { value: 'friend_recognition', label: 'Friend Recognition' },
  { value: 'phone_call', label: 'Phone Call' },
  { value: 'someone_joins', label: 'Someone Joins' },
  { value: 'unexpected_weather', label: 'Weather Change' },
  { value: 'none', label: 'None' },
];

export const BYSTANDER_REACTION_TYPES: { value: BystanderReactionType; label: string; emoji: string }[] = [
  { value: 'curious', label: 'Curious', emoji: '🤔' },
  { value: 'amused', label: 'Amused', emoji: '😄' },
  { value: 'confused', label: 'Confused', emoji: '😕' },
  { value: 'agreeing', label: 'Agreeing', emoji: '👍' },
  { value: 'disagreeing', label: 'Disagreeing', emoji: '👎' },
  { value: 'recording', label: 'Recording', emoji: '📱' },
];

export const STREET_DRAMATIC_MOMENT_TYPES: { value: 'rain_starts' | 'sun_bursts' | 'train_passes_overhead' | 'door_reveals' | 'light_changes' | 'crowd_gathers'; label: string; description: string }[] = [
  { value: 'rain_starts', label: 'Rain Starts', description: 'Dramatic weather shift' },
  { value: 'sun_bursts', label: 'Sun Bursts', description: 'Golden hour breakthrough' },
  { value: 'train_passes_overhead', label: 'Train Overhead', description: 'Classic subway noise' },
  { value: 'door_reveals', label: 'Door Reveals', description: 'Someone enters/exits' },
  { value: 'light_changes', label: 'Light Changes', description: 'Shadow play moment' },
  { value: 'crowd_gathers', label: 'Crowd Gathers', description: 'People stop to watch' },
];

export const CROWD_DENSITY_OPTIONS: { value: 'sparse' | 'moderate' | 'dense'; label: string }[] = [
  { value: 'sparse', label: 'Sparse' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'dense', label: 'Dense' },
];

export const ENGAGEMENT_LEVELS: { value: 'passive' | 'reactive' | 'interactive'; label: string }[] = [
  { value: 'passive', label: 'Passive' },
  { value: 'reactive', label: 'Reactive' },
  { value: 'interactive', label: 'Interactive' },
];

// === NEW MISSING CONSTANTS ===

// Achievement Context Types
export const ACHIEVEMENT_CONTEXT_TYPES: { value: AchievementContextType; label: string; description: string }[] = [
  { value: 'championship', label: 'Championship', description: 'Winning moment or competition victory' },
  { value: 'award_ceremony', label: 'Award Ceremony', description: 'Recognition and achievement celebration' },
  { value: 'graduation', label: 'Graduation', description: 'Academic achievement milestone' },
  { value: 'grand_opening', label: 'Grand Opening', description: 'New venture or business launch' },
  { value: 'record_breaking', label: 'Record Breaking', description: 'Surpassing a personal or world record' },
  { value: 'comeback_victory', label: 'Comeback Victory', description: 'Triumph after adversity' },
  { value: 'lifetime_achievement', label: 'Lifetime Achievement', description: 'Long-term contributions and legacy' },
];

// Interviewer Positions (alias for SUBJECT_POSITIONS)
export const INTERVIEWER_POSITIONS: { value: InterviewerPosition; label: string; description: string }[] = [
  { value: 'holding_mic', label: 'Holding Mic', description: 'Classic interview framing' },
  { value: 'handheld_pov', label: 'Handheld POV', description: 'Documentary immersive feel' },
  { value: 'two_shot_visible', label: 'Two Shot', description: 'Both faces visible' },
  { value: 'over_shoulder', label: 'Over Shoulder', description: 'Focus on subject face' },
];

// Subway Stations (common NYC stations)
export const SUBWAY_STATIONS: { value: string; label: string; line: string }[] = [
  { value: 'times_square', label: 'Times Square', line: '1/2/3/7/N/Q/R/W/S' },
  { value: 'grand_central', label: 'Grand Central', line: '4/5/6/7/S' },
  { value: 'union_square', label: 'Union Square', line: '4/5/6/N/Q/R/W/L/M' },
  { value: 'port_authority', label: 'Port Authority', line: 'A/C/E/1/2/3/7' },
  { value: 'central_park', label: 'Central Park', line: '1/A/B/C' },
  { value: 'brooklyn_bridge', label: 'Brooklyn Bridge', line: '4/5/6/J/Z' },
  { value: 'fulton_street', label: 'Fulton Street', line: '2/3/4/5/A/C/J/Z' },
  { value: 'columbus_circle', label: 'Columbus Circle', line: '1/A/B/C/D' },
];

// Motivational Music Types
export const MOTIVATIONAL_MUSIC_TYPES: { value: MotivationalMusicType; label: string; description: string; emoji: string }[] = [
  { value: 'epic_orchestral', label: 'Epic Orchestral', description: 'Cinematic orchestral score', emoji: '🎼' },
  { value: 'ambient_electronic', label: 'Ambient Electronic', description: 'Atmospheric electronic beats', emoji: '🎧' },
  { value: 'piano_inspirational', label: 'Piano Inspirational', description: 'Uplifting piano melody', emoji: '🎹' },
  { value: 'rock_anthem', label: 'Rock Anthem', description: 'High energy rock track', emoji: '🎸' },
  { value: 'minimal', label: 'Minimal', description: 'Clean, focused soundscape', emoji: '🔇' },
];

// Neighborhoods
export const NEIGHBORHOODS: { value: Neighborhood; label: string; description: string }[] = [
  { value: 'soho', label: 'SoHo', description: 'Trendy shopping and cast-iron architecture' },
  { value: 'harlem', label: 'Harlem', description: 'Cultural hub with rich jazz history' },
  { value: 'williamsburg', label: 'Williamsburg', description: 'Hipster paradise with street art' },
  { value: 'fidi', label: 'FiDi', description: 'Financial district, modern skyscrapers' },
  { value: 'times_square', label: 'Times Square', description: 'The crossroads of the world' },
  { value: 'chelsea', label: 'Chelsea', description: 'Art galleries and the High Line' },
  { value: 'east_village', label: 'East Village', description: 'Bohemian vibe with diverse bars' },
];

// Speaker Archetypes
export const SPEAKER_ARCHETYPES: { value: SpeakerArchetype; label: string; description: string; emoji: string }[] = [
  { value: 'drill_sergeant', label: 'Drill Sergeant', description: 'Tough love, intense motivation', emoji: '🫡' },
  { value: 'tony_robbins', label: 'Tony Robbins', description: 'High-energy life coach style', emoji: '🔥' },
  { value: 'brene_brown', label: 'Brené Brown', description: 'Vulnerability and courage expert', emoji: '💛' },
  { value: 'gary_vee', label: 'Gary Vee', description: 'Hustle culture entrepreneur', emoji: '💎' },
  { value: 'oprah', label: 'Oprah', description: 'Empathetic, story-driven wisdom', emoji: '✨' },
  { value: 'eric_thomas', label: 'Eric Thomas', description: 'Former athlete turned motivator', emoji: '🏆' },
  { value: 'simon_sinek', label: 'Simon Sinek', description: 'Purpose-driven leadership expert', emoji: '🎯' },
];

// Topic Age Group Mapping
export const TOPIC_AGE_MAP: Record<string, AgeGroup[]> = {
  // Universal topics (all ages)
  'Friendship': ['all_ages', 'kids', 'teens', 'adults', 'older_adults'],
  'Kindness': ['all_ages', 'kids', 'teens', 'adults', 'older_adults'],
  'Learning': ['all_ages', 'kids', 'teens', 'adults', 'older_adults'],
  'Growth': ['all_ages', 'teens', 'adults', 'older_adults'],
  'Respect': ['all_ages', 'kids', 'teens', 'adults', 'older_adults'],
  'Honesty': ['all_ages', 'kids', 'teens', 'adults', 'older_adults'],
  'Courage': ['all_ages', 'kids', 'teens', 'adults', 'older_adults'],
  'Love': ['all_ages', 'teens', 'adults', 'older_adults'],
  'Family': ['all_ages', 'teens', 'adults', 'older_adults'],
  'Happiness': ['all_ages', 'kids', 'teens', 'adults', 'older_adults'],
  
  // Kids topics
  'School': ['kids', 'teens'],
  'Sports': ['kids', 'teens', 'adults', 'older_adults'],
  'Hobbies': ['all_ages', 'kids', 'teens', 'adults', 'older_adults'],
  'Sharing': ['kids'],
  'Imagination': ['kids'],
  'Play': ['kids'],
  'Dreams': ['kids', 'teens', 'adults', 'older_adults'],
  'Teamwork': ['kids', 'teens', 'adults'],
  
  // Teen topics
  'Dating': ['teens', 'adults', 'older_adults'],
  'Social Media': ['teens', 'adults'],
  'Mental Health': ['teens', 'adults', 'older_adults'],
  'Future': ['teens', 'adults', 'older_adults'],
  'Self Confidence': ['teens', 'adults', 'older_adults'],
  'College': ['teens', 'adults'],
  'Music': ['all_ages', 'teens', 'adults', 'older_adults'],
  
  // Adult topics
  'Career': ['adults', 'older_adults'],
  'Money': ['adults', 'older_adults'],
  'Relationships': ['adults', 'older_adults'],
  'Marriage': ['adults', 'older_adults'],
  'Parenting': ['adults', 'older_adults'],
  'Home': ['adults', 'older_adults'],
  'Work Life Balance': ['adults', 'older_adults'],
  'Health': ['adults', 'older_adults'],
  'Success': ['adults', 'older_adults'],
  'Philosophy': ['adults', 'older_adults'],
  'Life Advice': ['adults', 'older_adults'],
  
  // Older adult topics
  'Retirement': ['older_adults'],
  'Legacy': ['older_adults'],
  'Wisdom': ['older_adults'],
  'Purpose': ['older_adults'],
  'Freedom': ['older_adults'],
  'Gratitude': ['older_adults'],
  'Life Lessons': ['older_adults'],
  
  // Subway-specific topics
  'Hydration Myths': ['teens', 'adults', 'older_adults'],
  'Coffee Culture': ['adults', 'older_adults'],
  'Sleep Schedules': ['teens', 'adults', 'older_adults'],
  'NYC Rent': ['adults', 'older_adults'],
  'Work From Home': ['adults', 'older_adults'],
  
  // Wisdom topics
  'Regrets': ['older_adults'],
  'Boundaries': ['adults', 'older_adults'],
  'Scams': ['older_adults'],
  'Healthcare': ['older_adults'],
  'Loneliness': ['older_adults'],
  'Second Marriages': ['older_adults'],
  'Empty Nest': ['older_adults'],
  'Late Career': ['older_adults'],
  'Mentorship': ['older_adults'],
  'Reinvention': ['older_adults'],
  'Patience': ['older_adults'],
  'Forgiveness': ['older_adults'],
  'Acceptance': ['older_adults'],
  'Hope': ['older_adults'],
  'Peace': ['older_adults'],
  'Joy': ['older_adults'],
  'Contentment': ['older_adults'],
  'Humility': ['older_adults'],
  'Generosity': ['older_adults'],
  'Compassion': ['older_adults'],
  'Faith': ['older_adults'],
  'Spirituality': ['older_adults'],
  'Community': ['older_adults'],
  'Grandchildren': ['older_adults'],
  'Aging': ['older_adults'],
  'Change': ['older_adults'],
  'Loss': ['older_adults'],
  'Recovery': ['older_adults'],
  'Beginnings': ['older_adults'],
  'Endings': ['older_adults'],
  'Balance': ['older_adults'],
  'Simplicity': ['older_adults'],
  'Memory': ['older_adults'],
  'Nostalgia': ['older_adults'],
  'Tradition': ['older_adults'],
  'Trust': ['older_adults'],
  'Communication': ['older_adults'],
  'Listening': ['older_adults'],
  'Understanding': ['older_adults'],
};

// Mode Age Group Rules
export const MODE_AGE_RULES: { mode: InterviewMode; allowedAgeGroups: AgeGroup[]; requiresParentalGuidance: boolean; description: string }[] = [
  { mode: 'hot_take_challenge', allowedAgeGroups: ['adults', 'older_adults'], requiresParentalGuidance: true, description: 'Controversial opinions may contain mature themes' },
  { mode: 'rapid_fire_round', allowedAgeGroups: ['all_ages', 'kids', 'teens', 'adults', 'older_adults'], requiresParentalGuidance: false, description: 'Quick questions, family friendly' },
  { mode: 'deep_dive_interview', allowedAgeGroups: ['teens', 'adults', 'older_adults'], requiresParentalGuidance: false, description: 'Thoughtful discussion suitable for older audiences' },
  { mode: 'myth_busters', allowedAgeGroups: ['all_ages', 'kids', 'teens', 'adults', 'older_adults'], requiresParentalGuidance: false, description: 'Debunking common beliefs' },
  { mode: 'would_you_rather', allowedAgeGroups: ['kids', 'teens', 'adults', 'older_adults'], requiresParentalGuidance: true, description: 'Choice-based scenarios, some content may require guidance' },
  { mode: 'story_time', allowedAgeGroups: ['all_ages', 'kids', 'teens', 'adults', 'older_adults'], requiresParentalGuidance: false, description: 'Narrative personal stories' },
  { mode: 'unpopular_opinion', allowedAgeGroups: ['adults', 'older_adults'], requiresParentalGuidance: true, description: 'Controversial stances, mature content possible' },
  { mode: 'roast_me', allowedAgeGroups: ['adults', 'older_adults'], requiresParentalGuidance: true, description: 'Self-deprecating humor, may contain mature themes' },
  { mode: 'truth_or_dare_style', allowedAgeGroups: ['teens', 'adults', 'older_adults'], requiresParentalGuidance: true, description: 'Risk/reveal format, guidance recommended' },
  { mode: 'expert_take', allowedAgeGroups: ['all_ages', 'kids', 'teens', 'adults', 'older_adults'], requiresParentalGuidance: false, description: 'Authority perspective on trending topics' },
  { mode: 'none', allowedAgeGroups: ['all_ages', 'kids', 'teens', 'adults', 'older_adults'], requiresParentalGuidance: false, description: 'Classic interview format' },
];

// Filter topics by age group
export function filterTopicsByAge(topics: string[], ageGroup: AgeGroup): string[] {
  return topics.filter(topic => {
    const allowedGroups = TOPIC_AGE_MAP[topic];
    return allowedGroups && (allowedGroups.includes(ageGroup) || allowedGroups.includes('all_ages'));
  });
}

// Filter modes by age group
export function filterModesByAge(modes: { value: InterviewMode; label: string; description: string; emoji: string }[], ageGroup: AgeGroup): typeof modes {
  return modes.filter(mode => {
    const rule = MODE_AGE_RULES.find(r => r.mode === mode.value);
    return rule && (rule.allowedAgeGroups.includes(ageGroup) || rule.allowedAgeGroups.includes('all_ages'));
  });
}

// ============================================================================
// CITY-SPECIFIC TRANSIT CARD TYPES
// ============================================================================

// Maps city style to authentic transit card type
export const CITY_TRANSIT_CARDS: Record<CityStyle, TransitCardType> = {
  nyc: 'metrocard',
  london: 'oyster',
  tokyo: 'suica',
  paris: 'navigo',
  generic: 'generic',
  custom: 'generic',
};

// Transit card descriptions for UI and prompts
export const CARD_DESCRIPTIONS: Record<TransitCardType, string> = {
  metrocard: 'NYC MetroCard - rectangular white plastic card with blue/orange stripe',
  oyster: 'London Oyster - distinctive brown rounded rectangular card with contactless symbol',
  suica: 'Tokyo Suica/ICOCA - thin RFID card with cartoon character branding',
  navigo: 'Paris Navigo - rectangular card with weekly/monthly pass display window',
  octopus: 'Hong Kong Octopus - orange-themed card with wave logo design',
  ezlink: 'Singapore EZ-Link - colorful card with heritage Singapore imagery',
  ventra: 'Chicago Ventra - modern blue/white card with contactless payment',
  clipper: 'San Francisco Clipper - navy blue card with Golden Gate bridge logo',
  presto: 'Toronto Presto - distinctive red and white card design',
  generic: 'Generic transit card - plain rectangular card without prominent branding',
};

// City-specific card visual anchors for prompts
export const CARD_VISUAL_ANCHORS: Record<TransitCardType, string[]> = {
  metrocard: [
    'Interviewer holds MetroCard by the edge, tapping it against fare reader',
    'Card is visible in hand, showing the blue/orange stripe',
    'Casual NYC commuter gesture with the card',
  ],
  oyster: [
    'Interviewer shows Oyster card in palm, ready to tap',
    'Brown rounded card clearly visible between fingers',
    'Iconic London Underground gesture with the card',
  ],
  suica: [
    'Interviewer holds Suica card between thumb and finger',
    'Quick tap motion typical of Japanese transit users',
    'Card shows cute character design (if applicable)',
  ],
  navigo: [
    'Interviewer displays Navigo card showing pass window',
    'Card held to show the weekly/monthly validation strip',
    'Classic French transit card handling',
  ],
  octopus: [
    'Interviewer shows Octopus card with wave logo',
    'Orange card prominently displayed',
    'Hong Kong transit style card gesture',
  ],
  ezlink: [
    'Interviewer holds EZ-Link card with Singapore imagery',
    'Colorful card visible in frame',
    'Southeast Asian transit card handling',
  ],
  ventra: [
    'Interviewer displays Ventra card with Chicago skyline hint',
    'Modern blue/white card design visible',
    'Midwest transit card style',
  ],
  clipper: [
    'Interviewer shows Clipper card with Golden Gate logo',
    'Navy blue card prominently displayed',
    'Bay Area transit card gesture',
  ],
  presto: [
    'Interviewer holds Presto card with distinctive red/white design',
    'Ontario transit card handling',
    'Canadian transit card gesture',
  ],
  generic: [
    'Interviewer holds plain rectangular transit card',
    'Card used as microphone without specific branding',
    'Generic transit card or single-ride ticket',
  ],
};

// Helper to get card description for UI
export function getCardDescriptionForCity(cityStyle: CityStyle): string {
  const cardType = CITY_TRANSIT_CARDS[cityStyle];
  return CARD_DESCRIPTIONS[cardType];
}

// Helper to get card type for a city
export function getTransitCardForCity(cityStyle: CityStyle): TransitCardType {
  return CITY_TRANSIT_CARDS[cityStyle];
}
