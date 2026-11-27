import { describe, expect, it } from 'vitest';
import { CITIES } from '../places';
import { cityLocked, FEATURES, formatPrice, FREE_CITIES, hasFeature, showLocked } from './features';
import { SHOWS } from '../shows';
import { requiredEntitlements } from '../../../supabase/functions/_shared/entitlements';
import { LIPSYNC_MODELS, NATIVE_MODELS, RECAST, STILL_MODELS, TTS_MODELS } from '../muapi/registry';
import { TTS_SLUG } from '../muapi/voices';
import { VOICE_LIPSYNC_MODELS } from '../recast/voice';

describe('feature locks', () => {
  it('nothing is unlocked without a purchase, and each pack unlocks what it says', () => {
    expect(hasFeature('cuts', [])).toBe(false);
    expect(hasFeature('cuts', ['pro_pack'])).toBe(true);
    expect(hasFeature('recast', ['pro_pack'])).toBe(false);
    expect(hasFeature('recast', ['recast'])).toBe(true);
    expect(hasFeature('voices', ['recast'])).toBe(true); // the Recast voice stage needs voices too
    expect(hasFeature('happiness', ['recast'])).toBe(false);
    expect(hasFeature('happiness', ['happiness'])).toBe(true);
  });
  it('the starter cities are free and every other real city needs the Pro Pack', () => {
    for (const id of FREE_CITIES) expect(CITIES.some(c => c.id === id)).toBe(true);
    for (const c of CITIES) expect(cityLocked(c.id, [])).toBe(!FREE_CITIES.includes(c.id));
    expect(cityLocked('berlin', ['pro_pack'])).toBe(false);
    expect(CITIES.filter(c => cityLocked(c.id, [])).length).toBeGreaterThanOrEqual(20);
  });
  it('only the pack shows are locked, each by its own pack, and they are real shows', () => {
    const PACK: Record<string, string> = { happiness: 'happiness', bible: 'bible', motivation: 'motivation' };
    for (const id of Object.keys(PACK)) expect(SHOWS.some(s => s.id === id)).toBe(true);
    for (const s of SHOWS) expect(showLocked(s.id, [])).toBe(s.id in PACK);
    for (const [show, key] of Object.entries(PACK)) { expect(showLocked(show, [key])).toBe(false); for (const other of Object.values(PACK).filter(k => k !== key)) expect(showLocked(show, [other])).toBe(true); }
  });
  it('every feature points at a product key the seeded catalogue has', () => {
    const seeded = ['starter', 'credits_s', 'credits_m', 'credits_l', 'pro_pack', 'recast_happiness', 'commercial', 'bible_pack', 'motivation_pack'];
    for (const f of Object.values(FEATURES)) expect(seeded).toContain(f.product);
  });
  it('the app-side feature keys match what the gateway enforces for the same models', () => {
    // Cuts/voices lip-sync and TTS, and Recast models, must be gated on the server by keys the UI also checks.
    expect(requiredEntitlements('omnihuman-2-0')).toEqual(FEATURES.cuts.needs);
    expect(requiredEntitlements('elevenlabs-tts-turbo-2-5')).toEqual(FEATURES.voices.needs);
    expect(requiredEntitlements('wan3.0-reference-to-video')).toEqual(FEATURES.recast.needs);
    expect(requiredEntitlements('seedance-2.5-omni-reference')).toEqual(FEATURES.recast.needs);
  });
  it('ordinary native video and still models are not gated on the server', () => {
    for (const slug of [...NATIVE_MODELS.map(m => m.slug), ...STILL_MODELS.map(m => m.slug), 'gpt-image-2-image-to-image']) expect(requiredEntitlements(slug)).toBeNull();
  });
  it('every paid-pack model the app can call is gated by the server (a new lip-sync/voice/recast model must be added to entitlements.ts)', () => {
    const talking = [...LIPSYNC_MODELS.map(m => m.slug), ...TTS_MODELS.map(m => m.slug), ...Object.values(TTS_SLUG), ...VOICE_LIPSYNC_MODELS.map(m => m.slug)];
    const recast = [RECAST.depth, RECAST.vision, RECAST.cleanFrames, RECAST.render.full, RECAST.render.lite];
    for (const slug of [...talking, ...recast]) expect(requiredEntitlements(slug), slug).not.toBeNull();
  });
  it('formats prices', () => { expect(formatPrice(3700)).toBe('$37'); expect(formatPrice(999)).toBe('$9.99'); });
});
