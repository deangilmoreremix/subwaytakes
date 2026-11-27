import { describe, expect, it, vi } from 'vitest';
vi.mock('../supabase', () => ({ supabase: {} }));
import { DEFAULT_TAKE, buildNativePrompt, buildStillPrompt, buildTwoShotStillPrompt, cutsPlan, type TakeSpec } from './index';
import { DEFAULT_LOOK, LOOKS, isLook, lookOf } from './looks';
import { restoreSpec, snapshotSpec } from './snapshot';
import { SHOWS, applyShow } from '../shows';
import { CITIES, DEFAULT_PLACE } from '../places';
import { checkText } from '../safety';

const RULES = { showLocked: () => false, cutsLocked: false } as never;
const spec = (over: Partial<TakeSpec> = {}): TakeSpec => ({ ...DEFAULT_TAKE, ...over });

describe('looks', () => {
  it('the default look changes nothing: prompts are exactly what they were', () => {
    const plain = buildNativePrompt(spec());
    expect(buildNativePrompt(spec({ look: 'documentary' }))).toBe(plain);
    expect(plain).not.toMatch(/Visual style/);
    expect(buildStillPrompt(spec(), 'host')).toMatch(/Handheld documentary framing, natural light, photorealistic/);
    expect(buildTwoShotStillPrompt(spec())).toMatch(/Handheld documentary framing, natural light, photorealistic, no text or watermarks/);
  });
  it('each other look adds its own style sentence to the video prompt and the stills', () => {
    for (const l of LOOKS.filter(l => l.id !== DEFAULT_LOOK)) {
      expect(buildNativePrompt(spec({ look: l.id }))).toContain(l.video);
      expect(buildStillPrompt(spec({ look: l.id }), 'guest')).toContain(l.still);
      expect(buildStillPrompt(spec({ look: l.id }), 'guest')).not.toMatch(/photorealistic,? \w*framing|natural light, photorealistic/);
      expect(buildTwoShotStillPrompt(spec({ look: l.id }))).toContain(l.still);
    }
  });
  it('the one card, the hand-off beats, the no-microphone rule and each city\'s card word survive every look, show and format', () => {
    for (const l of LOOKS) for (const show of SHOWS) for (const c of CITIES.filter(c => c.id !== 'custom')) {
      const s = applyShow(spec({ look: l.id, place: { ...DEFAULT_PLACE, city: c.id } }), show.id);
      const p = buildNativePrompt(s);
      if (show.guests === 1) expect(p).toMatch(/exactly ONE card/);
      expect(p).toMatch(/only microphone/);
      expect(p).not.toMatch(/Both hold/);
      if (c.id !== 'nyc') expect(p).not.toMatch(/MetroCard/);
      expect(checkText(p).ok, `${l.id} ${show.id} ${c.id}`).toBe(true);
      for (const shot of cutsPlan(s)) expect(checkText(shot.portraitPrompt).ok).toBe(true);
    }
  });
  it('no look asks for a real person, a child or a brand', () => {
    for (const l of LOOKS) { expect(checkText(l.video).ok).toBe(true); expect(checkText(l.still).ok).toBe(true); expect(`${l.video} ${l.still}`).not.toMatch(/disney|pixar|ghibli|simpsons|marvel|real person|celebrity/i); }
  });
  it('knows which ids are looks and falls back to documentary', () => {
    expect(isLook('vhs')).toBe(true); expect(isLook('nope')).toBe(false); expect(isLook(5)).toBe(false);
    expect(lookOf('nope').id).toBe('documentary'); expect(lookOf(undefined).id).toBe('documentary');
  });
});

describe('the look is remembered with the episode', () => {
  it('saves and restores a chosen look, and does not store the default', () => {
    const snap = snapshotSpec(spec({ look: 'claymation' }));
    expect(snap.look).toBe('claymation');
    expect(restoreSpec(snap, RULES)?.look).toBe('claymation');
    expect(snapshotSpec(spec()).look).toBeUndefined();
    expect(snapshotSpec(spec({ look: 'documentary' })).look).toBeUndefined();
  });
  it('an unknown or hostile saved look falls back to the default', () => {
    const snap = { ...snapshotSpec(spec()), look: '<script>alert(1)</script>' };
    expect(restoreSpec(snap, RULES)?.look).toBeUndefined();
    expect(restoreSpec({ ...snapshotSpec(spec()), look: 123 as never }, RULES)?.look).toBeUndefined();
  });
});
