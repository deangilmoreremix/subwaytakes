/**
 * Places: where an episode is set (city, scene, time of day, crowd, sound).
 * Ported from the legacy constants/promptEngine so nothing is lost, with two fixes:
 *  - every city has its OWN transit card (the old code hard-coded "MetroCard" in places)
 *  - every city has its own train-car interior (the old code only had NYC's)
 * London/Tokyo/Paris interiors and the card visuals are authored here from general
 * knowledge, not from the legacy app: review them.
 */
import { NYC_LINES, NYC_STATIONS } from './nycLines';
import { CITIES, type City } from './cities';

export { NYC_LINES, NYC_STATIONS };

export type CityId = string;
export type SceneId =
  | 'train_seated' | 'train_standing' | 'platform' | 'train_arriving' | 'rush_hour'
  | 'late_night' | 'walking' | 'escalator' | 'station_entrance' | 'tunnel';
export type TimeId =
  | 'early_morning' | 'morning_rush' | 'midday' | 'evening_rush' | 'late_night'
  | 'weekend' | 'golden_hour' | 'dusk' | 'night';
export type CrowdId = 'sparse' | 'moderate' | 'dense';
export type AmbienceId = 'train_rumble' | 'announcements' | 'footsteps' | 'conversations' | 'turnstiles' | 'platform_buzzer';
export type Mode = 'transit' | 'street';

export { CITIES };
export type { City };

export interface Scene { id: SceneId; label: string; hint: string; prompt: string; onTrain: boolean }

export const SCENES: Scene[] = [
  { id: 'train_seated', label: 'On the train, seated', hint: 'Side by side on the bench', onTrain: true,
    prompt: 'seated side by side on a bench seat inside a moving train car, windows behind them showing motion-blurred tunnel and station lights' },
  { id: 'train_standing', label: 'On the train, standing', hint: 'Holding the pole', onTrain: true,
    prompt: 'standing together in a moving train car holding a pole, windows showing motion-blurred tunnel lights, other passengers nearby' },
  { id: 'platform', label: 'Platform', hint: 'Waiting for the train', onTrain: false,
    prompt: 'standing on a station platform waiting for the train, platform edge visible, a train approaching in the background' },
  { id: 'train_arriving', label: 'Train arriving', hint: 'Doors opening', onTrain: false,
    prompt: 'on the platform as the train pulls in and the doors slide open behind them, passengers stepping on and off' },
  { id: 'rush_hour', label: 'Rush hour', hint: 'Packed and chaotic', onTrain: false,
    prompt: 'on a crowded platform during rush hour, a dense pack of commuters moving all around them' },
  { id: 'late_night', label: 'Late night', hint: 'Empty and moody', onTrain: false,
    prompt: 'on a nearly empty platform at night, moody fluorescent lighting, a few scattered passengers, quiet atmosphere' },
  { id: 'walking', label: 'Walking through', hint: 'Through the station', onTrain: false,
    prompt: 'walking together through a station corridor, turnstiles or stairs visible, other commuters passing' },
  { id: 'escalator', label: 'Escalator', hint: 'Riding up or down', onTrain: false,
    prompt: 'riding a long station escalator, tiled walls and signage sliding past, commuters on the steps ahead' },
  { id: 'station_entrance', label: 'Station entrance', hint: 'At the street stairs', onTrain: false,
    prompt: 'at a station entrance with the street stairs behind them, commuters coming and going' },
  { id: 'tunnel', label: 'Tunnel', hint: 'Edge of the platform', onTrain: false,
    prompt: 'near the end of the platform with the dark tunnel mouth behind them, a train light approaching in the distance' },
];

export interface TimeOfDay { id: TimeId; label: string; emoji: string; prompt: string }

export const TIMES: TimeOfDay[] = [
  { id: 'early_morning', label: '5AM club', emoji: '🌅', prompt: 'around 5AM, quiet and sleepy, early risers, peaceful dawn atmosphere' },
  { id: 'morning_rush', label: 'Morning rush', emoji: '☕', prompt: 'morning rush hour, coffee-fuelled commuters, hurried energy' },
  { id: 'midday', label: 'Midday', emoji: '☀️', prompt: 'midday, bright light, lunch crowds' },
  { id: 'evening_rush', label: 'Evening rush', emoji: '🌆', prompt: 'evening rush hour, tired commuters heading home, end-of-workday social energy' },
  { id: 'late_night', label: 'Late night', emoji: '🌙', prompt: 'late at night, nearly empty, night owls, quiet and slightly mysterious' },
  { id: 'weekend', label: 'Weekend', emoji: '🎉', prompt: 'a relaxed weekend, tourists and a non-commuter crowd' },
  { id: 'golden_hour', label: 'Golden hour', emoji: '🌇', prompt: 'golden hour, warm sunset light, cinematic tones' },
  { id: 'dusk', label: 'Dusk', emoji: '🌃', prompt: 'dusk blue hour, city lights coming on' },
  { id: 'night', label: 'Night', emoji: '🌜', prompt: 'night, street lights and urban nightlife energy' },
];

export const CROWDS: { id: CrowdId; label: string; prompt: string }[] = [
  { id: 'sparse', label: 'Sparse', prompt: 'a few scattered passengers' },
  { id: 'moderate', label: 'Moderate', prompt: 'a moderate crowd of ordinary passengers' },
  { id: 'dense', label: 'Dense', prompt: 'a dense crowd of passengers close around them' },
];

export const AMBIENCE: { id: AmbienceId; label: string; prompt: string }[] = [
  { id: 'train_rumble', label: 'Train rumble', prompt: 'the rumble and screech of the train' },
  { id: 'announcements', label: 'Announcements', prompt: 'muffled station announcements' },
  { id: 'footsteps', label: 'Footsteps', prompt: 'echoing footsteps' },
  { id: 'conversations', label: 'Chatter', prompt: 'background conversations' },
  { id: 'turnstiles', label: 'Turnstiles', prompt: 'turnstile clicks' },
  { id: 'platform_buzzer', label: 'Door buzzer', prompt: 'the door-closing chime' },
];

// ---- Street mode (the old app's above-ground interviews) --------------------

export const NEIGHBORHOODS: { id: string; label: string; prompt: string }[] = [
  { id: 'soho', label: 'SoHo', prompt: 'SoHo, cast-iron architecture and trendy shopfronts' },
  { id: 'harlem', label: 'Harlem', prompt: 'Harlem, brownstones and a rich jazz-era street culture' },
  { id: 'williamsburg', label: 'Williamsburg', prompt: 'Williamsburg, street art and indie cafes' },
  { id: 'fidi', label: 'FiDi', prompt: 'the Financial District, glass skyscrapers and suits' },
  { id: 'times_square', label: 'Times Square', prompt: 'Times Square, giant billboards and constant crowds' },
  { id: 'chelsea', label: 'Chelsea', prompt: 'Chelsea, art galleries and the High Line' },
  { id: 'east_village', label: 'East Village', prompt: 'the East Village, bohemian bars and dive-bar signs' },
];

export const STREET_SCENES: { id: string; label: string; prompt: string }[] = [
  { id: 'busy_sidewalk', label: 'Busy sidewalk', prompt: 'on a busy city sidewalk, heavy foot traffic, people walking past behind them' },
  { id: 'coffee_shop', label: 'Coffee shop', prompt: 'outside a coffee shop with cafe tables behind them' },
  { id: 'park_bench', label: 'Park bench', prompt: 'on a park bench with trees and grass behind them' },
  { id: 'crosswalk', label: 'Crosswalk', prompt: 'at a street crossing with traffic and pedestrians moving' },
  { id: 'shopping_district', label: 'Shopping district', prompt: 'in a shopping district with storefronts and window displays' },
  { id: 'quiet_neighborhood', label: 'Quiet neighborhood', prompt: 'on a quiet residential street with brownstones behind them' },
];

// ---- Place spec ---------------------------------------------------------------

export interface PlaceSpec {
  mode: Mode;
  city: CityId;
  scene: SceneId;
  time: TimeId;
  crowd: CrowdId;
  ambience: AmbienceId[];
  /** NYC only: a line id from NYC_LINES. */
  line?: string;
  station?: string;
  streetScene: string;
  neighborhood?: string;
  /** Free text. Used as the whole setting when city is 'custom', else appended. */
  custom?: string;
}

export const DEFAULT_PLACE: PlaceSpec = {
  mode: 'transit',
  city: 'nyc',
  scene: 'train_seated',
  time: 'evening_rush',
  crowd: 'moderate',
  ambience: ['train_rumble'],
  streetScene: 'busy_sidewalk',
};

export function cityOf(id: CityId): City {
  return CITIES.find(c => c.id === id) ?? CITIES.find(c => c.id === 'generic')!;
}

/** The card word for this place, e.g. "MetroCard" / "Oyster card". */
export function cardFor(city: CityId): string {
  return cityOf(city).card;
}

/** Phrase for the card used as a microphone in this city. */
export function cardMicPhrase(city: CityId): string {
  const c = cityOf(city);
  const look = c.cardLook.replace(/,? no logo( detail)?$/, '');
  return `${look}, a ${c.card}, held up to the mouth like a microphone`;
}

const find = <T extends { id: string }>(list: T[], id: string | undefined) => list.find(x => x.id === id);

/** One paragraph describing where this is, for prompts. */
export function placePrompt(p: PlaceSpec): string {
  const custom = p.custom?.trim();
  if (p.mode === 'street') {
    const scene = find(STREET_SCENES, p.streetScene) ?? STREET_SCENES[0];
    const hood = find(NEIGHBORHOODS, p.neighborhood);
    const time = find(TIMES, p.time);
    return [
      `New York City street, ${scene.prompt}${hood ? `, in ${hood.prompt}` : ''}`,
      time ? time.prompt : '',
      custom ?? '',
    ].filter(Boolean).join('. ');
  }
  const city = cityOf(p.city);
  const scene = find(SCENES, p.scene) ?? SCENES[0];
  const time = find(TIMES, p.time);
  const crowd = find(CROWDS, p.crowd);
  const sounds = (p.ambience ?? []).map(a => find(AMBIENCE, a)?.prompt).filter(Boolean);
  const line = p.city === 'nyc' && p.line ? find(NYC_LINES, p.line) : undefined;
  const parts: string[] = [];
  if (p.city === 'custom' && custom) {
    parts.push(custom, scene.prompt);
  } else {
    parts.push(scene.onTrain ? city.car : city.look);
    parts.push(scene.prompt);
    if (line) parts.push(`the ${line.id} train line (${line.service})`);
    const stations = stationsFor(p.city, p.line);
    const station = p.station && stations.includes(p.station) ? p.station : stations[0];
    if (station) parts.push(`station signage reads "${station}"`);
    if (city.locals) parts.push(city.locals);
    if (custom) parts.push(custom);
  }
  if (time) parts.push(time.prompt);
  if (crowd) parts.push(crowd.prompt);
  if (sounds.length) parts.push(`ambient sound of ${sounds.join(', ')}`);
  return parts.join('. ');
}

/** Short label for UI, e.g. "New York · On the train, seated". */
export function placeLabel(p: PlaceSpec): string {
  if (p.mode === 'street') {
    return `Street · ${(find(STREET_SCENES, p.streetScene) ?? STREET_SCENES[0]).label}`;
  }
  return `${cityOf(p.city).label} · ${(find(SCENES, p.scene) ?? SCENES[0]).label}`;
}

/** Two-person interviews need a bench or a wide spot: true if the scene is seated on a train. */
export function isSeatedScene(p: PlaceSpec): boolean {
  return p.mode === 'transit' && p.scene === 'train_seated';
}

/** Real stations for a city (NYC: for the chosen line, else the city's landmark stations). */
export function stationsFor(city: CityId, line?: string): string[] {
  if (city === 'nyc' && line && NYC_STATIONS[line]) return NYC_STATIONS[line];
  return cityOf(city).stations;
}
