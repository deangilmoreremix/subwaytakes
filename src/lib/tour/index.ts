/**
 * World tour: the same question asked in several cities. Only the place changes (each city keeps its OWN card word, station look and locals);
 * the guests are different original characters so five answers do not look like one person. Pure planning; the app runs the episodes through the
 * same loop as a batch and tags the start of each city's clip with its name.
 */
import type { TakeSpec } from '../interview';
import { CITIES, cityOf } from '../places';
import { GUEST_POOL } from '../poll';

export const TOUR_MIN_CITIES = 2;
export const TOUR_MAX_CITIES = 5;
export const TOUR_TAG_FRAMES = 60;   // 2 seconds at 30 fps

/** Cities that can be toured (the free-text "custom" place has no card of its own). */
export const TOUR_CITIES = CITIES.filter(c => c.id !== 'custom');

export function tourProblem(ids: readonly string[]): string | null {
  const known = new Set(TOUR_CITIES.map(c => c.id));
  if (ids.some(id => !known.has(id))) return 'Pick cities from the list.';
  if (new Set(ids).size !== ids.length) return 'Each city can only be visited once.';
  if (ids.length < TOUR_MIN_CITIES) return `A tour needs at least ${TOUR_MIN_CITIES} cities.`;
  if (ids.length > TOUR_MAX_CITIES) return `A tour is at most ${TOUR_MAX_CITIES} cities.`;
  return null;
}

export interface TourStop { cityId: string; label: string; spec: TakeSpec }

/** One spec per city: same question and take, that city's place, a different guest each. NYC-only line and station are dropped elsewhere. */
export function planTour(base: TakeSpec, ids: readonly string[]): TourStop[] {
  if (tourProblem(ids)) return [];
  return ids.map((id, i) => {
    const place = { ...base.place, city: id, mode: 'transit' as const };
    if (id !== 'nyc') { delete place.line; delete place.station; }
    return { cityId: id, label: cityOf(id).label, spec: { ...base, place, guestDescription: GUEST_POOL[i % GUEST_POOL.length] } };
  });
}

/** What the city tag stores on its clip. Re-validated when a project file or an old save is opened. */
export interface CityTag { type: 'city-card'; city: string }

export function normalizeCityTag(raw: unknown): CityTag | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<CityTag>;
  if (r.type !== 'city-card' || typeof r.city !== 'string') return null;
  const city = r.city.replace(/\s+/g, ' ').trim().slice(0, 40);
  return city ? { type: 'city-card', city } : null;
}
