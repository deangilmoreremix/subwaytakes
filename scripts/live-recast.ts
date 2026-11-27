/**
 * Live Recast test: runs the REAL runRecastJob orchestrator against the REAL muapi API.
 * Only the browser helpers are swapped for ffmpeg (frame grab + contact sheet) and uploads go to muapi's upload_file.
 *
 *   npx vite-node scripts/live-recast.ts <outDir> <source.mp4>                 DRY RUN: estimates only (free)
 *   npx vite-node scripts/live-recast.ts <outDir> <source.mp4> --run [--cap 1.60] [--model wan|seedance]
 *
 * Resumable: progress is saved in <outDir>/job.json; running again continues an interrupted job.
 * Auth: MUAPI_KEY if set. In a sandbox whose proxy injects credentials, run with NODE_USE_ENV_PROXY=1 so Node's fetch uses it.
 * Needs ffmpeg + ffprobe on PATH. Run with VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY set to any dummy values.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runRecastJob, type RecastDeps, type RecastState, type StageEvent } from '../src/lib/recast/pipeline';
import { estimateRecast, outputSeconds, RECAST_MODELS, imageBudget, type RecastModel } from '../src/lib/recast/limits';
import { extractError, extractMediaUrl, normalizeStatus, pickMessage } from '../src/lib/muapi/result';

const argv = process.argv.slice(2).filter(a => a !== '--');
const flag = (n: string) => argv.includes(n);
const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const [outDir, sourcePath] = argv.filter(a => !a.startsWith('--') && a !== opt('--cap') && a !== opt('--model'));
if (!outDir || !sourcePath) { console.error('usage: live-recast.ts <outDir> <source.mp4> [--run] [--cap USD] [--model wan|seedance]'); process.exit(2); }
const RUN = flag('--run');
const CAP = Number(opt('--cap')) || 1.6;
const MODEL = (opt('--model') as RecastModel) || 'wan';
mkdirSync(outDir, { recursive: true });

const API = 'https://api.muapi.ai';
const authHeaders: Record<string, string> = process.env.MUAPI_KEY ? { 'x-api-key': process.env.MUAPI_KEY } : {};
const J = { 'Content-Type': 'application/json', ...authHeaders };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const sh = (cmd: string, a: string[]) => execFileSync(cmd, a, { stdio: ['ignore', 'pipe', 'pipe'] }).toString();

let spent = 0;
const ledger: Array<[string, number]> = [];

async function api(method: 'GET' | 'POST', path: string, body?: unknown): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const r = await fetch(API + path, { method, headers: J, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: r.ok, status: r.status, json };
}

/** Real transport with the same semantics as client.runModel (submit, onSubmitted, resumeId, tolerant parsing, failure bodies). */
const runModel: RecastDeps['runModel'] = async (slug, input, opts = {}) => {
  let id = opts.resumeId;
  if (!id) {
    const sub = await api('POST', `/api/v1/${slug}`, input);
    if (!sub.ok) throw new Error(pickMessage(sub.json) || `submit ${slug} failed (${sub.status})`);
    id = String(sub.json.request_id);
    const cost = Number((sub.json.cost as { amount_usd?: number } | undefined)?.amount_usd ?? 0);
    spent += cost; ledger.push([slug, cost]);
    console.log(`    submitted ${slug} ${id.slice(0, 8)} charged $${cost}  (running total $${spent.toFixed(4)})`);
    if (spent > CAP) throw new Error(`spend guard: $${spent.toFixed(4)} exceeds the cap of $${CAP}`);
    opts.onSubmitted?.(id);
  }
  const started = Date.now();
  for (;;) {
    if (opts.signal?.aborted) throw new Error('Cancelled');
    const res = await api('GET', `/api/v1/predictions/${id}/result`);
    // muapi reports FAILED predictions as an HTTP error with the status inside `detail`
    const body = (res.json.detail && typeof res.json.detail === 'object' ? res.json.detail : res.json) as Record<string, unknown>;
    const status = normalizeStatus(body);
    if (status === 'completed') {
      writeFileSync(join(outDir, `result-${slug}-${String(id).slice(0, 8)}.json`), JSON.stringify({ ...body, inputs: undefined }, null, 1));
      const url = extractMediaUrl(body);
      if (!url && opts.requireUrl !== false) throw new Error(`${slug} completed without an output URL`);
      return { requestId: String(id), url: url ?? '', prediction: body as never };
    }
    if (status === 'failed' || status === 'cancelled') throw new Error(extractError(body) || pickMessage(res.json) || `${slug} ${status}`);
    if (Date.now() - started > (opts.timeoutMs ?? 15 * 60_000)) throw new Error(`${slug} timed out`);
    await sleep(opts.intervalMs ?? 4000);
  }
};

async function upload(buf: Buffer, name: string, type: string): Promise<string> {
  const fd = new FormData(); fd.append('file', new Blob([new Uint8Array(buf)], { type }), name);
  const r = await fetch(`${API}/api/v1/upload_file`, { method: 'POST', headers: authHeaders, body: fd });
  const j = (await r.json().catch(() => ({}))) as { url?: string };
  if (!r.ok || !String(j.url || '').startsWith('https://')) throw new Error(`upload_file failed: ${JSON.stringify(j).slice(0, 200)}`);
  return j.url!;
}
const mimeOf = (n: string) => (n.endsWith('.png') ? 'image/png' : n.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg');

const SRC_LOCAL = join(outDir, 'source.mp4');
writeFileSync(SRC_LOCAL, readFileSync(sourcePath));
const sourceSeconds = Number(sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', SRC_LOCAL]).trim());
const hasAudio = sh('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=index', '-of', 'csv=p=0', SRC_LOCAL]).trim() !== '';
console.log(`Source: ${sourceSeconds.toFixed(2)}s, audio=${hasAudio}`);

// meta cache (uploaded source + generated performer reference) so reruns never pay twice
const metaPath = join(outDir, 'meta.json');
const meta: { sourceUrl?: string; refUrl?: string; refLocal?: string } = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : {};
const saveMeta = () => writeFileSync(metaPath, JSON.stringify(meta, null, 1));

const REF_PROMPT = 'Studio portrait photo of a woman in her early 30s with curly auburn hair and freckles, wearing a bright red wool coat over a cream sweater, neutral friendly expression, plain light grey background, soft even lighting, photorealistic, head and shoulders';

// ---------------------------------------------------------------- estimates
const imgIn = { prompt: REF_PROMPT, aspect_ratio: '3:4', resolution: '1K', quality: 'low' };
const est = async (slug: string, body: unknown) => Number((await api('POST', `/api/v1/models/${slug}/estimate-cost`, body)).json.cost);
const def = RECAST_MODELS[MODEL];
const out = outputSeconds(MODEL, sourceSeconds);
if (out.error) { console.error(out.error); process.exit(1); }
const dummy = 'https://example.com/x.png';
const live = {
  depth: await est('depth-anything', { video_url: 'https://example.com/x.mp4' }),
  vision: await est('gemini-video-vision', { video_url: 'https://example.com/x.mp4', prompt: 'x' }),
  plate: await est('nano-banana-2-edit', { prompt: 'x', images_list: [dummy], aspect_ratio: 'Auto', resolution: '1k', output_format: 'jpg' }),
  sheet: await est('gpt-image-2-image-to-image', { prompt: 'x', images_list: [dummy], aspect_ratio: '16:9', resolution: '2K', quality: 'high' }),
  render: await est(def.slug, MODEL === 'wan' ? { prompt: 'x', images_list: [dummy], videos_list: ['https://example.com/x.mp4'], aspect_ratio: 'adaptive', duration: out.seconds, resolution: '720p', thinking_mode: false, enable_audio: false } : { prompt: 'x', images_list: [dummy], videos_list: ['https://example.com/x.mp4'], aspect_ratio: 'adaptive', duration: out.seconds, resolution: '720p' }),
};
const refEst = await est('gpt-image-2-text-to-image', imgIn);
const plates = imageBudget(MODEL, 1, 4).plates;
const plan = estimateRecast(MODEL, 1, plates, live, out.seconds);
console.log(`\nLive estimates (USD) for ${def.label} ${def.tag}, ${out.seconds}s output, 1 reference, ${plates} backgrounds:`);
for (const [k, v] of plan.lines) console.log(`  ${k.padEnd(28)} $${v.toFixed(4)}`);
console.log(`  ${'Performer reference image'.padEnd(28)} $${refEst.toFixed(4)}`);
const total = plan.total + (meta.refUrl ? 0 : refEst);
console.log(`  ${'TOTAL'.padEnd(28)} $${total.toFixed(4)}   (cap $${CAP.toFixed(2)})`);
if (total > CAP) { console.error('Estimated total exceeds the cap; refusing to run.'); process.exit(1); }
if (!RUN) { console.log('\nDry run only. Pass --run to spend the estimated amount.'); process.exit(0); }

// ---------------------------------------------------------------- inputs
if (!meta.sourceUrl) { meta.sourceUrl = await upload(readFileSync(SRC_LOCAL), 'source.mp4', 'video/mp4'); saveMeta(); }
if (!meta.refUrl) {
  console.log('Generating the new performer reference...');
  const r = await runModel('gpt-image-2-text-to-image', imgIn, { intervalMs: 3000 });
  meta.refUrl = r.url; meta.refLocal = join(outDir, 'performer.png');
  writeFileSync(meta.refLocal, Buffer.from(await (await fetch(r.url)).arrayBuffer())); saveMeta();
}

// ---------------------------------------------------------------- deps: real orchestrator, ffmpeg instead of the browser canvas
const jobPath = join(outDir, 'job.json');
let jobRow: Record<string, unknown> = existsSync(jobPath) ? JSON.parse(readFileSync(jobPath, 'utf8')) : {};
const saveJob = () => writeFileSync(jobPath, JSON.stringify(jobRow, null, 1));

const deps: RecastDeps = {
  runModel,
  uploadMedia: async (blob, name) => upload(Buffer.from(await blob.arrayBuffer()), name, mimeOf(name)),
  extractFrames: async (_url, seconds) => seconds.map((t, i) => {
    const f = join(outDir, `frame-${i + 1}.jpg`);
    sh('ffmpeg', ['-loglevel', 'error', '-y', '-ss', String(t), '-i', SRC_LOCAL, '-frames:v', '1', '-q:v', '2', f]);
    return new Blob([new Uint8Array(readFileSync(f))], { type: 'image/jpeg' });
  }),
  buildContactSheet: async items => {
    const files: string[] = [];
    for (const [i, it] of items.entries()) { const f = join(outDir, `cs-${i}.img`); writeFileSync(f, Buffer.from(await (await fetch(it.url)).arrayBuffer())); files.push(f); }
    const cols = 3, w = 480, h = 270;
    const inputs = files.flatMap(f => ['-i', f]);
    const tiles = files.map((_, i) => `[${i}:v]scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h + 34}:(ow-iw)/2:34:color=white,drawtext=text='${items[i].label.replace(/[':]/g, '')}':x=8:y=6:fontsize=20:fontcolor=black[t${i}]`);
    const layout = files.map((_, i) => `${(i % cols) * w}_${Math.floor(i / cols) * (h + 34)}`).join('|');
    const out2 = join(outDir, 'contact-sheet.jpg');
    sh('ffmpeg', ['-loglevel', 'error', '-y', ...inputs, '-filter_complex', `${tiles.join(';')};${files.map((_, i) => `[t${i}]`).join('')}xstack=inputs=${files.length}:layout=${layout}:fill=white`, '-frames:v', '1', out2]);
    return new Blob([new Uint8Array(readFileSync(out2))], { type: 'image/jpeg' });
  },
  createJob: async (pipeline, model, input) => { jobRow = { id: 'local-job', pipeline, model, status: 'processing', stage: 'queued', input, output_url: null, error: null, request_id: null, created_at: new Date().toISOString() }; saveJob(); return jobRow as never; },
  patchJob: async (_id, patch) => { jobRow = { ...jobRow, ...patch }; saveJob(); return undefined as never; },
};

const resume = jobRow.status === 'processing' && (jobRow.input as { recast?: RecastState } | undefined)?.recast
  ? { job: jobRow as never, state: (jobRow.input as { recast: RecastState }).recast } : undefined;
if (resume) console.log('Resuming an interrupted job from job.json');

const t0 = Date.now();
const onStage = (e: StageEvent) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0).padStart(4)}s] ${e.stage.padEnd(7)} ${e.status}${e.detail ? ' - ' + e.detail : ''}`);
const result = await runRecastJob({ sourceUrl: meta.sourceUrl!, sourceSeconds, refs: [meta.refUrl!], mode: 'motion_transfer', model: MODEL, outfit: 'a bright red wool coat over a cream sweater', brief: 'Keep the busy NYC subway platform feel and the handheld street-interview energy.', resume, onStage, onWarning: w => console.log('    WARNING:', w) }, deps);

console.log('\nRESULT', result.url, `(${result.seconds}s)`);
console.log('WARNINGS', JSON.stringify(result.warnings));
console.log('FINAL PROMPT:\n' + result.state.stages.prompt?.text);
const outVideo = join(outDir, `recast-${MODEL}.mp4`);
writeFileSync(outVideo, Buffer.from(await (await fetch(result.url)).arrayBuffer()));
console.log(sh('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height,r_frame_rate:format=duration', '-of', 'default=nw=1', outVideo]));
console.log('SPEND LEDGER', JSON.stringify(ledger), `TOTAL $${spent.toFixed(4)}`);
writeFileSync(join(outDir, 'ledger.json'), JSON.stringify({ ledger, total: spent }, null, 1));
