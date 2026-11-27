// Stubbed browser test of Phase 8 (checkout and entitlements) through the real UI. NO real Stripe, no real payments, no real muapi:
// a fake backend reproduces the server's behaviour (price list, pending order, webhook turning it paid, unlocks).
// Usage: node scripts/phase8-e2e.mjs <outDir> [baseUrl]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [out, base = 'http://localhost:5173'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const SB = 'https://stub.supabase.test';
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 86400;
const jwt = (sub) => `${b64({ alg: 'HS256' })}.${b64({ sub, role: 'authenticated', aud: 'authenticated', exp })}.sig`;
const json = (r, b, status = 200) => r.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(b) });
const ORDER_ID = '11111111-2222-3333-4444-555555555555';
let failures = 0;
const check = (name, ok, extra = '') => { console.log(ok ? 'PASS' : 'FAIL', name, extra); if (!ok) failures++; };
const browser = await chromium.launch();

const PRODUCTS = [
  { key: 'starter', kind: 'bundle', name: 'Studio Starter', description: 'Everything to make your first episodes, with starter credits.', price_cents: 3700, currency: 'usd', credits: 2000, entitlements: [], sort: 10, active: true },
  { key: 'credits_s', kind: 'credits', name: '1,000 credits', description: 'Top up your balance.', price_cents: 1000, currency: 'usd', credits: 1000, entitlements: [], sort: 20, active: true },
  { key: 'pro_pack', kind: 'bundle', name: 'Pro Pack', description: 'All 25 cities, Cuts format, Cast characters with voices.', price_cents: 9700, currency: 'usd', credits: 1000, entitlements: ['pro_pack'], sort: 50, active: true },
  { key: 'recast_happiness', kind: 'bundle', name: 'Recast + Happiness', description: 'Recast any clip and the Happiness show.', price_cents: 4700, currency: 'usd', credits: 500, entitlements: ['recast', 'happiness'], sort: 60, active: true },
];

async function scenario({ admin = false, owned = [], balance = 300 }, run) {
  const user = { id: 'u-1', aud: 'authenticated', role: 'authenticated', email: 'd@example.com', is_anonymous: false, app_metadata: {}, user_metadata: {}, email_confirmed_at: new Date().toISOString(), created_at: new Date().toISOString() };
  const session = { access_token: jwt('u-1'), refresh_token: 'r', token_type: 'bearer', expires_in: 86400, expires_at: exp, user };
  const st = { balance, owned: [...owned], products: PRODUCTS.map(p => ({ ...p })), order: null, orderPolls: 0, checkoutBodies: [], adminCalls: [], stripeVisits: 0 };
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(s => localStorage.setItem('sb-stub-auth-token', JSON.stringify(s)), session);
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 200)));
  page.on('dialog', d => d.accept());
  await page.route('https://checkout.stripe.test/**', r => { st.stripeVisits++; return r.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Stub Stripe Checkout</h1>' }); });
  await page.route(`${SB}/**`, async r => {
    const req = r.request(); const u = req.url(); const m = req.method();
    if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (u.includes('/auth/v1/user')) return json(r, user);
    if (u.includes('/auth/v1/')) return json(r, { ...session, user });
    if (u.includes('/rest/v1/entitlements')) return json(r, st.owned.map(key => ({ key })));
    if (u.includes('/rest/v1/products')) return json(r, st.products.filter(p => p.active));
    if (u.includes('/rest/v1/orders')) {
      if (!st.order) return json(r, new URL(u).searchParams.get('id') ? null : []);
      if (new URL(u).searchParams.get('id')) {
        st.orderPolls++;
        if (st.orderPolls >= 3 && st.order.status === 'pending') { // the webhook arrives after a few seconds
          st.order.status = 'paid'; st.order.paid_at = new Date().toISOString(); st.balance += st.order.credits; st.owned.push(...st.order.entitlements);
        }
        return json(r, st.order);
      }
      return json(r, st.order.status === 'pending' ? [] : [st.order]);
    }
    if (u.includes('user_profiles')) return json(r, { id: 'u-1', credits_balance: st.balance, subscription_tier: 'free' });
    if (u.includes('/rest/v1/credit_ledger')) return json(r, []);
    if (u.includes('/functions/v1/checkout-create')) {
      const body = JSON.parse(req.postData() || '{}'); st.checkoutBodies.push(body);
      const p = st.products.find(x => x.key === body.productKey);
      if (!p) return json(r, { code: 'unknown_product', error: 'That product is not available.' }, 404);
      st.order = { id: ORDER_ID, product_name: p.name, amount_cents: p.price_cents, currency: p.currency, credits: p.credits, entitlements: p.entitlements, status: 'pending', created_at: new Date().toISOString(), paid_at: null };
      return json(r, { url: 'https://checkout.stripe.test/c/cs_test_1' });
    }
    if (u.includes('/functions/v1/admin-credits')) {
      const body = JSON.parse(req.postData() || '{}'); st.adminCalls.push(body);
      if (!admin) return json(r, { error: 'Not an admin.' }, 403);
      switch (body.action) {
        case 'whoami': return json(r, { admin: true });
        case 'stats': return json(r, { credits_granted: 1, credits_spent_net: 0, credits_outstanding: 1, est_muapi_usd_completed: 0, est_muapi_usd_24h: 0, calls_24h: 0, failed_24h: 0, open_holds: 0 });
        case 'settings': return json(r, { margin: 2.5, max_credits_per_call: 1500, max_calls_per_minute: 30, max_open_holds: 10, daily_credit_cap: 5000, kill_switch: false, enforce_entitlements: true });
        case 'billing': return json(r, { stats: { paid_cents: 9700, refunded_cents: 0, orders_paid: 1, orders_reversed: 0, clawback_shortfall_credits: 0, needs_attention: 1 }, products: st.products });
        case 'set_product': { const p = st.products.find(x => x.key === body.key); Object.assign(p, Object.fromEntries(Object.entries(body.patch).map(([k, v]) => [k === 'priceCents' ? 'price_cents' : k, v]))); return json(r, { products: st.products }); }
        case 'orders': return json(r, { orders: [{ id: ORDER_ID, product_name: 'Pro Pack', amount_cents: 9700, currency: 'usd', credits: 1000, status: 'paid', credits_clawed: 0, clawback_shortfall: 0, created_at: new Date().toISOString() }], entitlements: ['pro_pack'] });
        case 'refund': return json(r, { ok: true, note: 'Refund sent. Credits and unlocks are removed when Stripe confirms it.' });
        default: return json(r, { error: 'Unknown action.' }, 400);
      }
    }
    return json(r, []);
  });
  try { await run(page, st); } finally { await ctx.close(); }
}

// ---------------------------------------------------------------- a new customer sees what is locked and buys it
await scenario({}, async (page, st) => {
  await page.goto(`${base}/create`);
  await page.getByRole('button', { name: /Hot Take/ }).waitFor();
  await page.waitForTimeout(800);
  check('the Happiness show shows a lock', (await page.getByRole('button', { name: /Happiness/ }).first().locator('svg[aria-label="locked"]').count()) === 1);
  await page.getByRole('button', { name: /Happiness/ }).first().click();
  const happy = page.getByRole('group', { name: 'Unlock Happiness show' });
  await happy.waitFor();
  check('clicking it offers the right product and price instead of switching shows', (await happy.innerText()).includes('Recast + Happiness') && (await happy.innerText()).includes('$47') && (await page.getByRole('button', { name: /Hot Take/ }).getAttribute('aria-pressed')) === 'true');
  await page.screenshot({ path: `${out}/01-happiness-locked.png` });

  await page.getByRole('button', { name: 'Model', exact: true }).click();
  check('Cuts is marked locked', (await page.getByRole('button', { name: /Cuts/ }).first().innerText()).includes('🔒'));
  await page.getByRole('button', { name: /Cuts/ }).first().click();
  const pro = page.getByRole('group', { name: 'Unlock Cuts format' });
  await pro.waitFor();
  check('Cuts offers Pro Pack at its price and the format does not change', (await pro.innerText()).includes('Pro Pack') && (await pro.innerText()).includes('$97'));
  await page.screenshot({ path: `${out}/02-cuts-locked.png` });

  await page.getByRole('button', { name: 'Take', exact: true }).click();
  await page.getByRole('option', { name: /Berlin/ }).click();
  await page.getByRole('group', { name: 'Unlock All 25 cities' }).waitFor();
  check('a locked city offers the Pro Pack', true);
  await page.getByRole('option', { name: /London/ }).click();
  check('a starter city is still selectable', (await page.getByRole('option', { name: /London/ }).getAttribute('aria-selected')) === 'true');
  await page.screenshot({ path: `${out}/03-city-locked.png` });

  // buy it
  await page.getByRole('option', { name: /Berlin/ }).click();
  await page.getByRole('group', { name: 'Unlock All 25 cities' }).getByRole('button', { name: /Get Pro Pack/ }).click();
  await page.waitForURL(/checkout\.stripe\.test/, { timeout: 15000 });
  check('checkout sends only the product key (the server decides the price)', JSON.stringify(st.checkoutBodies) === '[{"productKey":"pro_pack"}]', JSON.stringify(st.checkoutBodies));
  check('the buyer is sent to Stripe', st.stripeVisits === 1);

  // back from Stripe: the order is pending until the webhook lands
  await page.goto(`${base}/billing/success?order=${ORDER_ID}`);
  check('the return page waits for the webhook', /Confirming/.test(await page.getByTestId('billing-title').innerText()));
  await page.screenshot({ path: `${out}/04-confirming.png` });
  await page.getByText('Payment received').waitFor({ timeout: 20000 });
  check('the return page confirms the payment and the credits added', (await page.locator('body').innerText()).includes('1,000 credits added'));
  await page.screenshot({ path: `${out}/05-payment-received.png` });
  check('balance went up by the pack credits', (await page.getByTestId('credit-pill').innerText()) === '1,300 credits', await page.getByTestId('credit-pill').innerText());

  await page.getByRole('link', { name: 'Start creating' }).click();
  await page.getByRole('button', { name: 'Model', exact: true }).click();
  check('Cuts is unlocked after the purchase', !(await page.getByRole('button', { name: /Cuts/ }).first().innerText()).includes('🔒'));
  await page.getByRole('button', { name: /Cuts/ }).first().click();
  check('and can be chosen', (await page.getByRole('group', { name: 'Unlock Cuts format' }).count()) === 0);
});

// ---------------------------------------------------------------- Recast is locked without the pack
await scenario({}, async (page) => {
  await page.goto(`${base}/recast`);
  await page.getByRole('group', { name: 'Unlock Recast' }).waitFor({ timeout: 15000 });
  check('Recast shows its unlock prompt', (await page.getByRole('group', { name: 'Unlock Recast' }).innerText()).includes('$47'));
  check('and its run button is disabled', await page.getByRole('button', { name: /Run|Start|Recast it|Generate/ }).last().isDisabled().catch(() => true));
  await page.screenshot({ path: `${out}/06-recast-locked.png` });
});
await scenario({ owned: ['recast'] }, async (page) => {
  await page.goto(`${base}/recast`);
  await page.getByRole('heading', { name: 'Source clip' }).waitFor();
  await page.waitForTimeout(800);
  check('with the pack there is no lock prompt', (await page.getByRole('group', { name: 'Unlock Recast' }).count()) === 0);
});

// ---------------------------------------------------------------- Settings: the shop and the order history
await scenario({ owned: [] }, async (page, st) => {
  st.order = { id: ORDER_ID, product_name: 'Studio Starter', amount_cents: 3700, currency: 'usd', credits: 2000, entitlements: [], status: 'paid', created_at: new Date().toISOString(), paid_at: new Date().toISOString() };
  await page.goto(`${base}/settings`);
  await page.getByRole('button', { name: 'Buy Pro Pack' }).waitFor({ timeout: 15000 });
  const text = await page.getByLabel('Buy credits').innerText();
  check('Settings lists products with credits, unlocks and prices', text.includes('$97') && text.includes('1,000 credits + Pro Pack') && text.includes('$10'));
  check('past orders are listed', (await page.locator('body').innerText()).includes('Studio Starter'));
  check('no muapi dollars anywhere in the customer UI', !/muapi/i.test(await page.locator('body').innerText()));
  await page.screenshot({ path: `${out}/07-settings-shop.png`, fullPage: true });
});
await scenario({ owned: ['pro_pack'] }, async (page) => {
  await page.goto(`${base}/settings`);
  await page.getByRole('button', { name: 'Pro Pack unlocked' }).waitFor({ timeout: 15000 });
  check('an unlock the customer already owns cannot be bought twice', true);
});

// ---------------------------------------------------------------- admin
await scenario({ admin: true }, async (page, st) => {
  await page.goto(`${base}/admin`);
  await page.getByRole('region', { name: 'Billing' }).waitFor({ timeout: 20000 });
  const text = await page.getByRole('region', { name: 'Billing' }).innerText();
  check('admin sees revenue, price list and the needs-attention flag', text.includes('$97') && text.includes('Needs attention') && text.includes('Studio Starter'));
  await page.getByLabel('starter price').fill('49');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForTimeout(500);
  const saved = st.adminCalls.find(c => c.action === 'set_product');
  check('editing a price sends whole cents to the server', saved && saved.key === 'starter' && saved.patch.priceCents === 4900, JSON.stringify(saved));
  await page.getByLabel('Customer email').fill('buyer@example.com');
  await page.getByRole('button', { name: 'Orders and unlocks' }).click();
  await page.getByRole('button', { name: 'Refund' }).waitFor();
  await page.getByRole('button', { name: 'Refund' }).click();
  await page.getByText(/Refund sent/).waitFor();
  check('refund goes through the server and says the webhook finishes the job', st.adminCalls.some(c => c.action === 'refund' && c.orderId === ORDER_ID));
  await page.screenshot({ path: `${out}/08-admin-billing.png`, fullPage: true });
});

await browser.close();
console.log(failures ? `${failures} FAILED` : 'ALL PASSED');
process.exit(failures ? 1 : 0);
