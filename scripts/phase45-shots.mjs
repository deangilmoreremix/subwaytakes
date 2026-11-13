// Stubbed screenshots of Phase 4.5 UI (Place panel, interview format, Recast voice). NO real generations: network is stubbed.
// Usage: node scripts/phase45-shots.mjs <portrait.png> <outDir> [baseUrl]
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [portrait, out, base = 'http://localhost:5173'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const SB = 'https://stub.supabase.test';
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 86400;
const jwt = `${b64({ alg: 'HS256' })}.${b64({ sub: 'u-1', role: 'authenticated', aud: 'authenticated', exp })}.sig`;
const user = { id: 'u-1', aud: 'authenticated', role: 'authenticated', email: 'd@example.com', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
const session = { access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 86400, expires_at: exp, user };
const ch = (id, name, role) => ({ id, user_id: 'u-1', name, role, age_range: 'early-30s', gender: 'female', ethnicity: 'diverse', clothing_style: 'red coat', hair_description: 'curly', distinguishing_features: '', energy_persona: 'witty', voice_style: '', is_default: false, created_at: '', portrait_url: 'https://stub.media.test/portrait.png', voice_provider: 'elevenlabs', voice_id: 'v1', voice_speed: 1 });
const chars = [ch('h1', 'Host (original)', 'host'), ch('g1', 'Maya', 'guest')];
const json = (r, b) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(b) });
const browser = await chromium.launch();
async function shoot(name, viewport, steps) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  await ctx.addInitScript(s => { localStorage.setItem('sb-stub-auth-token', JSON.stringify(s)); localStorage.setItem('subwaytakes.muapi_key', 'mu_test'); }, session);
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 200)));
  await page.route('https://stub.media.test/**', r => r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'image/png' }, body: readFileSync(portrait) }));
  await page.route(`${SB}/**`, r => { const u = r.request().url(); if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } }); if (u.includes('/auth/v1/user')) return json(r, user); if (u.includes('/auth/v1/')) return json(r, { ...session, user }); if (u.includes('user_profiles')) return json(r, { id: 'u-1', credits_balance: 1, subscription_tier: 'free' }); if (u.includes('character_bibles')) return json(r, chars); if (u.includes('functions/v1/muapi-proxy')) return json(r, { cost: 0.6 }); return json(r, []); });
  await steps(page, name);
  await ctx.close();
}
const prompt = page => page.locator('details summary').click().then(() => page.locator('details p').innerText());

await shoot('create', { width: 1280, height: 900 }, async (page) => {
  await page.goto(`${base}/create`); await page.getByRole('tab', { name: 'Take' }).or(page.getByRole('button', { name: 'Take', exact: true })).first().click().catch(() => {});
  await page.getByText('Place', { exact: true }).waitFor();
  await page.screenshot({ path: `${out}/01-place-nyc.png` });
  await page.getByRole('option', { name: 'London' }).click();
  await page.getByRole('button', { name: 'Platform', exact: true }).click();
  await page.getByRole('button', { name: /More/ }).click();
  await page.screenshot({ path: `${out}/02-place-london-more.png` });
  await page.getByRole('option', { name: 'Seoul' }).click();
  await page.getByRole('button', { name: 'On the train, seated' }).click();
  console.log('SEOUL PROMPT:', (await prompt(page)).slice(0, 900));
  await page.screenshot({ path: `${out}/03-place-seoul-prompt.png` });
  await page.getByRole('button', { name: 'Model', exact: true }).click();
  await page.screenshot({ path: `${out}/04-format-twoshot.png` });
  await page.getByRole('button', { name: 'Cuts' }).click();
  await page.screenshot({ path: `${out}/05-format-cuts.png` });
});
await shoot('phone', { width: 390, height: 844 }, async (page) => {
  await page.goto(`${base}/create`); await page.getByText('Place', { exact: true }).waitFor();
  await page.screenshot({ path: `${out}/06-phone-place.png` });
});
console.log('done');
await browser.close();
