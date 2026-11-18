// Stubbed browser test of Phase 11 (Scripture and Motivation packs) through the real UI. NO real Supabase, Stripe or muapi.
// Usage: node scripts/phase11-e2e.mjs <outDir> [baseUrl]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [out, base = 'http://localhost:5173'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const SB = 'https://stub.supabase.test';
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 86400;
const jwt = `${b64({ alg: 'HS256' })}.${b64({ sub: 'u-1', role: 'authenticated', aud: 'authenticated', exp })}.sig`;
const json = (r, b, status = 200) => r.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(b) });
let failures = 0; const check = (n, ok, x = '') => { console.log(ok ? 'PASS' : 'FAIL', n, x); if (!ok) failures++; };
const PRODUCTS = [
  { key: 'bible_pack', kind: 'bundle', name: 'Bible Pack', description: 'The Scripture show.', price_cents: 2700, currency: 'usd', credits: 300, entitlements: ['bible'], sort: 80, active: true },
  { key: 'motivation_pack', kind: 'bundle', name: 'Motivation Pack', description: 'The Motivation show.', price_cents: 2700, currency: 'usd', credits: 300, entitlements: ['motivation'], sort: 90, active: true },
];
const browser = await chromium.launch();

async function session(owned, run) {
  const user = { id: 'u-1', aud: 'authenticated', role: 'authenticated', email: 'd@example.com', is_anonymous: false, app_metadata: {}, user_metadata: {}, email_confirmed_at: new Date().toISOString(), created_at: new Date().toISOString() };
  const sess = { access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 86400, expires_at: exp, user };
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(s => localStorage.setItem('sb-stub-auth-token', JSON.stringify(s)), sess);
  const page = await ctx.newPage();
  const checkouts = [];
  page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 200)));
  await page.route(`${SB}/**`, r => {
    const req = r.request(), u = req.url(), m = req.method();
    if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (u.includes('/auth/v1/user')) return json(r, user);
    if (u.includes('/auth/v1/')) return json(r, { ...sess, user });
    if (u.includes('/rest/v1/entitlements')) return json(r, owned.map(key => ({ key })));
    if (u.includes('/rest/v1/products')) return json(r, PRODUCTS);
    if (u.includes('user_profiles')) return json(r, { id: 'u-1', credits_balance: 5000, subscription_tier: 'free' });
    if (u.includes('/functions/v1/checkout-create')) { checkouts.push(JSON.parse(req.postData() || '{}')); return json(r, { url: 'https://stub.stripe.test/pay' }); }
    if (u.includes('/functions/v1/muapi-gateway')) return json(r, { balance: 5000 });
    if (m === 'GET') return json(r, []);
    return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
  });
  await page.route('https://stub.stripe.test/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: '<html>stub checkout</html>' }));
  await page.goto(`${base}/create`); await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Take', exact: true }).click();
  try { await run(page, checkouts); } finally { await ctx.close(); }
}
const show = (page, label) => page.getByRole('group', { name: 'Show' }).getByRole('button', { name: new RegExp('^' + label + '( locked)?$') });

// ---- 1. Not owned: both shows are locked, the unlock prompt names the right pack, and checkout carries only the product key
await session([], async (page, checkouts) => {
  check('both new shows appear in the picker', await show(page, 'Scripture').count() === 1 && await show(page, 'Motivation').count() === 1);
  await show(page, 'Scripture').click();
  const prompt = page.getByRole('group', { name: /Unlock Bible Pack/ });
  check('locked Scripture shows the Bible Pack prompt with its price', await prompt.isVisible() && (await prompt.innerText()).includes('$27'));
  check('the show did not switch while locked', await page.getByTestId('verse-picker').count() === 0);
  await page.screenshot({ path: `${out}/p11-locked.png` });
  await prompt.getByRole('button', { name: /Get Bible Pack/ }).click(); await page.waitForTimeout(600);
  check('checkout request carries only the product key', checkouts.length === 1 && Object.keys(checkouts[0]).join() === 'productKey' && checkouts[0].productKey === 'bible_pack', JSON.stringify(checkouts[0]));
});
await session(['bible'], async page => {
  await show(page, 'Motivation').click();
  check('owning Bible does not unlock Motivation', await page.getByRole('group', { name: /Unlock Motivation Pack/ }).isVisible());
});

// ---- 2. Owned: Scripture flow
await session(['bible', 'motivation'], async page => {
  await show(page, 'Scripture').click();
  const picker = page.getByTestId('verse-picker'); await picker.waitFor();
  check('verse picker appears for Scripture only', true);
  check('library has many verses to search', await picker.locator('[data-verse]').count() >= 40);
  await page.getByLabel('Search verses').fill('Psalm 23');
  check('search by reference narrows the list', await picker.locator('[data-verse]').count() >= 1 && await picker.locator('[data-verse]').count() < 10);
  await page.getByLabel('Search verses').fill('');
  await picker.getByRole('button', { name: 'Peace', exact: true }).click();
  const first = picker.locator('[data-verse]').first(); const ref = await first.getAttribute('data-verse'); await first.click();
  check('picking a verse shows what will be on screen', (await picker.innerText()).includes(`On screen: ${ref}`));
  const kjv = await first.innerText();
  await picker.getByRole('button', { name: 'WEB', exact: true }).click(); await page.waitForTimeout(300);
  check('switching translation keeps the reference and changes the text', (await picker.locator(`[data-verse="${ref}"]`).first().innerText()) !== kjv && (await picker.innerText()).includes('(WEB)'));
  await picker.getByRole('button', { name: 'BSB', exact: true }).click(); await page.waitForTimeout(300);
  check('BSB is offered and its licence line is shown', (await picker.innerText()).includes('(BSB)') && /public domain/i.test(await picker.innerText()));
  await page.getByLabel('Reflection').fill('It slows me down when the week gets loud.');
  const note = page.getByTestId('bible-note'); const noteText = await note.innerText();
  check('the note shows the composed line, the verse reading status and the Cuts recommendation', /The guest says:/.test(noteText) && /Cuts/.test(noteText) && /(fits this clip|too long)/.test(noteText), noteText.slice(0, 120));
  // type my own
  await picker.getByRole('button', { name: 'Type my own' }).click();
  await page.getByLabel('Verse reference').fill('Psalm 46:10'); await page.getByLabel('Verse text').fill('Be still, and know that I am God.');
  check('typed verse is labelled as the customer\'s own text', (await picker.innerText()).includes('your text'));
  await picker.getByRole('button', { name: 'Type my own' }).click();
  // the 12 second template length so a short verse is spoken
  await page.getByRole('button', { name: 'Output', exact: true }).click(); await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/p11-scripture-output.png` });
  await page.getByRole('button', { name: 'Take', exact: true }).click();
  await page.screenshot({ path: `${out}/p11-scripture-take.png` });

  // ---- 3. Motivation: the take is edited directly and there is no verse picker
  await show(page, 'Motivation').click();
  check('verse picker is gone on Motivation', await page.getByTestId('verse-picker').count() === 0);
  check('Motivation switches the host question', (await page.getByLabel('The host asks').or(page.locator('input[maxlength="160"]')).first().inputValue()).includes('hardest day'));
  await page.screenshot({ path: `${out}/p11-motivation.png` });
  // switching back to Hot Take leaves the normal take box
  await show(page, 'Hot Take').click();
  check('Hot Take has the normal take box again', await page.getByLabel('Reflection').count() === 0);
});

console.log(failures ? `${failures} FAILED` : 'ALL PASSED (stubbed backend and checkout)');
await browser.close(); process.exit(failures ? 1 : 0);
