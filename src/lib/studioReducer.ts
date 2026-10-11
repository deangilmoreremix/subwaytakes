/**
 * SubwayTakes Studio — pure project reducer with undo/redo.
 *
 * Every mutation is a pure `(project, action) => project` transition that ends
 * in `sanitizeProject()` (clamps trims/starts, keeps `start` values coherent
 * and grows `duration`). `createStudioHistory()` wraps the reducer with a
 * bounded undo/redo stack (50 steps) that is intentionally framework-free so it
 * can be driven by `useSyncExternalStore`.
 */

import type {
  StudioBranding,
  StudioCaption,
  StudioClip,
  StudioProject,
  StudioTrack,
} from '../studio/types';
import { clipLength, sanitizeProject } from '../studio/types';

export const MIN_CLIP_LENGTH = 0.1;
export const HISTORY_LIMIT = 50;

/** Grid used when moving / splitting clips, and the tolerance around it. */
export const SNAP_GRID_SECONDS = 0.25;
export const SNAP_TOLERANCE_SECONDS = 0.15;

/**
 * Snap a timeline position to the 0.25s grid when it is within 0.15s of it.
 * The tolerance is larger than half the grid, so drags and splits quantize to
 * the grid (intended: beats stay aligned between tracks).
 */
export function snapSeconds(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const grid = Math.round(value / SNAP_GRID_SECONDS) * SNAP_GRID_SECONDS;
  const snapped = Math.round(grid * 1000) / 1000;
  return Math.abs(snapped - value) <= SNAP_TOLERANCE_SECONDS ? snapped : value;
}

export type StudioAction =
  | { type: 'ADD_CLIP'; trackId: string; clip: StudioClip }
  | { type: 'REMOVE_CLIP'; clipId: string }
  | { type: 'TRIM_CLIP'; clipId: string; trimStart: number; trimEnd: number }
  | { type: 'MOVE_CLIP'; clipId: string; newStart: number }
  | { type: 'SPLIT_CLIP'; clipId: string; atSeconds: number }
  | { type: 'REORDER_TRACK'; trackId: string; fromIndex: number; toIndex: number }
  | { type: 'SET_CLIP_VOLUME'; clipId: string; volume: number }
  | { type: 'SET_TRACK_VOLUME'; trackId: string; volume: number }
  | { type: 'TOGGLE_TRACK_MUTE'; trackId: string }
  | { type: 'SET_CLIP_FADE'; clipId: string; fadeIn?: number; fadeOut?: number }
  | {
      type: 'SET_CLIP_ASSET';
      clipId: string;
      assetUrl: string;
      assetKind: StudioClip['assetKind'];
    }
  | { type: 'ADD_CAPTION'; caption: StudioCaption }
  | { type: 'UPDATE_CAPTION'; captionId: string; updates: Partial<StudioCaption> }
  | { type: 'REMOVE_CAPTION'; captionId: string }
  | { type: 'SET_BRANDING'; branding: Partial<StudioBranding> }
  | { type: 'SET_TITLE'; title: string }
  | { type: 'SET_DURATION'; duration: number }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'LOAD_PROJECT'; project: StudioProject };

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0, value));
}

interface LocatedClip {
  track: StudioTrack;
  clip: StudioClip;
}

function findClip(project: StudioProject, clipId: string): LocatedClip | null {
  for (const track of project.tracks) {
    const clip = track.clips.find((c) => c.id === clipId);
    if (clip) return { track, clip };
  }
  return null;
}

function mapClip(
  project: StudioProject,
  clipId: string,
  fn: (clip: StudioClip, track: StudioTrack) => StudioClip,
): StudioProject {
  let changed = false;
  const tracks = project.tracks.map((track) => {
    if (!track.clips.some((c) => c.id === clipId)) return track;
    const clips = track.clips.map((clip) => {
      if (clip.id !== clipId) return clip;
      const next = fn(clip, track);
      if (next !== clip) changed = true;
      return next;
    });
    return clips === track.clips ? track : { ...track, clips };
  });
  return changed ? sanitizeProject({ ...project, tracks }) : project;
}

export function studioReducer(project: StudioProject, action: StudioAction): StudioProject {
  switch (action.type) {
    case 'LOAD_PROJECT':
      return sanitizeProject(action.project);

    case 'SET_TITLE': {
      const title = action.title.trim() || 'Untitled Subway Interview';
      if (project.title === title) return project;
      return sanitizeProject({ ...project, title });
    }

    case 'SET_DURATION': {
      const duration = Math.max(0, action.duration);
      if (!Number.isFinite(duration) || project.duration === duration) return project;
      return sanitizeProject({ ...project, duration });
    }

    case 'ADD_CLIP': {
      const clip = sanitizeClip(action.clip);
      return sanitizeProject({
        ...project,
        tracks: project.tracks.map((track) =>
          track.id === action.trackId ? { ...track, clips: [...track.clips, clip] } : track,
        ),
      });
    }

    case 'REMOVE_CLIP': {
      let changed = false;
      const tracks = project.tracks.map((track) => {
        if (!track.clips.some((clip) => clip.id === action.clipId)) return track;
        changed = true;
        return { ...track, clips: track.clips.filter((clip) => clip.id !== action.clipId) };
      });
      if (!changed) return project;
      const scenePlan = project.scenePlan.map((entry) =>
        entry.clipId === action.clipId ? { ...entry, clipId: undefined } : entry,
      );
      return sanitizeProject({ ...project, tracks, scenePlan });
    }

    case 'TRIM_CLIP': {
      const trimStart = Math.max(0, action.trimStart);
      const trimEnd = Math.max(trimStart + MIN_CLIP_LENGTH, action.trimEnd);
      return mapClip(project, action.clipId, (clip) =>
        Math.abs(clip.trimStart - trimStart) < 1e-6 && Math.abs(clip.trimEnd - trimEnd) < 1e-6
          ? clip
          : { ...clip, trimStart, trimEnd },
      );
    }

    case 'MOVE_CLIP': {
      const start = Math.max(0, snapSeconds(action.newStart));
      return mapClip(project, action.clipId, (clip) =>
        Math.abs(clip.start - start) < 1e-6 ? clip : { ...clip, start },
      );
    }

    case 'SPLIT_CLIP': {
      const located = findClip(project, action.clipId);
      if (!located) return project;
      const { track, clip } = located;
      const length = clipLength(clip);
      const relative = action.atSeconds - clip.start;
      if (relative <= MIN_CLIP_LENGTH || relative >= length - MIN_CLIP_LENGTH) return project;

      const first: StudioClip = {
        ...clip,
        trimEnd: clip.trimStart + relative,
        fadeOut: 0,
      };
      const second: StudioClip = {
        ...clip,
        id: crypto.randomUUID(),
        start: snapSeconds(clip.start + relative),
        trimStart: clip.trimStart + relative,
        fadeIn: 0,
        label: `${clip.label ?? 'Clip'} (2)`,
      };

      const clips = track.clips.flatMap((c) => (c.id === clip.id ? [first, second] : [c]));
      return sanitizeProject({
        ...project,
        tracks: project.tracks.map((t) => (t.id === track.id ? { ...t, clips } : t)),
      });
    }

    case 'REORDER_TRACK': {
      const track = project.tracks.find((t) => t.id === action.trackId);
      if (!track || track.clips.length < 2) return project;
      const clips = [...track.clips].sort((a, b) => a.start - b.start);
      const fromIndex = action.fromIndex;
      if (fromIndex < 0 || fromIndex >= clips.length) return project;
      const toIndex = Math.min(Math.max(0, action.toIndex), clips.length - 1);
      if (toIndex === fromIndex) return project;

      const [moved] = clips.splice(fromIndex, 1);
      clips.splice(toIndex, 0, moved);

      let cursor = clips[0].start;
      const retimed = clips.map((clip) => {
        const next = { ...clip, start: cursor };
        cursor += clipLength(clip);
        return next;
      });

      return sanitizeProject({
        ...project,
        tracks: project.tracks.map((t) => (t.id === track.id ? { ...t, clips: retimed } : t)),
      });
    }

    case 'SET_CLIP_VOLUME': {
      const volume = clamp01(action.volume);
      return mapClip(project, action.clipId, (clip) =>
        Math.abs(clip.volume - volume) < 1e-6 ? clip : { ...clip, volume },
      );
    }

    case 'SET_TRACK_VOLUME': {
      const volume = clamp01(action.volume);
      const tracks = project.tracks.map((track) =>
        track.id === action.trackId && Math.abs(track.volume - volume) > 1e-6
          ? { ...track, volume }
          : track,
      );
      if (tracks.every((track, i) => track === project.tracks[i])) return project;
      return sanitizeProject({ ...project, tracks });
    }

    case 'TOGGLE_TRACK_MUTE': {
      const tracks = project.tracks.map((track) =>
        track.id === action.trackId ? { ...track, muted: !track.muted } : track,
      );
      if (tracks.every((track, i) => track === project.tracks[i])) return project;
      return sanitizeProject({ ...project, tracks });
    }

    case 'SET_CLIP_FADE': {
      const fadeIn = Math.max(0, action.fadeIn ?? -1);
      const fadeOut = Math.max(0, action.fadeOut ?? -1);
      return mapClip(project, action.clipId, (clip) => {
        const nextFadeIn = action.fadeIn === undefined ? clip.fadeIn : fadeIn;
        const nextFadeOut = action.fadeOut === undefined ? clip.fadeOut : fadeOut;
        if (Math.abs(clip.fadeIn - nextFadeIn) < 1e-6 && Math.abs(clip.fadeOut - nextFadeOut) < 1e-6) {
          return clip;
        }
        return { ...clip, fadeIn: nextFadeIn, fadeOut: nextFadeOut };
      });
    }

    case 'SET_CLIP_ASSET': {
      const located = findClip(project, action.clipId);
      if (!located) return project;
      const { clip } = located;
      const next = mapClip(project, action.clipId, (c) =>
        c.assetUrl === action.assetUrl && c.assetKind === action.assetKind
          ? c
          : { ...c, assetUrl: action.assetUrl, assetKind: action.assetKind },
      );
      if (next === project) return project;
      const scenePlan = clip.beatId
        ? project.scenePlan.map((entry) =>
            entry.beatId === clip.beatId && !entry.clipId ? { ...entry, clipId: clip.id } : entry,
          )
        : project.scenePlan;
      return { ...next, scenePlan };
    }

    case 'ADD_CAPTION':
      return sanitizeProject({
        ...project,
        captions: [...project.captions, action.caption],
      });

    case 'UPDATE_CAPTION': {
      const captions = project.captions.map((caption) => {
        if (caption.id !== action.captionId) return caption;
        const merged = { ...caption, ...action.updates, id: caption.id };
        const start = Math.max(0, merged.start);
        const end = Math.max(start + 0.1, merged.end);
        if (Math.abs(caption.start - start) < 1e-6 && Math.abs(caption.end - end) < 1e-6 &&
            caption.text === merged.text && caption.kind === merged.kind &&
            caption.speaker === merged.speaker) {
          return caption;
        }
        return { ...merged, start, end };
      });
      if (captions.every((caption, i) => caption === project.captions[i])) return project;
      return sanitizeProject({ ...project, captions });
    }

    case 'REMOVE_CAPTION': {
      if (!project.captions.some((caption) => caption.id === action.captionId)) return project;
      return sanitizeProject({
        ...project,
        captions: project.captions.filter((caption) => caption.id !== action.captionId),
      });
    }

    case 'SET_BRANDING': {
      const branding: StudioBranding = {
        ...project.branding,
        ...action.branding,
        handle: action.branding.handle?.trim() || project.branding.handle,
        watermarkText:
          action.branding.watermarkText?.trim() || project.branding.watermarkText,
        accentColor: action.branding.accentColor || project.branding.accentColor,
      };
      return sanitizeProject({ ...project, branding });
    }

    case 'UNDO':
    case 'REDO':
      return project;

    default:
      return project;
  }
}

function sanitizeClip(clip: StudioClip): StudioClip {
  return {
    ...clip,
    start: Math.max(0, clip.start),
    trimStart: Math.max(0, clip.trimStart),
    trimEnd: Math.max(clip.trimStart + MIN_CLIP_LENGTH, clip.trimEnd),
    volume: clamp01(clip.volume),
    fadeIn: Math.max(0, clip.fadeIn),
    fadeOut: Math.max(0, clip.fadeOut),
  };
}

// ---------------------------------------------------------------------------
// Undo / redo history
// ---------------------------------------------------------------------------

export interface StudioHistory {
  /** Current project (kept in sync by dispatch/undo/redo). */
  readonly state: StudioProject;
  dispatch(action: StudioAction): void;
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  subscribe(listener: () => void): () => void;
}

/**
 * Create an undo/redo history around a project. Every mutation pushes the
 * previous project onto the undo stack (capped at 50) and clears redo; UNDO and
 * REDO walk the two stacks. LOAD_PROJECT resets both stacks.
 */
export function createStudioHistory(initial: StudioProject): StudioHistory {
  const past: StudioProject[] = [];
  const future: StudioProject[] = [];
  const listeners = new Set<() => void>();
  let state = sanitizeProject(initial);

  const emit = () => {
    listeners.forEach((listener) => listener());
  };

  const history: StudioHistory = {
    get state() {
      return state;
    },
    dispatch(action: StudioAction) {
      if (action.type === 'UNDO') {
        history.undo();
        return;
      }
      if (action.type === 'REDO') {
        history.redo();
        return;
      }
      if (action.type === 'LOAD_PROJECT') {
        state = sanitizeProject(action.project);
        past.length = 0;
        future.length = 0;
        emit();
        return;
      }
      const next = studioReducer(state, action);
      if (next === state) return;
      past.push(state);
      if (past.length > HISTORY_LIMIT) past.shift();
      future.length = 0;
      state = next;
      emit();
    },
    undo() {
      const previous = past.pop();
      if (!previous) return;
      future.push(state);
      state = previous;
      emit();
    },
    redo() {
      const next = future.pop();
      if (!next) return;
      past.push(state);
      state = next;
      emit();
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };

  return history;
}
