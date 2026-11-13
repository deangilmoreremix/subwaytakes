import { describe, expect, it } from 'vitest';
import { CITIES, DEFAULT_PLACE } from '../places';
import { DEFAULT_TAKE, buildNativePrompt, buildStillPrompt, cutsPlan, cutsProblem, spokenLines, titleLines, wordBudget, type TakeSpec } from './index';

const spec = (p: Partial<TakeSpec> = {}): TakeSpec => ({ ...DEFAULT_TAKE, ...p });

describe('two-shot prompt (the real SubwayTakes format)', () => {
  const out = buildNativePrompt(spec());
  it('is a two-shot of host and guest side by side', () => {
    expect(out).toMatch(/two-shot/);
    expect(out).toContain(DEFAULT_TAKE.hostDescription);
    expect(out).toContain(DEFAULT_TAKE.guestDescription);
    expect(out).toMatch(/shoulder to shoulder/);
    expect(out).toMatch(/motion-blurred/);
  });
  it('uses the card as the only microphone, held by both', () => {
    expect(out).toMatch(/Both hold/);
    expect(out).toMatch(/only microphone/);
    expect(out).toMatch(/no real microphone/);
    expect(out).not.toMatch(/mic clipped|clipped onto/i);
  });
  it('labels who speaks what', () => {
    expect(out).toContain('The host, card at their mouth, asks the guest: "So what\'s ur take?"');
    expect(out).toContain(DEFAULT_TAKE.take.slice(0, 20));
  });
});

describe('cards and content follow the city', () => {
  it('every city puts its own card and local content in the two-shot', () => {
    for (const c of CITIES.filter(c => c.id !== 'generic' && c.id !== 'custom')) {
      const out = buildNativePrompt(spec({ place: { ...DEFAULT_PLACE, city: c.id } }));
      expect(out, c.id).toContain(c.card);
      expect(out, c.id).toContain(c.stations[0]);
      expect(out, c.id).toContain(c.locals);
    }
  });
  it('London shows an Oyster card and no MetroCard', () => {
    const out = buildNativePrompt(spec({ place: { ...DEFAULT_PLACE, city: 'london' } }));
    expect(out).toContain('Oyster');
    expect(out).not.toContain('MetroCard');
  });
});

describe('solo and stills', () => {
  it('solo keeps the host off camera and fixes the old mic wording', () => {
    const out = buildNativePrompt(spec({ format: 'solo' }));
    expect(out).toMatch(/host's hand holds/);
    expect(out).toMatch(/only microphone/);
  });
  it('stills show a card at the mouth', () => {
    expect(buildStillPrompt(spec(), 'host')).toMatch(/held up to the mouth/);
    expect(buildStillPrompt(spec(), 'guest')).toContain(DEFAULT_TAKE.guestDescription);
  });
});

describe('speech fitting', () => {
  it('trims the guest line to the clip length', () => {
    const long = Array.from({ length: 60 }, (_, i) => `w${i}`).join(' ');
    const s = spokenLines({ take: long, durationSeconds: 8 });
    expect(s.guest.split(' ').length).toBe(wordBudget(8, true));
    expect(s.trimmed).toBe(true);
    expect(spokenLines({ take: 'Short take here ok', durationSeconds: 8 }).trimmed).toBe(false);
  });
});

describe('cuts', () => {
  it('plans host then guest', () => {
    const plan = cutsPlan(spec());
    expect(plan.map(p => p.role)).toEqual(['host', 'guest']);
    expect(plan[0].text).toBe("So what's ur take?");
  });
  it('requires portraits and voices', () => {
    expect(cutsProblem(undefined, undefined)).toMatch(/Pick a host/);
    expect(cutsProblem({ portrait_url: 'x', voice_id: null }, { portrait_url: 'y', voice_id: 'v' })).toMatch(/host needs/);
    expect(cutsProblem({ portrait_url: 'x', voice_id: 'v' }, { portrait_url: null, voice_id: 'v' })).toMatch(/guest needs/);
    expect(cutsProblem({ portrait_url: 'x', voice_id: 'v' }, { portrait_url: 'y', voice_id: 'v' })).toBeNull();
  });
});

describe('title lines', () => {
  it('wraps the take into short lines', () => {
    expect(titleLines('Leggings should not be pants')).toEqual(['Leggings should', 'not be pants']);
    expect(titleLines('')).toEqual([]);
  });
});
