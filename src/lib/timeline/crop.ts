/**
 * Reframe a video clip: zoom in and choose which part of the picture stays centred. Pure maths, shared by the editor and the renderer.
 * `crop = { zoom, x, y }`: zoom 1 to 3, and (x, y) is the spot in the picture (0 to 1 across, 0 to 1 down) that is moved to the middle of the frame.
 * Rendered with plain CSS only (object-fit cover + one 2D transform), so it also works in the web exporter.
 */
export interface ClipCrop { zoom: number; x: number; y: number }

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 3;
export const NO_CROP: ClipCrop = { zoom: 1, x: 0.5, y: 0.5 };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/**
 * Make any input a valid crop: zoom in range, and the focal point kept far enough from the edges that the zoomed picture
 * always covers the whole frame (no empty strips). Returns null for "no reframe" (zoom 1 centred), so old clips stay exactly as they were.
 */
export function normalizeCrop(raw: unknown): ClipCrop | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<ClipCrop>;
  const zoom = clamp(num(r.zoom, 1), MIN_ZOOM, MAX_ZOOM);
  const slack = 0.5 * (1 - 1 / zoom);                    // how far the focal point may move from the centre at this zoom
  const x = clamp(num(r.x, 0.5), 0.5 - slack, 0.5 + slack);
  const y = clamp(num(r.y, 0.5), 0.5 - slack, 0.5 + slack);
  if (zoom <= 1.0001 && Math.abs(x - 0.5) < 1e-4 && Math.abs(y - 0.5) < 1e-4) return null;
  return { zoom: Math.round(zoom * 1000) / 1000, x: Math.round(x * 10000) / 10000, y: Math.round(y * 10000) / 10000 };
}

/** The CSS for a video element inside a frame that clips it. Undefined style entries mean "no reframe". */
export function cropStyle(crop: ClipCrop | null | undefined): { transform?: string; transformOrigin?: string } {
  const c = normalizeCrop(crop);
  if (!c) return {};
  // bring the focal point to the middle (percent of the element's own size), then zoom around the middle
  return { transformOrigin: '50% 50%', transform: `scale(${c.zoom}) translate(${((0.5 - c.x) * 100).toFixed(3)}%, ${((0.5 - c.y) * 100).toFixed(3)}%)` };
}

/**
 * From what react-easy-crop reports (`croppedAreaPercentages`, 0 to 100, relative to the whole picture) and its zoom:
 * the focal point is the centre of the visible area.
 */
export function cropFromArea(area: { x: number; y: number; width: number; height: number }, zoom: number): ClipCrop | null {
  return normalizeCrop({ zoom, x: (area.x + area.width / 2) / 100, y: (area.y + area.height / 2) / 100 });
}

/** The visible area (percent of the picture, for react-easy-crop's `initialCroppedAreaPercentages`) of a crop, for a picture and a frame of given shapes. */
export function areaForCrop(crop: ClipCrop | null | undefined, mediaAspect: number, frameAspect: number): { x: number; y: number; width: number; height: number } {
  const c = normalizeCrop(crop) ?? NO_CROP;
  const baseW = frameAspect >= mediaAspect ? 1 : frameAspect / mediaAspect;      // share of the picture visible at zoom 1 ("cover")
  const baseH = frameAspect >= mediaAspect ? mediaAspect / frameAspect : 1;
  const width = baseW / c.zoom, height = baseH / c.zoom;
  const x = clamp(c.x - width / 2, 0, 1 - width), y = clamp(c.y - height / 2, 0, 1 - height);
  return { x: x * 100, y: y * 100, width: width * 100, height: height * 100 };
}

/** Pixel rectangle for cropping a still (portraits): clamped inside the picture, whole pixels, never empty. */
export function clampPixelCrop(area: { x: number; y: number; width: number; height: number }, imgW: number, imgH: number): { x: number; y: number; width: number; height: number } {
  const x = clamp(Math.round(num(area.x, 0)), 0, Math.max(0, imgW - 1));
  const y = clamp(Math.round(num(area.y, 0)), 0, Math.max(0, imgH - 1));
  return { x, y, width: clamp(Math.round(num(area.width, imgW)), 1, imgW - x), height: clamp(Math.round(num(area.height, imgH)), 1, imgH - y) };
}

export const ASPECT_CHOICES = [
  { id: '9:16', label: '9:16 vertical', ratio: 9 / 16 },
  { id: '1:1', label: '1:1 square', ratio: 1 },
  { id: '16:9', label: '16:9 wide', ratio: 16 / 9 },
] as const;
