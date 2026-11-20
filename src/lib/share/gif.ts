/**
 * Share pictures from an exported episode: a poster image and a short looping GIF teaser. Pure planning here (which moments, how big),
 * the browser work is in gifBrowser.ts.
 */
export const GIF_MAX_SECONDS = 3;
export const GIF_FPS = 10;
export const GIF_WIDTH = 480;
/** A GIF this big is too heavy to post or message; ask for a shorter or smaller one. */
export const GIF_MAX_BYTES = 8 * 1024 * 1024;

export interface GifPlan { times: number[]; fps: number; width: number; height: number; delayMs: number }

/** Where the teaser starts: a little in, so it skips a black first frame, but early enough that short clips still have material. */
export function teaserStart(durationSec: number): number {
  if (!(durationSec > 0)) return 0;
  return Math.min(Math.max(0, durationSec * 0.1), Math.max(0, durationSec - 0.5));
}

/** The best single moment for a poster image: a bit into the clip (past the title animation), never at the very end. */
export function posterTime(durationSec: number): number {
  if (!(durationSec > 0)) return 0;
  return Math.min(durationSec * 0.35, Math.max(0, durationSec - 0.1));
}

/**
 * Frame times for a teaser of at most GIF_MAX_SECONDS, at GIF_FPS, with the picture scaled to `width` (even numbers, same shape).
 * A video shorter than the teaser gives a GIF of its whole length.
 */
export function gifPlan(durationSec: number, videoW: number, videoH: number, opts: { maxSeconds?: number; fps?: number; width?: number } = {}): GifPlan {
  const fps = Math.max(1, Math.min(20, Math.round(opts.fps ?? GIF_FPS)));
  const maxSeconds = Math.max(0.5, opts.maxSeconds ?? GIF_MAX_SECONDS);
  const width = Math.max(64, Math.min(1080, Math.round((opts.width ?? GIF_WIDTH) / 2) * 2));
  if (!(durationSec > 0) || !(videoW > 0) || !(videoH > 0)) return { times: [], fps, width, height: 0, delayMs: Math.round(1000 / fps) };
  const start = teaserStart(durationSec);
  const length = Math.min(maxSeconds, Math.max(0.1, durationSec - start));
  const count = Math.max(1, Math.floor(length * fps));
  const times = Array.from({ length: count }, (_, i) => Math.min(durationSec - 0.05, start + i / fps));
  const height = Math.max(2, Math.round((width * videoH / videoW) / 2) * 2);
  return { times, fps, width, height, delayMs: Math.round(1000 / fps) };
}

/** A rough upper estimate of the file size, from how GIF frames of photographic video usually compress (about 0.35 bytes per pixel per frame). */
export function estimateGifBytes(plan: Pick<GifPlan, 'times' | 'width' | 'height'>): number {
  return Math.round(plan.times.length * plan.width * plan.height * 0.35);
}

export function gifProblem(plan: GifPlan): string | null {
  if (!plan.times.length || !plan.height) return 'There is nothing to make a GIF from yet.';
  if (estimateGifBytes(plan) > GIF_MAX_BYTES) return 'That GIF would be too big to share. Use a shorter or smaller one.';
  return null;
}

export const shareFileName = (kind: 'poster' | 'gif', stamp = Date.now()): string => `subwaytakes-${kind}-${stamp}.${kind === 'gif' ? 'gif' : 'png'}`;
