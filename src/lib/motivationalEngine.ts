import type {
  MotivationalEnhancementConfig,
  TransformationScene,
  AudienceReactionType,
  MotivationalMusicType,
  BreakthroughType,
  EventPhase,
  LiveChallengeType,
  SpeakerArchetype,
  AchievementContextType,
  CTAPivotType,
} from './types';
import { SPEAKER_ARCHETYPES, ACHIEVEMENT_CONTEXT_TYPES } from './constants';

/**
 * Motivational Engine
 * 
 * Generates contextual prompts and configurations for motivational speaker clips
 * with advanced features like transformation arcs, breakthrough moments, and
 * speaker archetypes.
 */

export interface MotivationalContext {
  speakerPersona: string;
  visualStyle: string;
  audioLayers: string[];
  narrativeArc: string;
  pacingCues: PacingCue[];
  emotionalBeats: EmotionalBeat[];
  ctaElements: string[];
}

export interface PacingCue {
  timestamp: number;
  type: 'pause' | 'build' | 'peak' | 'release' | 'transition';
  description: string;
}

export interface EmotionalBeat {
  timestamp: number;
  emotion: 'inspiration' | 'struggle' | 'triumph' | 'reflection' | 'challenge';
  intensity: 'low' | 'medium' | 'high';
  description: string;
}

/**
 * Build a complete motivational context from enhancement config
 */
export function buildMotivationalContext(
  config: MotivationalEnhancementConfig | undefined,
  baseDuration: number
): MotivationalContext {
  if (!config) {
    return {
      speakerPersona: 'motivational speaker',
      visualStyle: 'cinematic dramatic lighting',
      audioLayers: ['inspirational background music'],
      narrativeArc: 'direct motivational message',
      pacingCues: [],
      emotionalBeats: [],
      ctaElements: [],
    };
  }

  const context: MotivationalContext = {
    speakerPersona: buildSpeakerPersona(config),
    visualStyle: buildVisualStyle(config),
    audioLayers: buildAudioLayers(config),
    narrativeArc: buildNarrativeArc(config),
    pacingCues: buildPacingCues(config, baseDuration),
    emotionalBeats: buildEmotionalBeats(config, baseDuration),
    ctaElements: buildCTAElements(config),
  };

  return context;
}

/**
 * Generate a prompt snippet for motivational enhancements
 */
export function generateMotivationalEnhancementPrompt(config: MotivationalEnhancementConfig | undefined): string {
  if (!config) return '';

  const parts: string[] = [];

  // Speaker archetype
  if (config.speakerArchetype?.enabled) {
    const archetypeData = SPEAKER_ARCHETYPES.find(a => a.value === config.speakerArchetype!.archetype);
    parts.push(`Speaker style: ${archetypeData?.label} - ${archetypeData?.style}`);
  }

  // Transformation arc
  if (config.transformationArc?.enabled) {
    parts.push(`Transformation: ${config.transformationArc.narrativeArc}`);
    parts.push(`Visual progression: ${config.transformationArc.visualProgression}`);
  }

  // Event energy arc
  if (config.eventEnergyArc?.enabled) {
    parts.push(`Event phase: ${config.eventEnergyArc.phase}`);
    parts.push(`Energy curve: ${config.eventEnergyArc.energyCurve}`);
  }

  // Achievement context
  if (config.achievementContext?.enabled) {
    parts.push(`Setting: ${config.achievementContext.contextType}`);
    parts.push(`Atmosphere: ${config.achievementContext.atmosphere}`);
  }

  // Breakthrough moment
  if (config.breakthroughMoment?.enabled) {
    parts.push(`Breakthrough: ${config.breakthroughMoment.type} (${config.breakthroughMoment.impact})`);
  }

  // Live challenge
  if (config.liveChallenge?.enabled) {
    parts.push(`Audience challenge: ${config.liveChallenge.challengeType}`);
  }

  // Soundscape / audio
  if (config.soundscape?.enabled) {
    parts.push(`Music: ${config.soundscape.musicType.replace(/_/g, ' ')} at ${config.soundscape.musicIntensity} intensity`);
    if (config.soundscape.crowdSounds) {
      parts.push('Crowd sound effects layered in');
    }
  }

  // Audience energy
  if (config.audienceEnergy?.enabled && config.audienceEnergy.moments.length > 0) {
    const reactions = config.audienceEnergy.moments.map(m => `${m.type} (${m.intensity})`).join(', ');
    parts.push(`Audience reactions: ${reactions}`);
  }

  // Pause for effect
  if (config.pauseForEffect?.enabled) {
    parts.push(`Strategic pause at ${config.pauseForEffect.timing}s: ${config.pauseForEffect.duration}s ${config.pauseForEffect.cameraAction}`);
  }

  // CTA Pivot
  if (config.ctaPivot?.enabled) {
    parts.push(`Call-to-action: ${config.ctaPivot.pivotType}`);
  }

  return parts.join('. ');
}

/**
 * Build speaker persona description
 */
function buildSpeakerPersona(config: MotivationalEnhancementConfig): string {
  if (config.speakerArchetype?.enabled) {
    const archetypeData = SPEAKER_ARCHETYPES.find(a => a.value === config.speakerArchetype!.archetype);
    return `${archetypeData?.label} style: ${archetypeData?.description}`;
  }
  return 'motivational speaker';
}

/**
 * Build visual style description
 */
function buildVisualStyle(config: MotivationalEnhancementConfig): string {
  const parts: string[] = ['cinematic'];

  if (config.achievementContext?.enabled) {
    parts.push(config.achievementContext.backdrop);
  }

  if (config.transformationArc?.enabled) {
    parts.push(`${config.transformationArc.visualProgression} visual progression`);
  }

  return parts.join(', ');
}

/**
 * Build audio layer descriptions
 */
function buildAudioLayers(config: MotivationalEnhancementConfig): string[] {
  const layers: string[] = [];

  if (config.soundscape?.enabled) {
    const musicType = config.soundscape.musicType;
    const intensity = config.soundscape.musicIntensity;
    layers.push(`${musicType} music (${intensity})`);

    if (config.soundscape.crowdSounds) {
      layers.push('crowd reactions');
    }
  }

  if (config.audienceEnergy?.enabled) {
    const reactions = config.audienceEnergy.moments.map(m => m.type).join(', ');
    if (reactions) layers.push(`audience ${reactions}`);
  }

  return layers.length > 0 ? layers : ['inspirational background music'];
}

/**
 * Build narrative arc description
 */
function buildNarrativeArc(config: MotivationalEnhancementConfig): string {
  if (config.transformationArc?.enabled) {
    return `${config.transformationArc.narrativeArc} transformation arc`;
  }

  if (config.eventEnergyArc?.enabled) {
    return `${config.eventEnergyArc.phase} event energy`;
  }

  return 'direct motivational message';
}

/**
 * Build pacing cues for editing
 */
function buildPacingCues(config: MotivationalEnhancementConfig, duration: number): PacingCue[] {
  const cues: PacingCue[] = [];

  // Pause for effect
  if (config.pauseForEffect?.enabled) {
    cues.push({
      timestamp: config.pauseForEffect.timing,
      type: 'pause',
      description: `${config.pauseForEffect.duration}s pause with ${config.pauseForEffect.cameraAction}`,
    });
  }

  // Breakthrough moment
  if (config.breakthroughMoment?.enabled) {
    cues.push({
      timestamp: config.breakthroughMoment.timing,
      type: 'peak',
      description: `Breakthrough: ${config.breakthroughMoment.type}`,
    });
  }

  // Live challenge
  if (config.liveChallenge?.enabled) {
    cues.push({
      timestamp: config.liveChallenge.timing,
      type: 'build',
      description: `Challenge: ${config.liveChallenge.challengeType}`,
    });
  }

  // CTA Pivot
  if (config.ctaPivot?.enabled) {
    cues.push({
      timestamp: config.ctaPivot.timing,
      type: 'transition',
      description: `CTA: ${config.ctaPivot.pivotType}`,
    });
  }

  // Event energy phases
  if (config.eventEnergyArc?.enabled) {
    const phase = config.eventEnergyArc.phase;
    if (phase === 'pre_event') {
      cues.push({ timestamp: 0, type: 'build', description: 'Building anticipation' });
    } else if (phase === 'peak_moment') {
      cues.push({ timestamp: duration * 0.7, type: 'peak', description: 'Climax moment' });
    } else if (phase === 'closing') {
      cues.push({ timestamp: duration * 0.8, type: 'release', description: 'Resolution' });
    }
  }

  // Sort by timestamp
  return cues.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Build emotional beats
 */
function buildEmotionalBeats(config: MotivationalEnhancementConfig, duration: number): EmotionalBeat[] {
  const beats: EmotionalBeat[] = [];

  // Transformation arc beats
  if (config.transformationArc?.enabled) {
    config.transformationArc.scenes.forEach((scene, index) => {
      const timestamp = (index / config.transformationArc!.scenes.length) * duration;
      const emotionMap: Record<TransformationScene, EmotionalBeat['emotion']> = {
        before: 'struggle',
        during: 'reflection',
        after: 'triumph',
      };
      beats.push({
        timestamp,
        emotion: emotionMap[scene.scene],
        intensity: scene.scene === 'after' ? 'high' : 'medium',
        description: scene.emotionalTone,
      });
    });
  }

  // Audience energy beats
  if (config.audienceEnergy?.enabled) {
    config.audienceEnergy.moments.forEach(moment => {
      const emotionMap: Record<AudienceReactionType, EmotionalBeat['emotion']> = {
        cheering: 'triumph',
        inspired: 'inspiration',
        moved: 'reflection',
        energized: 'inspiration',
        contemplative: 'reflection',
      };
      beats.push({
        timestamp: moment.timing,
        emotion: emotionMap[moment.type],
        intensity: moment.intensity === 'intense' ? 'high' : moment.intensity === 'moderate' ? 'medium' : 'low',
        description: moment.description,
      });
    });
  }

  // Sort by timestamp
  return beats.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Build CTA elements
 */
function buildCTAElements(config: MotivationalEnhancementConfig): string[] {
  const elements: string[] = [];

  if (config.ctaPivot?.enabled) {
    elements.push(config.ctaPivot.callToAction);
  }

  if (config.liveChallenge?.enabled) {
    elements.push(config.liveChallenge.callToAction);
  }

  return elements;
}

/**
 * Get speaker archetype delivery style
 */
export function getSpeakerDeliveryStyle(archetype: SpeakerArchetype): string {
  const archetypeData = SPEAKER_ARCHETYPES.find(a => a.value === archetype);
  return archetypeData?.style || 'dynamic speaking style';
}

/**
 * Get music type description
 */
export function getMusicTypeDescription(type: MotivationalMusicType): string {
  const descriptions: Record<MotivationalMusicType, string> = {
    epic_orchestral: 'cinematic orchestral swells and powerful crescendos',
    ambient_electronic: 'modern atmospheric electronic soundscapes',
    piano_inspirational: 'emotional solo piano with intimate feel',
    rock_anthem: 'driving guitars and high-energy rock instrumentation',
    minimal: 'sparse minimal accompaniment focusing on voice',
  };
  return descriptions[type];
}

/**
 * Get breakthrough moment description
 */
export function getBreakthroughMomentDescription(type: BreakthroughType): string {
  const descriptions: Record<BreakthroughType, string> = {
    mic_drop: 'speaker drops the mic after powerful statement',
    mentor_appears: 'wise mentor figure enters frame',
    crowd_erupts: 'audience explodes in applause and cheers',
    visual_metaphor: 'symbolic imagery represents the message',
    silence_pregnant: 'strategic silence lets the moment land',
    camera_freeze: 'freeze frame on powerful expression',
    lighting_shift: 'dramatic lighting change emphasizes moment',
  };
  return descriptions[type];
}

/**
 * Get event phase description
 */
export function getEventPhaseDescription(phase: EventPhase): string {
  const descriptions: Record<EventPhase, string> = {
    pre_event: 'behind-the-scenes preparation and anticipation',
    mid_event: 'in the flow with building momentum',
    peak_moment: 'climax with maximum impact and energy',
    closing: 'resolution and call to action',
  };
  return descriptions[phase];
}

/**
 * Get live challenge description
 */
export function getLiveChallengeDescription(type: LiveChallengeType): string {
  const descriptions: Record<LiveChallengeType, string> = {
    stand_up: 'ask audience to stand if they resonate with the message',
    raise_hand: 'ask audience to raise their hand',
    hashtag_display: 'display social media hashtag for sharing',
    thirty_day_challenge: 'launch a 30-day transformation challenge',
    commitment_moment: 'create a powerful commitment moment',
  };
  return descriptions[type];
}

/**
 * Get achievement context description
 */
export function getAchievementContextDescription(type: AchievementContextType): string {
  const contextData = ACHIEVEMENT_CONTEXT_TYPES.find(c => c.value === type);
  return contextData?.description || '';
}

/**
 * Get CTA pivot description
 */
export function getCTAPivotDescription(type: CTAPivotType): string {
  const descriptions: Record<CTAPivotType, string> = {
    story_to_advice: 'transition from personal story to actionable advice',
    write_this_down: 'key moment emphasizing "write this down"',
    final_challenge: 'one last challenge to the audience',
    join_movement: 'invite audience to join something bigger',
    share_message: 'ask audience to share with someone who needs it',
  };
  return descriptions[type];
}

/**
 * Calculate viral potential score for motivational content
 */
export function calculateMotivationalViralScore(config: MotivationalEnhancementConfig | undefined): number {
  if (!config) return 50;

  let score = 50;

  // Speaker archetype adds authenticity
  if (config.speakerArchetype?.enabled) {
    score += 10;
  }

  // Transformation arc adds narrative depth
  if (config.transformationArc?.enabled) {
    score += 10;
    if (config.transformationArc.scenes.length >= 3) score += 5;
  }

  // Breakthrough moments add shareability
  if (config.breakthroughMoment?.enabled) {
    score += 15;
  }

  // Live challenges add engagement
  if (config.liveChallenge?.enabled) {
    score += 10;
  }

  // Pause for effect adds production value
  if (config.pauseForEffect?.enabled) {
    score += 8;
  }

  // Achievement context adds credibility
  if (config.achievementContext?.enabled) {
    score += 7;
  }

  // CTA pivot adds actionability
  if (config.ctaPivot?.enabled) {
    score += 5;
  }

  // Audience energy adds social proof
  if (config.audienceEnergy?.enabled) {
    score += 5;
  }

  return Math.min(100, score);
}

/**
 * Generate a complete motivational script template
 */
export function generateMotivationalScriptTemplate(config: MotivationalEnhancementConfig | undefined): {
  hook: string;
  body: string[];
  cta: string;
} {
  const template = {
    hook: 'I need to tell you something that changed my life...',
    body: ['The struggle is real, but so is the breakthrough.'],
    cta: 'Now go out there and make it happen!',
  };

  if (!config) return template;

  // Customize based on speaker archetype
  if (config.speakerArchetype?.enabled) {
    const archetype = config.speakerArchetype.archetype;
    const archetypeHooks: Record<SpeakerArchetype, string> = {
      drill_sergeant: 'Listen up! I\'m only going to say this once...',
      tony_robbins: 'What if I told you that everything you want is on the other side of fear?',
      brene_brown: 'I want to share something vulnerable with you today...',
      gary_vee: 'Stop making excuses and start making moves.',
      oprah: 'I\'ve learned that every experience is a gift...',
      eric_thomas: 'When you want to succeed as bad as you want to breathe...',
      simon_sinek: 'I want to start with a simple question: Why?',
    };
    template.hook = archetypeHooks[archetype];
  }

  // Add transformation arc elements
  if (config.transformationArc?.enabled) {
    template.body = config.transformationArc.scenes.map(s => s.emotionalTone);
  }

  // Add CTA
  if (config.ctaPivot?.enabled) {
    template.cta = config.ctaPivot.callToAction;
  } else if (config.liveChallenge?.enabled) {
    template.cta = config.liveChallenge.callToAction;
  }

  return template;
}
