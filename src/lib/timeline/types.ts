import type { BrandSnapshot } from '../brand/model';
import type { CaptionStyle, CaptionWord } from '../captions/model';
import type { TitleData } from '../shows';
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
  /** caption: word timings in frames, relative to the start of this clip. Absent on older captions (text is spread evenly). */
  words?: CaptionWord[];
  /** caption: id of the video clip it was auto-generated from (lets us regenerate cleanly) */
  sourceClipId?: string;
  /**
   * video: transition from the previous clip on the track. The two clips overlap by exactly `frames`
   * (this clip starts `frames` before the previous one ends). Kept consistent by ops.normalizeTransitions.
   */
  transitionIn?: { type: TransitionType; frames: number };
  /** effect clips: which overlay and its parameters */
  effect?: { type: 'light-leak'; seed: number; hueShift: number };
}

export type TransitionType = 'fade' | 'slide' | 'wipe' | 'iris' | 'clock-wipe' | 'push-cut';

export interface Track { id: string; kind: TrackKind; name: string }

export interface Project {
  fps: number;
  /** project-wide look */
  style?: { /** how captions look and move (preset, motion engine, font, colours, position) */ captions?: CaptionStyle; /** label exports as AI-generated (default on) */ aiLabel?: boolean; /** the customer's brand (logo, colours, handle, sponsor); copied from their brand kit */ brand?: BrandSnapshot; captionFont?: 'inter' | 'anton' | 'bangers'; /** on-screen title; also accepts the older { take, guest, badge } shape (see resolveTitle) */ title?: { data?: TitleData; take?: string; guest?: string; badge?: boolean; showBadge?: boolean; series?: { name: string; episode: number } } };
  tracks: Track[];
  clips: Clip[];
}

export const DEFAULT_PROJECT: Project = {
  fps: FPS,
  tracks: [
    { id: 'v1', kind: 'video', name: 'Video' },
    { id: 'c1', kind: 'caption', name: 'Captions' },
    { id: 'a1', kind: 'audio', name: 'Sound' },
    { id: 'e1', kind: 'effect', name: 'Effects' },
  ],
  clips: [],
};

/** Add any default tracks a saved project predates (keeps old localStorage projects working). */
export function ensureTracks(p: Project): Project {
  const missing = DEFAULT_PROJECT.tracks.filter(d => !p.tracks.some(t => t.id === d.id));
  return missing.length ? { ...p, tracks: [...p.tracks, ...missing] } : p;
}

export const MIN_CLIP = 6; // frames (0.2s)
