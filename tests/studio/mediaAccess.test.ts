import { describe, expect, it, vi } from 'vitest';

import {
  MediaUrlResolver,
  refreshExpiringAssets,
  type MediaSignRequest,
  type MediaSignResponse,
} from '../../src/lib/mediaAccess';
import type { MediaRef } from '../../src/studio/mediaRefs';
import { createEmptyProject, type StudioClip, type StudioProject } from '../../src/studio/types';

const HOST = 'https://test-project.supabase.co';
const USER_ID = '11111111-2222-3333-4444-555555555555';

/** Deterministic signer: records every request, never touches the network. */
function makeSigner(fixedTtlMs = 3_600_000) {
  const requests: MediaSignRequest[] = [];
  let counter = 0;
  const signer = vi.fn(async (request: MediaSignRequest): Promise<MediaSignResponse> => {
    requests.push(request);
    counter += 1;
    return {
      signedUrl: `${HOST}/functions/v1/media-sign/${request.bucket}/${encodeURIComponent(request.path)}?n=${counter}`,
      expiresAt: Date.now() + fixedTtlMs,
      bucket: request.bucket,
      path: request.path,
    };
  });
  return { signer, requests };
}

function makeClip(overrides: Partial<StudioClip> = {}): StudioClip {
  return {
    id: 'clip-1',
    assetUrl: '',
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

function projectWith(clips: StudioClip[]): StudioProject {
  const base = createEmptyProject('project-1');
  return {
    ...base,
    tracks: base.tracks.map((track) =>
      track.kind === 'video' ? { ...track, clips } : track,
    ),
  };
}

const uploadRef: MediaRef = {
  bucket: 'studio-uploads',
  path: `${USER_ID}/project-1/opening_hook-1.mp4`,
  kind: 'video',
};
const logoRef: MediaRef = {
  bucket: 'studio-uploads',
  path: `${USER_ID}/project-1/logo.png`,
  kind: 'image',
};

describe('MediaUrlResolver', () => {
  it('signs a ref through the injected signer and reports its expiry', async () => {
    const { signer, requests } = makeSigner();
    const resolver = new MediaUrlResolver(signer);

    const resolved = await resolver.resolveAsset(undefined, uploadRef, 'video');

    expect(resolved.url).toContain('media-sign/studio-uploads/');
    expect(resolved.expiresAt).toBeGreaterThan(Date.now());
    expect(resolved.ref).toEqual(uploadRef);
    expect(requests).toEqual([{ bucket: 'studio-uploads', path: uploadRef.path, kind: 'video' }]);
  });

  it('caches a healthy URL and refreshes only inside the 5-minute margin', async () => {
    const healthy = makeSigner(3_600_000);
    const healthyResolver = new MediaUrlResolver(healthy.signer);
    await healthyResolver.resolveAsset(undefined, uploadRef, 'video');
    await healthyResolver.resolveAsset(undefined, uploadRef, 'video');
    expect(healthy.signer).toHaveBeenCalledTimes(1);
    expect(healthyResolver.cacheSize).toBe(1);

    const expiring = makeSigner(60_000);
    const expiringResolver = new MediaUrlResolver(expiring.signer);
    await expiringResolver.resolveAsset(undefined, uploadRef, 'video');
    await expiringResolver.resolveAsset(undefined, uploadRef, 'video');
    expect(expiring.signer).toHaveBeenCalledTimes(2);
  });

  it('keeps the last valid URL when a refresh fails', async () => {
    let fail = false;
    const signer = vi.fn(async () => {
      if (fail) throw new Error('media-sign unavailable');
      return {
        signedUrl: `${HOST}/storage/v1/object/sign/studio-uploads/${uploadRef.path}?token=fresh`,
        expiresAt: Date.now() + 60_000,
        bucket: 'studio-uploads',
        path: uploadRef.path,
      };
    });
    const resolver = new MediaUrlResolver(signer);

    const first = await resolver.resolveAsset(undefined, uploadRef, 'video');
    expect(first.url).toContain('token=fresh');

    fail = true;
    // Expiry is inside the refresh margin, so the next call re-signs — and the
    // failed re-sign must fall back to the cached URL instead of throwing.
    const second = await resolver.resolveAsset(undefined, uploadRef, 'video');
    expect(second.url).toBe(first.url);
    expect(resolver.cacheSize).toBe(1);
  });

  it('propagates the error when there is nothing cached to fall back to', async () => {
    const signer = vi.fn(async () => {
      throw new Error('media-sign unavailable');
    });
    const resolver = new MediaUrlResolver(signer);
    await expect(resolver.resolveAsset(undefined, uploadRef, 'video')).rejects.toThrow(
      'media-sign unavailable',
    );
  });

  it('passes external http(s) URLs through untouched (their own identity)', async () => {
    const { signer } = makeSigner();
    const resolver = new MediaUrlResolver(signer);
    const resolved = await resolver.resolveAsset('https://cdn.example.com/clip.mp4', undefined, 'video');
    expect(resolved).toEqual({
      url: 'https://cdn.example.com/clip.mp4',
      expiresAt: undefined,
      ref: null,
    });
    expect(signer).not.toHaveBeenCalled();
  });

  it('returns an empty result for empty beats and nulls for missing media', async () => {
    const { signer } = makeSigner();
    const resolver = new MediaUrlResolver(signer);
    const resolved = await resolver.resolveAsset(undefined, undefined, 'video');
    expect(resolved.url).toBe('');
    expect(resolved.ref).toBeNull();
    expect(signer).not.toHaveBeenCalled();
  });

  it('recovers a ref from a legacy signed URL and re-signs it', async () => {
    const { signer } = makeSigner();
    const resolver = new MediaUrlResolver(signer);
    const legacyUrl = `${HOST}/storage/v1/object/sign/studio-uploads/${uploadRef.path}?token=expired`;

    const resolved = await resolver.resolveAsset(legacyUrl, undefined, 'video');

    expect(resolved.ref).toEqual(uploadRef);
    expect(resolved.url).not.toBe(legacyUrl);
    expect(signer).toHaveBeenCalledWith({
      bucket: 'studio-uploads',
      path: uploadRef.path,
      kind: 'video',
    });
  });

  it('remembers, invalidates and clears cache entries', async () => {
    const { signer } = makeSigner();
    const resolver = new MediaUrlResolver(signer);

    resolver.remember(uploadRef, 'https://cdn.example.com/manual.mp4', Date.now() + 3_600_000);
    const remembered = await resolver.resolveAsset(undefined, uploadRef, 'video');
    expect(remembered.url).toBe('https://cdn.example.com/manual.mp4');
    expect(signer).not.toHaveBeenCalled();

    resolver.invalidate(uploadRef);
    await resolver.resolveAsset(undefined, uploadRef, 'video');
    expect(signer).toHaveBeenCalledTimes(1);

    resolver.remember(uploadRef, 'https://cdn.example.com/manual.mp4', Date.now() + 3_600_000);
    resolver.invalidateAll();
    expect(resolver.cacheSize).toBe(0);
  });
});

describe('MediaUrlResolver.resolveProject', () => {
  it('resolves uploads, refs and the branding logo with stable keys', async () => {
    const { signer } = makeSigner();
    const resolver = new MediaUrlResolver(signer);
    const project = projectWith([
      makeClip({ id: 'clip-upload', assetRef: uploadRef }),
      makeClip({ id: 'clip-cdn', assetUrl: 'https://cdn.example.com/other.mp4' }),
    ]);
    project.branding = { ...project.branding, logoRef, logoUrl: 'https://cdn.example.com/logo.png' };

    const resolved = await resolver.resolveProject(project);

    expect([...resolved.keys()].sort()).toEqual([
      uploadRef.path,
      'branding.logo',
      'https://cdn.example.com/other.mp4',
    ]);
    expect(resolved.get(uploadRef.path)).toContain('media-sign/studio-uploads/');
    expect(resolved.get('https://cdn.example.com/other.mp4')).toBe('https://cdn.example.com/other.mp4');
    expect(resolved.get('branding.logo')).toContain('media-sign/studio-uploads/');
  });

  it('resolves an empty project without any signer call', async () => {
    const { signer } = makeSigner();
    const resolver = new MediaUrlResolver(signer);
    const resolved = await resolver.resolveProject(projectWith([]));
    expect(resolved.size).toBe(0);
    expect(signer).not.toHaveBeenCalled();
  });

  it('ignores clips that fail to resolve (previous URL survives elsewhere)', async () => {
    const signer = vi.fn(async (request: MediaSignRequest): Promise<MediaSignResponse> => {
      if (request.path === uploadRef.path) throw new Error('boom');
      return {
        signedUrl: 'https://cdn.example.com/ok.mp4',
        expiresAt: Date.now() + 3_600_000,
        bucket: request.bucket,
        path: request.path,
      };
    });
    const resolver = new MediaUrlResolver(signer);
    const project = projectWith([makeClip({ id: 'clip-upload', assetRef: uploadRef })]);

    const resolved = await resolver.resolveProject(project);

    expect(resolved.size).toBe(0);
  });

  it('de-duplicates concurrent resolutions of the same ref', async () => {
    const { signer } = makeSigner();
    const resolver = new MediaUrlResolver(signer);
    const [a, b] = await Promise.all([
      resolver.resolveAsset(undefined, uploadRef, 'video'),
      resolver.resolveAsset(undefined, uploadRef, 'video'),
    ]);
    expect(a.url).toBe(b.url);
    expect(signer).toHaveBeenCalledTimes(1);
  });

  it('refreshExpiringAssets re-signs only what the cache cannot serve', async () => {
    const { signer } = makeSigner();
    const resolver = new MediaUrlResolver(signer);
    const project = projectWith([makeClip({ id: 'clip-upload', assetRef: uploadRef })]);

    const first = await refreshExpiringAssets(project, resolver);
    const second = await refreshExpiringAssets(project, resolver);

    expect(first.size).toBe(1);
    expect(second.size).toBe(1);
    expect(signer).toHaveBeenCalledTimes(1);
  });
});

describe('edgeMediaSigner', () => {
  it('targets the media-sign edge function with the caller-supplied payload', async () => {
    vi.resetModules();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          signedUrl: 'https://signed.example.com/clip.mp4',
          expiresAt: 42,
          bucket: 'studio-uploads',
          path: uploadRef.path,
        }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const module = await import('../../src/lib/mediaAccess');
    const response = await module.edgeMediaSigner({
      bucket: 'studio-uploads',
      path: uploadRef.path,
      kind: 'video',
      ttl_seconds: 600,
    });

    expect(response.signedUrl).toBe('https://signed.example.com/clip.mp4');
    expect(response.expiresAt).toBe(42);
    const [url, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://test-project.supabase.co/functions/v1/media-sign');
    expect(options.method).toBe('POST');
    expect(JSON.parse(String(options.body))).toEqual({
      bucket: 'studio-uploads',
      path: uploadRef.path,
      kind: 'video',
      ttl_seconds: 600,
    });
    vi.unstubAllGlobals();
  });
});
