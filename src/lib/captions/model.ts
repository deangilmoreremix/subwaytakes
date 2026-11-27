// Caption data model (pure). Word timings are in FRAMES relative to the start of the caption clip they belong to, so moving or trimming a
// clip on the timeline never needs the words rewritten.

export interface CaptionWord { t: string; s: number; e: number }

/** The seven ways a caption moves. Each is a Remotion component using only CSS the web renderer supports. */
export type MotionEngine = 'word_highlight' | 'karaoke_fill' | 'pop_spring' | 'elastic_bounce' | 'smooth_zoom' | 'neon_glow' | 'accent_box';

export const MOTION_ENGINES: Array<{ id: MotionEngine; label: string; blurb: string }> = [
  { id: 'word_highlight', label: 'Word Highlight', blurb: 'The spoken word changes colour' },
  { id: 'karaoke_fill', label: 'Karaoke Fill', blurb: 'Colour wipes across each word' },
  { id: 'pop_spring', label: 'Pop-In / Spring', blurb: 'Each word springs in' },
  { id: 'elastic_bounce', label: 'Elastic Bounce', blurb: 'The active word bounces' },
  { id: 'smooth_zoom', label: 'Smooth Zoom', blurb: 'The active word eases bigger' },
  { id: 'neon_glow', label: 'Neon Glow', blurb: 'The active word glows' },
  { id: 'accent_box', label: 'Accent Box', blurb: 'A colour box follows the word' },
];

export type FontKey =
  | 'inter' | 'anton' | 'bangers' | 'montserrat' | 'poppins' | 'bebas' | 'oswald' | 'marker' | 'firacode' | 'playfair' | 'archivoblack' | 'lilita'
  | 'noto_jp' | 'noto_kr' | 'noto_sc' | 'noto_arabic' | 'noto_devanagari' | 'noto_thai' | 'noto_hebrew';

export type PresetCategory = 'Trending' | 'Clean & Tech' | 'Editorial & Film' | 'Pop & Expressive';

export interface CaptionColors { text: string; highlight: string; outline: string; box: string }

/** What a customer picks and tunes. A preset fills all of it; every field can then be changed. */
export interface CaptionStyle {
  presetId: string;
  engine: MotionEngine;
  font: FontKey;
  weight: number;
  /** when set, the active word moves from `weight` to this weight (for example light to bold) */
  weightTo?: number;
  /** font size in pixels on a 1080-wide frame */
  size: number;
  uppercase: boolean;
  colors: CaptionColors;
  /** outline width in pixels on a 1080-wide frame */
  outlineWidth: number;
  /** distance of the caption block from the bottom, as a percentage of the frame height (5 to 90) */
  positionY: number;
  /** most words on a line */
  maxWords: number;
  /** language code, or 'auto' */
  language: string;
}

export const POSITION_MIN = 5;
export const POSITION_MAX = 90;
export const clampPosition = (n: number): number => Math.min(POSITION_MAX, Math.max(POSITION_MIN, Math.round(n)));

/** Frames per 0.1 second at 30 fps; the editor's timing nudge. */
export const NUDGE_FRAMES = 3;
