// Stubbed browser test of the Two-shot host picker. NO real generations: network is stubbed; the UI, routing and request bodies are real.
// Usage: node scripts/twoshot-e2e.mjs <image.png> <video.mp4> <outDir> [baseUrl]
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [img, vid, out, base = 'http://localhost:5173'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const SB = 'https://stub.supabase.test', MEDIA = 'https://stub.media.test';
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 86400;
const jwt = `${b64({ alg: 'HS256' })}.${b64({ sub: 'u-1', role: 'authenticated', aud: 'authenticated', exp })}.sig`;
const user = { id: 'u-1', aud: 'authenticated', role: 'authenticated', email: 'd@example.com', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
const session = { access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 86400, expires_at: exp, user };
const ch = (id, name, role, portrait) => ({ id, user_id: 'u-1', name, role, age_range: 'late-20s', gender: 'female', ethnicity: 'latina', clothing_style: 'a yellow bomber jacket', hair_description: 'big curls', distinguishing_features: 'round sunglasses', energy_persona: 'witty', voice_style: '', is_default: false, created_at: '', portrait_url: portrait ? `${MEDIA}/portrait.png` : null, voice_provider: 'elevenlabs', voice_id: 'v1', voice_speed: 1 });
const chars = [ch('h1', 'Rae', 'host', true), ch('h2', 'No Photo', 'host', false)];
const json = (r, b) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(b) });
const uploads = new Map(); const calls = []; const jobs = [];

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
await ctx.addInitScript(s => { localStorage.setItem('sb-stub-auth-token', JSON.stringify(s)); localStorage.setItem('subwaytakes.muapi_key', 'mu_test'); }, session);
const page = await ctx.newPage();
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 200)));
page.on('dialog', d => { console.log('DIALOG:', d.message()); d.accept(); });
const media = (r, buf, type) => r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': type, 'accept-ranges': 'bytes' }, body: buf });
await page.route(`${MEDIA}/**`, r => { const n = new URL(r.request().url()).pathname; return n.endsWith('.mp4') || n.includes('veo') ? media(r, readFileSync(vid), 'video/mp4') : media(r, readFileSync(img), 'image/png'); });
await page.route(`${SB}/**`, async r => {
  const req = r.request(); const u = req.url(); const m = req.method();
  if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
  if (u.includes('/auth/v1/user')) return json(r, user);
  if (u.includes('/auth/v1/')) return json(r, { ...session, user });
  if (u.includes('user_profiles')) return json(r, { id: 'u-1', credits_balance: 1, subscription_tier: 'free' });
  if (u.includes('/storage/v1/object/public/media/')) { const k = decodeURIComponent(u.split('/public/media/')[1]); const b = uploads.get(k); return b ? media(r, b.buf, b.type) : r.fulfill({ status: 404 }); }
  if (u.includes('/storage/v1/object/media/')) { const k = decodeURIComponent(u.split('/object/media/')[1].split('?')[0]); uploads.set(k, { buf: readFileSync(img), type: 'image/png' }); return json(r, { Key: `media/${k}` }); }
  if (u.includes('/rest/v1/character_bibles')) return json(r, chars);
  if (u.includes('/rest/v1/clip_jobs')) {
    const id = new URL(u).searchParams.get('id')?.replace('eq.', '');
    if (m === 'GET') return json(r, jobs);
    if (m === 'POST') { const row = { id: `j${jobs.length + 1}`, created_at: new Date().toISOString(), error: null, output_url: null, request_id: null, ...JSON.parse(req.postData()) }; jobs.unshift(row); return json(r, row); }
    if (m === 'PATCH') { const row = jobs.find(j => j.id === id); if (row) Object.assign(row, JSON.parse(req.postData())); return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } }); }
  }
  if (u.includes('/functions/v1/muapi-proxy')) {
    const { method, path, body } = JSON.parse(req.postData() || '{}');
    if (path.endsWith('/estimate-cost')) return json(r, { cost: 0.3 });
    const sub = /^\/api\/v1\/([\w.\-]+)$/.exec(path);
    if (method === 'POST' && sub) { calls.push({ slug: sub[1], body }); return json(r, { request_id: `req-${sub[1]}`, status: 'processing' }); }
    const pm = /predictions\/req-([\w.\-]+)\/result/.exec(path);
    if (pm) return json(r, { status: 'completed', outputs: [pm[1].includes('image-to-video') ? `${MEDIA}/${pm[1]}.mp4` : `${MEDIA}/${pm[1]}.png`], error: '' });
  }
  return json(r, []);
});

await page.goto(`${base}/create`);
const take = page.getByRole('button', { name: 'Take', exact: true });
await take.click();
await page.getByRole('group', { name: 'Host source' }).waitFor();
await page.screenshot({ path: `${out}/01-host-describe.png` });

// host without a portrait: falls back to text with a hint, text-to-video models
await page.getByRole('button', { name: 'No Photo' }).click();
console.log('NO-PHOTO HINT:', await page.getByText(/has no portrait yet/).innerText());
await page.getByRole('button', { name: 'Model', exact: true }).click();
console.log('NO-PHOTO MODELS:', await page.getByText(/\(image\)/).count(), 'image models shown (expect 0)');
await take.click();

// host with a portrait: image route
await page.getByRole('button', { name: 'Rae' }).click();
await page.screenshot({ path: `${out}/02-host-cast.png` });
await page.getByRole('button', { name: 'Model', exact: true }).click();
const imgModels = await page.getByText(/\(image\)/).allInnerTexts();
console.log('IMAGE ROUTE MODELS:', imgModels);
await page.screenshot({ path: `${out}/03-model-image-route.png` });
await page.getByRole('button', { name: /Generate/ }).click();
await page.waitForFunction(() => document.querySelector('video') || document.body.innerText.includes('Export'), null, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(2500);
console.log('CALL ORDER:', calls.map(c => c.slug));
console.log('STILL BODY:', JSON.stringify({ ...calls[0]?.body, prompt: String(calls[0]?.body?.prompt).slice(0, 160) + '…' }));
console.log('ANIMATE BODY:', JSON.stringify({ ...calls[1]?.body, prompt: String(calls[1]?.body?.prompt).slice(0, 120) + '…' }));
console.log('JOB ROWS:', JSON.stringify(jobs.map(j => [j.pipeline, j.model, j.status, j.stage])));
const clips = await page.evaluate(() => JSON.parse(localStorage.getItem('subwaytakes.project.v1') || '{"clips":[]}').clips.map(c => [c.kind, c.src]));
console.log('TIMELINE:', JSON.stringify(clips));
await page.screenshot({ path: `${out}/04-after-generate.png` });
await browser.close();
