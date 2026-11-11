export const FPS = 30;

export type TrackKind = 'video' | 'caption';

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
  ],
  clips: [],
};

export const MIN_CLIP = 6; // frames (0.2s)
