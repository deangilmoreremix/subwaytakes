import { describe, expect, it } from 'vitest';
import { TOUR_CITIES, TOUR_MAX_CITIES, normalizeCityTag, planTour, tourProblem } from './index';
import { DEFAULT_TAKE, buildNativePrompt } from '../interview';
import { cityOf } from '../places';
import { checkText } from '../safety';

describe('world tour planning', () => {
  it('refuses too few, too many, repeated and unknown cities', () => {
    expect(tourProblem(['nyc'])).toMatch(/at least/);
    expect(tourProblem(['nyc', 'nyc'])).toMatch(/once/);
    expect(tourProblem(['nyc', 'atlantis'])).toMatch(/list/);
    expect(tourProblem(['nyc', 'custom'])).toMatch(/list/);
    expect(tourProblem(TOUR_CITIES.slice(0, TOUR_MAX_CITIES + 1).map(c => c.id))).toMatch(/at most/);
    expect(tourProblem(['nyc', 'london'])).toBeNull();
    expect(planTour(DEFAULT_TAKE, ['nyc'])).toEqual([]);
  });
  const ids = TOUR_CITIES.slice(0, 5).map(c => c.id);
  const stops = planTour({ ...DEFAULT_TAKE, take: 'Pineapple belongs on pizza' }, ids);
  it('keeps the take and changes only the place and guest', () => {
    expect(stops).toHaveLength(5);
    for (const s of stops) { expect(s.spec.take).toBe('Pineapple belongs on pizza'); expect(s.spec.place.city).toBe(s.cityId); }
    expect(new Set(stops.map(s => s.spec.guestDescription)).size).toBe(5);
  });
  it('every stop uses its own card word and never another city\'s', () => {
    for (const s of stops) {
      const p = buildNativePrompt(s.spec);
      expect(p).toContain(cityOf(s.cityId).card);
      for (const other of TOUR_CITIES) if (other.id !== s.cityId && other.card !== cityOf(s.cityId).card && !/^transit card$/i.test(other.card)) expect(p, `${s.cityId} mentions ${other.card}`).not.toContain(other.card);
      if (s.cityId !== 'nyc') expect(p).not.toContain('MetroCard');
      expect(p).toMatch(/exactly ONE card/);
      expect(checkText(p).ok).toBe(true);
    }
  });
  it('drops the New York line and station outside New York', () => {
    const s = planTour({ ...DEFAULT_TAKE, place: { ...DEFAULT_TAKE.place, line: 'A', station: 'Times Square' } }, ['london', 'nyc']);
    expect(s[0].spec.place.line).toBeUndefined(); expect(s[0].spec.place.station).toBeUndefined();
    expect(s[1].spec.place.line).toBe('A');
  });
  it('validates the city tag', () => {
    expect(normalizeCityTag({ type: 'city-card', city: '  London ' })).toEqual({ type: 'city-card', city: 'London' });
    expect(normalizeCityTag({ type: 'city-card', city: '   ' })).toBeNull();
    expect(normalizeCityTag({ type: 'city-card', city: 5 })).toBeNull();
    expect(normalizeCityTag({ type: 'city-card', city: 'x'.repeat(100) })?.city).toHaveLength(40);
    expect(normalizeCityTag(null)).toBeNull();
  });
});
