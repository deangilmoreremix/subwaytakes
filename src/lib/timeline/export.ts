import { canRenderMediaOnWeb, renderMediaOnWeb, type RenderMediaOnWebProgress } from '@remotion/web-renderer';
import { EpisodeComposition } from '../../components/studio/EpisodeComposition';
import { COMP_SIZE } from '../../components/studio/compSize';
import { projectDuration } from './ops';
import type { Project } from './types';
import type { Aspect } from '../muapi/registry';

export type ExportResolution = '720p' | '1080p';
export type ExportContainer = 'mp4' | 'webm';

/** Pure: Remotion composition config for the current project. `scale` maps 1080-wide masters to the chosen resolution. */
export function compositionFor(project: Project, aspect: Aspect, resolution: ExportResolution = '1080p') {
  const [width, height] = COMP_SIZE[aspect];
  const durationInFrames = Math.max(1, projectDuration(project));
  const shortSide = Math.min(width, height);
  const scale = resolution === '720p' ? 720 / shortSide : 1;
  return { width, height, durationInFrames, fps: project.fps, scale };
}

export async function checkExportSupport(project: Project, aspect: Aspect, container: ExportContainer, resolution: ExportResolution) {
  const c = compositionFor(project, aspect, resolution);
  return canRenderMediaOnWeb({ container, width: c.width, height: c.height, scale: c.scale });
}

export interface ExportOptions {
  aspect: Aspect; container: ExportContainer; resolution: ExportResolution;
  onProgress?: (p: RenderMediaOnWebProgress) => void; signal?: AbortSignal;
}

export async function exportEpisode(project: Project, o: ExportOptions): Promise<Blob> {
  if (projectDuration(project) <= 0) throw new Error('Nothing to export: the timeline is empty.');
  const c = compositionFor(project, o.aspect, o.resolution);
  const { getBlob } = await renderMediaOnWeb({
    composition: { id: 'episode', component: EpisodeComposition, durationInFrames: c.durationInFrames, fps: c.fps, width: c.width, height: c.height, defaultProps: { project } },
    inputProps: { project },
    container: o.container,
    scale: c.scale,
    onProgress: o.onProgress ?? undefined,
    signal: o.signal,
    // Remotion licensing: set VITE_REMOTION_LICENSE_KEY ("free-license" only if you qualify for the Free License, see remotion.dev/license).
    licenseKey: (import.meta.env.VITE_REMOTION_LICENSE_KEY as string | undefined) || undefined,
  });
  return getBlob();
}
