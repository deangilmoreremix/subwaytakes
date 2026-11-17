import { cloudEngine } from './cloud';
import { transformersEngine } from './transformers';
import { whisperCppEngine } from './whisperCpp';
import { TranscribeError, type EngineId, type Transcriber, type TranscribeRequest, type TranscribeResult } from './types';

export * from './types';
export { dictationSupported, startDictation } from './webSpeech';

export const ENGINES: Record<EngineId, Transcriber> = { transformers: transformersEngine, whisper_cpp: whisperCppEngine, cloud: cloudEngine };
/** Order of the free on-device engines. The cloud engine is never part of an automatic fallback because it spends credits. */
// Dev-server only: lets the browser tests swap in a fake transcriber (never present in a production build).
if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __captionEngines?: unknown }).__captionEngines = ENGINES;
export const FREE_ORDER: EngineId[] = ['transformers', 'whisper_cpp'];

export interface RunOptions { engine: EngineId; /** on-device engines may fall back to the next free one */ fallback?: boolean; engines?: Record<EngineId, Transcriber>; onFallback?: (from: EngineId, to: EngineId, reason: string) => void }

/** Run the chosen engine. When it is an on-device engine and fails to load or run, try the other on-device engine and say so. Cancelling and "no speech" never trigger a fallback. */
export async function transcribe(req: TranscribeRequest, opts: RunOptions): Promise<TranscribeResult> {
  const engines = opts.engines ?? ENGINES;
  const chain: EngineId[] = opts.engine === 'cloud' ? ['cloud'] : opts.fallback === false ? [opts.engine] : [opts.engine, ...FREE_ORDER.filter(e => e !== opts.engine)];
  let last: unknown = null;
  for (let i = 0; i < chain.length; i++) {
    const id = chain[i]; const eng = engines[id];
    const av = await eng.isAvailable();
    if (!av.ok) { last = new TranscribeError(av.reason ?? `${eng.label} is not available here.`, id, 'unavailable'); if (i + 1 < chain.length) opts.onFallback?.(id, chain[i + 1], av.reason ?? 'not available'); continue; }
    try { return await eng.transcribe(req); }
    catch (e) {
      last = e;
      if (e instanceof TranscribeError && ['aborted', 'no_speech', 'too_long', 'source'].includes(e.kind)) throw e;
      if (req.signal?.aborted) throw new TranscribeError('Cancelled', id, 'aborted');
      if (i + 1 < chain.length) opts.onFallback?.(id, chain[i + 1], e instanceof Error ? e.message : String(e));
    }
  }
  throw last instanceof Error ? last : new TranscribeError('No transcription engine could run here.', opts.engine, 'unavailable');
}
