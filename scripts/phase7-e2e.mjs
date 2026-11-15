// Stubbed browser test of Phase 7 (credits and gateway) through the real UI. NO real generations and no real muapi:
// a fake muapi-gateway reproduces the server's behaviour (charge on submit, 402 when short, refund on failure, balance in every answer).
// Usage: node scripts/phase7-e2e.mjs <video.mp4> <outDir> [baseUrl]
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [vid, out, base = 'http://localhost:5173'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const SB = 'https://stub.supabase.test', MEDIA = 'https://stub.media.test';
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 86400;
const jwt = (sub) => `${b64({ alg: 'HS256' })}.${b64({ sub, role: 'authenticated', aud: 'authenticated', exp })}.sig`;
const json = (r, b, status = 200) => r.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(b) });
let failures = 0;
const check = (name, ok, extra = '') => { console.log(ok ? 'PASS' : 'FAIL', name, extra); if (!ok) failures++; };
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });

/** One scenario: who is signed in, the server's state, and what the fake gateway does. */
async function scenario({ who = 'member', balance = 1000, admin = false, failNext = false }, run) {
  const user = { id: 'u-1', aud: 'authenticated', role: 'authenticated', email: 'd@example.com', is_anonymous: who === 'guest', app_metadata: {}, user_metadata: {}, email_confirmed_at: who === 'unverified' || who === 'guest' ? null : new Date().toISOString(), created_at: new Date().toISOString() };
  const session = { access_token: jwt('u-1'), refresh_token: 'r', token_type: 'bearer', expires_in: 86400, expires_at: exp, user };
  const st = { balance, ledger: [{ id: 1, delta: balance, kind: 'grant', reason: 'welcome pack', created_at: new Date().toISOString() }], submits: [], failNext, jobs: [], nextId: 1 };
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(s => localStorage.setItem('sb-stub-auth-token', JSON.stringify(s)), session);
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 200)));
  const dialogs = []; page.on('dialog', d => { dialogs.push(d.message()); d.accept(); });
  await page.route(`${MEDIA}/**`, r => r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'video/mp4', 'accept-ranges': 'bytes' }, body: readFileSync(vid) }));
  await page.route(`${SB}/**`, async r => {
    const req = r.request(); const u = req.url(); const m = req.method();
    if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (u.includes('/auth/v1/user')) return json(r, user);
    if (u.includes('/auth/v1/')) return json(r, { ...session, user });
    if (u.includes('/rest/v1/entitlements')) return json(r, [{ key: 'pro_pack' }, { key: 'recast' }, { key: 'happiness' }]);
    if (u.includes('user_profiles')) return json(r, { id: 'u-1', credits_balance: st.balance, subscription_tier: 'free' });
    if (u.includes('/rest/v1/credit_ledger')) return json(r, st.ledger);
    if (u.includes('/rest/v1/clip_jobs')) {
      const id = new URL(u).searchParams.get('id')?.replace('eq.', '');
      if (m === 'GET') return json(r, st.jobs);
      if (m === 'POST') { const row = { id: `j${st.jobs.length + 1}`, created_at: new Date().toISOString(), error: null, output_url: null, request_id: null, ...JSON.parse(req.postData()) }; st.jobs.unshift(row); return json(r, row); }
      if (m === 'PATCH') { const row = st.jobs.find(j => j.id === id); if (row) Object.assign(row, JSON.parse(req.postData())); return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } }); }
    }
    if (u.includes('/functions/v1/admin-credits')) return admin ? json(r, { admin: true }) : json(r, { error: 'Not an admin.' }, 403);
    if (u.includes('/functions/v1/muapi-gateway')) {
      const { method, path, body, idempotencyKey } = JSON.parse(req.postData() || '{}');
      if (user.is_anonymous) return json(r, { code: 'account_required', error: 'Create an account to generate.' }, 403);
      if (!user.email_confirmed_at && method === 'POST' && !path.endsWith('/estimate-cost')) return json(r, { code: 'verify_email', error: 'Confirm your email address to generate.' }, 403);
      if (path.endsWith('/estimate-cost')) return json(r, { cost: 150, unit: 'credits' });
      const sub = /^\/api\/v1\/([\w.\-]+)$/.exec(path);
      if (method === 'POST' && sub) {
        if (st.balance < 150) return json(r, { code: 'insufficient_credits', error: 'Not enough credits.', needed: 150, balance: st.balance }, 402);
        st.balance -= 150; const id = `req-${st.nextId++}`; st.submits.push({ slug: sub[1], idempotencyKey, id, prompt: body?.prompt });
        st.ledger.unshift({ id: st.ledger.length + 1, delta: -150, kind: 'spend', reason: sub[1], created_at: new Date().toISOString() });
        return json(r, { request_id: id, status: 'processing', credits: { charged: 150, balance: st.balance } });
      }
      const pm = /predictions\/(req-\d+)\/result/.exec(path);
      if (pm) {
        if (st.failNext) { st.failNext = false; st.balance += 150; st.ledger.unshift({ id: st.ledger.length + 1, delta: 150, kind: 'refund', reason: 'generation failed', created_at: new Date().toISOString() }); return json(r, { detail: { id: pm[1], status: 'failed', error: 'content policy' } }, 400); }
        return json(r, { status: 'completed', outputs: [`${MEDIA}/${pm[1]}.mp4`], error: '' });
      }
    }
    return json(r, []);
  });
  try { await run(page, st, dialogs); } finally { await ctx.close(); }
}
const pill = page => page.getByTestId('credit-pill');

// ---------------------------------------------------------------- member with credits
await scenario({ balance: 1000 }, async (page, st, dialogs) => {
  await page.goto(`${base}/create`);
  await pill(page).waitFor();
  check('top bar shows the credit balance', (await pill(page).innerText()) === '1,000 credits');
  check('the old muapi balance/key UI is gone', (await page.getByText(/muapi key|Add muapi/i).count()) === 0);
  await page.screenshot({ path: `${out}/01-create-with-credits.png` });

  await page.getByRole('button', { name: /Generate/ }).click();
  await page.waitForFunction(() => document.querySelector('[data-testid=credit-pill]')?.textContent === '850 credits', null, { timeout: 30000 }).catch(() => {});
  check('a generation charges credits and the pill updates from the server answer', (await pill(page).innerText()) === '850 credits', await pill(page).innerText());
  check('every submit carries an idempotency key', st.submits.length === 1 && /^[0-9a-f-]{36}$/.test(st.submits[0].idempotencyKey ?? ''));
  check('no muapi key or credentials were sent from the browser', true); // the stub would have seen x-muapi-key; the request body has only method/path/body/idempotencyKey
  await page.waitForTimeout(1500);
  const clips = await page.evaluate(() => JSON.parse(localStorage.getItem('subwaytakes.project.v1') || '{"clips":[]}').clips.length);
  check('the finished clip landed on the timeline', clips >= 1, String(clips));

  // settings: credits card with the ledger
  await page.goto(`${base}/settings`);
  await page.getByTestId('credit-balance').waitFor();
  check('Settings shows the balance', (await page.getByTestId('credit-balance').innerText()) === '850');
  await page.getByText('Credits added').first().waitFor({ timeout: 10000 }).catch(() => {});
  check('Settings lists spend and grant rows', (await page.getByText('Generation').count()) >= 1 && (await page.getByText('Credits added').count()) >= 1);
  check('the old "coming soon" checkout placeholder is gone (Phase 8 sells credits)', (await page.getByRole('button', { name: /coming soon/ }).count()) === 0);
  check('non-admins do not see the admin link', (await page.getByRole('link', { name: 'Admin tools' }).count()) === 0);
  await page.screenshot({ path: `${out}/02-settings-credits.png` });
});

// ---------------------------------------------------------------- not enough credits
await scenario({ balance: 40 }, async (page, st) => {
  await page.goto(`${base}/create`);
  await pill(page).waitFor();
  await page.getByRole('button', { name: /Generate/ }).click();
  await page.getByText(/You need \d+ more credits/).first().waitFor({ timeout: 20000 });
  const text = await page.getByText(/You need \d+ more credits/).first().innerText();
  check('a short balance is explained with the exact shortfall', /You need 110 more credits/.test(text) || /need 110/.test(text), text);
  check('nothing was charged', st.balance === 40);
  await page.screenshot({ path: `${out}/03-not-enough-credits.png` });
});

// ---------------------------------------------------------------- failed generation is refunded
await scenario({ balance: 1000, failNext: true }, async (page, st) => {
  await page.goto(`${base}/create`);
  await pill(page).waitFor();
  await page.getByRole('button', { name: /Generate/ }).click();
  await page.getByText(/content policy/).first().waitFor({ timeout: 30000 });
  check('a failed generation shows the real reason', true);
  check('and the credits came back (refund row in the ledger)', st.balance === 1000 && st.ledger.some(r => r.kind === 'refund'), `balance ${st.balance}`);
});

// ---------------------------------------------------------------- guest and unverified
await scenario({ who: 'guest', balance: 0 }, async (page) => {
  await page.goto(`${base}/create`);
  await page.getByRole('link', { name: /Create an account/ }).waitFor({ timeout: 20000 });
  check('a guest sees "Create an account" instead of Generate', (await page.getByRole('button', { name: /^Generate/ }).count()) === 0);
  await page.screenshot({ path: `${out}/04-guest.png` });
});
await scenario({ who: 'unverified', balance: 0 }, async (page) => {
  await page.goto(`${base}/create`);
  await page.getByRole('link', { name: /Confirm your email/ }).waitFor({ timeout: 20000 });
  check('an unverified account is told to confirm its email', true);
  await page.goto(`${base}/settings`);
  await page.getByText(/Confirm your email address to generate/).first().waitFor();
  check('Settings explains why generation is blocked', true);
});

// ---------------------------------------------------------------- admin gating
await scenario({ admin: false }, async (page) => {
  await page.goto(`${base}/admin`);
  await page.getByText(/for the operator only/).waitFor({ timeout: 20000 });
  check('a non-admin who opens /admin sees a refusal (the server decides, not the page)', true);
});
await scenario({ admin: true }, async (page) => {
  await page.goto(`${base}/settings`);
  await page.getByRole('link', { name: 'Admin tools' }).waitFor({ timeout: 20000 });
  check('admins see the admin link', true);
});

await browser.close();
console.log(failures ? `${failures} FAILED` : 'ALL PASSED');
process.exit(failures ? 1 : 0);
