// Route smoke test for the slim app (stubbed network). Usage: node scripts/phase5-smoke.mjs <outDir> [baseUrl]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [out, base = 'http://localhost:5173'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const SB = 'https://stub.supabase.test';
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 86400;
const jwt = `${b64({ alg: 'HS256' })}.${b64({ sub: 'u-1', role: 'authenticated', aud: 'authenticated', exp })}.sig`;
const user = { id: 'u-1', aud: 'authenticated', role: 'authenticated', email: 'd@example.com', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
const session = { access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 86400, expires_at: exp, user };
const json = (r, b, status = 200) => r.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(b) });
const browser = await chromium.launch();
let failures = 0;
const check = (name, ok, extra = '') => { console.log(ok ? 'PASS' : 'FAIL', name, extra); if (!ok) failures++; };

async function open(viewport, signedIn) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  if (signedIn) await ctx.addInitScript(s => { localStorage.setItem('sb-stub-auth-token', JSON.stringify(s)); localStorage.setItem('subwaytakes.muapi_key', 'mu_test'); }, session);
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 200)));
  await page.route(`${SB}/**`, r => {
    const u = r.request().url();
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (!signedIn && u.includes('/auth/v1/')) return json(r, { message: 'Anonymous sign-ins are disabled' }, 422);
    if (u.includes('/auth/v1/user')) return json(r, user);
    if (u.includes('/auth/v1/')) return json(r, { ...session, user });
    if (u.includes('user_profiles')) return json(r, { id: 'u-1', credits_balance: 1, subscription_tier: 'free', default_city_style: 'london' });
    return json(r, []);
  });
  return { ctx, page };
}

// removed routes redirect to /create
{
  const { ctx, page } = await open({ width: 1280, height: 900 }, true);
  for (const p of ['/dashboard', '/episodes/new', '/create/legacy', '/library/legacy', '/questions', '/analytics', '/clips/abc', '/nope']) {
    await page.goto(base + p); await page.waitForURL(/\/create$/, { timeout: 15000 }).catch(() => {});
    check(`${p} -> /create`, new URL(page.url()).pathname === '/create', page.url());
  }
  // kept routes render
  for (const [p, text] of [['/create', 'The take'], ['/cast', null], ['/recast', 'Source clip'], ['/library', null], ['/settings', 'Default City']]) {
    await page.goto(base + p); await page.waitForTimeout(1200);
    check(`${p} stays and renders`, new URL(page.url()).pathname === p);
    if (text) check(`${p} shows "${text}"`, await page.getByText(text).first().isVisible().catch(() => false));
    await page.screenshot({ path: `${out}/route${p.replace(/\//g, '-')}.png` });
  }
  // settings city list comes from Places
  await page.goto(base + '/settings'); await page.waitForTimeout(800);
  const cities = await page.getByRole('button', { name: /^(Seoul|Mexico City|São Paulo|Singapore)$/ }).count();
  check('Settings lists the new cities', cities === 4, `found ${cities}/4`);
  // ideas fill the take
  await page.goto(base + '/create'); await page.getByRole('button', { name: 'Take', exact: true }).click();
  await page.getByRole('button', { name: 'Ideas' }).click();
  await page.screenshot({ path: `${out}/ideas-open.png` });
  await page.getByRole('button', { name: 'Leggings should not be pants.' }).click();
  check('Ideas picker fills the take', (await page.locator('textarea').first().inputValue()) === 'Leggings should not be pants.');
  await ctx.close();
}
// phone width
{
  const { ctx, page } = await open({ width: 390, height: 844 }, true);
  await page.goto(base + '/create'); await page.waitForTimeout(1200);
  await page.screenshot({ path: `${out}/phone-create.png` });
  await ctx.close();
}
// signed out
{
  const { ctx, page } = await open({ width: 1280, height: 900 }, false);
  await page.goto(base + '/recast'); await page.waitForURL(/\/login/, { timeout: 15000 }).catch(() => {});
  check('signed-out /recast -> /login with returnTo', /\/login\?returnTo=%2Frecast/.test(page.url()), page.url());
  await ctx.close();
}
await browser.close();
console.log(failures ? `${failures} FAILED` : 'ALL PASSED');
process.exit(failures ? 1 : 0);
