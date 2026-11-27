// Browser test of the world tour through the real UI: the same take in three cities, a city tag at the start of each stop (network stubbed, a REAL mp4 for the clips).
// Saves the finished project as <outDir>/tour-project.json so it can be exported for real: node scripts/export-project.mjs <mp4> <outDir>/tour-project.json out.mp4
// Run the dev server in the default mode. Usage: node scripts/tour-e2e.mjs <video.mp4> <outDir> [baseUrl]
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [vid, out, base = 'http://localhost:5173'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const SB = 'https://stub.supabase.test';
const GOOD = 'mk_live_TOURTESTKEY0123456789abcdef';
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 86400;
const jwt = `${b64({ alg: 'HS256' })}.${b64({ sub: 'u-1', role: 'authenticated', aud: 'authenticated', exp })}.sig`;
const json = (r, b, status = 200) => r.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(b) });
let failures = 0;
const check = (name, ok, extra = '') => { console.log(ok ? 'PASS' : 'FAIL', name, extra); if (!ok) failures++; };
const user = { id: 'u-1', aud: 'authenticated', role: 'authenticated', email: 'd@example.com', is_anonymous: false, app_metadata: {}, user_metadata: {}, email_confirmed_at: new Date().toISOString(), created_at: new Date().toISOString() };
const session = { access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 86400, expires_at: exp, user };
const VIDEO = readFileSync(vid);

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
await ctx.addInitScript(([s, k]) => { localStorage.setItem('sb-stub-auth-token', JSON.stringify(s)); localStorage.setItem('subwaytakes.muapi.key', k); }, [session, GOOD]);
const page = await ctx.newPage();
page.on('pageerror', e => { if (!/MediaPlaybackError/.test(String(e))) console.log('[pageerror]', String(e).slice(0, 200)); });
page.on('dialog', d => { console.log('  CONFIRM:', d.message()); d.accept(); });
const proxy = []; let n = 0;
await page.route('https://stub.media.test/**', r => {
  const range = r.request().headers().range;
  if (range) { const m = /bytes=(\d+)-(\d*)/.exec(range); const s = Number(m[1]); const e = m[2] ? Number(m[2]) : VIDEO.length - 1; return r.fulfill({ status: 206, contentType: 'video/mp4', headers: { 'access-control-allow-origin': '*', 'accept-ranges': 'bytes', 'content-range': `bytes ${s}-${e}/${VIDEO.length}` }, body: VIDEO.subarray(s, e + 1) }); }
  return r.fulfill({ status: 200, contentType: 'video/mp4', headers: { 'access-control-allow-origin': '*', 'accept-ranges': 'bytes' }, body: VIDEO });
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
    if (method === 'POST' && /^\/api\/v1\/[\w.\-]+$/.test(path)) return json(r, { request_id: 'req-' + (++n), status: 'processing' });
    if (/predictions\/req-\d+\/result/.test(path)) return json(r, { status: 'completed', outputs: [`https://stub.media.test/guest-${n}.mp4`] });
    return json(r, {});
  }
  if (u.includes('/rest/v1/clip_jobs')) return m === 'GET' ? json(r, []) : json(r, { id: 'j' + Date.now(), created_at: new Date().toISOString(), error: null, output_url: null, request_id: null }, 201);
  if (u.includes('user_profiles')) return json(r, { id: 'u-1', credits_balance: 0, subscription_tier: 'free' });
  return json(r, []);
});

await page.goto(`${base}/create`);
await page.getByRole('button', { name: 'Take', exact: true }).click();
await page.getByTestId('tour-toggle').click();
await page.getByTestId('tour-box').waitFor();
check('three cities are chosen to begin with and the run button says so', /3 cities/.test(await page.getByTestId('tour-run').innerText()));
await page.locator('[data-city=nyc]').click(); await page.locator('[data-city=london]').click();
check('with one city left the tour is refused and the button is off', /at least 2/.test(await page.getByTestId('tour-problem').innerText()) && await page.getByTestId('tour-run').isDisabled());
await page.locator('[data-city=nyc]').click(); await page.locator('[data-city=paris]').click();
check('Tokyo, NYC, Paris are chosen and the button is on', await page.getByTestId('tour-run').isEnabled());
await page.screenshot({ path: `${out}/01-tour-box.png` });

proxy.length = 0;
await page.getByTestId('tour-run').click();
await page.waitForFunction(() => { try { return JSON.parse(localStorage.getItem('subwaytakes.project.v1') || '{}').clips?.filter(c => c.effect?.type === 'city-card').length >= 3; } catch { return false; } }, null, { timeout: 90000 });
const posts = proxy.filter(p => p.method === 'POST' && !p.path.endsWith('/estimate-cost'));
check('three episodes are submitted', posts.length === 3, String(posts.length));
const prompts = posts.map(p => String(p.body?.prompt));
check('each prompt uses its own city card word', prompts[0].includes('Suica') && prompts[1].includes('MetroCard') && prompts[2].includes('Navigo'), prompts.map(p => /MetroCard|Suica|Navigo/.exec(p)?.[0]).join(','));
check('MetroCard appears only in the New York prompt', !prompts[0].includes('MetroCard') && !prompts[2].includes('MetroCard'));
check('every prompt keeps the one-card hand-off', prompts.every(p => /exactly ONE card/.test(p)));
check('every stop asks the same take', new Set(prompts.map(p => /"([^"]*pineapple[^"]*)"/i.exec(p)?.[1] ?? '')).size === 1);
check('the key is sent in the header, never in a body', !JSON.stringify(proxy.map(p => p.body)).includes(GOOD));
await page.waitForTimeout(800);
const project = JSON.parse(await page.evaluate(() => localStorage.getItem('subwaytakes.project.v1')));
const videos = project.clips.filter(c => c.kind === 'video').sort((a, b) => a.start - b.start); const tags = project.clips.filter(c => c.effect?.type === 'city-card').sort((a, b) => a.start - b.start);
check('three clips are on the timeline back to back', videos.length === 3 && videos[0].start < videos[1].start && videos[1].start < videos[2].start);
check('each city tag starts exactly where its clip starts, in order', tags.length === 3 && tags.every((t, i) => t.start === videos[i].start), JSON.stringify(tags.map(t => [t.start, t.effect.city])));
check('the tags read the cities in the order they were picked (Tokyo, New York, Paris)', tags.map(t => t.effect.city).join('|') === 'Tokyo|New York|Paris', tags.map(t => t.effect.city).join('|'));
writeFileSync(`${out}/tour-project.json`, JSON.stringify(project));
await page.screenshot({ path: `${out}/02-after.png` });
await browser.close();
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED (real mp4 clips, stubbed network)');
process.exit(failures ? 1 : 0);
