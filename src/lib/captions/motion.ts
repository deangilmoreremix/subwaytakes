import type { CSSProperties } from 'react';
import { readableText } from '../brand/model';
import { nearestWeight } from './fontData';
import type { CaptionStyle, MotionEngine } from './model';

// The look of one caption word for each motion engine, as plain CSS. Pure (no Remotion import) so every engine can be tested for the CSS the
// web renderer supports: no backdrop-filter, no 3D transforms, no inset shadows, no background-clip on text, no -webkit-text-stroke.

export interface WordState {
  /** the word has started being spoken (it stays true afterwards) */
  spoken: boolean;
  /** the word is the one being spoken right now */
  active: boolean;
  /** 0 to 1 through the word's own duration (for the colour wipe) */
  progress: number;
  /** 0 to about 1.1: a spring that starts when the word starts (settles at 1) */
  pop: number;
  /** 0 to 1 over the first few frames of the word (for the smooth zoom) */
  ease: number;
}

const DIRS: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]];

/** An outline made of offset shadows (the renderer has no text-stroke). */
export function outlineShadow(width: number, color: string): string[] {
  if (width <= 0) return [];
  const w = Math.max(1, Math.round(width));
  return [...DIRS.map(([x, y]) => `${(x * w).toFixed(1)}px ${(y * w).toFixed(1)}px 0 ${color}`), `0 ${Math.round(w * 0.6)}px ${Math.round(w * 1.2)}px rgba(0,0,0,0.45)`];
}

/** The web renderer does not draw blurred text shadows, so a glow is built from stepped halo rings of the colour that get fainter outwards. */
const hexAlpha = (hex: string, a: number): string => { const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex); return m ? `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${a})` : hex; };
export const GLOW_RINGS: Array<[number, number]> = [[3, 0.9], [6, 0.65], [10, 0.45], [15, 0.3], [21, 0.18], [28, 0.1]];
export function glow(color: string, k: number): string[] {
  const out: string[] = [];
  for (const [r, a] of GLOW_RINGS) for (const [x, y] of DIRS) out.push(`${(x * r * k).toFixed(1)}px ${(y * r * k).toFixed(1)}px 0 ${hexAlpha(color, a)}`);
  return out;
}

export interface WordCss { style: CSSProperties; /** karaoke only: the highlight layer that is clipped to `fill` percent of the word's width */ fill?: { percent: number; color: string } }

/** CSS for a word. `k` scales pixel sizes from the 1080-wide design to the real frame width. */
export function wordCss(style: CaptionStyle, k: number, st: WordState, upper = false): WordCss {
  const engine: MotionEngine = style.engine;
  const size = style.size * k;
  const weight = nearestWeight(style.font, style.weight);
  const weightActive = style.weightTo ? nearestWeight(style.font, style.weightTo) : weight;
  const { text, highlight, outline, box } = style.colors;
  const shadows = outlineShadow(style.outlineWidth * k, outline);
  const base: CSSProperties = { display: 'inline-block', position: 'relative', fontSize: size, lineHeight: 1.12, fontWeight: weight, color: text, textShadow: shadows.join(', ') || undefined, padding: `0 ${(size * 0.07).toFixed(1)}px`, whiteSpace: 'pre', textTransform: upper ? 'uppercase' : undefined };
  const active = st.active;

  switch (engine) {
    case 'word_highlight':
      return { style: { ...base, color: active ? highlight : text, fontWeight: active ? weightActive : weight } };
    case 'karaoke_fill': {
      const percent = st.spoken ? (active ? Math.min(100, Math.max(0, st.progress * 100)) : 100) : 0;
      return { style: { ...base, fontWeight: weightActive }, fill: { percent, color: highlight } };
    }
    case 'pop_spring': {
      const s = st.spoken ? 0.55 + 0.45 * st.pop : 0.55;
      return { style: { ...base, color: active ? highlight : text, fontWeight: active ? weightActive : weight, opacity: st.spoken ? 1 : 0, transform: `scale(${s.toFixed(3)})` } };
    }
    case 'elastic_bounce': {
      const s = active ? 1 + 0.38 * (1 - st.pop) : 1;
      return { style: { ...base, color: active ? highlight : text, fontWeight: active ? weightActive : weight, transform: `scale(${s.toFixed(3)}) translateY(${(active ? (1 - st.pop) * -0.12 * size : 0).toFixed(1)}px)` } };
    }
    case 'smooth_zoom': {
      const s = active ? 1 + 0.18 * st.ease : 1;
      return { style: { ...base, color: active ? highlight : text, fontWeight: active ? weightActive : weight, transform: `scale(${s.toFixed(3)})` } };
    }
    case 'neon_glow':
      return { style: { ...base, color: active ? '#ffffff' : text, fontWeight: active ? weightActive : weight, textShadow: [...shadows, ...(active ? glow(highlight, k) : [])].join(', ') || undefined } };
    case 'accent_box': {
      const onBox = readableText(box);
      return active
        ? { style: { ...base, color: onBox, backgroundColor: box, borderRadius: size * 0.2, padding: `0 ${(size * 0.2).toFixed(1)}px`, textShadow: undefined, fontWeight: weightActive } }
        : { style: { ...base, padding: `0 ${(size * 0.2).toFixed(1)}px` } };
    }
  }
}

/** CSS properties that the web renderer does not support. Used by the tests to keep every engine inside the supported subset. */
export const UNSUPPORTED_CSS = ['backdropFilter', 'WebkitBackdropFilter', 'WebkitTextStroke', 'WebkitTextStrokeWidth', 'WebkitBackgroundClip', 'backgroundClip', 'perspective', 'filter', 'mixBlendMode', 'clipPath'] as const;
export const UNSUPPORTED_TRANSFORM = /rotate[XYZ]|translate3d|rotate3d|scale3d|perspective|matrix3d/;
