// Stubbed browser test of bring-your-own-key through the real UI (the default mode).
// NO real Supabase and NO real muapi: a fake proxy records every request the page sends, including the headers.
// Run the dev server in the default mode: VITE_SUPABASE_URL=https://stub.supabase.test VITE_SUPABASE_ANON_KEY=stub npm run dev
// Usage: node scripts/byok-e2e.mjs <outDir> [baseUrl]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [out, base = 'http://localhost:5173'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const SB = 'https://stub.supabase.test';
const GOOD = 'mk_live_BYOKTESTKEY0123456789abcd';
const BAD = 'mk_bad_NOTAREALKEY0123456789abcd';
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 86400;
const jwt = `${b64({ alg: 'HS256' })}.${b64({ sub: 'u-1', role: 'authenticated', aud: 'authenticated', exp })}.sig`;
const json = (r, b, status = 200) => r.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(b) });
let failures = 0;
const check = (name, ok, extra = '') => { console.log(ok ? 'PASS' : 'FAIL', name, extra); if (!ok) failures++; };

const user = { id: 'u-1', aud: 'authenticated', role: 'authenticated', email: 'd@example.com', is_anonymous: false, app_metadata: {}, user_metadata: {}, email_confirmed_at: new Date().toISOString(), created_at: new Date().toISOString() };
const session = { access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 86400, expires_at: exp, user };

const browser = await chromium.launch();
async function open({ width = 1280, height = 900, key = null } = {}) {
  const st = { proxy: [], restBodies: [], reports: [], gatewayCalls: 0 };
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
  await ctx.addInitScript(([s, k]) => { localStorage.setItem('sb-stub-auth-token', JSON.stringify(s)); if (k) localStorage.setItem('subwaytakes.muapi.key', k); }, [session, key]);
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 200)));
  page.on('dialog', d => d.accept());
  await page.route(`${SB}/**`, async r => {
    const req = r.request(); const u = req.url(); const m = req.method();
    if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (u.includes('/auth/v1/user')) return json(r, user);
    if (u.includes('/auth/v1/')) return json(r, { ...session, user });
    if (u.includes('/functions/v1/muapi-gateway')) { st.gatewayCalls++; return json(r, { error: 'gateway must not be used', code: 'internal' }, 500); }
    if (u.includes('/functions/v1/subwaytakes-byok')) {
      const headers = req.headers(); const { method, path, body } = JSON.parse(req.postData() || '{}');
      st.proxy.push({ method, path, key: headers['x-muapi-key'], body });
      const k = headers['x-muapi-key'];
      if (!k) return json(r, { code: 'no_key', error: 'Add your muapi key to continue.' }, 400);
      if (k === BAD) return json(r, { code: 'invalid_key', error: 'muapi did not accept this key. Check it, or create a new one in your muapi account.' }, 401);
      if (path === '/api/v1/account/balance') return json(r, { balance: 12.5 });
      if (path.endsWith('/estimate-cost')) return json(r, { cost: 60, unit: 'cents' });
      if (method === 'POST' && /^\/api\/v1\/[\w.\-]+$/.test(path)) return json(r, { request_id: 'req-1', status: 'processing' });
      if (/predictions\/req-1\/result/.test(path)) return json(r, { status: 'completed', outputs: ['https://stub.media.test/x.mp4'] });
      return json(r, {});
    }
    if (u.includes('/rest/v1/rpc/client_error_log')) { st.reports.push(req.postData()); return json(r, true); }
    if (m !== 'GET') st.restBodies.push(req.postData() || '');
    if (u.includes('/rest/v1/entitlements')) return json(r, []);
    if (u.includes('user_profiles')) return json(r, { id: 'u-1', credits_balance: 0, subscription_tier: 'free' });
    if (u.includes('/rest/v1/clip_jobs')) return m === 'GET' ? json(r, []) : json(r, { id: 'j1', created_at: new Date().toISOString(), error: null, output_url: null, request_id: null }, 201);
    return json(r, []);
  });
  return { ctx, page, st };
}
const pillText = page => page.getByTestId('key-pill-text').innerText();

// ---------------------------------------------------------------- no key yet
{
  const { ctx, page, st } = await open();
  await page.goto(`${base}/create`);
  await page.getByTestId('key-pill').waitFor({ timeout: 20000 });
  check('top bar offers "Add muapi key" and no credits pill', (await pillText(page)) === 'Add muapi key' && (await page.getByTestId('credit-pill').count()) === 0);
  await page.getByTestId('create-add-key').waitFor({ timeout: 15000 }).catch(() => {});
  check('the generate side asks for the key', await page.getByTestId('create-add-key').isVisible());
  await page.getByText('Connect your muapi key').first().waitFor({ timeout: 15000 }).catch(() => {});
  check('the first-run checklist has the key step', await page.getByText('Connect your muapi key').first().isVisible());
  await page.screenshot({ path: `${out}/01-create-no-key.png` });

  await page.getByTestId('create-add-key').click();
  await page.getByTestId('key-modal').waitFor();
  check('the add-key button opens the modal', await page.getByRole('dialog', { name: 'Connect your muapi key' }).isVisible());
  check('the modal says you pay muapi directly and the key stays in the browser', /pay muapi directly/.test(await page.getByTestId('key-modal').innerText()) && /only in this browser/.test(await page.getByTestId('key-modal').innerText()));
  check('Verify and Save are off until something is typed', await page.getByTestId('key-verify').isDisabled() && await page.getByTestId('key-save').isDisabled());
  await page.screenshot({ path: `${out}/02-modal-empty.png` });

  // a malformed key never leaves the browser
  await page.getByTestId('key-input').fill('abc def');
  check('a key with a space is refused in the form', /no spaces/.test(await page.getByTestId('key-shape').innerText()));
  check('...and Verify stays off', await page.getByTestId('key-verify').isDisabled());
  check('...and nothing was sent to the proxy', st.proxy.length === 0);

  // show/hide
  await page.getByTestId('key-input').fill(BAD);
  check('the key is hidden by default', (await page.getByTestId('key-input').getAttribute('type')) === 'password');
  await page.getByRole('button', { name: 'Show key' }).click();
  check('...and can be shown', (await page.getByTestId('key-input').getAttribute('type')) === 'text');

  // wrong key
  await page.getByTestId('key-verify').click();
  await page.waitForFunction(() => /did not accept/.test(document.querySelector('[data-testid=key-status]')?.textContent ?? ''), null, { timeout: 8000 });
  check('a rejected key shows muapi\'s message', true);
  check('...and is NOT left saved', (await page.evaluate(() => localStorage.getItem('subwaytakes.muapi.key'))) === null);
  check('...and Save is off', await page.getByTestId('key-save').isDisabled());
  await page.screenshot({ path: `${out}/03-modal-invalid.png` });

  // right key
  await page.getByTestId('key-input').fill(GOOD);
  await page.getByTestId('key-verify').click();
  await page.waitForFunction(() => /Key accepted/.test(document.querySelector('[data-testid=key-status]')?.textContent ?? ''), null, { timeout: 8000 });
  check('a good key shows the muapi balance', /12\.5/.test(await page.getByTestId('key-status').innerText()));
  await page.screenshot({ path: `${out}/04-modal-valid.png` });
  await page.getByTestId('key-save').click();
  await page.getByTestId('key-modal').waitFor({ state: 'detached' });
  check('Save closes the modal', true);
  check('the pill now shows the muapi balance', /muapi · 12\.5/.test(await pillText(page)), await pillText(page));
  check('the generate side no longer asks for a key', (await page.getByTestId('create-add-key').count()) === 0);
  check('the key is saved in this browser only', (await page.evaluate(() => localStorage.getItem('subwaytakes.muapi.key'))) === GOOD);

  // every proxy call carried the key in the header, none went to the credits gateway
  const sent = st.proxy.filter(p => p.key);
  check('requests carry the key in the x-muapi-key header', sent.length >= 2 && sent.every(p => p.key === BAD || p.key === GOOD));
  check('the key is never in a request body', !JSON.stringify(st.proxy.map(p => p.body)).includes(GOOD));
  check('the credits gateway is never called', st.gatewayCalls === 0);

  // reload: still there; escape closes the modal
  await page.reload();
  await page.getByTestId('key-pill').waitFor({ timeout: 20000 });
  check('the key survives a reload', /muapi/.test(await pillText(page)) && (await pillText(page)) !== 'Add muapi key');
  await page.getByTestId('key-pill').click();
  await page.getByTestId('key-modal').waitFor();
  check('the saved key is shown masked, not in full', /mk_l.{8}abcd/.test(await page.getByTestId('key-masked').innerText()) && !(await page.getByTestId('key-modal').innerText()).includes(GOOD));
  await page.keyboard.press('Escape');
  await page.getByTestId('key-modal').waitFor({ state: 'detached' });
  check('Escape closes the modal', true);

  // Settings
  await page.goto(`${base}/settings`);
  await page.getByTestId('muapi-key-card').waitFor({ timeout: 20000 });
  check('Settings has the key card and no credits shop', (await page.getByText('Buy credits').count()) === 0 && /mk_l/.test(await page.getByTestId('settings-key-masked').innerText()));
  await page.screenshot({ path: `${out}/05-settings.png`, fullPage: true });

  // routes that belonged to the shop
  await page.goto(`${base}/billing/success`);
  await page.waitForURL('**/create', { timeout: 10000 });
  await page.goto(`${base}/admin`);
  await page.waitForURL('**/create', { timeout: 10000 });
  check('the shop and admin routes redirect to Create', true);

  // the saved project JSON and error reports never contain the key
  const project = await page.evaluate(() => localStorage.getItem('subwaytakes.project.v1') ?? '');
  check('the key is not in the saved project', !project.includes(GOOD));
  check('the key is not in anything written to the database or error reports', !st.restBodies.join('').includes(GOOD) && !st.reports.join('').includes(GOOD));

  // remove
  await page.getByTestId('key-pill').click();
  await page.getByTestId('key-modal').waitFor();
  await page.getByRole('button', { name: 'Remove' }).click();
  await page.getByTestId('key-remove-yes').click();
  check('Remove clears the key', (await page.evaluate(() => localStorage.getItem('subwaytakes.muapi.key'))) === null && (await page.getByTestId('key-saved').count()) === 0);
  await page.keyboard.press('Escape');
  check('...and the pill asks for a key again', (await pillText(page)) === 'Add muapi key');
  await ctx.close();
}

// ---------------------------------------------------------------- generating with a key: price in dollars, key in the header
{
  const { ctx, page, st } = await open({ key: GOOD });
  await page.goto(`${base}/create`);
  await page.getByTestId('key-pill').waitFor({ timeout: 20000 });
  await page.getByRole('button', { name: /^Generate/ }).first().waitFor({ timeout: 15000 }).catch(() => {});
  check('with a saved key the create page offers Generate', await page.getByRole('button', { name: /^Generate/ }).first().isVisible());
  await page.getByTestId('native-price').waitFor({ timeout: 15000 }).catch(() => {});
  check('the price of the clip is shown on the Generate button in dollars before anything is spent', /~\$0\.60/.test(await page.getByTestId('native-price').innerText().catch(() => '')));
  await page.getByRole('button', { name: /^Generate/ }).first().click();
  await page.waitForTimeout(1500);
  const sentEstimate = st.proxy.find(p => p.path.endsWith('/estimate-cost'));
  const sentSubmit = st.proxy.find(p => p.method === 'POST' && !p.path.endsWith('/estimate-cost') && /^\/api\/v1\/[\w.-]+$/.test(p.path));
  check('the price is asked first, with the key', !!sentEstimate && sentEstimate.key === GOOD, JSON.stringify(st.proxy.map(p => p.path)));
  check('a submit goes through the BYOK proxy with the key', !!sentSubmit && sentSubmit.key === GOOD, sentSubmit?.path);
  check('the key is not in the prompt/body the proxy forwards', !JSON.stringify(st.proxy.map(p => p.body)).includes(GOOD));
  check('the credits gateway is never called', st.gatewayCalls === 0);
  await page.screenshot({ path: `${out}/06-generating.png` });
  await ctx.close();
}

// ---------------------------------------------------------------- an old key muapi no longer accepts reopens the modal with a reason
{
  const { ctx, page } = await open({ key: BAD });
  await page.goto(`${base}/create`);
  await page.getByTestId('key-pill').waitFor({ timeout: 20000 });
  await page.getByTestId('key-modal').waitFor({ timeout: 15000 });
  check('a rejected saved key reopens the modal with the reason', /did not accept/.test(await page.getByTestId('key-reason').innerText()));
  await ctx.close();
}

// ---------------------------------------------------------------- phone width
{
  const { ctx, page } = await open({ width: 390, height: 844 });
  await page.goto(`${base}/create`);
  await page.getByTestId('key-pill').waitFor({ timeout: 20000 });
  await page.getByTestId('key-pill').click();
  await page.getByTestId('key-modal').waitFor();
  const box = await page.getByRole('dialog').locator('> div').first().boundingBox();
  check('the modal fits a phone screen', !!box && box.width <= 390 && box.x >= 0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  check('no horizontal scroll', !overflow);
  await page.screenshot({ path: `${out}/07-modal-phone.png` });
  await ctx.close();
}

await browser.close();
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED (stubbed proxy, no real muapi)');
process.exit(failures ? 1 : 0);
