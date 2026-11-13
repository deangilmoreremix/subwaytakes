/**
 * Live two-shot test: does a native-audio model really render host + guest side by side with the transit card as the mic?
 * This is the ONE thing the unit tests cannot prove. Dry run by default (prices only, free).
 *
 *   NODE_USE_ENV_PROXY=1 npx vite-node scripts/live-interview.ts <outDir> [--city london] [--scene train_seated]
 *   NODE_USE_ENV_PROXY=1 npx vite-node scripts/live-interview.ts <outDir> --run --model veo3.1-fast-text-to-video --cap 1.00
 *
 * Auth: MUAPI_KEY if set (or a credential-injecting proxy). Run with VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY set to dummy values.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_TAKE, buildNativePrompt } from '../src/lib/interview';
import { STILL_MODEL, buildAnimateInput, buildStillInput } from '../src/lib/interview/twoshot';
import { DEFAULT_PLACE } from '../src/lib/places';
import { NATIVE_MODELS } from '../src/lib/muapi/registry';
import { extractError, extractMediaUrl, normalizeStatus } from '../src/lib/muapi/result';

const argv = process.argv.slice(2).filter(a => a !== '--');
const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const outDir = argv.find(a => !a.startsWith('--') && ![opt('--city'), opt('--scene'), opt('--model'), opt('--cap'), opt('--host-image')].includes(a));
if (!outDir) { console.error('usage: live-interview.ts <outDir> [--city id] [--scene id] [--run --model slug --cap USD]'); process.exit(2); }
mkdirSync(outDir, { recursive: true });
const RUN = argv.includes('--run');
const CAP = Number(opt('--cap')) || 1;
const spec = { ...DEFAULT_TAKE, place: { ...DEFAULT_PLACE, city: opt('--city') ?? 'nyc', scene: (opt('--scene') ?? 'train_seated') as typeof DEFAULT_PLACE.scene } };
const prompt = buildNativePrompt(spec);
const API = 'https://api.muapi.ai';
const headers: Record<string, string> = { 'content-type': 'application/json', ...(process.env.MUAPI_KEY ? { 'x-api-key': process.env.MUAPI_KEY } : {}) };
const candidates = NATIVE_MODELS.filter(m => m.mode === 'text' && m.nativeAudio && m.aspects.includes('9:16') && ['fast', 'budget'].includes(m.tier));
const bodyFor = (slug: string) => ({ prompt, aspect_ratio: '9:16', duration: Math.min(8, NATIVE_MODELS.find(m => m.slug === slug)!.maxDuration) });

console.log(`PROMPT (${prompt.length} chars):\n${prompt}\n`);
writeFileSync(join(outDir, 'prompt.txt'), prompt);

async function estimate(slug: string): Promise<number | null> {
  const r = await fetch(`${API}/api/v1/models/${slug}/estimate-cost`, { method: 'POST', headers, body: JSON.stringify(bodyFor(slug)) });
  if (!r.ok) return null;
  const j = await r.json() as { cost?: number };
  return typeof j.cost === 'number' ? j.cost : null;
}

const costs: Record<string, number | null> = {};
for (const m of candidates) {
  costs[m.slug] = await estimate(m.slug);
  console.log(`${m.label.padEnd(18)} ${m.slug.padEnd(40)} ${costs[m.slug] == null ? 'estimate unavailable' : '$' + costs[m.slug]!.toFixed(2)}`);
}

const hostImage = opt('--host-image');
if (hostImage) {
  // Host-image route: one starting still, then image-to-video. Prices only (a real run is done from the app).
  const stillBody = buildStillInput(spec, hostImage);
  const sr = await fetch(`${API}/api/v1/models/${STILL_MODEL}/estimate-cost`, { method: 'POST', headers, body: JSON.stringify(stillBody) });
  const stillCost = sr.ok ? ((await sr.json()) as { cost?: number }).cost ?? null : null;
  console.log(`\nHOST IMAGE ROUTE\nStarting still (${STILL_MODEL}): ${stillCost == null ? 'estimate unavailable' : '$' + stillCost.toFixed(2)}`);
  for (const m of NATIVE_MODELS.filter(x => x.mode === 'image' && x.nativeAudio && x.aspects.includes('9:16') && ['fast', 'budget'].includes(x.tier))) {
    const r = await fetch(`${API}/api/v1/models/${m.slug}/estimate-cost`, { method: 'POST', headers, body: JSON.stringify(buildAnimateInput(spec, m.slug, hostImage, {})) });
    const c = r.ok ? ((await r.json()) as { cost?: number }).cost ?? null : null;
    console.log(`${m.label.padEnd(22)} ${m.slug.padEnd(42)} ${c == null ? 'estimate unavailable' : '$' + c.toFixed(2)}${c != null && stillCost != null ? `  (total with still $${(c + stillCost).toFixed(2)})` : ''}`);
  }
  console.log('Host-image route is prices-only here. Run it from the app (Create > Take > Host > pick a Cast host).');
  process.exit(0);
}

if (!RUN) { console.log('\nDRY RUN: nothing was generated or charged. Add --run --model <slug> --cap <usd> to render one clip.'); process.exit(0); }
const slug = opt('--model');
if (!slug || !candidates.some(m => m.slug === slug)) { console.error(`--model must be one of: ${candidates.map(m => m.slug).join(', ')}`); process.exit(2); }
const cost = costs[slug];
if (cost == null) { console.error('Refusing to run: no price estimate available.'); process.exit(1); }
if (cost > CAP) { console.error(`Refusing to run: estimated $${cost.toFixed(2)} is over the cap $${CAP.toFixed(2)}.`); process.exit(1); }

const sub = await fetch(`${API}/api/v1/${slug}`, { method: 'POST', headers, body: JSON.stringify(bodyFor(slug)) });
const subJson = await sub.json() as { request_id?: string };
if (!sub.ok || !subJson.request_id) { console.error('Submit failed:', JSON.stringify(subJson)); process.exit(1); }
console.log('submitted', subJson.request_id);
for (let i = 0; i < 120; i++) {
  await new Promise(r => setTimeout(r, 5000));
  const r = await fetch(`${API}/api/v1/predictions/${subJson.request_id}/result`, { headers });
  const body = await r.json() as never;
  if (!r.ok) { console.error('Failed:', JSON.stringify(body)); process.exit(1); }
  const status = normalizeStatus(body);
  if (status === 'completed') {
    const url = extractMediaUrl(body);
    if (!url) { console.error('Completed but no media URL:', JSON.stringify(body)); process.exit(1); }
    const file = join(outDir, 'twoshot.mp4');
    writeFileSync(file, Buffer.from(await (await fetch(url)).arrayBuffer()));
    console.log('SAVED', file, '\nNow WATCH it: two people side by side? card held as the mic? no real microphone? two distinct voices? lips matching?');
    process.exit(0);
  }
  if (status === 'failed') { console.error('Failed:', extractError(body)); process.exit(1); }
  process.stdout.write('.');
}
console.error('timed out');
process.exit(1);
