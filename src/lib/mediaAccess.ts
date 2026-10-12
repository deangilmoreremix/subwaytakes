/**
 * Session-scoped media URL resolution.
 *
 * Projects store canonical refs (`clip.assetRef`) plus a derived
 * `clip.assetUrl` (a short-lived signed URL). This module derives and refreshes
 * those URLs through the `media-sign` edge function (which verifies ownership
 * server-side before signing), caches them with their expiry, and transparently
 * recovers legacy projects that only have an old signed URL persisted.
 *
 * Nothing here persists a URL: callers persist refs; URLs live only in memory
 * for the session (and in the transient `assetUrl` field while a project is
 * open in the editor).
 */

import { callEdgeFunction } from '../lib/edgeFunctions';
import type { MediaRef, MediaKind } from '../studio/mediaRefs';
import {
  mediaRefKey,
  mediaRefFromStorageUrl,
  needsRefresh,
} from '../studio/mediaRefs';

export interface MediaSignRequest {
  bucket: string;
  path: string;
  kind?: MediaKind;
  /** Requested lifetime in seconds; server clamps to the configured max. */
  ttl_seconds?: number;
}

export interface MediaSignResponse {
  signedUrl: string;
  expiresAt: number; // epoch ms
  bucket: string;
  path: string;
}

export interface ResolvedMedia {
  url: string;
  expiresAt: number | undefined;
  /** null when the asset has no URL yet (empty beat placeholder). */
  ref: MediaRef | null;
}

interface CacheEntry {
  url: string;
  expiresAt: number | undefined;
}

export type MediaSigner = (request: MediaSignRequest) => Promise<MediaSignResponse>;

/** Default signer: the media-sign edge function (service role + ownership check). */
export const edgeMediaSigner: MediaSigner = (request) =>
  callEdgeFunction<MediaSignResponse>('media-sign', request);

export class MediaUrlResolver {
  private cache = new Map<string, CacheEntry>();
  private inflight = new Map<string, Promise<ResolvedMedia>>();

  constructor(private signer: MediaSigner = edgeMediaSigner) {}

  /** Register an externally-created URL (e.g. a fresh upload's public URL). */
  remember(ref: MediaRef, url: string, expiresAt?: number): void {
    this.cache.set(mediaRefKey(ref), { url, expiresAt });
  }

  /** Drop a cached URL so the next resolve re-signs. */
  invalidate(ref: MediaRef): void {
    this.cache.delete(mediaRefKey(ref));
  }

  invalidateAll(): void {
    this.cache.clear();
  }

  /**
   * Resolve one asset to a usable URL.
   * - `assetRef` present → sign (cached until near expiry).
   * - no ref but an http(s) `assetUrl` → pass through (external CDN or a legacy
   *   signed URL); if it is one of OUR storage URLs we recover the ref and
   *   refresh it, so old projects heal automatically.
   * - neither → null (empty beat).
   */
  async resolveAsset(
    assetUrl: string | undefined,
    assetRef: MediaRef | undefined,
    kind: MediaKind = 'video',
  ): Promise<ResolvedMedia> {
    let ref = assetRef ?? null;
    let externalUrl: string | undefined;

    if (!ref && assetUrl && /^https?:\/\//i.test(assetUrl)) {
      const recovered = mediaRefFromStorageUrl(assetUrl, kind);
      if (recovered) {
        ref = recovered;
      } else {
        externalUrl = assetUrl;
      }
    }

    if (!ref) {
      return { url: externalUrl ?? '', expiresAt: undefined, ref: null };
    }

    const key = mediaRefKey(ref);
    const cached = this.cache.get(key);
    if (cached && !needsRefresh(cached.expiresAt)) {
      return { url: cached.url, expiresAt: cached.expiresAt, ref };
    }
    const pending = this.inflight.get(key);
    if (pending) return pending;

    const task = (async () => {
      try {
        const signed = await this.signer({
          bucket: ref!.bucket,
          path: ref!.path,
          kind: ref!.kind,
        });
        const entry: CacheEntry = { url: signed.signedUrl, expiresAt: signed.expiresAt };
        this.cache.set(key, entry);
        return { url: entry.url, expiresAt: entry.expiresAt, ref };
      } catch (error) {
        // A failed refresh must not destroy a still-valid cached URL.
        if (cached) return { url: cached.url, expiresAt: cached.expiresAt, ref };
        throw error;
      } finally {
        this.inflight.delete(key);
      }
    })();
    this.inflight.set(key, task);
    return task;
  }

  /** Resolve every clip/branding asset of a project to fresh session URLs. */
  async resolveProject(project: {
    tracks: Array<{ clips: Array<{ assetUrl: string; assetRef?: MediaRef; portrait?: boolean }> }>;
    branding: { logoUrl?: string; logoRef?: MediaRef };
  }): Promise<Map<string, string>> {
    const resolved = new Map<string, string>();
    const jobs: Promise<void>[] = [];

    for (const track of project.tracks) {
      for (const clip of track.clips) {
        if (!clip.assetUrl && !clip.assetRef) continue;
        jobs.push(
          this.resolveAsset(clip.assetUrl, clip.assetRef, 'video')
            .then((r) => {
              if (r.url) resolved.set(clip.assetUrl || clip.assetRef!.path, r.url);
            })
            .catch(() => {
              /* keep previous URL; surfaced by the UI refresh state */
            }),
        );
      }
    }

    const logo = project.branding;
    if (logo.logoRef || logo.logoUrl) {
      jobs.push(
        this.resolveAsset(logo.logoUrl, logo.logoRef, 'image')
          .then((r) => {
            if (r.url) resolved.set('branding.logo', r.url);
          })
          .catch(() => undefined),
      );
    }

    await Promise.all(jobs);
    return resolved;
  }

  /** Number of cached entries (tests/diagnostics). */
  get cacheSize(): number {
    return this.cache.size;
  }
}

/**
 * Convenience: refresh any asset that is close to expiry.
 * Returns the URLs that were re-signed (keyed by original assetUrl/path).
 */
export async function refreshExpiringAssets(
  project: Parameters<MediaUrlResolver['resolveProject']>[0],
  resolver: MediaUrlResolver,
): Promise<Map<string, string>> {
  return resolver.resolveProject(project);
}
