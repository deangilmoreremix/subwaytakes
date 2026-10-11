/**
 * SubwayTakes interview production preset — seven beats.
 *
 * The beats match the SubwayTakes video format:
 * 1. Opening hook          2. Interviewer introduces opinion
 * 3. Guest responds        4. Interviewer challenges answer
 * 5. Guest expands argument 6. Reaction / funny moment
 * 7. Closing statement
 *
 * Each beat maps to a shot type (host / guest / two_shot / reaction /
 * environment) plus camera direction, audio direction and framing guidance
 * used to build MuAPI video-generation prompts.
 */

import type { BeatId, ShotType, StudioScenePlanEntry, StudioCaption, StudioClip, StudioTrack } from './types';
import { createEmptyTrack } from './types';

export interface InterviewBeatDef {
  beatId: BeatId;
  label: string;
  shotType: ShotType;
  defaultCamera: string;
  audioDirection: string;
  framingDirection: string;
  /** Rough on-screen duration target in seconds. */
  targetDuration: number;
}

export const INTERVIEW_BEATS: InterviewBeatDef[] = [
  {
    beatId: 'opening_hook',
    label: '1. Opening Hook',
    shotType: 'host',
    defaultCamera: 'Handheld medium close-up, quick push-in',
    audioDirection: 'Train ambience low, voice forward, no music yet',
    framingDirection: 'Host centered, subway platform motion behind, eye contact with lens',
    targetDuration: 6,
  },
  {
    beatId: 'interviewer_intro',
    label: '2. Interviewer Introduces Opinion',
    shotType: 'two_shot',
    defaultCamera: 'Two-shot over the shoulder, card mic visible',
    audioDirection: 'Balanced interview audio, natural room reverb of the platform',
    framingDirection: 'Classic over-the-shoulder two-shot, mic entering frame bottom',
    targetDuration: 8,
  },
  {
    beatId: 'guest_responds',
    label: '3. Guest Responds',
    shotType: 'guest',
    defaultCamera: 'Medium shot on guest, slight handheld drift',
    audioDirection: 'Guest voice forward, train rumble bed, occasional announcement',
    framingDirection: 'Guest in sharp focus, commuters passing through background bokeh',
    targetDuration: 8,
  },
  {
    beatId: 'interviewer_challenges',
    label: '4. Interviewer Challenges',
    shotType: 'host',
    defaultCamera: 'Tight close-up on host, energetic reframe',
    audioDirection: 'Host voice forward, brief music sting optional',
    framingDirection: 'Tight on host face, eyebrows raised, gesturing with mic hand',
    targetDuration: 7,
  },
  {
    beatId: 'guest_expands',
    label: '5. Guest Expands Argument',
    shotType: 'guest',
    defaultCamera: 'Slow dolly from medium to close on guest',
    audioDirection: 'Guest voice forward, music bed swelling subtly underneath',
    framingDirection: 'Guest leaning in, animated hands, genuine conviction',
    targetDuration: 9,
  },
  {
    beatId: 'reaction_moment',
    label: '6. Reaction / Funny Moment',
    shotType: 'reaction',
    defaultCamera: 'Cut to bystander reaction, quick handheld punch-in',
    audioDirection: 'Ambient spike (laughter, train screech), voices attenuated',
    framingDirection: 'Bystander or commuter reacting, wide-to-tight snap',
    targetDuration: 5,
  },
  {
    beatId: 'closing_statement',
    label: '7. Closing Statement',
    shotType: 'two_shot',
    defaultCamera: 'Two-shot, slow pull back, train arriving behind',
    audioDirection: 'Balanced voices, train arrival swell, music button at the end',
    framingDirection: 'Both subjects centered, train doors opening behind them',
    targetDuration: 8,
  },
];

export const BEAT_LABELS: Record<BeatId, string> = INTERVIEW_BEATS.reduce(
  (acc, b) => ({ ...acc, [b.beatId]: b.label }),
  {} as Record<BeatId, string>,
);

/** Base scene-plan entries for the preset (no AI generation yet). */
export function buildInterviewScenePlan(): StudioScenePlanEntry[] {
  return INTERVIEW_BEATS.map((beat) => ({
    beatId: beat.beatId,
    shotType: beat.shotType,
    dialogue: '',
    speaker: beat.shotType === 'guest' ? 'guest' : beat.shotType === 'host' ? 'host' : 'none',
    cameraDirection: beat.defaultCamera,
    prompt: '',
  }));
}

/** Video-generation prompt fragment for a beat (used with MuAPI text-to-video). */
export function buildBeatVideoPrompt(
  beat: InterviewBeatDef,
  topic: string,
  hostDescription: string,
  guestDescription: string,
  environment: string,
): string {
  const cast =
    beat.shotType === 'guest'
      ? `Guest: ${guestDescription || 'a relatable New Yorker in their 30s'}`
      : beat.shotType === 'host'
        ? `Host: ${hostDescription || 'a confident interviewer in a puffer jacket holding a card mic'}`
        : beat.shotType === 'reaction'
          ? 'A random commuter bystander reacting with genuine surprise and amusement'
          : `Host: ${hostDescription || 'a confident interviewer with a card mic'}. Guest: ${guestDescription || 'a relatable New Yorker in their 30s'}`;
  return [
    `Documentary-style subway interview clip about "${topic}".`,
    cast + '.',
    `Environment: ${environment || 'NYC subway platform and moving train interior, warm fluorescent lighting'}.`,
    `Camera: ${beat.defaultCamera}.`,
    `Framing: ${beat.framingDirection}.`,
    'Style: authentic handheld documentary footage, natural skin texture, real subway lighting, physically plausible motion, no AI artifacts, no waxy skin, no floating hands.',
    'Vertical 9:16 composition.',
  ].join(' ');
}

/** New project tracks with one placeholder video clip per beat. */
export function buildPresetTracks(projectId: string, beatDurations: number[] = []): StudioTrack[] {
  const videoTrack = createEmptyTrack('video', 'Video', 0);
  let cursor = 0;
  INTERVIEW_BEATS.forEach((beat, i) => {
    const duration = beatDurations[i] ?? beat.targetDuration;
    const clip: StudioClip = {
      id: `${projectId}-beat-${beat.beatId}`,
      assetUrl: '',
      assetKind: 'generated',
      beatId: beat.beatId,
      shotType: beat.shotType,
      start: cursor,
      trimStart: 0,
      trimEnd: duration,
      volume: 1,
      fadeIn: i === 0 ? 0.5 : 0.3,
      fadeOut: i === INTERVIEW_BEATS.length - 1 ? 0.8 : 0.3,
      label: beat.label,
    };
    videoTrack.clips.push(clip);
    cursor += duration;
  });
  return [
    videoTrack,
    createEmptyTrack('narration', 'Narration', 1),
    createEmptyTrack('music', 'Music', 2),
    createEmptyTrack('ambient', 'Ambient Sound', 3),
    createEmptyTrack('subtitle', 'Subtitles', 4),
  ];
}

/** Opening hook caption shown over the first beat. */
export function buildHookCaption(projectId: string, topic: string, handle: string): StudioCaption {
  return {
    id: `${projectId}-hook-caption`,
    text: topic,
    start: 0.4,
    end: 4.4,
    kind: 'hook',
    speaker: handle,
  };
}
