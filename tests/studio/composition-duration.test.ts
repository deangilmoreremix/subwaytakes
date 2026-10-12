import { describe, expect, it } from 'vitest';
import { projectDurationInFrames } from '../../src/studio/SubwayEditorComposition';
import {
  PROJECT_FORMAT_VERSION,
  clipLength,
  createEmptyProject,
  parseProject,
  type StudioProject,
} from '../../src/studio/types';

function parsedProject(overrides: Record<string, unknown> = {}): StudioProject {
  const base = createEmptyProject('comp-1', 'Composition Project');
  const videoTrack = base.tracks.find((t) => t.kind === 'video')!;
  videoTrack.clips.push(
    {
      id: 'c1',
      assetUrl: '',
      assetKind: 'generated',
      start: 0,
      trimStart: 0,
      trimEnd: 2.5,
      volume: 1,
      fadeIn: 0,
      fadeOut: 0,
    },
    {
      id: 'c2',
      assetUrl: '',
      assetKind: 'generated',
      start: 2.5,
      trimStart: 0,
      trimEnd: 2,
      volume: 1,
      fadeIn: 0,
      fadeOut: 0,
    },
  );
  base.captions.push({ id: 'cap', text: 'hi', start: 4, end: 4.8, kind: 'dialogue' });

  const payload: Record<string, unknown> = { ...JSON.parse(JSON.stringify(base)), ...overrides };
  const parsed = parseProject(payload);
  if (!parsed.ok || !parsed.project) throw new Error(parsed.error ?? 'parse failed');
  return parsed.project;
}

describe('projectDurationInFrames', () => {
  it('uses the longest clip end and the project fps', () => {
    const project = parsedProject();
    // clips end at 4.5, caption ends at 4.8 -> 4.8s * 30fps = 144 frames
    expect(projectDurationInFrames(project)).toBe(144);
  });

  it('extends for captions that outlive the clips', () => {
    const project = parsedProject();
    project.captions[0] = { ...project.captions[0], start: 6, end: 9.25 };

    expect(projectDurationInFrames(project)).toBe(Math.ceil(9.25 * project.fps));
  });

  it('respects an explicitly larger project duration', () => {
    const project = parsedProject({ duration: 12 });
    expect(projectDurationInFrames(project)).toBe(360);
  });

  it('respects a custom fps', () => {
    const project = parsedProject({ fps: 60 });
    expect(projectDurationInFrames(project)).toBe(Math.ceil(4.8 * 60));
  });

  it('never returns fewer than 30 frames', () => {
    const empty = createEmptyProject('empty');
    expect(projectDurationInFrames(empty)).toBe(30);

    const tiny = parsedProject({
      tracks: [{ id: 'video-0', kind: 'video', name: 'Video', muted: false, volume: 1, clips: [{ id: 'x', assetUrl: '', assetKind: 'generated', start: 0, trimStart: 0, trimEnd: 0.2, volume: 1, fadeIn: 0, fadeOut: 0 }] }],
      captions: [],
    });
    expect(tiny.tracks[0].clips[0].start + clipLength(tiny.tracks[0].clips[0])).toBeCloseTo(0.2, 5);
    expect(projectDurationInFrames(tiny)).toBe(30);
  });

  it('matches the parsed content even when the serialized duration lies', () => {
    const project = parsedProject({ duration: 0 });

    expect(project.duration).toBeCloseTo(4.5, 5);
    expect(project.version).toBe(PROJECT_FORMAT_VERSION);
    expect(projectDurationInFrames(project)).toBe(144);
  });
});
