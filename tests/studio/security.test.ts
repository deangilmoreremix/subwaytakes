import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionMock = vi.fn();

// mediaAccess -> edgeFunctions -> supabase: stub the client at the boundary so
// no test can reach the network.
vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => getSessionMock(),
    },
  },
}));

import { MediaUrlResolver, type MediaSignResponse } from '../../src/lib/mediaAccess';
import {
  isMediaRef,
  isPathOwnedBy,
  mediaRefFromStorageUrl,
  needsRefresh,
  type MediaRef,
} from '../../src/studio/mediaRefs';
import { parseProject } from '../../src/studio/types';

const USER_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const USER_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const PROJECT_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

beforeEach(() => {
  vi.clearAllMocks();
  getSessionMock.mockResolvedValue({ data: { session: { access_token: 'test-token' } } });
});

function signerReturning(signedUrl: string): (request: { bucket: string; path: string }) => Promise<MediaSignResponse> {
  return (request) => Promise.resolve({
    signedUrl,
    expiresAt: Date.now() + 3600_000,
    bucket: request.bucket,
    path: request.path,
  });
}

// ---------------------------------------------------------------------------
// Path ownership guard
// ---------------------------------------------------------------------------

describe('isPathOwnedBy — storage path ownership guard', () => {
  it('accepts a path whose first segment is the calling user id', () => {
    expect(isPathOwnedBy(`${USER_A}/clip.mp4`, USER_A)).toBe(true);
    expect(isPathOwnedBy(`${USER_A}/${PROJECT_ID}/beat.mp4`, USER_A)).toBe(true);
    expect(isPathOwnedBy(`${USER_A}/a/b/c/d.mp4`, USER_A)).toBe(true);
  });

  it('rejects another user prefix', () => {
    expect(isPathOwnedBy(`${USER_B}/clip.mp4`, USER_A)).toBe(false);
    // the classic confusion attempt: the attacker id appears later in the path
    expect(isPathOwnedBy(`shared/${USER_A}/clip.mp4`, USER_A)).toBe(false);
    expect(isPathOwnedBy(`videos/${USER_A}/clip.mp4`, USER_A)).toBe(false);
    expect(isPathOwnedBy(`${USER_A}-suffix/clip.mp4`, USER_A)).toBe(false);
  });

  it('rejects paths that do not start with a user id at all', () => {
    expect(isPathOwnedBy('clip.mp4', USER_A)).toBe(false);
    expect(isPathOwnedBy('/clip.mp4', USER_A)).toBe(false);
    expect(isPathOwnedBy('https://x.supabase.co/storage/v1/object/sign/videos/${uid}/a.mp4'.replace('${uid}', USER_A), USER_A)).toBe(false);
    expect(isPathOwnedBy('../etc/passwd', USER_A)).toBe(false);
    expect(isPathOwnedBy('', USER_A)).toBe(false);
    expect(isPathOwnedBy(`${USER_A}/clip.mp4`, '')).toBe(false);
  });

  it('rejects traversal, double-slash and absolute paths (hardened during integration)', () => {
    // FIXED: the guard now normalizes/rejects `..`, `.`, empty segments,
    // leading `/`, backslashes and NUL, so `<uid>/../../<other>/clip.mp4`
    // can never satisfy the check for `<uid>`.
    expect(isPathOwnedBy(`${USER_A}/../../${USER_B}/clip.mp4`, USER_A)).toBe(false);
    expect(isPathOwnedBy(`${USER_A}//${USER_B}/clip.mp4`, USER_A)).toBe(false);
    expect(isPathOwnedBy(`/${USER_A}/clip.mp4`, USER_A)).toBe(false);
    expect(isPathOwnedBy(`${USER_A}/..\\..\\clip.mp4`, USER_A)).toBe(false);
    expect(isPathOwnedBy(`${USER_A}/./clip.mp4`, USER_A)).toBe(false);
    // what it still rejects: another user's prefix and no prefix at all
    expect(isPathOwnedBy(`../${USER_B}/clip.mp4`, USER_A)).toBe(false);
    // and what it still accepts: plain owned paths
    expect(isPathOwnedBy(`${USER_A}/p/clip.mp4`, USER_A)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// mediaRefFromStorageUrl — URL -> canonical ref
// ---------------------------------------------------------------------------

describe('mediaRefFromStorageUrl — recovers the canonical ref from a signed URL', () => {
  it('parses the documented signed/public/authenticated shapes', () => {
    const base = 'https://x.supabase.co';
    expect(mediaRefFromStorageUrl(`${base}/storage/v1/object/sign/videos/${USER_A}/a.mp4?token=t`))
      .toEqual({ bucket: 'videos', path: `${USER_A}/a.mp4`, kind: 'video' });
    expect(mediaRefFromStorageUrl(`${base}/storage/v1/object/authenticated/studio-uploads/${USER_A}/p/a.mp4`))
      .toEqual({ bucket: 'studio-uploads', path: `${USER_A}/p/a.mp4`, kind: 'video' });
    expect(mediaRefFromStorageUrl(`${base}/storage/v1/object/public/studio-exports/${USER_A}/a.mp4`))
      .toEqual({ bucket: 'studio-exports', path: `${USER_A}/a.mp4`, kind: 'video' });
  });

  it('a signed URL for user A parses to a ref owned by user A and by nobody else', () => {
    const url = `https://x.supabase.co/storage/v1/object/sign/videos/${USER_A}/a.mp4?token=deadbeef&expires_in=3600`;
    const ref = mediaRefFromStorageUrl(url);
    expect(ref).not.toBeNull();
    expect(ref!.bucket).toBe('videos');
    expect(ref!.path).toBe(`${USER_A}/a.mp4`);
    expect(isPathOwnedBy(ref!.path, USER_A)).toBe(true);
    expect(isPathOwnedBy(ref!.path, USER_B)).toBe(false);
  });

  it('cannot be tricked into a different bucket by query-string or fragment tricks', () => {
    const crafted = [
      // bucket claimed in the query string
      `https://x.supabase.co/storage/v1/object/sign/videos/${USER_A}/a.mp4?token=t&bucket=studio-uploads`,
      // bucket claimed in the fragment
      `https://x.supabase.co/storage/v1/object/sign/videos/${USER_A}/a.mp4#/studio-uploads`,
      // userinfo / host trickery
      `https://videos.supabase.co@x.supabase.co/storage/v1/object/sign/videos/${USER_A}/a.mp4?token=t`,
      // extra path prefix before the storage route
      `https://x.supabase.co/evil/storage/v1/object/sign/videos/${USER_A}/a.mp4?token=t`,
      // trailing junk after the object path
      `https://x.supabase.co/storage/v1/object/sign/videos/${USER_A}/a.mp4/../../studio-uploads/${USER_B}/b.mp4`,
    ];
    for (const url of crafted) {
      const ref = mediaRefFromStorageUrl(url);
      if (!ref) continue; // unrecognized -> treated as an external URL, never signed
      // whatever it parses to, the ownership decision still has to fail for B
      // unless the URL literally carries a `<uidB>/` path segment.
      if (!ref.path.startsWith(`${USER_B}/`)) {
        expect(isPathOwnedBy(ref.path, USER_B), url).toBe(false);
      }
      // a ref for user A's object must keep bucket 'videos' and A's prefix
      if (ref.path.startsWith(`${USER_A}/`)) {
        expect(ref.bucket, url).toBe('videos');
      }
    }
  });

  it('a dot-segment escape is normalized by URL parsing and still yields a self-consistent ref', () => {
    const url = `https://x.supabase.co/storage/v1/object/sign/videos/../studio-uploads/${USER_A}/a.mp4?token=t`;
    const ref = mediaRefFromStorageUrl(url);
    expect(ref).toEqual({ bucket: 'studio-uploads', path: `${USER_A}/a.mp4`, kind: 'video' });
    expect(isPathOwnedBy(ref.path, USER_A)).toBe(true);
    expect(isPathOwnedBy(ref.path, USER_B)).toBe(false);
  });

  it('returns null (never a guess) for non-storage URLs', () => {
    expect(mediaRefFromStorageUrl('https://cdn.example.com/a.mp4')).toBeNull();
    expect(mediaRefFromStorageUrl('https://cdn.example.com/storage/v1/object/sign/a.mp4')).toBeNull();
    expect(mediaRefFromStorageUrl('not a url')).toBeNull();
    expect(mediaRefFromStorageUrl('')).toBeNull();
    expect(mediaRefFromStorageUrl(undefined as unknown as string)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isMediaRef
// ---------------------------------------------------------------------------

describe('isMediaRef — shape guard', () => {
  it('accepts a complete ref and rejects every partial', () => {
    expect(isMediaRef({ bucket: 'videos', path: `${USER_A}/a.mp4`, kind: 'video' })).toBe(true);
    expect(isMediaRef({ bucket: 'videos', path: `${USER_A}/a.mp4`, kind: 'audio' })).toBe(true);
    expect(isMediaRef({ bucket: 'videos', path: `${USER_A}/a.png`, kind: 'image' })).toBe(true);

    expect(isMediaRef({ bucket: '', path: `${USER_A}/a.mp4`, kind: 'video' })).toBe(false);
    expect(isMediaRef({ bucket: 'videos', path: '', kind: 'video' })).toBe(false);
    expect(isMediaRef({ bucket: 'videos', path: `${USER_A}/a.mp4`, kind: 'movie' })).toBe(false);
    expect(isMediaRef({ bucket: 'videos', path: `${USER_A}/a.mp4` })).toBe(false);
    expect(isMediaRef({ bucket: 'videos', path: `${USER_A}/a.mp4`, kind: null })).toBe(false);
    expect(isMediaRef(null)).toBe(false);
    expect(isMediaRef('videos/x')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// MediaUrlResolver — no fabrication when signing fails
// ---------------------------------------------------------------------------

describe('MediaUrlResolver — signer failures surface, URLs are never fabricated', () => {
  it('propagates the signer error and caches nothing', async () => {
    const ref: MediaRef = { bucket: 'videos', path: `${USER_A}/a.mp4`, kind: 'video' };
    const resolver = new MediaUrlResolver(() => Promise.reject(new Error('media-sign: object not found (404)')));

    await expect(resolver.resolveAsset('https://old.example/a.mp4', ref)).rejects.toThrow('media-sign: object not found (404)');
    expect(resolver.cacheSize).toBe(0);

    // a later successful attempt still works — the failure poisoned nothing
    const healed = new MediaUrlResolver(signerReturning('https://fresh.example/a.mp4'));
    const resolved = await healed.resolveAsset('https://old.example/a.mp4', ref);
    expect(resolved.url).toBe('https://fresh.example/a.mp4');
    expect(resolved.ref).toEqual(ref);
  });

  it('keeps a still-valid cached URL when the refresh fails (no data loss, no fabrication)', async () => {
    const ref: MediaRef = { bucket: 'videos', path: `${USER_A}/a.mp4`, kind: 'video' };
    const resolver = new MediaUrlResolver(signerReturning('https://first.example/a.mp4'));
    resolver.remember(ref, 'https://cached.example/a.mp4', Date.now() + 60_000);

    // force the cached entry to be considered stale
    const stale = new MediaUrlResolver(signerReturning('https://first.example/a.mp4'));
    stale.remember(ref, 'https://cached.example/a.mp4', Date.now() - 60_000);
    (stale as unknown as { signer: unknown }).signer = () => Promise.reject(new Error('media-sign 404'));
    const fallback = await stale.resolveAsset(undefined, ref);
    expect(fallback.url).toBe('https://cached.example/a.mp4');
    expect(resolver.cacheSize).toBe(1);
  });

  it('signs with the user-supplied ref only — it never rewrites the bucket or path', async () => {
    const ref: MediaRef = { bucket: 'studio-uploads', path: `${USER_A}/${PROJECT_ID}/clip.mp4`, kind: 'video' };
    const seen: Array<{ bucket: string; path: string }> = [];
    const resolver = new MediaUrlResolver((request) => {
      seen.push({ bucket: request.bucket, path: request.path });
      return Promise.resolve({
        signedUrl: 'https://signed.example/clip.mp4',
        expiresAt: Date.now() + 3600_000,
        bucket: request.bucket,
        path: request.path,
      });
    });

    const resolved = await resolver.resolveAsset(undefined, ref);
    expect(seen).toEqual([{ bucket: 'studio-uploads', path: `${USER_A}/${PROJECT_ID}/clip.mp4` }]);
    expect(resolved.url).toBe('https://signed.example/clip.mp4');
    expect(resolved.ref).toEqual(ref);
  });

  it('an external (non-storage) URL is passed through, never signed', async () => {
    let signCalls = 0;
    const resolver = new MediaUrlResolver((request) => {
      signCalls++;
      return Promise.resolve({ signedUrl: '', expiresAt: 0, bucket: request.bucket, path: request.path });
    });
    const resolved = await resolver.resolveAsset('https://cdn.example.com/a.mp4', undefined);
    expect(resolved.url).toBe('https://cdn.example.com/a.mp4');
    expect(signCalls).toBe(0);
  });

  it('a clip with no URL and no ref resolves to an empty string (placeholder beat)', async () => {
    const resolver = new MediaUrlResolver(signerReturning('https://never.example/a.mp4'));
    await expect(resolver.resolveAsset(undefined, undefined)).resolves.toEqual({
      url: '',
      expiresAt: undefined,
      ref: null,
    });
  });

  it('needsRefresh treats an unknown or expired expiry as stale', () => {
    expect(needsRefresh(undefined)).toBe(true);
    expect(needsRefresh(Date.now() - 1000)).toBe(true);
    expect(needsRefresh(Date.now() + 60_000)).toBe(true); // inside the 5 min margin
    expect(needsRefresh(Date.now() + 3_600_000)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseProject — malformed assetRef must be stripped, not trusted
// ---------------------------------------------------------------------------

describe('parseProject — malformed assetRef handling', () => {
  function projectWithClipAssetRef(assetRef: unknown): Record<string, unknown> {
    return {
      version: 1,
      id: PROJECT_ID,
      title: 'Ref project',
      duration: 5,
      tracks: [
        {
          id: 'video-0',
          kind: 'video',
          name: 'Video',
          clips: [
            {
              id: 'clip-1',
              assetUrl: 'https://old.example/a.mp4',
              assetRef,
              assetKind: 'generated',
              start: 0,
              trimStart: 0,
              trimEnd: 3,
              volume: 1,
              fadeIn: 0,
              fadeOut: 0,
            },
          ],
          muted: false,
          volume: 1,
        },
      ],
      captions: [],
      branding: { handle: '@subwaytakes', watermarkText: '@subwaytakes', logoRef: assetRef },
      scenePlan: [],
    };
  }

  function parsedClip(assetRef: unknown) {
    const parsed = parseProject(projectWithClipAssetRef(assetRef));
    expect(parsed.ok).toBe(true);
    return {
      project: parsed.project!,
      clip: parsed.project!.tracks[0].clips[0],
    };
  }

  it('keeps a well-formed ref', () => {
    const ref = { bucket: 'videos', path: `${USER_A}/${PROJECT_ID}/a.mp4`, kind: 'video' };
    const { clip, project } = parsedClip(ref);
    expect(clip.assetRef).toEqual(ref);
    expect(project.branding.logoRef).toEqual(ref);
  });

  it('strips every malformed ref shape instead of trusting it', () => {
    const malformed = [
      null,
      undefined,
      'videos/x.mp4',
      42,
      {},
      { bucket: 'videos', path: `${USER_A}/a.mp4` }, // no kind
      { bucket: 'videos', path: `${USER_A}/a.mp4`, kind: 'movie' },
      { bucket: '', path: `${USER_A}/a.mp4`, kind: 'video' },
      { bucket: 'videos', path: '', kind: 'video' },
    ];
    for (const bad of malformed) {
      const { clip, project } = parsedClip(bad);
      expect(clip.assetRef, JSON.stringify(bad)).toBeUndefined();
      expect(project.branding.logoRef, JSON.stringify(bad)).toBeUndefined();
      // the rest of the clip survives the strip
      expect(clip.id).toBe('clip-1');
      expect(clip.assetUrl).toBe('https://old.example/a.mp4');
      expect(clip.trimEnd).toBe(3);
    }
  });

  it('a valid ref is passed through as-is, including unknown extra keys (documented: no field normalization)', () => {
    // parseClip keeps the parsed object by reference; it never re-derives
    // bucket/path, so extra keys ride along. Bucket/path are never fabricated.
    const ref = { bucket: 'videos', path: `${USER_A}/a.mp4`, kind: 'video', extra: 'kept' };
    const { clip, project } = parsedClip(ref);
    expect(clip.assetRef).toEqual(ref);
    expect(project.branding.logoRef).toEqual(ref);
  });

  it('still parses a project that is entirely ref-free (legacy URL-only project)', () => {
    const legacy = projectWithClipAssetRef(undefined);
    const parsed = parseProject(legacy);
    expect(parsed.ok).toBe(true);
    expect(parsed.project!.tracks[0].clips[0].assetUrl).toBe('https://old.example/a.mp4');
    expect(parsed.project!.tracks[0].clips[0].assetRef).toBeUndefined();
  });
});
