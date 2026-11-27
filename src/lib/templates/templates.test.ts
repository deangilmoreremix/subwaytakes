import { describe, expect, it } from 'vitest';
import { TEMPLATES, applyTemplate, templateNeeds } from './index';
import { CITIES, CROWDS, SCENES, TIMES } from '../places';
import { showOf, SHOWS } from '../shows';
import { DEFAULT_TAKE } from '../interview';
import { FONT_IDS } from '../captions/fonts';
import { cityOf } from '../places';

describe('templates', () => {
  it('has unique ids and every field points at something real', () => {
    expect(new Set(TEMPLATES.map(t => t.id)).size).toBe(TEMPLATES.length);
    for (const t of TEMPLATES) {
      expect(SHOWS.some(s => s.id === t.show), t.id).toBe(true);
      expect(showOf(t.show).tones, t.id).toContain(t.tone);
      expect(showOf(t.show).guests, `${t.id}: duels need two guests, templates stay one-guest`).toBe(1);
      expect(['twoshot', 'cuts', 'solo']).toContain(t.format);
      expect(FONT_IDS).toContain(t.captionFont);
      expect(t.durationSeconds).toBeGreaterThanOrEqual(4); expect(t.durationSeconds).toBeLessThanOrEqual(15);
      if (t.place.city) expect(CITIES.some(c => c.id === t.place.city), t.id).toBe(true);
      if (t.place.scene) expect(SCENES.some(s => s.id === t.place.scene), t.id).toBe(true);
      if (t.place.time) expect(TIMES.some(s => s.id === t.place.time), t.id).toBe(true);
      if (t.place.crowd) expect(CROWDS.some(s => s.id === t.place.crowd), t.id).toBe(true);
    }
  });
  it('applies the show, the place and the look without inventing a take', () => {
    const t = TEMPLATES.find(x => x.id === 'london_deadpan')!;
    const r = applyTemplate({ ...DEFAULT_TAKE, take: 'My own words' }, t);
    expect(r.spec.take).toBe('My own words');                 // the customer's take is never overwritten
    expect(r.spec.place.city).toBe('london'); expect(cityOf(r.spec.place.city).card).not.toMatch(/metrocard/i);
    expect(r.spec.tone).toBe('deadpan'); expect(r.spec.show).toBe('hot_take'); expect(r.spec.format).toBe('twoshot'); expect(r.captionFont).toBe('anton');
  });
  it('every template can be applied to a fresh spec and yields a valid spec', () => {
    for (const t of TEMPLATES) {
      const { spec } = applyTemplate(DEFAULT_TAKE, t);
      expect(spec.show).toBe(t.show); expect(showOf(spec.show).tones).toContain(spec.tone); expect(spec.take.trim().length).toBeGreaterThan(0);
    }
  });
  it('says which pack a template needs', () => {
    const happy = TEMPLATES.find(t => t.show === 'happiness')!;
    expect(templateNeeds(happy, [])).toContain('happiness'); expect(templateNeeds(happy, ['happiness'])).toEqual([]);
    const paris = TEMPLATES.find(t => t.place.city === 'paris')!; expect(templateNeeds(paris, [])).toEqual([]);   // starter city
    expect(templateNeeds(TEMPLATES.find(t => t.id === 'rush_hour_take')!, [])).toEqual([]);
  });
});
