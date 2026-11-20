import { IS_BYOK } from '../../mode';
import { spreadLines } from './map';
import { TranscribeError, type Availability, type Transcriber, type TranscribeRequest, type TranscribeResult } from './types';

/** Cloud Whisper through the gateway. Costs credits; only used when the person picks it. Line times only, so words are spread evenly across each line. */
export const cloudEngine: Transcriber = {
  id: 'cloud', label: IS_BYOK ? 'Cloud (billed by muapi)' : 'Cloud (uses credits)', blurb: IS_BYOK ? 'For slow devices. Sends the clip to be transcribed by muapi, billed to your account.' : 'For slow devices. Sends the clip to be transcribed and charges credits.', paid: true,
  async isAvailable(): Promise<Availability> { return { ok: true }; },
  async transcribe(req: TranscribeRequest): Promise<TranscribeResult> {
    req.onProgress?.({ stage: 'transcribing' });
    try {
      const { transcribeClip } = await import('../transcribe');   // lazy: keeps the gateway client out of the on-device path
      const caps = await transcribeClip(req.src, req.durationSec * 1000, { language: req.language === 'auto' ? undefined : req.language, signal: req.signal });
      const words = spreadLines(caps.map(c => ({ text: c.text, startMs: c.startMs, endMs: c.endMs })));
      if (!words.length) throw new TranscribeError('No speech was found in this clip.', 'cloud', 'no_speech');
      return { words, engine: 'cloud', wordTimed: false };
    } catch (e) {
      if (e instanceof TranscribeError) throw e;
      if (req.signal?.aborted) throw new TranscribeError('Cancelled', 'cloud', 'aborted');
      throw e;   // keep credit and gateway errors (InsufficientCreditsError etc.) as they are
    }
  },
};
