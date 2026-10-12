/**
 * Studio editor behaviour that decides whether an EXPORT is renderable.
 *
 * Pure (no DOM, no network, no workers). Everything here is driven through the
 * real `studioReducer` / `createStudioHistory` and validated against the REAL
 * render-worker validator (`validateProjectSnapshot`), so the app-side editor
 * contract and the worker-side gate are proven to agree.
 *
 * Guarantees proven here:
 *  1. DUPLICATE_CLIP — a new id, plays right after the source, keeps
 *     trim/volume/fades, drops the beat link.
 *  2. SET_CLIP_BEAT — link/unlink claims and releases the scene-plan entry;
 *     a beat moved to a second clip releases the first; unchanged beats are a
 *     no-op (same project reference => no undo entry, no re-render).
 *  3. UPDATE_CAPTION — a style-only change produces a NEW project object, so
 *     change detection (and therefore history/save/re-render) fires.
 *  4. SPLIT / TRIM / REORDER / UNDO / REDO chains >= 3 deep, plus the 50-step
 *     history cap.
 *  5. Export-snapshot addressability — the same rule the worker enforces
 *     (every clip needs a canonical `assetRef` or a fetchable http(s)
 *     `assetUrl`), asserted for refs-only, legacy-URL-only, mixed and empty
 *     projects.
 *  6. Worker parity — reducer-produced projects (captions incl. style, clips
 *     incl. refs, branding incl. logoRef) pass `validateProjectSnapshot`
 *     unchanged, and the worker rejects exactly the snapshots the editor must
 *     not export.
 *  7. parseProject round-trip preserves `assetRef` + caption `style`.
 */
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
  buildPresetTracks,
  INTERVIEW_BEATS,
  buildHookCaption,
} from '../../src/studio/interviewPreset';
import { isMediaRef, mediaRefKey, type MediaRef } from '../../src/studio/mediaRefs';
import {
  clipLength,
  createEmptyProject,
  parseProject,
  projectContentDuration,
  type StudioCaption,
  type StudioClip,
  type StudioProject,
} from '../../src/studio/types';
// The worker is a separate deployable that re-implements the schema rules; the
// app-side suite imports the REAL validator so the two can never drift apart.
import { validateProjectSnapshot } from '../../render-worker/src/render.ts';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const OWNER = '11111111-1111-1111-1111-111111111111';
const PROJECT = '22222222-2222-2222-2222-222222222222';

function makeClip(overrides: Partial<StudioClip> = {}): StudioClip {
  return {
    id: 'clip-a',
    assetUrl: `https://cdn.example.com/${OWNER}/clip-a.mp4`,
    assetKind: 'uploaded',
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

/** A project with two video clips and a scene plan touching both beats. */
function baseProject(): StudioProject {
  const project = createEmptyProject(PROJECT, 'Editor Parity Project');
  const videoTrack = project.tracks.find((t) => t.kind === 'video')!;
  videoTrack.clips.push(
    makeClip(),
    makeClip({ id: 'clip-b', start: 3, trimEnd: 2, beatId: undefined, shotType: 'guest', label: 'Clip B' }),
  );
  return {
    ...project,
    duration: 5,
    captions: [
      { id: 'cap-1', text: 'first line', start: 0.5, end: 2.5, kind: 'dialogue' },
    ],
    scenePlan: [
      {
        beatId: 'opening_hook',
        shotType: 'host',
        dialogue: 'hi',
        speaker: 'host',
        cameraDirection: '',
        prompt: '',
        clipId: 'clip-a',
      },
      {
        beatId: 'guest_responds',
        shotType: 'guest',
        dialogue: 'hello',
        speaker: 'guest',
        cameraDirection: '',
        prompt: '',
      },
    ],
  };
}

function videoClips(project: StudioProject): StudioClip[] {
  return project.tracks.find((t) => t.kind === 'video')?.clips ?? [];
}

function clipById(project: StudioProject, clipId: string): StudioClip {
  for (const track of project.tracks) {
    const clip = track.clips.find((c) => c.id === clipId);
    if (clip) return clip;
  }
  throw new Error(`clip ${clipId} not found`);
}

function dispatchAll(project: StudioProject, actions: StudioAction[]): StudioProject {
  return actions.reduce((state, action) => studioReducer(state, action), project);
}

/** Serialize exactly like the queue does (JSONB snapshot) before validating. */
function snapshotOf(project: StudioProject): unknown {
  return JSON.parse(JSON.stringify(project)) as unknown;
}

// ---------------------------------------------------------------------------
// Export-snapshot addressability (mirror of the worker's rule)
// ---------------------------------------------------------------------------

interface AddressabilityProblem {
  clipId: string;
  reason: string;
}

function isLoopbackHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]' || h.startsWith('127.');
}

/**
 * The worker's media rule, mirrored app-side:
 *   - a structurally valid canonical `assetRef` is the identity (always ok);
 *   - otherwise `assetUrl` must be fetchable by headless Chromium: https,
 *     http on loopback only. An empty URL is a PLACEHOLDER clip: the worker
 *     tolerates it (it renders a label card) but an export must not ship one.
 */
function clipAddressability(clip: StudioClip): string | null {
  if (isMediaRef(clip.assetRef)) return null;
  if (!clip.assetUrl) return 'placeholder clip: no assetRef and an empty assetUrl';
  let parsed: URL;
  try {
    parsed = new URL(clip.assetUrl);
  } catch {
    return `assetUrl "${clip.assetUrl}" is not a URL and the clip has no assetRef`;
  }
  if (parsed.protocol === 'https:') return null;
  if (parsed.protocol === 'http:' && isLoopbackHost(parsed.hostname)) return null;
  return `assetUrl "${clip.assetUrl}" is not fetchable (${parsed.protocol}//) and the clip has no assetRef`;
}

function snapshotAddressabilityProblems(project: StudioProject): AddressabilityProblem[] {
  const problems: AddressabilityProblem[] = [];
  for (const track of project.tracks) {
    for (const clip of track.clips) {
      const reason = clipAddressability(clip);
      if (reason) problems.push({ clipId: clip.id, reason });
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------
// 1. DUPLICATE_CLIP
// ---------------------------------------------------------------------------

describe('DUPLICATE_CLIP', () => {
  it('creates a new clip that plays right after the source', () => {
    const project = baseProject();
    const source = clipById(project, 'clip-a');

    const next = studioReducer(project, { type: 'DUPLICATE_CLIP', clipId: 'clip-a' });
    const clips = videoClips(next);

    expect(clips).toHaveLength(3);
    const copy = clips[1]!;
    expect(copy.id).not.toBe('clip-a');
    expect(copy.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    // plays immediately after the source, on the snap grid
    expect(copy.start).toBeCloseTo(snapSeconds(source.start + clipLength(source)), 5);
    expect(copy.start).toBeCloseTo(3, 5);
    // the source itself is untouched (no in-place mutation of the input project)
    expect(videoClips(project)).toHaveLength(2);
    expect(clipById(project, 'clip-a').trimEnd).toBe(3);
    // the project grew to cover the copy (0..3 source + 3..6 copy, clip-b 3..5)
    expect(projectContentDuration(next)).toBeCloseTo(6, 5);
  });

  it('keeps trim, volume and fades (the copy is the same take)', () => {
    const project = baseProject();
    const source = clipById(project, 'clip-a');

    const copy = videoClips(studioReducer(project, { type: 'DUPLICATE_CLIP', clipId: 'clip-a' }))[1]!;

    expect(copy.trimStart).toBe(source.trimStart);
    expect(copy.trimEnd).toBe(source.trimEnd);
    expect(clipLength(copy)).toBeCloseTo(clipLength(source), 5);
    expect(copy.volume).toBe(source.volume);
    expect(copy.fadeIn).toBe(source.fadeIn);
    expect(copy.fadeOut).toBe(source.fadeOut);
    expect(copy.assetUrl).toBe(source.assetUrl);
    expect(copy.assetKind).toBe(source.assetKind);
    expect(copy.shotType).toBe(source.shotType);
    expect(copy.portrait).toBe(source.portrait);
  });

  it('drops the beat link: the scene plan keeps pointing at the original', () => {
    const project = baseProject();
    expect(project.scenePlan[0]!.clipId).toBe('clip-a');

    const next = studioReducer(project, { type: 'DUPLICATE_CLIP', clipId: 'clip-a' });

    const copy = videoClips(next)[1]!;
    expect(copy.beatId).toBeUndefined();
    expect(next.scenePlan[0]!.clipId).toBe('clip-a');
    // ...so the duplicate also reports no beat to the beat navigator
    expect(videoClips(next).filter((c) => c.beatId === 'opening_hook')).toHaveLength(1);
  });

  it('labels the copy and never overlaps an existing clip', () => {
    const project = baseProject(); // clip-a 0-3, clip-b 3-5
    const copy = videoClips(studioReducer(project, { type: 'DUPLICATE_CLIP', clipId: 'clip-b' }))[2]!;

    expect(copy.label).toBe('Clip B (copy)');
    expect(copy.start).toBeCloseTo(5, 5); // after clip-b ends, not over clip-a
    const starts = videoClips(studioReducer(project, { type: 'DUPLICATE_CLIP', clipId: 'clip-b' })).map((c) => c.start);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
  });

  it('is a no-op (same project reference) for an unknown clip id', () => {
    const project = baseProject();
    expect(studioReducer(project, { type: 'DUPLICATE_CLIP', clipId: 'nope' })).toBe(project);
  });

  it('survives an undo through the history stack', () => {
    const history = createStudioHistory(baseProject());
    history.dispatch({ type: 'DUPLICATE_CLIP', clipId: 'clip-a' });
    expect(videoClips(history.state)).toHaveLength(3);

    history.undo();
    expect(videoClips(history.state)).toHaveLength(2);
    expect(clipById(history.state, 'clip-a').beatId).toBe('opening_hook');

    history.redo();
    expect(videoClips(history.state)).toHaveLength(3);
    expect(videoClips(history.state)[1]!.beatId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 2. SET_CLIP_BEAT
// ---------------------------------------------------------------------------

describe('SET_CLIP_BEAT', () => {
  it('linking a clip claims the matching scene-plan entry', () => {
    const project = baseProject(); // clip-b is unlinked in the scene plan
    expect(project.scenePlan[1]!.clipId).toBeUndefined();

    const next = studioReducer(project, { type: 'SET_CLIP_BEAT', clipId: 'clip-b', beatId: 'guest_responds' });

    expect(clipById(next, 'clip-b').beatId).toBe('guest_responds');
    expect(next.scenePlan[1]!.clipId).toBe('clip-b');
    // the other entry is untouched
    expect(next.scenePlan[0]!.clipId).toBe('clip-a');
  });

  it('unlinking a clip releases its scene-plan entry', () => {
    const project = baseProject(); // clip-a owns opening_hook
    const next = studioReducer(project, { type: 'SET_CLIP_BEAT', clipId: 'clip-a', beatId: null });

    expect(clipById(next, 'clip-a').beatId).toBeUndefined();
    expect(next.scenePlan[0]!.clipId).toBeUndefined();
    // the entry itself survives: only the claim is released
    expect(next.scenePlan[0]!.beatId).toBe('opening_hook');
  });

  it('moving a beat to a second clip releases the first claim', () => {
    const project = baseProject();

    const next = studioReducer(project, { type: 'SET_CLIP_BEAT', clipId: 'clip-b', beatId: 'opening_hook' });

    // the scene-plan entry now belongs to clip-b only ...
    expect(next.scenePlan[0]!.clipId).toBe('clip-b');
    expect(next.scenePlan.filter((e) => e.beatId === 'opening_hook' && e.clipId === 'clip-a')).toHaveLength(0);
    // ... clip-b carries the beat ...
    expect(clipById(next, 'clip-b').beatId).toBe('opening_hook');
    // ... and clip-b's own previous beat was released from the scene plan
    expect(next.scenePlan[1]!.clipId).toBeUndefined();
    // documented behaviour: the *other* clip keeps its beatId field (the scene
    // plan is the single source of truth for which clip realizes a beat)
    expect(clipById(next, 'clip-a').beatId).toBe('opening_hook');
  });

  it('a beat can be moved from a clip to another clip and back', () => {
    const project = baseProject();
    const moved = studioReducer(project, { type: 'SET_CLIP_BEAT', clipId: 'clip-b', beatId: 'opening_hook' });
    const back = studioReducer(moved, { type: 'SET_CLIP_BEAT', clipId: 'clip-b', beatId: 'guest_responds' });

    expect(clipById(back, 'clip-b').beatId).toBe('guest_responds');
    expect(back.scenePlan[0]!.clipId).toBeUndefined(); // opening_hook is free again
    expect(back.scenePlan[1]!.clipId).toBe('clip-b');
  });

  it('is a no-op (same project reference) when the beat is unchanged', () => {
    const project = baseProject();
    expect(studioReducer(project, { type: 'SET_CLIP_BEAT', clipId: 'clip-a', beatId: 'opening_hook' })).toBe(project);
    expect(studioReducer(project, { type: 'SET_CLIP_BEAT', clipId: 'clip-b', beatId: null })).toBe(project);
  });

  it('is a no-op for an unknown clip id', () => {
    const project = baseProject();
    expect(studioReducer(project, { type: 'SET_CLIP_BEAT', clipId: 'nope', beatId: 'opening_hook' })).toBe(project);
    expect(studioReducer(project, { type: 'SET_CLIP_BEAT', clipId: 'nope', beatId: null })).toBe(project);
  });

  it('accepts every beat id of the interview preset', () => {
    let project = baseProject();
    for (const beat of INTERVIEW_BEATS) {
      project = studioReducer(project, { type: 'SET_CLIP_BEAT', clipId: 'clip-b', beatId: beat.beatId });
      expect(clipById(project, 'clip-b').beatId).toBe(beat.beatId);
    }
    // After walking through every beat, the clip holds only the LAST beat it
    // was moved to (every earlier claim was released when it moved on).
    const lastBeat = INTERVIEW_BEATS[INTERVIEW_BEATS.length - 1]!.beatId;
    expect(clipById(project, 'clip-b').beatId).toBe(lastBeat);
    expect(project.scenePlan.filter((e) => e.clipId === 'clip-b')).toHaveLength(0); // the last beat is not in this fixture's 2-entry scene plan
    expect(project.scenePlan[0]!.clipId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 3. UPDATE_CAPTION (style-aware change detection)
// ---------------------------------------------------------------------------

describe('UPDATE_CAPTION change detection', () => {
  it('a style-only change returns a NEW project object', () => {
    const project = baseProject();
    expect(project.captions[0]!.style).toBeUndefined();

    const next = studioReducer(project, {
      type: 'UPDATE_CAPTION',
      captionId: 'cap-1',
      updates: { style: 'boxed' },
    });

    expect(next).not.toBe(project); // change detection fires -> history/save/re-render
    expect(next.captions[0]!.style).toBe('boxed');
    // nothing else moved
    expect(next.captions[0]!.text).toBe('first line');
    expect(next.captions[0]!.start).toBe(0.5);
    expect(next.captions[0]!.end).toBe(2.5);
    expect(next.captions).toHaveLength(project.captions.length);
  });

  it('changing only the text also returns a new project object', () => {
    const project = baseProject();
    const next = studioReducer(project, {
      type: 'UPDATE_CAPTION',
      captionId: 'cap-1',
      updates: { text: 'second line' },
    });
    expect(next).not.toBe(project);
    expect(next.captions[0]!.text).toBe('second line');
  });

  it('an update with no observable effect returns the SAME project object', () => {
    const project = baseProject();
    expect(studioReducer(project, { type: 'UPDATE_CAPTION', captionId: 'cap-1', updates: {} })).toBe(project);
    expect(
      studioReducer(project, { type: 'UPDATE_CAPTION', captionId: 'cap-1', updates: { text: 'first line' } }),
    ).toBe(project);
    // re-applying the style that is already there
    const styled = studioReducer(project, {
      type: 'UPDATE_CAPTION',
      captionId: 'cap-1',
      updates: { style: 'boxed' },
    });
    expect(
      studioReducer(styled, { type: 'UPDATE_CAPTION', captionId: 'cap-1', updates: { style: 'boxed' } }),
    ).toBe(styled);
  });

  it('never changes the caption id, even when the updates carry one', () => {
    const project = baseProject();
    const next = studioReducer(project, {
      type: 'UPDATE_CAPTION',
      captionId: 'cap-1',
      updates: { id: 'hacked', text: 'x' },
    });
    expect(next.captions[0]!.id).toBe('cap-1');
  });

  it('clamps the window to a positive length and keeps it on the timeline', () => {
    const project = baseProject();
    const next = studioReducer(project, {
      type: 'UPDATE_CAPTION',
      captionId: 'cap-1',
      updates: { start: 4, end: 3.5 },
    });
    expect(next.captions[0]!.start).toBeCloseTo(4, 5);
    expect(next.captions[0]!.end).toBeCloseTo(4.1, 5);
    // ...and the master duration grows to cover the caption
    expect(next.duration).toBeGreaterThanOrEqual(4.1);
  });

  it('is a no-op for an unknown caption id', () => {
    const project = baseProject();
    expect(studioReducer(project, { type: 'UPDATE_CAPTION', captionId: 'nope', updates: { text: 'x' } })).toBe(
      project,
    );
  });
});

// ---------------------------------------------------------------------------
// 4. SPLIT / TRIM / REORDER chains + history
// ---------------------------------------------------------------------------

describe('edit chains', () => {
  it('splits a clip three times, cutting the fade at every boundary', () => {
    let project = baseProject();
    const sourceTrimEnd = clipById(project, 'clip-a').trimEnd;

    project = studioReducer(project, { type: 'SPLIT_CLIP', clipId: 'clip-a', atSeconds: 1 });
    project = studioReducer(project, { type: 'SPLIT_CLIP', clipId: 'clip-a', atSeconds: 0.5 });
    project = studioReducer(project, { type: 'SPLIT_CLIP', clipId: 'clip-a', atSeconds: 0.25 });

    const clips = videoClips(project);
    expect(clips).toHaveLength(5); // 3 new pieces from clip-a + clip-b
    const pieces = clips.filter((c) => c.start < 3).sort((a, b) => a.start - b.start);
    expect(pieces).toHaveLength(4);
    // the four pieces tile the original 0..3 window exactly
    expect(pieces[0]!.start).toBeCloseTo(0, 5);
    expect(pieces[3]!.start + clipLength(pieces[3]!)).toBeCloseTo(3, 5);
    for (let i = 1; i < pieces.length; i++) {
      expect(pieces[i]!.start).toBeCloseTo(pieces[i - 1]!.start + clipLength(pieces[i - 1]!), 5);
      expect(pieces[i]!.trimStart).toBeCloseTo(pieces[i - 1]!.trimEnd, 5);
    }
    // no fade across a cut, and the trims stay inside the source
    expect(pieces.slice(0, 3).every((c) => c.fadeOut === 0)).toBe(true);
    expect(pieces.slice(1).every((c) => c.fadeIn === 0)).toBe(true);
    expect(pieces.every((c) => c.trimEnd <= sourceTrimEnd + 1e-9)).toBe(true);
    // the head piece keeps the source id; every further cut is a NEW clip
    expect(pieces[0]!.id).toBe('clip-a');
    expect(new Set(pieces.map((c) => c.id)).size).toBe(4);
    expect(pieces.slice(1).every((c) => c.id !== 'clip-a')).toBe(true);
    expect(new Set(pieces.slice(1).map((c) => c.id)).size).toBe(3);
  });

  it('trims a clip three times, each step returning a new project', () => {
    const project = baseProject();
    const seen: StudioProject[] = [project];

    for (const [trimStart, trimEnd] of [[0.25, 2.75], [0.5, 2.5], [0.75, 2.25]] as const) {
      const next = studioReducer(seen[seen.length - 1]!, {
        type: 'TRIM_CLIP',
        clipId: 'clip-a',
        trimStart,
        trimEnd,
      });
      expect(next).not.toBe(seen[seen.length - 1]);
      seen.push(next);
    }

    const clip = clipById(seen[seen.length - 1]!, 'clip-a');
    expect(clip.trimStart).toBeCloseTo(0.75, 5);
    expect(clip.trimEnd).toBeCloseTo(2.25, 5);
    expect(clipLength(clip)).toBeCloseTo(1.5, 5);
    // a trim re-applied with the same values is a no-op (no undo noise)
    expect(
      studioReducer(seen[seen.length - 1]!, { type: 'TRIM_CLIP', clipId: 'clip-a', trimStart: 0.75, trimEnd: 2.25 }),
    ).toBe(seen[seen.length - 1]);
  });

  it('reorders a track three times, re-timing starts and keeping the total length', () => {
    let project = createEmptyProject(PROJECT, 'Reorder Chains');
    project.tracks.find((t) => t.kind === 'video')!.clips.push(
      makeClip({ id: 'clip-a', start: 0, trimEnd: 3 }),
      makeClip({ id: 'clip-b', start: 3, trimEnd: 2 }),
      makeClip({ id: 'clip-c', start: 5, trimEnd: 2, label: 'Clip C' }),
    );
    const total = projectContentDuration(project);
    expect(total).toBeCloseTo(7, 5);

    const order = (p: StudioProject) => videoClips(p).map((c) => c.id);
    const starts = (p: StudioProject) => videoClips(p).map((c) => c.start);
    const contiguous = (p: StudioProject) => {
      const clips = videoClips(p);
      return clips.slice(1).every((c, i) => Math.abs(c.start - (clips[i]!.start + clipLength(clips[i]!))) < 1e-9);
    };

    // three reorders, each pinned to the first slot so the re-timed sequence
    // stays contiguous (a reorder never leaves a gap or an overlap)
    project = studioReducer(project, { type: 'REORDER_TRACK', trackId: 'video-0', fromIndex: 1, toIndex: 2 });
    expect(order(project)).toEqual(['clip-a', 'clip-c', 'clip-b']);
    expect(starts(project)).toEqual([0, 3, 5]);
    expect(contiguous(project)).toBe(true);
    expect(projectContentDuration(project)).toBeCloseTo(total, 5);

    project = studioReducer(project, { type: 'REORDER_TRACK', trackId: 'video-0', fromIndex: 2, toIndex: 1 });
    expect(order(project)).toEqual(['clip-a', 'clip-b', 'clip-c']);
    expect(starts(project)).toEqual([0, 3, 5]);
    expect(contiguous(project)).toBe(true);

    project = studioReducer(project, { type: 'REORDER_TRACK', trackId: 'video-0', fromIndex: 1, toIndex: 2 });
    expect(order(project)).toEqual(['clip-a', 'clip-c', 'clip-b']);
    expect(starts(project)).toEqual([0, 3, 5]);
    expect(contiguous(project)).toBe(true);
    expect(projectContentDuration(project)).toBeCloseTo(total, 5);
    // trims/volumes travel with the clip, only `start` is re-timed
    expect(clipById(project, 'clip-b').trimEnd).toBeCloseTo(2, 5);

    // documented behaviour: moving a clip to the FRONT anchors the re-timed
    // run at that clip's own start (the reducer seeds cursor with clips[0].start)
    const anchored = studioReducer(project, { type: 'REORDER_TRACK', trackId: 'video-0', fromIndex: 2, toIndex: 0 });
    expect(order(anchored)).toEqual(['clip-b', 'clip-a', 'clip-c']);
    expect(starts(anchored)).toEqual([5, 7, 10]);
    expect(contiguous(anchored)).toBe(true);

    // reordering a single-clip track, or onto itself, is a no-op
    expect(
      studioReducer(project, { type: 'REORDER_TRACK', trackId: 'narration-1', fromIndex: 0, toIndex: 0 }),
    ).toBe(project);
    expect(studioReducer(project, { type: 'REORDER_TRACK', trackId: 'video-0', fromIndex: 1, toIndex: 1 })).toBe(
      project,
    );
    expect(studioReducer(project, { type: 'REORDER_TRACK', trackId: 'video-0', fromIndex: 9, toIndex: 0 })).toBe(
      project,
    );
  });

  it('undoes and redoes a five step chain, one step at a time', () => {
    const history = createStudioHistory(baseProject());
    const initial = history.state;

    history.dispatch({ type: 'TRIM_CLIP', clipId: 'clip-a', trimStart: 0, trimEnd: 2.5 });
    history.dispatch({ type: 'SET_CLIP_VOLUME', clipId: 'clip-a', volume: 0.4 });
    history.dispatch({ type: 'SET_CLIP_FADE', clipId: 'clip-a', fadeIn: 1 });
    history.dispatch({ type: 'MOVE_CLIP', clipId: 'clip-b', newStart: 2.5 });
    history.dispatch({ type: 'UPDATE_CAPTION', captionId: 'cap-1', updates: { style: 'yellow' } });

    const finalState = history.state;
    expect(finalState).not.toBe(initial);
    expect(clipById(finalState, 'clip-a').fadeIn).toBeCloseTo(1, 5);
    expect(finalState.captions[0]!.style).toBe('yellow');
    expect(history.canRedo()).toBe(false);

    for (const step of [4, 3, 2, 1, 0]) {
      history.undo();
      expect(history.canRedo()).toBe(true);
      if (step > 0) expect(history.state).not.toBe(initial);
    }
    // fully unwound
    expect(history.state).toBe(initial);
    expect(clipById(history.state, 'clip-a').fadeIn).toBeCloseTo(0.3, 5);
    expect(history.state.captions[0]!.style).toBeUndefined();
    expect(history.canUndo()).toBe(false);
    // ...and undone past the bottom is a no-op
    history.undo();
    expect(history.state).toBe(initial);

    // replay the chain forwards
    for (const step of [1, 2, 3, 4, 5]) {
      history.redo();
      if (step < 5) expect(history.state).not.toBe(finalState);
    }
    expect(history.state).toBe(finalState);
    expect(history.canRedo()).toBe(false);
    // ...and redone past the top is a no-op
    history.redo();
    expect(history.state).toBe(finalState);
  });

  it('a new edit clears the redo stack', () => {
    const history = createStudioHistory(baseProject());
    history.dispatch({ type: 'TRIM_CLIP', clipId: 'clip-a', trimStart: 0, trimEnd: 2 });
    history.undo();
    expect(history.canRedo()).toBe(true);

    history.dispatch({ type: 'SET_CLIP_VOLUME', clipId: 'clip-a', volume: 0.2 });
    expect(history.canRedo()).toBe(false);
    expect(clipById(history.state, 'clip-a').trimEnd).toBeCloseTo(3, 5); // the undone trim stays undone
    expect(clipById(history.state, 'clip-a').volume).toBeCloseTo(0.2, 5);
  });

  it('no-op dispatches never enter the history', () => {
    const initial = baseProject();
    const history = createStudioHistory(initial);
    expect(history.canUndo()).toBe(false);

    history.dispatch({ type: 'TRIM_CLIP', clipId: 'clip-a', trimStart: 0, trimEnd: 3 }); // already 3
    history.dispatch({ type: 'SET_TITLE', title: 'Editor Parity Project' }); // already the title
    history.dispatch({ type: 'UPDATE_CAPTION', captionId: 'cap-1', updates: {} });
    history.dispatch({ type: 'DUPLICATE_CLIP', clipId: 'ghost' });

    expect(history.canUndo()).toBe(false);
    // deep-equal to the initial project: no no-op created new state
    expect(history.state).toEqual(initial);
  });

  it(`caps the undo history at ${HISTORY_LIMIT} steps (HISTORY_LIMIT=${HISTORY_LIMIT})`, () => {
    const history = createStudioHistory(baseProject());
    expect(HISTORY_LIMIT).toBe(50);

    for (let i = 0; i < HISTORY_LIMIT + 10; i++) {
      history.dispatch({
        type: 'ADD_CAPTION',
        caption: { id: `cap-${i}`, text: `line ${i}`, start: 0, end: 1, kind: 'dialogue' },
      });
    }
    expect(history.state.captions).toHaveLength(HISTORY_LIMIT + 11); // +1 from the fixture

    let undos = 0;
    while (history.canUndo()) {
      history.undo();
      undos++;
    }
    expect(undos).toBe(HISTORY_LIMIT); // the oldest 10 steps were dropped
    expect(history.state.captions).toHaveLength(11); // 1 fixture + 10 dropped-but-kept
    // cap-0 was added at dispatch #2, so it is inside the 10 kept states;
    // the newest dispatch (cap-59) is fully undone.
    expect(history.state.captions.some((c) => c.id === 'cap-0')).toBe(true);
    expect(history.state.captions.some((c) => c.id === 'cap-59')).toBe(false);

    history.undo(); // nothing left
    expect(history.state.captions).toHaveLength(11);

    // ...and the newest state is still reachable through redo
    history.redo();
    expect(history.state.captions).toHaveLength(12);
    while (history.canRedo()) history.redo();
    expect(history.state.captions).toHaveLength(HISTORY_LIMIT + 11);
  });

  it('LOAD_PROJECT resets both stacks and sanitizes the payload', () => {
    const history = createStudioHistory(baseProject());
    history.dispatch({ type: 'TRIM_CLIP', clipId: 'clip-a', trimStart: 1.5, trimEnd: 1 }); // clamped by sanitize
    expect(clipById(history.state, 'clip-a').trimEnd).toBeCloseTo(1.6, 5);
    expect(history.canUndo()).toBe(true);

    const loaded = createEmptyProject('33333333-3333-3333-3333-333333333333', 'Loaded');
    loaded.tracks.find((t) => t.kind === 'video')!.clips.push(makeClip({ id: 'x-1' }));
    loaded.duration = 0.1; // below the clip end: sanitize must grow it

    history.dispatch({ type: 'LOAD_PROJECT', project: loaded });

    expect(history.state.id).toBe('33333333-3333-3333-3333-333333333333');
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
    expect(clipById(history.state, 'x-1').trimEnd).toBeCloseTo(3, 5);
    expect(history.state.duration).toBeGreaterThanOrEqual(3);
    expect(MIN_CLIP_LENGTH).toBeCloseTo(0.1, 5);
  });
});

// ---------------------------------------------------------------------------
// 5. Export-snapshot addressability
// ---------------------------------------------------------------------------

describe('export snapshot addressability', () => {
  const ref: MediaRef = { bucket: 'studio-uploads', path: `${OWNER}/${PROJECT}/beat.mp4`, kind: 'video' };

  it('a refs-only project is addressable for every clip', () => {
    const project = baseProject();
    for (const track of project.tracks) {
      for (const clip of track.clips) {
        clip.assetRef = { ...ref, path: `${ref.path}-${clip.id}` };
        clip.assetUrl = `https://stub.supabase.test/storage/v1/object/sign/studio-uploads/${clip.assetRef!.path}?token=x`;
      }
    }

    expect(snapshotAddressabilityProblems(project)).toEqual([]);
    const parsed = validateProjectSnapshot(snapshotOf(project));
    expect(parsed.ok).toBe(true);
  });

  it('a legacy URL-only project (no refs at all) is still addressable', () => {
    const project = baseProject();
    for (const track of project.tracks) {
      for (const clip of track.clips) {
        expect(clip.assetRef).toBeUndefined();
        expect(clip.assetUrl.startsWith('https://')).toBe(true);
      }
    }
    expect(snapshotAddressabilityProblems(project)).toEqual([]);
    expect(validateProjectSnapshot(snapshotOf(project)).ok).toBe(true);
  });

  it('a mixed project (some refs, some legacy URLs) is addressable', () => {
    const project = baseProject();
    const clips = videoClips(project);
    clips[0]!.assetRef = { ...ref, path: `${ref.path}-a` };
    clips[0]!.assetUrl = 'https://stub.supabase.test/storage/v1/object/sign/studio-uploads/x?token=1';
    clips[1]!.assetRef = undefined;
    clips[1]!.assetUrl = 'https://cdn.example.com/legacy.mp4';

    expect(snapshotAddressabilityProblems(project)).toEqual([]);
    const parsed = validateProjectSnapshot(snapshotOf(project));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const validatedClips = parsed.project.tracks.find((t) => t.kind === 'video')!.clips;
    expect(validatedClips[0]!.assetRef).toEqual({ ...ref, path: `${ref.path}-a` });
    expect(validatedClips[1]!.assetRef).toBeUndefined();
    expect(validatedClips[1]!.assetUrl).toBe('https://cdn.example.com/legacy.mp4');
  });

  it('an empty project (no clips at all) is vacuously addressable', () => {
    const project = createEmptyProject('44444444-4444-4444-4444-444444444444', 'Empty');
    expect(snapshotAddressabilityProblems(project)).toEqual([]);
    // ...but the worker refuses to render an empty timeline: fail fast
    const parsed = validateProjectSnapshot(snapshotOf(project));
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toMatch(/timeline is empty/);
  });

  it('reports every placeholder clip (preset beats that were never generated)', () => {
    const project = createEmptyProject(PROJECT, 'Preset');
    project.tracks[0] = {
      ...project.tracks[0]!,
      clips: buildPresetTracks(PROJECT)[0]!.clips,
    };

    const problems = snapshotAddressabilityProblems(project);
    expect(problems).toHaveLength(INTERVIEW_BEATS.length);
    expect(problems.every((p) => p.reason.includes('placeholder'))).toBe(true);
    expect(new Set(problems.map((p) => p.clipId)).size).toBe(INTERVIEW_BEATS.length);
    // the worker DOES accept placeholders (they render a label card) — the
    // addressability rule is the stricter, app-side export contract
    expect(validateProjectSnapshot(snapshotOf(project)).ok).toBe(true);
  });

  it('rejects a non-loopback http URL with no ref, and accepts a loopback one', () => {
    const project = baseProject();
    const clips = videoClips(project);
    clips[0]!.assetRef = undefined;
    clips[0]!.assetUrl = 'http://cdn.example.com/insecure.mp4';
    clips[1]!.assetRef = undefined;
    clips[1]!.assetUrl = 'http://127.0.0.1:9999/local.mp4';

    const problems = snapshotAddressabilityProblems(project);
    expect(problems).toHaveLength(1);
    expect(problems[0]!.clipId).toBe('clip-a');
    expect(problems[0]!.reason).toContain('http:');

    // ...and so does the worker (same rule, different error message)
    const parsed = validateProjectSnapshot(snapshotOf(project));
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toMatch(/invalid assetUrl/);
  });

  it('rejects a malformed ref with no usable URL', () => {
    const project = baseProject();
    const clip = videoClips(project)[0]!;
    clip.assetRef = { bucket: 'studio-uploads', path: 'x/y.mp4', kind: 'folder' } as unknown as MediaRef;
    clip.assetUrl = '';

    const problems = snapshotAddressabilityProblems(project);
    expect(problems).toHaveLength(1);
    expect(problems[0]!.reason).toContain('placeholder');
    // a ref that is not a MediaRef is dropped by both parsers, not stored
    expect(isMediaRef(clip.assetRef)).toBe(false);
    expect(parseProject(snapshotOf(project)).ok).toBe(true);
  });

  it('treats mediaRefKey as the stable identity of a ref', () => {
    const a: MediaRef = { bucket: 'studio-uploads', path: `${OWNER}/a.mp4`, kind: 'video' };
    expect(mediaRefKey(a)).toBe(`studio-uploads:${OWNER}/a.mp4`);
    expect(mediaRefKey({ ...a, path: `${OWNER}/b.mp4` })).not.toBe(mediaRefKey(a));
  });
});

// ---------------------------------------------------------------------------
// 6. Worker parity — the reducer cannot produce a snapshot the worker rejects
// ---------------------------------------------------------------------------

/** A project shaped by reducer actions, carrying every optional field. */
function reducerProducedProject(): StudioProject {
  let project = baseProject();
  project = studioReducer(project, {
    type: 'SET_CLIP_ASSET',
    clipId: 'clip-a',
    assetUrl: `https://stub.supabase.test/storage/v1/object/sign/studio-uploads/${OWNER}/${PROJECT}/clip-a.mp4?token=1`,
    assetKind: 'uploaded',
    assetRef: { bucket: 'studio-uploads', path: `${OWNER}/${PROJECT}/clip-a.mp4`, kind: 'video' },
  });
  project = studioReducer(project, { type: 'DUPLICATE_CLIP', clipId: 'clip-a' });
  project = studioReducer(project, { type: 'SPLIT_CLIP', clipId: 'clip-a', atSeconds: 1 });
  project = studioReducer(project, { type: 'SET_CLIP_FADE', clipId: 'clip-a', fadeIn: 0.4, fadeOut: 0.6 });
  project = studioReducer(project, { type: 'SET_CLIP_VOLUME', clipId: 'clip-a', volume: 0.7 });
  project = studioReducer(project, { type: 'SET_CLIP_BEAT', clipId: 'clip-b', beatId: 'closing_statement' });
  project = studioReducer(project, {
    type: 'UPDATE_CAPTION',
    captionId: 'cap-1',
    updates: { style: 'boxed', speaker: 'host', text: 'Boxed caption parity' },
  });
  project = studioReducer(project, {
    type: 'ADD_CAPTION',
    caption: buildHookCaption(PROJECT, 'Opening hook', '@subwaytakes'),
  });
  project = studioReducer(project, {
    type: 'SET_BRANDING',
    branding: {
      logoRef: { bucket: 'studio-uploads', path: `${OWNER}/${PROJECT}/logo.png`, kind: 'image' },
      logoUrl: `https://stub.supabase.test/storage/v1/object/sign/studio-uploads/${OWNER}/${PROJECT}/logo.png?token=9`,
      watermarkText: '@subwaytakes',
      accentColor: '#F59E0B',
    },
  });
  project = studioReducer(project, { type: 'SET_TITLE', title: 'Reducer Produced' });
  return project;
}

describe('worker parity (validateProjectSnapshot)', () => {
  it('accepts a reducer-produced project with captions, refs and branding intact', () => {
    const project = reducerProducedProject();
    const parsed = validateProjectSnapshot(snapshotOf(project));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const validated = parsed.project;

    // caption style survives the snapshot
    const dialogue = validated.captions.find((c) => c.id === 'cap-1')!;
    expect(dialogue.style).toBe('boxed');
    expect(dialogue.speaker).toBe('host');
    expect(dialogue.text).toBe('Boxed caption parity');
    expect(dialogue.start).toBeCloseTo(project.captions.find((c) => c.id === 'cap-1')!.start, 5);
    expect(dialogue.end).toBeCloseTo(project.captions.find((c) => c.id === 'cap-1')!.end, 5);

    // clip refs / trims / volume / fades / beat links survive
    const clip = validated.tracks
      .flatMap((t) => t.clips)
      .find((c) => c.id === 'clip-a')!;
    const source = videoClips(project).find((c) => c.id === 'clip-a')!;
    expect(clip.assetRef).toEqual(source.assetRef);
    expect(clip.assetUrl).toBe(source.assetUrl);
    expect(clip.trimStart).toBeCloseTo(source.trimStart, 5);
    expect(clip.trimEnd).toBeCloseTo(source.trimEnd, 5);
    expect(clip.volume).toBeCloseTo(source.volume, 5);
    expect(clip.fadeIn).toBeCloseTo(source.fadeIn, 5);
    expect(clip.fadeOut).toBeCloseTo(source.fadeOut, 5);

    // branding logoRef survives
    expect(validated.branding.logoRef).toEqual(project.branding.logoRef);
    expect(validated.branding.logoUrl).toBe(project.branding.logoUrl);
    expect(validated.branding.watermarkText).toBe(project.branding.watermarkText);

    // beat links survive (BEAT_IDS whitelist in both parsers)
    expect(clipById(validated, 'clip-b').beatId).toBe('closing_statement');
    expect(validated.title).toBe('Reducer Produced');
    expect(validated.duration).toBeCloseTo(project.duration, 5);
    expect(validated.width).toBe(1080);
    expect(validated.height).toBe(1920);
  });

  it('every clip the reducer produced keeps a canonical ref or a fetchable URL', () => {
    const project = reducerProducedProject();
    const parsed = validateProjectSnapshot(snapshotOf(project));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    for (const clip of parsed.project.tracks.flatMap((t) => t.clips)) {
      if (clip.assetUrl === '') {
        // placeholder (a duplicate of a placeholder) — the worker's contract
        expect(clip.assetRef).toBeUndefined();
        continue;
      }
      const problem = clipAddressability(clip);
      expect(problem, `${clip.id}: ${problem ?? ''}`).toBeNull();
    }
  });

  it('rejects exactly the payloads the editor must not export', () => {
    // a snapshot from a future schema version
    const future = { ...snapshotOf(baseProject()), version: 2 };
    const parsedFuture = validateProjectSnapshot(future);
    expect(parsedFuture.ok).toBe(false);
    expect(parsedFuture.error).toMatch(/unsupported project version/);

    // a caption with a bogus window
    const badCaption = baseProject();
    badCaption.captions = [{ id: 'c', text: 'x', start: -1, end: -5, kind: 'dialogue' as const }];
    const parsedCaption = validateProjectSnapshot(snapshotOf(badCaption));
    expect(parsedCaption.ok).toBe(true); // clamped, not rejected
    expect(parsedCaption.ok && parsedCaption.project.captions[0]!.start).toBe(0);

    // a non-object payload
    expect(validateProjectSnapshot('not a project').ok).toBe(false);
    expect(validateProjectSnapshot(null).ok).toBe(false);
  });

  it('agrees with the worker about caption styles (whitelist parity)', () => {
    for (const style of ['bold', 'boxed', 'minimal', 'yellow'] as const) {
      const project = baseProject();
      const caption: StudioCaption = { ...project.captions[0]!, style };
      project.captions = [caption];
      const parsed = validateProjectSnapshot(snapshotOf(project));
      expect(parsed.ok).toBe(true);
      expect(parsed.ok && parsed.project.captions[0]!.style).toBe(style);
    }
    // an unknown style is dropped by the worker, not stored
    const project = baseProject();
    project.captions = [{ ...project.captions[0]!, style: 'neon' as unknown as 'bold' }];
    const parsed = validateProjectSnapshot(snapshotOf(project));
    expect(parsed.ok).toBe(true);
    expect(parsed.ok && parsed.project.captions[0]!.style).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 7. parseProject round-trip
// ---------------------------------------------------------------------------

describe('parseProject round-trip', () => {
  it('preserves assetRef, caption style and timeline values through save/load', () => {
    const project = reducerProducedProject();
    const serialized = JSON.stringify(project);

    const parsed = parseProject(JSON.parse(serialized) as unknown);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.project.version).toBe(project.version);
    expect(parsed.project.id).toBe(project.id);
    expect(parsed.project.title).toBe(project.title);
    expect(parsed.project.duration).toBeCloseTo(project.duration, 5);

    // canonical refs survive the JSON round-trip
    const source = videoClips(project).find((c) => c.id === 'clip-a')!;
    const reloaded = videoClips(parsed.project).find((c) => c.id === 'clip-a')!;
    expect(reloaded.assetRef).toEqual(source.assetRef);
    expect(reloaded.assetUrl).toBe(source.assetUrl);
    expect(reloaded.trimStart).toBeCloseTo(source.trimStart, 5);
    expect(reloaded.trimEnd).toBeCloseTo(source.trimEnd, 5);
    expect(reloaded.start).toBeCloseTo(source.start, 5);

    // the caption style survives too (it rides on the caption object)
    const dialogue = parsed.project.captions.find((c) => c.id === 'cap-1')!;
    expect(dialogue.style).toBe('boxed');
    expect(dialogue.text).toBe('Boxed caption parity');

    // branding keeps the logo ref
    expect(parsed.project.branding.logoRef).toEqual(project.branding.logoRef);

    // and the reloaded project is still valid for the worker
    expect(validateProjectSnapshot(snapshotOf(parsed.project)).ok).toBe(true);
  });

  it('re-derives the duration from the clips when the stored one is too small', () => {
    const project = baseProject();
    project.duration = 0.5; // clipped to the last clip end by sanitize/parse
    const parsed = parseProject(snapshotOf(project));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.project.duration).toBeCloseTo(projectContentDuration(parsed.project), 5);
    expect(parsed.project.duration).toBeGreaterThanOrEqual(5);
  });

  it('drops unknown fields instead of throwing on untrusted payloads', () => {
    const raw = {
      ...(snapshotOf(baseProject()) as Record<string, unknown>),
      hacked: 'surprise',
      tracks: [
        {
          ...((snapshotOf(baseProject()) as Record<string, unknown>).tracks as unknown[])[0],
          bogus: true,
          clips: [
            {
              ...(((snapshotOf(baseProject()) as Record<string, unknown>).tracks as { clips: unknown[] }[])[0]!
                .clips[0] as Record<string, unknown>),
              unknownClipField: 1,
              trimStart: -4,
              trimEnd: 99,
              volume: 12,
            },
          ],
        },
      ],
    };
    const parsed = parseProject(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect((parsed.project as unknown as Record<string, unknown>).hacked).toBeUndefined();
    const clip = parsed.project.tracks[0]!.clips[0]!;
    expect(clip.trimStart).toBe(0);
    expect(clip.volume).toBe(1);
    expect(clipLength(clip)).toBeCloseTo(99, 5);
  });

  it('refuses a snapshot from a newer schema version', () => {
    const parsed = parseProject({ ...(snapshotOf(baseProject()) as Record<string, unknown>), version: 99 });
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toMatch(/Unsupported project version/);
  });
});
