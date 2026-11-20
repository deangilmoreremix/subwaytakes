// Browser test of "Reframe" (zoom and focal point on a video clip) through the real UI, with a REAL video file (network stubbed).
// Run the dev server in the default mode. Usage: node scripts/reframe-e2e.mjs <video.mp4> <outDir> [baseUrl]
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [vid, out, base = 'http://localhost:5173'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const SB = 'https://stub.supabase.test';
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 86400;
const jwt = `${b64({ alg: 'HS256' })}.${b64({ sub: 'u-1', role: 'authenticated', aud: 'authenticated', exp })}.sig`;
const json = (r, b, status = 200) => r.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(b) });
let failures = 0;
const check = (name, ok, extra = '') => { console.log(ok ? 'PASS' : 'FAIL', name, extra); if (!ok) failures++; };
const user = { id: 'u-1', aud: 'authenticated', role: 'authenticated', email: 'd@example.com', is_anonymous: false, app_metadata: {}, user_metadata: {}, email_confirmed_at: new Date().toISOString(), created_at: new Date().toISOString() };
const session = { access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 86400, expires_at: exp, user };
const project = { fps: 30, tracks: [{ id: 'v1', kind: 'video', name: 'Video' }, { id: 'c1', kind: 'caption', name: 'Captions' }, { id: 'a1', kind: 'audio', name: 'Sound' }, { id: 'e1', kind: 'effect', name: 'Effects' }],
  clips: [{ id: 'a', trackId: 'v1', kind: 'video', label: 'Gradient shot', start: 0, duration: 60, trimStart: 0, sourceFrames: 120, src: 'https://stub.media.test/grad.mp4', volume: 1 }] };
const VIDEO = readFileSync(vid);

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
await ctx.addInitScript(([s, pr]) => { localStorage.setItem('sb-stub-auth-token', JSON.stringify(s)); if (!localStorage.getItem('seeded')) { localStorage.setItem('seeded', '1'); localStorage.setItem('subwaytakes.project.v1', JSON.stringify(pr)); } }, [session, project]);   // seed once, so a reload keeps what the app saved
const page = await ctx.newPage();
page.on('pageerror', e => { if (!/MediaPlaybackError/.test(String(e))) console.log('[pageerror]', String(e).slice(0, 200)); });
await page.route('https://stub.media.test/**', r => {
  const range = r.request().headers().range;
  if (range) { const m = /bytes=(\d+)-(\d*)/.exec(range); const s = Number(m[1]); const e = m[2] ? Number(m[2]) : VIDEO.length - 1; return r.fulfill({ status: 206, contentType: 'video/mp4', headers: { 'access-control-allow-origin': '*', 'accept-ranges': 'bytes', 'content-range': `bytes ${s}-${e}/${VIDEO.length}` }, body: VIDEO.subarray(s, e + 1) }); }
  return r.fulfill({ status: 200, contentType: 'video/mp4', headers: { 'access-control-allow-origin': '*', 'accept-ranges': 'bytes' }, body: VIDEO });
});
await page.route(`${SB}/**`, async r => {
  const req = r.request(); const u = req.url();
  if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
  if (u.includes('/auth/v1/user')) return json(r, user);
  if (u.includes('/auth/v1/')) return json(r, { ...session, user });
  if (u.includes('user_profiles')) return json(r, { id: 'u-1', credits_balance: 0, subscription_tier: 'free' });
  return json(r, []);
});

await page.goto(`${base}/create`);
await page.getByLabel('Gradient shot clip').click();
await page.getByTestId('reframe').waitFor({ timeout: 30000 });
check('selecting a video clip shows the Reframe tool with a picture from the clip', await page.locator('.reactEasyCrop_Image, [data-testid=reframe] img').first().isVisible());
await page.screenshot({ path: `${out}/01-reframe.png` });

const crop = async () => JSON.parse(await page.evaluate(() => localStorage.getItem('subwaytakes.project.v1') ?? '{}')).clips?.[0]?.crop;
check('a clip starts with no reframe (old clips are untouched)', (await crop()) === undefined);
await page.getByTestId('reframe-zoom').fill('2');
await page.waitForTimeout(900);
const c = await crop();
check('zooming to 2× stores the reframe on the clip', !!c && Math.abs(c.zoom - 2) < 0.1, JSON.stringify(c));
check('the focal point stays inside the picture', !!c && c.x >= 0.2 && c.x <= 0.8 && c.y >= 0.2 && c.y <= 0.8);
await page.screenshot({ path: `${out}/02-zoomed.png` });

await page.reload();
await page.getByLabel('Gradient shot clip').click();
await page.getByTestId('reframe').waitFor({ timeout: 30000 });
check('the zoom survives a reload and the tool shows it', Math.abs(Number(await page.getByTestId('reframe-zoom').inputValue()) - 2) < 0.1);

await page.getByRole('button', { name: 'Reset framing' }).click();
await page.waitForTimeout(900);
check('Reset removes the reframe again', (await crop()) === undefined);
await browser.close();
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED (real video file, stubbed network)');
process.exit(failures ? 1 : 0);
