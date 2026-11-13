/**
 * Interview shot engine. The real SubwayTakes format (checked against the channel's
 * videos) is a TWO-SHOT: host and guest sit shoulder to shoulder on a subway bench,
 * motion-blurred windows behind them, and BOTH hold a flat transit card up to their
 * mouths as the microphone. There is no real microphone.
 *
 * Formats:
 *  - twoshot: one native-audio video of both people (default)
 *  - cuts:    host and guest portraits, each lip-synced, placed back to back
 *  - solo:    guest close-up, host's hand holds the card into frame
 */
import type { Aspect } from '../muapi/registry';
import { DEFAULT_PLACE, cardMicPhrase, cityOf, placePrompt, type PlaceSpec } from '../places';

export type InterviewFormat = 'twoshot' | 'cuts' | 'solo';
export type Tone = 'deadpan' | 'heated' | 'playful';

export interface TakeSpec {
  take: string;
  guestDescription: string;
  hostDescription: string;
  place: PlaceSpec;
  tone: Tone;
  durationSeconds: number;
  aspect: Aspect;
  format: InterviewFormat;
}

export const OPENER = "So what's ur take?";
export const WORDS_PER_SECOND = 2.5;
const OPENER_SECONDS = 1.8;

export const DEFAULT_TAKE: TakeSpec = {
  take: 'Pineapple belongs on pizza and anyone who disagrees is scared of joy.',
  guestDescription: 'a local commuter in their 30s in a winter jacket',
  hostDescription: 'a young host with big curly hair and round sunglasses, wearing a bright bomber jacket',
  place: DEFAULT_PLACE,
  tone: 'playful',
  durationSeconds: 8,
  aspect: '9:16',
  format: 'twoshot',
};

export const FORMATS: { id: InterviewFormat; label: string; hint: string }[] = [
  { id: 'twoshot', label: 'Two-shot', hint: 'Host and guest side by side, one video' },
  { id: 'cuts', label: 'Cuts', hint: 'Host, then guest: two lip-synced shots' },
  { id: 'solo', label: 'Solo', hint: 'Guest close-up only' },
];

/** Words a person can say in `seconds` (leaving room for the opener when `withOpener`). */
export function wordBudget(seconds: number, withOpener: boolean): number {
  const usable = Math.max(2, seconds - (withOpener ? OPENER_SECONDS : 0));
  return Math.max(6, Math.floor(usable * WORDS_PER_SECOND));
}

/** The lines each person speaks, with the guest's line trimmed to fit the clip. */
export function spokenLines(t: Pick<TakeSpec, 'take' | 'durationSeconds'>): { host: string; guest: string; trimmed: boolean } {
  const max = wordBudget(t.durationSeconds, true);
  const words = t.take.trim().split(/\s+/);
  return { host: OPENER, guest: words.slice(0, max).join(' '), trimmed: words.length > max };
}

const TONE_TEXT: Record<Tone, string> = {
  playful: 'playful and grinning',
  deadpan: 'deadpan and completely serious',
  heated: 'heated and passionate',
};

export const NO_MIC_RULE = 'The transit card is the only microphone. There is no real microphone, no lavalier, no boom, no phone held as a mic, and no visible audio gear. The card shows no brand logos or readable text.';

function sceneText(t: TakeSpec): string {
  return placePrompt(t.place);
}

/** Native-audio prompt for the chosen format. */
export function buildNativePrompt(t: TakeSpec): string {
  const { host, guest } = spokenLines(t);
  const card = cardMicPhrase(t.place.city);
  const tone = TONE_TEXT[t.tone];
  const noText = 'No subtitles, no on-screen text, no logos or watermarks.';
  if (t.format === 'solo') {
    return [
      `Handheld vertical documentary close-up of ${t.guestDescription}. Setting: ${sceneText(t)}.`,
      `Out of frame, the host's hand holds ${card} toward the guest as the microphone.`,
      NO_MIC_RULE,
      `The host asks off-screen: "${host}" The guest answers to camera, ${tone}: "${guest}"`,
      `Lip movement matches the speech. Natural gestures, ambient sound of the place. ${noText}`,
    ].join(' ');
  }
  // twoshot (cuts also uses this wording for a single combined fallback)
  const sitting = t.place.mode === 'transit' && t.place.scene === 'train_seated';
  return [
    `Handheld vertical documentary two-shot of two people: the host (${t.hostDescription}) and the guest (${t.guestDescription}).`,
    `Setting: ${sceneText(t)}.`,
    sitting ? 'They sit shoulder to shoulder, close together, framed from the chest up.' : 'They stand shoulder to shoulder, close together, framed from the chest up.',
    `Both hold ${card}, so the card is clearly visible near their mouths, passing it between them as they talk.`,
    NO_MIC_RULE,
    `The host, card at their mouth, asks the guest: "${host}" The guest, ${tone}, takes the card and answers: "${guest}" The host reacts, laughing.`,
    `Visible lip movement matches each speaker's words and each voice is distinct. Slight camera sway, natural ambient sound of the place. ${noText}`,
  ].join(' ');
}

export type Role = 'host' | 'guest';

/** Still-image prompt of one person holding the card as a mic (for Cuts). */
export function buildStillPrompt(t: TakeSpec, role: Role): string {
  const who = role === 'host' ? t.hostDescription : t.guestDescription;
  const card = cardMicPhrase(t.place.city);
  return `Close-up portrait photo of ${who}. Setting: ${sceneText(t)}. They hold ${card} up near their mouth, looking at the camera mid-sentence. ${NO_MIC_RULE} Handheld documentary framing, natural light, photorealistic, ${t.aspect} framing.`;
}

export interface CutShot { role: Role; text: string; portraitPrompt: string }

/** Cuts: the host asks, then the guest answers. */
export function cutsPlan(t: TakeSpec): CutShot[] {
  const { host, guest } = spokenLines(t);
  return [
    { role: 'host', text: host, portraitPrompt: buildStillPrompt(t, 'host') },
    { role: 'guest', text: guest, portraitPrompt: buildStillPrompt(t, 'guest') },
  ];
}

/** Whether Cuts has everything it needs (both characters need a portrait and a voice). */
export function cutsProblem(host: { portrait_url?: string | null; voice_id?: string | null } | undefined, guest: { portrait_url?: string | null; voice_id?: string | null } | undefined): string | null {
  if (!host || !guest) return 'Pick a host and a guest from Cast.';
  if (!host.portrait_url || !host.voice_id) return 'The host needs a portrait and a voice in Cast.';
  if (!guest.portrait_url || !guest.voice_id) return 'The guest needs a portrait and a voice in Cast.';
  return null;
}

/** Text for the on-screen title: the take, uppercase-free, wrapped to short lines. */
export function titleLines(take: string, maxChars = 18): string[] {
  const words = take.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (cur && (cur + ' ' + w).length > maxChars) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 5);
}

export function cardNameFor(t: Pick<TakeSpec, 'place'>): string {
  return cityOf(t.place.city).card;
}
