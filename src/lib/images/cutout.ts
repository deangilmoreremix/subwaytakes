/**
 * Background removal, pure maths (no DOM): turn a person mask into a cut-out over a chosen background.
 * The mask comes from an on-device segmentation model (see cutoutBrowser.ts); everything here is plain arrays so it can be tested in Node.
 */

export type Background =
  | { kind: 'transparent' }
  | { kind: 'color'; rgb: [number, number, number] }
  /** the original picture, blurred (made by the caller), used as the background */
  | { kind: 'blur'; rgba: Uint8ClampedArray };

export const BACKGROUND_CHOICES = [
  { id: 'transparent', label: 'Transparent' },
  { id: 'white', label: 'White', rgb: [255, 255, 255] as [number, number, number] },
  { id: 'grey', label: 'Soft grey', rgb: [226, 228, 232] as [number, number, number] },
  { id: 'subway', label: 'Subway yellow', rgb: [255, 176, 0] as [number, number, number] },
  { id: 'blur', label: 'Blurred original' },
] as const;
export type BackgroundId = (typeof BACKGROUND_CHOICES)[number]['id'];

/** Largest side we work at: a portrait does not need more, and a phone cannot segment a huge photo quickly. */
export const MAX_CUTOUT_SIDE = 1280;

/** Scale (w, h) down so the longer side is at most `max`. Never scales up. */
export function fitCutoutSize(w: number, h: number, max = MAX_CUTOUT_SIDE): { width: number; height: number } {
  if (!(w > 0) || !(h > 0)) return { width: 0, height: 0 };
  const k = Math.min(1, max / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) };
}

/** Fraction of pixels the model is sure are the person (confidence above one half). */
export function maskCoverage(mask: ArrayLike<number>): number {
  if (!mask.length) return 0;
  let n = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i] > 0.5) n++;
  return n / mask.length;
}

/** A readable reason when the mask cannot be a person cut-out (nobody found, or the whole picture is "person"). Null when it looks usable. */
export function cutoutProblem(coverage: number): string | null {
  if (!(coverage >= 0.03)) return 'No person was found in this picture. Try a clearer photo of one person.';
  if (coverage > 0.97) return 'The whole picture looks like one person, so there is no background to remove.';
  return null;
}

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Box-blur a mask a few pixels so the cut-out edge is soft, not jagged. radius 0 returns the mask unchanged. */
export function feather(mask: Float32Array, w: number, h: number, radius: number): Float32Array {
  const r = Math.max(0, Math.floor(radius));
  if (r === 0) return mask;
  const tmp = new Float32Array(mask.length), out = new Float32Array(mask.length);
  const win = 2 * r + 1;
  for (let y = 0; y < h; y++) {          // horizontal pass
    let sum = 0;
    for (let x = -r; x <= r; x++) sum += mask[y * w + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = sum / win;
      sum += mask[y * w + Math.min(w - 1, x + r + 1)] - mask[y * w + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {          // vertical pass
    let sum = 0;
    for (let y = -r; y <= r; y++) sum += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum / win;
      sum += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

/**
 * Composite the person over the background. `mask` is the person confidence (0 to 1) per pixel, same size as the picture.
 * The edge is softened (smoothstep between 0.35 and 0.65 after a small feather). Returns a new RGBA array.
 */
export function applyMask(rgba: Uint8ClampedArray, mask: Float32Array, w: number, h: number, bg: Background, featherRadius = 2): Uint8ClampedArray {
  if (rgba.length !== w * h * 4 || mask.length !== w * h) throw new Error('The picture and the mask are not the same size.');
  if (bg.kind === 'blur' && bg.rgba.length !== rgba.length) throw new Error('The blurred background is not the same size as the picture.');
  const m = feather(mask, w, h, featherRadius);
  const out = new Uint8ClampedArray(rgba.length);
  for (let i = 0, p = 0; i < m.length; i++, p += 4) {
    const a = smooth(0.35, 0.65, m[i]);                       // 0 = background, 1 = person
    if (bg.kind === 'transparent') {
      out[p] = rgba[p]; out[p + 1] = rgba[p + 1]; out[p + 2] = rgba[p + 2]; out[p + 3] = Math.round(a * rgba[p + 3]);
    } else {
      const br = bg.kind === 'color' ? bg.rgb[0] : bg.rgba[p], bgG = bg.kind === 'color' ? bg.rgb[1] : bg.rgba[p + 1], bb = bg.kind === 'color' ? bg.rgb[2] : bg.rgba[p + 2];
      out[p] = Math.round(rgba[p] * a + br * (1 - a)); out[p + 1] = Math.round(rgba[p + 1] * a + bgG * (1 - a)); out[p + 2] = Math.round(rgba[p + 2] * a + bb * (1 - a)); out[p + 3] = 255;
    }
  }
  return out;
}
