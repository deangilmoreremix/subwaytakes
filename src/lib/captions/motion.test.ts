import { describe, expect, it } from 'vitest';
import { UNSUPPORTED_CSS, UNSUPPORTED_TRANSFORM, outlineShadow, wordCss, type WordState } from './motion';
import { CAPTION_PRESETS, styleFromPreset } from './presets';
import { MOTION_ENGINES, type MotionEngine } from './model';

const idle: WordState = { spoken: false, active: false, progress: 0, pop: 0, ease: 0 };
const live: WordState = { spoken: true, active: true, progress: 0.5, pop: 1, ease: 1 };
const past: WordState = { spoken: true, active: false, progress: 1, pop: 1, ease: 1 };
const style = (engine: MotionEngine) => styleFromPreset(CAPTION_PRESETS.find(p => p.style.engine === engine)!.id);

describe('motion engines stay inside what the web renderer supports', () => {
  it.each(MOTION_ENGINES.map(e => e.id))('%s uses only supported CSS in every state', engine => {
    for (const st of [idle, live, past]) {
      const { style: css, fill } = wordCss(style(engine), 1, st);
      for (const bad of UNSUPPORTED_CSS) expect((css as Record<string, unknown>)[bad], `${engine}.${bad}`).toBeUndefined();
      if (css.transform) expect(String(css.transform)).not.toMatch(UNSUPPORTED_TRANSFORM);
      expect(String(css.textShadow ?? '')).not.toMatch(/inset/);
      if (fill) expect(fill.percent).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('what each engine does to a word', () => {
  it('word highlight colours only the spoken word', () => {
    const s = style('word_highlight');
    expect(wordCss(s, 1, live).style.color).toBe(s.colors.highlight); expect(wordCss(s, 1, past).style.color).toBe(s.colors.text); expect(wordCss(s, 1, idle).style.color).toBe(s.colors.text);
  });
  it('light-to-bold presets change weight on the active word', () => {
    const s = styleFromPreset('cinema'); expect(s.weightTo).toBe(900);
    expect(wordCss(s, 1, past).style.fontWeight).toBe(300); expect(wordCss(s, 1, live).style.fontWeight).toBe(900);
  });
  it('karaoke fill wipes: 0 before the word, partial during, full after', () => {
    const s = style('karaoke_fill');
    expect(wordCss(s, 1, idle).fill!.percent).toBe(0); expect(wordCss(s, 1, live).fill!.percent).toBe(50); expect(wordCss(s, 1, past).fill!.percent).toBe(100);
  });
  it('pop-in hides words that have not been spoken and springs the spoken one in', () => {
    const s = style('pop_spring');
    expect(wordCss(s, 1, idle).style.opacity).toBe(0); expect(wordCss(s, 1, live).style.opacity).toBe(1);
    expect(wordCss(s, 1, { ...live, pop: 0 }).style.transform).toBe('scale(0.550)'); expect(wordCss(s, 1, live).style.transform).toBe('scale(1.000)');
  });
  it('elastic bounce starts large on the active word and settles to normal size', () => {
    const s = style('elastic_bounce');
    expect(String(wordCss(s, 1, { ...live, pop: 0 }).style.transform)).toMatch(/^scale\(1\.380\)/); expect(String(wordCss(s, 1, live).style.transform)).toMatch(/^scale\(1\.000\)/); expect(String(wordCss(s, 1, past).style.transform)).toMatch(/^scale\(1\.000\)/);
  });
  it('smooth zoom eases the active word bigger', () => {
    const s = style('smooth_zoom'); expect(wordCss(s, 1, { ...live, ease: 0 }).style.transform).toBe('scale(1.000)'); expect(wordCss(s, 1, live).style.transform).toBe('scale(1.180)'); expect(wordCss(s, 1, past).style.transform).toBe('scale(1.000)');
  });
  it('neon glow adds layered glow only to the active word', () => {
    const s = styleFromPreset('neon_pink');
    const on = String(wordCss(s, 1, live).style.textShadow); expect(on).toMatch(/rgba\(255,79,216,0\.9\)/); expect(on).toMatch(/rgba\(255,79,216,0\.1\)/); expect(on).not.toMatch(/\d\.?\d*px \d\.?\d*px [1-9]\d*px rgba\(255,79,216/);   // rings, never a blur
    expect(String(wordCss(s, 1, past).style.textShadow)).not.toMatch(/rgba\(255,79,216/);
  });
  it('accent box puts a box behind the active word with readable text on it', () => {
    const dark = styleFromPreset('hot_pink'), light = styleFromPreset('paper');
    const a = wordCss(dark, 1, live).style; expect(a.backgroundColor).toBe(dark.colors.box); expect(['#111111', '#ffffff']).toContain(a.color);
    expect(wordCss(light, 1, live).style.color).toBe('#111111'); expect(wordCss(dark, 1, past).style.backgroundColor).toBeUndefined();
  });
});

describe('sizes and outlines', () => {
  it('scales pixel sizes with the frame width', () => {
    const s = style('word_highlight'); expect(wordCss(s, 1, live).style.fontSize).toBe(s.size); expect(wordCss(s, 0.5, live).style.fontSize).toBe(s.size / 2);
  });
  it('draws the outline with offset shadows (no text stroke) and none when the width is 0', () => {
    expect(outlineShadow(6, '#000').length).toBe(9); expect(outlineShadow(0, '#000')).toEqual([]); expect(outlineShadow(6, '#123456')[0]).toContain('#123456');
  });
  it('applies uppercase only when asked', () => { expect(wordCss(style('word_highlight'), 1, live, true).style.textTransform).toBe('uppercase'); expect(wordCss(style('word_highlight'), 1, live, false).style.textTransform).toBeUndefined(); });
});
