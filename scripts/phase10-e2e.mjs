// Stubbed browser test of Phase 10 (content safety, consent, AI label, legal pages, error reporting, operations panel) through the real UI.
// NO real Supabase, no real muapi: a fake backend records what the page sends. Usage: node scripts/phase10-e2e.mjs <outDir> [baseUrl]
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
let failures = 0;
const check = (name, ok, extra = '') => { console.log(ok ? 'PASS' : 'FAIL', name, extra); if (!ok) failures++; };
const browser = await chromium.launch();

const CHAR = { id: 'c1', user_id: 'u-1', name: 'Maya', role: 'guest', age_range: 'late-20s', gender: 'woman', ethnicity: 'latina', clothing_style: 'a yellow raincoat', hair_description: 'big curls', distinguishing_features: null, energy_persona: 'warm', voice_style: 'warm', is_default: false, created_at: new Date().toISOString(), portrait_url: null, voice_provider: null, voice_id: null, voice_speed: 1 };

async function scenario({ signedIn = true, admin = false, consented = false, balance = 5000 }, run) {
  const user = { id: 'u-1', aud: 'authenticated', role: 'authenticated', email: 'd@example.com', is_anonymous: false, app_metadata: {}, user_metadata: {}, email_confirmed_at: new Date().toISOString(), created_at: new Date().toISOString() };
  const session = { access_token: jwt('u-1'), refresh_token: 'r', token_type: 'bearer', expires_in: 86400, expires_at: exp, user };
  const st = { consents: consented ? [{ version: '1' }] : [], consentWrites: [], gateway: [], errorReports: [], adminCalls: [], alerts: [{ id: 7, kind: 'stuck_holds', severity: 'warn', message: '7 credit holds have been open for over 2 hours. Check that the reaper is scheduled.', created_at: new Date().toISOString() }], terms: ['jane roe'] };
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  if (signedIn) await ctx.addInitScript(s => localStorage.setItem('sb-stub-auth-token', JSON.stringify(s)), session);
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 200)));
  page.on('dialog', d => d.accept());
  await page.route(`${SB}/**`, async r => {
    const req = r.request(); const u = req.url(); const m = req.method();
    if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (u.includes('/auth/v1/user')) return signedIn ? json(r, user) : json(r, { message: 'no session' }, 401);
    if (u.includes('/auth/v1/')) return signedIn ? json(r, { ...session, user }) : json(r, { message: 'no session' }, 401);
    if (u.includes('/rest/v1/entitlements')) return json(r, [{ key: 'pro_pack' }, { key: 'recast' }, { key: 'happiness' }, { key: 'commercial' }]);
    if (u.includes('user_profiles')) return json(r, { id: 'u-1', credits_balance: balance, subscription_tier: 'free' });
    if (u.includes('/rest/v1/consents')) {
      if (m === 'POST') { st.consentWrites.push(JSON.parse(req.postData())); st.consents.push({ version: '1' }); return r.fulfill({ status: 201, headers: { 'access-control-allow-origin': '*' } }); }
      return st.consents.length ? json(r, st.consents[0]) : json(r, { message: 'none' }, 406);
    }
    if (u.includes('/rest/v1/rpc/client_error_log')) { st.errorReports.push(JSON.parse(req.postData())); return json(r, true); }
    if (u.includes('/rest/v1/character_bibles')) return json(r, m === 'GET' ? [CHAR] : CHAR);
    if (u.includes('/rest/v1/clip_jobs')) return m === 'GET' ? json(r, []) : json(r, { id: 'j1', created_at: new Date().toISOString(), error: null, output_url: null, request_id: null }, 201);
    if (u.includes('/functions/v1/admin-credits')) {
      const body = JSON.parse(req.postData() || '{}'); st.adminCalls.push(body);
      if (!admin) return json(r, { error: 'Not an admin.' }, 403);
      switch (body.action) {
        case 'whoami': return json(r, { admin: true });
        case 'stats': return json(r, { credits_granted: 1, credits_spent_net: 0, credits_outstanding: 1, est_muapi_usd_completed: 0, est_muapi_usd_24h: 0, calls_24h: 0, failed_calls_24h: 0, open_holds: 0 });
        case 'settings': return json(r, { margin: 2.5, max_credits_per_call: 1500, max_calls_per_minute: 30, max_open_holds: 10, daily_credit_cap: 5000, kill_switch: false, enforce_entitlements: true });
        case 'billing': return json(r, { stats: { paid_cents: 0, refunded_cents: 0, orders_paid: 0, orders_reversed: 0, clawback_shortfall_credits: 0, needs_attention: 0 }, products: [] });
        case 'retention': return json(r, { stats: { active_users_7d: 0, paying_users: 0, repeat_buyers: 0, projects_saved: 0, referrals_claimed: 0, referrals_rewarded: 0 }, referral: { enabled: true, referrer_reward: 300, referee_reward: 200, min_order_cents: 1000, max_rewards_per_referrer: 20 } });
        case 'ops': return json(r, { metrics: { drifted_users: 0 }, alerts: st.alerts });
        case 'resolve_alert': st.alerts = st.alerts.filter(a => a.id !== body.id); return json(r, { metrics: {}, alerts: st.alerts });
        case 'safety_terms': return json(r, { terms: st.terms });
        case 'add_safety_term': st.terms.push(body.term); return json(r, { terms: st.terms });
        case 'remove_safety_term': st.terms = st.terms.filter(t => t !== body.term); return json(r, { terms: st.terms });
        case 'client_errors': return json(r, { errors: [{ id: 1, message: 'TypeError: x is undefined', url: 'https://app.test/create', created_at: new Date().toISOString() }] });
        default: return json(r, { error: 'Unknown action.' }, 400);
      }
    }
    if (u.includes('/functions/v1/muapi-gateway')) {
      const { method, path, body } = JSON.parse(req.postData() || '{}'); st.gateway.push({ method, path, prompt: body?.prompt });
      if (path.endsWith('/estimate-cost')) return json(r, { cost: 150, unit: 'credits' });
      const sub = /^\/api\/v1\/([\w.\-]+)$/.exec(path);
      if (method === 'POST' && sub) { st.balance = balance - 150; return json(r, { request_id: 'req-1', status: 'processing', credits: { charged: 150, balance: balance - 150 } }); }
      if (/predictions\/req-1\/result/.test(path)) return json(r, { status: 'completed', outputs: ['https://stub.media.test/x.mp4'] });
    }
    return json(r, []);
  });
  try { await run(page, st); } finally { await ctx.close(); }
}

// ---------------------------------------------------------------- legal pages are public
await scenario({ signedIn: false }, async (page) => {
  for (const [slug, title] of [['terms', 'Terms of Service'], ['privacy', 'Privacy Policy'], ['refunds', 'Refund Policy'], ['ai-policy', 'AI Content and Likeness Policy']]) {
    await page.goto(`${base}/${slug}`);
    await page.getByRole('heading', { level: 1, name: title }).waitFor({ timeout: 15000 });
    check(`/${slug} opens without signing in and says it is a draft needing review`, /not been reviewed by a lawyer/.test(await page.getByRole('note').innerText()));
  }
  await page.goto(`${base}/terms`);
  await page.screenshot({ path: `${out}/01-terms.png`, fullPage: true });
  await page.goto(`${base}/login`);
  await page.getByRole('button', { name: /Don't have an account/ }).click();
  const line = page.getByTestId('signup-consent');
  await line.waitFor();
  check('sign-up shows the agreement with links to the Terms, Privacy and AI policies', (await line.getByRole('link').allInnerTexts()).join('|') === 'Terms|Privacy Policy|AI and Likeness Policy');
  check('the sign-in page links to the legal pages too', (await page.getByRole('navigation', { name: 'Legal' }).getByRole('link').count()) === 4);
  await page.screenshot({ path: `${out}/02-signup-consent.png` });
});

// ---------------------------------------------------------------- face-upload consent
await scenario({}, async (page, st) => {
  await page.goto(`${base}/cast`);
  await page.getByText('Maya').first().click();
  const group = page.getByRole('group', { name: 'Photo and video consent' });
  await group.waitFor({ timeout: 15000 });
  check('Cast: the portrait upload is off until the person agrees', await page.getByLabel('Upload portrait').isDisabled());
  check('and "I agree" cannot be pressed before ticking the box', await group.getByRole('button', { name: 'I agree' }).isDisabled());
  await page.screenshot({ path: `${out}/03-consent-gate.png` });
  await group.getByRole('checkbox').check();
  await group.getByRole('button', { name: 'I agree' }).click();
  await page.waitForFunction(() => !document.querySelector('[aria-label="Photo and video consent"]'), null, { timeout: 8000 });
  check('agreeing records the consent with the wording version, then enables the upload', st.consentWrites.length === 1 && st.consentWrites[0].kind === 'face_upload' && st.consentWrites[0].version === '1' && st.consentWrites[0].user_id === 'u-1' && !(await page.getByLabel('Upload portrait').isDisabled()), JSON.stringify(st.consentWrites));
  await page.reload();
  await page.getByText('Maya').first().click();
  await page.getByLabel('Upload portrait').waitFor({ state: 'attached', timeout: 15000 });
  check('it is remembered after a reload (no second prompt)', (await page.getByRole('group', { name: 'Photo and video consent' }).count()) === 0 && !(await page.getByLabel('Upload portrait').isDisabled()));
});
await scenario({}, async (page) => {
  await page.goto(`${base}/recast`);
  await page.getByRole('group', { name: 'Photo and video consent' }).waitFor({ timeout: 15000 });
  check('Recast: both the source video and the reference photo uploads are off until the person agrees', (await page.getByLabel('Upload source video').isDisabled()) && (await page.getByLabel('Upload reference photos').isDisabled()));
});
await scenario({ consented: true }, async (page) => {
  await page.goto(`${base}/recast`);
  await page.getByLabel('Upload source video').waitFor({ state: 'attached', timeout: 15000 });
  await page.waitForTimeout(800);
  check('a customer who already agreed (recorded on their account) is not asked again, even on a new device', (await page.getByRole('group', { name: 'Photo and video consent' }).count()) === 0 && !(await page.getByLabel('Upload source video').isDisabled()));
});

// ---------------------------------------------------------------- content safety in the page
await scenario({}, async (page, st) => {
  await page.goto(`${base}/create`);
  const input = page.getByPlaceholder('Type a hot take…');
  await input.waitFor({ timeout: 15000 });
  await input.fill('Taylor Swift is the best singer');
  await page.getByRole('button', { name: /Generate/ }).click();
  await page.getByText(/does not create videos of real, named people/).waitFor({ timeout: 10000 });
  check('a take naming a real person is refused in the page with a clear reason and nothing is sent', st.gateway.filter(g => g.method === 'POST' && !g.path.endsWith('estimate-cost')).length === 0 && /not charged/.test(await page.locator('body').innerText()));
  await page.screenshot({ path: `${out}/04-blocked.png` });
  await input.fill('Pineapple belongs on pizza and anyone who disagrees is scared of joy.');
  await page.getByRole('button', { name: /Generate/ }).click();
  await page.waitForFunction(() => { try { return JSON.parse(localStorage.getItem('subwaytakes.project.v1')).clips.length > 0; } catch { return false; } }, null, { timeout: 30000 });
  check('the default take generates normally (the studio\'s own prompts pass the screen)', st.gateway.some(g => g.method === 'POST' && !g.path.endsWith('estimate-cost') && /microphone|card/i.test(g.prompt ?? '')));
});

// ---------------------------------------------------------------- AI label toggle
await scenario({}, async (page) => {
  await page.goto(`${base}/create`);
  await page.getByRole('button', { name: 'Output', exact: true }).click();
  const box = page.getByLabel('Label as AI-generated');
  await box.waitFor({ timeout: 15000 });
  check('exports are labelled AI-generated by default', await box.isChecked());
  await box.uncheck();
  await page.waitForFunction(() => { try { return JSON.parse(localStorage.getItem('subwaytakes.project.v1')).style.aiLabel === false; } catch { return false; } }, null, { timeout: 8000 });
  check('turning it off is stored on the project', true);
  await page.screenshot({ path: `${out}/05-ai-label.png` });
});

// ---------------------------------------------------------------- browser error reports
await scenario({}, async (page, st) => {
  await page.goto(`${base}/create?ref=ABCD1234&token=secret`);
  await page.getByPlaceholder('Type a hot take…').waitFor({ timeout: 15000 });
  await page.evaluate(() => { setTimeout(() => { throw new Error('Synthetic failure for the test'); }, 0); });
  await page.waitForTimeout(1500);
  const rep = st.errorReports[0];
  check('an uncaught browser error is reported, once', st.errorReports.length === 1 && /Synthetic failure/.test(rep.p_message), JSON.stringify(rep));
  check('with the page address stripped of its query (no invite codes or tokens)', rep.p_url === `${base}/create` && !/ref=|token/.test(JSON.stringify(rep)), rep.p_url);
});

// ---------------------------------------------------------------- operator panel
await scenario({ admin: true }, async (page, st) => {
  await page.goto(`${base}/admin`);
  const ops = page.getByRole('region', { name: 'Operations' });
  await ops.waitFor({ timeout: 20000 });
  await ops.getByRole('list', { name: 'Open alerts' }).waitFor();
  check('an open alert is shown with its severity and what to do', /WARN/i.test(await ops.innerText()) && /reaper is scheduled/.test(await ops.innerText()));
  await page.screenshot({ path: `${out}/06-admin-ops.png`, fullPage: true });
  await ops.getByRole('button', { name: 'Resolve' }).click();
  await ops.getByTestId('no-alerts').waitFor();
  check('resolving it clears the list', st.adminCalls.some(c => c.action === 'resolve_alert' && c.id === 7));
  await ops.getByRole('textbox', { name: 'Blocked term' }).fill('john doe');
  await ops.getByRole('button', { name: 'Add' }).click();
  await ops.getByRole('list', { name: 'Blocked terms list' }).getByText('john doe').waitFor();
  check('a blocked term can be added', st.adminCalls.some(c => c.action === 'add_safety_term' && c.term === 'john doe'));
  await ops.getByRole('button', { name: 'Remove jane roe' }).click();
  await page.waitForTimeout(500);
  check('and removed', st.adminCalls.some(c => c.action === 'remove_safety_term' && c.term === 'jane roe') && !st.terms.includes('jane roe'));
  check('recent browser errors are listed', /TypeError: x is undefined/.test(await ops.innerText()));
});
await scenario({ admin: false }, async (page) => {
  await page.goto(`${base}/admin`);
  await page.getByText(/for the operator only/).waitFor({ timeout: 20000 });
  check('a non-admin never sees the operations panel', (await page.getByRole('region', { name: 'Operations' }).count()) === 0);
});

await browser.close();
console.log(failures ? `${failures} FAILED` : 'ALL PASSED');
process.exit(failures ? 1 : 0);
