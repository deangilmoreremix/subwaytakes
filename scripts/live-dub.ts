/**
 * Live dubbing test: does translation + a new voice + video lip-sync really give a good dub? The unit tests prove the plumbing only.
 * Dry run by default (prints the translation prompts and the live price quotes, which are free). Nothing is spent without --run and a cap.
 *
 *   NODE_USE_ENV_PROXY=1 npx vite-node scripts/live-dub.ts <outDir> --clip <https video url> --seconds 8 [--lang es,fr]
 *   NODE_USE_ENV_PROXY=1 npx vite-node scripts/live-dub.ts <outDir> --clip <url> --seconds 8 --lang es --run --cap 1.00
 *
 * Auth: MUAPI_KEY if set (or a credential-injecting proxy). Run with VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY set to dummy values.
 * It talks to muapi directly (not through the gateway), so it bills your muapi account, not a customer's credits.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runDub, dubProblem, type DubDeps } from '../src/lib/dubbing/pipeline';
import { buildTranslatePrompt } from '../src/lib/dubbing/prompts';
import { DUB_LANGUAGES } from '../src/lib/dubbing/languages';
import { TTS_SLUG, buildTtsInput, FALLBACK_ELEVEN } from '../src/lib/muapi/voices';
import { buildVoiceLipsyncInput } from '../src/lib/recast/voice';
import { extractError, extractMediaUrl, normalizeStatus } from '../src/lib/muapi/result';

const argv = process.argv.slice(2).filter(a => a !== '--');
const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const outDir = argv.find(a => !a.startsWith('--') && ![opt('--clip'), opt('--seconds'), opt('--lang'), opt('--cap')].includes(a));
const clip = opt('--clip'); const seconds = Number(opt('--seconds'));
const langs = (opt('--lang') ?? 'es').split(',').map(s => s.trim()).filter(Boolean);
if (!outDir || !clip || !seconds) { console.error('usage: live-dub.ts <outDir> --clip <https url> --seconds N [--lang es,fr] [--run --cap USD]'); process.exit(2); }
mkdirSync(outDir, { recursive: true });
const RUN = argv.includes('--run'); const CAP = Number(opt('--cap')) || 1;
const problem = dubProblem({ sourceUrl: clip, seconds, languages: langs });
if (problem) { console.error(problem); process.exit(2); }

const API = 'https://api.muapi.ai';
const headers: Record<string, string> = { 'content-type': 'application/json', ...(process.env.MUAPI_KEY ? { 'x-api-key': process.env.MUAPI_KEY } : {}) };
const voice = { provider: 'elevenlabs' as const, voiceId: FALLBACK_ELEVEN[0].id };
const sample = 'Pineapple belongs on pizza and anyone who disagrees is scared of joy.';

console.log('LANGUAGES:', langs.map(l => DUB_LANGUAGES.find(x => x.id === l)?.label ?? l).join(', '));
for (const l of langs) console.log(`\n--- translate prompt (${l}) ---\n${buildTranslatePrompt(sample, l, seconds)}`);

async function quote(slug: string, body: Record<string, unknown>): Promise<number | null> {
  const r = await fetch(`${API}/api/v1/models/${slug}/estimate-cost`, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!r.ok) return null;
  const j = await r.json() as { cost?: number };
  return typeof j.cost === 'number' ? j.cost : null;
}
const quotes: Array<[string, number | null]> = [
  ['openai-whisper', await quote('openai-whisper', { audio_url: clip, response_format: 'text' })],
  [TTS_SLUG.elevenlabs, await quote(TTS_SLUG.elevenlabs, buildTtsInput('elevenlabs', sample, voice.voiceId, 1))],
  ['sync-lipsync', await quote('sync-lipsync', buildVoiceLipsyncInput('sync-lipsync', clip, 'https://example.com/voice.wav'))],
];
console.log('\nLIVE QUOTES (USD, muapi cost, free to ask):'); for (const [s, q] of quotes) console.log(`  ${s}: ${q ?? 'unavailable'}`);
const perLang = quotes.slice(1).reduce((s, [, q]) => s + (q ?? 0), 0) + 0.01;
const total = (quotes[0][1] ?? 0) + perLang * langs.length;
console.log(`ESTIMATED TOTAL for ${langs.length} language(s): about $${total.toFixed(2)} (cap $${CAP.toFixed(2)})`);
writeFileSync(join(outDir, 'plan.txt'), `clip ${clip}\nseconds ${seconds}\nlanguages ${langs.join(',')}\nestimate ${total.toFixed(2)}\n`);
if (!RUN) { console.log('\nDRY RUN: nothing was spent. Add --run --cap <USD> to dub for real.'); process.exit(0); }
if (total > CAP) { console.error(`Estimate $${total.toFixed(2)} is over the cap $${CAP.toFixed(2)}. Nothing was run.`); process.exit(3); }

// ---- real run (direct to muapi)
async function runModel(slug: string, input: Record<string, unknown>, opts: { requireUrl?: boolean; intervalMs?: number; timeoutMs?: number; resumeId?: string; onSubmitted?: (id: string) => void } = {}) {
  let id = opts.resumeId;
  if (!id) {
    const r = await fetch(`${API}/api/v1/${slug}`, { method: 'POST', headers, body: JSON.stringify(input) });
    const j = await r.json() as { request_id?: string };
    if (!r.ok || !j.request_id) throw new Error(`${slug} rejected the request (${r.status})`);
    id = j.request_id; opts.onSubmitted?.(id);
  }
  const started = Date.now();
  for (;;) {
    const r = await fetch(`${API}/api/v1/predictions/${id}/result`, { headers });
    const p = await r.json().catch(() => ({})) as Record<string, unknown>;
    const st = normalizeStatus(p);
    if (st === 'completed') { const url = extractMediaUrl(p); if (!url && opts.requireUrl !== false) throw new Error('completed without an output url'); return { requestId: id, url: url ?? '', prediction: p }; }
    if (st === 'failed' || st === 'cancelled') throw new Error(extractError(p) || `${slug} ${st}`);
    if (Date.now() - started > (opts.timeoutMs ?? 15 * 60_000)) throw new Error('timed out');
    await new Promise(res => setTimeout(res, opts.intervalMs ?? 4000));
  }
}
const deps = {
  runModel: runModel as unknown as DubDeps['runModel'],
  createJob: (async (pipeline: string, model: string, input: Record<string, unknown>) => ({ id: 'live', pipeline, model, input, request_id: null, stage: '', status: 'processing', output_url: null, error: null, created_at: '' })) as unknown as DubDeps['createJob'],
  patchJob: (async () => undefined) as unknown as DubDeps['patchJob'],
} satisfies DubDeps;
const r = await runDub({ sourceUrl: clip, seconds, voice, lipsync: 'sync-lipsync', languages: langs, onProgress: e => console.log(`  ${e.language} ${e.stage} ${e.status}${e.detail ? ` (${e.detail})` : ''}`) }, deps);
writeFileSync(join(outDir, 'result.json'), JSON.stringify(r.results, null, 2));
for (const x of r.results) console.log(`${x.language}: ${x.url ?? `FAILED ${x.error}`}${x.text ? `\n   "${x.text}"` : ''}`);
console.log('Open the videos and judge the translation, the voice and the lip-sync yourself: the script cannot.');
