import { describe, it, expect } from 'vitest';
import { containRect, contactSheetLayout } from './frames';
import { addRecastClips } from '../timeline/ops';
import { DEFAULT_PROJECT } from '../timeline/types';

describe('contactSheetLayout', () => {
  it('lays 5 images out in 3 columns and 2 rows, labels above cells, nothing overlapping', () => {
    const l = contactSheetLayout(5);
    expect(l.cells).toHaveLength(5);
    expect(new Set(l.cells.map(c => c.x)).size).toBe(3);
    expect(new Set(l.cells.map(c => c.y)).size).toBe(2);
    for (const c of l.cells) { expect(c.y).toBeGreaterThan(c.labelY); expect(c.x + c.w).toBeLessThanOrEqual(l.width); expect(c.y + c.h).toBeLessThanOrEqual(l.height); }
    for (let i = 0; i < l.cells.length; i++) for (let j = i + 1; j < l.cells.length; j++) {
      const a = l.cells[i], b = l.cells[j];
      expect(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h).toBe(false);
    }
  });
  it('fewer images than columns shrinks the sheet; zero images is still valid', () => {
    expect(contactSheetLayout(1).width).toBeLessThan(contactSheetLayout(3).width);
    expect(contactSheetLayout(0).cells).toEqual([]);
  });
});

describe('containRect', () => {
  it('fits a wide image into a wide cell and centres a tall one', () => {
    expect(containRect(1920, 1080, 480, 270)).toEqual({ dx: 0, dy: 0, dw: 480, dh: 270 });
    const tall = containRect(768, 1360, 480, 270);
    expect(tall.dh).toBe(270); expect(tall.dx).toBeGreaterThan(0); expect(tall.dw + 2 * tall.dx).toBeLessThanOrEqual(481);
  });
  it('survives unreadable sizes', () => { expect(containRect(0, 0, 100, 50)).toEqual({ dx: 0, dy: 0, dw: 100, dh: 50 }); });
});

describe('addRecastClips', () => {
  const a = { generatedUrl: 'https://g/out.mp4', sourceUrl: 'https://s/src.mp4', generatedFrames: 150, sourceFrames: 151, label: 'Recast' };
  it('adds the generated clip muted and the source as a sound clip at the same start', () => {
    const { project, videoId, audioId } = addRecastClips(DEFAULT_PROJECT, a);
    const v = project.clips.find(c => c.id === videoId)!, au = project.clips.find(c => c.id === audioId)!;
    expect(v).toMatchObject({ kind: 'video', volume: 0, start: 0, duration: 150, src: a.generatedUrl });
    expect(au).toMatchObject({ kind: 'audio', volume: 1, start: 0, src: a.sourceUrl, trackId: 'a1' });
    expect(au.duration).toBe(150);                       // source audio longer -> trimmed to the generated length
  });
  it('appends after existing video and keeps audio aligned with the new clip', () => {
    const first = addRecastClips(DEFAULT_PROJECT, a).project;
    const { project, videoId, audioId } = addRecastClips(first, a);
    const v = project.clips.find(c => c.id === videoId)!, au = project.clips.find(c => c.id === audioId)!;
    expect(v.start).toBe(150); expect(au.start).toBe(150);
  });
  it('shorter source audio keeps its own length; no audio when the source has none', () => {
    const short = addRecastClips(DEFAULT_PROJECT, { ...a, sourceFrames: 90 });
    expect(short.project.clips.find(c => c.id === short.audioId)!.duration).toBe(90);
    const none = addRecastClips(DEFAULT_PROJECT, { ...a, hasSourceAudio: false });
    expect(none.audioId).toBeUndefined(); expect(none.project.clips).toHaveLength(1);
  });
});
