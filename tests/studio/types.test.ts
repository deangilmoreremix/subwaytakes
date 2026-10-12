import { describe, expect, it } from 'vitest';
import {
  PROJECT_FORMAT_VERSION,
  clipLength,
  createEmptyProject,
  parseProject,
  projectContentDuration,
  sanitizeProject,
  type StudioClip,
  type StudioProject,
} from '../../src/studio/types';

function makeClip(overrides: Partial<StudioClip> = {}): StudioClip {
  return {
    id: 'clip-1',
    assetUrl: 'https://cdn.example.com/clip-1.mp4',
    assetKind: 'generated',
    beatId: 'opening_hook',
    shotType: 'host',
    start: 0,
    trimStart: 0,
    trimEnd: 5,
    sourceDuration: 9,
    volume: 1,
    fadeIn: 0.5,
    fadeOut: 0.3,
    label: 'Beat 1',
    portrait: true,
    ...overrides,
  };
}

function validProject(): StudioProject {
  const base = createEmptyProject('project-1', 'Round Trip Project');
  return {
    ...base,
    duration: 10,
    tracks: base.tracks.map((track) =>
      track.kind === 'video'
        ? {
            ...track,
            clips: [
              makeClip(),
              makeClip({ id: 'clip-2', start: 5, trimEnd: 4, label: 'Beat 2', beatId: 'guest_responds', shotType: 'guest' }),
            ],
          }
        : track,
    ),
    captions: [
      { id: 'cap-2', text: 'Hook', start: 0.4, end: 4.4, kind: 'hook', speaker: '@subwaytakes' },
      { id: 'cap-1', text: 'First cue', start: 1, end: 3, kind: 'dialogue', speaker: 'host' },
    ],
  };
}

describe('parseProject', () => {
  it('round-trips a valid project', () => {
    const project = validProject();
    const serialized = JSON.parse(JSON.stringify(project)) as unknown;
    const parsed = parseProject(serialized);

    expect(parsed.ok).toBe(true);
    expect(parsed.error).toBeUndefined();
    expect(parsed.project).toEqual(project);
  });

  it('rejects a project from a future format version', () => {
    const project = validProject();
    const result = parseProject({ ...project, version: PROJECT_FORMAT_VERSION + 1 });

    expect(result.ok).toBe(false);
    expect(result.project).toBeUndefined();
    expect(result.error).toContain('Unsupported project version');
  });

  it('round-trips an unsorted-caption project into chronological order', () => {
    const project = validProject();
    project.captions = [...project.captions].reverse();
    const result = parseProject(JSON.parse(JSON.stringify(project)) as unknown);

    expect(result.ok).toBe(true);
    expect(result.project?.captions.map((c) => c.id)).toEqual(['cap-2', 'cap-1']);
    expect(result.project?.captions.map((c) => c.start)).toEqual([0.4, 1]);
  });

  it('accepts an older project version and upgrades the stamp', () => {
    const project = validProject();
    const result = parseProject({ ...project, version: 0 });

    expect(result.ok).toBe(true);
    expect(result.project?.version).toBe(PROJECT_FORMAT_VERSION);
  });

  it('rejects non-object payloads', () => {
    expect(parseProject(null).ok).toBe(false);
    expect(parseProject('nope').ok).toBe(false);
    expect(parseProject(42).ok).toBe(false);
  });

  it('repairs a clip whose trimEnd is at or before trimStart', () => {
    const project = validProject();
    const result = parseProject({
      ...project,
      tracks: [
        {
          id: 'video-0',
          kind: 'video',
          name: 'Video',
          muted: false,
          volume: 1,
          clips: [
            { id: 'bad', assetUrl: '', assetKind: 'generated', start: 0, trimStart: 4, trimEnd: 2, volume: 1, fadeIn: 0, fadeOut: 0 },
            { id: 'equal', assetUrl: '', assetKind: 'generated', start: 0, trimStart: 3, trimEnd: 3, volume: 1, fadeIn: 0, fadeOut: 0 },
          ],
        },
      ],
      captions: [],
    });

    expect(result.ok).toBe(true);
    const [bad, equal] = result.project?.tracks[0].clips ?? [];
    expect(bad?.trimStart).toBe(4);
    expect(bad?.trimEnd).toBeCloseTo(4.1, 5);
    expect(equal?.trimEnd).toBeCloseTo(3.1, 5);
  });

  it('clamps negative starts to zero', () => {
    const project = validProject();
    const result = parseProject({
      ...project,
      tracks: [
        {
          id: 'video-0',
          kind: 'video',
          name: 'Video',
          muted: false,
          volume: 1,
          clips: [
            { id: 'neg', assetUrl: '', assetKind: 'generated', start: -12, trimStart: -3, trimEnd: 5, volume: 1, fadeIn: 0, fadeOut: 0 },
          ],
        },
      ],
      captions: [],
    });

    expect(result.project?.tracks[0].clips[0]?.start).toBe(0);
    expect(result.project?.tracks[0].clips[0]?.trimStart).toBe(0);
  });

  it('clamps clip and track volume into 0..1', () => {
    const project = validProject();
    const result = parseProject({
      ...project,
      tracks: [
        {
          id: 'video-0',
          kind: 'video',
          name: 'Video',
          muted: false,
          volume: 7,
          clips: [
            { id: 'loud', assetUrl: '', assetKind: 'generated', start: 0, trimStart: 0, trimEnd: 2, volume: 5, fadeIn: 0, fadeOut: 0 },
            { id: 'quiet', assetUrl: '', assetKind: 'generated', start: 2, trimStart: 0, trimEnd: 2, volume: -1, fadeIn: 0, fadeOut: 0 },
          ],
        },
      ],
      captions: [],
    });

    const clips = result.project?.tracks[0].clips ?? [];
    expect(result.project?.tracks[0].volume).toBe(1);
    expect(clips[0]?.volume).toBe(1);
    expect(clips[1]?.volume).toBe(0);
  });

  it('sorts clips by start and captions by start', () => {
    const project = validProject();
    const result = parseProject({
      ...project,
      tracks: [
        {
          id: 'video-0',
          kind: 'video',
          name: 'Video',
          muted: false,
          volume: 1,
          clips: [
            { id: 'late', assetUrl: '', assetKind: 'generated', start: 10, trimStart: 0, trimEnd: 2, volume: 1, fadeIn: 0, fadeOut: 0 },
            { id: 'early', assetUrl: '', assetKind: 'generated', start: 0, trimStart: 0, trimEnd: 2, volume: 1, fadeIn: 0, fadeOut: 0 },
            { id: 'mid', assetUrl: '', assetKind: 'generated', start: 5, trimStart: 0, trimEnd: 2, volume: 1, fadeIn: 0, fadeOut: 0 },
          ],
        },
      ],
      captions: [
        { id: 'c-late', text: 'late', start: 8, end: 9, kind: 'dialogue' },
        { id: 'c-early', text: 'early', start: 1, end: 2, kind: 'dialogue' },
      ],
    });

    expect(result.project?.tracks[0].clips.map((c) => c.id)).toEqual(['early', 'mid', 'late']);
    expect(result.project?.captions.map((c) => c.id)).toEqual(['c-early', 'c-late']);
  });

  it('drops tracks with unknown kinds and keeps caption end >= start', () => {
    const result = parseProject({
      version: 1,
      tracks: [
        { id: 'weird', kind: 'fog', name: 'Fog', clips: [] },
        { id: 'ok', kind: 'narration', name: 'Narration', muted: true, volume: 0.5, clips: [] },
      ],
      captions: [{ id: 'c', text: 'x', start: 5, end: 2, kind: 'not-a-kind' }],
    });

    expect(result.ok).toBe(true);
    expect(result.project?.tracks).toHaveLength(1);
    expect(result.project?.tracks[0].kind).toBe('narration');
    expect(result.project?.captions[0].kind).toBe('dialogue');
    expect(result.project?.captions[0].start).toBe(5);
    expect(result.project?.captions[0].end).toBeGreaterThan(5);
  });

  it('grows duration to cover all clips', () => {
    const result = parseProject({
      version: 1,
      duration: 0,
      tracks: [
        {
          id: 'video-0',
          kind: 'video',
          name: 'Video',
          clips: [
            { id: 'a', assetUrl: '', assetKind: 'generated', start: 4, trimStart: 1, trimEnd: 6, volume: 1, fadeIn: 0, fadeOut: 0 },
          ],
        },
      ],
      captions: [],
    });

    expect(result.project?.duration).toBeCloseTo(9, 5);
  });
});

describe('clipLength / projectContentDuration', () => {
  it('reports the on-timeline length of a clip', () => {
    expect(clipLength(makeClip())).toBe(5);
    expect(clipLength(makeClip({ trimStart: 1, trimEnd: 3.5 }))).toBeCloseTo(2.5, 5);
  });

  it('reports the last timeline position used by any clip', () => {
    const project = validProject();
    expect(projectContentDuration(project)).toBeCloseTo(9, 5);
  });

  it('is zero for a project with no clips', () => {
    expect(projectContentDuration(createEmptyProject('empty'))).toBe(0);
  });
});

describe('sanitizeProject', () => {
  it('clamps starts, trims, volumes and sorts clips', () => {
    const project = validProject();
    const dirty: StudioProject = {
      ...project,
      tracks: project.tracks.map((track) =>
        track.kind === 'video'
          ? {
              ...track,
              clips: [
                makeClip({ id: 'c1', start: -5, trimStart: -2, trimEnd: 1, volume: 3, fadeIn: -1, fadeOut: -4 }),
                makeClip({ id: 'c2', start: 0, trimStart: 2, trimEnd: 2, volume: 0.5 }),
              ],
            }
          : track,
      ),
    };

    const clean = sanitizeProject(dirty);
    const clips = clean.tracks.find((t) => t.kind === 'video')?.clips ?? [];
    // both clamp to start 0; the sort is stable so insertion order is kept
    expect(clips.map((c) => c.id)).toEqual(['c1', 'c2']);
    expect(clips[0].start).toBe(0);
    expect(clips[1].start).toBe(0);
    for (const clip of clips) {
      expect(clip.start).toBeGreaterThanOrEqual(0);
      expect(clip.trimStart).toBeGreaterThanOrEqual(0);
      expect(clip.trimEnd).toBeGreaterThanOrEqual(clip.trimStart + 0.1);
      expect(clip.volume).toBeGreaterThanOrEqual(0);
      expect(clip.volume).toBeLessThanOrEqual(1);
      expect(clip.fadeIn).toBeGreaterThanOrEqual(0);
      expect(clip.fadeOut).toBeGreaterThanOrEqual(0);
    }
  });

  it('never shrinks duration below the content', () => {
    const project = validProject();
    const clean = sanitizeProject({ ...project, duration: 0.5 });
    expect(clean.duration).toBeGreaterThanOrEqual(projectContentDuration(clean));
    expect(clean.duration).toBeCloseTo(9, 5);
  });

  it('does not mutate the input project', () => {
    const project = validProject();
    const snapshot = JSON.parse(JSON.stringify(project)) as StudioProject;
    sanitizeProject(project);
    expect(project).toEqual(snapshot);
  });
});

describe('createEmptyProject', () => {
  it('creates the five standard tracks', () => {
    const project = createEmptyProject('empty-1');

    expect(project.id).toBe('empty-1');
    expect(project.version).toBe(PROJECT_FORMAT_VERSION);
    expect(project.tracks).toHaveLength(5);
    expect(project.tracks.map((t) => t.kind)).toEqual([
      'video',
      'narration',
      'music',
      'ambient',
      'subtitle',
    ]);
    expect(project.captions).toEqual([]);
    expect(project.scenePlan).toEqual([]);
    expect(project.fps).toBe(30);
    expect(project.width).toBe(1080);
    expect(project.height).toBe(1920);
  });

  it('mutes music and ambient tracks by default', () => {
    const project = createEmptyProject('empty-2');
    for (const track of project.tracks) {
      if (track.kind === 'music' || track.kind === 'ambient') {
        expect(track.muted).toBe(true);
      } else {
        expect(track.muted).toBe(false);
      }
    }
  });
});
