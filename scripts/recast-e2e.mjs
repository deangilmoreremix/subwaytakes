// Browser end-to-end test of the Recast page using REAL assets from a live run (stubbed Supabase/muapi network).
// What is real here: the UI, the browser frame extraction + canvas contact sheet, the orchestrator, the timeline op and the export.
// What is stubbed: network responses (muapi results point at real files produced by the live run).
//
// Usage: node scripts/recast-e2e.mjs <assets-dir> <outDir> [baseUrl]
// <assets-dir> needs: source.mp4, performer.png, depth.mp4, plate-1..4.jpg, sheet.png, output.mp4
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const [dir, out, base = 'http://localhost:5173'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const SB = 'https://stub.supabase.test', MEDIA = 'https://stub.media.test';
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 86400;
const jwt = `${b64({ alg: 'HS256' })}.${b64({ sub: 'u-1', role: 'authenticated', aud: 'authenticated', exp })}.sig`;
const user = { id: 'u-1', aud: 'authenticated', role: 'authenticated', email: 'd@example.com', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
const session = { access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 86400, expires_at: exp, user };
const file = n => readFileSync(join(dir, n));
const typeOf = n => (n.endsWith('.mp4') ? 'video/mp4' : n.endsWith('.png') ? 'image/png' : n.endsWith('.jpg') || n.endsWith('.jpeg') ? 'image/jpeg' : 'application/octet-stream');

const uploads = new Map();   // storage key -> { buf, type }
const muapiCalls = [];       // { path, body }
const jobs = []; let plateN = 0; let plateIdx = 0;
const characters = [{ id: 'c1', user_id: 'u-1', name: 'Guest 1', role: 'guest', age_range: 'early-30s', gender: 'female', ethnicity: 'diverse', clothing_style: 'red coat', hair_description: 'curly auburn', distinguishing_features: null, energy_persona: 'friendly', voice_style: 'warm', is_default: false, created_at: new Date().toISOString(), portrait_url: `${MEDIA}/performer.png`, voice_provider: 'elevenlabs', voice_id: 'v1', voice_speed: 1 }];

const json = (r, b, status = 200) => r.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(b) });
const rangeBody = (r, buf, type) => { const h = { 'access-control-allow-origin': '*', 'accept-ranges': 'bytes', 'content-type': type }; const range = r.request().headers()['range']; if (range) { const m = /bytes=(\d+)-(\d*)/.exec(range); const a = +m[1], b = m[2] ? +m[2] : buf.length - 1; return r.fulfill({ status: 206, headers: { ...h, 'content-range': `bytes ${a}-${b}/${buf.length}`, 'content-length': String(b - a + 1) }, body: buf.subarray(a, b + 1) }); } return r.fulfill({ status: 200, headers: { ...h, 'content-length': String(buf.length) }, body: buf }); };
function unwrapMultipart(buf, contentType) {
  const m = /boundary=(.+)$/.exec(contentType || ''); if (!m || !buf) return buf ?? Buffer.alloc(0);
  const delim = Buffer.from('--' + m[1]); let pos = 0;
  while ((pos = buf.indexOf(delim, pos)) !== -1) { const he = buf.indexOf('\r\n\r\n', pos); if (he === -1) break; const next = buf.indexOf(delim, he); if (buf.subarray(pos, he).toString().includes('filename=')) return buf.subarray(he + 4, next === -1 ? undefined : next - 2); pos = he; }
  return buf;
}

// ids -> what the poll returns
const results = {
  depth: { outputs: [`${MEDIA}/depth.mp4`] },
  vision: { outputs: ['```json\n{\n  "summary": "A man speaks into a microphone at a subway station about pineapple on pizza.",\n  "timestamps": [0.8, 1.5, 2.5, 3.2]\n}\n```'] },
  sheet: { outputs: [`${MEDIA}/sheet.png`] },
  writer: { outputs: ['REFERENCE KEY: Video1 is the motion reference. Image1 is the new performer. SCENE AND CAST: a woman in a red coat on a busy subway platform. PRIORITY ORDER: identity, then motion.'] },
  render: { outputs: [`${MEDIA}/output.mp4`] },
};
let renderPolls = 0;

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
await ctx.addInitScript(s => { localStorage.setItem('sb-stub-auth-token', JSON.stringify(s)); localStorage.setItem('subwaytakes.muapi_key', 'mu_test'); }, session);
const page = await ctx.newPage();
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 300)));
page.on('dialog', d => { console.log('DIALOG:', d.message()); d.accept(); });

await page.route(`${MEDIA}/**`, r => { const n = new URL(r.request().url()).pathname.slice(1); if (!existsSync(join(dir, n))) return r.fulfill({ status: 404 }); return rangeBody(r, file(n), typeOf(n)); });
await page.route(`${SB}/**`, async r => {
  const req = r.request(); const u = req.url(); const m = req.method();
  if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
  if (u.includes('/auth/v1/user')) return json(r, user);
  if (u.includes('/auth/v1/')) return json(r, { ...session, user });
  if (u.includes('user_profiles')) return json(r, { id: 'u-1', credits_balance: 1, subscription_tier: 'free' });
  if (u.includes('/storage/v1/object/public/media/')) { const k = decodeURIComponent(u.split('/public/media/')[1]); const b = uploads.get(k); return b ? rangeBody(r, b.buf, b.type) : r.fulfill({ status: 404 }); }
  if (u.includes('/storage/v1/object/media/')) {
    const k = decodeURIComponent(u.split('/object/media/')[1].split('?')[0]);
    // Chromium hides request bodies over ~1MB from Playwright; fall back to the known source file for the (large) source upload.
    const got = unwrapMultipart(req.postDataBuffer(), req.headers()['content-type']);
    const body = got.length ? got : (k.endsWith('source.mp4') ? file('source.mp4') : got);
    uploads.set(k, { buf: body, type: typeOf(k) }); return json(r, { Key: `media/${k}` });
  }
  if (u.includes('/rest/v1/character_bibles')) return json(r, characters);
  if (u.includes('/rest/v1/clip_jobs')) {
    const id = new URL(u).searchParams.get('id')?.replace('eq.', '');
    if (m === 'GET') return json(r, jobs);
    if (m === 'POST') { const row = { id: `j${jobs.length + 1}`, created_at: new Date().toISOString(), error: null, output_url: null, request_id: null, ...JSON.parse(req.postData()) }; jobs.unshift(row); return json(r, row, 201); }
    if (m === 'PATCH') { const row = jobs.find(j => j.id === id); if (row) Object.assign(row, JSON.parse(req.postData())); return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } }); }
  }
  if (u.includes('/functions/v1/muapi-proxy')) {
    const { method, path, body } = JSON.parse(req.postData() || '{}');
    muapiCalls.push({ method, path, body });
    if (path.endsWith('/estimate-cost')) return json(r, { cost: path.includes('wan3') ? 1.0 : path.includes('seedance') ? 1.7 : 0.1 });
    if (path.endsWith('/account/balance')) return json(r, { balance: 5 });
    const sub = /^\/api\/v1\/([\w.\-]+)$/.exec(path);
    if (method === 'POST' && sub) {
      const slug = sub[1]; const kind = slug === 'depth-anything' ? 'depth' : slug === 'gemini-video-vision' ? 'vision' : slug === 'nano-banana-2-edit' ? `plate${++plateN}` : slug === 'gpt-image-2-image-to-image' ? 'sheet' : slug.startsWith('gemini-') ? 'writer' : slug.includes('wan3') || slug.includes('seedance') ? 'render' : 'unknown';
      return json(r, { request_id: `${kind}-req`, status: 'processing', cost: { amount_usd: 0.1 } });
    }
    const pm = /predictions\/([\w\-]+)\/result/.exec(path);
    if (pm) {
      const id = pm[1].replace('-req', '');
      if (id.startsWith('plate')) { const i = ++plateIdx; const f = `plate-${((i - 1) % 4) + 1}.jpg`; return json(r, { status: 'completed', outputs: [`${MEDIA}/${f}`], error: '' }); }
      if (id === 'render') return ++renderPolls < 3 ? json(r, { status: 'processing', outputs: [], error: null }) : json(r, { status: 'completed', ...results.render, error: '' });
      return json(r, { status: 'completed', ...results[id], error: '' });
    }
  }
  return json(r, []);
});

const projectClips = () => page.evaluate(() => JSON.parse(localStorage.getItem('subwaytakes.project.v1') || '{"clips":[]}').clips.map(c => ({ kind: c.kind, label: c.label, start: c.start, duration: c.duration, volume: c.volume, track: c.trackId, src: String(c.src).slice(-40) })));

// ---------------------------------------------------------------- empty state + validation
await page.goto(`${base}/recast`);
await page.getByText('Source clip').waitFor();
await page.screenshot({ path: `${out}/110-recast-empty.png`, fullPage: true });
console.log('EMPTY: run button disabled =', await page.getByRole('button', { name: /^Recast ·/ }).isDisabled(), '| hint:', await page.locator('text=Choose a source clip.').count() ? 'Choose a source clip.' : '(none)');

// a clip that is too long must be rejected with a clear message
const longPath = join(dir, 'too-long.mp4');
if (existsSync(longPath)) {
  await page.getByLabel('Upload source video').setInputFiles(longPath);
  await page.getByText(/15s or shorter/).waitFor({ timeout: 15000 });
  console.log('TOO LONG rejected:', await page.getByText(/15s or shorter/).innerText());
}

// ---------------------------------------------------------------- source + performer
await page.getByLabel('Upload source video').setInputFiles(join(dir, 'source.mp4'));
await page.getByText('has audio').waitFor({ timeout: 30000 });
await page.getByRole('button', { name: /Guest 1/ }).click();
await page.waitForTimeout(900);
const total = await page.getByTestId('recast-total').innerText();
console.log('COST SHOWN before running:', total);
await page.screenshot({ path: `${out}/111-recast-ready.png`, fullPage: true });

// ---------------------------------------------------------------- run
await page.getByRole('button', { name: /^Recast ·/ }).click();
await page.getByText('Rendering the new performer').waitFor({ timeout: 60000 });
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/112-recast-progress.png`, fullPage: true });
await page.getByLabel('Recast result').waitFor({ timeout: 120000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/113-recast-result.png`, fullPage: true });

const slugs = muapiCalls.filter(c => c.method === 'POST' && !c.path.includes('estimate')).map(c => c.path.replace('/api/v1/', ''));
console.log('SUBMITTED ORDER', JSON.stringify(slugs));
const render = muapiCalls.find(c => c.path.includes('wan3.0') && c.method === 'POST')?.body;
console.log('RENDER BODY', JSON.stringify({ ...render, prompt: String(render?.prompt).slice(0, 60) + '…', images_list: render?.images_list?.map(u => u.slice(-30)), videos_list: render?.videos_list?.map(u => u.slice(-30)) }));

// real canvas outputs captured from the upload requests
for (const [k, v] of uploads) {
  if (/frame-\d\.jpg$|contact-sheet\.jpg$/.test(k)) { const f = join(out, k.split('-').slice(2).join('-') || k.split('/').pop()); writeFileSync(f, v.buf); console.log('CANVAS OUTPUT', k.split('/').pop().replace(/^\d+-\w+-/, ''), v.buf.length, 'bytes', 'jpeg magic:', v.buf.subarray(0, 3).toString('hex')); }
}
const warnings = await page.locator('section[aria-label="Recast progress"] li.flex.gap-1\\.5').allInnerTexts().catch(() => []);
console.log('WARNINGS SHOWN', JSON.stringify(warnings));
console.log('JOB ROWS', JSON.stringify(jobs.map(j => [j.pipeline, j.status, j.stage, !!j.output_url])));

// ---------------------------------------------------------------- add to timeline
await page.getByRole('button', { name: 'Add to timeline' }).click();
await page.waitForURL('**/create');
await page.getByLabel('Recast clip').first().waitFor({ timeout: 15000 });
await page.waitForTimeout(1500);
console.log('TIMELINE CLIPS', JSON.stringify(await projectClips()));
await page.screenshot({ path: `${out}/114-recast-on-timeline.png` });

// ---------------------------------------------------------------- export and keep the file for ffprobe
await page.getByRole('button', { name: 'Export', exact: true }).click();
await page.getByRole('button', { name: 'Start export' }).click();
await page.getByText('Export ready').waitFor({ timeout: 300000 });
const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: /Download/ }).click()]);
await dl.saveAs(join(out, 'recast-export.mp4')); console.log('EXPORTED');
await browser.close();
