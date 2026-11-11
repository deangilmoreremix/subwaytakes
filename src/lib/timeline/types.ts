export const FPS = 30;

export type TrackKind = 'video' | 'caption' | 'audio' | 'effect';

export interface Clip {
  id: string;
  trackId: string;
  kind: TrackKind;
  label: string;
  /** timeline position, in frames */
  start: number;
  /** length on the timeline, in frames */
  duration: number;
  /** video: offset into the source, in frames */
  trimStart: number;
  /** video: full source length in frames (limits trimming) */
  sourceFrames?: number;
  src?: string;
  volume?: number;
  /** caption text */
  text?: string;
  /** caption: id of the video clip it was auto-generated from (lets us regenerate cleanly) */
  sourceClipId?: string;
}

export interface Track { id: string; kind: TrackKind; name: string }

export interface Project {
  fps: number;
  /** project-wide look */
  style?: { captionFont?: 'inter' | 'anton' | 'bangers' };
  tracks: Track[];
  clips: Clip[];
}

export const DEFAULT_PROJECT: Project = {
  fps: FPS,
  tracks: [
    { id: 'v1', kind: 'video', name: 'Video' },
    { id: 'c1', kind: 'caption', name: 'Captions' },
    { id: 'a1', kind: 'audio', name: 'Sound' },
  ],
  clips: [],
};

/** Add any default tracks a saved project predates (keeps old localStorage projects working). */
export function ensureTracks(p: Project): Project {
  const missing = DEFAULT_PROJECT.tracks.filter(d => !p.tracks.some(t => t.id === d.id));
  return missing.length ? { ...p, tracks: [...p.tracks, ...missing] } : p;
}

export const MIN_CLIP = 6; // frames (0.2s)
