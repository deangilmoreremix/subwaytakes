// Test harness only (not part of the app): runs a real on-device engine on a clip in the browser and reports words + timing.
import { ENGINES } from '../../src/lib/captions/engines';
import type { EngineId, ModelSize } from '../../src/lib/captions/engines';

declare global { interface Window { runEngine: (engine: EngineId, model: ModelSize, src: string, durationSec: number, language: string, device?: 'auto' | 'wasm') => Promise<unknown>; isolated: boolean } }
window.isolated = crossOriginIsolated;
window.runEngine = async (engine, model, src, durationSec, language, device) => {
  const t0 = performance.now(); const stages: string[] = [];
  const av = await ENGINES[engine].isAvailable();
  if (!av.ok) return { ok: false, error: `unavailable: ${av.reason}` };
  try {
    const r = await ENGINES[engine].transcribe({ src, durationSec, language, model, device, onProgress: p => { const k = `${p.stage}${p.percent !== undefined ? ':' + Math.round(p.percent / 25) * 25 : ''}`; if (stages[stages.length - 1] !== k) stages.push(k); } });
    return { ok: true, ms: Math.round(performance.now() - t0), stages, words: r.words, text: r.words.map(w => w.text).join(' '), language: r.language };
  } catch (e) { return { ok: false, ms: Math.round(performance.now() - t0), stages, error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) }; }
};
