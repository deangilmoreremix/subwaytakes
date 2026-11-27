import { ALL_FORMATS, Input, UrlSource, type Source } from 'mediabunny';

export interface MediaInfo { durationSec: number; hasAudio: boolean; width?: number; height?: number }

/** Read real duration/tracks with Mediabunny (works on any Source so it is testable without a network). */
export async function readMediaInfo(source: Source): Promise<MediaInfo> {
  const input = new Input({ source, formats: ALL_FORMATS });
  try {
    const durationSec = await input.computeDuration();
    if (!Number.isFinite(durationSec) || durationSec <= 0) throw new Error('no duration');
    const video = await input.getPrimaryVideoTrack();
    const audio = await input.getPrimaryAudioTrack();
    return { durationSec, hasAudio: !!audio, width: video?.displayWidth, height: video?.displayHeight };
  } finally {
    input.dispose();
  }
}

/** Fallback: ask a <video> element for its metadata. Rejects on error/timeout. */
export function probeDuration(url: string, timeoutMs = 8000): Promise<number> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    const done = (fn: () => void) => { clearTimeout(t); v.removeAttribute('src'); v.load(); fn(); };
    const t = setTimeout(() => done(() => reject(new Error('probe timeout'))), timeoutMs);
    v.preload = 'metadata'; v.muted = true;
    v.onloadedmetadata = () => done(() => (Number.isFinite(v.duration) && v.duration > 0 ? resolve(v.duration) : reject(new Error('no duration'))));
    v.onerror = () => done(() => reject(new Error('probe failed')));
    v.src = url;
  });
}

/** Best-effort info for a hosted clip: Mediabunny first (exact, also tells us about audio), element probe second. */
export async function getMediaInfo(url: string): Promise<MediaInfo> {
  try {
    return await readMediaInfo(new UrlSource(url));
  } catch {
    return { durationSec: await probeDuration(url), hasAudio: true };
  }
}
