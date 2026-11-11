// Repeatable UI screenshots against STUBBED network (no real Supabase/muapi calls).
// Usage: VITE_SUPABASE_URL=https://stub.supabase.test VITE_SUPABASE_ANON_KEY=stub npm run dev  (port 5173)
//        node scripts/screenshots.mjs <outDir> [baseUrl]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');

const out = process.argv[2] || './shots';
const base = process.argv[3] || 'http://localhost:5173';
const SB = 'https://stub.supabase.test';
mkdirSync(out, { recursive: true });

const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 86400 * 30;
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'u-1', role: 'authenticated', aud: 'authenticated', exp })}.sig`;
const user = { id: 'u-1', aud: 'authenticated', role: 'authenticated', email: 'demo@example.com', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
const session = { access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 86400 * 30, expires_at: exp, user };

const jobs = [
  { id: 'j1', pipeline: 'native', model: 'veo3.1-fast-text-to-video', request_id: 'r1', stage: 'done', status: 'completed', input: {}, output_url: 'data:video/mp4;base64,', error: null, created_at: new Date().toISOString() },
  { id: 'j2', pipeline: 'native', model: 'kling-v3-turbo-standard-text-to-video', request_id: 'r2', stage: 'failed', status: 'failed', input: {}, output_url: null, error: 'Insufficient credits. Top up your muapi wallet.', created_at: new Date().toISOString() },
];

async function newPage(browser, vp, { key, proxy = 'ok', withJobs = false }) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2 });
  await ctx.addInitScript(([k, s]) => {
    localStorage.setItem('sb-stub-auth-token', JSON.stringify(s));
    if (k) localStorage.setItem('subwaytakes.muapi_key', k);
  }, [key, session]);
  const page = await ctx.newPage();
  const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
  await page.route(`${SB}/**`, route => {
    const u = route.request().url(); const m = route.request().method();
    if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (u.includes('/auth/v1/user')) return json(route, user);
    if (u.includes('/auth/v1/')) return json(route, { ...session, user });
    if (u.includes('/functions/v1/muapi-proxy')) {
      return proxy === 'ok' ? json(route, { balance: 42.5, currency: 'credits' }) : json(route, { error: 'Invalid API key (401 from muapi)' });
    }
    if (u.includes('/rest/v1/clip_jobs')) return json(route, m === 'GET' ? (withJobs ? jobs : []) : jobs[0]);
    if (u.includes('/rest/v1/user_profiles')) return json(route, { id: 'u-1', display_name: 'Demo', credits_balance: 100, subscription_tier: 'free', default_city_style: 'nyc', default_duration: 6 });
    return json(route, []);
  });
  return { ctx, page };
}

const desktop = { width: 1280, height: 800 };
const phone = { width: 390, height: 844 };
const phoneTall = { width: 390, height: 1900 }; // page scrolls inside the shell, so use a tall viewport for long pages
const browser = await chromium.launch();
const shot = async (page, name, full = true) => { await page.waitForTimeout(600); await page.screenshot({ path: `${out}/${name}.png`, fullPage: full }); console.log(name); };

{ // Settings: empty / verified / error
  let { ctx, page } = await newPage(browser, desktop, {});
  await page.goto(`${base}/settings`); await page.getByText('muapi API key').waitFor();
  await shot(page, '1a-settings-key-empty'); await ctx.close();

  ({ ctx, page } = await newPage(browser, desktop, {}));
  await page.goto(`${base}/settings`); await page.getByPlaceholder('muapi key').fill('mu_live_demo_key_123');
  await page.getByText('Save & verify').click(); await page.getByText(/Connected/).waitFor();
  await shot(page, '1b-settings-key-verified'); await ctx.close();

  ({ ctx, page } = await newPage(browser, desktop, { proxy: 'bad' }));
  await page.goto(`${base}/settings`); await page.getByPlaceholder('muapi key').fill('bad_key');
  await page.getByText('Save & verify').click(); await page.getByText(/Invalid API key/).waitFor();
  await shot(page, '1c-settings-key-error'); await ctx.close();
}
{ // Create: no key (phone), form + prompt preview (desktop), job history (desktop + phone)
  let { ctx, page } = await newPage(browser, phone, {});
  await page.goto(`${base}/create`); await page.getByText("What's ur take?").first().waitFor();
  await shot(page, '2a-create-no-key-phone'); await ctx.close();

  ({ ctx, page } = await newPage(browser, desktop, { key: 'mu_live_demo_key_123', withJobs: true }));
  await page.goto(`${base}/create`); await page.getByText('Prompt preview').click();
  await shot(page, '2b-create-form-prompt-preview-desktop'); await ctx.close();

  ({ ctx, page } = await newPage(browser, phoneTall, { key: 'mu_live_demo_key_123', withJobs: true }));
  await page.goto(`${base}/create`); await page.getByText('Insufficient credits').waitFor();
  await shot(page, '2c-create-jobs-completed-and-failed-phone'); await ctx.close();
}
await browser.close();
