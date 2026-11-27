// Browser test of "Crop" on the Cast page with a REAL portrait: the uploaded PNG is decoded and its size checked (network to Supabase stubbed).
// Run the dev server in the default mode. Usage: node scripts/portrait-crop-e2e.mjs <portrait.png> <outDir> [baseUrl]
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
const pngSize = b => { const i = b ? b.indexOf(Buffer.from([0x89, 0x50, 0x4e, 0x47])) : -1; return i < 0 ? null : { w: b.readUInt32BE(i + 16), h: b.readUInt32BE(i + 20) }; };
await page.route('https://stub.media.test/**', r => r.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: PORTRAIT }));
await page.route(`${SB}/**`, async r => {
  const req = r.request(); const u = req.url(); const m = req.method();
  if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
  if (u.includes('/auth/v1/user')) return json(r, user);
  if (u.includes('/auth/v1/')) return json(r, { ...session, user });
  if (u.includes('/storage/v1/object/subwaytakes-media/')) { const b = req.postDataBuffer(); uploads.push({ path: decodeURIComponent(u.split('/object/subwaytakes-media/')[1].split('?')[0]), size: pngSize(b) }); return json(r, { Key: 'x' }); }
  if (u.includes('/rest/v1/consents')) return json(r, { version: '1' });
  if (u.includes('/rest/v1/character_bibles')) { if (m === 'PATCH') { patches.push(JSON.parse(req.postData() || '{}')); return json(r, { ...CHAR, ...patches[patches.length - 1] }); } return json(r, m === 'GET' ? [CHAR] : CHAR); }
  if (u.includes('user_profiles')) return json(r, { id: 'u-1', credits_balance: 0, subscription_tier: 'free' });
  return json(r, []);
});

await page.goto(`${base}/cast`);
await page.getByTestId('crop-portrait').waitFor({ timeout: 25000 });
await page.getByTestId('crop-portrait').click();
await page.getByTestId('crop-modal').waitFor();
await page.waitForFunction(() => !document.querySelector('[data-testid=crop-use]').disabled, null, { timeout: 15000 });
check('the crop dialog opens with the portrait and "Use this crop" becomes ready', true);
await page.screenshot({ path: `${out}/01-crop-916.png` });
await page.locator('[data-aspect="1:1"]').click();
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/02-crop-square.png` });
check('nothing is uploaded until "Use this crop"', uploads.length === 0);
await page.getByTestId('crop-use').click();
await page.getByTestId('crop-modal').waitFor({ state: 'detached', timeout: 15000 });
const u = uploads[0];
check('a PNG is uploaded to your own media folder', uploads.length === 1 && /^u-1\/.*portrait-crop\.png$/.test(u.path), JSON.stringify(u));
check('the square crop really is square (and smaller than the original 723x1280)', !!u?.size && Math.abs(u.size.w - u.size.h) <= 2 && u.size.h < 1280, JSON.stringify(u?.size));
check('the character\'s portrait is replaced', patches.some(p => /portrait-crop\.png$/.test(String(p.portrait_url))));
await browser.close();
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED (real portrait; stubbed Supabase)');
process.exit(failures ? 1 : 0);
