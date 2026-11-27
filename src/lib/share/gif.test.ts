import { describe, expect, it } from 'vitest';
import { GIF_MAX_BYTES, estimateGifBytes, gifPlan, gifProblem, posterTime, shareFileName, teaserStart } from './gif';

describe('teaser planning', () => {
  it('uses at most 3 seconds at 10 frames a second, 480 wide, same shape', () => {
    const p = gifPlan(20, 1080, 1920);
    expect(p.times).toHaveLength(30);
    expect(p.fps).toBe(10); expect(p.delayMs).toBe(100);
    expect(p.width).toBe(480); expect(p.height).toBe(854);                   // 480 x 853.3, kept even
    expect(p.times[0]).toBeCloseTo(2); expect(p.times[29]).toBeCloseTo(4.9);
    for (const t of p.times) expect(t).toBeLessThan(20);
  });
  it('a short video gives a GIF of the whole video, never reading past its end', () => {
    const p = gifPlan(1.5, 720, 1280);
    expect(p.times.length).toBeGreaterThan(0); expect(p.times.length).toBeLessThanOrEqual(15);
    expect(Math.max(...p.times)).toBeLessThan(1.5);
    expect(gifPlan(0.2, 720, 1280).times.length).toBeGreaterThanOrEqual(1);
  });
  it('bad input gives an empty plan and a reason', () => {
    for (const [d, w, h] of [[0, 720, 1280], [-3, 720, 1280], [5, 0, 10], [Number.NaN, 1, 1]] as const) {
      const p = gifPlan(d, w, h);
      expect(p.times).toEqual([]);
      expect(gifProblem(p)).toMatch(/nothing/);
    }
  });
  it('keeps the options in range', () => {
    expect(gifPlan(10, 100, 100, { fps: 999 }).fps).toBe(20);
    expect(gifPlan(10, 100, 100, { fps: 0 }).fps).toBe(1);
    expect(gifPlan(10, 100, 100, { width: 5 }).width).toBe(64);
    expect(gifPlan(10, 100, 100, { width: 99999 }).width).toBe(1080);
    expect(gifPlan(100, 100, 100, { maxSeconds: 1, fps: 10 }).times).toHaveLength(10);
  });
  it('refuses a GIF that would be too big to share', () => {
    const big = gifPlan(60, 1920, 1080, { maxSeconds: 30, fps: 20, width: 1080 });
    expect(estimateGifBytes(big)).toBeGreaterThan(GIF_MAX_BYTES);
    expect(gifProblem(big)).toMatch(/too big/);
    expect(gifProblem(gifPlan(20, 1080, 1920))).toBeNull();
    expect(estimateGifBytes(gifPlan(20, 1080, 1920))).toBeLessThan(GIF_MAX_BYTES);
  });
  it('picks sensible moments', () => {
    expect(teaserStart(20)).toBe(2); expect(teaserStart(0.3)).toBe(0); expect(teaserStart(-1)).toBe(0);
    expect(posterTime(20)).toBeCloseTo(7); expect(posterTime(0.05)).toBe(0); expect(posterTime(Number.NaN)).toBe(0);
  });
  it('names files', () => { expect(shareFileName('gif', 5)).toBe('subwaytakes-gif-5.gif'); expect(shareFileName('poster', 5)).toBe('subwaytakes-poster-5.png'); });
});
