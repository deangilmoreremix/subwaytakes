import type { InterviewStyle } from './types';

/**
 * Interview Style Categories
 */
export type InterviewStyleCategory =
  | 'Classic'
  | 'Opinion'
  | 'Story'
  | 'Interactive'
  | 'Investigative';

export type InterviewGoal = 'comments' | 'shares' | 'saves' | 'leads';

/**
 * Canonical registry for interview style metadata.
 * This eliminates drift between UI labels, descriptions, colors,
 * and prompt engine mappings.
 */
export type InterviewStyleMeta = {
  value: InterviewStyle;
  label: string;
  description: string;
  category: InterviewStyleCategory;

  // UI
  colors: { bg: string; border: string; text: string };
  recommendedSeconds?: number[];
  bestFor?: InterviewGoal[];
  subwaySafe?: boolean;

  // Prompt hardening
  structureRules?: string[];
  mustInclude?: string[];
  forbidden?: string[];
  responseShape?: {
    hook?: string;
    beats?: string[];
    closing?: string;
  };
};

/**
 * All 21 interview styles with full metadata including hardening rules.
 */
export const INTERVIEW_STYLE_META: Record<InterviewStyle, InterviewStyleMeta> = {
  quick_fire: {
    value: 'quick_fire',
    label: 'Quick Fire',
    description: 'Rapid questions, punchy answers, high energy back-and-forth.',
    category: 'Interactive',
    colors: { bg: 'bg-orange-500/15', border: 'border-orange-500/50', text: 'text-orange-400' },
    recommendedSeconds: [3, 4, 5, 6],
    bestFor: ['shares', 'comments'],
    subwaySafe: true,
    mustInclude: [
      'one short question followed by a short answer',
      'fast pacing with minimal pauses',
      'reaction visible in face + hands',
    ],
    forbidden: [
      'long monologue',
      'slow reflective pacing',
      'multiple topics in one clip',
    ],
    responseShape: {
      hook: 'Start immediately on the question (no intro).',
      beats: ['Question lands', 'Immediate answer', 'Micro reaction / punchline'],
      closing: 'End right after the strongest line (no wrap-up).',
    },
  },

  deep_conversation: {
    value: 'deep_conversation',
    label: 'Deep Conversation',
    description: 'Thoughtful pauses, meaningful dialogue, reflective tone.',
    category: 'Classic',
    colors: { bg: 'bg-blue-500/15', border: 'border-blue-500/50', text: 'text-blue-400' },
    recommendedSeconds: [6, 8],
    bestFor: ['saves', 'shares'],
    subwaySafe: true,
    mustInclude: ['one clear thoughtful answer', 'gentle pacing', 'subtle emotion'],
    forbidden: ['shouting', 'chaotic crowd energy', 'rapid-fire cadence'],
    responseShape: {
      hook: 'Open with a reflective first sentence (no filler).',
      beats: ['Thoughtful start', 'One clear insight', 'Soft, memorable last line'],
      closing: 'Finish on a calm statement that feels quotable.',
    },
  },

  man_on_street: {
    value: 'man_on_street',
    label: 'Man on the Street',
    description: 'Classic street-style stop-and-ask interview, candid answers.',
    category: 'Classic',
    colors: { bg: 'bg-green-500/15', border: 'border-green-500/50', text: 'text-green-400' },
    recommendedSeconds: [4, 6, 8],
    bestFor: ['shares', 'comments'],
    subwaySafe: true,
    mustInclude: ['one question, one answer', 'spontaneous vibe', 'realistic interruptions'],
    forbidden: ['scripted acting', 'stage lighting', 'perfectly timed performance'],
    responseShape: {
      hook: 'The question is asked as we\'re already rolling.',
      beats: ['Question', 'Answer with personality', 'Small laugh / surprise / nod'],
      closing: 'End on the most human moment (smile, shrug, eyebrow raise).',
    },
  },

  ambush_style: {
    value: 'ambush_style',
    label: 'Ambush Style',
    description: 'Caught-off-guard reactions, raw and surprising answers.',
    category: 'Interactive',
    colors: { bg: 'bg-red-500/15', border: 'border-red-500/50', text: 'text-red-400' },
    recommendedSeconds: [3, 4, 5],
    bestFor: ['shares', 'comments'],
    subwaySafe: true,
    mustInclude: ['visible surprise', 'stumble/hesitation feels real', 'quick recovery'],
    forbidden: ['calm prepared answer', 'long explanation'],
    responseShape: {
      hook: 'Start on the "caught off guard" moment.',
      beats: ['Surprise reaction', 'Short answer', 'Second beat reaction'],
      closing: 'Cut immediately after the reaction peak.',
    },
  },

  friendly_chat: {
    value: 'friendly_chat',
    label: 'Friendly Chat',
    description: 'Warm rapport, relaxed flow, natural conversation vibe.',
    category: 'Classic',
    colors: { bg: 'bg-teal-500/15', border: 'border-teal-500/50', text: 'text-teal-400' },
    recommendedSeconds: [4, 6, 8],
    bestFor: ['shares'],
    subwaySafe: true,
    mustInclude: ['warm tone', 'smile/rapport', 'comfortable pacing'],
    forbidden: ['aggressive pushback', 'hostile tone'],
    responseShape: {
      hook: 'Begin mid-conversation as if they already know each other.',
      beats: ['Friendly prompt', 'Simple honest answer', 'Warm nod / laugh'],
      closing: 'End with a feel-good line.',
    },
  },

  hot_take: {
    value: 'hot_take',
    label: 'Hot Take',
    description: 'Bold opinion, confident delivery, "mic drop" energy.',
    category: 'Opinion',
    colors: { bg: 'bg-rose-500/15', border: 'border-rose-500/50', text: 'text-rose-400' },
    recommendedSeconds: [3, 4, 5],
    bestFor: ['comments'],
    subwaySafe: true,
    mustInclude: ['strong stance in first sentence', 'confidence, no hedging'],
    forbidden: ['maybe', 'it depends', 'soft framing', 'multiple caveats'],
    responseShape: {
      hook: 'Open with the opinion as a blunt statement.',
      beats: ['Hot take', 'One supporting reason', 'Mic-drop closer'],
      closing: 'End on the most controversial phrase.',
    },
  },

  confessional: {
    value: 'confessional',
    label: 'Confessional',
    description: 'Vulnerable, intimate sharing, emotionally honest moment.',
    category: 'Story',
    colors: { bg: 'bg-pink-500/15', border: 'border-pink-500/50', text: 'text-pink-400' },
    recommendedSeconds: [6, 8],
    bestFor: ['saves', 'shares'],
    subwaySafe: true,
    mustInclude: ['soft vulnerable tone', 'one specific detail (not generic)'],
    forbidden: ['big performance', 'shouting', 'comedic delivery'],
    responseShape: {
      hook: 'Start with "Honestly..." or "I didn\'t admit this until..." (or similar).',
      beats: ['Vulnerable opener', 'Specific detail', 'Quiet lesson'],
      closing: 'End gently, not dramatically.',
    },
  },

  confessions: {
    value: 'confessions',
    label: 'Confessions',
    description: 'Personal reveal with a cathartic, story-first approach.',
    category: 'Story',
    colors: { bg: 'bg-pink-600/15', border: 'border-pink-600/50', text: 'text-pink-600' },
    recommendedSeconds: [6, 8],
    bestFor: ['saves'],
    subwaySafe: true,
    mustInclude: ['clear "reveal" moment', 'emotional turn', 'strong last line'],
    forbidden: ['vague confession', 'no payoff'],
    responseShape: {
      hook: 'Open with the reveal premise (tension).',
      beats: ['Setup', 'Confession', 'After-feeling / realization'],
      closing: 'End on the catharsis line.',
    },
  },

  debate_challenge: {
    value: 'debate_challenge',
    label: 'Debate Challenge',
    description: 'Pushback energy, point-counterpoint, defend a stance.',
    category: 'Opinion',
    colors: { bg: 'bg-amber-500/15', border: 'border-amber-500/50', text: 'text-amber-400' },
    recommendedSeconds: [4, 6],
    bestFor: ['comments'],
    subwaySafe: true,
    mustInclude: ['pushback line from interviewer', 'clear rebuttal', 'one crisp counterpoint'],
    forbidden: ['everyone agrees', 'soft friendly tone only'],
    responseShape: {
      hook: 'Start on the pushback question.',
      beats: ['Pushback', 'Rebuttal', 'Final punch'],
      closing: 'End on the winning line.',
    },
  },

  reaction_test: {
    value: 'reaction_test',
    label: 'Reaction Test',
    description: 'Unfiltered first impression, surprise/shock moment.',
    category: 'Interactive',
    colors: { bg: 'bg-cyan-500/15', border: 'border-cyan-500/50', text: 'text-cyan-400' },
    recommendedSeconds: [3, 4, 5],
    bestFor: ['shares', 'comments'],
    subwaySafe: true,
    mustInclude: ['one stimulus line read to them', 'instant facial reaction'],
    forbidden: ['long explanation before reaction'],
    responseShape: {
      hook: 'Open with the stimulus line (quoted).',
      beats: ['Stimulus', 'Reaction', 'One-sentence verdict'],
      closing: 'Cut right after verdict.',
    },
  },

  serious_probe: {
    value: 'serious_probe',
    label: 'Serious Probe',
    description: 'Investigative tone, accountability questions, searching for truth.',
    category: 'Investigative',
    colors: { bg: 'bg-slate-500/15', border: 'border-slate-500/50', text: 'text-slate-400' },
    recommendedSeconds: [4, 6],
    bestFor: ['shares'],
    subwaySafe: true,
    mustInclude: ['serious tone', 'direct question', 'short, pressure-filled pause'],
    forbidden: ['jokey vibe', 'hype energy'],
    responseShape: {
      hook: 'Start with a direct, uncomfortable question.',
      beats: ['Question', 'Pause', 'Measured answer'],
      closing: 'End on the most accountable line.',
    },
  },

  storytelling: {
    value: 'storytelling',
    label: 'Storytelling',
    description: 'Vivid anecdote, expressive delivery, narrative arc.',
    category: 'Story',
    colors: { bg: 'bg-emerald-500/15', border: 'border-emerald-500/50', text: 'text-emerald-400' },
    recommendedSeconds: [6, 8],
    bestFor: ['saves', 'shares'],
    subwaySafe: true,
    mustInclude: ['one vivid moment', 'clear beginning → point → outcome'],
    forbidden: ['rambling', 'no payoff'],
    responseShape: {
      hook: 'Open on the moment of tension ("I was standing there when...").',
      beats: ['Setup', 'Turning point', 'Outcome'],
      closing: 'End with a lesson line.',
    },
  },

  unpopular_opinion: {
    value: 'unpopular_opinion',
    label: 'Unpopular Opinion',
    description: 'Contrarian stance designed to trigger debate.',
    category: 'Opinion',
    colors: { bg: 'bg-violet-500/15', border: 'border-violet-500/50', text: 'text-violet-400' },
    recommendedSeconds: [3, 4, 5],
    bestFor: ['comments'],
    subwaySafe: true,
    mustInclude: ['contrarian stance immediately', 'anticipates backlash in one phrase'],
    forbidden: ['safe/neutral opinion', 'too many qualifiers'],
    responseShape: {
      hook: 'Start with "Unpopular opinion:" style statement (no apology).',
      beats: ['Contrarian claim', 'One reason', 'Backlash bait line'],
      closing: 'End on the bait line.',
    },
  },

  exposed_callout: {
    value: 'exposed_callout',
    label: 'Exposed / Callout',
    description: 'Insider reveal, breaking the "industry secret" pattern.',
    category: 'Investigative',
    colors: { bg: 'bg-red-600/15', border: 'border-red-600/50', text: 'text-red-600' },
    recommendedSeconds: [4, 6],
    bestFor: ['shares', 'comments'],
    subwaySafe: true,
    mustInclude: ['"here\'s what they don\'t tell you" vibe', 'one specific claim'],
    forbidden: ['vague conspiracy', 'no concrete reveal'],
    responseShape: {
      hook: 'Open with the "secret" premise.',
      beats: ['Premise', 'Specific reveal', 'What to do instead'],
      closing: 'End on the actionable line.',
    },
  },

  red_flag_detector: {
    value: 'red_flag_detector',
    label: 'Red Flag Detector',
    description: 'Spot warning signs, teach patterns, cautious tone.',
    category: 'Investigative',
    colors: { bg: 'bg-yellow-500/15', border: 'border-yellow-500/50', text: 'text-yellow-400' },
    recommendedSeconds: [4, 6],
    bestFor: ['saves', 'shares'],
    subwaySafe: true,
    mustInclude: ['one clear red flag', 'one sentence why it matters'],
    forbidden: ['too many flags', 'rambling list'],
    responseShape: {
      hook: 'Open with "Red flag:" + the sign.',
      beats: ['Red flag', 'Why it matters', 'What to do'],
      closing: 'End on the protective advice.',
    },
  },

  hot_take_react: {
    value: 'hot_take_react',
    label: 'Hot Take React',
    description: 'Reacting to a trending topic with immediate commentary.',
    category: 'Opinion',
    colors: { bg: 'bg-orange-600/15', border: 'border-orange-600/50', text: 'text-orange-600' },
    recommendedSeconds: [3, 4, 5],
    bestFor: ['comments'],
    subwaySafe: true,
    mustInclude: ['immediate reaction', 'one strong sentence', 'no setup'],
    forbidden: ['explaining what the trend is for too long'],
    responseShape: {
      hook: 'Start with "Okay, my take is..."',
      beats: ['Instant take', 'One reason', 'Final jab'],
      closing: 'End on jab.',
    },
  },

  before_after_story: {
    value: 'before_after_story',
    label: 'Before & After',
    description: 'Transformation arc: before → turning point → after.',
    category: 'Story',
    colors: { bg: 'bg-teal-600/15', border: 'border-teal-600/50', text: 'text-teal-600' },
    recommendedSeconds: [6, 8],
    bestFor: ['saves', 'shares'],
    subwaySafe: true,
    mustInclude: ['clear before state', 'one turning point', 'clear after state'],
    forbidden: ['no turning point', 'no contrast'],
    responseShape: {
      hook: 'Open with the "before" pain in one sentence.',
      beats: ['Before', 'Turning point', 'After'],
      closing: 'End on the result line.',
    },
  },

  finish_sentence: {
    value: 'finish_sentence',
    label: 'Finish the Sentence',
    description: 'Interactive completion prompt designed for engagement.',
    category: 'Interactive',
    colors: { bg: 'bg-indigo-500/15', border: 'border-indigo-500/50', text: 'text-indigo-400' },
    recommendedSeconds: [4, 6],
    bestFor: ['comments'],
    subwaySafe: true,
    mustInclude: ['the prompt phrase appears clearly as spoken question', 'short completion'],
    forbidden: ['multiple sentences completion', 'long story'],
    responseShape: {
      hook: 'Open with "Finish this sentence..."',
      beats: ['Prompt', 'Completion', 'Quick reaction'],
      closing: 'End right after completion.',
    },
  },

  one_piece_advice: {
    value: 'one_piece_advice',
    label: 'One Piece of Advice',
    description: 'Single powerful takeaway that feels quotable and shareable.',
    category: 'Story',
    colors: { bg: 'bg-amber-600/15', border: 'border-amber-600/50', text: 'text-amber-600' },
    recommendedSeconds: [4, 6],
    bestFor: ['saves', 'shares'],
    subwaySafe: true,
    mustInclude: ['exactly one advice point', 'short explanation', 'quotable final line'],
    forbidden: ['list of tips', 'too many examples'],
    responseShape: {
      hook: 'Open with the advice immediately.',
      beats: ['Advice', 'One reason', 'Quotable closer'],
      closing: 'End on the quotable line.',
    },
  },

  would_you_rather: {
    value: 'would_you_rather',
    label: 'Would You Rather',
    description: 'Two options, forced choice, debate energy.',
    category: 'Interactive',
    colors: { bg: 'bg-emerald-600/15', border: 'border-emerald-600/50', text: 'text-emerald-600' },
    recommendedSeconds: [4, 6],
    bestFor: ['comments', 'shares'],
    subwaySafe: true,
    mustInclude: ['two clear options', 'forced choice', 'quick justification'],
    forbidden: ['third option', 'it depends'],
    responseShape: {
      hook: 'Open with the two options.',
      beats: ['Option A vs B', 'Choice', 'One-line reason'],
      closing: 'End on reason.',
    },
  },

  street_quiz: {
    value: 'street_quiz',
    label: 'Street Quiz',
    description: 'Trivia/quiz show vibe with surprising answers.',
    category: 'Interactive',
    colors: { bg: 'bg-blue-600/15', border: 'border-blue-600/50', text: 'text-blue-600' },
    recommendedSeconds: [6, 8],
    bestFor: ['shares', 'comments'],
    subwaySafe: true,
    mustInclude: ['question asked clearly', 'answer attempt', 'reveal/correction reaction'],
    forbidden: ['no reveal', 'no reaction'],
    responseShape: {
      hook: 'Open with the quiz question.',
      beats: ['Question', 'Answer', 'Reveal + reaction'],
      closing: 'End on the reaction.',
    },
  },
};

/**
 * Array of all interview styles for iteration.
 */
export const INTERVIEW_STYLES: InterviewStyleMeta[] = Object.values(INTERVIEW_STYLE_META);
