// Browser test of "Remove background" on the Cast page with the REAL segmentation model and a REAL portrait (network to Supabase and muapi stubbed).
// Needs internet for the model and wasm (official hosts). If it cannot load them the test says UNVERIFIED and exits 2.
// Run the dev server in the default mode. Usage: node scripts/cutout-ui-e2e.mjs <portrait.png> <outDir> [baseUrl]
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [img, out, base = 'http://localhost:5173'] = process.argv.slice(2);
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
const PORTRAIT = readFileSync(img);
const CHAR = { id: 'c1', user_id: 'u-1', name: 'Dee', role: 'guest', age_range: '', gender: '', ethnicity: '', clothing_style: '', hair_description: '', distinguishing_features: null, energy_persona: '', voice_style: '', is_default: false, created_at: new Date().toISOString(), portrait_url: 'https://stub.media.test/portrait.png', voice_provider: null, voice_id: null, voice_speed: 1 };

const browser = await chromium.launch({ args: ['--disable-dev-shm-usage'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1 });
await ctx.addInitScript(([s]) => { localStorage.setItem('sb-stub-auth-token', JSON.stringify(s)); }, [session]);
const page = await ctx.newPage();
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 200)));
const uploads = []; const patches = [];
await page.route('https://stub.media.test/**', r => r.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: PORTRAIT }));
await page.route(`${SB}/**`, async r => {
  const req = r.request(); const u = req.url(); const m = req.method();
  if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
  if (u.includes('/auth/v1/user')) return json(r, user);
  if (u.includes('/auth/v1/')) return json(r, { ...session, user });
  if (u.includes('/storage/v1/object/subwaytakes-media/')) { const b = req.postDataBuffer(); uploads.push({ path: decodeURIComponent(u.split('/object/subwaytakes-media/')[1].split('?')[0]), bytes: b?.length ?? 0, png: !!b && b.includes('PNG') }); return json(r, { Key: 'x' }); }
  if (u.includes('/rest/v1/consents')) return json(r, { version: '1' });
  if (u.includes('/rest/v1/character_bibles')) { if (m === 'PATCH') { patches.push(JSON.parse(req.postData() || '{}')); return json(r, { ...CHAR, ...patches[patches.length - 1] }); } return json(r, m === 'GET' ? [CHAR] : CHAR); }
  if (u.includes('user_profiles')) return json(r, { id: 'u-1', credits_balance: 0, subscription_tier: 'free' });
  return json(r, []);
});

await page.goto(`${base}/cast`);
await page.getByTestId('remove-bg').waitFor({ timeout: 25000 });
check('Cast has a "Remove background" button for a character with a portrait', true);
await page.getByTestId('remove-bg').click();
await page.getByTestId('bg-modal').waitFor();
check('the dialog shows before and a background picker', (await page.locator('[data-bg]').count()) === 5 && await page.getByAltText('Portrait before').isVisible());
check('"Use this portrait" is off until there is a result', await page.getByTestId('bg-use').isDisabled());
await page.locator('[data-bg=white]').click();
await page.getByTestId('bg-run').click();
await page.waitForFunction(() => document.querySelector('[data-testid=bg-after]') || document.querySelector('[data-testid=bg-error]'), null, { timeout: 90000 });
if (await page.getByTestId('bg-error').count()) {
  const msg = await page.getByTestId('bg-error').innerText();
  if (/Could not load the background-removal model/.test(msg)) { console.log('UNVERIFIED: model could not be loaded here:', msg); await browser.close(); process.exit(2); }
  check('the cut-out is produced', false, msg);
} else {
  check('the cut-out is produced and shown as "After"', true);
  const px = await page.evaluate(async () => { const im = document.querySelector('[data-testid=bg-after]'); const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const x = c.getContext('2d'); x.drawImage(im, 0, 0); return { w: im.naturalWidth, corner: Array.from(x.getImageData(4, 4, 1, 1).data), centre: Array.from(x.getImageData(Math.floor(c.width / 2), Math.floor(c.height * 0.45), 1, 1).data) }; });
  check('white background chosen: the corner is white', px.corner[0] > 240 && px.corner[1] > 240 && px.corner[2] > 240, JSON.stringify(px.corner));
  check('the person is still there (centre is not white)', px.centre[0] < 235, JSON.stringify(px.centre));
  await page.screenshot({ path: `${out}/01-result.png` });
  check('nothing was uploaded yet (the picture stays on this device)', uploads.length === 0);
  await page.getByTestId('bg-use').click();
  await page.getByTestId('bg-modal').waitFor({ state: 'detached', timeout: 15000 });
  check('"Use this portrait" uploads a PNG to your own media folder', uploads.length === 1 && /^u-1\/.*portrait-cutout\.png$/.test(uploads[0].path) && uploads[0].png, JSON.stringify(uploads[0]));
  check('the character\'s portrait is replaced with the new picture', patches.some(p => String(p.portrait_url).includes('/storage/v1/object/public/subwaytakes-media/u-1/') && /portrait-cutout\.png$/.test(String(p.portrait_url))), JSON.stringify(patches.map(p => p.portrait_url)));
}
await browser.close();
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED (real model and portrait; stubbed Supabase)');
process.exit(failures ? 1 : 0);
