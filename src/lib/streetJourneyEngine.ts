import type {
  StreetEnhancementConfig,
  StreetLocation,
  BystanderReactionType,
  UrbanAmbientSound,
  StreetPlotTwistType,
  StreetFestival,
  StreetDramaticMomentType,
  CrossStreetPivotType,
} from './types';
import { NEIGHBORHOOD_PERSONALITIES, STREET_FESTIVALS } from './constants';

/**
 * Street Journey Engine
 * 
 * Generates contextual prompts and configurations for street interview clips
 * based on the selected enhancements. Similar to subwayJourneyEngine but
 * optimized for outdoor urban environments.
 */

export interface StreetJourneyContext {
  locationDescription: string;
  crowdDynamics: string;
  audioLayers: string[];
  visualElements: string[];
  narrativeElements: string[];
  timingCues: TimingCue[];
}

export interface TimingCue {
  timestamp: number;
  type: 'transition' | 'reaction' | 'dramatic_moment' | 'pivot' | 'poll' | 'twist';
  description: string;
}

/**
 * Build a complete street journey context from enhancement config
 */
export function buildStreetJourneyContext(
  config: StreetEnhancementConfig | undefined,
  baseDuration: number
): StreetJourneyContext {
  if (!config) {
    return {
      locationDescription: 'Busy NYC sidewalk',
      crowdDynamics: 'Moderate foot traffic with occasional bystanders',
      audioLayers: ['ambient city sounds'],
      visualElements: ['urban backdrop', 'passing pedestrians'],
      narrativeElements: ['standard street interview flow'],
      timingCues: [],
    };
  }

  const context: StreetJourneyContext = {
    locationDescription: buildLocationDescription(config),
    crowdDynamics: buildCrowdDynamics(config),
    audioLayers: buildAudioLayers(config),
    visualElements: buildVisualElements(config),
    narrativeElements: buildNarrativeElements(config),
    timingCues: buildTimingCues(config, baseDuration),
  };

  return context;
}

/**
 * Generate a prompt snippet for street enhancements
 */
export function generateStreetEnhancementPrompt(config: StreetEnhancementConfig | undefined): string {
  if (!config) return '';

  const parts: string[] = [];

  // Neighborhood context
  if (config.neighborhood) {
    const personality = NEIGHBORHOOD_PERSONALITIES[config.neighborhood];
    parts.push(`Location: ${personality.vibe} neighborhood with ${personality.atmosphere}`);
  }

  // Multi-location journey
  if (config.multiLocationJourney?.enabled) {
    const stops = config.multiLocationJourney.stops.map(s => s.locationName).join(' → ');
    parts.push(`Journey through: ${stops}`);
    parts.push(`Narrative arc: ${config.multiLocationJourney.narrativeArc}`);
  }

  // Crowd dynamics
  if (config.crowdDynamics?.enabled) {
    parts.push(`Crowd density: ${config.crowdDynamics.density}`);
    parts.push(`Crowd engagement: ${config.crowdDynamics.engagement}`);
    if (config.crowdDynamics.reactions.length > 0) {
      const reactions = config.crowdDynamics.reactions.map(r => r.type).join(', ');
      parts.push(`Bystander reactions: ${reactions}`);
    }
  }

  // Urban soundscape
  if (config.urbanSoundscape?.enabled) {
    const sounds = config.urbanSoundscape.layers.map(l => l.sound).join(', ');
    parts.push(`Ambient sounds: ${sounds}`);
  }

  // Plot twist
  if (config.plotTwist && config.plotTwist.type !== 'none') {
    parts.push(`Plot twist: ${config.plotTwist.description}`);
  }

  // Dramatic moment
  if (config.dramaticMoment?.enabled) {
    parts.push(`Dramatic moment: ${config.dramaticMoment.description}`);
  }

  // Seasonal context
  if (config.seasonalContext?.enabled) {
    const season = config.seasonalContext.season;
    const weather = config.seasonalContext.weather;
    parts.push(`Season: ${season}, Weather: ${weather}`);
    if (config.seasonalContext.festival && config.seasonalContext.festival !== 'none') {
      parts.push(`Festival: ${config.seasonalContext.festival}`);
    }
  }

  // Cross-street pivot
  if (config.crossStreetPivot?.enabled) {
    parts.push(`Topic pivot at ${config.crossStreetPivot.triggerLocation}: ${config.crossStreetPivot.newQuestion}`);
  }

  return parts.join('. ');
}

/**
 * Build location description based on neighborhood and journey
 */
function buildLocationDescription(config: StreetEnhancementConfig): string {
  const parts: string[] = [];

  if (config.neighborhood) {
    const personality = NEIGHBORHOOD_PERSONALITIES[config.neighborhood];
    parts.push(personality.atmosphere);
  }

  if (config.multiLocationJourney?.enabled && config.multiLocationJourney.stops.length > 0) {
    const firstStop = config.multiLocationJourney.stops[0];
    parts.push(`Starting at ${firstStop.locationName} (${firstStop.location})`);
  }

  return parts.join('. ') || 'Urban street setting';
}

/**
 * Build crowd dynamics description
 */
function buildCrowdDynamics(config: StreetEnhancementConfig): string {
  if (!config.crowdDynamics?.enabled) {
    return 'Natural street foot traffic';
  }

  const { density, engagement, reactions } = config.crowdDynamics;
  const parts: string[] = [`${density} crowd density`, `${engagement} engagement level`];

  if (reactions.length > 0) {
    const reactionTypes = reactions.map(r => r.type).join(', ');
    parts.push(`with ${reactionTypes} reactions`);
  }

  return parts.join(', ');
}

/**
 * Build audio layer descriptions
 */
function buildAudioLayers(config: StreetEnhancementConfig): string[] {
  const layers: string[] = ['ambient city audio'];

  if (config.urbanSoundscape?.enabled) {
    config.urbanSoundscape.layers.forEach(layer => {
      layers.push(`${layer.sound} (${layer.intensity})`);
    });
  }

  if (config.seasonalContext?.weather === 'rainy') {
    layers.push('rain sounds');
  }

  return layers;
}

/**
 * Build visual element descriptions
 */
function buildVisualElements(config: StreetEnhancementConfig): string[] {
  const elements: string[] = [];

  if (config.neighborhood) {
    const personality = NEIGHBORHOOD_PERSONALITIES[config.neighborhood];
    elements.push(...personality.visualCues.slice(0, 2));
  }

  if (config.seasonalContext?.enabled) {
    if (config.seasonalContext.holidayDecorations) {
      elements.push('holiday decorations');
    }
    if (config.seasonalContext.festival && config.seasonalContext.festival !== 'none') {
      elements.push(`${config.seasonalContext.festival} atmosphere`);
    }
  }

  return elements.length > 0 ? elements : ['urban backdrop'];
}

/**
 * Build narrative element descriptions
 */
function buildNarrativeElements(config: StreetEnhancementConfig): string[] {
  const elements: string[] = [];

  if (config.multiLocationJourney?.enabled) {
    elements.push(`Multi-location ${config.multiLocationJourney.narrativeArc} narrative`);
  }

  if (config.crossStreetPivot?.enabled) {
    elements.push(`Topic pivot to ${config.crossStreetPivot.pivotType}`);
  }

  if (config.plotTwist && config.plotTwist.type !== 'none') {
    elements.push(`Unexpected ${config.plotTwist.impact} twist`);
  }

  return elements.length > 0 ? elements : ['standard interview flow'];
}

/**
 * Build timing cues for editing
 */
function buildTimingCues(config: StreetEnhancementConfig, duration: number): TimingCue[] {
  const cues: TimingCue[] = [];

  // Multi-location journey transitions
  if (config.multiLocationJourney?.enabled) {
    let currentTime = 0;
    config.multiLocationJourney.stops.forEach((stop, index) => {
      if (index > 0) {
        cues.push({
          timestamp: currentTime,
          type: 'transition',
          description: `Transition to ${stop.locationName}`,
        });
      }
      currentTime += stop.duration;
    });
  }

  // Plot twist timing
  if (config.plotTwist && config.plotTwist.type !== 'none') {
    cues.push({
      timestamp: config.plotTwist.timing,
      type: 'twist',
      description: config.plotTwist.description,
    });
  }

  // Dramatic moment timing
  if (config.dramaticMoment?.enabled) {
    cues.push({
      timestamp: config.dramaticMoment.timing,
      type: 'dramatic_moment',
      description: config.dramaticMoment.description,
    });
  }

  // Cross-street pivot timing
  if (config.crossStreetPivot?.enabled) {
    // Estimate timing based on duration
    const pivotTime = Math.floor(duration * 0.6);
    cues.push({
      timestamp: pivotTime,
      type: 'pivot',
      description: `Pivot: ${config.crossStreetPivot.newQuestion}`,
    });
  }

  // Street poll timing
  if (config.streetPoll?.enabled) {
    cues.push({
      timestamp: Math.floor(duration * 0.5),
      type: 'poll',
      description: `Poll: ${config.streetPoll.question}`,
    });
  }

  // Sort by timestamp
  return cues.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Generate a location-specific prompt modifier
 */
export function getLocationPromptModifier(location: StreetLocation): string {
  const modifiers: Record<StreetLocation, string> = {
    coffee_shop: 'outside a bustling coffee shop with patio seating',
    park: 'in a green park with trees and benches',
    landmark: 'near a famous NYC landmark with tourists',
    street_corner: 'on a busy street corner with traffic',
    shopping_area: 'in a retail district with shoppers',
  };
  return modifiers[location];
}

/**
 * Generate a reaction description for bystanders
 */
export function getBystanderReactionDescription(type: BystanderReactionType): string {
  const descriptions: Record<BystanderReactionType, string> = {
    curious: 'leaning in to listen with interest',
    amused: 'smiling and chuckling at the response',
    confused: 'looking puzzled with a head tilt',
    agreeing: 'nodding in agreement',
    disagreeing: 'shaking head with skepticism',
    recording: 'filming with their phone',
  };
  return descriptions[type];
}

/**
 * Generate sound description for urban ambient
 */
export function getUrbanSoundDescription(sound: UrbanAmbientSound): string {
  const descriptions: Record<UrbanAmbientSound, string> = {
    traffic: 'cars and taxis passing by',
    construction: 'distant construction sounds',
    street_performer: 'live music from a street performer',
    sirens: 'occasional emergency vehicle sirens',
    pedestrians: 'footsteps and conversations',
    weather_audio: 'weather-related sounds',
  };
  return descriptions[sound];
}

/**
 * Generate plot twist impact description
 */
export function getPlotTwistImpact(type: StreetPlotTwistType): string {
  const impacts: Record<StreetPlotTwistType, string> = {
    car_horn_interruption: 'comedic',
    dog_approaches: 'heartwarming',
    vendor_interruption: 'authentic NYC',
    friend_recognition: 'surprising',
    phone_call: 'dramatic',
    someone_joins: 'unexpected',
    unexpected_weather: 'atmospheric',
    none: 'none',
  };
  return impacts[type];
}

/**
 * Get festival description
 */
export function getFestivalDescription(festival: StreetFestival): string {
  const festivalData = STREET_FESTIVALS.find(f => f.value === festival);
  return festivalData?.description || '';
}

/**
 * Generate dramatic moment description
 */
export function getDramaticMomentDescription(type: StreetDramaticMomentType): string {
  const descriptions: Record<StreetDramaticMomentType, string> = {
    rain_starts: 'sudden rain begins to fall',
    sun_bursts: 'sun breaks through clouds',
    train_passes_overhead: 'subway train rumbles overhead',
    door_reveals: 'door opens revealing something unexpected',
    light_changes: 'dramatic lighting shift',
    crowd_gathers: 'crowd begins to gather around',
  };
  return descriptions[type];
}

/**
 * Generate pivot transition phrase
 */
export function getPivotTransitionPhrase(type: CrossStreetPivotType): string {
  const phrases: Record<CrossStreetPivotType, string> = {
    deeper: "But let me ask you this...",
    challenge: "Wait, but what about...",
    personal: "Let me get personal for a second...",
    philosophical: "This makes me think...",
    comedic: "Okay, but real talk...",
  };
  return phrases[type];
}

/**
 * Calculate viral potential score for street interview
 */
export function calculateStreetViralScore(config: StreetEnhancementConfig | undefined): number {
  if (!config) return 50;

  let score = 50;

  // Multi-location journeys add engagement
  if (config.multiLocationJourney?.enabled) {
    score += 10;
    if (config.multiLocationJourney.stops.length >= 3) score += 5;
  }

  // Crowd reactions add authenticity
  if (config.crowdDynamics?.enabled) {
    score += 5;
    if (config.crowdDynamics.reactions.length >= 2) score += 5;
  }

  // Plot twists add shareability
  if (config.plotTwist && config.plotTwist.type !== 'none') {
    score += 10;
  }

  // Dramatic moments add memorability
  if (config.dramaticMoment?.enabled) {
    score += 8;
  }

  // Seasonal context adds relevance
  if (config.seasonalContext?.enabled) {
    score += 5;
  }

  // Cross-street pivots add depth
  if (config.crossStreetPivot?.enabled) {
    score += 7;
  }

  return Math.min(100, score);
}
