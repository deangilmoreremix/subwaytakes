import { describe, expect, it } from 'vitest';

import { MediaUrlResolver, type MediaSignResponse, type MediaSignRequest } from '../../src/lib/mediaAccess';
import {
  beatTimings,
  clipForBeat,
  diffEditorData,
  projectDurationSeconds,
  projectToEditorData,
} from '../../src/lib/studioProjects';
import { createStudioHistory } from '../../src/lib/studioReducer';
import {
  PROJECT_FORMAT_VERSION,
  clipLength,
  createEmptyProject,
  parseProject,
  sanitizeProject,
  type StudioClip,
  type StudioProject,
} from '../../src/studio/types';
import type { MediaRef } from '../../src/studio/mediaRefs';

const USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const PROJECT_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const STORAGE_ORIGIN = 'https://test-project.supabase.co';

const REF: MediaRef = { bucket: 'videos', path: `${USER_ID}/${PROJECT_ID}/scene-opening_hook.mp4`, kind: 'video' };
const STALE_URL = `${STORAGE_ORIGIN}/storage/v1/object/sign/videos/${USER_ID}/${PROJECT_ID}/scene-opening_hook.mp4?token=expired`;

function makeClip(overrides: Partial<StudioClip> = {}): StudioClip {
  return {
    id: 'clip-a',
    assetUrl: STALE_URL,
    assetRef: REF,
    assetKind: 'generated',
    beatId: 'opening_hook',
    shotType: 'host',
    start: 0,
    trimStart: 0,
    trimEnd: 4,
    volume: 1,
    fadeIn: 0,
    fadeOut: 0,
    label: 'Opening hook',
    ...overrides,
  };
}

function projectWithClip(clip: StudioClip): StudioProject {
  const base = createEmptyProject(PROJECT_ID, 'Workflow Project');
  return sanitizeProject({
    ...base,
    duration: 4,
    tracks: base.tracks.map((track) =>
      track.kind === 'video' ? { ...track, clips: [clip] } : track,
    ),
    scenePlan: [
      {
        beatId: 'opening_hook',
        shotType: 'host',
        dialogue: 'We stopped talking and nobody died.',
        speaker: 'host',
        cameraDirection: '',
        prompt: '',
        clipId: clip.id,
      },
    ],
  });
}

/** Stateful signer: every call for the same ref yields a NEW url (token=v1, v2, …). */
function rotatingSigner(): (request: MediaSignRequest) => Promise<MediaSignResponse> {
  const issued = new Map<string, number>();
  return (request) => {
    const next = (issued.get(request.path) ?? 0) + 1;
    issued.set(request.path, next);
    return Promise.resolve({
      signedUrl: `${STORAGE_ORIGIN}/storage/v1/object/sign/${request.bucket}/${request.path}?token=v${next}`,
      expiresAt: Date.now() + 3600_000,
      bucket: request.bucket,
      path: request.path,
    });
  };
}

function videoClips(project: StudioProject): StudioClip[] {
  return project.tracks.find((track) => track.kind === 'video')?.clips ?? [];
}

// ---------------------------------------------------------------------------
// The persistence round trip the browser suite exercises end to end
// ---------------------------------------------------------------------------

describe('workflow — ref-based clip survives serialize → parse → resolve', () => {
  it('the ref and the URL both survive a JSON round trip through parseProject', () => {
    const project = projectWithClip(makeClip());
    const serialized = JSON.parse(JSON.stringify(project));

    expect(serialized.version).toBe(PROJECT_FORMAT_VERSION);
    const parsed = parseProject(serialized);
    expect(parsed.ok).toBe(true);

    const clip = videoClips(parsed.project!)[0];
    expect(clip.assetRef).toEqual(REF);
    expect(clip.assetUrl).toBe(STALE_URL);
    expect(clip.assetKind).toBe('generated');
    expect(clip.beatId).toBe('opening_hook');
  });

  it('resolving the parsed clip re-signs the SAME ref and returns the NEW url', async () => {
    const project = projectWithClip(makeClip());
    const parsed = parseProject(JSON.parse(JSON.stringify(project)));
    const clip = videoClips(parsed.project!)[0];

    const seen: MediaSignRequest[] = [];
    const signer = rotatingSigner();
    const resolver = new MediaUrlResolver((request) => {
      seen.push({ bucket: request.bucket, path: request.path, kind: request.kind });
      return signer(request);
    });

    const first = await resolver.resolveAsset(clip.assetUrl, clip.assetRef);
    expect(first.url).toBe(`${STORAGE_ORIGIN}/storage/v1/object/sign/videos/${REF.path}?token=v1`);
    expect(first.ref).toEqual(REF);
    expect(seen[0]).toEqual({ bucket: 'videos', path: REF.path, kind: 'video' });

    // simulate the URL expiring: drop the cache (a page reload does the same)
    resolver.invalidateAll();
    const second = await resolver.resolveAsset(first.url, clip.assetRef);
    expect(second.url).not.toBe(first.url);
    expect(second.url).toContain('token=v2');
    // identity unchanged — only the derived URL rotated
    expect(second.ref).toEqual(REF);
    expect(seen[1].path).toBe(seen[0].path);
    expect(seen[1].bucket).toBe(seen[0].bucket);
  });

  it('a legacy clip with only a signed URL recovers its ref and gets a fresh URL', async () => {
    const legacy = projectWithClip(makeClip({ assetRef: undefined }));
    const parsed = parseProject(JSON.parse(JSON.stringify(legacy)));
    const clip = videoClips(parsed.project!)[0];
    expect(clip.assetRef).toBeUndefined();

    const resolver = new MediaUrlResolver(rotatingSigner());
    const resolved = await resolver.resolveAsset(clip.assetUrl, clip.assetRef);

    expect(resolved.ref).toEqual(REF);
    expect(resolved.url).toBe(`${STORAGE_ORIGIN}/storage/v1/object/sign/videos/${REF.path}?token=v1`);
    expect(resolved.url).not.toBe(clip.assetUrl);
  });

  it('resolveProject refreshes every clip and the branding logo, keyed by asset', async () => {
    const project = projectWithClip(makeClip({ id: 'clip-a' }));
    const withLogo: StudioProject = {
      ...project,
      branding: { ...project.branding, logoRef: { bucket: 'studio-uploads', path: `${USER_ID}/logo.png`, kind: 'image' } },
    };
    const resolver = new MediaUrlResolver(rotatingSigner());
    const resolved = await resolver.resolveProject(withLogo);

    expect(resolved.get(STALE_URL)).toContain(`sign/videos/${REF.path}?token=v1`);
    expect(resolved.get('branding.logo')).toContain('sign/studio-uploads/');
    expect(resolver.cacheSize).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Reducer workflows (the browser suite drives the same actions through the UI)
// ---------------------------------------------------------------------------

describe('workflow — split, undo, redo keep the media identity', () => {
  it('SPLIT_CLIP hands the ref to both halves and UNDO/REDO restore it exactly', () => {
    const history = createStudioHistory(projectWithClip(makeClip()));

    history.dispatch({ type: 'SPLIT_CLIP', clipId: 'clip-a', atSeconds: 2 });
    const split = videoClips(history.state);
    expect(split).toHaveLength(2);
    expect(split[0].assetRef).toEqual(REF);
    expect(split[1].assetRef).toEqual(REF);
    expect(split[0].assetUrl).toBe(split[1].assetUrl);
    expect(clipLength(split[0]) + clipLength(split[1])).toBeCloseTo(clipLength(makeClip()), 5);

    history.undo();
    const undone = videoClips(history.state);
    expect(undone).toHaveLength(1);
    expect(undone[0].assetRef).toEqual(REF);

    history.redo();
    const redone = videoClips(history.state);
    expect(redone).toHaveLength(2);
    expect(redone[1].assetRef).toEqual(REF);
    expect(redone[1].assetUrl).toBe(STALE_URL);
  });

  it('a split + trim + reorder sequence keeps every clip addressable by its ref', () => {
    const history = createStudioHistory(projectWithClip(makeClip()));
    const trackId = history.state.tracks.find((track) => track.kind === 'video')!.id;
    history.dispatch({
      type: 'ADD_CLIP',
      trackId,
      clip: makeClip({ id: 'clip-b', beatId: 'guest_responds', shotType: 'guest', start: 4, trimEnd: 3 }),
    });
    history.dispatch({ type: 'SPLIT_CLIP', clipId: 'clip-a', atSeconds: 1.5 });
    history.dispatch({ type: 'TRIM_CLIP', clipId: 'clip-a', trimStart: 0.5, trimEnd: 1.5 });
    history.dispatch({ type: 'REORDER_TRACK', trackId, fromIndex: 0, toIndex: 2 });

    const clips = videoClips(history.state);
    expect(clips).toHaveLength(3);
    for (const clip of clips) {
      expect(clip.assetRef).toEqual(REF);
    }
    // the block stays contiguous after the reorder
    for (let i = 1; i < clips.length; i++) {
      expect(clips[i].start).toBeCloseTo(clips[i - 1].start + clipLength(clips[i - 1]), 5);
    }
    expect(clipForBeat(history.state, 'guest_responds')?.assetRef).toEqual(REF);
  });

  it('a ref survives a LOAD_PROJECT round trip (reopen a saved project)', () => {
    const history = createStudioHistory(createEmptyProject('other', 'Empty'));
    const saved = JSON.parse(JSON.stringify(projectWithClip(makeClip())));
    const parsed = parseProject(saved);
    history.dispatch({ type: 'LOAD_PROJECT', project: parsed.project! });

    expect(history.state.id).toBe(PROJECT_ID);
    expect(videoClips(history.state)[0].assetRef).toEqual(REF);
  });
});

// ---------------------------------------------------------------------------
// Export snapshot (pure parts of src/lib/studioProjects.ts)
// ---------------------------------------------------------------------------

describe('workflow — editor mapping + export snapshot', () => {
  it('projectToEditorData maps ref-based clips to timeline rows with exact bounds', () => {
    const project = projectWithClip(makeClip());
    const { rows, items } = projectToEditorData(project, null);

    const videoRow = rows.find((row) => row.id === 'video-0');
    expect(videoRow?.actions).toHaveLength(1);
    expect(videoRow?.actions[0]).toMatchObject({ id: 'clip-a', start: 0, end: 4, effectId: 'video' });
    expect(items.find((item) => item.actionId === 'clip-a')).toEqual({
      actionId: 'clip-a',
      rowId: 'video-0',
      trackId: 'video-0',
      trackKind: 'video',
      item: 'clip',
      start: 0,
      end: 4,
      trimStart: 0,
      trimEnd: 4,
    });
  });

  it('diffEditorData reports exactly the trim/move edits a session produced', () => {
    const project = projectWithClip(makeClip());
    const mapping = projectToEditorData(project, null);
    const trimmed = projectToEditorData(
      sanitizeProject({
        ...project,
        tracks: project.tracks.map((track) =>
          track.kind === 'video'
            ? { ...track, clips: [{ ...track.clips[0], trimStart: 1, trimEnd: 3 }] }
            : track,
        ),
      }),
      null,
    );

    const edits = diffEditorData(mapping, trimmed.rows);
    expect(edits).toHaveLength(1);
    expect(edits[0]).toMatchObject({ actionId: 'clip-a', item: 'clip', start: 0 });
    // end = start + (trimEnd - trimStart) = 0 + (3 - 1) = 2
    expect(edits[0].end).toBeCloseTo(2, 5);

    // an identical changelist produces no edits
    expect(diffEditorData(mapping, projectToEditorData(project, null).rows)).toEqual([]);
  });

  it('beatTimings and projectDurationSeconds account for ref-based clips', () => {
    const project = projectWithClip(makeClip());
    const opening = beatTimings(project).find((beat) => beat.beatId === 'opening_hook');

    expect(opening?.clipId).toBe('clip-a');
    expect(opening?.start).toBe(0);
    expect(opening?.end).toBeCloseTo(4, 5);
    expect(projectDurationSeconds(project)).toBeCloseTo(4, 5);
  });

  it('a project whose only clip lost its ref still exports (URL-only project)', () => {
    const legacy = projectWithClip(makeClip({ assetRef: undefined }));
    const parsed = parseProject(JSON.parse(JSON.stringify(legacy)));

    expect(parsed.ok).toBe(true);
    const clip = videoClips(parsed.project!)[0];
    expect(clip.assetUrl).toBe(STALE_URL);
    expect(projectDurationSeconds(parsed.project!)).toBeCloseTo(4, 5);
  });
});
