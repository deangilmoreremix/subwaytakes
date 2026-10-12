import { describe, expect, it } from 'vitest';
import {
  HISTORY_LIMIT,
  MIN_CLIP_LENGTH,
  createStudioHistory,
  snapSeconds,
  studioReducer,
  type StudioAction,
} from '../../src/lib/studioReducer';
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
    volume: 1,
    fadeIn: 0,
    fadeOut: 0,
    label: 'Clip A',
    ...overrides,
  };
}

function baseProject(): StudioProject {
  const project = createEmptyProject('project-r', 'Reducer Project');
  const videoTrack = project.tracks.find((t) => t.kind === 'video')!;
  const subtitleTrack = project.tracks.find((t) => t.kind === 'subtitle')!;
  videoTrack.clips.push(
    makeClip(),
    makeClip({ id: 'clip-b', start: 3, trimEnd: 2, beatId: 'guest_responds', shotType: 'guest', label: 'Clip B' }),
  );
  void subtitleTrack;
  return {
    ...project,
    duration: 5,
    scenePlan: [
      { beatId: 'opening_hook', shotType: 'host', dialogue: 'hi', speaker: 'host', cameraDirection: '', prompt: '', clipId: 'clip-a' },
      { beatId: 'guest_responds', shotType: 'guest', dialogue: 'hello', speaker: 'guest', cameraDirection: '', prompt: '' },
    ],
  };
}

function videoClips(project: StudioProject): StudioClip[] {
  return (project.tracks.find((t) => t.kind === 'video')?.clips ?? []) as StudioClip[];
}

function findClip(project: StudioProject, id: string): StudioClip | undefined {
  for (const track of project.tracks) {
    const clip = track.clips.find((c) => c.id === id);
    if (clip) return clip;
  }
  return undefined;
}

function dispatchAll(project: StudioProject, actions: StudioAction[]): StudioProject {
  return actions.reduce((state, action) => studioReducer(state, action), project);
}

describe('studioReducer — clip lifecycle', () => {
  it('ADD_CLIP appends to the addressed track and sanitizes the clip', () => {
    const project = baseProject();
    const next = studioReducer(project, {
      type: 'ADD_CLIP',
      trackId: project.tracks.find((t) => t.kind === 'video')!.id,
      clip: makeClip({ id: 'new', start: -4, trimStart: -1, trimEnd: 0.5, volume: 9, fadeIn: -2 }),
    });

    const clips = videoClips(next);
    expect(clips).toHaveLength(3);
    const added = clips.find((c) => c.id === 'new');
    expect(added).toBeDefined();
    expect(added?.start).toBe(0);
    expect(added?.trimStart).toBe(0);
    expect(added?.trimEnd).toBeCloseTo(0.5, 5);
    expect(added?.volume).toBe(1);
    expect(added?.fadeIn).toBe(0);
  });

  it('REMOVE_CLIP drops the clip and clears the scene-plan reference', () => {
    const project = baseProject();
    const next = studioReducer(project, { type: 'REMOVE_CLIP', clipId: 'clip-a' });

    expect(videoClips(next)).toHaveLength(1);
    expect(videoClips(next)[0].id).toBe('clip-b');
    expect(next.scenePlan[0].clipId).toBeUndefined();
    expect(next.scenePlan[1].clipId).toBeUndefined();
  });

  it('REMOVE_CLIP for an unknown id is a no-op (same reference)', () => {
    const project = baseProject();
    expect(studioReducer(project, { type: 'REMOVE_CLIP', clipId: 'nope' })).toBe(project);
  });

  it('TRIM_CLIP applies new trims and enforces the minimum length', () => {
    const project = baseProject();
    const trimmed = studioReducer(project, { type: 'TRIM_CLIP', clipId: 'clip-a', trimStart: 1, trimEnd: 2.5 });

    expect(findClip(trimmed, 'clip-a')?.trimStart).toBe(1);
    expect(findClip(trimmed, 'clip-a')?.trimEnd).toBeCloseTo(2.5, 5);

    const inverted = studioReducer(project, { type: 'TRIM_CLIP', clipId: 'clip-a', trimStart: 2, trimEnd: 1 });
    expect(findClip(inverted, 'clip-a')?.trimStart).toBe(2);
    expect(findClip(inverted, 'clip-a')?.trimEnd).toBeCloseTo(2 + MIN_CLIP_LENGTH, 5);

    const negative = studioReducer(project, { type: 'TRIM_CLIP', clipId: 'clip-a', trimStart: -5, trimEnd: 1 });
    expect(findClip(negative, 'clip-a')?.trimStart).toBe(0);
    expect(findClip(negative, 'clip-a')?.trimEnd).toBeCloseTo(1, 5);
  });

  it('TRIM_CLIP with unchanged trims is a no-op (same reference)', () => {
    const project = baseProject();
    expect(studioReducer(project, { type: 'TRIM_CLIP', clipId: 'clip-a', trimStart: 0, trimEnd: 3 })).toBe(project);
  });

  it('MOVE_CLIP snaps to the 0.25s grid and rejects negatives', () => {
    const project = baseProject();

    const moved = studioReducer(project, { type: 'MOVE_CLIP', clipId: 'clip-b', newStart: 5.3 });
    expect(findClip(moved, 'clip-b')?.start).toBeCloseTo(5.25, 5);

    const exact = studioReducer(project, { type: 'MOVE_CLIP', clipId: 'clip-b', newStart: 7 });
    expect(findClip(exact, 'clip-b')?.start).toBe(7);

    const negative = studioReducer(project, { type: 'MOVE_CLIP', clipId: 'clip-b', newStart: -3 });
    expect(findClip(negative, 'clip-b')?.start).toBe(0);
  });

  it('SPLIT_CLIP produces two clips with correct times sharing the asset', () => {
    const project = baseProject();
    const next = studioReducer(project, { type: 'SPLIT_CLIP', clipId: 'clip-a', atSeconds: 1.5 });

    const clips = videoClips(next);
    expect(clips).toHaveLength(3);
    const [first, second] = clips;

    expect(first.id).toBe('clip-a');
    expect(first.start).toBe(0);
    expect(first.trimStart).toBe(0);
    expect(first.trimEnd).toBeCloseTo(1.5, 5);
    expect(first.fadeOut).toBe(0);

    expect(second.id).not.toBe('clip-a');
    expect(second.start).toBeCloseTo(1.5, 5);
    expect(second.trimStart).toBeCloseTo(1.5, 5);
    expect(second.trimEnd).toBeCloseTo(3, 5);
    expect(second.fadeIn).toBe(0);
    expect(second.label).toBe('Clip A (2)');

    // same source asset, total length preserved
    expect(second.assetUrl).toBe(first.assetUrl);
    expect(second.assetKind).toBe(first.assetKind);
    expect(clipLength(first) + clipLength(second)).toBeCloseTo(3, 5);
  });

  it('SPLIT_CLIP too close to an edge is a no-op', () => {
    const project = baseProject();
    expect(studioReducer(project, { type: 'SPLIT_CLIP', clipId: 'clip-a', atSeconds: MIN_CLIP_LENGTH / 2 })).toBe(project);
    expect(studioReducer(project, { type: 'SPLIT_CLIP', clipId: 'clip-a', atSeconds: 3 - MIN_CLIP_LENGTH / 2 })).toBe(project);
  });

  it('REORDER_TRACK re-times the block contiguously', () => {
    const project = baseProject();
    // clip-a: [0,3) clip-b: [3,5) — move clip-a after clip-b
    const next = studioReducer(project, {
      type: 'REORDER_TRACK',
      trackId: project.tracks.find((t) => t.kind === 'video')!.id,
      fromIndex: 0,
      toIndex: 1,
    });

    const clips = videoClips(next);
    expect(clips.map((c) => c.id)).toEqual(['clip-b', 'clip-a']);
    // the block is re-timed contiguously, anchored at the (new) first clip's start
    expect(clips[0].start).toBe(3);
    expect(clips[0].start + clipLength(clips[0])).toBeCloseTo(clips[1].start, 5);
    expect(clips[1].start + clipLength(clips[1])).toBeCloseTo(8, 5);
  });

  it('REORDER_TRACK keeps the block gap-free for any permutation', () => {
    const three = baseProject();
    const videoTrack = three.tracks.find((t) => t.kind === 'video')!;
    videoTrack.clips.push(
      makeClip({ id: 'clip-c', start: 5, trimEnd: 1, label: 'Clip C' }),
    );

    // move clip-c (index 2) to the front: the block keeps clip-c's old start (5) as anchor
    const next = studioReducer(three, { type: 'REORDER_TRACK', trackId: videoTrack.id, fromIndex: 2, toIndex: 0 });
    const clips = videoClips(next);

    expect(clips.map((c) => c.id)).toEqual(['clip-c', 'clip-a', 'clip-b']);
    expect(clips[0].start).toBe(5);
    for (let i = 1; i < clips.length; i++) {
      expect(clips[i].start).toBeCloseTo(clips[i - 1].start + clipLength(clips[i - 1]), 5);
    }
  });

  it('REORDER_TRACK with fewer than two clips is a no-op', () => {
    const project = baseProject();
    const single = studioReducer(project, { type: 'REMOVE_CLIP', clipId: 'clip-b' });
    const trackId = single.tracks.find((t) => t.kind === 'video')!.id;
    expect(studioReducer(single, { type: 'REORDER_TRACK', trackId, fromIndex: 0, toIndex: 0 })).toBe(single);
  });
});

describe('studioReducer — volumes and assets', () => {
  it('SET_CLIP_VOLUME clamps into 0..1', () => {
    const project = baseProject();
    const loud = studioReducer(project, { type: 'SET_CLIP_VOLUME', clipId: 'clip-a', volume: 4 });
    expect(findClip(loud, 'clip-a')?.volume).toBe(1);

    const quiet = studioReducer(project, { type: 'SET_CLIP_VOLUME', clipId: 'clip-a', volume: -2 });
    expect(findClip(quiet, 'clip-a')?.volume).toBe(0);

    const mid = studioReducer(project, { type: 'SET_CLIP_VOLUME', clipId: 'clip-a', volume: 0.35 });
    expect(findClip(mid, 'clip-a')?.volume).toBeCloseTo(0.35, 5);
  });

  it('SET_TRACK_VOLUME and TOGGLE_TRACK_MUTE update the track', () => {
    const project = baseProject();
    const musicTrack = project.tracks.find((t) => t.kind === 'music')!;

    const volumed = studioReducer(project, { type: 'SET_TRACK_VOLUME', trackId: musicTrack.id, volume: 0.25 });
    expect(volumed.tracks.find((t) => t.id === musicTrack.id)?.volume).toBeCloseTo(0.25, 5);

    const toggled = studioReducer(volumed, { type: 'TOGGLE_TRACK_MUTE', trackId: musicTrack.id });
    expect(toggled.tracks.find((t) => t.id === musicTrack.id)?.muted).toBe(!musicTrack.muted);
  });

  it('SET_CLIP_ASSET swaps the asset and claims the matching scene-plan beat', () => {
    const project = baseProject();
    const next = studioReducer(project, {
      type: 'SET_CLIP_ASSET',
      clipId: 'clip-b',
      assetUrl: 'https://cdn.example.com/uploaded-b.mp4',
      assetKind: 'uploaded',
    });

    const clip = findClip(next, 'clip-b');
    expect(clip?.assetUrl).toBe('https://cdn.example.com/uploaded-b.mp4');
    expect(clip?.assetKind).toBe('uploaded');
    // clip-b belongs to guest_responds, whose scene-plan entry has no clipId yet
    expect(next.scenePlan.find((e) => e.beatId === 'guest_responds')?.clipId).toBe('clip-b');
    // an entry already claimed by another clip is not stolen
    expect(next.scenePlan.find((e) => e.beatId === 'opening_hook')?.clipId).toBe('clip-a');
  });
});

describe('studioReducer — captions and branding', () => {
  it('ADD_CAPTION appends in insertion order (sanitize does not re-sort cues)', () => {
    const project = baseProject();
    const next = dispatchAll(project, [
      { type: 'ADD_CAPTION', caption: { id: 'late', text: 'late', start: 8, end: 10, kind: 'dialogue' } },
      { type: 'ADD_CAPTION', caption: { id: 'early', text: 'early', start: 1, end: 2, kind: 'dialogue' } },
    ]);

    expect(next.captions.map((c) => c.id)).toEqual(['late', 'early']);
  });

  it('UPDATE_CAPTION edits text/timing and enforces end > start', () => {
    const project = baseProject();
    const seeded = studioReducer(project, {
      type: 'ADD_CAPTION',
      caption: { id: 'c1', text: 'original', start: 2, end: 4, kind: 'dialogue', speaker: 'host' },
    });

    const updated = studioReducer(seeded, {
      type: 'UPDATE_CAPTION',
      captionId: 'c1',
      updates: { text: 'edited', speaker: 'guest' },
    });
    expect(updated.captions[0].text).toBe('edited');
    expect(updated.captions[0].speaker).toBe('guest');

    const collapsed = studioReducer(seeded, {
      type: 'UPDATE_CAPTION',
      captionId: 'c1',
      updates: { start: 3, end: 3 },
    });
    expect(collapsed.captions[0].start).toBe(3);
    expect(collapsed.captions[0].end).toBeGreaterThan(3);

    const negative = studioReducer(seeded, { type: 'UPDATE_CAPTION', captionId: 'c1', updates: { start: -9 } });
    expect(negative.captions[0].start).toBe(0);
  });

  it('REMOVE_CAPTION drops the cue', () => {
    const project = baseProject();
    const seeded = studioReducer(project, {
      type: 'ADD_CAPTION',
      caption: { id: 'c1', text: 'x', start: 0, end: 1, kind: 'dialogue' },
    });

    const removed = studioReducer(seeded, { type: 'REMOVE_CAPTION', captionId: 'c1' });
    expect(removed.captions).toHaveLength(0);
    expect(studioReducer(seeded, { type: 'REMOVE_CAPTION', captionId: 'nope' })).toBe(seeded);
  });

  it('SET_BRANDING merges partials and trims handle/watermark', () => {
    const project = baseProject();
    const next = studioReducer(project, {
      type: 'SET_BRANDING',
      branding: { handle: '  @newhandle  ', accentColor: '#123456' },
    });

    expect(next.branding.handle).toBe('@newhandle');
    expect(next.branding.accentColor).toBe('#123456');
    // untouched fields keep their previous values
    expect(next.branding.watermarkText).toBe(project.branding.watermarkText);

    const emptyHandle = studioReducer(next, { type: 'SET_BRANDING', branding: { handle: '   ' } });
    expect(emptyHandle.branding.handle).toBe('@newhandle');

    const emptyAccent = studioReducer(next, { type: 'SET_BRANDING', branding: { accentColor: '' } });
    expect(emptyAccent.branding.accentColor).toBe('#123456');
  });

  it('SET_TITLE / SET_DURATION clamp and normalize', () => {
    const project = baseProject();
    expect(studioReducer(project, { type: 'SET_TITLE', title: '   ' }).title).toBe('Untitled Subway Interview');
    expect(studioReducer(project, { type: 'SET_TITLE', title: '  My Interview  ' }).title).toBe('My Interview');
    // duration can grow freely but never shrinks below the content (clips fill 5s)
    expect(studioReducer(project, { type: 'SET_DURATION', duration: -5 }).duration).toBe(5);
    expect(studioReducer(project, { type: 'SET_DURATION', duration: 12 }).duration).toBe(12);
    // non-finite values are rejected as no-ops (same reference)
    expect(studioReducer(project, { type: 'SET_DURATION', duration: Number.NaN })).toBe(project);
    // an empty project can be set to zero
    const empty = createEmptyProject('empty');
    expect(studioReducer(empty, { type: 'SET_DURATION', duration: -3 }).duration).toBe(0);
  });
});

describe('studioReducer — undo/redo history', () => {
  it('UNDO/REDO walk across at least three mutations', () => {
    const initial = baseProject();
    const history = createStudioHistory(initial);

    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);

    history.dispatch({ type: 'SET_TITLE', title: 'Step 1' });
    history.dispatch({ type: 'ADD_CAPTION', caption: { id: 'c9', text: 'cue', start: 0, end: 1, kind: 'dialogue' } });
    history.dispatch({ type: 'SET_CLIP_VOLUME', clipId: 'clip-a', volume: 0.2 });

    expect(history.state.title).toBe('Step 1');
    expect(history.state.captions).toHaveLength(1);
    expect(findClip(history.state, 'clip-a')?.volume).toBeCloseTo(0.2, 5);
    expect(history.canUndo()).toBe(true);

    history.undo();
    expect(findClip(history.state, 'clip-a')?.volume).toBe(1);
    history.undo();
    expect(history.state.captions).toHaveLength(0);
    history.undo();
    expect(history.state.title).toBe(initial.title);
    expect(history.canUndo()).toBe(false);

    history.redo();
    expect(history.state.title).toBe('Step 1');
    history.redo();
    expect(history.state.captions).toHaveLength(1);
    history.redo();
    expect(findClip(history.state, 'clip-a')?.volume).toBeCloseTo(0.2, 5);
    expect(history.canRedo()).toBe(false);
  });

  it('notifies subscribers and stops after unsubscribe', () => {
    const history = createStudioHistory(baseProject());
    let calls = 0;
    const unsubscribe = history.subscribe(() => {
      calls += 1;
    });

    history.dispatch({ type: 'SET_TITLE', title: 'A' });
    expect(calls).toBe(1);
    unsubscribe();
    history.dispatch({ type: 'SET_TITLE', title: 'B' });
    expect(calls).toBe(1);
  });

  it('no-op dispatches do not create history entries', () => {
    const history = createStudioHistory(baseProject());
    history.dispatch({ type: 'SET_TITLE', title: history.state.title });
    history.dispatch({ type: 'TRIM_CLIP', clipId: 'clip-a', trimStart: 0, trimEnd: 3 });
    expect(history.canUndo()).toBe(false);
  });

  it('caps the undo stack at HISTORY_LIMIT', () => {
    const history = createStudioHistory(baseProject());
    const total = HISTORY_LIMIT + 4;
    for (let i = 1; i <= total; i++) {
      history.dispatch({ type: 'SET_TITLE', title: `t${i}` });
    }

    let undos = 0;
    while (history.canUndo()) {
      history.undo();
      undos += 1;
    }
    expect(undos).toBe(HISTORY_LIMIT);
    // the oldest surviving state is the one after mutation #(total - HISTORY_LIMIT)
    expect(history.state.title).toBe(`t${total - HISTORY_LIMIT}`);
  });

  it('LOAD_PROJECT resets both stacks', () => {
    const history = createStudioHistory(baseProject());
    history.dispatch({ type: 'SET_TITLE', title: 'temp' });
    history.dispatch({ type: 'SET_CLIP_VOLUME', clipId: 'clip-a', volume: 0.1 });
    history.undo();
    expect(history.canRedo()).toBe(true);

    const loaded = createEmptyProject('loaded', 'Loaded Project');
    history.dispatch({ type: 'LOAD_PROJECT', project: loaded });

    expect(history.state.id).toBe('loaded');
    expect(history.state.title).toBe('Loaded Project');
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
  });

  it('sanitizes the initial project on creation', () => {
    const dirty = baseProject();
    dirty.tracks[0].clips[0].start = -10;
    const history = createStudioHistory(dirty);
    expect(history.state.tracks[0].clips[0].start).toBe(0);
  });
});

describe('snapSeconds', () => {
  it('snaps within 0.15s of the 0.25s grid', () => {
    expect(snapSeconds(2.3)).toBeCloseTo(2.25, 5);
    expect(snapSeconds(2.5)).toBeCloseTo(2.5, 5);
    expect(snapSeconds(0.1)).toBeCloseTo(0, 5);
    expect(snapSeconds(Number.NaN)).toBe(0);
  });
});
