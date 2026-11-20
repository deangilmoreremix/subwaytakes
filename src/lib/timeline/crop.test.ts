import { describe, expect, it } from 'vitest';
import { areaForCrop, clampPixelCrop, cropFromArea, cropStyle, MAX_ZOOM, normalizeCrop } from './crop';

describe('normalizeCrop', () => {
  it('no crop stays "no crop", so old clips render exactly as before', () => {
    expect(normalizeCrop(undefined)).toBeNull();
    expect(normalizeCrop(null)).toBeNull();
    expect(normalizeCrop({ zoom: 1, x: 0.5, y: 0.5 })).toBeNull();
    expect(normalizeCrop('x')).toBeNull();
    expect(cropStyle(undefined)).toEqual({});
  });
  it('keeps zoom in range and the picture covering the frame', () => {
    expect(normalizeCrop({ zoom: 99, x: 0.5, y: 0.5 })?.zoom).toBe(MAX_ZOOM);
    expect(normalizeCrop({ zoom: 0.2, x: 0.9, y: 0.1 })).toBeNull();                 // below 1 becomes 1, and at 1 there is no room to move
    const c = normalizeCrop({ zoom: 2, x: 1, y: 0 })!;
    expect(c.x).toBeCloseTo(0.75); expect(c.y).toBeCloseTo(0.25);                      // at 2x the focal point may move a quarter either way
    const t = normalizeCrop({ zoom: 3, x: -5, y: 99 })!;
    expect(t.x).toBeCloseTo(0.5 - 0.5 * (1 - 1 / 3)); expect(t.y).toBeCloseTo(0.5 + 0.5 * (1 - 1 / 3));
  });
  it('survives junk numbers', () => {
    expect(normalizeCrop({ zoom: Number.NaN, x: 'a' as never, y: undefined as never })).toBeNull();
    expect(normalizeCrop({ zoom: 2, x: Number.NaN, y: Number.POSITIVE_INFINITY })).toMatchObject({ zoom: 2, x: 0.5 });
  });
});

describe('cropStyle', () => {
  it('moves the focal point to the middle then zooms around the middle', () => {
    const s = cropStyle({ zoom: 2, x: 0.75, y: 0.5 });
    expect(s.transformOrigin).toBe('50% 50%');
    expect(s.transform).toBe('scale(2) translate(-25.000%, 0.000%)');
  });
});

describe('react-easy-crop mapping', () => {
  it('the focal point is the centre of the visible area, with the zoom it was made at', () => {
    expect(cropFromArea({ x: 25, y: 25, width: 50, height: 50 }, 2)).toEqual({ zoom: 2, x: 0.5, y: 0.5 });
    expect(cropFromArea({ x: 0, y: 0, width: 100, height: 100 }, 1)).toBeNull();      // the whole picture: no reframe
    expect(cropFromArea({ x: 50, y: 10, width: 50, height: 50 }, 2)).toEqual({ zoom: 2, x: 0.75, y: 0.35 });
  });
  it('round trip: area for a crop gives back the crop', () => {
    for (const [mediaAspect, frameAspect] of [[9 / 16, 9 / 16], [16 / 9, 9 / 16], [1, 9 / 16], [9 / 16, 16 / 9]]) {
      const crop = { zoom: 2, x: 0.6, y: 0.4 };
      const area = areaForCrop(crop, mediaAspect, frameAspect);
      const back = cropFromArea(area, crop.zoom)!;
      expect(back.x).toBeCloseTo(normalizeCrop(crop)!.x, 2);
      expect(back.y).toBeCloseTo(normalizeCrop(crop)!.y, 2);
      expect(area.x).toBeGreaterThanOrEqual(0); expect(area.x + area.width).toBeLessThanOrEqual(100.0001);
      expect(area.y).toBeGreaterThanOrEqual(0); expect(area.y + area.height).toBeLessThanOrEqual(100.0001);
    }
  });
});

describe('clampPixelCrop', () => {
  it('keeps the rectangle inside the picture with whole pixels', () => {
    expect(clampPixelCrop({ x: -5, y: 10.4, width: 5000, height: 20.6 }, 100, 80)).toEqual({ x: 0, y: 10, width: 100, height: 21 });
    expect(clampPixelCrop({ x: 99, y: 79, width: 50, height: 50 }, 100, 80)).toEqual({ x: 99, y: 79, width: 1, height: 1 });
    expect(clampPixelCrop({ x: Number.NaN, y: Number.NaN, width: Number.NaN, height: Number.NaN }, 100, 80)).toEqual({ x: 0, y: 0, width: 100, height: 80 });
  });
});
