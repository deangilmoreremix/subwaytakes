// Browser test of the narrated (faceless) video through the real UI: one voice, one picture per scene, the words as captions (network stubbed; REAL pictures and a REAL wav).
// <mediaDir> holds img0.png.. and voice.wav. Saves <outDir>/narr-project.json so it can be exported for real: node scripts/export-project.mjs <mediaDir> <outDir>/narr-project.json out.mp4
// Run the dev server in the default mode. Usage: node scripts/narrated-e2e.mjs <video.mp4> <outDir> [baseUrl]
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [media, out, base = 'http://localhost:5173'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const SB = 'https://stub.supabase.test';
const GOOD = 'mk_live_NARRTESTKEY0123456789abcdef';
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 86400;
const jwt = `${b64({ alg: 'HS256' })}.${b64({ sub: 'u-1', role: 'authenticated', aud: 'authenticated', exp })}.sig`;
const json = (r, b, status = 200) => r.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(b) });
let failures = 0;
const check = (name, ok, extra = '') => { console.log(ok ? 'PASS' : 'FAIL', name, extra); if (!ok) failures++; };
const user = { id: 'u-1', aud: 'authenticated', role: 'authenticated', email: 'd@example.com', is_anonymous: false, app_metadata: {}, user_metadata: {}, email_confirmed_at: new Date().toISOString(), created_at: new Date().toISOString() };
const session = { access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 86400, expires_at: exp, user };

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
await ctx.addInitScript(([s, k]) => { localStorage.setItem('sb-stub-auth-token', JSON.stringify(s)); localStorage.setItem('subwaytakes.muapi.key', k); }, [session, GOOD]);
const page = await ctx.newPage();
page.on('pageerror', e => { if (!/MediaPlaybackError/.test(String(e))) console.log('[pageerror]', String(e).slice(0, 200)); });
page.on('dialog', d => { console.log('  CONFIRM:', d.message()); d.accept(); });
const proxy = []; let n = 0; let imgs = 0; const outputs = {};
await page.route('https://stub.media.test/**', r => {
  const f = new URL(r.request().url()).pathname.split('/').pop();
  let buf; try { buf = readFileSync(`${media}/${f}`); } catch { return r.fulfill({ status: 404, body: 'nope' }); }
  return r.fulfill({ status: 200, contentType: f.endsWith('.wav') ? 'audio/wav' : 'image/png', headers: { 'access-control-allow-origin': '*' }, body: buf });
});
await page.route(`${SB}/**`, async r => {
  const req = r.request(); const u = req.url(); const m = req.method();
  if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
  if (u.includes('/auth/v1/user')) return json(r, user);
  if (u.includes('/auth/v1/')) return json(r, { ...session, user });
  if (u.includes('/functions/v1/subwaytakes-byok')) {
    const { method, path, body } = JSON.parse(req.postData() || '{}'); proxy.push({ method, path, body });
    if (path === '/api/v1/account/balance') return json(r, { balance: 20 });
    if (path.endsWith('/estimate-cost')) return json(r, { cost: 60, unit: 'cents' });
    if (method === 'POST' && /^\/api\/v1\/[\w.\-]+$/.test(path)) { const id = 'req-' + (++n); outputs[id] = path.includes('tts') ? 'https://stub.media.test/voice.wav' : `https://stub.media.test/img${imgs++ % 6}.png`; return json(r, { request_id: id, status: 'processing' }); }
    { const m = /predictions\/(req-\d+)\/result/.exec(path); if (m) return json(r, { status: 'completed', outputs: [outputs[m[1]]] }); }
    return json(r, {});
  }
  if (u.includes('/rest/v1/clip_jobs')) return m === 'GET' ? json(r, []) : json(r, { id: 'j' + Date.now(), created_at: new Date().toISOString(), error: null, output_url: null, request_id: null }, 201);
  if (u.includes('user_profiles')) return json(r, { id: 'u-1', credits_balance: 0, subscription_tier: 'free' });
  return json(r, []);
});

await page.goto(`${base}/create`);
await page.getByRole('button', { name: 'Take', exact: true }).click();
await page.getByTestId('narrated-toggle').click();
await page.getByTestId('narrated-box').waitFor();
check('the plan shows the number of pictures for the story', /\d pictures, about [\d.]+ seconds/.test(await page.getByTestId('narrated-plan').innerText()), await page.getByTestId('narrated-plan').innerText());
await page.getByTestId('narrated-story').fill('Too short');
check('a too-short story is refused and the button is off', /at least 6 words/.test(await page.getByTestId('narrated-problem').innerText()) && await page.getByTestId('narrated-run').isDisabled());
await page.locator('[data-kind=quote]').click();
check('Quote with nothing picked says where to pick it and stays off', /Pick a quote/.test(await page.getByTestId('narrated-source').innerText()) && await page.getByTestId('narrated-run').isDisabled());
await page.locator('[data-kind=story]').click();
const STORY = 'The train was late again. Maya checked her phone and sighed. Then a stranger offered her a seat, and the whole morning changed. It taught her to look up more often.';
await page.getByTestId('narrated-story').fill(STORY);
await page.screenshot({ path: `${out}/01-box.png` });
proxy.length = 0;
await page.getByTestId('narrated-run').click();
await page.waitForFunction(() => { try { const p = JSON.parse(localStorage.getItem('subwaytakes.project.v1') || '{}'); return p.clips?.some(c => c.still) && p.clips?.some(c => c.kind === 'audio' && c.label === 'Narration'); } catch { return false; } }, null, { timeout: 90000 });
const posts = proxy.filter(p => p.method === 'POST' && !p.path.endsWith('/estimate-cost'));
const tts = posts.filter(p => p.path.includes('tts')); const imgsP = posts.filter(p => p.path.includes('image'));
check('exactly one voice call, with the script word for word', tts.length === 1 && tts[0].body.prompt === STORY, String(tts[0]?.body?.prompt).slice(0, 60));
check('one picture per scene, all faceless and textless', imgsP.length >= 3 && imgsP.every(p => /No close-up faces/.test(p.body.prompt) && /no text/.test(p.body.prompt)), String(imgsP.length));
check('the voice is made BEFORE any picture', posts.findIndex(p => p.path.includes('tts')) < posts.findIndex(p => p.path.includes('image')));
check('the key is sent in the header, never in a body', !JSON.stringify(proxy.map(p => p.body)).includes(GOOD));
await page.waitForTimeout(800);
const project = JSON.parse(await page.evaluate(() => localStorage.getItem('subwaytakes.project.v1')));
const stills = project.clips.filter(c => c.still).sort((a, b) => a.start - b.start); const audio = project.clips.find(c => c.kind === 'audio' && c.label === 'Narration'); const caps = project.clips.filter(c => c.kind === 'caption').sort((a, b) => a.start - b.start);
check('the pictures are back to back from zero and add up to the voice length', stills.length === imgsP.length && stills[0].start === 0 && stills.every((c, i) => i === 0 || c.start === stills[i - 1].start + stills[i - 1].duration) && stills.reduce((n, c) => n + c.duration, 0) === audio.duration, JSON.stringify([stills.map(c => c.duration), audio.duration]));
check('the voice is one audio clip of about 12 s', audio.start === 0 && Math.abs(audio.duration - 360) <= 2, String(audio.duration));
check('the words are captions, in order, matching the story', caps.map(c => c.text).join(' ') === STORY);
check('pictures drift in different ways and are silent', new Set(stills.map(c => c.still.motion)).size > 1 && stills.every(c => c.volume === 0));
writeFileSync(`${out}/narr-project.json`, JSON.stringify(project));
await page.screenshot({ path: `${out}/02-after.png` });
await browser.close();
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED (real pictures and wav, stubbed network)');
process.exit(failures ? 1 : 0);
