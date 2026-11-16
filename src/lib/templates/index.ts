import { applyShow, type ShowId, type Tone } from '../shows';
import type { InterviewFormat, TakeSpec } from '../interview';
import type { PlaceSpec } from '../places';
import type { FontId } from '../captions/fonts';
import { cityLocked, showLocked, hasFeature, type Feature } from '../billing/features';

/** A one-click starting point: a show, a place, a tone, a format and a caption look. It never writes the take for you. */
export interface Template {
  id: string;
  name: string;
  blurb: string;
  show: ShowId;
  place: Partial<PlaceSpec>;
  tone: Tone;
  format: InterviewFormat;
  durationSeconds: number;
  captionFont: FontId;
}

export const TEMPLATES: Template[] = [
  { id: 'rush_hour_take', name: 'Rush-hour hot take', blurb: 'Packed morning train, a heated take.', show: 'hot_take', place: { city: 'nyc', scene: 'train_seated', time: 'morning_rush', crowd: 'dense' }, tone: 'heated', format: 'twoshot', durationSeconds: 8, captionFont: 'anton' },
  { id: 'late_night_take', name: 'Late-night deadpan', blurb: 'Empty car after midnight, a deadpan take.', show: 'hot_take', place: { city: 'nyc', scene: 'train_seated', time: 'late_night', crowd: 'sparse' }, tone: 'deadpan', format: 'twoshot', durationSeconds: 8, captionFont: 'inter' },
  { id: 'london_deadpan', name: 'London tube take', blurb: 'The Tube at evening rush, dry humour.', show: 'hot_take', place: { city: 'london', scene: 'train_standing', time: 'evening_rush', crowd: 'moderate' }, tone: 'deadpan', format: 'twoshot', durationSeconds: 8, captionFont: 'anton' },
  { id: 'tokyo_question', name: 'Tokyo one question', blurb: 'A calm, spotless carriage and one big question.', show: 'one_question', place: { city: 'tokyo', scene: 'train_seated', time: 'midday', crowd: 'moderate' }, tone: 'playful', format: 'twoshot', durationSeconds: 8, captionFont: 'inter' },
  { id: 'golden_hour_happiness', name: 'Golden-hour happiness', blurb: 'Warm light, a feel-good answer.', show: 'happiness', place: { city: 'nyc', scene: 'platform', time: 'golden_hour', crowd: 'sparse' }, tone: 'joyful', format: 'twoshot', durationSeconds: 8, captionFont: 'bangers' },
  { id: 'platform_compliments', name: 'Platform compliments', blurb: 'The host compliments a stranger.', show: 'compliment', place: { city: 'nyc', scene: 'platform', time: 'midday', crowd: 'moderate' }, tone: 'warm', format: 'twoshot', durationSeconds: 8, captionFont: 'bangers' },
  { id: 'paris_reveal', name: 'Paris reveal', blurb: 'A big number appears when the guest answers.', show: 'reveal', place: { city: 'paris', scene: 'train_seated', time: 'evening_rush', crowd: 'moderate' }, tone: 'surprised', format: 'twoshot', durationSeconds: 8, captionFont: 'anton' },
  { id: 'rate_my_commute', name: 'Rate my commute', blurb: 'Score it out of ten with a sticker.', show: 'rate_my', place: { city: 'london', scene: 'train_seated', time: 'morning_rush', crowd: 'dense' }, tone: 'playful', format: 'twoshot', durationSeconds: 8, captionFont: 'bangers' },
  { id: 'would_you_rather_ride', name: 'Would you rather', blurb: 'Two options, the guest picks.', show: 'would_you_rather', place: { city: 'nyc', scene: 'train_standing', time: 'weekend', crowd: 'moderate' }, tone: 'playful', format: 'twoshot', durationSeconds: 8, captionFont: 'anton' },
  { id: 'night_confessions', name: 'Night confessions', blurb: 'A funny, harmless confession on the late train.', show: 'confession', place: { city: 'nyc', scene: 'train_seated', time: 'night', crowd: 'sparse' }, tone: 'candid', format: 'twoshot', durationSeconds: 8, captionFont: 'inter' },
];

/** Starts from the show defaults (question, tone, sample take if untouched), then lays the template over them. The take is only replaced if untouched. */
export function applyTemplate(spec: TakeSpec, t: Template): { spec: TakeSpec; captionFont: FontId } {
  const withShow = applyShow(spec, t.show);
  return {
    spec: { ...withShow, tone: t.tone, format: t.format, durationSeconds: t.durationSeconds, place: { ...withShow.place, ...t.place, mode: 'transit', ambience: withShow.place.ambience } },
    captionFont: t.captionFont,
  };
}

/** What a customer would still need to unlock to use this template (empty when nothing). */
export function templateNeeds(t: Template, owned: readonly string[]): Feature[] {
  const needs: Feature[] = [];
  if (showLocked(t.show, owned)) needs.push('happiness');
  if (t.format === 'cuts' && !hasFeature('cuts', owned)) needs.push('cuts');
  if (t.place.city && cityLocked(t.place.city, owned)) needs.push('extra_cities');
  return needs;
}
