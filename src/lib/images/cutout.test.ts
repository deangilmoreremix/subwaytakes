import { describe, expect, it } from 'vitest';
import { applyMask, cutoutProblem, feather, fitCutoutSize, maskCoverage } from './cutout';

const solid = (w: number, h: number, rgba: [number, number, number, number]) => { const a = new Uint8ClampedArray(w * h * 4); for (let i = 0; i < w * h; i++) a.set(rgba, i * 4); return a; };
// a 6x4 picture whose left half is "person"
const W = 6, H = 4;
const half = () => { const m = new Float32Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < 3; x++) m[y * W + x] = 1; return m; };

describe('fitCutoutSize', () => {
  it('keeps small pictures and shrinks big ones, same shape', () => {
    expect(fitCutoutSize(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fitCutoutSize(4000, 3000, 1000)).toEqual({ width: 1000, height: 750 });
    expect(fitCutoutSize(1000, 4000, 1000)).toEqual({ width: 250, height: 1000 });
    expect(fitCutoutSize(0, 5)).toEqual({ width: 0, height: 0 });
  });
});

describe('mask checks', () => {
  it('measures coverage', () => { expect(maskCoverage(half())).toBeCloseTo(0.5); expect(maskCoverage(new Float32Array(0))).toBe(0); });
  it('refuses "nobody there" and "everything is the person"', () => {
    expect(cutoutProblem(0)).toMatch(/No person/);
    expect(cutoutProblem(0.01)).toMatch(/No person/);
    expect(cutoutProblem(0.99)).toMatch(/no background/);
    expect(cutoutProblem(0.4)).toBeNull();
    expect(cutoutProblem(Number.NaN)).toMatch(/No person/);
  });
});

describe('feather', () => {
  it('leaves the mask alone at radius 0 and softens the edge otherwise, keeping the average', () => {
    const m = half();
    expect(feather(m, W, H, 0)).toBe(m);
    const f = feather(m, W, H, 1);
    expect(f[1 * W + 2]).toBeLessThan(1); expect(f[1 * W + 3]).toBeGreaterThan(0);          // the edge now ramps
    expect(f[1 * W + 0]).toBeGreaterThan(0.6); expect(f[1 * W + 5]).toBeLessThan(0.4);
  });
});

describe('applyMask', () => {
  const img = solid(W, H, [200, 100, 50, 255]);
  it('transparent: person kept, background becomes see-through', () => {
    const out = applyMask(img, half(), W, H, { kind: 'transparent' }, 0);
    expect(Array.from(out.slice(0, 4))).toEqual([200, 100, 50, 255]);              // left = person
    expect(out[(W - 1) * 4 + 3]).toBe(0);                                          // right = background
  });
  it('solid colour: background replaced and fully opaque', () => {
    const out = applyMask(img, half(), W, H, { kind: 'color', rgb: [255, 255, 255] }, 0);
    expect(Array.from(out.slice(0, 4))).toEqual([200, 100, 50, 255]);
    expect(Array.from(out.slice((W - 1) * 4, (W - 1) * 4 + 4))).toEqual([255, 255, 255, 255]);
  });
  it('blurred original: background pixels come from the blurred copy', () => {
    const blurred = solid(W, H, [10, 20, 30, 255]);
    const out = applyMask(img, half(), W, H, { kind: 'blur', rgba: blurred }, 0);
    expect(Array.from(out.slice((W - 1) * 4, (W - 1) * 4 + 4))).toEqual([10, 20, 30, 255]);
  });
  it('a half-sure pixel is blended, not cut hard', () => {
    const m = new Float32Array(W * H).fill(0.5);
    const out = applyMask(solid(W, H, [200, 0, 0, 255]), m, W, H, { kind: 'color', rgb: [0, 0, 0] }, 0);
    expect(out[0]).toBeGreaterThan(80); expect(out[0]).toBeLessThan(120);
  });
  it('refuses a mask or blurred copy of the wrong size', () => {
    expect(() => applyMask(img, new Float32Array(3), W, H, { kind: 'transparent' })).toThrow(/same size/);
    expect(() => applyMask(img, half(), W, H, { kind: 'blur', rgba: new Uint8ClampedArray(4) })).toThrow(/same size/);
  });
  it('does not change the input', () => {
    const copy = Uint8ClampedArray.from(img);
    applyMask(img, half(), W, H, { kind: 'transparent' });
    expect(Array.from(img)).toEqual(Array.from(copy));
  });
});
