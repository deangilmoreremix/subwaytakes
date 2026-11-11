import { MIN_CLIP, type Clip, type Project } from './types';

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
  return { ...p, clips: [...p.clips, { ...clip, id: clip.id ?? newId(), start }] };
}

/** Move a clip (optionally to another track of the same kind); never overlaps neighbours. */
export function moveClip(p: Project, id: string, start: number, trackId?: string): Project {
  const c = p.clips.find(x => x.id === id);
  if (!c) return p;
  const target = trackId && p.tracks.find(t => t.id === trackId)?.kind === c.kind ? trackId : c.trackId;
  const s = findFreeStart(p, target, start, c.duration, id);
  return { ...p, clips: p.clips.map(x => (x.id === id ? { ...x, start: s, trackId: target } : x)) };
}

/** Trim the left or right edge by `delta` frames (negative extends). Clamped by source, neighbours and MIN_CLIP. */
export function trimClip(p: Project, id: string, edge: 'left' | 'right', delta: number): Project {
  const c = p.clips.find(x => x.id === id);
  if (!c) return p;
  const siblings = onTrack(p, c.trackId, id);
  const prevEnd = Math.max(0, ...siblings.filter(s => clipEnd(s) <= c.start).map(clipEnd));
  const next = siblings.find(s => s.start >= clipEnd(c));
  const isVideo = c.kind === 'video';
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
  return { ...p, clips: p.clips.map(x => (x.id === id ? { ...x, start, duration, trimStart } : x)) };
}

/** Split the clip under `frame` (or the given clip) into two at `frame`. */
export function splitAt(p: Project, frame: number, id?: string): Project {
  const c = p.clips.find(x => (id ? x.id === id : x.start < frame && frame < clipEnd(x) && x.kind === 'video')) ??
            p.clips.find(x => x.start < frame && frame < clipEnd(x));
  if (!c || frame <= c.start + MIN_CLIP - 1 || frame >= clipEnd(c) - MIN_CLIP + 1) return p;
  const leftDur = frame - c.start;
  const right: Clip = { ...c, id: newId(), start: frame, duration: c.duration - leftDur, trimStart: c.kind === 'video' ? c.trimStart + leftDur : c.trimStart };
  return { ...p, clips: p.clips.flatMap(x => (x.id === c.id ? [{ ...x, duration: leftDur }, right] : [x])) };
}

export function deleteClip(p: Project, id: string, ripple = false): Project {
  const c = p.clips.find(x => x.id === id);
  if (!c) return p;
  return {
    ...p,
    clips: p.clips.filter(x => x.id !== id).map(x => (ripple && x.trackId === c.trackId && x.start >= clipEnd(c) ? { ...x, start: x.start - c.duration } : x)),
  };
}

export function updateClip(p: Project, id: string, patch: Partial<Clip>): Project {
  return { ...p, clips: p.clips.map(x => (x.id === id ? { ...x, ...patch } : x)) };
}

export const framesToTime = (f: number, fps: number) => {
  const s = f / fps;
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${(s % 60).toFixed(1).padStart(4, '0')}`;
};
