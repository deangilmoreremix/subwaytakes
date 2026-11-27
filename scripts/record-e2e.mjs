// Browser test for "record your own voice" using Chromium's FAKE microphone (a built-in beep), so the REAL MediaRecorder, decode and WAV code run.
// Network is stubbed (no real Supabase, no real muapi). It proves: the teleprompter runs, a recording is made and converted to a mono WAV,
// the WAV is uploaded to the media bucket, and Generate then sends NO text-to-speech request and renders with the recording.
// A real person's voice and real microphone hardware are NOT covered by this test.
// Run the dev server in the default (BYOK) mode. Usage: node scripts/record-e2e.mjs <outDir> [baseUrl]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [out, base = 'http://localhost:5173'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const SB = 'https://stub.supabase.test';
const GOOD = 'mk_live_RECORDTESTKEY0123456789ab';
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 86400;
const jwt = `${b64({ alg: 'HS256' })}.${b64({ sub: 'u-1', role: 'authenticated', aud: 'authenticated', exp })}.sig`;
const json = (r, b, status = 200) => r.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(b) });
let failures = 0;
const check = (name, ok, extra = '') => { console.log(ok ? 'PASS' : 'FAIL', name, extra); if (!ok) failures++; };

const user = { id: 'u-1', aud: 'authenticated', role: 'authenticated', email: 'd@example.com', is_anonymous: false, app_metadata: {}, user_metadata: {}, email_confirmed_at: new Date().toISOString(), created_at: new Date().toISOString() };
const session = { access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 86400, expires_at: exp, user };
// a guest with a portrait but NO voice picked in Cast
const CHAR = { id: 'c1', user_id: 'u-1', name: 'Maya', role: 'guest', age_range: 'late-20s', gender: 'woman', ethnicity: 'latina', clothing_style: 'a yellow raincoat', hair_description: 'big curls', distinguishing_features: null, energy_persona: 'warm', voice_style: '', is_default: false, created_at: new Date().toISOString(), portrait_url: 'https://stub.media.test/portrait.png', voice_provider: null, voice_id: null, voice_speed: 1 };


// a real 5 second WAV (a quiet tone) standing in for the host's text-to-speech result
const TONE = (() => { const sr = 16000, n = sr * 5, b = Buffer.alloc(44 + n * 2); b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40); for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(3000 * Math.sin(i / 20)), 44 + i * 2); return b; })();

const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2, permissions: ['microphone'] });
await ctx.addInitScript(([s, k]) => { localStorage.setItem('sb-stub-auth-token', JSON.stringify(s)); localStorage.setItem('subwaytakes.muapi.key', k); }, [session, GOOD]);
const page = await ctx.newPage();
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 200)));
page.on('dialog', d => d.accept());

const proxy = []; const uploads = []; const stored = new Map();
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
await page.route('https://stub.media.test/**', r => r.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: PNG }));
await page.route(`${SB}/**`, async r => {
  const req = r.request(); const u = req.url(); const m = req.method();
  if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
  if (u.includes('/auth/v1/user')) return json(r, user);
  if (u.includes('/auth/v1/')) return json(r, { ...session, user });
  if (u.includes('/storage/v1/object/subwaytakes-media/')) {
    const body = req.postDataBuffer(); uploads.push({ path: decodeURIComponent(u.split('/object/subwaytakes-media/')[1].split('?')[0]), bytes: body?.length ?? 0, head: body && body.includes('RIFF') ? 'RIFF' : '', type: req.headers()['content-type'] });
    if (body) { const a = body.indexOf('RIFF'), z = body.lastIndexOf('\r\n--'); stored.set(uploads[uploads.length - 1].path, body.subarray(a, z > a ? z : body.length)); }
    return json(r, { Key: 'subwaytakes-media/x' });
  }
  if (u.includes('/storage/v1/object/public/subwaytakes-media/')) {
    const k = decodeURIComponent(u.split('/public/subwaytakes-media/')[1]); const b = stored.get(k);
    return b ? r.fulfill({ status: 200, contentType: 'audio/wav', headers: { 'access-control-allow-origin': '*' }, body: b }) : r.fulfill({ status: 404 });
  }
  if (u.includes('/functions/v1/subwaytakes-byok')) {
    const { method, path, body } = JSON.parse(req.postData() || '{}'); proxy.push({ method, path, body, key: req.headers()['x-muapi-key'] });
    if (path === '/api/v1/account/balance') return json(r, { balance: 20 });
    if (path.endsWith('/estimate-cost')) return json(r, { cost: 40, unit: 'cents' });
    if (method === 'POST' && /^\/api\/v1\/[\w.\-]+$/.test(path)) return json(r, { request_id: 'req-' + proxy.length, status: 'processing' });
    if (/predictions\/req-\d+\/result/.test(path)) return json(r, { status: 'completed', outputs: ['https://stub.media.test/out.mp4'] });
    return json(r, {});
  }
  if (u.includes('/rest/v1/character_bibles')) return json(r, m === 'GET' ? [CHAR] : CHAR);
  if (u.includes('/rest/v1/clip_jobs')) return m === 'GET' ? json(r, []) : json(r, { id: 'j1', created_at: new Date().toISOString(), error: null, output_url: null, request_id: null }, 201);
  if (u.includes('user_profiles')) return json(r, { id: 'u-1', credits_balance: 0, subscription_tier: 'free' });
  return json(r, []);
});

await page.goto(`${base}/create`);
await page.getByRole('button', { name: 'Model', exact: true }).click();
await page.getByRole('button', { name: 'Voice + lipsync' }).click();
await page.getByRole('button', { name: /Maya/ }).first().click();
await page.getByTestId('own-voice').waitFor({ timeout: 20000 });
check('the character has no voice, so without a recording generation is blocked', /no voice/.test(await page.locator('body').innerText()));
await page.screenshot({ path: `${out}/01-own-voice-card.png` });

// ---- record
await page.getByTestId('own-voice-record').click();
await page.getByTestId('record-modal').waitFor();
check('the teleprompter shows the line word by word', (await page.getByTestId('teleprompter').innerText()).includes('Pineapple'));
await page.screenshot({ path: `${out}/02-teleprompter.png` });
await page.getByTestId('record-start').click();
await page.getByTestId('record-countdown').waitFor({ timeout: 5000 });
check('a 3-2-1 countdown runs first', true);
await page.getByTestId('record-stop').waitFor({ timeout: 8000 });
check('recording starts with the level meter', await page.getByTestId('record-meter').isVisible());
await page.waitForTimeout(3500);
await page.screenshot({ path: `${out}/03-recording.png` });
const highlighted = await page.getByTestId('teleprompter').locator('span.bg-accent').count();
check('the teleprompter highlights the word being read', highlighted === 1);
await page.getByTestId('record-stop').click();
await page.getByTestId('record-review').waitFor({ timeout: 10000 });
check('after Stop the recording can be played back before it is used', await page.locator('[data-testid=record-review] audio').count() === 1);
await page.screenshot({ path: `${out}/04-review.png` });

// ---- use it
await page.getByTestId('record-use').click();
await page.getByTestId('record-modal').waitFor({ state: 'detached', timeout: 10000 });
check('the recording is uploaded to the user\'s own folder of the media bucket as a WAV', uploads.length === 1 && /^u-1\/.*my-take\.wav$/.test(uploads[0].path) && uploads[0].head === 'RIFF', JSON.stringify(uploads[0]));
check('the panel now says it is using the recording', /Using your recording/.test(await page.getByTestId('own-voice').innerText()));
check('the missing voice no longer blocks generation', !/no voice/.test(await page.locator('body').innerText().then(t => t.replace(/no voice/g, 'no voice')).then(t => (t.match(/This character has no voice yet/) ? 'no voice' : ''))));
await page.screenshot({ path: `${out}/05-using-recording.png` });

// ---- generate: no text-to-speech, render with the recording
proxy.length = 0;
await page.getByRole('button', { name: /^Generate/ }).first().click();
await page.waitForFunction(() => document.body.innerText.includes('Shot') || true, null, { timeout: 2000 }).catch(() => {});
await page.waitForTimeout(6000);
const submits = proxy.filter(p => p.method === 'POST' && !p.path.endsWith('/estimate-cost'));
check('no text-to-speech request is sent', !submits.some(s => /tts|speech/.test(s.path)), JSON.stringify(submits.map(s => s.path)));
const render = submits.find(s => /omnihuman|avatar/.test(s.path));
check('the video model is called with the recording as its audio', !!render && String(render.body?.audio_url).includes('/storage/v1/object/public/subwaytakes-media/u-1/') && /my-take\.wav$/.test(String(render.body.audio_url)), render ? String(render.body?.audio_url) : 'no render call');
check('the key is sent to the proxy, never in a body', !JSON.stringify(proxy.map(p => p.body)).includes(GOOD));
await page.screenshot({ path: `${out}/06-generated.png` });

// ---- editing the take makes the recording stale
await page.getByRole('button', { name: 'Take', exact: true }).click();
await page.locator('textarea').first().fill('A completely different line now.');
await page.getByRole('button', { name: 'Model', exact: true }).click();
check('editing the line drops the old recording (it was made for another line)', !/Using your recording/.test(await page.getByTestId('own-voice').innerText()));

// ---- Cuts: the host keeps the Cast voice, the guest's line is recorded
{
  const HOST = { ...CHAR, id: 'c2', name: 'Host Hank', role: 'host', voice_provider: 'elevenlabs', voice_id: 'v-host' };
  const c2 = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['microphone'] });
  await c2.addInitScript(([s, k]) => { localStorage.setItem('sb-stub-auth-token', JSON.stringify(s)); localStorage.setItem('subwaytakes.muapi.key', k); }, [session, GOOD]);
  const p3 = await c2.newPage();
  p3.on('dialog', d => d.accept());
  const calls = []; const stored2 = new Map();
  await p3.route('https://stub.media.test/**', r => /\.mp3$/.test(r.request().url()) ? r.fulfill({ status: 200, contentType: 'audio/wav', headers: { 'access-control-allow-origin': '*' }, body: TONE }) : r.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: PNG }));
  await p3.route(`${SB}/**`, async r => {
    const req = r.request(); const u = req.url(); const m = req.method();
    if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (u.includes('/auth/v1/user')) return json(r, user);
    if (u.includes('/auth/v1/')) return json(r, { ...session, user });
    if (u.includes('/storage/v1/object/subwaytakes-media/')) { const b = req.postDataBuffer(); const a = b.indexOf('RIFF'), z = b.lastIndexOf('\r\n--'); stored2.set(decodeURIComponent(u.split('/object/subwaytakes-media/')[1].split('?')[0]), b.subarray(a, z > a ? z : b.length)); return json(r, { Key: 'x' }); }
    if (u.includes('/storage/v1/object/public/subwaytakes-media/')) { const b = stored2.get(decodeURIComponent(u.split('/public/subwaytakes-media/')[1])); return b ? r.fulfill({ status: 200, contentType: 'audio/wav', headers: { 'access-control-allow-origin': '*' }, body: b }) : r.fulfill({ status: 404 }); }
    if (u.includes('/functions/v1/subwaytakes-byok')) {
      const { method, path, body } = JSON.parse(req.postData() || '{}'); calls.push({ method, path, body });
      if (path === '/api/v1/account/balance') return json(r, { balance: 20 });
      if (path.endsWith('/estimate-cost')) return json(r, { cost: 40, unit: 'cents' });
      if (method === 'POST' && /^\/api\/v1\/[\w.\-]+$/.test(path)) return json(r, { request_id: 'req-' + calls.length, status: 'processing' });
      if (/predictions\/req-\d+\/result/.test(path)) return json(r, { status: 'completed', outputs: [/tts/.test(JSON.stringify(calls)) ? 'https://stub.media.test/voice.mp3' : 'https://stub.media.test/out.mp4'] });
      return json(r, {});
    }
    if (u.includes('/rest/v1/character_bibles')) return json(r, m === 'GET' ? [HOST, CHAR] : CHAR);
    if (u.includes('/rest/v1/clip_jobs')) return m === 'GET' ? json(r, []) : json(r, { id: 'j1', created_at: new Date().toISOString(), error: null, output_url: null, request_id: null }, 201);
    if (u.includes('user_profiles')) return json(r, { id: 'u-1', credits_balance: 0, subscription_tier: 'free' });
    return json(r, []);
  });
  await p3.goto(`${base}/create`);
  await p3.getByRole('button', { name: 'Model', exact: true }).click();
  await p3.getByRole('button', { name: /^Cuts/ }).first().click();
  await p3.getByTestId('cuts-own-voice').first().waitFor({ timeout: 20000 });
  await p3.getByRole('button', { name: /Host Hank/ }).first().click();        // host picker
  await p3.getByRole('button', { name: /Maya/ }).nth(1).click();              // guest picker (Maya has a portrait and no voice)
  check('Cuts offers "read this line yourself" for the host and the guest', (await p3.getByTestId('cuts-own-voice').count()) >= 2);
  check('with the guest having no voice, Cuts says so', /guest needs a portrait and a voice/.test(await p3.locator('body').innerText()));
  await p3.getByTestId('cuts-record').nth(1).click();           // the guest's line
  await p3.getByTestId('record-modal').waitFor();
  await p3.getByTestId('record-start').click();
  await p3.getByTestId('record-stop').waitFor({ timeout: 8000 });
  await p3.waitForTimeout(3000);
  await p3.getByTestId('record-stop').click();
  await p3.getByTestId('record-review').waitFor({ timeout: 10000 });
  await p3.getByTestId('record-use').click();
  await p3.getByTestId('record-modal').waitFor({ state: 'detached', timeout: 10000 });
  check('the guest line shows as recorded and the voice problem is gone', /Using your recording/.test(await p3.getByTestId('cuts-own-voice').nth(1).innerText()) && !/guest needs a portrait and a voice/.test(await p3.locator('body').innerText()));
  await p3.screenshot({ path: `${out}/08-cuts-own-voice.png` });
  calls.length = 0;
  await p3.getByRole('button', { name: /^Generate/ }).first().click();
  await p3.waitForTimeout(12000);
  const posts = calls.filter(c => c.method === 'POST' && !c.path.endsWith('/estimate-cost'));
  const tts = posts.filter(c => /tts|speech/.test(c.path));
  const renders = posts.filter(c => /omnihuman|avatar/.test(c.path));
  check('only the HOST line is turned into speech (one paid voice step, not two)', tts.length === 1, JSON.stringify(posts.map(c => c.path)));
  check('both shots are rendered', renders.length === 2, String(renders.length));
  check('the guest shot is rendered with your recording (padded copy in your own folder), the host shot with the Cast voice', renders.some(r => /subwaytakes-media\/u-1\/.*voice\.wav$/.test(String(r.body?.audio_url))) && renders.some(r => /voice\.mp3$/.test(String(r.body?.audio_url))), JSON.stringify(renders.map(r => r.body?.audio_url)));
  await c2.close();
}

// ---- permission denied is explained, not a dead button
const denied = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await denied.addInitScript(([s, k]) => { localStorage.setItem('sb-stub-auth-token', JSON.stringify(s)); localStorage.setItem('subwaytakes.muapi.key', k); navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('no', 'NotAllowedError')); }, [session, GOOD]);
const p2 = await denied.newPage();
await p2.route(`${SB}/**`, async r => { const u = r.request().url(); if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } }); if (u.includes('/auth/v1/user')) return json(r, user); if (u.includes('/auth/v1/')) return json(r, { ...session, user }); if (u.includes('character_bibles')) return json(r, [CHAR]); if (u.includes('subwaytakes-byok')) return json(r, { balance: 1 }); return json(r, []); });
await p2.route('https://stub.media.test/**', r => r.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: PNG }));
await p2.goto(`${base}/create`);
await p2.getByRole('button', { name: 'Model', exact: true }).click();
await p2.getByRole('button', { name: 'Voice + lipsync' }).click();
await p2.getByRole('button', { name: /Maya/ }).first().click();
await p2.getByTestId('own-voice-record').click();
await p2.getByTestId('record-start').click();
await p2.getByTestId('record-error').waitFor({ timeout: 8000 });
check('a blocked microphone is explained', /blocked/.test(await p2.getByTestId('record-error').innerText()));
await p2.screenshot({ path: `${out}/07-mic-blocked.png` });

await browser.close();
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED (fake microphone, stubbed network; no real voice, no real muapi)');
process.exit(failures ? 1 : 0);
