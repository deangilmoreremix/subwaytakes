// E2E for Cast + Voice/lipsync using REAL assets from a live run (portrait.png, tts.mp3, oh.mp4, eleven_meta.json) behind a stubbed network.
// Verifies: character creation, portrait upload, voice choice, cost estimate, request bodies sent to muapi, the padded WAV the browser produced, and the clip landing on the timeline.
// Usage: node scripts/lipsync-e2e.mjs <assets-dir> <outDir> [baseUrl]
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
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
const meta = JSON.parse(file('eleven_meta.json').toString());

// supabase-js sends uploads as multipart/form-data; real Supabase stores only the file part, so do the same.
function unwrapMultipart(buf, contentType) {
  const m = /boundary=(.+)$/.exec(contentType || ''); if (!m) return buf;
  const delim = Buffer.from('--' + m[1]); let pos = 0;
  while ((pos = buf.indexOf(delim, pos)) !== -1) {
    const hdrEnd = buf.indexOf('\r\n\r\n', pos); if (hdrEnd === -1) break;
    const next = buf.indexOf(delim, hdrEnd);
    if (buf.subarray(pos, hdrEnd).toString().includes('filename=')) return buf.subarray(hdrEnd + 4, next === -1 ? undefined : next - 2);
    pos = hdrEnd;
  }
  return buf;
}
const chars = []; const jobs = []; const uploads = new Map(); const muapiCalls = []; let ohPolls = 0;
const json = (r, b, status = 200) => r.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(b) });
const rangeBody = (r, buf, type) => { const h = { 'access-control-allow-origin': '*', 'accept-ranges': 'bytes', 'content-type': type }; const range = r.request().headers()['range']; if (range) { const m = /bytes=(\d+)-(\d*)/.exec(range); const a = +m[1], b = m[2] ? +m[2] : buf.length - 1; return r.fulfill({ status: 206, headers: { ...h, 'content-range': `bytes ${a}-${b}/${buf.length}`, 'content-length': String(b - a + 1) }, body: buf.subarray(a, b + 1) }); } return r.fulfill({ status: 200, headers: { ...h, 'content-length': String(buf.length) }, body: buf }); };

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
await ctx.addInitScript(s => { localStorage.setItem('sb-stub-auth-token', JSON.stringify(s)); localStorage.setItem('subwaytakes.muapi_key', 'mu_test'); }, session);
const page = await ctx.newPage();
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 200)));

await page.route(`${MEDIA}/**`, r => { const n = new URL(r.request().url()).pathname.slice(1); return rangeBody(r, file(n), n.endsWith('.mp3') ? 'audio/mpeg' : n.endsWith('.png') ? 'image/png' : 'video/mp4'); });
await page.route(`${SB}/**`, async r => {
  const req = r.request(); const u = req.url(); const m = req.method();
  if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
  if (u.includes('/auth/v1/user')) return json(r, user);
  if (u.includes('/auth/v1/')) return json(r, { ...session, user });
  if (u.includes('user_profiles')) return json(r, { id: 'u-1', credits_balance: 1, subscription_tier: 'free' });
  if (u.includes('/storage/v1/object/public/media/')) { const k = decodeURIComponent(u.split('/public/media/')[1]); const b = uploads.get(k); return b ? rangeBody(r, b.buf, b.type) : r.fulfill({ status: 404 }); }
  if (u.includes('/storage/v1/object/media/')) { const k = decodeURIComponent(u.split('/object/media/')[1].split('?')[0]); // Chromium does not expose request bodies over ~1 MB to Playwright, so for the (large) portrait fall back to the source file the test selected.
    const captured = unwrapMultipart(req.postDataBuffer() ?? Buffer.alloc(0), req.headers()['content-type']); const body = captured.length ? captured : (k.endsWith('portrait.png') ? file('portrait.png') : captured);
    uploads.set(k, { buf: body, type: k.endsWith('.wav') ? 'audio/wav' : k.endsWith('.png') ? 'image/png' : 'application/octet-stream' }); return json(r, { Key: `media/${k}` }); }
  if (u.includes('/rest/v1/character_bibles')) {
    const id = new URL(u).searchParams.get('id')?.replace('eq.', '');
    if (m === 'GET') return json(r, chars);
    if (m === 'POST') { const row = { id: `c${chars.length + 1}`, created_at: new Date().toISOString(), ...JSON.parse(req.postData()) }; chars.push(row); return json(r, row, 201); }
    if (m === 'PATCH') { const row = chars.find(c => c.id === id); Object.assign(row, JSON.parse(req.postData())); return json(r, row); }
    if (m === 'DELETE') { chars.splice(chars.findIndex(c => c.id === id), 1); return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } }); }
  }
  if (u.includes('/rest/v1/clip_jobs')) {
    const id = new URL(u).searchParams.get('id')?.replace('eq.', '');
    if (m === 'GET') return json(r, jobs);
    if (m === 'POST') { const row = { id: `j${jobs.length + 1}`, created_at: new Date().toISOString(), error: null, output_url: null, request_id: null, ...JSON.parse(req.postData()) }; jobs.unshift(row); return json(r, row, 201); }
    if (m === 'PATCH') { const row = jobs.find(j => j.id === id); if (row) Object.assign(row, JSON.parse(req.postData())); return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } }); }
  }
  if (u.includes('/functions/v1/muapi-proxy')) {
    const { method, path, body } = JSON.parse(req.postData() || '{}');
    muapiCalls.push({ method, path, body });
    if (path === '/api/v1/models/elevenlabs-tts-turbo-2-5') return json(r, meta);
    if (path.endsWith('/estimate-cost')) return json(r, { cost: path.includes('omnihuman') ? 0.5 : path.includes('kling') ? 0.35 : path.includes('gpt-image') ? 0.025 : 0.0035 });
    if (path === '/api/v1/elevenlabs-tts-turbo-2-5') return json(r, { request_id: 'tts1' });
    if (path === '/api/v1/gpt-image-2-text-to-image') return json(r, { request_id: 'img1' });
    if (path === '/api/v1/omnihuman-2-0') return json(r, { request_id: 'oh1' });
    if (path.includes('predictions/tts1')) return json(r, { status: 'completed', outputs: [`${MEDIA}/tts.mp3`], error: '' });
    if (path.includes('predictions/img1')) return json(r, { status: 'completed', outputs: [`${MEDIA}/portrait.png`], error: '' });
    if (path.includes('predictions/oh1')) return ++ohPolls < 3 ? json(r, { status: 'processing', outputs: [], error: null }) : json(r, { status: 'completed', outputs: [`${MEDIA}/oh.mp4`], error: '' });
    if (path.endsWith('/account/balance')) return json(r, { balance: 6.74 });
  }
  return json(r, []);
});

// ---------------------------------------------------------------- Cast
await page.goto(`${base}/cast`);
await page.getByText('No characters yet').waitFor();
await page.screenshot({ path: `${out}/100-cast-empty.png` });
await page.getByRole('button', { name: 'Guest', exact: true }).click();
await page.getByLabel('Character name').waitFor();
// upload the real portrait through the real file input
await page.getByLabel('Upload portrait').setInputFiles(join(dir, 'portrait.png'));
await page.getByAltText(/portrait/).waitFor({ timeout: 15000 });
// pick a voice from the live-style list
await page.getByLabel('Voice', { exact: true }).selectOption({ label: 'Mark - Casual, Relaxed and Light' });
await page.waitForTimeout(500);
await page.waitForTimeout(1500);
console.log('IMAGES', JSON.stringify(await page.evaluate(() => [...document.images].map(i => [i.src.slice(-40), i.complete, i.naturalWidth]))));
console.log('UPLOAD KEYS', JSON.stringify([...uploads.entries()].map(([k, v]) => [k, v.buf.length, v.type, v.buf.subarray(0, 4).toString('hex')])));
await page.screenshot({ path: `${out}/101-cast-editor.png` });
const saved = chars[0];
console.log('CHARACTER SAVED', JSON.stringify({ name: saved.name, role: saved.role, portrait: String(saved.portrait_url).includes('/storage/v1/object/public/media/u-1/'), voice_provider: saved.voice_provider, voice_id: saved.voice_id, voice_speed: saved.voice_speed }));
// voice preview plays through the TTS stub
await page.getByRole('button', { name: 'Preview voice' }).click();
await page.getByRole('button', { name: /Stop|Preview voice/ }).first().waitFor();
await page.waitForTimeout(1500);
console.log('PREVIEW TTS REQUEST', JSON.stringify(muapiCalls.filter(c => c.path === '/api/v1/elevenlabs-tts-turbo-2-5').map(c => c.body)));

// ---------------------------------------------------------------- Create: Voice + lipsync
muapiCalls.length = 0;
await page.getByRole('link', { name: 'Create' }).first().click().catch(() => page.goto(`${base}/create`));
await page.getByRole('button', { name: 'Model', exact: true }).click();
await page.getByRole('button', { name: 'Voice + lipsync' }).click();
await page.getByRole('button', { name: /Guest 1|Guest/ }).first().waitFor();
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/102-model-tab-lipsync.png` });
const cost = await page.getByText('Estimated cost').locator('xpath=following-sibling::span').innerText();
console.log('ESTIMATED COST SHOWN', cost);
await page.getByRole('button', { name: /Generate/ }).click();
await page.getByText('Preparing audio').waitFor({ timeout: 20000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/103-lipsync-stages.png` });
await page.waitForFunction(() => { try { return JSON.parse(localStorage.getItem('subwaytakes.project.v1')).clips.some(c => c.kind === 'video'); } catch { return false; } }, null, { timeout: 120000 });
await page.waitForTimeout(1500);
const submitted = muapiCalls.filter(c => c.method === 'POST' && !c.path.includes('estimate') && !c.path.includes('predictions')).map(c => ({ path: c.path, body: c.body }));
console.log('SUBMITTED', JSON.stringify(submitted));
const wavEntry = [...uploads.entries()].find(([k]) => k.endsWith('voice.wav'));
if (wavEntry) { writeFileSync(join(out, 'browser-padded.wav'), wavEntry[1].buf); console.log('PADDED WAV saved', wavEntry[1].buf.length, 'bytes'); } else console.log('NO PADDED WAV UPLOADED');
const clips = await page.evaluate(() => JSON.parse(localStorage.getItem('subwaytakes.project.v1')).clips.map(c => [c.kind, c.start, c.duration, c.label]));
console.log('TIMELINE', JSON.stringify(clips));
console.log('JOB ROWS', JSON.stringify(jobs.map(j => [j.pipeline, j.model, j.status, j.stage, j.output_url && 'url'])));
await page.screenshot({ path: `${out}/104-lipsync-on-timeline.png` });
await browser.close();
