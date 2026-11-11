import { describe, it, expect } from 'vitest';
import { DEFAULT_PROJECT, ensureTracks, type Clip, type Project } from './types';
import { addClip, moveClip, trimClip, splitAt, deleteClip, snap, projectDuration } from './ops';

const vid = (id: string, start: number, duration: number, extra: Partial<Clip> = {}): Omit<Clip, 'id'> & { id: string } =>
  ({ id, trackId: 'v1', kind: 'video', label: id, start, duration, trimStart: 0, sourceFrames: 240, src: 'x.mp4', ...extra });
const mk = (...clips: ReturnType<typeof vid>[]): Project => clips.reduce<Project>((p, c) => addClip(p, c), DEFAULT_PROJECT);
const get = (p: Project, id: string) => p.clips.find(c => c.id === id)!;

describe('timeline ops', () => {
  it('addClip pushes past overlapping clips', () => {
    const p = mk(vid('a', 0, 60), vid('b', 30, 60));
    expect(get(p, 'b').start).toBe(60);
    expect(projectDuration(p)).toBe(120);
  });

  it('moveClip cannot overlap neighbours and stays on matching track kinds', () => {
    const p = mk(vid('a', 0, 60), vid('b', 100, 60));
    expect(get(moveClip(p, 'b', 20), 'b').start).toBe(60);
    expect(get(moveClip(p, 'b', 10, 'c1'), 'b').trackId).toBe('v1'); // caption track rejected for video
  });

  it('trim right is limited by source length and next clip', () => {
    const p = mk(vid('a', 0, 60, { sourceFrames: 100 }), vid('b', 80, 30));
    expect(get(trimClip(p, 'a', 'right', 500), 'a').duration).toBe(80 - 0); // next clip at 80
    const q = mk(vid('a', 0, 60, { sourceFrames: 100 }));
    expect(get(trimClip(q, 'a', 'right', 500), 'a').duration).toBe(100);   // source limit
  });

  it('trim left advances trimStart and keeps minimum length', () => {
    const p = mk(vid('a', 30, 60));
    const t = get(trimClip(p, 'a', 'left', 20), 'a');
    expect([t.start, t.duration, t.trimStart]).toEqual([50, 40, 20]);
    expect(get(trimClip(p, 'a', 'left', 999), 'a').duration).toBeGreaterThanOrEqual(6);
  });

  it('splitAt keeps total duration and offsets the right half into the source', () => {
    const p = splitAt(mk(vid('a', 0, 90)), 30);
    expect(p.clips).toHaveLength(2);
    const [l, r] = [...p.clips].sort((x, y) => x.start - y.start);
    expect([l.start, l.duration, r.start, r.duration, r.trimStart]).toEqual([0, 30, 30, 60, 30]);
  });

  it('splitAt near an edge is a no-op', () => {
    const p = mk(vid('a', 0, 90));
    expect(splitAt(p, 2).clips).toHaveLength(1);
  });

  it('deleteClip ripple closes the gap', () => {
    const p = mk(vid('a', 0, 60), vid('b', 60, 60));
    expect(get(deleteClip(p, 'a', true), 'b').start).toBe(0);
    expect(get(deleteClip(p, 'a', false), 'b').start).toBe(60);
  });

  it('snap pulls to clip edges within threshold only', () => {
    const p = mk(vid('a', 0, 60));
    expect(snap(p, 63, 5)).toBe(60);
    expect(snap(p, 70, 5)).toBe(70);
  });

  it('audio clips trim and split like media clips (source-offset aware)', () => {
    const base = { ...DEFAULT_PROJECT };
    const p = addClip(base, { id: 's', trackId: 'a1', kind: 'audio', label: 'sfx', start: 0, duration: 60, trimStart: 0, sourceFrames: 60, src: 'x.wav' });
    const t = get(trimClip(p, 's', 'left', 20), 's');
    expect([t.start, t.duration, t.trimStart]).toEqual([20, 40, 20]);
    const sp = splitAt(p, 30, 's');
    const right = sp.clips.find(c => c.start === 30)!;
    expect(right.trimStart).toBe(30);
    expect(get(trimClip(p, 's', 'right', 999), 's').duration).toBe(60); // limited by source
  });

  it('older saved projects gain the default Sound track', () => {
    const old: Project = { fps: 30, tracks: [{ id: 'v1', kind: 'video', name: 'Video' }, { id: 'c1', kind: 'caption', name: 'Captions' }], clips: [] };
    expect(ensureTracks(old).tracks.map(t => t.id)).toEqual(['v1', 'c1', 'a1']);
    expect(ensureTracks(DEFAULT_PROJECT)).toBe(DEFAULT_PROJECT);
  });
});
