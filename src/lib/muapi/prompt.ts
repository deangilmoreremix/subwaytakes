import type { Aspect } from './registry';

export interface TakeSpec {
  take: string;           // the opinion the guest defends
  guestDescription: string;
  hostDescription: string;
  setting: string;        // e.g. "R train platform, NYC"
  tone: 'deadpan' | 'heated' | 'playful';
  durationSeconds: number;
  aspect: Aspect;
}

export const DEFAULT_TAKE: TakeSpec = {
  take: 'Pineapple belongs on pizza and anyone who disagrees is scared of joy.',
  guestDescription: 'a New Yorker in their 30s in a puffer jacket',
  hostDescription: 'a charismatic host holding a small mic clipped onto a physical MetroCard',
  setting: 'a crowded NYC subway platform',
  tone: 'playful',
  durationSeconds: 8,
  aspect: '9:16',
};

export const OPENER = "So what's ur take?";

/** Line the guest speaks: kept short so it fits the clip length (~2.5 words/sec). */
export function spokenLines(t: TakeSpec): { host: string; guest: string } {
  const maxWords = Math.max(8, Math.floor(t.durationSeconds * 2.5) - 4);
  const guest = t.take.split(/\s+/).slice(0, maxWords).join(' ');
  return { host: OPENER, guest };
}

/** Builds the video prompt for native-audio models (Veo, Kling, Seedance, Sora). */
export function buildNativePrompt(t: TakeSpec): string {
  const { host, guest } = spokenLines(t);
  return [
    `Handheld vertical street-interview shot on ${t.setting}, documentary look, natural ambient subway sound.`,
    `${t.hostDescription} holds the card-mic toward ${t.guestDescription}.`,
    `The host asks: "${host}"`,
    `The guest answers directly to camera in a ${t.tone} tone: "${guest}"`,
    'Visible lip movement matches the speech. Natural gestures, authentic crowd in background, no subtitles, no text overlays, no logos.',
  ].join(' ');
}

/** Image prompt for the lipsync pipeline (the guest portrait). */
export function buildGuestStillPrompt(t: TakeSpec): string {
  return `Close-up portrait of ${t.guestDescription}, facing camera, mid-sentence, on ${t.setting}, handheld street-interview framing with a MetroCard-mounted mic entering frame, natural light, photorealistic, ${t.aspect} framing.`;
}
