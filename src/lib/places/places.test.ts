import { describe, expect, it } from 'vitest';
import { AMBIENCE, CITIES, CROWDS, DEFAULT_PLACE, NEIGHBORHOODS, NYC_LINES, SCENES, STREET_SCENES, TIMES, cardFor, cardMicPhrase, placeLabel, placePrompt, stationsFor, type CityId } from './index';

describe('places', () => {
  it('restores all the legacy catalogue sizes', () => {
    expect(CITIES.map(c => c.id).slice(0, 4)).toEqual(['nyc', 'london', 'tokyo', 'paris']);
    expect(TIMES).toHaveLength(9);
    expect(NYC_LINES.length).toBeGreaterThanOrEqual(22);
    expect(NEIGHBORHOODS).toHaveLength(7);
    expect(STREET_SCENES).toHaveLength(6);
    expect(SCENES.length).toBeGreaterThanOrEqual(7);
    expect(AMBIENCE).toHaveLength(6);
    expect(CROWDS).toHaveLength(3);
  });

  it('has at least 20 real cities, each with its own card and local content', () => {
    const real = CITIES.filter(c => c.id !== 'generic' && c.id !== 'custom');
    expect(real.length).toBeGreaterThanOrEqual(20);
    expect(new Set(real.map(c => c.id)).size).toBe(real.length);
    expect(new Set(real.map(c => c.card)).size).toBe(real.length); // no two cities share a card
    for (const c of real) {
      expect(c.stations.length, c.id).toBeGreaterThanOrEqual(4);
      expect(c.locals.length, c.id).toBeGreaterThan(20);
      expect(c.cardLook, c.id).toMatch(/no logo/);
      const out = placePrompt({ ...DEFAULT_PLACE, city: c.id, scene: 'platform' });
      expect(out, c.id).toContain(c.look);
      expect(out, c.id).toContain(c.stations[0]);
      expect(out, c.id).toContain(c.locals);
      expect(cardMicPhrase(c.id)).toContain(c.card);
    }
  });

  it('never leaks another city\'s card or stations into a prompt', () => {
    const real = CITIES.filter(c => c.id !== 'generic' && c.id !== 'custom');
    for (const c of real) {
      const out = placePrompt({ ...DEFAULT_PLACE, city: c.id });
      for (const o of real) if (o.id !== c.id && !c.card.includes(o.card)) expect(out, `${c.id} has ${o.id} card`).not.toContain(o.card);
    }
  });

  it('each city has its own card and never another city\'s', () => {
    const cards: Partial<Record<CityId, string>> = { nyc: 'MetroCard', london: 'Oyster', tokyo: 'Suica', paris: 'Navigo' };
    for (const [id, word] of Object.entries(cards)) {
      const phrase = cardMicPhrase(id as CityId);
      expect(phrase).toContain(word);
      for (const other of Object.values(cards)) if (other !== word) expect(phrase).not.toContain(other);
    }
    expect(cardFor('generic')).toBe('transit card');
  });

  it('every scene and time produces a non-empty prompt in every city', () => {
    for (const c of CITIES) for (const s of SCENES) for (const t of TIMES) {
      const out = placePrompt({ ...DEFAULT_PLACE, city: c.id, scene: s.id, time: t.id, custom: c.id === 'custom' ? 'a ferry' : undefined });
      expect(out.length).toBeGreaterThan(40);
    }
  });

  it('uses the city\'s own train interior when on the train', () => {
    expect(placePrompt({ ...DEFAULT_PLACE, city: 'london' })).toContain('moquette');
    expect(placePrompt({ ...DEFAULT_PLACE, city: 'tokyo' })).toContain('hand straps');
    expect(placePrompt({ ...DEFAULT_PLACE, city: 'nyc' })).toContain('blue plastic');
    expect(placePrompt({ ...DEFAULT_PLACE, city: 'london', scene: 'platform' })).toContain('Mind the Gap');
  });

  it('custom text replaces the setting for custom city and is appended otherwise', () => {
    const custom = placePrompt({ ...DEFAULT_PLACE, city: 'custom', custom: 'a night ferry crossing' });
    expect(custom).toContain('a night ferry crossing');
    expect(custom).not.toContain('New York');
    expect(placePrompt({ ...DEFAULT_PLACE, custom: 'a busker plays nearby' })).toContain('a busker plays nearby');
  });

  it('adds the NYC line and station only for NYC', () => {
    const nyc = placePrompt({ ...DEFAULT_PLACE, line: 'L', station: 'Bedford Ave' });
    expect(nyc).toContain('L train');
    expect(nyc).toContain('Bedford Ave');
    expect(placePrompt({ ...DEFAULT_PLACE, city: 'paris', line: 'L' })).not.toContain('L train');
    expect(placePrompt({ ...DEFAULT_PLACE, city: 'tokyo' })).toContain('Shibuya');
    expect(stationsFor('nyc', 'L')).toContain('Bedford Ave');
    expect(stationsFor('london')).toContain('Waterloo');
  });

  it('supports street mode', () => {
    const out = placePrompt({ ...DEFAULT_PLACE, mode: 'street', streetScene: 'park_bench', neighborhood: 'harlem' });
    expect(out).toContain('park bench');
    expect(out).toContain('Harlem');
    expect(placeLabel({ ...DEFAULT_PLACE, mode: 'street', streetScene: 'crosswalk' })).toBe('Street · Crosswalk');
  });

  it('labels and ambience', () => {
    expect(placeLabel({ ...DEFAULT_PLACE, city: 'tokyo', scene: 'platform' })).toBe('Tokyo · Platform');
    expect(placePrompt({ ...DEFAULT_PLACE, ambience: ['announcements', 'footsteps'] })).toContain('muffled station announcements, echoing footsteps');
  });
});
