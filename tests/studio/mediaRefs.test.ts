import { describe, expect, it } from 'vitest';

import {
  SIGNED_URL_REFRESH_MARGIN_SECONDS,
  SIGNED_URL_TTL_SECONDS,
  isMediaRef,
  isPathOwnedBy,
  mediaRefFromStorageUrl,
  mediaRefKey,
  needsRefresh,
  type MediaRef,
} from '../../src/studio/mediaRefs';
import { createEmptyProject, parseProject, type StudioClip, type StudioProject } from '../../src/studio/types';

const SUPABASE_HOST = 'https://test-project.supabase.co';
const USER_ID = '11111111-2222-3333-4444-555555555555';

function makeClip(overrides: Partial<StudioClip> = {}): StudioClip {
  return {
    id: 'clip-1',
    assetUrl: 'https://cdn.example.com/clip-1.mp4',
    assetKind: 'uploaded',
    start: 0,
    trimStart: 0,
    trimEnd: 5,
    volume: 1,
    fadeIn: 0,
    fadeOut: 0,
    ...overrides,
  };
}

function projectWithVideoClip(clip: StudioClip): StudioProject {
  const base = createEmptyProject('project-1');
  return {
    ...base,
    tracks: base.tracks.map((track) =>
      track.kind === 'video' ? { ...track, clips: [clip] } : track,
    ),
  };
}

describe('MediaRef round-trip', () => {
  const ref: MediaRef = {
    bucket: 'studio-uploads',
    path: `${USER_ID}/project-1/opening_hook-clip.mp4`,
    kind: 'video',
  };

  it('is valid and survives JSON serialization', () => {
    expect(isMediaRef(ref)).toBe(true);
    const roundTripped = JSON.parse(JSON.stringify(ref)) as unknown;
    expect(isMediaRef(roundTripped)).toBe(true);
    expect(roundTripped).toEqual(ref);
  });

  it('produces a stable cache key and keeps refs distinct per bucket', () => {
    expect(mediaRefKey(ref)).toBe(`studio-uploads:${ref.path}`);
    expect(mediaRefKey({ ...ref, bucket: 'videos' })).not.toBe(mediaRefKey(ref));
  });

  it('rejects malformed refs (missing bucket/path or bad kind)', () => {
    expect(isMediaRef(null)).toBe(false);
    expect(isMediaRef({ bucket: 'videos', path: 'a/b.mp4', kind: 'stream' })).toBe(false);
    expect(isMediaRef({ bucket: '', path: 'a/b.mp4', kind: 'video' })).toBe(false);
    expect(isMediaRef({ bucket: 'videos', path: '', kind: 'video' })).toBe(false);
    expect(isMediaRef('videos/a/b.mp4')).toBe(false);
  });

  it('keeps the derived-URL constants short-lived', () => {
    expect(SIGNED_URL_TTL_SECONDS).toBe(3600);
    expect(SIGNED_URL_REFRESH_MARGIN_SECONDS).toBe(300);
  });

  it('matches ownership on the first path segment only', () => {
    expect(isPathOwnedBy(`${USER_ID}/p/clip.mp4`, USER_ID)).toBe(true);
    expect(isPathOwnedBy(`somebody-else/p/clip.mp4`, USER_ID)).toBe(false);
    expect(isPathOwnedBy(`studio-scenes/${USER_ID}/p/clip.mp4`, USER_ID)).toBe(false);
    expect(isPathOwnedBy('', USER_ID)).toBe(false);
  });

  it('flags URLs as needing refresh inside the margin window', () => {
    const now = 1_700_000_000_000;
    expect(needsRefresh(undefined, now)).toBe(true);
    expect(needsRefresh(now + 60_000, now)).toBe(true);
    expect(needsRefresh(now + SIGNED_URL_REFRESH_MARGIN_SECONDS * 1000 + 1, now)).toBe(false);
  });
});

describe('mediaRefFromStorageUrl', () => {
  it('recovers a ref from a signed URL (token query stripped)', () => {
    const ref = mediaRefFromStorageUrl(
      `${SUPABASE_HOST}/storage/v1/object/sign/videos/studio-scenes/${USER_ID}/p-1/scene-x.mp4?token=abc123`,
    );
    expect(ref).toEqual({
      bucket: 'videos',
      path: `studio-scenes/${USER_ID}/p-1/scene-x.mp4`,
      kind: 'video',
    });
  });

  it('recovers a ref from an authenticated URL', () => {
    const ref = mediaRefFromStorageUrl(
      `${SUPABASE_HOST}/storage/v1/object/authenticated/studio-uploads/${USER_ID}/p-1/clip.mp4?token=xyz`,
    );
    expect(ref).toEqual({ bucket: 'studio-uploads', path: `${USER_ID}/p-1/clip.mp4`, kind: 'video' });
  });

  it('recovers a ref from a public URL and honours the requested kind', () => {
    const ref = mediaRefFromStorageUrl(
      `${SUPABASE_HOST}/storage/v1/object/public/studio-exports/${USER_ID}/p-1/logo.png`,
      'image',
    );
    expect(ref).toEqual({ bucket: 'studio-exports', path: `${USER_ID}/p-1/logo.png`, kind: 'image' });
  });

  it('decodes percent-encoded paths without breaking folder segments', () => {
    const ref = mediaRefFromStorageUrl(
      `${SUPABASE_HOST}/storage/v1/object/sign/studio-uploads/${USER_ID}/p-1/my%20clip%20(v2).mp4?token=t`,
    );
    expect(ref?.path).toBe(`${USER_ID}/p-1/my clip (v2).mp4`);
  });

  it('returns null for external URLs and junk', () => {
    expect(mediaRefFromStorageUrl('https://cdn.example.com/clip.mp4')).toBeNull();
    expect(mediaRefFromStorageUrl('not a url')).toBeNull();
    expect(mediaRefFromStorageUrl('')).toBeNull();
    expect(mediaRefFromStorageUrl(`${SUPABASE_HOST}/storage/v1/object/sign/videos`)).toBeNull();
  });
});

describe('legacy URL-only projects recover refs', () => {
  it('parseProject keeps a ref that is stored, and a recovered URL becomes one', () => {
    const ref: MediaRef = { bucket: 'studio-uploads', path: `${USER_ID}/p-1/clip.mp4`, kind: 'video' };
    const withRef = parseProject(projectWithVideoClip(makeClip({ assetRef: ref })));
    expect(withRef.project?.tracks[0].clips[0].assetRef).toEqual(ref);

    // Legacy: only the (expiring) signed URL was persisted.
    const legacyUrl = `${SUPABASE_HOST}/storage/v1/object/sign/studio-uploads/${USER_ID}/p-1/clip.mp4?token=old`;
    const legacy = parseProject(projectWithVideoClip(makeClip({ assetUrl: legacyUrl })));
    const clip = legacy.project?.tracks[0].clips[0];
    expect(clip?.assetRef).toBeUndefined();
    expect(mediaRefFromStorageUrl(legacyUrl, 'video')).toEqual(ref);
  });

  it('external CDN URLs stay their own identity (no ref invented)', () => {
    const parsed = parseProject(
      projectWithVideoClip(makeClip({ assetUrl: 'https://cdn.example.com/clip.mp4' })),
    );
    const clip = parsed.project?.tracks[0].clips[0];
    expect(clip?.assetUrl).toBe('https://cdn.example.com/clip.mp4');
    expect(mediaRefFromStorageUrl(clip?.assetUrl ?? '', 'video')).toBeNull();
  });
});
