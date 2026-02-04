import type {
  MultiStopJourney,
  JourneyStop,
  SubwayEnhancementConfig,
  LinePersonality,
  SubwayLine,
  SeasonalContext,
  PlotTwist,
  CrowdReactionConfig,
} from './types';
import { LINE_PERSONALITIES, SUBWAY_LINES } from './constants';

export interface JourneyNarrative {
  title: string;
  description: string;
  stops: StopNarrative[];
  overallArc: string;
  estimatedDuration: number;
}

export interface StopNarrative {
  stop: JourneyStop;
  narrativePurpose: string;
  suggestedDialogue: string;
  cameraDirection: string;
  mood: string;
  transitionFromPrevious?: string;
}

/**
 * Generates a complete narrative structure for a multi-stop subway journey
 */
export function generateJourneyNarrative(
  journey: MultiStopJourney,
  topic: string,
  enhancements?: SubwayEnhancementConfig
): JourneyNarrative {
  const { stops, narrativeArc } = journey;
  
  // Get line personality for context
  const line = stops[0]?.line || 'any';
  const personality = LINE_PERSONALITIES[line];
  
  // Generate title based on arc and topic
  const title = generateJourneyTitle(narrativeArc, topic, line);
  
  // Generate description
  const description = generateJourneyDescription(narrativeArc, topic, stops, personality);
  
  // Generate stop narratives
  const stopNarratives = stops.map((stop, index) => 
    generateStopNarrative(stop, index, stops, narrativeArc, topic, personality)
  );
  
  return {
    title,
    description,
    stops: stopNarratives,
    overallArc: narrativeArc,
    estimatedDuration: stops.reduce((sum, s) => sum + s.duration, 0),
  };
}

function generateJourneyTitle(
  arc: MultiStopJourney['narrativeArc'],
  topic: string,
  line: SubwayLine
): string {
  const lineName = SUBWAY_LINES.find(l => l.value === line)?.label || 'Subway';
  
  const titles: Record<MultiStopJourney['narrativeArc'], string[]> = {
    discovery: [
      `Finding Truth on the ${lineName}`,
      `The ${topic} Discovery`,
      `What We Learned on the ${lineName}`,
    ],
    debate: [
      `Battle of Takes: ${topic}`,
      `${lineName} Debate Club`,
      `The Great ${topic} Argument`,
    ],
    transformation: [
      `From Doubt to Belief`,
      `The ${topic} Conversion`,
      `Changed Minds on the ${lineName}`,
    ],
    mystery: [
      `The Case of ${topic}`,
      `Solving ${topic} on the ${lineName}`,
      `The ${topic} Mystery Tour`,
    ],
  };
  
  const options = titles[arc];
  return options[Math.floor(Math.random() * options.length)];
}

function generateJourneyDescription(
  arc: MultiStopJourney['narrativeArc'],
  topic: string,
  stops: JourneyStop[],
  personality?: LinePersonality
): string {
  const stopNames = stops.map(s => s.stationName).join(' → ');
  const vibe = personality?.vibe || 'classic subway';
  
  const descriptions: Record<MultiStopJourney['narrativeArc'], string> = {
    discovery: `A journey of discovery across ${stops.length} stops (${stopNames}), uncovering unexpected truths about ${topic} on the ${vibe} line.`,
    debate: `An intense debate unfolds across ${stops.length} stations (${stopNames}), with perspectives shifting as we travel the ${vibe} line.`,
    transformation: `Watch perspectives transform across ${stops.length} stops (${stopNames}), as the ${vibe} atmosphere works its magic on ${topic}.`,
    mystery: `A mystery unfolds across ${stops.length} stations (${stopNames}), with clues revealed at each stop on the ${vibe} line.`,
  };
  
  return descriptions[arc];
}

function generateStopNarrative(
  stop: JourneyStop,
  index: number,
  allStops: JourneyStop[],
  arc: MultiStopJourney['narrativeArc'],
  topic: string,
  personality?: LinePersonality
): StopNarrative {
  const purposes: Record<JourneyStop['narrativePurpose'], string> = {
    hook: 'Grab attention with a provocative opening',
    development: 'Explore the topic deeper',
    climax: 'Peak emotional/intellectual moment',
    resolution: 'Bring it all together',
  };
  
  const previousStop = index > 0 ? allStops[index - 1] : null;
  
  return {
    stop,
    narrativePurpose: purposes[stop.narrativePurpose],
    suggestedDialogue: generateDialogueSuggestion(stop, topic, arc, personality),
    cameraDirection: generateCameraDirection(stop, index, allStops.length),
    mood: generateMood(stop, personality),
    transitionFromPrevious: previousStop 
      ? `Transition from ${previousStop.stationName} to ${stop.stationName}` 
      : undefined,
  };
}

function generateDialogueSuggestion(
  stop: JourneyStop,
  topic: string,
  arc: MultiStopJourney['narrativeArc'],
  personality?: LinePersonality
): string {
  if (stop.question) return stop.question;
  
  const templates: Record<JourneyStop['narrativePurpose'], string[]> = {
    hook: [
      `What's your honest take on ${topic}?`,
      `Hot take: ${topic} - go!`,
      `Be real with me about ${topic}`,
    ],
    development: [
      `But why do you think that about ${topic}?`,
      `Have you always felt that way about ${topic}?`,
      `What changed your mind about ${topic}?`,
    ],
    climax: [
      `The real question is: ${topic}?`,
      `Here's the thing about ${topic}...`,
      `The truth about ${topic} is...`,
    ],
    resolution: [
      `So what's the final verdict on ${topic}?`,
      `Where do we land on ${topic}?`,
      `The take on ${topic} is...`,
    ],
  };
  
  const options = templates[stop.narrativePurpose];
  return options[Math.floor(Math.random() * options.length)];
}

function generateCameraDirection(
  stop: JourneyStop,
  index: number,
  totalStops: number
): string {
  const directions = [
    'Two-shot showing subject and platform',
    'Close-up on subject face',
    'Medium shot with train in background',
    'Over-shoulder from interviewer',
    'Wide showing station context',
  ];
  
  // Vary based on position in journey
  if (index === 0) return directions[0]; // Establishing
  if (index === totalStops - 1) return directions[2]; // Closing
  return directions[index % directions.length];
}

function generateMood(
  stop: JourneyStop,
  personality?: LinePersonality
): string {
  const baseMoods: Record<JourneyStop['narrativePurpose'], string[]> = {
    hook: ['curious', 'intrigued', 'suspicious'],
    development: ['thoughtful', 'engaged', 'questioning'],
    climax: ['intense', 'passionate', 'revealing'],
    resolution: ['satisfied', 'resolved', 'contemplative'],
  };
  
  const moods = baseMoods[stop.narrativePurpose];
  const baseMood = moods[Math.floor(Math.random() * moods.length)];
  
  // Add line personality influence
  if (personality?.energy === 'fast') return `${baseMood}, energetic`;
  if (personality?.energy === 'slow') return `${baseMood}, relaxed`;
  return baseMood;
}

/**
 * Generates a prompt snippet for crowd reactions
 */
export function generateCrowdReactionPrompt(config: CrowdReactionConfig): string {
  const { density, engagement, reactions } = config;
  
  const densityDesc = {
    sparse: 'A few commuters in the background',
    moderate: 'Steady flow of passengers',
    dense: 'Packed platform with many commuters',
  };
  
  const engagementDesc = {
    passive: 'mostly minding their own business',
    reactive: 'reacting visibly to the conversation',
    interactive: 'some people stopping to listen or chime in',
  };
  
  let prompt = `${densityDesc[density]} ${engagementDesc[engagement]}. `;
  
  if (reactions.length > 0) {
    const reactionDescs = reactions.map(r => {
      const intensity = r.intensity === 'dramatic' ? 'dramatically' 
        : r.intensity === 'noticeable' ? 'visibly' 
        : 'subtly';
      return `At ${r.timing}s, someone ${intensity} ${r.type}s`;
    });
    prompt += `Key moments: ${reactionDescs.join('; ')}.`;
  }
  
  return prompt;
}

/**
 * Generates a prompt snippet for seasonal context
 */
export function generateSeasonalPrompt(context: SeasonalContext): string {
  const { season, weather, holiday, cityEvent, decorations, crowdAttire } = context;
  
  let prompt = `${season} setting`;
  
  if (weather !== 'clear') {
    prompt += `, ${weather} weather`;
  }
  
  if (holiday !== 'none') {
    prompt += `, ${holiday} atmosphere`;
    if (decorations) {
      prompt += ' with visible holiday decorations';
    }
  }
  
  if (cityEvent !== 'none') {
    prompt += `, during ${cityEvent}`;
  }
  
  const attireDesc = {
    summer_light: 'light summer clothing',
    winter_coats: 'heavy winter coats',
    rain_gear: 'raincoats and umbrellas',
    business_as_usual: 'typical commuter attire',
  };
  
  prompt += `. Crowd wearing ${attireDesc[crowdAttire]}.`;
  
  return prompt;
}

/**
 * Generates a prompt snippet for plot twists
 */
export function generatePlotTwistPrompt(twist: PlotTwist): string {
  const { type, timing, impact } = twist;
  
  const twistDescs: Record<PlotTwist['type'], string> = {
    missed_connection: `At ${timing}s, the subject rushes to catch an arriving train, abruptly ending the interview`,
    stranger_interruption: `At ${timing}s, a random commuter overhears and jumps in with their own hot take`,
    train_arrival_cut: `At ${timing}s, a train arrival cuts off a key moment with perfect dramatic timing`,
    recognition_moment: `At ${timing}s, the interviewee recognizes the interviewer from somewhere`,
    unexpected_exit: `At ${timing}s, the subject walks away mid-sentence without explanation`,
    double_take: `At ${timing}s, someone in the background does a dramatic double-take`,
    phone_interruption: `At ${timing}s, a phone notification interrupts with perfect timing`,
    none: '',
  };
  
  const impactDesc = {
    comedic: 'creating a comedic moment',
    dramatic: 'adding dramatic tension',
    awkward: 'creating awkward silence',
    intriguing: 'adding intrigue',
  };
  
  return `${twistDescs[type]}, ${impactDesc[impact]}.`;
}

/**
 * Generates a complete enhanced subway prompt
 */
export function generateEnhancedSubwayPrompt(
  basePrompt: string,
  enhancements: SubwayEnhancementConfig
): string {
  let enhancedPrompt = basePrompt;
  
  // Add line personality
  if (enhancements.subwayLine && enhancements.subwayLine !== 'any') {
    const personality = LINE_PERSONALITIES[enhancements.subwayLine];
    enhancedPrompt += `\n\nLine Character: ${personality.vibe}. Typical riders include ${personality.typicalRiders.join(', ')}.`;
  }
  
  // Add crowd reactions
  if (enhancements.crowdReactions?.enabled) {
    enhancedPrompt += `\n\nCrowd Atmosphere: ${generateCrowdReactionPrompt(enhancements.crowdReactions)}`;
  }
  
  // Add soundscape
  if (enhancements.soundscape?.enabled) {
    const sounds = enhancements.soundscape.layers
      .map(l => `${l.sound} (${l.intensity})`)
      .join(', ');
    enhancedPrompt += `\n\nAudio Elements: ${sounds}`;
  }
  
  // Add seasonal context
  if (enhancements.seasonalContext?.enabled) {
    enhancedPrompt += `\n\nSetting: ${generateSeasonalPrompt(enhancements.seasonalContext)}`;
  }
  
  // Add plot twist
  if (enhancements.plotTwist && enhancements.plotTwist.type !== 'none') {
    enhancedPrompt += `\n\nPlot Element: ${generatePlotTwistPrompt(enhancements.plotTwist)}`;
  }
  
  // Add train arrival
  if (enhancements.trainArrival?.enabled) {
    const { timing, effect, line, direction } = enhancements.trainArrival;
    const lineName = line || 'a';
    const dirText = direction ? ` heading ${direction}` : '';
    enhancedPrompt += `\n\nTrain Arrival: ${timing} in the clip, ${effect} effect. ${lineName} train${dirText} arrives.`;
  }
  
  return enhancedPrompt;
}
