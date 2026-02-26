import type { DebateLoopConfig, DebateStance, DebateDepth, DebateResolution, SubwayTakeScript, CameraDirection } from './types';
import { DEFAULT_DEBATE_LOOP } from './constants';

interface GenerateSubwayTakeScriptParams {
  topic: string;
  angle?: string;
  debateLoop?: DebateLoopConfig;
  cityVibe?: string;
  duration?: number;
}

/**
 * Generates a SubwayTakes-style script with the debate loop structure
 * Hook -> Take -> Forced Stance -> Micro-discussion -> Resolution
 */
export function generateSubwayTakeScript(
  params: GenerateSubwayTakeScriptParams
): SubwayTakeScript {
  const { topic, angle, debateLoop = DEFAULT_DEBATE_LOOP } = params;

  // Determine stance based on config
  const stance = determineStance(debateLoop.stance, topic);

  // Build the hook
  const hook = buildHook(topic, angle);

  // Build the take beat
  const takeBeat = buildTakeBeat(topic, angle);

  // Build interviewer reaction
  const reactionBeat = buildReactionBeat(stance, topic);

  // Build discussion beats based on depth
  const discussionBeats = buildDiscussionBeats(
    topic,
    stance,
    debateLoop.depth,
    debateLoop.replies,
    debateLoop.resolution
  );

  // Build ending
  const ending = buildEnding(debateLoop.resolution);

  // Calculate meta information
  const estimatedDuration = calculateDuration(discussionBeats.length, debateLoop.depth);
  const captionEmphasis = extractEmphasisPhrases([takeBeat, reactionBeat, ...discussionBeats]);
  const editTiming = calculateEditTiming(estimatedDuration, discussionBeats.length);

  return {
    hook,
    beats: [takeBeat, reactionBeat, ...discussionBeats],
    ending,
    meta: {
      estimatedDuration,
      captionEmphasis,
      editTiming,
    },
  };
}

function determineStance(stance: DebateStance, topic: string): 'agree' | 'disagree' {
  if (stance === 'always_agree') return 'agree';
  if (stance === 'always_disagree') return 'disagree';

  // Auto: generate stance based on topic tendencies
  // Hot takes usually get disagreement for engagement
  const controversialTopics = ['hot takes', 'nyc', 'dating', 'money'];
  const isControversial = controversialTopics.some(t => topic.toLowerCase().includes(t));
  
  // 70% disagree for controversial topics (creates engagement)
  return isControversial ? 'disagree' : Math.random() > 0.5 ? 'agree' : 'disagree';
}

function buildHook(topic: string, angle?: string): string {
  const hooks = [
    `What's your take? ${angle || topic}?`,
    `Quick question — ${angle || topic}?`,
    `Hot take: ${angle || topic}?`,
    `Be honest — ${angle || topic}?`,
    `NYC take: ${angle || topic}?`,
  ];
  return hooks[Math.floor(Math.random() * hooks.length)];
}

function buildTakeBeat(topic: string, _angle?: string) {
  const takes: Record<string, string[]> = {
    'Hydration Myths': [
      "We're drinking too much water",
      "Eight glasses a day is a scam",
      "Bottled water is a total waste",
      "Tap water hits different here",
    ],
    'Coffee Culture': [
      "$7 lattes are robbery",
      "Iced coffee in winter makes no sense",
      "Starbucks is just sugar milk",
      "Bodega coffee is elite",
    ],
    'Sleep Schedules': [
      "Waking up at 5am is performative",
      "Night owls are more creative",
      "Sleeping in on weekends ruins you",
      "Naps are a competitive advantage",
    ],
    'Social Media': [
      "LinkedIn is just corporate theater",
      "Posting your salary is cringe",
      "Influencers are modern snake oil",
      "Doom scrolling is self-harm",
    ],
    'Side Hustles': [
      "Every side hustle is a pyramid scheme",
      "Hustle culture is just burnout with branding",
      "Passive income is a myth",
      "One job should be enough",
    ],
    'NYC Rent': [
      "$3k for a studio is psychological warfare",
      "Roommates until 35 is normal here",
      "Brooklyn is just as expensive now",
      "The rent is always too damn high",
    ],
    'Food Takes': [
      "NYC pizza is overrated",
      "Brunch is just breakfast with alcohol",
      "Avocado toast deserves the hate",
      "Street meat is elite cuisine",
    ],
    'Transportation': [
      "Taking cabs everywhere is a weakness",
      "The subway builds character",
      "Citi Bike is faster than Uber",
      "Walking is the only real way",
    ],
    'Winter vs Summer': [
      "Winter in NYC is underrated",
      "Summer subway is actual hell",
      "Fall is the only good season",
      "Allergies make spring overrated",
    ],
    'Work From Home': [
      "WFH destroyed office culture",
      "Remote work is just lazy",
      "Offices are productivity theaters",
      "Hybrid is the worst of both",
    ],
  };

  const topicTakes = takes[topic] || ["That's a hot take right there", "Interesting perspective"];
  const line = topicTakes[Math.floor(Math.random() * topicTakes.length)];

  return {
    type: 'take' as const,
    speaker: 'interviewee' as const,
    line,
    caption: line,
  };
}

function buildReactionBeat(stance: 'agree' | 'disagree', _topic: string) {
  const agreeReactions = [
    "100% agree with that",
    "Finally someone said it",
    "Facts only right there",
    "You nailed it honestly",
    "Couldn't agree more",
  ];

  const disagreeReactions = [
    "100% disagree with you",
    "That's completely wrong",
    "I can't cosign that",
    "You've got it backwards",
    "Hard disagree on that",
    "That's a terrible take",
  ];

  const line = stance === 'agree' 
    ? agreeReactions[Math.floor(Math.random() * agreeReactions.length)]
    : disagreeReactions[Math.floor(Math.random() * disagreeReactions.length)];

  return {
    type: 'interviewer_reaction' as const,
    speaker: 'interviewer' as const,
    stance,
    line,
    caption: line.toUpperCase(), // Emphasize the stance word
  };
}

function buildDiscussionBeats(
  _topic: string,
  stance: 'agree' | 'disagree',
  depth: DebateDepth,
  replyCount: number,
  resolution: DebateResolution
) {
  const beats = [];
  
  // Light: minimal back and forth
  // Medium: standard 2-3 exchanges
  // Spicy: push boundaries
  
  const exchanges = {
    light: 1,
    medium: 2,
    spicy: 3,
  };
  
  const numExchanges = Math.min(replyCount, exchanges[depth]);
  
  const lightResponses = [
    "I just think it's obvious",
    "Everyone knows this",
    "It's common sense really",
    "You can't argue with that",
  ];

  const mediumResponses = [
    "The data actually supports this",
    "I've seen this play out",
    "Experience taught me this",
    "The numbers don't lie",
  ];

  const spicyResponses = [
    "You're ignoring the evidence",
    "That's a privileged perspective",
    "You clearly haven't struggled",
    "That's naive at best",
  ];

  const responsePool = depth === 'light' ? lightResponses : depth === 'medium' ? mediumResponses : spicyResponses;

  for (let i = 0; i < numExchanges; i++) {
    // Interviewee response
    const intervieweeLine = responsePool[Math.floor(Math.random() * responsePool.length)];
    beats.push({
      type: 'discussion' as const,
      speaker: 'interviewee' as const,
      line: intervieweeLine,
      caption: intervieweeLine,
    });

    // Interviewer follow-up
    const followUpLines = stance === 'agree' 
      ? ["Exactly my point", "We see eye to eye", "Same wavelength", "Couldn't have said it better"]
      : ["That's still not convincing", "I think you're missing it", "We fundamentally disagree", "That's not the full picture"];
    
    const interviewerLine = followUpLines[Math.floor(Math.random() * followUpLines.length)];
    beats.push({
      type: 'discussion' as const,
      speaker: 'interviewer' as const,
      line: interviewerLine,
      caption: interviewerLine,
    });
  }

  // Resolution
  const resolutions: Record<DebateResolution, string[]> = {
    agreement: ["I guess we agree", "Fair enough", "Point taken", "I'll give you that"],
    agree_to_disagree: ["We'll have to agree to disagree", "Different perspectives", "To each their own", "Fair but I disagree"],
    twist: ["Wait actually...", "On second thought...", "Hold up...", "Plot twist..."],
  };

  const resolutionLine = resolutions[resolution][Math.floor(Math.random() * resolutions[resolution].length)];
  const resolutionSpeaker: 'interviewer' | 'interviewee' = stance === 'agree' ? 'interviewer' : 'interviewee';
  beats.push({
    type: 'discussion' as const,
    speaker: resolutionSpeaker,
    line: resolutionLine,
    caption: resolutionLine,
  });

  return beats;
}

function buildEnding(resolution: DebateResolution): string {
  const endings = {
    agreement: [
      "That's a TAKE! Drop a 💯 if you agree",
      "That's the TAKE! Comment if you feel this",
      "TAKE certified! Drop your thoughts",
    ],
    agree_to_disagree: [
      "That's a TAKE! Who's side are you on?",
      "TAKE! Comment TEAM AGREE or TEAM DISAGREE",
      "That's the TAKE! Where do you stand?",
    ],
    twist: [
      "PLOT TWIST! Drop a 🤯 if you didn't see that",
      "TWIST TAKE! Comments will be wild",
      "That's a TWIST! What do you think now?",
    ],
  };

  return endings[resolution][Math.floor(Math.random() * endings[resolution].length)];
}

function calculateDuration(discussionBeats: number, depth: DebateDepth): number {
  const baseDuration = 15;
  const beatDuration = depth === 'light' ? 2 : depth === 'medium' ? 3 : 4;
  return baseDuration + (discussionBeats * beatDuration);
}

function extractEmphasisPhrases(beats: { line: string }[]): string[] {
  const emphasisWords = ['FACTS', 'AGREE', 'DISAGREE', 'CAP', 'SCAM', 'OVERRATED', 'ELITE', 'TWIST'];
  const phrases: string[] = [];
  
  for (const beat of beats) {
    const words = beat.line.toUpperCase().split(' ');
    for (const word of words) {
      if (emphasisWords.some(ew => word.includes(ew))) {
        phrases.push(word);
      }
    }
  }
  
  return [...new Set(phrases)];
}

function calculateEditTiming(duration: number, beatCount: number) {
  const timings: { timestamp: number; type: 'hook' | 'take' | 'reaction' | 'discussion' | 'punch'; cameraDirection: CameraDirection; zoomLevel?: 'normal' | 'punch_in' }[] = [];
  const segmentDuration = duration / (beatCount + 3); // +3 for hook, take, reaction

  // Hook (0-2s)
  timings.push({
    timestamp: 0,
    type: 'hook',
    cameraDirection: 'medium',
  });

  // Take (2-6s)
  timings.push({
    timestamp: 2,
    type: 'take',
    cameraDirection: 'close-up',
    zoomLevel: 'punch_in',
  });

  // Reaction (6-9s)
  timings.push({
    timestamp: 6,
    type: 'reaction',
    cameraDirection: 'close-up',
    zoomLevel: 'punch_in',
  });

  // Discussion beats (jump cuts)
  let currentTime = 9;
  for (let i = 0; i < beatCount; i++) {
    timings.push({
      timestamp: currentTime,
      type: 'discussion',
      cameraDirection: i % 2 === 0 ? 'close-up' : 'two-shot',
    });
    currentTime += segmentDuration;
  }

  // Ending punch
  timings.push({
    timestamp: duration - 3,
    type: 'punch',
    cameraDirection: 'two-shot',
  });

  return timings;
}

/**
 * Formats a SubwayTakeScript for display/preview
 */
export function formatSubwayTakeScript(script: SubwayTakeScript): string {
  const lines = [
    `HOOK: ${script.hook}`,
    '',
    'BEATS:',
    ...script.beats.map((beat, i) => {
      const speaker = beat.speaker.toUpperCase();
      const stance = beat.stance ? ` [${beat.stance.toUpperCase()}]` : '';
      return `${i + 1}. ${speaker}${stance}: ${beat.line}`;
    }),
    '',
    `ENDING: ${script.ending}`,
  ];
  
  return lines.join('\n');
}

/**
 * Generates speech-ready script with proper timing
 */
export function generateSpeechScript(script: SubwayTakeScript): { interviewee: string; interviewer: string; fullScript: string } {
  const intervieweeLines = script.beats
    .filter(b => b.speaker === 'interviewee' && b.type === 'take')
    .map(b => b.line);
  
  const interviewerLines = script.beats
    .filter(b => b.speaker === 'interviewer')
    .map(b => b.line);
  
  return {
    interviewee: intervieweeLines.join('. '),
    interviewer: interviewerLines.join('. '),
    fullScript: script.beats.map(b => `${b.speaker}: ${b.line}`).join('\n'),
  };
}
