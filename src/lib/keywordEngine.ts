import type {
  ClipType,
  InterviewMode,
  EnergyLevel,
  CharacterPreset,
  InterviewStyle,
  StreetScene,
  SubwaySceneType,
  CityStyle,
  MotivationalSetting,
  SpeakerStyle,
  CameraStyle,
  LightingMood,
  SubwayLine,
  TimeOfDay,
  SubjectDemographic,
  SubjectStyle,
  WisdomTone,
} from './types';

/**
 * Sentiment/Emotion Modifier Types
 */
export type SentimentModifier = 
  | 'funny' 
  | 'sad' 
  | 'inspirational' 
  | 'shocking' 
  | 'controversial' 
  | 'heartfelt' 
  | 'angry' 
  | 'relatable'
  | 'educational'
  | 'mysterious';

/**
 * Platform Target Types
 */
export type PlatformTarget = 'tiktok' | 'youtube_shorts' | 'instagram_reels' | 'any';

/**
 * Keyword Category Types
 */
export type KeywordCategory = 
  | 'money' 
  | 'dating' 
  | 'hot_takes' 
  | 'fitness' 
  | 'wisdom' 
  | 'motivational'
  | 'comedy'
  | 'educational'
  | 'lifestyle'
  | 'trending'
  | 'career';

/**
 * Viral Score Result
 */
export interface ViralScoreResult {
  score: number; // 0-100
  factors: {
    name: string;
    impact: 'high' | 'medium' | 'low';
    score: number;
  }[];
  tips: string[];
  potential: 'viral' | 'high' | 'medium' | 'low';
}

/**
 * Keyword Analysis Result
 * Maps a keyword to optimal video settings with enhancements
 */
export interface KeywordAnalysis {
  // Primary selections based on keyword
  clipType: ClipType;
  topic: string;
  originalKeyword: string;
  
  // Enhancement modifiers
  sentiment?: SentimentModifier;
  platform?: PlatformTarget;
  category?: KeywordCategory;
  
  // Interview-specific settings
  interviewMode?: InterviewMode;
  interviewStyle?: InterviewStyle;
  energyLevel?: EnergyLevel;
  sceneType?: SubwaySceneType;
  cityStyle?: CityStyle;
  subwayLine?: SubwayLine;
  timeOfDay?: TimeOfDay;
  streetScene?: StreetScene;
  
  // Character settings
  characterPreset: CharacterPreset;
  subjectDemographic: SubjectDemographic;
  subjectStyle: SubjectStyle;
  
  // Motivational settings
  motivationalSetting?: MotivationalSetting;
  speakerStyle?: SpeakerStyle;
  cameraStyle?: CameraStyle;
  lightingMood?: LightingMood;
  
  // Wisdom settings
  wisdomTone?: WisdomTone;
  
  // AI direction for viral potential
  viralDirection: string;
  toneDescription: string;
  
  // Viral scoring
  viralScore?: ViralScoreResult;
}

/**
 * Multi-Keyword Result
 * For batch keyword processing
 */
export interface MultiKeywordResult {
  keywords: string[];
  analyses: KeywordAnalysis[];
  totalViralScore: number;
  bestKeyword: string;
}

// ============================================
// KEYWORD CATEGORY DEFINITIONS
// ============================================

export const KEYWORD_CATEGORIES: { value: KeywordCategory; label: string; emoji: string; keywords: string[] }[] = [
  { 
    value: 'money', 
    label: 'Money', 
    emoji: '💰',
    keywords: ['money', 'salary', 'rich', 'poor', 'finance', 'investing', 'crypto', 'stocks', 'side_hustle', 'entrepreneurship', 'business', 'wealth', 'debt', 'budget', 'saving']
  },
  { 
    value: 'dating', 
    label: 'Dating', 
    emoji: '💕',
    keywords: ['dating', 'relationships', 'breakup', 'love', 'marriage', 'divorce', 'sex', 'hookup', 'tinder', 'boyfriend', 'girlfriend', 'wedding', 'proposal', 'romance', 'heartbreak']
  },
  { 
    value: 'hot_takes', 
    label: 'Hot Takes', 
    emoji: '🔥',
    keywords: ['opinion', 'controversial', 'debate', 'unpopular', 'rant', 'truth', 'roast', 'challenge', 'admit', 'confession', 'secret', 'reveal']
  },
  { 
    value: 'fitness', 
    label: 'Fitness', 
    emoji: '💪',
    keywords: ['fitness', 'gym', 'workout', 'diet', 'weight', 'body', 'health', 'muscle', 'exercise', 'training', 'running', 'yoga', 'nutrition', 'wellness']
  },
  { 
    value: 'wisdom', 
    label: 'Wisdom', 
    emoji: '🧓',
    keywords: ['wisdom', 'life_lessons', 'retirement', 'legacy', 'family', 'gratitude', 'purpose', 'meaning', 'aging', 'elderly', 'senior', 'grandparent', 'experience', 'advice']
  },
  { 
    value: 'motivational', 
    label: 'Motivational', 
    emoji: '🚀',
    keywords: ['motivation', 'discipline', 'grind', 'success', 'failure', 'hustle', 'focus', 'goals', 'dreams', 'ambition', 'productivity', 'morning', 'no_excuses', 'champion']
  },
  { 
    value: 'comedy', 
    label: 'Comedy', 
    emoji: '😂',
    keywords: ['funny', 'laugh', 'humor', 'joke', 'meme', 'silly', 'absurd', 'cringe', 'awkward', 'random', 'wild', 'crazy', 'hilarious']
  },
  { 
    value: 'educational', 
    label: 'Educational', 
    emoji: '📚',
    keywords: ['learn', 'tips', 'advice', 'how_to', 'guide', 'explained', 'fact', 'science', 'history', 'technique', 'strategy', 'method']
  },
  { 
    value: 'lifestyle', 
    label: 'Lifestyle', 
    emoji: '🌟',
    keywords: ['life', 'career', 'job', 'work', 'home', 'family', 'friends', 'hobbies', 'travel', 'food', 'style', 'fashion', 'beauty', 'parenting']
  },
  { 
    value: 'trending', 
    label: 'Trending', 
    emoji: '🔥',
    keywords: ['viral', 'trending', 'trend', 'challenge', 'internet', 'social_media', 'fomo', 'hype', 'buzz']
  },
];

// ============================================
// SENTIMENT MODIFIER DEFINITIONS
// ============================================

export const SENTIMENT_MODIFIERS: { value: SentimentModifier; label: string; emoji: string; description: string }[] = [
  { value: 'funny', label: 'Funny', emoji: '😂', description: 'Comedy and humor angle' },
  { value: 'sad', label: 'Sad', emoji: '😢', description: 'Emotional and heartfelt' },
  { value: 'inspirational', label: 'Inspirational', emoji: '✨', description: 'Uplifting and motivating' },
  { value: 'shocking', label: 'Shocking', emoji: '😱', description: 'Surprising and eye-opening' },
  { value: 'controversial', label: 'Controversial', emoji: '😤', description: 'Bold and polarizing' },
  { value: 'heartfelt', label: 'Heartfelt', emoji: '❤️', description: 'Warm and genuine' },
  { value: 'angry', label: 'Angry', emoji: '😡', description: 'Passionate and intense' },
  { value: 'relatable', label: 'Relatable', emoji: '🙌', description: 'Everyone can relate' },
  { value: 'educational', label: 'Educational', emoji: '🧠', description: 'Informative and helpful' },
  { value: 'mysterious', label: 'Mysterious', emoji: '🔮', description: 'Curious and intriguing' },
];

// ============================================
// PLATFORM TARGET DEFINITIONS
// ============================================

export const PLATFORM_TARGETS: { value: PlatformTarget; label: string; emoji: string; description: string }[] = [
  { value: 'tiktok', label: 'TikTok', emoji: '📱', description: 'Fast cuts, trending audio, hooks' },
  { value: 'youtube_shorts', label: 'YouTube Shorts', emoji: '▶️', description: 'Storytelling, longer hooks' },
  { value: 'instagram_reels', label: 'Instagram Reels', emoji: '📸', description: 'Aesthetic, polished look' },
  { value: 'any', label: 'Any Platform', emoji: '🌐', description: 'Universal viral format' },
];

// ============================================
// KEYWORD TO CLIP TYPE MAPPINGS
// ============================================

const KEYWORD_CLIP_TYPE_MAP: Record<string, ClipType> = {
  // Street Interview keywords
  dating: 'street_interview', relationships: 'street_interview', breakup: 'street_interview',
  love: 'street_interview', marriage: 'street_interview', divorce: 'street_interview',
  sex: 'street_interview', hookup: 'street_interview', tinder: 'street_interview',
  relationship: 'street_interview', boyfriend: 'street_interview', girlfriend: 'street_interview',
  wedding: 'street_interview', proposal: 'street_interview',
  money: 'street_interview', salary: 'street_interview', rich: 'street_interview',
  poor: 'street_interview', finance: 'street_interview', investing: 'street_interview',
  crypto: 'street_interview', stocks: 'street_interview', side_hustle: 'street_interview',
  entrepreneurship: 'street_interview', startup: 'street_interview', business: 'street_interview',
  fitness: 'street_interview', gym: 'street_interview', workout: 'street_interview',
  diet: 'street_interview', weight: 'street_interview', body: 'street_interview',
  health: 'street_interview', mental_health: 'street_interview', therapy: 'street_interview',
  opinion: 'street_interview', controversial: 'street_interview', hot_take: 'street_interview',
  debate: 'street_interview', advice: 'street_interview', tips: 'street_interview',
  help: 'street_interview', struggling: 'street_interview',
  
  // Subway Interview keywords
  subway: 'subway_interview', train: 'subway_interview', commute: 'subway_interview',
  mta: 'subway_interview', nyc: 'subway_interview', new_york: 'subway_interview',
  transit: 'subway_interview', bus: 'subway_interview',
  
  // Studio Interview keywords
  career: 'studio_interview', job: 'studio_interview', work: 'studio_interview',
  promotion: 'studio_interview', interview: 'studio_interview', professional: 'studio_interview',
  leadership: 'studio_interview', management: 'studio_interview',
  
  // Motivational keywords
  motivation: 'motivational', discipline: 'motivational', grind: 'motivational',
  success: 'motivational', failure: 'motivational', hustle: 'motivational',
  focus: 'motivational', goals: 'motivational', dreams: 'motivational',
  ambition: 'motivational', productivity: 'motivational', morning_routine: 'motivational',
  no_excuses: 'motivational', champions: 'motivational', winner: 'motivational', mindset: 'motivational',
  
  // Wisdom keywords (55+)
  wisdom: 'wisdom_interview', life_lessons: 'wisdom_interview', retirement: 'wisdom_interview',
  legacy: 'wisdom_interview', family: 'wisdom_interview', gratitude: 'wisdom_interview',
  purpose: 'wisdom_interview', meaning: 'wisdom_interview', aging: 'wisdom_interview',
  elderly: 'wisdom_interview', senior: 'wisdom_interview', grandparent: 'wisdom_interview',
  reflection: 'wisdom_interview', lessons: 'wisdom_interview', experience: 'wisdom_interview',
  memories: 'wisdom_interview', regret: 'wisdom_interview', forgiveness: 'wisdom_interview',
  peace: 'wisdom_interview', contentment: 'wisdom_interview', faith: 'wisdom_interview',
  spirituality: 'wisdom_interview', community: 'wisdom_interview', friendship: 'wisdom_interview',
  parenting: 'wisdom_interview', grandchildren: 'wisdom_interview', change: 'wisdom_interview',
  loss: 'wisdom_interview', recovery: 'wisdom_interview', balance: 'wisdom_interview',
  simplicity: 'wisdom_interview', humility: 'wisdom_interview', kindness: 'wisdom_interview',
  courage: 'wisdom_interview', compassion: 'wisdom_interview', freedom: 'wisdom_interview',
  boundaries: 'wisdom_interview', scams: 'wisdom_interview', healthcare: 'wisdom_interview',
  loneliness: 'wisdom_interview', second_acts: 'wisdom_interview', reinvention: 'wisdom_interview',
  mentorship: 'wisdom_interview', patience: 'wisdom_interview', acceptance: 'wisdom_interview',
  hope: 'wisdom_interview', joy: 'wisdom_interview',
};

// ============================================
// VIRAL SCORE CALCULATION
// ============================================

/**
 * Calculate viral score based on keyword and settings
 */
export function calculateViralScore(analysis: KeywordAnalysis): ViralScoreResult {
  let score = 50; // Base score
  const factors: ViralScoreResult['factors'] = [];
  
  // Keyword popularity factor
  const popularKeywords = ['dating', 'money', 'sex', 'love', 'breakup', 'success', 'failure', 'motivation'];
  const isPopular = popularKeywords.some(kw => 
    analysis.originalKeyword.toLowerCase().includes(kw)
  );
  if (isPopular) {
    score += 15;
    factors.push({ name: 'High-interest topic', impact: 'high', score: 85 });
  } else {
    factors.push({ name: 'Niche topic', impact: 'low', score: 60 });
  }
  
  // Sentiment bonus
  const viralSentiments = ['funny', 'shocking', 'controversial', 'relatable'];
  if (analysis.sentiment && viralSentiments.includes(analysis.sentiment)) {
    score += 20;
    factors.push({ name: `Viral sentiment: ${analysis.sentiment}`, impact: 'high', score: 90 });
  }
  
  // Platform optimization
  if (analysis.platform && analysis.platform !== 'any') {
    score += 10;
    factors.push({ name: `Optimized for ${analysis.platform}`, impact: 'medium', score: 80 });
  }
  
  // Energy level factor
  if (analysis.energyLevel === 'high_energy' || analysis.energyLevel === 'chaotic') {
    score += 10;
    factors.push({ name: 'High energy content', impact: 'medium', score: 78 });
  }
  
  // Clip type factor
  if (analysis.clipType === 'street_interview' || analysis.clipType === 'subway_interview') {
    score += 5;
    factors.push({ name: 'Street/subway format', impact: 'medium', score: 75 });
  }
  
  // Generate tips
  const tips: string[] = [];
  if (score < 70) {
    tips.push('Add a stronger hook in the first 2 seconds');
    tips.push('Consider a more controversial angle');
  }
  if (analysis.sentiment !== 'funny' && analysis.sentiment !== 'shocking') {
    tips.push('Try adding "funny" or "shocking" sentiment for more shares');
  }
  if (score >= 85) {
    tips.push('This keyword has high viral potential!');
  }
  
  // Determine potential
  let potential: ViralScoreResult['potential'] = 'low';
  if (score >= 90) potential = 'viral';
  else if (score >= 75) potential = 'high';
  else if (score >= 60) potential = 'medium';
  
  return { score: Math.min(100, score), factors, tips, potential };
}

// ============================================
// KEYWORD EXPANSION (AI SUGGESTIONS)
// ============================================

/**
 * Get AI-suggested related keywords
 */
export function expandKeyword(keyword: string): string[] {
  const base = keyword.toLowerCase().trim();
  const expansions: Record<string, string[]> = {
    dating: ['dating advice', 'dating tips', 'dating failed', 'dating struggles', 'dating app', 'dating coach'],
    money: ['money mindset', 'how to make money', 'money problems', 'money tips', 'financial freedom', 'get rich'],
    success: ['success mindset', 'keys to success', 'success quotes', 'success habits', 'overnight success', 'success tips'],
    fitness: ['fitness journey', 'fitness tips', 'fitness motivation', 'home workout', 'gym fails', 'fitness transformation'],
    wisdom: ['life wisdom', 'wise words', 'wisdom quotes', 'life lessons', 'advice for young', 'learn from mistakes'],
    motivation: ['daily motivation', 'motivation for success', 'monday motivation', 'motivation workout', 'self motivation'],
    love: ['love story', 'love quotes', 'finding love', 'love tips', 'romantic love', 'unconditional love'],
    career: ['career advice', 'career tips', 'career change', 'career goals', 'successful career', 'career path'],
    health: ['health tips', 'mental health', 'physical health', 'health and wellness', 'healthy lifestyle', 'health advice'],
    relationships: ['relationship advice', 'relationship tips', 'healthy relationships', 'relationship goals', 'toxic relationships'],
  };
  
  // Find matching base
  for (const [key, values] of Object.entries(expansions)) {
    if (base.includes(key)) {
      return values;
    }
  }
  
  // Generic expansions
  return [
    `${keyword} tips`,
    `${keyword} advice`,
    `${keyword} mistakes`,
    `${keyword} truth`,
    `${keyword} story`,
    `${keyword} fail`,
  ];
}

// ============================================
// MAIN ANALYZE FUNCTION
// ============================================

/**
 * Analyze a keyword and return optimal settings with all enhancements
 */
export function analyzeKeyword(
  keyword: string, 
  options?: {
    sentiment?: SentimentModifier;
    platform?: PlatformTarget;
    category?: KeywordCategory;
  }
): KeywordAnalysis {
  const normalizedKeyword = keyword.toLowerCase().trim().replace(/\s+/g, '_');
  
  // Determine clip type
  let clipType = KEYWORD_CLIP_TYPE_MAP[normalizedKeyword] || 'street_interview';
  
  // Fallback: check if keyword contains certain substrings
  if (!KEYWORD_CLIP_TYPE_MAP[normalizedKeyword]) {
    if (normalizedKeyword.includes('money') || normalizedKeyword.includes('career') || normalizedKeyword.includes('job')) {
      clipType = 'studio_interview';
    } else if (normalizedKeyword.includes('motivation') || normalizedKeyword.includes('discipline') || normalizedKeyword.includes('success')) {
      clipType = 'motivational';
    } else if (normalizedKeyword.includes('wisdom') || normalizedKeyword.includes('life') || normalizedKeyword.includes('retirement') || 
               normalizedKeyword.includes('legacy') || normalizedKeyword.includes('grandparent') || normalizedKeyword.includes('age')) {
      clipType = 'wisdom_interview';
    }
  }
  
  // Build analysis with enhancements
  let analysis: KeywordAnalysis;
  
  switch (clipType) {
    case 'street_interview':
      analysis = buildStreetInterviewAnalysis(keyword, normalizedKeyword, options);
      break;
    case 'subway_interview':
      analysis = buildSubwayInterviewAnalysis(keyword, normalizedKeyword, options);
      break;
    case 'studio_interview':
      analysis = buildStudioInterviewAnalysis(keyword, normalizedKeyword, options);
      break;
    case 'motivational':
      analysis = buildMotivationalAnalysis(keyword, normalizedKeyword, options);
      break;
    case 'wisdom_interview':
      analysis = buildWisdomAnalysis(keyword, normalizedKeyword, options);
      break;
    default:
      analysis = buildStreetInterviewAnalysis(keyword, normalizedKeyword, options);
  }
  
  // Apply enhancements from options
  if (options?.sentiment) {
    analysis.sentiment = options.sentiment;
    analysis = applySentimentModifier(analysis, options.sentiment);
  }
  
  if (options?.platform) {
    analysis.platform = options.platform;
    analysis = applyPlatformOptimization(analysis, options.platform);
  }
  
  if (options?.category) {
    analysis.category = options.category;
  }
  
  // Calculate viral score
  analysis.viralScore = calculateViralScore(analysis);
  
  return analysis;
}

// ============================================
// ANALYSIS BUILDERS
// ============================================

function buildStreetInterviewAnalysis(
  keyword: string, 
  normalized: string,
  _options?: { sentiment?: SentimentModifier }
): KeywordAnalysis {
  let interviewMode: InterviewMode = 'hot_take_challenge';
  let interviewStyle: InterviewStyle = 'man_on_street';
  let energyLevel: EnergyLevel = 'high_energy';
  let streetScene: StreetScene = 'busy_sidewalk';
  let timeOfDay: TimeOfDay = 'midday';
  let characterPreset: CharacterPreset = 'street_vox';
  let subjectDemographic: SubjectDemographic = 'any';
  let subjectStyle: SubjectStyle = 'casual';
  let viralDirection = '';
  let toneDescription = '';

  // Dating/relationships content
  if (normalized.includes('dating') || normalized.includes('relationship') || normalized.includes('love') || normalized.includes('breakup')) {
    interviewMode = 'hot_take_challenge';
    energyLevel = 'high_energy';
    streetScene = 'busy_sidewalk';
    viralDirection = 'Controversial dating opinions, relatable relationship struggles';
    toneDescription = 'Fun, relatable, slightly controversial';
    characterPreset = 'street_vox';
  }
  // Money/finance content
  else if (normalized.includes('money') || normalized.includes('rich') || normalized.includes('salary') || normalized.includes('finance')) {
    interviewMode = 'hot_take_challenge';
    energyLevel = 'high_energy';
    streetScene = 'busy_sidewalk';
    viralDirection = 'Bold money opinions, financial advice, wealth mindset';
    toneDescription = 'Bold, opinionated, eye-catching';
    characterPreset = 'street_vox';
  }
  // Hot takes
  else if (normalized.includes('opinion') || normalized.includes('hot_take') || normalized.includes('controversial')) {
    interviewMode = 'hot_take_challenge';
    energyLevel = 'chaotic';
    streetScene = 'crosswalk';
    viralDirection = 'Controversial stances that spark debate and shares';
    toneDescription = 'Provocative, attention-grabbing';
    characterPreset = 'street_vox';
  }
  // Health/fitness
  else if (normalized.includes('fitness') || normalized.includes('gym') || normalized.includes('health') || normalized.includes('diet')) {
    interviewMode = 'rapid_fire_round';
    energyLevel = 'high_energy';
    streetScene = 'park_bench';
    viralDirection = 'Fitness tips, workout opinions, health advice';
    toneDescription = 'Energetic, motivating, informative';
    characterPreset = 'street_vox';
    subjectDemographic = 'young_professional';
  }
  // Life advice
  else if (normalized.includes('advice') || normalized.includes('tips') || normalized.includes('help')) {
    interviewMode = 'story_time';
    energyLevel = 'conversational';
    streetScene = 'park_bench';
    viralDirection = 'Life lessons, personal stories, advice from experience';
    toneDescription = 'Warm, wise, relatable';
    characterPreset = 'random_encounter';
    subjectDemographic = 'middle_aged';
  }

  return {
    clipType: 'street_interview',
    topic: keyword.charAt(0).toUpperCase() + keyword.slice(1).replace(/_/g, ' '),
    originalKeyword: keyword,
    interviewMode,
    interviewStyle,
    energyLevel,
    streetScene,
    timeOfDay,
    characterPreset,
    subjectDemographic,
    subjectStyle,
    viralDirection: viralDirection || 'Authentic street opinions on ' + keyword,
    toneDescription: toneDescription || 'Natural, conversational street interview',
  };
}

function buildSubwayInterviewAnalysis(
  keyword: string,
  _normalized: string,
  options?: { platform?: PlatformTarget }
): KeywordAnalysis {
  const subwayLines: SubwayLine[] = ['1', 'A', 'Q', '7', 'L', 'G'];
  const randomLine = subwayLines[Math.floor(Math.random() * subwayLines.length)];
  
  // Adjust for platform
  let timeOfDay: TimeOfDay = 'morning_rush';
  let energyLevel: EnergyLevel = 'high_energy';
  
  if (options?.platform === 'tiktok') {
    timeOfDay = 'morning_rush';
    energyLevel = 'chaotic';
  } else if (options?.platform === 'youtube_shorts') {
    timeOfDay = 'evening_rush';
    energyLevel = 'conversational';
  }
  
  return {
    clipType: 'subway_interview',
    topic: keyword.charAt(0).toUpperCase() + keyword.slice(1).replace(/_/g, ' '),
    originalKeyword: keyword,
    interviewMode: 'hot_take_challenge',
    interviewStyle: 'man_on_street',
    energyLevel,
    sceneType: 'platform_waiting',
    cityStyle: 'nyc',
    subwayLine: randomLine,
    timeOfDay,
    characterPreset: 'random_encounter',
    subjectDemographic: 'any',
    subjectStyle: 'casual',
    viralDirection: 'Viral NYC subway take on ' + keyword + ', relatable commuter content',
    toneDescription: 'Authentic NYC street energy, raw and unfiltered',
  };
}

function buildStudioInterviewAnalysis(
  keyword: string,
  _normalized: string,
  options?: { sentiment?: SentimentModifier }
): KeywordAnalysis {
  let energyLevel: EnergyLevel = 'conversational';
  
  if (options?.sentiment === 'shocking' || options?.sentiment === 'controversial') {
    energyLevel = 'high_energy';
  }
  
  return {
    clipType: 'studio_interview',
    topic: keyword.charAt(0).toUpperCase() + keyword.slice(1).replace(/_/g, ' '),
    originalKeyword: keyword,
    interviewMode: 'deep_dive_interview',
    interviewStyle: 'deep_conversation',
    energyLevel,
    characterPreset: 'podcast_pro',
    subjectDemographic: 'business_exec',
    subjectStyle: 'business_casual',
    viralDirection: 'Professional insights on ' + keyword + ' from industry perspective',
    toneDescription: 'Professional, authoritative, insightful',
  };
}

function buildMotivationalAnalysis(
  keyword: string, 
  normalized: string,
  options?: { sentiment?: SentimentModifier }
): KeywordAnalysis {
  let speakerStyle: SpeakerStyle = 'intense_coach';
  let motivationalSetting: MotivationalSetting = 'gym';
  let cameraStyle: CameraStyle = 'dramatic_push';
  let lightingMood: LightingMood = 'dramatic_shadows';
  let energyLevel: EnergyLevel = 'high_energy';

  if (options?.sentiment === 'funny') {
    speakerStyle = 'hype_man';
    motivationalSetting = 'urban_rooftop';
    lightingMood = 'golden_hour';
  } else if (options?.sentiment === 'inspirational') {
    speakerStyle = 'calm_mentor';
    motivationalSetting = 'outdoor';
    cameraStyle = 'wide_epic';
    lightingMood = 'golden_hour';
    energyLevel = 'conversational';
  } else if (normalized.includes('discipline') || normalized.includes('grind') || normalized.includes('hustle')) {
    speakerStyle = 'intense_coach';
    motivationalSetting = 'gym';
    cameraStyle = 'dramatic_push';
    lightingMood = 'dramatic_shadows';
  } else if (normalized.includes('success') || normalized.includes('winner') || normalized.includes('champion')) {
    speakerStyle = 'athlete';
    motivationalSetting = 'stage';
    cameraStyle = 'wide_epic';
    lightingMood = 'golden_hour';
  } else if (normalized.includes('mindset') || normalized.includes('failure') || normalized.includes('purpose')) {
    speakerStyle = 'calm_mentor';
    motivationalSetting = 'outdoor';
    cameraStyle = 'tight_closeup';
    lightingMood = 'studio_clean';
  }

  return {
    clipType: 'motivational',
    topic: keyword.charAt(0).toUpperCase() + keyword.slice(1).replace(/_/g, ' '),
    originalKeyword: keyword,
    speakerStyle,
    motivationalSetting,
    cameraStyle,
    lightingMood,
    energyLevel,
    characterPreset: 'wisdom_mentor',
    subjectDemographic: 'middle_aged',
    subjectStyle: 'business_casual',
    viralDirection: 'Powerful motivational message about ' + keyword,
    toneDescription: 'Inspirational, transformative, life-changing',
  };
}

function buildWisdomAnalysis(
  keyword: string, 
  normalized: string,
  options?: { sentiment?: SentimentModifier }
): KeywordAnalysis {
  let wisdomTone: WisdomTone = 'gentle';
  let energyLevel: EnergyLevel = 'calm';

  if (options?.sentiment === 'funny') {
    wisdomTone = 'funny';
  } else if (options?.sentiment === 'shocking' || options?.sentiment === 'angry') {
    wisdomTone = 'direct';
    energyLevel = 'conversational';
  } else if (options?.sentiment === 'inspirational' || options?.sentiment === 'heartfelt') {
    wisdomTone = 'heartfelt';
  } else if (normalized.includes('courage') || normalized.includes('change') || normalized.includes('recovery')) {
    wisdomTone = 'direct';
  } else if (normalized.includes('joy') || normalized.includes('peace') || normalized.includes('gratitude') || normalized.includes('contentment')) {
    wisdomTone = 'gentle';
  }

  return {
    clipType: 'wisdom_interview',
    topic: keyword.charAt(0).toUpperCase() + keyword.slice(1).replace(/_/g, ' '),
    originalKeyword: keyword,
    wisdomTone,
    interviewMode: 'story_time',
    energyLevel,
    characterPreset: 'wisdom_mentor',
    subjectDemographic: 'senior',
    subjectStyle: 'casual',
    viralDirection: 'Heartfelt wisdom and life lessons about ' + keyword + ' from experience',
    toneDescription: 'Warm, wise, inspiring, earned through experience',
  };
}

// ============================================
// ENHANCEMENT HELPERS
// ============================================

function applySentimentModifier(analysis: KeywordAnalysis, sentiment: SentimentModifier): KeywordAnalysis {
  const updated = { ...analysis };
  
  switch (sentiment) {
    case 'funny':
      updated.energyLevel = 'high_energy';
      updated.toneDescription = 'Comedic, entertaining, humor-driven';
      updated.viralDirection = `Funny take on ${analysis.topic} that will make people laugh`;
      break;
    case 'sad':
      updated.energyLevel = 'calm';
      updated.toneDescription = 'Emotional, touching, heartfelt';
      updated.viralDirection = `Emotional story about ${analysis.topic} that tugs at heartstrings`;
      break;
    case 'inspirational':
      updated.energyLevel = 'conversational';
      updated.toneDescription = 'Uplifting, motivating, empowering';
      updated.viralDirection = `Inspirational message about ${analysis.topic}`;
      break;
    case 'shocking':
      updated.energyLevel = 'chaotic';
      updated.toneDescription = 'Surprising, jaw-dropping, attention-grabbing';
      updated.viralDirection = `Shocking truth about ${analysis.topic}`;
      break;
    case 'controversial':
      updated.energyLevel = 'high_energy';
      updated.toneDescription = 'Bold, polarizing, debate-inducing';
      updated.viralDirection = `Controversial take on ${analysis.topic}`;
      break;
    case 'heartfelt':
      updated.energyLevel = 'calm';
      updated.toneDescription = 'Genuine, warm, sincere';
      updated.viralDirection = `Heartfelt perspective on ${analysis.topic}`;
      break;
    case 'angry':
      updated.energyLevel = 'high_energy';
      updated.toneDescription = 'Passionate, intense, frustrated';
      updated.viralDirection = `Raw reaction to ${analysis.topic}`;
      break;
    case 'relatable':
      updated.energyLevel = 'conversational';
      updated.toneDescription = 'Everyone has experienced this';
      updated.viralDirection = `Relatable ${analysis.topic} moment`;
      break;
    case 'educational':
      updated.energyLevel = 'conversational';
      updated.toneDescription = 'Informative, clear, helpful';
      updated.viralDirection = `Everything you need to know about ${analysis.topic}`;
      break;
    case 'mysterious':
      updated.energyLevel = 'conversational';
      updated.toneDescription = 'Curious, intriguing, suspenseful';
      updated.viralDirection = `The truth about ${analysis.topic} will surprise you`;
      break;
  }
  
  return updated;
}

function applyPlatformOptimization(analysis: KeywordAnalysis, platform: PlatformTarget): KeywordAnalysis {
  const updated = { ...analysis };
  
  switch (platform) {
    case 'tiktok':
      updated.energyLevel = 'high_energy';
      updated.toneDescription += ' - TikTok optimized';
      break;
    case 'youtube_shorts':
      updated.toneDescription += ' - YouTube Shorts optimized';
      break;
    case 'instagram_reels':
      updated.toneDescription += ' - Instagram Reels optimized';
      break;
    case 'any':
      // No changes
      break;
  }
  
  return updated;
}

// ============================================
// MULTI-KEYWORD PROCESSING
// ============================================

/**
 * Process multiple keywords and return batch results
 */
export function analyzeMultipleKeywords(keywords: string[]): MultiKeywordResult {
  const analyses = keywords.map(kw => analyzeKeyword(kw));
  
  // Calculate total viral score
  const totalScore = analyses.reduce((sum, a) => sum + (a.viralScore?.score || 50), 0);
  const avgScore = Math.round(totalScore / analyses.length);
  
  // Find best keyword
  const sortedAnalyses = [...analyses].sort((a, b) => 
    (b.viralScore?.score || 0) - (a.viralScore?.score || 0)
  );
  const bestKeyword = sortedAnalyses[0]?.originalKeyword || keywords[0];
  
  return {
    keywords,
    analyses,
    totalViralScore: avgScore,
    bestKeyword,
  };
}

// ============================================
// SUGGESTED KEYWORDS
// ============================================

export function getSuggestedKeywords(): Record<KeywordCategory, string[]> {
  return {
    money: ['money', 'salary', 'rich', 'investing', 'side_hustle'],
    dating: ['dating', 'relationships', 'breakup', 'love', 'marriage'],
    hot_takes: ['opinion', 'controversial', 'unpopular', 'confession', 'secret'],
    fitness: ['fitness', 'gym', 'workout', 'health', 'diet'],
    wisdom: ['life_lessons', 'wisdom', 'retirement', 'legacy', 'gratitude'],
    motivational: ['motivation', 'success', 'discipline', 'grind', 'mindset'],
    comedy: ['funny', 'hilarious', 'cringe', 'awkward', 'random'],
    educational: ['tips', 'advice', 'how_to', 'explained', 'guide'],
    lifestyle: ['life', 'family', 'travel', 'food', 'fashion'],
    trending: ['viral', 'trending', 'challenge', 'internet', 'fomo'],
    career: ['career', 'job', 'work', 'promotion', 'leadership'],
  };
}

export function getAllPopularKeywords(): string[] {
  const allKeywords: string[] = [];
  KEYWORD_CATEGORIES.forEach(cat => {
    allKeywords.push(...cat.keywords);
  });
  return [...new Set(allKeywords)];
}

// ============================================
// FEATURE 1: NATURAL LANGUAGE PROMPT INPUT
// ============================================

/**
 * Parse natural language prompts into structured input
 * Examples:
 * "Create a street interview about dating struggles for millennials" -> { type: 'street_interview', topic: 'dating_struggles', demographic: 'millennials' }
 * "Make me a funny video about money" -> { sentiment: 'funny', topic: 'money' }
 */
export interface NaturalLanguageParseResult {
  clipType?: ClipType;
  topic?: string;
  sentiment?: SentimentModifier;
  platform?: PlatformTarget;
  demographic?: SubjectDemographic;
  style?: string;
  confidence: number;
  parsedComponents: {
    original: string;
    transformed: string;
  }[];
}

const NATURAL_LANGUAGE_PATTERNS = [
  { pattern: /(?:create|make|generate|shoot)\s+(?:a|an)?\s*(street|subway|studio|motivational|wisdom)\s*(interview|video|clip)?/i, extract: (m: RegExpMatchArray) => ({ clipType: m[1].toLowerCase() + '_interview' }) },
  { pattern: /(?:funny|hilarious|comedy|humor)/i, extract: () => ({ sentiment: 'funny' }) },
  { pattern: /(?:sad|emotional|heartfelt|touching)/i, extract: () => ({ sentiment: 'sad' }) },
  { pattern: /(?:inspirational|motivational|uplifting)/i, extract: () => ({ sentiment: 'inspirational' }) },
  { pattern: /(?:shocking|surprising|unexpected)/i, extract: () => ({ sentiment: 'shocking' }) },
  { pattern: /(?:controversial|hot.?take|polarizing)/i, extract: () => ({ sentiment: 'controversial' }) },
  { pattern: /(?:educational|informative|helpful|tips?|advice)/i, extract: () => ({ sentiment: 'educational' }) },
  { pattern: /(?:for|targeting)\s+(tiktok|youtube|instagram)/i, extract: (m: RegExpMatchArray) => ({ platform: m[1].toLowerCase().replace('youtube', 'youtube_shorts') }) },
  { pattern: /(?:for|to)\s+(\w+)\s+(?:people|generation|demographic|audience)/i, extract: (m: RegExpMatchArray) => ({ demographic: mapDemographic(m[1]) }) },
  { pattern: /(?:about|on|regarding|topic:?)\s+([a-zA-Z\s]+?)(?:\s+for|\s+with|\s*$)/i, extract: (m: RegExpMatchArray) => ({ topic: m[1].trim().toLowerCase().replace(/\s+/g, '_') }) },
];

function mapDemographic(demographic: string): SubjectDemographic {
  const map: Record<string, SubjectDemographic> = {
    'gen': 'young_professional',
    'z': 'young_professional',
    'millennial': 'young_professional',
    'millennials': 'young_professional',
    'gen z': 'young_professional',
    'young': 'young_professional',
    'professional': 'young_professional',
    'middle': 'middle_aged',
    'middle-aged': 'middle_aged',
    'senior': 'senior',
    'elderly': 'senior',
    'older': 'senior',
  };
  return map[demographic.toLowerCase()] || 'any';
}

export function parseNaturalLanguagePrompt(input: string): NaturalLanguageParseResult {
  const result: NaturalLanguageParseResult = {
    confidence: 0,
    parsedComponents: [],
  };

  const usedPatterns: number[] = [];

  NATURAL_LANGUAGE_PATTERNS.forEach((rule, index) => {
    const match = input.match(rule.pattern);
    if (match && !usedPatterns.includes(index)) {
      const extracted = rule.extract(match);
      Object.assign(result, extracted);
      usedPatterns.push(index);
      result.confidence += 20;
      result.parsedComponents.push({
        original: match[0],
        transformed: JSON.stringify(extracted),
      });
    }
  });

  // If no patterns matched, try to extract topic from entire input
  if (result.confidence === 0) {
    result.topic = input.toLowerCase().trim().replace(/\s+/g, '_');
    result.confidence = 30;
    result.parsedComponents.push({
      original: input,
      transformed: `topic: "${result.topic}"`,
    });
  }

  return result;
}

// ============================================
// FEATURE 2: PROMPT TEMPLATES
// ============================================

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  variables: string[];
  example: string;
  viralPotential: 'high' | 'medium' | 'low';
}

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'hot_take',
    name: '🔥 Hot Take Challenge',
    description: 'Ask for controversial opinions that spark debate',
    template: 'Ask strangers on the street: "{topic}" - What\'s your hot take?',
    variables: ['topic'],
    example: 'Ask strangers: "What\'s your hot take on modern dating?"',
    viralPotential: 'high',
  },
  {
    id: 'story_time',
    name: '📖 Story Time',
    description: 'Personal narratives and life experiences',
    template: 'Ask people: "Tell me about a time when you learned an important lesson about {topic}"',
    variables: ['topic'],
    example: 'Ask: "Tell me about a time you learned an important lesson about money"',
    viralPotential: 'high',
  },
  {
    id: 'advice_column',
    name: '💡 Advice Column',
    description: 'Seek wisdom and advice on life topics',
    template: 'Ask older locals: "What advice would you give your younger self about {topic}?"',
    variables: ['topic'],
    example: 'Ask seniors: "What advice would you give your younger self about dating?"',
    viralPotential: 'medium',
  },
  {
    id: 'confession',
    name: '🤫 Confession Booth',
    description: 'People reveal secrets and admissions',
    template: 'Ask people to confess: "What\'s something you\'ve never admitted about {topic}?"',
    variables: ['topic'],
    example: 'Ask: "What\'s something you\'ve never admitted about your career?"',
    viralPotential: 'high',
  },
  {
    id: 'prediction',
    name: '🔮 Future Predictions',
    description: 'Ask about future trends and predictions',
    template: 'Ask people: "Where do you see {topic} going in the next 10 years?"',
    variables: ['topic'],
    example: 'Ask: "Where do you see remote work going in the next 10 years?"',
    viralPotential: 'medium',
  },
  {
    id: 'reaction',
    name: '😱 Stranger Reactions',
    description: 'Get genuine reactions to statements',
    template: 'Ask strangers to react: "How would you react if someone told you {topic}?"',
    variables: ['topic'],
    example: 'Ask: "How would you react if someone told you they never want to get married?"',
    viralPotential: 'high',
  },
  {
    id: 'comparison',
    name: '⚖️ Generation Gap',
    description: 'Compare different generations',
    template: 'Ask both young and old: "What\'s the biggest difference between how {topic} was then vs now?"',
    variables: ['topic'],
    example: 'Ask: "What\'s the biggest difference between dating then vs now?"',
    viralPotential: 'high',
  },
  {
    id: 'expert_verification',
    name: '👨‍🏫 Expert Fact Check',
    description: 'Verify or challenge common beliefs',
    template: 'Ask people to verify: "True or false: {topic} - What do you think?"',
    variables: ['topic'],
    example: 'Ask: "True or false: Money can\'t buy happiness - What do you think?"',
    viralPotential: 'medium',
  },
];

export function fillPromptTemplate(templateId: string, variables: Record<string, string>): string {
  const template = PROMPT_TEMPLATES.find(t => t.id === templateId);
  if (!template) return '';
  
  let filled = template.template;
  template.variables.forEach(v => {
    filled = filled.replace(new RegExp(`{${v}}`, 'g'), variables[v] || `{${v}}`);
  });
  
  return filled;
}

export function getTemplatesByViralPotential(potential: 'high' | 'medium' | 'low'): PromptTemplate[] {
  return PROMPT_TEMPLATES.filter(t => t.viralPotential === potential);
}

// ============================================
// FEATURE 4: PROMPT PRESETS (PRE-BUILT VIRAL PROMPTS)
// ============================================

export interface ViralPromptPreset {
  id: string;
  name: string;
  description: string;
  prompt: string;
  clipType: ClipType;
  sentiment: SentimentModifier;
  viralScore: number;
  tags: string[];
}

export const VIRAL_PROMPT_PRESETS: ViralPromptPreset[] = [
  {
    id: 'hot_dating_take',
    name: '🔥 Dating Hot Takes',
    description: 'Controversial dating opinions that spark debate',
    prompt: 'Stop people on the street and ask: "What\'s the most controversial dating opinion you have?" Watch the reactions and follow up on the most interesting answers.',
    clipType: 'street_interview',
    sentiment: 'controversial',
    viralScore: 95,
    tags: ['dating', 'controversial', 'street', 'opinion'],
  },
  {
    id: 'money_mindset_shift',
    name: '💰 Money Mindset Shifts',
    description: 'Bold financial opinions and wealth mindset',
    prompt: 'Ask passersby: "What\'s a money belief that most people have that you think is completely wrong?"',
    clipType: 'street_interview',
    sentiment: 'controversial',
    viralScore: 92,
    tags: ['money', 'finance', 'opinion', 'wealth'],
  },
  {
    id: 'relationship_regrets',
    name: '💔 Relationship Regrets',
    description: 'Emotional relationship stories and advice',
    prompt: 'Ask couples and singles: "What\'s a relationship mistake you made that you wish you could go back and fix?"',
    clipType: 'street_interview',
    sentiment: 'heartfelt',
    viralScore: 89,
    tags: ['relationships', 'dating', 'advice', 'emotional'],
  },
  {
    id: 'life_lessons_seniors',
    name: '🧓 Life Lessons from Seniors',
    description: 'Wisdom from older generations',
    prompt: 'Find seniors and ask: "What\'s one thing younger people today should know about {topic}?"',
    clipType: 'wisdom_interview',
    sentiment: 'inspirational',
    viralScore: 88,
    tags: ['wisdom', 'life lessons', 'seniors', 'advice'],
  },
  {
    id: 'grind_motivation',
    name: '🔥 Grind Mode Motivation',
    description: 'Intense motivational content for hustlers',
    prompt: 'Create motivational content: "What\'s a habit that changed your life and everyone should start doing?"',
    clipType: 'motivational',
    sentiment: 'inspirational',
    viralScore: 87,
    tags: ['motivation', 'success', 'hustle', 'discipline'],
  },
  {
    id: 'confession_booth',
    name: '🤫 Late Night Confessions',
    description: 'People reveal their deepest secrets',
    prompt: 'Set up a "confession booth" and ask: "What\'s something you\'ve done that you can never tell anyone in your life?"',
    clipType: 'street_interview',
    sentiment: 'shocking',
    viralScore: 96,
    tags: ['confession', 'secrets', 'shocking', 'dramatic'],
  },
  {
    id: 'unpopular_opinions',
    name: '🔥 Unpopular Opinions',
    description: 'Opinions that most people disagree with',
    prompt: 'Ask: "What\'s an opinion you have that you know most people will hate?"',
    clipType: 'street_interview',
    sentiment: 'controversial',
    viralScore: 94,
    tags: ['opinion', 'controversial', 'debate', 'hot take'],
  },
  {
    id: 'stranger_reactions',
    name: '😱 Strangers React',
    description: 'Genuine reactions to surprising statements',
    prompt: 'Approach strangers and say: "I need your honest reaction to something..." then share a surprising statement about {topic}.',
    clipType: 'street_interview',
    sentiment: 'shocking',
    viralScore: 93,
    tags: ['reaction', 'shocking', 'strangers', 'viral'],
  },
  {
    id: 'generations_clash',
    name: '⚖️ Generations React',
    description: 'Different generations react to the same topic',
    prompt: 'Interview both young (Gen Z) and older (Boomers) on the same {topic}: "How did you handle this when you were their age?" vs "How do you handle this today?"',
    clipType: 'street_interview',
    sentiment: 'relatable',
    viralScore: 91,
    tags: ['generations', 'comparison', 'relatable', 'debate'],
  },
  {
    id: 'expert_myth_busting',
    name: '👨‍🏫 Expert Myth Busting',
    description: 'Experts verify common beliefs',
    prompt: 'Find experts or knowledgeable people: "There\'s a common belief about {topic} that\'s actually false. What is it?"',
    clipType: 'studio_interview',
    sentiment: 'educational',
    viralScore: 85,
    tags: ['expert', 'education', 'myths', 'facts'],
  },
];

export function getPresetById(id: string): ViralPromptPreset | undefined {
  return VIRAL_PROMPT_PRESETS.find(p => p.id === id);
}

export function getPresetsByTag(tag: string): ViralPromptPreset[] {
  return VIRAL_PROMPT_PRESETS.filter(p => p.tags.includes(tag.toLowerCase()));
}

export function getPresetsByClipType(clipType: ClipType): ViralPromptPreset[] {
  return VIRAL_PROMPT_PRESETS.filter(p => p.clipType === clipType);
}

export function getTopViralPresets(limit: number = 5): ViralPromptPreset[] {
  return [...VIRAL_PROMPT_PRESETS].sort((a, b) => b.viralScore - a.viralScore).slice(0, limit);
}

// ============================================
// FEATURE 5: PROMPT VARIATIONS GENERATOR
// ============================================

export interface PromptVariation {
  id: string;
  variation: string;
  angle: string;
  viralPotential: number;
  sentiment: SentimentModifier;
}

export function generatePromptVariations(keyword: string, count: number = 5): PromptVariation[] {
  const base = keyword.toLowerCase().trim();
  const variations: PromptVariation[] = [];
  
  const variationTemplates: { template: string; angle: string; sentiment: SentimentModifier; baseScore: number }[] = [
    { template: 'What\'s the most embarrassing {keyword} story you\'ve experienced?', angle: 'Embarrassment & Relatability', sentiment: 'relatable', baseScore: 88 },
    { template: 'Hot take: {keyword} is harder today than ever before. Do you agree?', angle: 'Controversial Generation Gap', sentiment: 'controversial', baseScore: 92 },
    { template: 'Strangers react: What\'s your honest opinion on {keyword}?', angle: 'Genuine Reactions', sentiment: 'shocking', baseScore: 90 },
    { template: 'What {keyword} advice would you give your younger self?', angle: 'Regret & Wisdom', sentiment: 'heartfelt', baseScore: 85 },
    { template: 'Unpopular opinion: Everything people say about {keyword} is wrong. Thoughts?', angle: 'Polarizing Take', sentiment: 'controversial', baseScore: 94 },
    { template: 'Tell me something surprising about {keyword} that most people don\'t know', angle: 'Hidden Truths', sentiment: 'shocking', baseScore: 87 },
    { template: 'If you could change one thing about {keyword}, what would it be?', angle: 'Wishful Thinking', sentiment: 'relatable', baseScore: 82 },
    { template: 'The truth about {keyword} that nobody wants to admit', angle: 'Hard Truths', sentiment: 'shocking', baseScore: 91 },
    { template: 'Have you ever lied about {keyword}? What did you say?', angle: 'Confessions', sentiment: 'shocking', baseScore: 89 },
    { template: 'What\'s the biggest myth about {keyword} that needs to be debunked?', angle: 'Myth Busting', sentiment: 'educational', baseScore: 84 },
    { template: 'Stop doing this if you want to succeed at {keyword}', angle: 'Warning & Advice', sentiment: 'inspirational', baseScore: 86 },
    { template: 'Why {keyword} is actually simpler than you think', angle: 'Counterintuitive', sentiment: 'inspirational', baseScore: 83 },
    { template: 'Strangers on the street share their funniest {keyword} moments', angle: 'Comedy & Humor', sentiment: 'funny', baseScore: 90 },
    { template: 'What\'s a {keyword} lie you\'ve told yourself?', angle: 'Self-Deception', sentiment: 'relatable', baseScore: 85 },
    { template: 'The moment that changed everything about {keyword} in my life', angle: 'Transformation Story', sentiment: 'heartfelt', baseScore: 88 },
  ];
  
  // Shuffle and pick
  const shuffled = variationTemplates.sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(count, shuffled.length));
  
  selected.forEach((template, index) => {
    const variation = template.template.replace(/{keyword}/g, base);
    const viralScore = template.baseScore + Math.floor(Math.random() * 10) - 5;
    
    variations.push({
      id: `${base}_variation_${index + 1}`,
      variation,
      angle: template.angle,
      viralPotential: Math.min(100, Math.max(0, viralScore)),
      sentiment: template.sentiment,
    });
  });
  
  return variations.sort((a, b) => b.viralPotential - a.viralPotential);
}

// ============================================
// FEATURE 6: CONTEXT-AWARE PROMPTING
// ============================================

export interface ContextData {
  trendingTopics: string[];
  seasonalContext: string;
  platformTrends: Record<string, string[]>;
  userHistory?: {
    recentTopics: string[];
    topPerformingSentiments: SentimentModifier[];
  };
}

export interface ContextAwareSuggestion {
  suggestion: string;
  reason: string;
  relevanceScore: number;
  urgency: 'high' | 'medium' | 'low';
}

export function getContextAwareSuggestions(context: ContextData): ContextAwareSuggestion[] {
  const suggestions: ContextAwareSuggestion[] = [];
  
  // Trending topic matching
  context.trendingTopics.forEach(topic => {
    suggestions.push({
      suggestion: `Create content about "${topic}" - this is trending now`,
      reason: 'High engagement potential from trending topic',
      relevanceScore: 95,
      urgency: 'high',
    });
  });
  
  // Seasonal context
  const seasonalPrompts: Record<string, string[]> = {
    'spring': ['fresh starts', 'spring cleaning', 'outdoor activities', 'allergies', 'spring fashion'],
    'summer': ['vacation', 'beach', 'heat', 'travel', 'outdoor adventures'],
    'fall': ['back to school', 'pumpkin spice', 'cozy', 'Halloween', 'gratitude'],
    'winter': ['holiday', 'gift giving', 'new year', 'cold weather', ' cozy indoors'],
  };
  
  const month = new Date().getMonth();
  let season: string;
  if (month >= 2 && month <= 4) season = 'spring';
  else if (month >= 5 && month <= 7) season = 'summer';
  else if (month >= 8 && month <= 10) season = 'fall';
  else season = 'winter';
  
  seasonalPrompts[season]?.forEach(prompt => {
    suggestions.push({
      suggestion: `Seasonal angle: "${prompt}" - current season is ${season}`,
      reason: `Seasonal content performs well during ${season}`,
      relevanceScore: 75,
      urgency: 'medium',
    });
  });
  
  // Platform-specific trends
  Object.entries(context.platformTrends).forEach(([platform, trends]) => {
    trends.slice(0, 2).forEach(trend => {
      suggestions.push({
        suggestion: `${platform} trend: "${trend}" - optimize for ${platform}`,
        reason: `This trend is performing well on ${platform}`,
        relevanceScore: 85,
        urgency: 'high',
      });
    });
  });
  
  // User history-based suggestions
  if (context.userHistory) {
    context.userHistory.recentTopics.forEach(topic => {
      suggestions.push({
        suggestion: `Follow-up to "${topic}" - what people think now`,
        reason: 'Your audience is familiar with this topic',
        relevanceScore: 80,
        urgency: 'medium',
      });
    });
    
    context.userHistory.topPerformingSentiments.forEach(sentiment => {
      suggestions.push({
        suggestion: `Use "${sentiment}" sentiment - your audience engages most with this`,
        reason: 'Historical data shows high engagement with this sentiment',
        relevanceScore: 82,
        urgency: 'medium',
      });
    });
  }
  
  return suggestions.sort((a, b) => b.relevanceScore - a.relevanceScore);
}

// ============================================
// FEATURE 7: PROMPT SCORING & OPTIMIZATION
// ============================================

export interface PromptScoreResult {
  score: number;
  maxScore: number;
  grade: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F';
  breakdown: {
    criterion: string;
    points: number;
    maxPoints: number;
    feedback: string;
  }[];
  suggestions: {
    priority: 'high' | 'medium' | 'low';
    suggestion: string;
    scoreImpact: number;
  }[];
}

export function scoreAndOptimizePrompt(prompt: string, context?: { topic?: string; targetPlatform?: PlatformTarget }): PromptScoreResult {
  let score = 0;
  const maxScore = 100;
  const breakdown: PromptScoreResult['breakdown'] = [];
  const suggestions: PromptScoreResult['suggestions'] = [];
  
  // Hook strength (0-20 points)
  const hasHook = /^(stop|watch|wait|hear|guess|what|how|why|when|where|who)/i.test(prompt);
  if (hasHook) {
    score += 20;
    breakdown.push({ criterion: 'Strong hook', points: 20, maxPoints: 20, feedback: 'Prompt starts with attention-grabbing words' });
  } else {
    breakdown.push({ criterion: 'Hook strength', points: 5, maxPoints: 20, feedback: 'Add an attention-grabbing hook like "Stop people and ask..." or "What if..."' });
    suggestions.push({ priority: 'high', suggestion: 'Add a hook in the first 3-5 words', scoreImpact: 15 });
  }
  
  // Specificity (0-20 points)
  const wordCount = prompt.split(/\s+/).length;
  if (wordCount > 10 && wordCount < 50) {
    score += 15;
    breakdown.push({ criterion: 'Prompt length', points: 15, maxPoints: 15, feedback: 'Good length for viral content' });
  } else if (wordCount > 50) {
    score += 10;
    breakdown.push({ criterion: 'Prompt length', points: 10, maxPoints: 15, feedback: 'Consider shortening for punchier content' });
    suggestions.push({ priority: 'medium', suggestion: 'Shorten the prompt to 10-30 words for maximum impact', scoreImpact: 5 });
  } else {
    score += 5;
    breakdown.push({ criterion: 'Prompt length', points: 5, maxPoints: 15, feedback: 'Too short - add more context' });
    suggestions.push({ priority: 'high', suggestion: 'Add more detail to make the prompt specific', scoreImpact: 10 });
  }
  
  // Emotion trigger (0-20 points)
  const emotionalWords = prompt.match(/(?:honest|truth|secret|confession|shocking|surprising|embarrassing|regret|love|hate|fear|wish|believe|think|feel)/gi);
  if (emotionalWords && emotionalWords.length >= 2) {
    score += 20;
    breakdown.push({ criterion: 'Emotional trigger', points: 20, maxPoints: 20, feedback: 'Strong emotional words detected' });
  } else if (emotionalWords) {
    score += 12;
    breakdown.push({ criterion: 'Emotional trigger', points: 12, maxPoints: 20, feedback: 'Add more emotional triggers' });
    suggestions.push({ priority: 'medium', suggestion: 'Add emotional words like "truth", "secret", "regret", or "confession"', scoreImpact: 8 });
  } else {
    breakdown.push({ criterion: 'Emotional trigger', points: 0, maxPoints: 20, feedback: 'No emotional triggers found' });
    suggestions.push({ priority: 'high', suggestion: 'Add emotional triggers to increase engagement', scoreImpact: 20 });
  }
  
  // Actionable instruction (0-20 points)
  const hasAction = /(?:ask|stop|approach|interview|find|get|hear|see|watch|record)/i.test(prompt);
  if (hasAction) {
    score += 20;
    breakdown.push({ criterion: 'Actionable instruction', points: 20, maxPoints: 20, feedback: 'Clear action for the creator' });
  } else {
    breakdown.push({ criterion: 'Actionable instruction', points: 5, maxPoints: 20, feedback: 'Add clear action steps' });
    suggestions.push({ priority: 'medium', suggestion: 'Include actions like "Ask strangers..." or "Interview people..."', scoreImpact: 15 });
  }
  
  // Platform optimization (0-20 points)
  if (context?.targetPlatform) {
    const platformKeywords: Record<PlatformTarget, string[]> = {
      'tiktok': ['trend', 'viral', 'hack', 'react', 'duet', 'stitch'],
      'youtube_shorts': ['story', 'explained', 'challenge', 'reveal'],
      'instagram_reels': ['aesthetic', 'routine', 'day in', 'transformation'],
      'any': [],
    };
    
    const keywords = platformKeywords[context.targetPlatform];
    const hasPlatformOptimization = keywords.some(kw => prompt.toLowerCase().includes(kw));
    
    if (hasPlatformOptimization) {
      score += 20;
      breakdown.push({ criterion: 'Platform optimization', points: 20, maxPoints: 20, feedback: `Optimized for ${context.targetPlatform}` });
    } else {
      score += 10;
      breakdown.push({ criterion: 'Platform optimization', points: 10, maxPoints: 20, feedback: `Add ${context.targetPlatform}-specific keywords` });
      suggestions.push({ priority: 'low', suggestion: `Add ${context.targetPlatform} keywords like: ${keywords.join(', ')}`, scoreImpact: 10 });
    }
  } else {
    breakdown.push({ criterion: 'Platform optimization', points: 15, maxPoints: 20, feedback: 'No specific platform target (defaulting to any)' });
  }
  
  // Calculate grade
  const percentage = (score / maxScore) * 100;
  let grade: PromptScoreResult['grade'];
  if (percentage >= 95) grade = 'A+';
  else if (percentage >= 90) grade = 'A';
  else if (percentage >= 85) grade = 'B+';
  else if (percentage >= 80) grade = 'B';
  else if (percentage >= 75) grade = 'C+';
  else if (percentage >= 70) grade = 'C';
  else if (percentage >= 60) grade = 'D';
  else grade = 'F';
  
  return {
    score,
    maxScore,
    grade,
    breakdown,
    suggestions: suggestions.sort((a, _b) => (a.priority === 'high' ? -1 : 1)),
  };
}

// ============================================
// FEATURE 8: MULTI-PROMPT CHAINING
// ============================================

export interface PromptChain {
  id: string;
  name: string;
  description: string;
  prompts: string[];
  totalViralScore: number;
  flowType: 'interview' | 'reaction' | 'story' | 'debate';
}

export interface ChainedPromptResult {
  chain: PromptChain;
  combinedPrompt: string;
  individualAnalyses: KeywordAnalysis[];
  overallViralScore: number;
}

export function chainPrompts(prompts: string[]): ChainedPromptResult {
  const analyses = prompts.map(p => analyzeKeyword(p));
  const totalScore = analyses.reduce((sum, a) => sum + (a.viralScore?.score || 50), 0);
  const avgScore = Math.round(totalScore / prompts.length);
  
  // Generate chain based on patterns
  const flowType = detectFlowType(prompts);
  
  const chain: PromptChain = {
    id: `chain_${Date.now()}`,
    name: `${flowType.charAt(0).toUpperCase() + flowType.slice(1)} Chain`,
    description: `A ${flowType}-style content chain with ${prompts.length} prompts`,
    prompts,
    totalViralScore: avgScore,
    flowType,
  };
  
  const combinedPrompt = generateCombinedChainPrompt(prompts, flowType);
  
  return {
    chain,
    combinedPrompt,
    individualAnalyses: analyses,
    overallViralScore: avgScore,
  };
}

function detectFlowType(prompts: string[]): PromptChain['flowType'] {
  const combined = prompts.join(' ').toLowerCase();
  
  if (combined.includes('react') || combined.includes('reaction') || combined.includes('stranger')) {
    return 'reaction';
  }
  if (combined.includes('story') || combined.includes('experience') || combined.includes('time when')) {
    return 'story';
  }
  if (combined.includes('debate') || combined.includes('agree') || combined.includes('disagree') || combined.includes('versus')) {
    return 'debate';
  }
  return 'interview';
}

function generateCombinedChainPrompt(prompts: string[], flowType: PromptChain['flowType']): string {
  switch (flowType) {
    case 'reaction':
      return `REACTION CHAIN: 
1. ${prompts[0]}
2. Follow up: "Why do you feel that way?"
3. Escalate: "What would you do if..." 
4. Finale: "So your final verdict is..."`;
    
    case 'story':
      return `STORY ARC CHAIN:
1. Hook: "${prompts[0]}"
2. Context: "Tell me about the time..."
3. Challenge: "What was the hardest part?"
4. Resolution: "What did you learn?"
5. Takeaway: "If someone else is going through this..."`;
    
    case 'debate':
      return `DEBATE FORMAT:
1. ${prompts[0]}
2. Play devil's advocate: "But some people would say..."
3. Push back: "What about the opposite view?"
4. Synthesis: "So where do you land?"`;
    
    default:
      return prompts.join('\n\n→ ');
  }
}

// Pre-built prompt chains
export const PREBUILT_PROMPT_CHAINS: PromptChain[] = [
  {
    id: 'ultimate_reaction',
    name: '🔥 Ultimate Reaction Chain',
    description: 'Start with a hook, get initial reaction, deepen with follow-ups',
    prompts: [
      'Stop strangers and ask: "What\'s your hot take on modern dating?"',
      'When they answer, react with surprise and ask: "Wait, really? Why do you feel that way?"',
      'Escalate: "Okay, but what would you say to someone who totally disagrees with you?"',
      'Finale: "So your final, non-negotiable take is..."',
    ],
    totalViralScore: 94,
    flowType: 'reaction',
  },
  {
    id: 'wisdom_story',
    name: '🧓 Wisdom Story Arc',
    description: 'Extract life stories and lessons from elders',
    prompts: [
      'Find a senior and ask warmly: "What\'s something you\'ve learned in life that they don\'t teach in school?"',
      'Follow up with curiosity: "Can you tell me about a time when that lesson really mattered?"',
      'Deepen: "What was the hardest part of learning that?"',
      'Legacy: "What do you hope people remember about you?"',
    ],
    totalViralScore: 91,
    flowType: 'story',
  },
  {
    id: 'money_mindset',
    name: '💰 Money Mindset Deep Dive',
    description: 'Extract financial wisdom and controversies',
    prompts: [
      'Ask: "What\'s a money belief most people have that you think is totally wrong?"',
      'Probe: "Where did that belief come from? Your parents? Experience?"',
      'Challenge: "What\'s one financial mistake you made that taught you the most?"',
      'Advice: "What\'s the one thing every young person should know about money?"',
    ],
    totalViralScore: 93,
    flowType: 'debate',
  },
  {
    id: 'relationship_advice',
    name: '💕 Relationship Advice Chain',
    description: 'Get relationship wisdom from all angles',
    prompts: [
      'Ask couples: "What\'s one thing you wish you knew before getting married?"',
      'Ask singles: "What\'s a red flag you\'ve learned to spot?"',
      'Ask divorced: "What went wrong that others could learn from?"',
      'Synthesis: "What\'s the one universal truth about relationships?"',
    ],
    totalViralScore: 92,
    flowType: 'story',
  },
];

export function getChainById(id: string): PromptChain | undefined {
  return PREBUILT_PROMPT_CHAINS.find(c => c.id === id);
}

// ============================================
// FEATURE 9: PROMPT LIBRARY BY CATEGORY
// ============================================

export interface PromptLibraryCategory {
  id: KeywordCategory;
  name: string;
  emoji: string;
  prompts: {
    id: string;
    name: string;
    prompt: string;
    clipType: ClipType;
    viralScore: number;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
  }[];
}

export const PROMPT_LIBRARY: PromptLibraryCategory[] = [
  {
    id: 'money',
    name: 'Money & Finance',
    emoji: '💰',
    prompts: [
      { id: 'money_1', name: 'Money Mindset', prompt: 'Ask: "What\'s a money belief that most people have that you think is totally wrong?"', clipType: 'street_interview', viralScore: 92, difficulty: 'beginner' },
      { id: 'money_2', name: 'Financial Regrets', prompt: 'Ask: "What\'s the biggest money mistake you\'ve ever made?"', clipType: 'street_interview', viralScore: 89, difficulty: 'beginner' },
      { id: 'money_3', name: 'Rich Habits', prompt: 'Ask wealthy-seeming people: "What\'s a daily habit that helped you build wealth?"', clipType: 'street_interview', viralScore: 88, difficulty: 'intermediate' },
      { id: 'money_4', name: 'Money Lies', prompt: 'Ask: "What\'s a lie people tell themselves about money?"', clipType: 'street_interview', viralScore: 91, difficulty: 'beginner' },
      { id: 'money_5', name: 'Salary Transparency', prompt: 'Ask: "How much do you make and do you think it\'s fair?"', clipType: 'street_interview', viralScore: 94, difficulty: 'advanced' },
      { id: 'money_6', name: 'Investment Advice', prompt: 'Ask financial advisors: "What\'s the biggest mistake beginners make with investing?"', clipType: 'studio_interview', viralScore: 85, difficulty: 'intermediate' },
      { id: 'money_7', name: 'Side Hustle Stories', prompt: 'Ask: "What\'s a side hustle that actually made you real money?"', clipType: 'street_interview', viralScore: 87, difficulty: 'beginner' },
      { id: 'money_8', name: 'Debt Freedom', prompt: 'Ask people who paid off debt: "How did you do it and how long did it take?"', clipType: 'street_interview', viralScore: 86, difficulty: 'intermediate' },
      { id: 'money_9', name: 'Generational Wealth', prompt: 'Ask wealthy families: "What\'s the secret to keeping wealth in the family?"', clipType: 'studio_interview', viralScore: 84, difficulty: 'advanced' },
      { id: 'money_10', name: 'Money and Happiness', prompt: 'Ask: "True or false: Money can\'t buy happiness. What do you think?"', clipType: 'street_interview', viralScore: 90, difficulty: 'beginner' },
    ],
  },
  {
    id: 'dating',
    name: 'Dating & Relationships',
    emoji: '💕',
    prompts: [
      { id: 'dating_1', name: 'Dating Regrets', prompt: 'Ask: "What\'s a dating mistake you wish you could go back and fix?"', clipType: 'street_interview', viralScore: 91, difficulty: 'beginner' },
      { id: 'dating_2', name: 'Red Flags', prompt: 'Ask: "What\'s a dating red flag you ignored that you wish you hadn\'t?"', clipType: 'street_interview', viralScore: 93, difficulty: 'beginner' },
      { id: 'dating_3', name: 'Love Stories', prompt: 'Ask couples: "How did you meet and what made you know they were the one?"', clipType: 'street_interview', viralScore: 89, difficulty: 'beginner' },
      { id: 'dating_4', name: 'Hot Takes', prompt: 'Ask: "What\'s a controversial opinion about dating you have?"', clipType: 'street_interview', viralScore: 95, difficulty: 'beginner' },
      { id: 'dating_5', name: 'Modern Dating', prompt: 'Ask: "What\'s the hardest thing about dating today?"', clipType: 'street_interview', viralScore: 90, difficulty: 'beginner' },
      { id: 'dating_6', name: 'Marriage Advice', prompt: 'Ask married couples: "What\'s one thing that keeps your marriage strong?"', clipType: 'street_interview', viralScore: 88, difficulty: 'intermediate' },
      { id: 'dating_7', name: 'Breakup Wisdom', prompt: 'Ask people who\'ve been through breakups: "What\'s the best way to get over someone?"', clipType: 'street_interview', viralScore: 87, difficulty: 'intermediate' },
      { id: 'dating_8', name: 'Online Dating', prompt: 'Ask: "What\'s the worst dating app experience you\'ve ever had?"', clipType: 'street_interview', viralScore: 92, difficulty: 'beginner' },
      { id: 'dating_9', name: 'Relationship Truths', prompt: 'Ask: "What\'s an uncomfortable truth about relationships nobody wants to admit?"', clipType: 'street_interview', viralScore: 94, difficulty: 'advanced' },
      { id: 'dating_10', name: 'First Date Advice', prompt: 'Ask: "What\'s a first date mistake that immediately kills the chemistry?"', clipType: 'street_interview', viralScore: 88, difficulty: 'beginner' },
    ],
  },
  {
    id: 'career',
    name: 'Career & Success',
    emoji: '💼',
    prompts: [
      { id: 'career_1', name: 'Career Mistakes', prompt: 'Ask: "What\'s the biggest career mistake you\'ve ever made?"', clipType: 'street_interview', viralScore: 88, difficulty: 'beginner' },
      { id: 'career_2', name: 'Job Interviews', prompt: 'Ask hiring managers: "What\'s a mistake candidates always make in interviews?"', clipType: 'street_interview', viralScore: 86, difficulty: 'intermediate' },
      { id: 'career_3', name: 'Success Habits', prompt: 'Ask successful people: "What\'s a daily habit that contributed to your success?"', clipType: 'studio_interview', viralScore: 87, difficulty: 'intermediate' },
      { id: 'career_4', name: 'Career Changes', prompt: 'Ask people who switched careers: "How did you know it was time to change?"', clipType: 'street_interview', viralScore: 85, difficulty: 'intermediate' },
      { id: 'career_5', name: 'Work-Life Balance', prompt: 'Ask: "What\'s the biggest work-life balance mistake you\'ve made?"', clipType: 'street_interview', viralScore: 84, difficulty: 'beginner' },
      { id: 'career_6', name: 'Leadership', prompt: 'Ask leaders: "What\'s a leadership lesson that took you years to learn?"', clipType: 'studio_interview', viralScore: 83, difficulty: 'advanced' },
      { id: 'career_7', name: 'Job Hunting', prompt: 'Ask recruiters: "What\'s the biggest red flag you see in candidates?"', clipType: 'studio_interview', viralScore: 85, difficulty: 'intermediate' },
      { id: 'career_8', name: 'Salary Negotiation', prompt: 'Ask: "What\'s a salary negotiation tactic that actually works?"', clipType: 'street_interview', viralScore: 89, difficulty: 'intermediate' },
      { id: 'career_9', name: 'Career Advice', prompt: 'Ask older professionals: "What advice would you give your 20-year-old self about work?"', clipType: 'wisdom_interview', viralScore: 86, difficulty: 'beginner' },
      { id: 'career_10', name: 'Dream Job', prompt: 'Ask: "What\'s your dream job and why haven\'t you gone for it?"', clipType: 'street_interview', viralScore: 84, difficulty: 'beginner' },
    ],
  },
  {
    id: 'wisdom',
    name: 'Life Wisdom',
    emoji: '🧓',
    prompts: [
      { id: 'wisdom_1', name: 'Life Lessons', prompt: 'Ask seniors: "What\'s one thing you wish you knew at 20?"', clipType: 'wisdom_interview', viralScore: 91, difficulty: 'beginner' },
      { id: 'wisdom_2', name: 'Regrets', prompt: 'Ask older people: "What\'s your biggest life regret and what did you learn?"', clipType: 'wisdom_interview', viralScore: 93, difficulty: 'intermediate' },
      { id: 'wisdom_3', name: 'Happiness', prompt: 'Ask centenarians or seniors: "What\'s the secret to a happy life?"', clipType: 'wisdom_interview', viralScore: 90, difficulty: 'beginner' },
      { id: 'wisdom_4', name: 'Relationships', prompt: 'Ask married couples 50+ years: "What\'s the secret to a lasting marriage?"', clipType: 'wisdom_interview', viralScore: 92, difficulty: 'beginner' },
      { id: 'wisdom_5', name: 'Parenthood', prompt: 'Ask parents: "What\'s something nobody tells you about being a parent?"', clipType: 'street_interview', viralScore: 88, difficulty: 'beginner' },
      { id: 'wisdom_6', name: 'Forgiveness', prompt: 'Ask: "What\'s something you had to forgive yourself for?"', clipType: 'wisdom_interview', viralScore: 89, difficulty: 'advanced' },
      { id: 'wisdom_7', name: 'Change', prompt: 'Ask people who\'ve been through major life changes: "How did you adapt?"', clipType: 'wisdom_interview', viralScore: 86, difficulty: 'intermediate' },
      { id: 'wisdom_8', name: 'Legacy', prompt: 'Ask seniors: "What do you want to be remembered for?"', clipType: 'wisdom_interview', viralScore: 94, difficulty: 'beginner' },
      { id: 'wisdom_9', name: 'Gratitude', prompt: 'Ask: "What\'s something you\'re grateful for that most people take for granted?"', clipType: 'wisdom_interview', viralScore: 87, difficulty: 'beginner' },
      { id: 'wisdom_10', name: 'Second Acts', prompt: 'Ask people who started over: "How did you find the courage to begin again?"', clipType: 'wisdom_interview', viralScore: 88, difficulty: 'intermediate' },
    ],
  },
  {
    id: 'motivational',
    name: 'Motivation & Success',
    emoji: '🚀',
    prompts: [
      { id: 'motivation_1', name: 'Morning Routines', prompt: 'Ask successful people: "What does your morning routine look like?"', clipType: 'studio_interview', viralScore: 86, difficulty: 'beginner' },
      { id: 'motivation_2', name: 'Discipline', prompt: 'Ask: "What\'s a habit that changed your life?"', clipType: 'motivational', viralScore: 88, difficulty: 'beginner' },
      { id: 'motivation_3', name: 'Failure', prompt: 'Ask successful people: "What\'s your biggest failure and what did it teach you?"', clipType: 'motivational', viralScore: 92, difficulty: 'intermediate' },
      { id: 'motivation_4', name: 'Overcoming Obstacles', prompt: 'Ask: "What\'s an obstacle you thought you\'d never overcome?"', clipType: 'motivational', viralScore: 91, difficulty: 'intermediate' },
      { id: 'motivation_5', name: 'Dreams', prompt: 'Ask: "What\'s a dream you gave up on and do you regret it?"', clipType: 'street_interview', viralScore: 87, difficulty: 'intermediate' },
      { id: 'motivation_6', name: 'Mindset', prompt: 'Ask: "What\'s a mindset shift that changed everything for you?"', clipType: 'motivational', viralScore: 89, difficulty: 'beginner' },
      { id: 'motivation_7', name: 'Hustle', prompt: 'Ask entrepreneurs: "What\'s the hardest part of the hustle nobody talks about?"', clipType: 'studio_interview', viralScore: 85, difficulty: 'intermediate' },
      { id: 'motivation_8', name: 'Inspiration', prompt: 'Ask: "Who inspires you and why?"', clipType: 'street_interview', viralScore: 83, difficulty: 'beginner' },
      { id: 'motivation_9', name: 'No Excuses', prompt: 'Ask: "What\'s an excuse you used to make and what changed?"', clipType: 'motivational', viralScore: 86, difficulty: 'intermediate' },
      { id: 'motivation_10', name: 'Champion Mindset', prompt: 'Ask athletes or competitors: "What\'s the mindset that separates winners from losers?"', clipType: 'motivational', viralScore: 90, difficulty: 'intermediate' },
    ],
  },
];

export function getPromptsByCategory(categoryId: KeywordCategory): PromptLibraryCategory | undefined {
  return PROMPT_LIBRARY.find(c => c.id === categoryId);
}

export function getAllPrompts(): PromptLibraryCategory[] {
  return PROMPT_LIBRARY;
}

export function searchPrompts(query: string): { category: PromptLibraryCategory; matches: PromptLibraryCategory['prompts'] }[] {
  const results: { category: PromptLibraryCategory; matches: PromptLibraryCategory['prompts'] }[] = [];
  const lowerQuery = query.toLowerCase();
  
  PROMPT_LIBRARY.forEach(category => {
    const matches = category.prompts.filter(p => 
      p.name.toLowerCase().includes(lowerQuery) ||
      p.prompt.toLowerCase().includes(lowerQuery) ||
      category.id.toLowerCase().includes(lowerQuery)
    );
    
    if (matches.length > 0) {
      results.push({ category, matches });
    }
  });
  
  return results;
}

// ============================================
// FEATURE 10: AI PROMPT REFINEMENT
// ============================================

export interface RefinementSuggestion {
  original: string;
  refined: string;
  reason: string;
  improvementScore: number;
}

export interface ClarificationQuestion {
  question: string;
  options?: string[];
  purpose: string;
}

export function refinePrompt(userInput: string): { refined: string; suggestions: RefinementSuggestion[] } {
  const suggestions: RefinementSuggestion[] = [];
  let refined = userInput;
  
  // Detect vague inputs and suggest refinements
  const vaguePatterns = [
    { pattern: /\b(make|create|do|get)\s+(me|some)\s+(\w+)\s+(video|content|stuff)\b/i, suggestion: 'Add specifics', improvement: 25 },
    { pattern: /\b(about|on)\s+(something|things|stuff)\b/i, suggestion: 'Be more specific about the topic', improvement: 30 },
    { pattern: /\b(funny|interesting|cool)\s+(video|stuff|thing)s?\b/i, suggestion: 'Define the exact angle or topic', improvement: 35 },
    { pattern: /^[\s\S]{1,3}$/, suggestion: 'Add more detail to your prompt', improvement: 40 },
  ];
  
  vaguePatterns.forEach(({ pattern, suggestion, improvement }) => {
    if (pattern.test(userInput)) {
      suggestions.push({
        original: userInput,
        refined: userInput,
        reason: `Your prompt is too vague. ${suggestion}.`,
        improvementScore: improvement,
      });
    }
  });
  
  // Suggest adding emotional triggers
  const emotionalTriggers = ['secret', 'truth', 'confession', 'regret', 'mistake', 'lesson', 'story', 'advice', 'opinion'];
  const hasEmotionalTrigger = emotionalTriggers.some(t => userInput.toLowerCase().includes(t));
  
  if (!hasEmotionalTrigger) {
    suggestions.push({
      original: userInput,
      refined: userInput,
      reason: 'Add an emotional trigger like "secret", "truth", "confession", or "regret" for more engagement',
      improvementScore: 20,
    });
  }
  
  // Suggest adding action verbs
  const actionVerbs = ['ask', 'stop', 'approach', 'interview', 'find', 'get', 'hear', 'see'];
  const hasActionVerb = actionVerbs.some(v => userInput.toLowerCase().includes(v));
  
  if (!hasActionVerb) {
    suggestions.push({
      original: userInput,
      refined: `Ask strangers: "${userInput}"`,
      reason: 'Adding an action like "Ask strangers" makes the prompt clearer and more actionable',
      improvementScore: 15,
    });
  }
  
  return {
    refined: refined,
    suggestions,
  };
}

export function askClarifyingQuestions(topic: string): ClarificationQuestion[] {
  const questions: ClarificationQuestion[] = [];
  
  // Detect topic category
  const topicLower = topic.toLowerCase();
  
  if (topicLower.includes('dating') || topicLower.includes('relationship') || topicLower.includes('love')) {
    questions.push({
      question: 'What aspect of dating/relationships interests you most?',
      options: ['Advice & Tips', 'Regrets & Mistakes', 'Hot Takes', 'Love Stories', 'Red Flags'],
      purpose: 'To focus the prompt on a specific angle',
    });
  } else if (topicLower.includes('money') || topicLower.includes('finance') || topicLower.includes('career')) {
    questions.push({
      question: 'What money/career angle would you like?',
      options: ['Mistakes to Avoid', 'Success Habits', 'Advice', 'Confessions', 'Regrets'],
      purpose: 'To determine the emotional direction',
    });
  } else if (topicLower.includes('wisdom') || topicLower.includes('life') || topicLower.includes('advice')) {
    questions.push({
      question: 'Who should we interview for this wisdom content?',
      options: ['Seniors (60+)', 'Successful People', 'Parents', 'Anyone with life experience'],
      purpose: 'To select the right subjects',
    });
  }
  
  // Always ask about sentiment/tone
  questions.push({
    question: 'What tone should this content have?',
    options: ['Funny/Humorous', 'Emotional/Heartfelt', 'Inspirational', 'Controversial/Hot Take', 'Educational'],
    purpose: 'To optimize for viral potential',
  });
  
  // Ask about format
  questions.push({
    question: 'What format works best for your audience?',
    options: ['Street Interview', 'Confession Booth', 'Story Time', 'Expert Advice', 'Reaction Video'],
    purpose: 'To select the right clip type',
  });
  
  return questions;
}

export function generateRefinedPrompt(
  topic: string,
  options: {
    clipType?: ClipType;
    sentiment?: SentimentModifier;
    demographic?: SubjectDemographic;
    angle?: string;
  }
): string {
  const parts: string[] = [];
  
  // Start with action
  const actions: Record<ClipType, string> = {
    'street_interview': 'Stop people on the street and ask',
    'subway_interview': 'Catch commuters on the subway and ask',
    'studio_interview': 'Sit down for a deep interview and ask',
    'motivational': 'Deliver a powerful message about',
    'wisdom_interview': 'Sit down with someone wise and ask',
  };
  
  parts.push(actions[options.clipType || 'street_interview']);
  
  // Add the core question with angle
  if (options.angle) {
    parts.push(`"${options.angle} about ${topic}"`);
  } else {
    parts.push(`"What's your experience with ${topic}?"`);
  }
  
  // Add sentiment modifier
  const sentimentAddons: Record<SentimentModifier, string> = {
    'funny': '- Look for humorous responses and reactions',
    'sad': '- Dig deeper into emotional stories',
    'inspirational': '- Focus on uplifting stories and lessons',
    'shocking': '- Probe for surprising confessions and revelations',
    'controversial': '- Push for unpopular opinions and hot takes',
    'heartfelt': '- Capture genuine, emotional moments',
    'angry': '- Ask about frustrating experiences and pet peeves',
    'relatable': '- Focus on universal experiences everyone has had',
    'educational': '- Seek expert advice and tips',
    'mysterious': '- Hint at hidden truths and secrets',
  };
  
  if (options.sentiment) {
    parts.push(sentimentAddons[options.sentiment]);
  }
  
  // Add demographic targeting
  if (options.demographic && options.demographic !== 'any') {
    const demographics: Record<string, string> = {
      'gen_z': '- Target Gen Z respondents (18-26)',
      'millennial': '- Target Millennials (27-42)',
      'young_professional': '- Target young professionals (25-35)',
      'middle_aged': '- Target middle-aged respondents (43-58)',
      'senior': '- Target seniors (60+)',
      'college_student': '- Target college students (18-24)',
      'business_exec': '- Target business executives',
      'creative_type': '- Target creative professionals',
      'fitness_enthusiast': '- Target fitness enthusiasts',
    };
    
    if (demographics[options.demographic]) {
      parts.push(demographics[options.demographic]);
    }
  }
  
  // Add follow-up instruction
  parts.push('- Follow up on the most interesting answers for deeper insights');
  
  return parts.join('\n');
}

export function autocompletePrompt(partial: string): string[] {
  const completions: string[] = [];
  const lower = partial.toLowerCase();
  
  // Common completions based on partial input
  const patterns: Record<string, string[]> = {
    'ask': [
      'Ask strangers: "What\'s your hot take on',
      'Ask: "What\'s a mistake you\'ve made about',
      'Ask seniors: "What advice would you give',
      'Ask couples: "What\'s the secret to',
      'Ask: "What\'s something nobody tells you about',
    ],
    'stop': [
      'Stop people on the street and ask: "What\'s your opinion on',
      'Stop strangers and ask: "Can I get your honest reaction to',
      'Stop people: "What\'s the biggest',
    ],
    'tell': [
      'Tell me about a time when you learned an important lesson about',
      'Tell me something surprising about',
      'Tell me your best advice for someone dealing with',
    ],
    'what': [
      'What\'s a hot take you have about',
      'What\'s the most controversial opinion you have about',
      'What\'s a secret about',
      'What\'s something you wish you knew about',
      'What\'s the biggest mistake people make with',
    ],
    'where': [
      'Where do you see',
      'Where did you go wrong with',
      'Where did you learn',
    ],
    'why': [
      'Why do you think people',
      'Why is',
      'Why did you',
    ],
    'how': [
      'How did you overcome',
      'How would you handle',
      'How do you deal with',
    ],
  };
  
  // Find matching pattern
  Object.entries(patterns).forEach(([key, options]) => {
    if (lower.startsWith(key) || lower.includes(key)) {
      completions.push(...options);
    }
  });
  
  // If no pattern matches, suggest common templates
  if (completions.length === 0) {
    completions.push(
      'Ask strangers: "What\'s your hot take on {topic}?"',
      'Ask: "What\'s a secret about {topic} nobody knows?"',
      'Stop people: "What\'s your honest reaction to {topic}?"',
      'Ask seniors: "What advice would you give about {topic}?"',
      'Tell me about your experience with {topic}',
    );
  }
  
  // Filter by relevance and return top 3
  return completions.filter(c => c.toLowerCase().includes(lower) || !lower).slice(0, 3);
}
