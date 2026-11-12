// Live smoke test of the Voice + lipsync pipeline against the real muapi API.
//
//   node scripts/live-smoke.mjs <outDir>            DRY RUN: only asks muapi for cost estimates (free)
//   node scripts/live-smoke.mjs <outDir> --run      SPENDS MONEY (~$0.53 at last check): TTS -> portrait -> pad audio -> OmniHuman
//   node scripts/live-smoke.mjs <outDir> --run --cap 1.00   change the hard spend cap in USD (default 1.00)
//
// Auth: uses MUAPI_KEY if set, otherwise assumes the environment injects credentials for api.muapi.ai.
// Needs ffmpeg + ffprobe on PATH (used to pad audio to 4s and to inspect the result).
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const args = process.argv.slice(2);
const out = args[0];
const RUN = args.includes('--run');
const cap = Number(args[args.indexOf('--cap') + 1]) || 1.0;
if (!out) { console.error('usage: node scripts/live-smoke.mjs <outDir> [--run] [--cap USD]'); process.exit(2); }
mkdirSync(out, { recursive: true });

const API = 'https://api.muapi.ai';
const headers = { 'Content-Type': 'application/json', ...(process.env.MUAPI_KEY ? { 'x-api-key': process.env.MUAPI_KEY } : {}) };
const post = async (path, body) => { const r = await fetch(API + path, { method: 'POST', headers, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(`${path} -> ${r.status} ${JSON.stringify(j).slice(0, 300)}`); return j; };
const get = async path => { const r = await fetch(API + path, { headers }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(`${path} -> ${r.status} ${JSON.stringify(j).slice(0, 300)}`); return j; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const OK = ['completed', 'succeeded', 'success', 'done'], BAD = ['failed', 'error', 'cancelled', 'canceled'];
async function runModel(slug, input, intervalMs = 3000, timeoutMs = 15 * 60_000) {
  const { request_id, cost } = await post(`/api/v1/${slug}`, input);
  console.log(`  submitted ${slug} (${request_id}) charged $${cost?.amount_usd ?? '?'}`);
  const t0 = Date.now();
  for (;;) {
    const p = await get(`/api/v1/predictions/${request_id}/result`);
    const s = String(p.status || '').toLowerCase();
    if (OK.includes(s)) { writeFileSync(join(out, `${slug}.result.json`), JSON.stringify({ ...p, inputs: undefined }, null, 1)); return { p, url: p.outputs?.[0] }; }
    if (BAD.includes(s)) throw new Error(`${slug} ${s}: ${p.error || ''}`);
    if (Date.now() - t0 > timeoutMs) throw new Error(`${slug} timed out`);
    await sleep(intervalMs);
  }
}
const estimate = async (slug, input) => (await post(`/api/v1/models/${slug}/estimate-cost`, input)).cost;

const SCRIPT = 'Pineapple belongs on pizza, and anyone who disagrees is scared of joy.';
const VOICE = 'UgBBYS2sOqTuMpoF3BR0';
const PORTRAIT_PROMPT = 'Close-up portrait photo of a New Yorker in their 30s in a puffer jacket, facing camera, mid-sentence with an expressive animated face, on a crowded NYC subway platform, natural fluorescent light, candid street-interview framing, photorealistic';
const imgIn = { prompt: PORTRAIT_PROMPT, aspect_ratio: '9:16', resolution: '1K', quality: 'low' };
const ttsIn = { prompt: SCRIPT, voice_id: VOICE, speed: 1.0 };

const est = { tts: await estimate('elevenlabs-tts-turbo-2-5', ttsIn), image: await estimate('gpt-image-2-text-to-image', imgIn), render: await estimate('omnihuman-2-0', { image_url: 'https://example.com/p.png', audio_url: 'https://example.com/a.wav' }) };
const total = est.tts + est.image + est.render;
console.log('Estimates (USD):', est, 'TOTAL', total.toFixed(4), 'CAP', cap.toFixed(2));
if (total > cap) { console.error(`Estimated total exceeds the cap; refusing to run.`); process.exit(1); }
if (!RUN) { console.log('Dry run only. Pass --run to spend the estimated amount.'); process.exit(0); }

let spent = 0;
const track = c => { spent += c; if (spent > cap) throw new Error(`spend guard tripped at $${spent}`); };

console.log('1/4 voice'); track(est.tts);
const tts = await runModel('elevenlabs-tts-turbo-2-5', ttsIn, 2500);
const mp3 = join(out, 'tts.mp3'); writeFileSync(mp3, Buffer.from(await (await fetch(tts.url)).arrayBuffer()));
const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3]).toString());
console.log(`  voice is ${dur.toFixed(2)}s`);

console.log('2/4 portrait'); track(est.image);
const img = await runModel('gpt-image-2-text-to-image', imgIn);

console.log('3/4 pad audio to >= 4s and upload');
const wav = join(out, 'padded.wav');
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', mp3, '-af', `apad=whole_dur=${Math.max(4.4, dur)}`, '-ar', '44100', '-ac', '1', '-c:a', 'pcm_s16le', wav]);
const fd = new FormData(); fd.append('file', new Blob([readFileSync(wav)], { type: 'audio/wav' }), 'padded.wav');
const up = await (await fetch(`${API}/api/v1/upload_file`, { method: 'POST', headers: process.env.MUAPI_KEY ? { 'x-api-key': process.env.MUAPI_KEY } : {}, body: fd })).json();
if (!String(up.url || '').startsWith('https://')) throw new Error('upload_file returned no url: ' + JSON.stringify(up));

console.log('4/4 OmniHuman render (takes minutes)'); track(est.render);
const oh = await runModel('omnihuman-2-0', { image_url: img.url, audio_url: up.url, prompt: 'Handheld street-interview on a busy NYC subway platform. The guest speaks directly to camera with natural, animated facial expressions.' }, 5000, 20 * 60_000);
const mp4 = join(out, 'omnihuman.mp4'); writeFileSync(mp4, Buffer.from(await (await fetch(oh.url)).arrayBuffer()));
console.log(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height:format=duration', '-of', 'default=nw=1', mp4]).toString());
console.log(`Done. Estimated spend $${spent.toFixed(4)}. Output: ${mp4}`);
