import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { StudioProject } from '../studio/types';
import { MediaUrlResolver, type MediaSigner } from '../lib/mediaAccess';
import { describeError } from '../lib/studioProjects';

/**
 * Session-scoped media URLs for a studio project.
 *
 * Projects persist canonical refs (`clip.assetRef`) plus a derived
 * `clip.assetUrl` (a short-lived signed URL, or an external CDN URL). This
 * hook keeps those URLs fresh through the `media-sign` edge function:
 *
 * - on project load (and whenever the project identity changes),
 * - on tab focus / tab becoming visible,
 * - when the editor calls `refresh()` (before render/export).
 *
 * `resolvedUrls` is keyed exactly like `MediaUrlResolver.resolveProject`:
 * `clip.assetUrl || clip.assetRef.path` for every clip that has either, plus
 * `'branding.logo'` when the branding logo has a ref or URL. Components should
 * read URLs from this map and fall back to the raw project value.
 */
export interface UseMediaUrlsResult {
  /** key (current assetUrl, ref path, or 'branding.logo') -> fresh URL. */
  resolvedUrls: Map<string, string>;
  /** True while a resolution/refresh pass is in flight. */
  refreshing: boolean;
  /** Invalidate the cache and re-sign everything (safe to await). */
  refresh: () => Promise<void>;
  /** Message of the last failed pass; null when healthy. */
  lastError: string | null;
  /** The underlying resolver (tests/diagnostics; also used by useStudioProject). */
  resolver: MediaUrlResolver;
}

export interface UseMediaUrlsOptions {
  /** Injected signer (tests). Defaults to the media_sign edge function. */
  signer?: MediaSigner;
  /** Reuse an externally owned resolver instance (useStudioProject does). */
  resolver?: MediaUrlResolver;
}

export function useMediaUrls(
  project: StudioProject,
  options: UseMediaUrlsOptions = {},
): UseMediaUrlsResult {
  const { signer, resolver: providedResolver } = options;

  const resolver = useMemo(
    () => providedResolver ?? new MediaUrlResolver(signer),
    [providedResolver, signer],
  );

  const [resolvedUrls, setResolvedUrls] = useState<Map<string, string>>(() => new Map());
  const [refreshing, setRefreshing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const projectRef = useRef(project);
  projectRef.current = project;

  /** Cache-aware pass: only assets that need a refresh are re-signed. */
  const resolve = useCallback(async () => {
    setRefreshing(true);
    try {
      const urls = await resolver.resolveProject(projectRef.current);
      setResolvedUrls(urls);
      setLastError(null);
    } catch (err) {
      setLastError(describeError(err, 'Could not resolve media URLs'));
    } finally {
      setRefreshing(false);
    }
  }, [resolver]);

  /** Full refresh: drop every cached URL, then re-resolve. */
  const refresh = useCallback(async () => {
    resolver.invalidateAll();
    await resolve();
  }, [resolver, resolve]);

  // On project load / project change: full pass (cache is empty on mount, so
  // this only re-signs what actually changed afterwards).
  useEffect(() => {
    void refresh();
  }, [project, refresh]);

  // On tab focus / tab becoming visible again.
  useEffect(() => {
    const onVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void refresh();
      }
    };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  return { resolvedUrls, refreshing, refresh, lastError, resolver };
}
