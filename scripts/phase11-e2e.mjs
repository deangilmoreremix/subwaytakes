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

// ---- 2. Owned: Scripture flow with the full-size search
await session(['bible', 'motivation'], async page => {
  await show(page, 'Scripture').click();
  const picker = page.getByTestId('verse-picker'); await picker.waitFor();
  check('verse picker shows a Find button (no list crammed into the side panel)', await page.getByTestId('find-verse').isVisible() && await picker.locator('[data-verse]').count() === 0);
  await page.getByTestId('find-verse').click();
  const dlg = page.getByRole('dialog', { name: 'Find a verse' }); await dlg.waitFor();
  const input = dlg.getByTestId('find-input');
  check('search box is focused and the whole library is listed', await input.evaluate(el => el === document.activeElement) && /^\d+ verses/.test(await dlg.getByTestId('find-count').innerText()));
  await page.screenshot({ path: `${out}/p11-find-verse-empty.png` });
  const count = async () => Number((await dlg.getByTestId('find-count').innerText()).match(/^(\d+)/)?.[1] ?? 0);
  await input.fill('strength'); await page.waitForTimeout(250);
  const nStrength = await count(); check('typing a word narrows the list and highlights it', nStrength > 3 && nStrength < 300 && await dlg.locator('mark').count() > 0, `${nStrength} results`);
  await page.screenshot({ path: `${out}/p11-find-verse-word.png` });
  await input.fill('John 3:16'); await page.waitForTimeout(250);
  check('a reference finds exactly that verse first', (await dlg.locator('[data-result]').first().getAttribute('data-result')) === 'John 3:16');
  await input.fill('scared'); await page.waitForTimeout(250);
  const nScared = await count(); check('everyday words work ("scared" finds fear and courage verses)', nScared > 3, `${nScared} results`);
  await page.screenshot({ path: `${out}/p11-find-verse-intent.png` });
  await input.fill("can't sleep"); await page.waitForTimeout(250);
  check('"can\'t sleep" finds rest and peace verses', await count() > 0);
  await input.fill('zzzzqqq'); await page.waitForTimeout(250);
  check('no match shows a friendly empty state with example searches', /No verses found/.test(await dlg.getByTestId('find-count').innerText()) && await dlg.locator('button', { hasText: /^strength$/ }).count() > 0);
  await page.screenshot({ path: `${out}/p11-find-verse-none.png` });
  await dlg.locator('button', { hasText: /^strength$/ }).first().click(); await page.waitForTimeout(250);
  check('an example search fills the box', (await input.inputValue()) === 'strength');
  await input.fill(''); await dlg.getByRole('group', { name: 'Themes' }).getByRole('button', { name: /^Comfort/ }).click(); await page.waitForTimeout(250);
  const nComfort = await count(); check('theme chips filter the list', nComfort > 5 && nComfort < 80, `${nComfort} results`);
  await dlg.getByRole('group', { name: 'Translation in search' }).getByRole('button', { name: 'BSB', exact: true }).click(); await page.waitForTimeout(200);
  await page.screenshot({ path: `${out}/p11-find-verse-theme.png` });
  // keyboard: arrow down then Enter chooses the second result
  const second = await dlg.locator('[data-result]').nth(1).getAttribute('data-result');
  await input.press('ArrowDown'); await input.press('Enter'); await page.waitForTimeout(300);
  check('arrow keys and Enter choose a verse and close the dialog', await dlg.count() === 0 && (await page.getByTestId('picked-verse').innerText()).includes(second));
  check('the picked verse is shown on a card with its translation', (await page.getByTestId('picked-verse').innerText()).includes('BSB'));
  await page.getByRole('button', { name: 'WEB', exact: true }).first().click(); await page.waitForTimeout(250);
  check('switching translation keeps the reference and changes the text', (await page.getByTestId('picked-verse').innerText()).includes('WEB') && (await page.getByTestId('picked-verse').innerText()).includes(second));
  await page.getByLabel('Reflection').fill('It slows me down when the week gets loud.');
  const noteText = await page.getByTestId('bible-note').innerText();
  check('the note shows the composed line, the verse reading status and the Cuts recommendation', /The guest says:/.test(noteText) && /Cuts/.test(noteText) && /(fits this clip|too long)/.test(noteText));
  await page.getByRole('button', { name: 'Remove verse' }).click();
  check('a picked verse can be removed', await page.getByTestId('picked-verse').count() === 0);
  await page.getByRole('button', { name: 'Type my own' }).click();
  await page.getByLabel('Verse reference').fill('Psalm 46:10'); await page.getByLabel('Verse text').fill('Be still, and know that I am God.');
  check('typed verse is labelled as the customer\'s own text', (await picker.innerText()).includes('your text'));
  await page.getByRole('button', { name: 'Type my own' }).click();
  await page.getByTestId('find-verse').click(); await dlg.waitFor(); await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  check('Escape closes the dialog', await dlg.count() === 0);

  // ---- 3. Motivation: quote search
  await show(page, 'Motivation').click();
  check('verse picker is gone on Motivation, quote picker is there', await page.getByTestId('verse-picker').count() === 0 && await page.getByTestId('quote-picker').isVisible());
  check('the guest can still write their own advice with no quote', await page.locator('textarea').first().isVisible());
  await page.getByTestId('find-quote').click();
  const qd = page.getByRole('dialog', { name: 'Find a quote' }); await qd.waitFor();
  const qin = qd.getByTestId('find-input');
  const qcount = async () => Number((await qd.getByTestId('find-count').innerText()).match(/^(\d+)/)?.[1] ?? 0);
  check('the quote library is listed with authors', (await qcount()) >= 35 && (await qd.locator('[data-result]').first().innerText()).length > 20);
  await page.screenshot({ path: `${out}/p11-find-quote-empty.png` });
  await qin.fill('dreams'); await page.waitForTimeout(250); check('search by word', await qcount() > 0 && await qd.locator('mark').count() > 0);
  await page.screenshot({ path: `${out}/p11-find-quote-word.png` });
  await qin.fill('Emerson'); await page.waitForTimeout(250); const names = await qd.locator('[data-result]').allInnerTexts(); check('search by author', names.length > 3 && names.every(t => t.includes('Ralph Waldo Emerson')));
  await qin.fill('I want to quit'); await page.waitForTimeout(250); check('"I want to quit" finds quotes about perseverance and strength', await qcount() > 0);
  await page.screenshot({ path: `${out}/p11-find-quote-intent.png` });
  await qin.fill('Nothing great'); await page.waitForTimeout(250);
  await qd.locator('[data-result]').first().click(); await page.waitForTimeout(300);
  const pq = await page.getByTestId('picked-quote').innerText();
  check('a picked quote shows its exact text and author', /Nothing great was ever achieved without enthusiasm\./.test(pq) && /Ralph Waldo Emerson/.test(pq));
  await page.getByLabel('Comment').fill('It helps me when I feel flat on a Monday.');
  const qn = await page.getByTestId('quote-note').innerText();
  check('the note shows the spoken line with the author and the Cuts recommendation', /Ralph Waldo Emerson wrote:/.test(qn) && /Cuts/.test(qn), qn.slice(0, 100));
  await page.screenshot({ path: `${out}/p11-motivation-quote.png` });
  await page.getByRole('button', { name: 'Remove quote' }).click();
  check('removing the quote returns to the guest\'s own advice', await page.getByTestId('picked-quote').count() === 0 && await page.locator('textarea').first().isVisible());
  await show(page, 'Hot Take').click();
  check('Hot Take has the normal take box again', await page.getByLabel('Reflection').count() === 0 && await page.getByTestId('quote-picker').count() === 0);
});

console.log(failures ? `${failures} FAILED` : 'ALL PASSED (stubbed backend and checkout)');
await browser.close(); process.exit(failures ? 1 : 0);
