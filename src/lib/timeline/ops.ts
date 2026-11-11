import { MIN_CLIP, type Clip, type Project, type TransitionType } from './types';

let counter = 0;
export const newId = (p = 'clip') => `${p}_${Date.now().toString(36)}_${(counter++).toString(36)}`;

export const clipEnd = (c: Clip) => c.start + c.duration;
export const projectDuration = (p: Project) => p.clips.reduce((m, c) => Math.max(m, clipEnd(c)), 0);

const onTrack = (p: Project, trackId: string, exceptId?: string) =>
  p.clips.filter(c => c.trackId === trackId && c.id !== exceptId).sort((a, b) => a.start - b.start);

/** Snap a frame to the nearest clip edge / playhead / 0 within `threshold` frames. */
export function snap(p: Project, frame: number, threshold: number, exceptId?: string, playhead?: number): number {
  const points = [0, ...(playhead !== undefined ? [playhead] : [])];
  for (const c of p.clips) if (c.id !== exceptId) points.push(c.start, clipEnd(c));
  let best = frame, dist = threshold + 1;
  for (const pt of points) { const d = Math.abs(pt - frame); if (d < dist) { dist = d; best = pt; } }
  return dist <= threshold ? best : frame;
}

/** Earliest start >= `desired` where `duration` fits on the track without overlap. */
export function findFreeStart(p: Project, trackId: string, desired: number, duration: number, exceptId?: string): number {
  let start = Math.max(0, desired);
  for (const c of onTrack(p, trackId, exceptId)) {
    if (start + duration <= c.start) break;
    if (start < clipEnd(c)) start = clipEnd(c);
  }
  return start;
}

export function addClip(p: Project, clip: Omit<Clip, 'id'> & { id?: string }): Project {
  const start = findFreeStart(p, clip.trackId, clip.start, clip.duration);
  return normalizeTransitions({ ...p, clips: [...p.clips, { ...clip, id: clip.id ?? newId(), start }] });
}

/** Move a clip (optionally to another track of the same kind); never overlaps neighbours. */
export function moveClip(p: Project, id: string, start: number, trackId?: string): Project {
  const c = p.clips.find(x => x.id === id);
  if (!c) return p;
  const target = trackId && p.tracks.find(t => t.id === trackId)?.kind === c.kind ? trackId : c.trackId;
  if (start === c.start && target === c.trackId) return p; // a click is not a move
  const s = findFreeStart(p, target, start, c.duration, id);
  return normalizeTransitions({ ...p, clips: p.clips.map(x => (x.id === id ? { ...x, start: s, trackId: target } : x)) });
}

/** Trim the left or right edge by `delta` frames (negative extends). Clamped by source, neighbours and MIN_CLIP. */
export function trimClip(p: Project, id: string, edge: 'left' | 'right', delta: number): Project {
  const c = p.clips.find(x => x.id === id);
  if (!c) return p;
  const siblings = onTrack(p, c.trackId, id);
  const prevEnd = Math.max(0, ...siblings.filter(s => clipEnd(s) <= c.start).map(clipEnd));
  const next = siblings.find(s => s.start >= clipEnd(c));
  const isVideo = c.kind === 'video' || c.kind === 'audio'; // clips backed by source media
  let { start, duration, trimStart } = c;
  if (edge === 'left') {
    let d = delta;
    d = Math.max(d, prevEnd - c.start);                 // not into previous clip
    if (isVideo) d = Math.max(d, -c.trimStart);          // not before source start
    d = Math.min(d, c.duration - MIN_CLIP);              // keep minimum length
    start += d; duration -= d; if (isVideo) trimStart += d;
  } else {
    let d = delta;
    if (next) d = Math.min(d, next.start - clipEnd(c));
    if (isVideo && c.sourceFrames !== undefined) d = Math.min(d, c.sourceFrames - (c.trimStart + c.duration));
    d = Math.max(d, MIN_CLIP - c.duration);
    duration += d;
  }
  return normalizeTransitions({ ...p, clips: p.clips.map(x => (x.id === id ? { ...x, start, duration, trimStart } : x)) });
}

/** Split the clip under `frame` (or the given clip) into two at `frame`. */
export function splitAt(p: Project, frame: number, id?: string): Project {
  const c = p.clips.find(x => (id ? x.id === id : x.start < frame && frame < clipEnd(x) && x.kind === 'video')) ??
            p.clips.find(x => x.start < frame && frame < clipEnd(x));
  if (!c || frame <= c.start + MIN_CLIP - 1 || frame >= clipEnd(c) - MIN_CLIP + 1) return p;
  const leftDur = frame - c.start;
  const right: Clip = { ...c, id: newId(), start: frame, duration: c.duration - leftDur, trimStart: c.kind === 'video' || c.kind === 'audio' ? c.trimStart + leftDur : c.trimStart };
  const { transitionIn: _noIn, ...rightClean } = right; void _noIn; // the new right half starts a fresh cut
  return normalizeTransitions({ ...p, clips: p.clips.flatMap(x => (x.id === c.id ? [{ ...x, duration: leftDur }, rightClean as Clip] : [x])) });
}

export function deleteClip(p: Project, id: string, ripple = false): Project {
  const c = p.clips.find(x => x.id === id);
  if (!c) return p;
  return normalizeTransitions({
    ...p,
    clips: p.clips.filter(x => x.id !== id).map(x => (ripple && x.trackId === c.trackId && x.start >= clipEnd(c) ? { ...x, start: x.start - c.duration } : x)),
  });
}

export function updateClip(p: Project, id: string, patch: Partial<Clip>): Project {
  return { ...p, clips: p.clips.map(x => (x.id === id ? { ...x, ...patch } : x)) };
}

export const framesToTime = (f: number, fps: number) => {
  const s = f / fps;
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${(s % 60).toFixed(1).padStart(4, '0')}`;
};

// ---------------------------------------------------------------- transitions

/** The clip right before `c` on its track (greatest start earlier than c.start), or undefined. */
export function predecessorOf(p: Project, c: Clip): Clip | undefined {
  return p.clips.filter(x => x.trackId === c.trackId && x.id !== c.id && x.start < c.start).sort((a, b) => b.start - a.start)[0];
}

/**
 * Drop any transitionIn that is no longer consistent: it must overlap its predecessor by exactly `frames`,
 * be shorter than both clips, and a clip's in- and out-transitions must fit inside it together.
 * Every structural op runs this, so editing an edge simply removes a transition that no longer applies.
 */
export function normalizeTransitions(p: Project): Project {
  let changed = false;
  const byId = new Map(p.clips.map(c => [c.id, c]));
  const valid = (c: Clip): boolean => {
    const t = c.transitionIn;
    if (!t) return true;
    if (c.kind !== 'video' || t.frames < 1) return false;
    const pred = predecessorOf(p, c);
    if (!pred || pred.kind !== 'video') return false;
    if (clipEnd(pred) - c.start !== t.frames) return false;
    if (t.frames >= pred.duration || t.frames >= c.duration) return false;
    const predIn = byId.get(pred.id)?.transitionIn?.frames ?? 0;
    return predIn + t.frames < pred.duration; // in + out transitions of the previous clip must not collide
  };
  const clips = p.clips.map(c => {
    if (c.transitionIn && !valid(c)) { changed = true; const { transitionIn: _drop, ...rest } = c; void _drop; return rest as Clip; }
    return c;
  });
  return changed ? { ...p, clips } : p;
}

export interface TransitionContext {
  /** a previous clip exists that this clip abuts (or already overlaps via a transition) */
  available: boolean;
  current?: { type: TransitionType; frames: number };
  maxFrames: number;
}

export function getTransitionContext(p: Project, id: string): TransitionContext {
  const c = p.clips.find(x => x.id === id);
  if (!c || c.kind !== 'video') return { available: false, maxFrames: 0 };
  const pred = predecessorOf(p, c);
  if (!pred || pred.kind !== 'video') return { available: false, maxFrames: 0 };
  const cur = c.transitionIn?.frames ?? 0;
  const abut = clipEnd(pred) - c.start === cur;
  if (!abut) return { available: false, maxFrames: 0 };
  const predIn = pred.transitionIn?.frames ?? 0;
  const maxFrames = Math.max(0, Math.min(pred.duration - predIn, c.duration) - 2);
  return { available: maxFrames >= 2, current: c.transitionIn, maxFrames };
}

/**
 * Set (or clear with null) the transition into clip `id`. The clip and everything after it on the track
 * shift so the overlap equals the new length. No-op if the clip does not abut its predecessor.
 */
export function setTransition(p: Project, id: string, tr: { type: TransitionType; frames: number } | null): Project {
  const c = p.clips.find(x => x.id === id);
  if (!c) return p;
  const ctx = getTransitionContext(p, id);
  if (!ctx.available) return p;
  const pred = predecessorOf(p, c)!;
  const frames = tr ? Math.max(2, Math.min(Math.round(tr.frames), ctx.maxFrames)) : 0;
  const newStart = clipEnd(pred) - frames;
  const delta = newStart - c.start;
  const clips = p.clips.map(x => {
    if (x.trackId !== c.trackId || x.start < c.start) return x;
    const moved = delta === 0 ? x : { ...x, start: x.start + delta };
    if (x.id !== id) return moved;
    if (!tr) { const { transitionIn: _drop, ...rest } = moved; void _drop; return rest as Clip; }
    return { ...moved, transitionIn: { type: tr.type, frames } };
  });
  return normalizeTransitions({ ...p, clips });
}
