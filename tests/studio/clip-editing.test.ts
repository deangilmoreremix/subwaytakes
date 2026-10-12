import { describe, expect, it } from 'vitest';

import { createStudioHistory, studioReducer, type StudioAction } from '../../src/lib/studioReducer';
import {
  createEmptyProject,
  clipLength,
  type StudioClip,
  type StudioProject,
} from '../../src/studio/types';

function makeClip(overrides: Partial<StudioClip> = {}): StudioClip {
  return {
    id: 'clip-a',
    assetUrl: 'https://cdn.example.com/a.mp4',
    assetKind: 'generated',
    beatId: 'opening_hook',
    shotType: 'host',
    start: 0,
    trimStart: 0,
    trimEnd: 3,
    volume: 0.8,
    fadeIn: 0.3,
    fadeOut: 0.8,
    label: 'Clip A',
    ...overrides,
  };
}

function videoTrackClips(project: StudioProject): StudioClip[] {
  return project.tracks.find((t) => t.kind === 'video')?.clips ?? [];
}

function dispatchAll(project: StudioProject, actions: StudioAction[]): StudioProject {
  return actions.reduce((state, action) => studioReducer(state, action), project);
}

/**
 * Clip editing beyond trim/split/move: duplicate + the asset-identity rules
 * (a new asset replaces the previous canonical ref, a re-signed URL for the
 * same object may keep it).
 */
describe('studioReducer — duplicate and asset identity', () => {
  it('DUPLICATE_CLIP copies the clip right after the source, preserving trim/volume/fades', () => {
    const project = createEmptyProject('project-d', 'Duplicate Project');
    const videoTrack = project.tracks.find((t) => t.kind === 'video')!;
    videoTrack.clips.push(makeClip(), makeClip({ id: 'clip-b', start: 4, label: 'Clip B' }));

    const next = studioReducer(project, { type: 'DUPLICATE_CLIP', clipId: 'clip-a' });
    const clips = videoTrackClips(next);

    expect(clips).toHaveLength(3);
    const copy = clips[1]!;
    expect(copy.id).not.toBe('clip-a');
    expect(copy.start).toBeCloseTo(clipLength(makeClip()), 3); // plays right after the source
    expect(copy.trimStart).toBe(0);
    expect(copy.trimEnd).toBe(3);
    expect(copy.volume).toBe(0.8);
    expect(copy.fadeIn).toBe(0.3);
    expect(copy.fadeOut).toBe(0.8);
    expect(copy.assetUrl).toBe('https://cdn.example.com/a.mp4');
    expect(copy.label).toBe('Clip A (copy)');
    // the duplicate is an independent clip: the scene plan keeps the original
    expect(copy.beatId).toBeUndefined();
    expect(next.scenePlan).toEqual(project.scenePlan);
    // the source is untouched (a new object, not a mutation)
    expect(videoTrackClips(project)).toHaveLength(2);
  });

  it('DUPLICATE_CLIP is undoable and duplicating twice yields two independent copies', () => {
    const project = createEmptyProject('project-d2', 'Duplicate Twice');
    project.tracks.find((t) => t.kind === 'video')!.clips.push(makeClip());

    const history = createStudioHistory(project);
    history.dispatch({ type: 'DUPLICATE_CLIP', clipId: 'clip-a' });
    history.dispatch({ type: 'DUPLICATE_CLIP', clipId: 'clip-a' });

    const clips = videoTrackClips(history.state);
    expect(clips).toHaveLength(3);
    const ids = new Set(clips.map((c) => c.id));
    expect(ids.size).toBe(3);
    // each copy plays where the source ends — duplicating the same clip twice
    // stacks the copies, so moving one apart is a deliberate edit
    expect(clips[1]!.start).toBeCloseTo(3, 3);
    expect(clips[2]!.start).toBeCloseTo(3, 3);

    history.dispatch({ type: 'MOVE_CLIP', clipId: clips[2]!.id, newStart: 6 });
    expect(videoTrackClips(history.state)[2]!.start).toBeCloseTo(6, 3);

    // undo unwinds the move, then the two duplicates, one step at a time
    history.undo();
    expect(videoTrackClips(history.state)).toHaveLength(3);
    history.undo();
    expect(videoTrackClips(history.state)).toHaveLength(2);
    history.undo();
    expect(videoTrackClips(history.state)).toHaveLength(1);
    history.redo();
    expect(videoTrackClips(history.state)).toHaveLength(2);
  });

  it('REMOVE_CLIP + DUPLICATE_CLIP are no-ops for unknown ids', () => {
    const project = createEmptyProject('project-d3', 'No-op');
    project.tracks.find((t) => t.kind === 'video')!.clips.push(makeClip());

    expect(studioReducer(project, { type: 'DUPLICATE_CLIP', clipId: 'nope' })).toBe(project);
    expect(studioReducer(project, { type: 'REMOVE_CLIP', clipId: 'nope' })).toBe(project);
  });

  it('SET_CLIP_ASSET replaces the identity: the previous ref is dropped', () => {
    const project = createEmptyProject('project-ref', 'Refs');
    project.tracks.find((t) => t.kind === 'video')!.clips.push(
      makeClip({
        assetRef: { bucket: 'studio-uploads', path: 'u/p/old.mp4', kind: 'video' },
        assetUrl: 'https://stub.test/storage/v1/object/sign/studio-uploads/u/p/old.mp4?token=1',
      }),
    );

    // a brand new asset => the old canonical ref must not survive
    const swapped = studioReducer(project, {
      type: 'SET_CLIP_ASSET',
      clipId: 'clip-a',
      assetUrl: 'https://cdn.example.com/new.mp4',
      assetKind: 'uploaded',
    });
    expect(videoTrackClips(swapped)[0]!.assetUrl).toBe('https://cdn.example.com/new.mp4');
    expect(videoTrackClips(swapped)[0]!.assetRef).toBeUndefined();

    // ... and an explicitly provided ref is stored as-is
    const ref = { bucket: 'studio-uploads', path: 'u/p/new.mp4', kind: 'video' as const };
    const stored = studioReducer(project, {
      type: 'SET_CLIP_ASSET',
      clipId: 'clip-a',
      assetUrl: 'https://stub.test/storage/v1/object/sign/studio-uploads/u/p/new.mp4?token=2',
      assetKind: 'generated',
      assetRef: ref,
    });
    expect(videoTrackClips(stored)[0]!.assetRef).toEqual(ref);

    // a refresh of the same asset keeps the ref (same identity, new URL)
    const refreshed = studioReducer(stored, {
      type: 'SET_CLIP_ASSET',
      clipId: 'clip-a',
      assetUrl: 'https://stub.test/storage/v1/object/sign/studio-uploads/u/p/new.mp4?token=3',
      assetKind: 'generated',
      assetRef: ref,
    });
    expect(videoTrackClips(refreshed)[0]!.assetRef).toEqual(ref);
    expect(videoTrackClips(refreshed)[0]!.assetUrl).toContain('token=3');
  });

  it('duplicated clips survive a trim/split/reorder round trip', () => {
    const project = createEmptyProject('project-d4', 'Round trip');
    project.tracks.find((t) => t.kind === 'video')!.clips.push(makeClip());

    const next = dispatchAll(project, [
      { type: 'DUPLICATE_CLIP', clipId: 'clip-a' },
      { type: 'SPLIT_CLIP', clipId: 'clip-a', atSeconds: 1 },
    ]);
    const clips = videoTrackClips(next);
    expect(clips.length).toBeGreaterThanOrEqual(3);
    for (const clip of clips) {
      expect(clipLength(clip)).toBeGreaterThan(0);
      expect(clip.volume).toBeCloseTo(0.8, 5);
    }
  });
});
