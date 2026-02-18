export type ClipType = 'motivational' | 'street_interview' | 'subway_interview' | 'studio_interview' | 'wisdom_interview';

// Interview Modes - 10 viral interview modes
export type InterviewMode =
  | 'hot_take_challenge'
  | 'rapid_fire_round'
  | 'deep_dive_interview'
  | 'myth_busters'
  | 'would_you_rather'
  | 'story_time'
  | 'unpopular_opinion'
  | 'roast_me'
  | 'truth_or_dare_style'
  | 'expert_take'
  | 'none';

// SubwayTakes-style Debate Loop Settings
export type DebateStance = 'auto' | 'always_agree' | 'always_disagree';
export type DebateDepth = 'light' | 'medium' | 'spicy';
export type DebateResolution = 'agreement' | 'agree_to_disagree' | 'twist';

export interface DebateLoopConfig {
  format: 'take_discussion';
  stance: DebateStance;
  depth: DebateDepth;
  replies: number; // 1-3
  resolution: DebateResolution;
}

// SubwayTakes-style Script Structure
export interface SubwayTakeScript {
  hook: string; // "What's your take? ..."
  beats: SubwayTakeBeat[];
  ending: string; // punch + CTA
  meta: {
    estimatedDuration: number;
    captionEmphasis: string[];
    editTiming: EditTimingCue[];
  };
}

export type SubwayTakeBeatType = 'take' | 'interviewer_reaction' | 'discussion';

export interface SubwayTakeBeat {
  type: SubwayTakeBeatType;
  speaker: 'interviewee' | 'interviewer';
  line: string;
  caption: string;
  stance?: 'agree' | 'disagree';
}

export interface EditTimingCue {
  timestamp: number; // seconds from start
  type: 'hook' | 'take' | 'reaction' | 'discussion' | 'punch';
  cameraDirection: CameraDirection;
  zoomLevel?: 'normal' | 'punch_in';
}

export type CaptionStyle = 'burn_in' | 'auto_captions';
export interface CaptionConfig {
  style: CaptionStyle;
  emphasizePhrases: string[];
  maxWordsPerLine: number;
  timingOffset: number;
}

// Beats Schema - Conversation Flow
export type BeatType = 'take' | 'reaction' | 'discussion';

export type EmotionalTone =
  | 'neutral'
  | 'excited'
  | 'shocked'
  | 'thoughtful'
  | 'defensive'
  | 'aggressive'
  | 'playful'
  | 'sincere'
  | 'sarcastic'
  | 'passionate';

export interface Beat {
  id: string;
  type: BeatType;
  speaker: 'host' | 'guest';
  content: string;
  duration: number;
  emotionalTone: EmotionalTone;
  cameraDirection: CameraDirection;
}

export interface ConversationBeats {
  beats: Beat[];
  totalDuration: number;
  viralHooks: string[];
}

// Viral Scoring System
export interface ViralScore {
  overall: number;
  components: {
    hookStrength: number;
    emotionalArc: number;
    shareability: number;
    replayValue: number;
    commentBait: number;
  };
  suggestions: string[];
}

// Token-Based Subscription System
export type SubscriptionTier = 'free' | 'creator' | 'pro' | 'studio';

export interface TokenBalance {
  userId: string;
  monthlyTokens: number;
  purchasedTokens: number;
  usedThisMonth: number;
  lastResetDate: string;
}

export interface TokenTransaction {
  id: string;
  userId: string;
  type: 'monthly_allocation' | 'purchase' | 'usage' | 'refund';
  amount: number;
  description: string;
  clipId?: string;
  createdAt: string;
}

// Spicier Reroll System
export type RerollIntensity = 'mild' | 'medium' | 'spicy' | 'nuclear';

export interface RerollOptions {
  intensity: RerollIntensity;
  preserveElements: {
    topic: boolean;
    setting: boolean;
    characters: boolean;
    duration: boolean;
  };
  enhanceElements: {
    energy: boolean;
    controversy: boolean;
    humor: boolean;
    emotion: boolean;
  };
}

// Studio Interview Specific Types
export type StudioSetup =
  | 'podcast_desk'
  | 'living_room'
  | 'minimalist_stage'
  | 'late_night'
  | 'roundtable'
  | 'fireside'
  | 'news_desk'
  | 'creative_loft';

export type StudioLighting =
  | 'three_point'
  | 'dramatic_key'
  | 'soft_diffused'
  | 'colored_accent'
  | 'natural_window'
  | 'cinematic';

export interface StudioOptions {
  setup: StudioSetup;
  lighting: StudioLighting;
  background: string;
  guestCount: number;
  branded: boolean;
}

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

// Transit card types - maps to city for authentic card mic visuals
export type TransitCardType =
  | 'metrocard'        // NYC
  | 'oyster'           // London
  | 'suica'            // Tokyo
  | 'navigo'           // Paris
  | 'octopus'          // Hong Kong
  | 'ezlink'           // Singapore
  | 'ventra'           // Chicago
  | 'clipper'          // San Francisco
  | 'presto'           // Toronto
  | 'generic';         // Default

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
  | 'storytelling'
  | 'unpopular_opinion'
  | 'exposed_callout'
  | 'red_flag_detector'
  | 'hot_take_react'
  | 'confessions'
  | 'before_after_story'
  | 'finish_sentence'
  | 'one_piece_advice'
  | 'would_you_rather'
  | 'street_quiz';

// Interview Format - How the interview appears visually
export type InterviewFormat =
  | 'solo'
  | 'face_to_face'
  | 'reporter_style'
  | 'full_body'
  | 'pov_interviewer'
  | 'group';

// Video Length Configuration
export type DurationPreset =
  | 'hook'        // 8-15s
  | 'quick'       // 15-30s
  | 'standard'    // 30-60s
  | 'deep'        // 60-90s
  | 'long_form';  // 90-160s

export interface DurationConfig {
  targetSeconds: number; // 8-160
  preset: DurationPreset;
  clipStrategy: 'auto' | 'short_first' | 'long_build' | 'balanced';
  pacingStyle: 'fast' | 'normal' | 'slow';
}

// Product Placement Configuration
export interface ProductPlacementConfig {
  enabled: boolean;
  productName: string;
  productDescription: string;
  callToAction: string;
  placementStyle: 'subtle' | 'moderate' | 'prominent';
  integrationType: 'end_card' | 'natural_mention' | 'demonstration';
  offerCode?: string;
  affiliateLink?: string;
}

// Multi-Language Support
export type SupportedLanguage =
  | 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt'
  | 'zh' | 'ja' | 'ko' | 'hi' | 'ar' | 'ru';

// Caption Style Configuration
export interface CaptionStyleConfig {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  textColor: string;
  backgroundColor: string;
  backgroundOpacity: number;
  position: 'bottom' | 'center' | 'top';
  animationStyle: 'static' | 'pop' | 'slide' | 'typewriter' | 'karaoke';
  highlightWords: { word: string; color: string }[];
}

// Platform Export
export type ExportPlatform =
  | 'tiktok'
  | 'instagram_reel'
  | 'youtube_shorts'
  | 'instagram_post'
  | 'facebook'
  | 'youtube';

export interface ExportConfig {
  platform: ExportPlatform;
  includeCaptions: boolean;
  captionStyleId?: string;
  quality: 'draft' | 'standard' | 'high' | '4k';
}

// Niche Category
export type NicheCategory =
  | 'money' | 'business' | 'fitness' | 'relationships'
  | 'crypto' | 'motivation' | 'local_services' | 'personal_brand'
  | 'tech' | 'health' | 'education' | 'entertainment'
  | 'food' | 'travel' | 'fashion' | 'gaming';

// Keyword-to-Viral Configuration
export interface KeywordConfig {
  keyword: string;
  topicDepth: 'surface' | 'moderate' | 'deep';
  tone: 'casual' | 'professional' | 'controversial' | 'humorous';
  niche: NicheCategory;
}

export interface GeneratedInterview {
  id: string;
  keyword: string;
  topic: string;
  questions: string[];
  suggestedAnswers: string[];
  estimatedDuration: number;
  viralScore: number;
  talkingPoints: string[];
}

export type TimeOfDay =
  | 'early_morning'      // 5AM - quiet, sleepy, early commuters
  | 'morning_rush'       // 7-9AM - packed, hurried, coffee-fueled
  | 'midday'
  | 'evening_rush'       // 5-7PM - tired, heading home, social
  | 'late_night'         // 11PM+ - empty, mysterious, night owls
  | 'weekend'            // Relaxed, tourists, different energy
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
  | 'wisdom_seeker'
  | 'wisdom_mentor'
  | 'life_lessons'
  | 'grandparent_wisdom'
  | 'custom';

// === SUBWAY ENHANCEMENT TYPES ===

// 1. Multi-Stop Journey Mode
export interface JourneyStop {
  id: string;
  stationName: string;
  line: SubwayLine;
  sceneType: SubwaySceneType;
  duration: number; // seconds at this stop
  narrativePurpose: 'hook' | 'development' | 'climax' | 'resolution';
  question?: string;
}

export interface MultiStopJourney {
  enabled: boolean;
  stops: JourneyStop[];
  totalDuration: number;
  narrativeArc: 'discovery' | 'debate' | 'transformation' | 'mystery';
}

// 2. Crowd Reaction Integration
export type CrowdReactionType = 'agree' | 'disagree' | 'shocked' | 'amused' | 'confused' | 'neutral';

export interface CrowdReaction {
  id: string;
  type: CrowdReactionType;
  intensity: 'subtle' | 'noticeable' | 'dramatic';
  timing: number; // seconds into clip
  description: string;
}

export interface CrowdReactionConfig {
  enabled: boolean;
  reactions: CrowdReaction[];
  density: 'sparse' | 'moderate' | 'dense';
  engagement: 'passive' | 'reactive' | 'interactive';
}

// 3. Subway Soundscape Designer
export type AmbientSound = 'train_rumble' | 'announcements' | 'footsteps' | 'conversations' | 'turnstiles' | 'platform_buzzer';
export type SoundIntensity = 'faint' | 'present' | 'prominent';

export interface SoundscapeLayer {
  sound: AmbientSound;
  intensity: SoundIntensity;
  timing?: 'continuous' | 'intermittent' | 'punctual';
}

export interface SoundscapeConfig {
  enabled: boolean;
  layers: SoundscapeLayer[];
  musicMood?: 'tense' | 'curious' | 'light' | 'dramatic' | 'none';
}

// 4. The "Missed Connection" Twist
export type PlotTwistType = 
  | 'missed_connection'      // Someone catches the train, interview ends abruptly
  | 'stranger_interruption'  // Random person jumps in with opinion
  | 'train_arrival_cut'      // Train arrival cuts off key moment
  | 'recognition_moment'     // Interviewee recognizes interviewer
  | 'unexpected_exit'        // Subject walks away mid-sentence
  | 'double_take'            // Someone in background reacts strongly
  | 'phone_interruption'     // Call/text interrupts
  | 'none';

export interface PlotTwist {
  type: PlotTwistType;
  timing: number; // seconds into clip (typically 60-80% through)
  description: string;
  impact: 'comedic' | 'dramatic' | 'awkward' | 'intriguing';
}

// 5. Time-of-Day Mood Shifter (already expanded TimeOfDay above)

// 6. The "Platform Poll" Feature
export type PollQuestionType = 'agree_disagree' | 'this_or_that' | 'rating' | 'would_you_rather';

export interface PlatformPoll {
  enabled: boolean;
  question: string;
  pollType: PollQuestionType;
  responses: {
    option: string;
    commuterCount: number;
    reaction: string;
  }[];
  showResults: boolean;
}

// 7. Subway Line Personality Matching
export type SubwayLine = 
  | '1' | '2' | '3'      // Broadway-Seventh Avenue (red) - Fast, direct, business
  | '4' | '5' | '6'      // Lexington Avenue (green) - Crowded, diverse, energy
  | '7'                  // Flushing (purple) - International, Queens vibe
  | 'A' | 'C' | 'E'      // Eighth Avenue (blue) - Artsy, downtown, cool
  | 'B' | 'D' | 'F' | 'M' // Sixth Avenue (orange) - Express, busy, midtown
  | 'N' | 'Q' | 'R' | 'W' // Broadway (yellow) - Bright, theater district, tourist
  | 'G'                  // Crosstown (light green) - Brooklyn, hipster, local
  | 'J' | 'Z'            // Nassau Street (brown) - Historic, gritty, authentic
  | 'L'                  // Canarsie (gray) - Trendy, Williamsburg, young
  | 'S'                  // Shuttle - Tourist, transition, brief
  | 'any';

export interface LinePersonality {
  line: SubwayLine;
  vibe: string;
  typicalRiders: string[];
  energy: 'fast' | 'moderate' | 'slow';
  atmosphere: string;
}

// 8. The "Train Arrival" Dramatic Pause
export interface TrainArrivalMoment {
  enabled: boolean;
  timing: 'early' | 'mid' | 'late' | 'climax';
  effect: 'interrupt' | 'tension' | 'transition' | 'backdrop';
  line?: SubwayLine;
  direction?: 'downtown' | 'uptown' | 'brooklyn' | 'queens' | 'bronx';
}

// 9. Seasonal/Event-Based Context
export type Season = 'spring' | 'summer' | 'fall' | 'winter';
export type WeatherCondition = 'clear' | 'rainy' | 'snowy' | 'humid' | 'windy';
export type HolidayTheme = 'none' | 'christmas' | 'new_years' | 'halloween' | 'thanksgiving' | 'pride' | 'summer_break';
export type CityEvent = 'none' | 'marathon' | 'fashion_week' | 'sports_playoffs' | 'concert' | 'protest' | 'election';

export interface SeasonalContext {
  enabled: boolean;
  season: Season;
  weather: WeatherCondition;
  holiday?: HolidayTheme;
  cityEvent?: CityEvent;
  decorations: boolean;
  crowdAttire: 'summer_light' | 'winter_coats' | 'rain_gear' | 'business_as_usual';
}

// 10. The "Transfer Point" Pivot
export type PivotDirection = 'deeper' | 'challenge' | 'personal' | 'philosophical' | 'comedic';

export interface TransferPoint {
  enabled: boolean;
  triggerStation: string;
  newLine?: SubwayLine;
  pivotType: PivotDirection;
  newQuestion: string;
  transitionPhrase: string;
}

// Combined Subway Enhancement Config
export interface SubwayEnhancementConfig {
  multiStopJourney?: MultiStopJourney;
  crowdReactions?: CrowdReactionConfig;
  soundscape?: SoundscapeConfig;
  plotTwist?: PlotTwist;
  platformPoll?: PlatformPoll;
  subwayLine?: SubwayLine;
  trainArrival?: TrainArrivalMoment;
  seasonalContext?: SeasonalContext;
  transferPoint?: TransferPoint;
}

// === STREET INTERVIEW ENHANCEMENT TYPES ===

// 1. Multi-Location Journey
export type StreetLocation = 'coffee_shop' | 'park' | 'landmark' | 'street_corner' | 'shopping_area';

export interface StreetJourneyStop {
  id: string;
  location: StreetLocation;
  locationName: string;
  duration: number;
  narrativePurpose: 'hook' | 'development' | 'climax' | 'resolution';
  question?: string;
  transitionType: 'walking' | 'cut' | 'fade';
}

export interface StreetMultiLocationJourney {
  enabled: boolean;
  stops: StreetJourneyStop[];
  totalDuration: number;
  narrativeArc: 'discovery' | 'debate' | 'transformation' | 'cultural_exploration';
}

// 2. Street Crowd Dynamics
export type BystanderReactionType = 'curious' | 'amused' | 'confused' | 'agreeing' | 'disagreeing' | 'recording';

export interface BystanderReaction {
  id: string;
  type: BystanderReactionType;
  intensity: 'subtle' | 'noticeable' | 'dramatic';
  timing: number;
  description: string;
}

export interface StreetCrowdConfig {
  enabled: boolean;
  reactions: BystanderReaction[];
  density: 'sparse' | 'moderate' | 'dense';
  engagement: 'passive' | 'reactive' | 'interactive';
  authorityFigureNearby?: boolean;
}

// 3. Urban Soundscape
export type UrbanAmbientSound = 'traffic' | 'construction' | 'street_performer' | 'sirens' | 'pedestrians' | 'weather_audio';

export interface UrbanSoundscapeLayer {
  sound: UrbanAmbientSound;
  intensity: SoundIntensity;
  timing?: 'continuous' | 'intermittent' | 'punctual';
}

export interface UrbanSoundscapeConfig {
  enabled: boolean;
  layers: UrbanSoundscapeLayer[];
  weatherAudio?: boolean;
}

// 4. Street Plot Twists
export type StreetPlotTwistType =
  | 'car_horn_interruption'
  | 'dog_approaches'
  | 'vendor_interruption'
  | 'friend_recognition'
  | 'phone_call'
  | 'someone_joins'
  | 'unexpected_weather'
  | 'none';

export interface StreetPlotTwist {
  type: StreetPlotTwistType;
  timing: number;
  description: string;
  impact: 'comedic' | 'dramatic' | 'awkward' | 'intriguing';
}

// 5. Time-of-Day Street Energy (uses existing TimeOfDay type)
export interface StreetTimeContext {
  timeOfDay: TimeOfDay;
  crowdType: 'commuters' | 'tourists' | 'locals' | 'mixed';
  energy: 'sleepy' | 'hurried' | 'relaxed' | 'bustling' | 'nightlife';
}

// 6. Street Poll
export interface StreetPoll {
  enabled: boolean;
  question: string;
  pollType: PollQuestionType;
  responses: {
    option: string;
    passerbyCount: number;
    reaction: string;
  }[];
  showResults: boolean;
  visualStyle: 'bar_chart' | 'pie_chart' | 'tally' | 'emoji_reactions';
}

// 7. Neighborhood Personality
export type Neighborhood =
  | 'soho'
  | 'harlem'
  | 'williamsburg'
  | 'fidi'
  | 'times_square'
  | 'chelsea'
  | 'east_village';

export interface NeighborhoodPersonality {
  neighborhood: Neighborhood;
  vibe: string;
  typicalPeople: string[];
  atmosphere: string;
  visualCues: string[];
}

// 8. Environmental Dramatic Moments
export type StreetDramaticMomentType =
  | 'rain_starts'
  | 'sun_bursts'
  | 'train_passes_overhead'
  | 'door_reveals'
  | 'light_changes'
  | 'crowd_gathers';

export interface StreetDramaticMoment {
  enabled: boolean;
  momentType: StreetDramaticMomentType;
  timing: number;
  description: string;
  effect: 'visual' | 'audio' | 'both';
}

// 9. Seasonal/Cultural Context for Street
export type StreetFestival = 'none' | 'street_fair' | 'farmers_market' | 'art_walk' | 'food_festival' | 'parade';

export interface StreetSeasonalContext {
  enabled: boolean;
  season: Season;
  weather: WeatherCondition;
  festival?: StreetFestival;
  holidayDecorations?: HolidayTheme;
  sportingEvent?: boolean;
  crowdAttire: 'summer_light' | 'winter_coats' | 'rain_gear' | 'business_as_usual';
}

// 10. Cross-Street Pivot
export type CrossStreetPivotType = 'deeper' | 'challenge' | 'personal' | 'philosophical' | 'comedic';

export interface CrossStreetPivot {
  enabled: boolean;
  triggerLocation: string;
  pivotType: CrossStreetPivotType;
  newQuestion: string;
  transitionPhrase: string;
}

// Combined Street Enhancement Config
export interface StreetEnhancementConfig {
  multiLocationJourney?: StreetMultiLocationJourney;
  crowdDynamics?: StreetCrowdConfig;
  urbanSoundscape?: UrbanSoundscapeConfig;
  plotTwist?: StreetPlotTwist;
  streetPoll?: StreetPoll;
  neighborhood?: Neighborhood;
  dramaticMoment?: StreetDramaticMoment;
  seasonalContext?: StreetSeasonalContext;
  crossStreetPivot?: CrossStreetPivot;
}

// === MOTIVATIONAL ENHANCEMENT TYPES ===

// 1. Multi-Scene Transformation Arc
export type TransformationScene = 'before' | 'during' | 'after';

export interface TransformationSceneConfig {
  scene: TransformationScene;
  duration: number;
  visualStyle: string;
  emotionalTone: string;
}

export interface TransformationArc {
  enabled: boolean;
  scenes: TransformationSceneConfig[];
  narrativeArc: 'struggle_to_triumph' | 'doubt_to_confidence' | 'failure_to_success' | 'ordinary_to_extraordinary';
  visualProgression: 'subtle' | 'dramatic' | 'cinematic';
}

// 2. Audience Energy Response
export type AudienceReactionType = 'cheering' | 'inspired' | 'moved' | 'energized' | 'contemplative';

export interface AudienceMoment {
  id: string;
  type: AudienceReactionType;
  timing: number;
  intensity: 'subtle' | 'moderate' | 'intense';
  description: string;
}

export interface AudienceEnergyConfig {
  enabled: boolean;
  moments: AudienceMoment[];
  showCrowd: boolean;
  showIndividualReactions: boolean;
  standingOvation: boolean;
}

// 3. Motivational Soundscape
export type MotivationalMusicType = 'epic_orchestral' | 'ambient_electronic' | 'piano_inspirational' | 'rock_anthem' | 'minimal';

export interface MotivationalSoundscapeConfig {
  enabled: boolean;
  musicType: MotivationalMusicType;
  musicIntensity: 'background' | 'building' | 'peak';
  silenceMoments: number[]; // timestamps for strategic silence
  crowdSounds: boolean;
}

// 4. Breakthrough Moment
export type BreakthroughType =
  | 'mic_drop'
  | 'mentor_appears'
  | 'crowd_erupts'
  | 'visual_metaphor'
  | 'silence_pregnant'
  | 'camera_freeze'
  | 'lighting_shift';

export interface BreakthroughMoment {
  enabled: boolean;
  type: BreakthroughType;
  timing: number;
  description: string;
  impact: 'subtle' | 'powerful' | 'transformative';
}

// 5. Event Energy Arc
export type EventPhase = 'pre_event' | 'mid_event' | 'peak_moment' | 'closing';

export interface EventEnergyArcConfig {
  enabled: boolean;
  phase: EventPhase;
  behindScenes: boolean;
  buildToTriumph: boolean;
  energyCurve: 'steady' | 'building' | 'peak' | 'wind_down';
}

// 6. Live Challenge Integration
export type LiveChallengeType = 'stand_up' | 'raise_hand' | 'hashtag_display' | 'thirty_day_challenge' | 'commitment_moment';

export interface LiveChallenge {
  enabled: boolean;
  challengeType: LiveChallengeType;
  timing: number;
  description: string;
  callToAction: string;
}

// 7. Speaker Archetype
export type SpeakerArchetype =
  | 'drill_sergeant'
  | 'tony_robbins'
  | 'brene_brown'
  | 'gary_vee'
  | 'oprah'
  | 'eric_thomas'
  | 'simon_sinek';

export interface SpeakerArchetypeConfig {
  enabled: boolean;
  archetype: SpeakerArchetype;
  deliveryStyle: string;
  bodyLanguage: string;
  vocalTone: string;
}

// 8. Pause for Effect
export interface PauseForEffectConfig {
  enabled: boolean;
  timing: number;
  duration: number; // seconds of pause
  cameraAction: 'zoom_in' | 'hold_static' | 'slow_push' | 'cut_wide';
  musicAction: 'drop' | 'fade' | 'continue' | 'swell';
}

// 9. Achievement/Milestone Context
export type AchievementContextType =
  | 'championship'
  | 'award_ceremony'
  | 'graduation'
  | 'grand_opening'
  | 'record_breaking'
  | 'comeback_victory'
  | 'lifetime_achievement';

export interface AchievementContext {
  enabled: boolean;
  contextType: AchievementContextType;
  backdrop: string;
  props: string[];
  atmosphere: string;
}

// 10. Call-to-Action Pivot
export type CTAPivotType = 'story_to_advice' | 'write_this_down' | 'final_challenge' | 'join_movement' | 'share_message';

export interface CTAPivotConfig {
  enabled: boolean;
  pivotType: CTAPivotType;
  timing: number;
  transitionPhrase: string;
  callToAction: string;
}

// Combined Motivational Enhancement Config
export interface MotivationalEnhancementConfig {
  transformationArc?: TransformationArc;
  audienceEnergy?: AudienceEnergyConfig;
  soundscape?: MotivationalSoundscapeConfig;
  breakthroughMoment?: BreakthroughMoment;
  eventEnergyArc?: EventEnergyArcConfig;
  liveChallenge?: LiveChallenge;
  speakerArchetype?: SpeakerArchetypeConfig;
  pauseForEffect?: PauseForEffectConfig;
  achievementContext?: AchievementContext;
  ctaPivot?: CTAPivotConfig;
}

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

// === AGE-APPROPRIATE CONTENT TYPES ===

// Age groups for content filtering
export type AgeGroup = 'kids' | 'teens' | 'adults' | 'older_adults' | 'all_ages';

// Content ratings based on MPAA-style ratings
export type ContentRating = 'G' | 'PG' | 'PG-13' | 'R';

// Configuration for each age group
export interface AgeGroupConfig {
  ageGroup: AgeGroup;
  displayName: string;
  icon: string;
  description: string;
  ageRange: string;
  contentRating: ContentRating;
  allowedContentRatings: ContentRating[];
  color: string;
}

// Topic with age appropriateness metadata
export interface TopicWithAge {
  topic: string;
  category: string;
  ageGroups: AgeGroup[];
  contentRating: ContentRating;
  requiresParentalGuidance: boolean;
}

// Question with age filtering
export interface QuestionWithAge {
  id: string;
  category: QuestionCategory;
  question: string;
  ageGroups: AgeGroup[];
  contentRating: ContentRating;
  isTrending: boolean;
  usageCount: number;
  createdAt: string;
}

// Mode with age restrictions
export interface ModeWithAge {
  mode: InterviewMode;
  label: string;
  description: string;
  allowedAgeGroups: AgeGroup[];
  requiresParentalGuidance: boolean;
}

// === 55+ WISDOM INTERVIEW TYPES ===

// Wisdom interview tone options
export type WisdomTone = 'gentle' | 'direct' | 'funny' | 'heartfelt';

// Wisdom interview format options
export type WisdomFormat = 'motivation' | 'street_conversation' | 'subway_take';

// Wisdom interview demographic options
export type WisdomDemographic = 
  | 'retirees' 
  | 'grandparents' 
  | 'late_career' 
  | 'caregivers' 
  | 'reinventors' 
  | 'mentors';

// Wisdom interview setting options
export type WisdomSetting = 
  | 'park_bench' 
  | 'coffee_shop' 
  | 'living_room' 
  | 'library' 
  | 'main_street' 
  | 'subway_platform' 
  | 'community_center';

// B-roll tag for wisdom content (simple string identifier)
export type BrollTag = string;

// ============================================
// Remotion Post-Production Effects Types
// ============================================

// Caption animation styles for viral videos
export type CaptionAnimation = 
  | 'static'
  | 'word_by_word'
  | 'typewriter'
  | 'karaoke'
  | 'pop_up'
  | 'slide_in'
  | 'highlight';

// Lower third graphic styles
export type LowerThirdStyle = 
  | 'none'
  | 'classic'
  | 'modern'
  | 'minimal'
  | 'vintage';

// Intro sequence types
export type IntroType = 
  | 'none'
  | 'hook'
  | 'title'
  | 'branding'
  | 'countdown';

// Outro sequence types
export type OutroType = 
  | 'none'
  | 'cta'
  | 'subscribe'
  | 'next_video'
  | 'branding';

// Transition effects
export type TransitionEffect = 
  | 'none'
  | 'fade'
  | 'slide'
  | 'zoom'
  | 'blur'
  | 'dissolve';

// Thumbnail styles
export type ThumbnailStyle = 
  | 'viral'
  | 'quote'
  | 'reaction'
  | 'title';

// Background types
export type BackgroundType = 
  | 'solid'
  | 'gradient'
  | 'blur'
  | 'video_overlay';

// Complete Remotion effects configuration
export interface RemotionEffectsConfig {
  // Captions
  captions: {
    enabled: boolean;
    animation: CaptionAnimation;
    fontSize: number;
    fontFamily: string;
    textColor: string;
    backgroundColor: string;
    position: 'top' | 'bottom' | 'center';
    emphasizeWords: string[];
  };
  
  // Lower third name/title overlay
  lowerThird: {
    enabled: boolean;
    style: LowerThirdStyle;
    showName: boolean;
    showTitle: boolean;
    showRole: boolean;
    customName?: string;
    customTitle?: string;
  };
  
  // Intro sequence
  intro: {
    enabled: boolean;
    type: IntroType;
    durationFrames: number;
    customText?: string;
  };
  
  // Outro sequence
  outro: {
    enabled: boolean;
    type: OutroType;
    includeSubscribeButton: boolean;
    includeHandle: boolean;
    customHandle?: string;
  };
  
  // Graphic overlays
  graphics: {
    enabled: boolean;
    progressBar: boolean;
    chapterMarkers: boolean;
    viralEmojis: boolean;
    soundWave: boolean;
  };
  
  // Background settings
  background: {
    type: BackgroundType;
    gradientColors?: string[];
    blurAmount?: number;
    opacity?: number;
  };
  
  // Transition settings
  transitions: {
    introTransition: TransitionEffect;
    outroTransition: TransitionEffect;
    clipTransition: TransitionEffect;
  };
  
  // Thumbnail generation
  thumbnail: {
    enabled: boolean;
    style: ThumbnailStyle;
    emoji: string;
    overlayText?: string;
  };
}

// Valid clip types for effects presets
export const VALID_CLIP_TYPES = [
  'wisdom_interview',
  'motivational',
  'street_interview',
  'subway_interview',
  'studio_interview',
] as const;

export type ValidClipType = typeof VALID_CLIP_TYPES[number];

// Helper function to get default effects for a clip type
export function getDefaultEffects(clipType: string): RemotionEffectsConfig {
  // Validate clipType
  const isValidClipType = VALID_CLIP_TYPES.includes(clipType as ValidClipType);
  if (!isValidClipType) {
    console.warn(`Unknown clipType: "${clipType}". Using "wisdom_interview" as default.`);
  }
  
  const presets: Record<string, Partial<RemotionEffectsConfig>> = {
    wisdom_interview: {
      captions: { 
        enabled: true, 
        animation: 'word_by_word', 
        position: 'bottom', 
        fontSize: 36,
        fontFamily: 'Inter',
        textColor: '#FFFFFF',
        backgroundColor: 'transparent',
        emphasizeWords: [],
      },
      lowerThird: { 
        enabled: true, 
        style: 'modern', 
        showName: true, 
        showTitle: true,
        showRole: false,
      },
      intro: { enabled: true, type: 'title', durationFrames: 60 },
      graphics: { 
        enabled: true,
        progressBar: true, 
        chapterMarkers: true,
        viralEmojis: false,
        soundWave: false,
      },
    },
    motivational: {
      captions: { 
        enabled: true, 
        animation: 'highlight', 
        position: 'center', 
        fontSize: 48,
        fontFamily: 'Inter',
        textColor: '#FFFFFF',
        backgroundColor: 'transparent',
        emphasizeWords: [],
      },
      lowerThird: { 
        enabled: false, 
        style: 'modern', 
        showName: true, 
        showTitle: true,
        showRole: false,
      },
      intro: { enabled: true, type: 'hook', durationFrames: 90 },
      outro: { 
        enabled: true, 
        type: 'cta', 
        includeSubscribeButton: true,
        includeHandle: true,
      },
      graphics: { 
        enabled: true,
        progressBar: true, 
        chapterMarkers: false,
        viralEmojis: true,
        soundWave: false,
      },
    },
    street_interview: {
      captions: { 
        enabled: true, 
        animation: 'word_by_word', 
        position: 'bottom', 
        fontSize: 32,
        fontFamily: 'Inter',
        textColor: '#FFFFFF',
        backgroundColor: 'transparent',
        emphasizeWords: [],
      },
      lowerThird: { 
        enabled: true, 
        style: 'classic', 
        showName: true, 
        showTitle: true,
        showRole: false,
      },
      intro: { enabled: true, type: 'branding', durationFrames: 45 },
      graphics: { 
        enabled: true,
        progressBar: false, 
        chapterMarkers: false,
        viralEmojis: false,
        soundWave: true,
      },
    },
    subway_interview: {
      captions: { 
        enabled: true, 
        animation: 'slide_in', 
        position: 'top', 
        fontSize: 32,
        fontFamily: 'Inter',
        textColor: '#FFFFFF',
        backgroundColor: 'transparent',
        emphasizeWords: [],
      },
      lowerThird: { 
        enabled: true, 
        style: 'minimal', 
        showName: true, 
        showTitle: true,
        showRole: true,
      },
      graphics: { 
        enabled: true,
        progressBar: true, 
        chapterMarkers: false,
        viralEmojis: false,
        soundWave: false,
      },
    },
    studio_interview: {
      captions: { 
        enabled: true, 
        animation: 'static', 
        position: 'bottom', 
        fontSize: 28,
        fontFamily: 'Inter',
        textColor: '#FFFFFF',
        backgroundColor: 'transparent',
        emphasizeWords: [],
      },
      lowerThird: { 
        enabled: true, 
        style: 'classic', 
        showName: true, 
        showTitle: true,
        showRole: true,
      },
      intro: { enabled: true, type: 'title', durationFrames: 75 },
      outro: { 
        enabled: true, 
        type: 'subscribe', 
        includeSubscribeButton: true,
        includeHandle: true,
      },
    },
  };
  
  const preset = presets[clipType as ValidClipType] || presets.wisdom_interview;
  
  return {
    captions: {
      enabled: true,
      animation: 'word_by_word',
      fontSize: 36,
      fontFamily: 'Inter',
      textColor: '#FFFFFF',
      backgroundColor: 'transparent',
      position: 'bottom',
      emphasizeWords: [],
      ...(preset.captions || {}),
    },
    lowerThird: {
      enabled: false,
      style: 'modern',
      showName: true,
      showTitle: true,
      showRole: false,
      ...(preset.lowerThird || {}),
    },
    intro: {
      enabled: false,
      type: 'title',
      durationFrames: 60,
      ...(preset.intro || {}),
    },
    outro: {
      enabled: false,
      type: 'cta',
      includeSubscribeButton: true,
      includeHandle: true,
      ...(preset.outro || {}),
    },
    graphics: {
      enabled: true,
      progressBar: false,
      chapterMarkers: false,
      viralEmojis: false,
      soundWave: false,
      ...(preset.graphics || {}),
    },
    background: {
      type: 'blur',
      blurAmount: 5,
      opacity: 100,
    },
    transitions: {
      introTransition: 'fade',
      outroTransition: 'fade',
      clipTransition: 'none',
    },
    thumbnail: {
      enabled: false,
      style: 'viral',
      emoji: '🔥',
    },
  };
}

// Wisdom script structure
export interface WisdomScript {
  format: WisdomFormat;
  hook: string;
  topic: string;
  estimatedDuration: number;
  brollPlan: string[];
  emphasisWords: string[];
  editNotes: string[];
}

// Combined Wisdom enhancement config
export interface WisdomEnhancementConfig {
  tone: WisdomTone;
  format: WisdomFormat;
  demographic: WisdomDemographic;
  setting: WisdomSetting;
  wisdomScript?: WisdomScript;
}

// === MAIN CLIP INTERFACE ===

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
  // New fields for enhancements
  interview_mode: InterviewMode | null;
  studio_setup: StudioSetup | null;
  studio_lighting: StudioLighting | null;
  guest_count: number | null;
  reroll_count: number;
  parent_clip_id: string | null;
  token_cost: number | null;
  viral_score: ViralScore | null;
  // Subway enhancement fields
  subway_enhancements: SubwayEnhancementConfig | null;
  subway_line: SubwayLine | null;
  // Street enhancement fields
  street_enhancements: StreetEnhancementConfig | null;
  neighborhood: Neighborhood | null;
  // Motivational enhancement fields
  motivational_enhancements: MotivationalEnhancementConfig | null;
  speaker_archetype: SpeakerArchetype | null;
  // Age-appropriate content field
  target_age_group: AgeGroup | null;
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
  // New fields for enhancements
  interviewMode?: InterviewMode;
  studioSetup?: StudioSetup;
  studioLighting?: StudioLighting;
  guestCount?: number;
  // SubwayTakes debate loop config
  debateLoop?: DebateLoopConfig;
  captionConfig?: CaptionConfig;
  // SubwayTakes-style script
  subwayTakeScript?: SubwayTakeScript;
  // Subway enhancements
  subwayEnhancements?: SubwayEnhancementConfig;
  subwayLine?: SubwayLine;
  // Street enhancements
  streetEnhancements?: StreetEnhancementConfig;
  neighborhood?: Neighborhood;
  // Motivational enhancements
  motivationalEnhancements?: MotivationalEnhancementConfig;
  speakerArchetype?: SpeakerArchetype;
  // Age-appropriate content
  targetAgeGroup?: AgeGroup;
  // Wisdom mode
  wisdomTone?: WisdomTone;
  // Remotion effects
  effects?: RemotionEffectsConfig;
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
  template_id: string | null;
  episode_number: number | null;
  overlay_status: string | null;
  composed_video_url: string | null;
  thumbnail_variants: Record<string, string> | null;
  script?: EpisodeScript;
  host_character?: CharacterBible;
  guest_character?: CharacterBible;
  shots?: EpisodeShot[];
  beats?: Beat[];
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
  // New fields for beats
  beats?: Beat[];
  interviewMode?: InterviewMode;
}
