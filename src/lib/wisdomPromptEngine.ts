import type {
  WisdomTone,
  WisdomFormat,
  WisdomDemographic,
  WisdomSetting,
  BrollTag,
  WisdomScript,
} from './types';

// 55+ Wisdom content system prompt rules
const WISDOM_SYSTEM_PROMPT = `You are creating a short-form interview video (9:16) designed for audiences 55+.

CORE IDENTITY:
- The interviewee(s) are 55-75 years old, gray hair, calm confidence.
- The advice is grounded, respectful, and practical.
- The voice is wise and conversational, not trendy or sarcastic.
- No stereotypes. No mocking age. No "boomer" jokes.
- Respectful disagreement only—no shouting, no aggression.

VOICE & WRITING RULES:
- No slang overload (no "literally", "slay", "queen", etc.)
- Short sentences, clear and direct
- Phrases like: "I've learned..." "Here's what I wish I knew..." "What matters is..."
- Optimistic realism, not toxic positivity
- Measured delivery with thoughtful pauses implied

VISUAL CASTING RULES:
- Interviewees: 55-75 years old, gray or silver hair visible
- Natural faces, confident posture, no filter-looks
- Wardrobe: smart casual, simple, timeless (no logos, no trendy clothes)
- Vibe: calm, grounded, real-world experience

TOPIC FRAMING RULES:
Everything becomes "life-tested advice," even debate topics:
- Money -> retirement, budgeting, avoiding scams, healthcare costs
- Relationships -> second marriages, empty nest, loneliness, boundaries
- Health -> mobility, sleep, stress, purpose, longevity
- Work -> reinvention, late-career pivots, consulting, mentorship
- Life -> regrets, freedom, legacy, what's worth worrying about`;

// Wisdom tone prompts for video generation
const WISDOM_TONE_PROMPTS: Record<WisdomTone, string> = {
  gentle: 'Warm, patient delivery with soft tone. Subject speaks like speaking to a dear friend. Gentle smile, kind eyes, unhurried pacing. Calm, supportive energy.',
  direct: 'No-nonsense, straightforward advice. Matter-of-fact delivery. Clear, honest opinions without being harsh. Confident, authoritative but not aggressive.',
  funny: 'Dry wit, self-deprecating humor, clever observations. Light-hearted moments without being silly. Witty, charming, makes you smile not laugh out loud.',
  heartfelt: 'Emotionally genuine, vulnerable moments. Touching stories, sincere appreciation. Warmth in voice, genuine connection. Moving without being maudlin.',
};

// Wisdom format descriptions
const WISDOM_FORMAT_PROMPTS: Record<WisdomFormat, string> = {
  motivation: 'Uplifting interview format. Subject shares wisdom to inspire. Warm lighting, supportive atmosphere. Focus on hope, possibility, encouragement.',
  street_conversation: 'Documentary-style street interview. Casual setting, natural light. Curious, conversational exchange. Real-world wisdom in everyday settings.',
  subway_take: 'Debate/discussion format but respectful. Interviewer agrees or gently challenges. Short back-and-forth. No shouting, just thoughtful exchange.',
};

// Setting prompts for different wisdom environments
const WISDOM_SETTING_PROMPTS: Record<WisdomSetting, string> = {
  park_bench: 'City park setting, green trees visible, park bench where locals gather. Relaxed outdoor atmosphere, natural daylight, peaceful urban oasis.',
  coffee_shop: 'Cozy coffee shop interior, warm lighting, comfortable seating. Ambient cafe sounds, familiar neighborhood spot. Intimate conversation vibe.',
  living_room: 'Comfortable home living room, soft furniture, personal touches visible. Family photos, bookshelves, lived-in warmth. Intimate, trusted space.',
  library: 'Quiet public library, tall bookshelves, soft ambient sounds. Scholarly atmosphere, thoughtful setting. Wisdom of ages surrounding the conversation.',
  main_street: 'Charming main street or town square, local businesses visible. Community atmosphere, familiar faces passing. Small-town America feel.',
  subway_platform: 'Calm subway platform, not rush hour. Quiet moment for reflection. Urban transit setting, everyday wisdom in passing.',
  community_center: 'Community center or senior center, activity room or common area. Group setting, shared wisdom. Warm, social atmosphere.',
};

// Demographic prompts for different 55+ audience segments
const WISDOM_DEMOGRAPHIC_PROMPTS: Record<WisdomDemographic, string> = {
  retirees: 'Active retiree, clearly enjoying post-work life. Traveling, hobbies, grandchildren, community involvement. Vital and engaged, not slowing down.',
  grandparents: 'Proud grandparent sharing family wisdom. Warm, loving, occasionally teasing about grandchildren. Generational connection.',
  late_career: 'Still working or recently retired professional. Career wisdom, professional advice. Experienced, respected, knowledgeable.',
  caregivers: 'Someone with caregiving experience (parents, spouse, grandchildren). Compassionate, patient, wise about sacrifice and love.',
  reinventors: 'Someone who started over later in life. New career, new city, new chapter. Courageous, inspiring, relatable struggles.',
  mentors: 'Natural mentor figure, always helping others. Guiding energy, eager to share lessons learned. Sage-like but accessible.',
};

// B-roll tags for 55+ lifestyle + city vibe
const BROLL_TAGS: BrollTag[] = [
  'morning_walk', 'coffee_shop', 'park_bench', 'subway_platform', 'library',
  'garden', 'grandchildren', 'community_center', 'town_square', 'farmers_market',
  'city_street', 'train_arrival', 'neighborhood_walk', 'window_light', 'bookshelf',
  'family_photos', 'gardening', 'walking_dog', 'breakfast_table', 'porch_swing',
  'church_service', 'senior_center', 'medical_office', 'bank_lobby', 'post_office',
];

// Wisdom script templates by format
const WISDOM_SCRIPT_TEMPLATES: Record<WisdomFormat, { hook_examples: string[]; structure: { type: string; description: string }[] }> = {
  motivation: {
    hook_examples: [
      'What is the one thing you wish you knew at 30 that you know now?',
      'What keeps you going after 60?',
      'What is the secret to feeling useful after retirement?',
      'What is the best lesson you learned the hard way?',
      'How do you stay hopeful when your body changes?',
    ],
    structure: [
      { type: 'hook', description: 'Scroll-stopping question about life wisdom' },
      { type: 'take', description: 'Subject shares their core insight' },
      { type: 'story', description: 'Brief story or example that illustrates the wisdom' },
      { type: 'advice', description: 'Actionable takeaway for viewers' },
    ],
  },
  street_conversation: {
    hook_examples: [
      'Ask older adults: What do younger people get wrong about aging?',
      'Ask seniors: What is one boundary you wish you set earlier?',
      'What is the best way to stay sharp mentally?',
      'How do you make new friends after 55?',
      'What is a simple joy you did not appreciate before?',
    ],
    structure: [
      { type: 'question', description: 'Interviewer asks thought-provoking question' },
      { type: 'response', description: 'Subject provides thoughtful answer' },
      { type: 'follow_up', description: 'Brief clarification or deeper exploration' },
    ],
  },
  subway_take: {
    hook_examples: [
      'Retirement is overrated.',
      'People should downsize their home after 55.',
      'Adult kids should live at home longer.',
      'Social media is hurting family relationships.',
      'It is never too late to reinvent yourself.',
      'Working part-time after retirement is the best.',
      'Most people ignore friendships too long.',
    ],
    structure: [
      { type: 'take', description: 'Subject states their opinion clearly' },
      { type: 'interviewer_reaction', description: 'Interviewer agrees or gently challenges' },
      { type: 'discussion', description: '1-3 short back-and-forth exchanges' },
    ],
  },
};

// Generate wisdom-themed topics from user prompt
export function generateWisdomTopics(userPrompt: string): string[] {
  const prompt = userPrompt.toLowerCase();
  
  const topicMappings: Record<string, string[]> = {
    money: [
      'Retirement savings strategies',
      'Avoiding financial scams',
      'Healthcare costs in retirement',
      'Budgeting after 60',
      'Leaving a financial legacy',
    ],
    relationships: [
      'Second marriages and blending families',
      'Empty nest relationships',
      'Setting boundaries with adult children',
      'Loneliness in older adults',
      'Maintaining friendships after retirement',
    ],
    health: [
      'Staying fit after 60',
      'Sleep and aging',
      'Mental health and purpose',
      'Managing chronic conditions',
      'Healthy longevity habits',
    ],
    work: [
      'Late-career reinvention',
      'Retirement or consulting?',
      'Mentoring younger workers',
      'Starting a business later in life',
      'Work-life balance finally achieved',
    ],
    life: [
      'Regrets and lessons learned',
      'Freedom after retirement',
      'Legacy and what matters',
      'What is worth worrying about',
      'Finding purpose after work',
    ],
    family: [
      'Relationships with grandchildren',
      'Helping adult children without overstepping',
      'Family traditions and changes',
      'Holiday gatherings and aging',
      'Being a grandparent vs parent',
    ],
  };
  
  const detectedTopics: string[] = [];
  
  for (const [keyword, topics] of Object.entries(topicMappings)) {
    if (prompt.includes(keyword)) {
      detectedTopics.push(...topics);
    }
  }
  
  // Default topics if no keywords matched
  if (detectedTopics.length === 0) {
    return [
      'Life lessons learned',
      'What matters most',
      'Advice for younger generations',
      'Finding joy in everyday moments',
      'Lessons from a long life',
    ];
  }
  
  return [...new Set(detectedTopics)].slice(0, 5);
}

// Main wisdom prompt generator
export function buildWisdomPrompt(
  topic: string,
  durationSeconds: number,
  options: {
    tone?: WisdomTone;
    format?: WisdomFormat;
    demographic?: WisdomDemographic;
    setting?: WisdomSetting;
    angle?: string;
  }
): string {
  const tone = options.tone || 'gentle';
  const format = options.format || 'street_conversation';
  const demographic = options.demographic || 'retirees';
  const setting = options.setting || 'park_bench';

  const tonePrompt = WISDOM_TONE_PROMPTS[tone];
  const formatPrompt = WISDOM_FORMAT_PROMPTS[format];
  const demographicPrompt = WISDOM_DEMOGRAPHIC_PROMPTS[demographic];
  const settingPrompt = WISDOM_SETTING_PROMPTS[setting];

  let prompt = `Vertical 9:16 short-form interview video, ${durationSeconds} seconds.
Target audience: 55+ viewers, content that respects their intelligence and experience.

${WISDOM_SYSTEM_PROMPT}

---

FORMAT: ${format.toUpperCase()}
${formatPrompt}

TONE: ${tone.toUpperCase()}
${tonePrompt}

SETTING: ${setting.toUpperCase()}
${settingPrompt}

SUBJECT: ${demographic.toUpperCase()}
${demographicPrompt}

TOPIC: ${topic}

STRUCTURE:
1) Hook - Scroll-stopping question or statement related to ${topic}
2) Main take - Subject core insight or opinion on ${topic}
3) Supporting content - Brief story, example, or elaboration
4) Closing - Thoughtful ending with space for caption CTA

CAPTIONS:
- Always include caption text for each line
- Emphasize 3-6 key words in ALL CAPS (e.g., "RETIREMENT", "BOUNDARIES", "PURPOSE", "LEGACY")
- Keep captions readable, appropriate for older eyes

B-ROLL SUGGESTIONS:
${BROLL_TAGS.slice(0, 8).join(', ')}

VISUAL STYLE:
- Natural lighting appropriate to setting
- Warm color grading, not cool or trendy
- Shallow depth of field to focus on subject
- Steady camera, no fast cuts
- Professional but authentic documentary feel

ENDING:
- Pause before final moment
- Space for viewer to absorb the wisdom
- CTA appropriate for format (save, share, comment)

${options.angle ? `SPECIFIC CREATIVE DIRECTION: ${options.angle}` : ''}

No text overlays inside the video frame. Single continuous shot. Capture genuine human wisdom.`;

  return prompt;
}

// Generate wisdom script JSON (for structured output)
export function buildWisdomScript(
  userPrompt: string,
  format: WisdomFormat,
  durationSeconds: number
): WisdomScript {
  const templates = WISDOM_SCRIPT_TEMPLATES[format];
  const hook = templates.hook_examples[Math.floor(Math.random() * templates.hook_examples.length)];
  
  return {
    format,
    hook,
    topic: userPrompt,
    estimatedDuration: durationSeconds,
    brollPlan: BROLL_TAGS.slice(0, 4) as string[],
    emphasisWords: [],
    editNotes: [
      'Open on subject looking thoughtful or directly at camera',
      'Let first beat land before any camera movement',
      'Brief pause before the main takeaway',
      'Slight camera push-in during key insight',
      'End on subject with a knowing smile or nod',
    ],
  };
}

// Get tone refinement suggestions
export function getWisdomToneSuggestions(): { value: WisdomTone; label: string; description: string }[] {
  return [
    { value: 'gentle', label: 'Gentle', description: 'Warm, patient, supportive advice' },
    { value: 'direct', label: 'Direct', description: 'No-nonsense, straightforward truth' },
    { value: 'funny', label: 'Funny', description: 'Dry wit, clever observations' },
    { value: 'heartfelt', label: 'Heartfelt', description: 'Emotional, genuine, moving' },
  ];
}

// Get format options
export function getWisdomFormatOptions(): { value: WisdomFormat; label: string; description: string; emoji: string }[] {
  return [
    { value: 'motivation', label: 'Wisdom', description: 'Uplifting advice interview', emoji: '🌅' },
    { value: 'street_conversation', label: 'Conversation', description: 'Documentary street style', emoji: '🚶' },
    { value: 'subway_take', label: 'Take', description: 'Respectful debate format', emoji: '🚇' },
  ];
}

// Get demographic options
export function getWisdomDemographicOptions(): { value: WisdomDemographic; label: string; description: string }[] {
  return [
    { value: 'retirees', label: 'Retirees', description: 'Active seniors enjoying post-work life' },
    { value: 'grandparents', label: 'Grandparents', description: 'Sharing family wisdom across generations' },
    { value: 'late_career', label: 'Late Career', description: 'Professionals with career wisdom' },
    { value: 'caregivers', label: 'Caregivers', description: 'Those who have cared for others' },
    { value: 'reinventors', label: 'Reinventions', description: 'People who started over later' },
    { value: 'mentors', label: 'Mentors', description: 'Natural guide and teacher types' },
  ];
}

// Get setting options
export function getWisdomSettingOptions(): { value: WisdomSetting; label: string; description: string }[] {
  return [
    { value: 'park_bench', label: 'Park Bench', description: 'Relaxed outdoor park setting' },
    { value: 'coffee_shop', label: 'Coffee Shop', description: 'Cozy cafe atmosphere' },
    { value: 'living_room', label: 'Living Room', description: 'Homey, intimate setting' },
    { value: 'library', label: 'Library', description: 'Quiet, scholarly atmosphere' },
    { value: 'main_street', label: 'Main Street', description: 'Charming downtown area' },
    { value: 'subway_platform', label: 'Subway Platform', description: 'Urban transit moment' },
    { value: 'community_center', label: 'Community Center', description: 'Social, group setting' },
  ];
}
