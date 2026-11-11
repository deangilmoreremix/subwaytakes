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
  { id: 'j1', pipeline: 'native', model: 'veo3.1-fast-text-to-video', request_id: 'r1', stage: 'done', status: 'completed', input: {}, output_url: 'https://stub.media.test/clip.mp4', error: null, created_at: new Date().toISOString() },
  { id: 'j2', pipeline: 'native', model: 'kling-v3-turbo-standard-text-to-video', request_id: 'r2', stage: 'failed', status: 'failed', input: {}, output_url: null, error: 'Insufficient credits. Top up your muapi wallet.', created_at: new Date().toISOString() },
];

import { existsSync, readFileSync } from 'node:fs';
const PLACEHOLDER = process.env.PLACEHOLDER_MP4;

function seedProject(fps = 30) {
  const src = 'https://stub.media.test/clip.mp4';
  const v = (id, start, duration, trimStart, label) => ({ id, trackId: 'v1', kind: 'video', label, start, duration, trimStart, sourceFrames: 90, src, volume: 1 });
  return { fps, tracks: [{ id: 'v1', kind: 'video', name: 'Video' }, { id: 'c1', kind: 'caption', name: 'Captions' }], clips: [
    v('a', 0, 90, 0, 'Pineapple belongs on pizza'), v('b', 90, 72, 0, 'Cereal is a soup'), v('c', 168, 60, 0, 'Pigeons run this city'),
    { id: 'k1', trackId: 'c1', kind: 'caption', label: 'Caption', start: 10, duration: 70, trimStart: 0, text: 'Pineapple belongs on pizza' },
    { id: 'k2', trackId: 'c1', kind: 'caption', label: 'Caption', start: 95, duration: 60, trimStart: 0, text: 'Cereal is a soup' } ] };
}

async function newPage(browser, vp, { key, proxy = 'ok', withJobs = false, project = false }) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2 });
  await ctx.addInitScript(([k, s, pr]) => {
    if (pr) localStorage.setItem('subwaytakes.project.v1', JSON.stringify(pr));
    localStorage.setItem('sb-stub-auth-token', JSON.stringify(s));
    if (k) localStorage.setItem('subwaytakes.muapi_key', k);
  }, [key, session, project ? seedProject() : null]);
  const page = await ctx.newPage();
  const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
  await page.route('https://stub.media.test/**', route => PLACEHOLDER && existsSync(PLACEHOLDER) ? route.fulfill({ status: 200, contentType: 'video/mp4', headers: { 'access-control-allow-origin': '*' }, body: readFileSync(PLACEHOLDER) }) : route.fulfill({ status: 404 }));
  await page.route(`${SB}/**`, route => {
    const u = route.request().url(); const m = route.request().method();
    if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (u.includes('/auth/v1/user')) return json(route, user);
    if (u.includes('/auth/v1/')) return json(route, { ...session, user });
    if (u.includes('/functions/v1/muapi-proxy')) {
      if (proxy === 'processing') { const b = route.request().postData() || ''; return json(route, b.includes('predictions') ? { status: 'processing' } : { request_id: 'r9' }); }
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
const phoneTall = { width: 390, height: 1500 }; // page scrolls inside the shell, so use a tall viewport for long pages
const browser = await chromium.launch();
const shot = async (page, name, full = true) => { await page.waitForTimeout(600); await page.screenshot({ path: `${out}/${name}.png`, fullPage: full }); console.log(name); };

const K = 'mu_live_demo_key_123';
const dims = { desktop, phone, phoneTall };
{ // Settings
  let { ctx, page } = await newPage(browser, desktop, {});
  await page.goto(`${base}/settings`); await page.getByText('muapi API key').waitFor();
  await shot(page, '10-settings-no-key-desktop'); await ctx.close();
  ({ ctx, page } = await newPage(browser, desktop, {}));
  await page.goto(`${base}/settings`); await page.getByPlaceholder('muapi key').fill(K);
  await page.getByText('Save & verify').click(); await page.getByText(/Connected/).first().waitFor();
  await shot(page, '11-settings-verified-desktop'); await ctx.close();
}
{ // Studio create with timeline editor
  let { ctx, page } = await newPage(browser, desktop, {});
  await page.goto(`${base}/create`); await page.getByLabel('Timeline editor').waitFor();
  await shot(page, '20-studio-empty-no-key-desktop', false); await ctx.close();

  ({ ctx, page } = await newPage(browser, desktop, { key: K, withJobs: true, project: true }));
  await page.goto(`${base}/create`); await page.getByLabel('Pineapple belongs on pizza clip').first().waitFor(); await page.waitForTimeout(1200);
  { const b = await page.getByLabel('Pineapple belongs on pizza clip').first().boundingBox(); await page.mouse.click(b.x + 150, b.y - 20); await page.waitForTimeout(900); }
  await shot(page, '21-studio-timeline-desktop', false);
  // select + inspector clip tab
  await page.getByLabel('Cereal is a soup clip').click(); await page.waitForTimeout(300);
  await shot(page, '22-studio-clip-selected-desktop', false);
  await page.getByRole('button', { name: 'Media', exact: true }).click(); await shot(page, '23-studio-media-tab-desktop', false);
  await ctx.close();

  // Real interaction test: split, trim, move, delete, undo
  ({ ctx, page } = await newPage(browser, desktop, { key: K, withJobs: true, project: true }));
  await page.goto(`${base}/create`); await page.getByLabel('Pineapple belongs on pizza clip').first().waitFor();
  const ls = () => page.evaluate(() => JSON.parse(localStorage.getItem('subwaytakes.project.v1') || '{}').clips?.filter(c => c.kind === 'video').map(c => [c.start, c.duration, c.trimStart]));
  const before = JSON.stringify(await ls());
  const box = await page.getByLabel('Pineapple belongs on pizza clip').first().boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y - 20); // ruler seek to the middle of clip a
  await page.getByLabel('Pineapple belongs on pizza clip').first().click(); await page.keyboard.press('s'); await page.waitForTimeout(500);
  const afterSplit = await ls();
  const second = page.getByLabel('Pineapple belongs on pizza clip').nth(1);
  const sb = await second.boundingBox();
  await page.mouse.move(sb.x + sb.width - 3, sb.y + sb.height / 2); await page.mouse.down(); await page.mouse.move(sb.x + sb.width - 63, sb.y + sb.height / 2, { steps: 5 }); await page.mouse.up(); await page.waitForTimeout(500);
  const afterTrim = await ls();
  await page.keyboard.press('Delete'); await page.waitForTimeout(500);
  const afterDelete = await ls();
  await page.keyboard.press('Control+z'); await page.waitForTimeout(500);
  const afterUndo = await ls();
  console.log('INTERACTION', JSON.stringify({ before: JSON.parse(before), afterSplit, afterTrim, afterDelete, afterUndo }));
  await shot(page, '24-studio-after-edits-desktop', false);
  await ctx.close();

  ({ ctx, page } = await newPage(browser, desktop, { key: K, withJobs: true, proxy: 'processing', project: true }));
  await page.goto(`${base}/create`); await page.getByLabel('Pineapple belongs on pizza clip').first().waitFor();
  await page.getByRole('button', { name: /Generate/ }).click(); await page.getByText('Rendering').first().waitFor(); await page.waitForTimeout(1200);
  await shot(page, '25-studio-rendering-desktop', false); await ctx.close();
}
{ // Phone
  let { ctx, page } = await newPage(browser, phoneTall, { key: K, withJobs: true, project: true });
  await page.goto(`${base}/create`); await page.getByLabel('Pineapple belongs on pizza clip').first().waitFor(); await page.waitForTimeout(1000);
  await shot(page, '30-studio-phone');
  await ctx.close();
}
{ // Library
  let { ctx, page } = await newPage(browser, desktop, { key: K, withJobs: true });
  await page.goto(`${base}/library`); await page.getByText('Everything').waitFor();
  await shot(page, '40-library-gallery-desktop', false); await ctx.close();
  ({ ctx, page } = await newPage(browser, desktop, { key: K }));
  await page.goto(`${base}/library`); await page.getByText('No shots yet').waitFor();
  await shot(page, '41-library-empty-desktop', false); await ctx.close();
}
await browser.close();
