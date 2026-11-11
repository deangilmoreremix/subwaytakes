import { describe, it, expect, vi } from 'vitest';
vi.mock('../../components/studio/EpisodeComposition', () => ({ EpisodeComposition: () => null }));
import { compositionFor } from './export';
import { DEFAULT_PROJECT, type Project } from './types';

const p: Project = { ...DEFAULT_PROJECT, clips: [{ id: 'a', trackId: 'v1', kind: 'video', label: 'a', start: 0, duration: 90, trimStart: 0, src: 'x.mp4' }, { id: 'b', trackId: 'v1', kind: 'video', label: 'b', start: 90, duration: 60, trimStart: 0, src: 'y.mp4' }] };

describe('compositionFor', () => {
  it('uses 1080x1920 for 9:16 and spans the whole timeline', () => {
    expect(compositionFor(p, '9:16')).toMatchObject({ width: 1080, height: 1920, durationInFrames: 150, fps: 30, scale: 1 });
  });
  it('scales 720p from the short side', () => {
    expect(compositionFor(p, '9:16', '720p').scale).toBeCloseTo(720 / 1080);
    expect(compositionFor(p, '16:9', '720p').scale).toBeCloseTo(720 / 1080);
  });
  it('never returns a zero-length composition', () => {
    expect(compositionFor(DEFAULT_PROJECT, '1:1').durationInFrames).toBe(1);
  });
});
