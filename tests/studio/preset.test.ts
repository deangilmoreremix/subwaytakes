import { describe, expect, it } from 'vitest';
import {
  BEAT_LABELS,
  INTERVIEW_BEATS,
  buildBeatVideoPrompt,
  buildHookCaption,
  buildInterviewScenePlan,
  buildPresetTracks,
} from '../../src/studio/interviewPreset';
import { clipLength } from '../../src/studio/types';

const EXPECTED_BEAT_IDS = [
  'opening_hook',
  'interviewer_intro',
  'guest_responds',
  'interviewer_challenges',
  'guest_expands',
  'reaction_moment',
  'closing_statement',
];

describe('interviewPreset beats', () => {
  it('defines the seven SubwayTakes beats in order', () => {
    expect(INTERVIEW_BEATS).toHaveLength(7);
    expect(INTERVIEW_BEATS.map((b) => b.beatId)).toEqual(EXPECTED_BEAT_IDS);
    expect(Object.keys(BEAT_LABELS)).toEqual(EXPECTED_BEAT_IDS);
  });

  it('builds a base scene plan entry per beat with a speaker derived from the shot type', () => {
    const plan = buildInterviewScenePlan();

    expect(plan).toHaveLength(7);
    expect(plan.map((entry) => entry.beatId)).toEqual(EXPECTED_BEAT_IDS);
    expect(plan.find((e) => e.beatId === 'guest_responds')?.speaker).toBe('guest');
    expect(plan.find((e) => e.beatId === 'opening_hook')?.speaker).toBe('host');
    expect(plan.find((e) => e.beatId === 'interviewer_intro')?.speaker).toBe('none');
    for (const entry of plan) {
      expect(entry.dialogue).toBe('');
      expect(entry.prompt).toBe('');
    }
  });
});

describe('buildPresetTracks', () => {
  it('creates 7 contiguous video clips totalling the sum of beat targets', () => {
    const tracks = buildPresetTracks('proj-1');
    const videoTrack = tracks.find((t) => t.kind === 'video');

    expect(tracks).toHaveLength(5);
    expect(tracks.map((t) => t.kind)).toEqual(['video', 'narration', 'music', 'ambient', 'subtitle']);
    expect(videoTrack?.clips).toHaveLength(7);

    const clips = videoTrack?.clips ?? [];
    const expectedTotal = INTERVIEW_BEATS.reduce((sum, beat) => sum + beat.targetDuration, 0);
    expect(expectedTotal).toBe(51);

    let cursor = 0;
    clips.forEach((clip, i) => {
      expect(clip.id).toBe(`proj-1-beat-${EXPECTED_BEAT_IDS[i]}`);
      expect(clip.beatId).toBe(EXPECTED_BEAT_IDS[i]);
      expect(clip.start).toBeCloseTo(cursor, 5);
      expect(clip.trimStart).toBe(0);
      expect(clip.trimEnd).toBeCloseTo(INTERVIEW_BEATS[i].targetDuration, 5);
      cursor += clipLength(clip);
    });
    expect(cursor).toBeCloseTo(expectedTotal, 5);

    // contiguity: each clip ends exactly where the next begins
    for (let i = 1; i < clips.length; i++) {
      expect(clips[i].start).toBeCloseTo(clips[i - 1].start + clipLength(clips[i - 1]), 5);
    }
  });

  it('honours custom per-beat durations', () => {
    const durations = [2, 2, 2, 2, 2, 2, 2];
    const clips = buildPresetTracks('proj-2', durations).find((t) => t.kind === 'video')?.clips ?? [];

    expect(clips).toHaveLength(7);
    expect(clips.every((c) => clipLength(c) === 2)).toBe(true);
    expect(clips[6].start).toBeCloseTo(12, 5);
  });

  it('fades the first clip in and the last clip out', () => {
    const clips = buildPresetTracks('proj-3').find((t) => t.kind === 'video')?.clips ?? [];

    expect(clips[0].fadeIn).toBeGreaterThan(0);
    expect(clips[clips.length - 1].fadeOut).toBeGreaterThan(0);
  });
});

describe('buildBeatVideoPrompt', () => {
  const beat = INTERVIEW_BEATS[2]; // guest_responds
  const hostBeat = INTERVIEW_BEATS[0]; // opening_hook

  it('includes the topic, cast and environment with defaults', () => {
    const prompt = buildBeatVideoPrompt(beat, 'Pineapple on pizza', '', '', '');

    expect(prompt).toContain('Pineapple on pizza');
    expect(prompt).toContain('Guest: a relatable New Yorker in their 30s');
    expect(prompt).toContain('NYC subway platform and moving train interior');
    expect(prompt).toContain(beat.defaultCamera);
    expect(prompt).toContain(beat.framingDirection);
  });

  it('uses supplied cast and environment descriptions', () => {
    const prompt = buildBeatVideoPrompt(
      hostBeat,
      'Renting in NYC',
      'a tall host in a red jacket',
      'a short guest with glasses',
      'a crowded 6 train',
    );

    expect(prompt).toContain('a tall host in a red jacket');
    expect(prompt).toContain('a crowded 6 train');
    expect(prompt).toContain('Renting in NYC');
  });

  it('carries the no-AI-artifacts authenticity guidance and vertical framing', () => {
    const prompt = buildBeatVideoPrompt(beat, 'Topic', 'H', 'G', 'E');

    expect(prompt).toContain('no AI artifacts');
    expect(prompt).toContain('no waxy skin');
    expect(prompt).toContain('no floating hands');
    expect(prompt).toContain('authentic handheld documentary footage');
    expect(prompt).toContain('Vertical 9:16');
  });

  it('describes a bystander for reaction beats', () => {
    const reactionBeat = INTERVIEW_BEATS.find((b) => b.shotType === 'reaction')!;
    const prompt = buildBeatVideoPrompt(reactionBeat, 'Topic', 'H', 'G', 'E');

    expect(prompt).toContain('commuter bystander reacting');
  });
});

describe('buildHookCaption', () => {
  it('builds the opening hook card over the first beat', () => {
    const caption = buildHookCaption('proj-9', 'Best pizza slice?', '@subwaytakes');

    expect(caption.id).toBe('proj-9-hook-caption');
    expect(caption.kind).toBe('hook');
    expect(caption.text).toBe('Best pizza slice?');
    expect(caption.speaker).toBe('@subwaytakes');
    expect(caption.start).toBeCloseTo(0.4, 5);
    expect(caption.end).toBeCloseTo(4.4, 5);
  });
});
