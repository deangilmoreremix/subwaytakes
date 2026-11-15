// Stubbed browser test of Phase 6 (shows, batch, Best-of, series). NO real generations: network is stubbed.
// Usage: node scripts/phase6-e2e.mjs <video.mp4> <outDir> [baseUrl]
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [vid, out, base = 'http://localhost:5173'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const SB = 'https://stub.supabase.test', MEDIA = 'https://stub.media.test';
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 86400;
const jwt = `${b64({ alg: 'HS256' })}.${b64({ sub: 'u-1', role: 'authenticated', aud: 'authenticated', exp })}.sig`;
const user = { id: 'u-1', aud: 'authenticated', role: 'authenticated', email: 'd@example.com', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
const session = { access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 86400, expires_at: exp, user };
const json = (r, b) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(b) });
const jobs = []; const submits = []; let failN = 2; let n = 0;
let failures = 0;
const check = (name, ok, extra = '') => { console.log(ok ? 'PASS' : 'FAIL', name, extra); if (!ok) failures++; };

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
await ctx.addInitScript(s => { localStorage.setItem('sb-stub-auth-token', JSON.stringify(s)); localStorage.setItem('subwaytakes.muapi_key', 'mu_test'); }, session);
const page = await ctx.newPage();
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 200)));
const dialogs = []; page.on('dialog', d => { dialogs.push(d.message()); d.accept(); });
await page.route(`${MEDIA}/**`, r => r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'video/mp4', 'accept-ranges': 'bytes' }, body: readFileSync(vid) }));
await page.route(`${SB}/**`, async r => {
  const req = r.request(); const u = req.url(); const m = req.method();
  if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
  if (u.includes('/auth/v1/user')) return json(r, user);
  if (u.includes('/auth/v1/')) return json(r, { ...session, user });
  if (u.includes('user_profiles')) return json(r, { id: 'u-1', credits_balance: 1, subscription_tier: 'free' });
  if (u.includes('/rest/v1/clip_jobs')) {
    const id = new URL(u).searchParams.get('id')?.replace('eq.', '');
    if (m === 'GET') return json(r, jobs);
    if (m === 'POST') { const row = { id: `j${jobs.length + 1}`, created_at: new Date().toISOString(), error: null, output_url: null, request_id: null, ...JSON.parse(req.postData()) }; jobs.unshift(row); return json(r, row); }
    if (m === 'PATCH') { const row = jobs.find(j => j.id === id); if (row) Object.assign(row, JSON.parse(req.postData())); return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } }); }
  }
  if (u.includes('/functions/v1/muapi-proxy')) {
    const { method, path, body } = JSON.parse(req.postData() || '{}');
    if (path.endsWith('/estimate-cost')) return json(r, { cost: 0.6 });
    const sub = /^\/api\/v1\/([\w.\-]+)$/.exec(path);
    if (method === 'POST' && sub) { n++; submits.push({ slug: sub[1], body, n }); return json(r, { request_id: `req-${n}`, status: 'processing' }); }
    const pm = /predictions\/req-(\d+)\/result/.exec(path);
    if (pm) return Number(pm[1]) === failN ? json(r, { status: 'failed', outputs: [], error: 'Insufficient credits' }) : json(r, { status: 'completed', outputs: [`${MEDIA}/clip-${pm[1]}.mp4`], error: '' });
  }
  return json(r, []);
});
const project = () => page.evaluate(() => JSON.parse(localStorage.getItem('subwaytakes.project.v1') || '{"clips":[]}'));

await page.goto(`${base}/create`);
await page.getByRole('button', { name: 'Take', exact: true }).click();
const showBtn = name => page.getByRole('group', { name: 'Show' }).getByRole('button', { name, exact: true });

// ---- show switching
check('Hot Take has no question box', (await page.getByText('The host asks').count()) === 0);
await showBtn('Happiness').click();
check('Happiness shows the question box with its default', (await page.locator('input[maxlength="160"]').inputValue()) === 'What made you smile today?');
check('Happiness offers warm tones', (await page.getByRole('button', { name: 'Grateful' }).count()) === 1 && (await page.getByRole('button', { name: 'Heated' }).count()) === 0);
await page.locator('details summary').click();
const prompt = await page.locator('details p').innerText();
check('prompt asks the show question and keeps the card as the mic', /What made you smile today\?/.test(prompt) && /only microphone/.test(prompt) && !/So what's ur take/.test(prompt));
await page.screenshot({ path: `${out}/01-happiness.png` });
await showBtn('Reveal').click();
check('Reveal moves the place to street', await page.getByText(/Street ·/).first().isVisible());
await showBtn('Debate duel').click();
check('Duel shows guest B fields', (await page.getByText('Guest B takes').count()) === 1);
await page.screenshot({ path: `${out}/02-duel.png` });

// ---- batch: 3 episodes, the 2nd fails
await showBtn('Happiness').click();
await page.getByRole('button', { name: /Batch/ }).click();
await page.getByLabel('Batch lines').fill('Who made you smile today?\nWhat are you grateful for?\nWhat is your favourite memory?');
await page.screenshot({ path: `${out}/03-batch.png` });
await page.getByRole('button', { name: /Queue 3 episodes/ }).click();
await page.getByText(/Finished: 2\/3 done, 1 failed/).waitFor({ timeout: 90000 }).catch(async e => { console.log('BATCH STATE:', await page.locator('[role=status]').allInnerTexts(), 'submits', submits.length, 'jobs', JSON.stringify(jobs.map(j => [j.status, j.error]))); throw e; });
check('batch confirmed with a total price', dialogs.some(d => /3 episodes.*\$1\.80 in total/.test(d)), dialogs.join(' | '));
check('batch ran all three through muapi in order', submits.length === 3 && submits[0].body.prompt.includes('Who made you smile today?') && submits[2].body.prompt.includes('favourite memory'));
check('failure message is shown and did not stop the rest', await page.getByText('Episode 2: Insufficient credits').isVisible());
await page.waitForTimeout(800);
const p1 = await project();
check('two finished episodes landed on the timeline', p1.clips.filter(c => c.kind === 'video').length === 2, String(p1.clips.length));
const jobStates = jobs.map(j => j.status).sort().join(',');
check('job rows: 2 completed, 1 failed', jobStates === 'completed,completed,failed', jobStates);
await page.screenshot({ path: `${out}/04-batch-done.png` });

// ---- best of + series
await page.getByRole('button', { name: 'Output', exact: true }).click();
await page.getByText(/Show the on-screen graphic/).click();
await page.getByPlaceholder('Series name (optional)').fill('Daily Joy');
await page.getByLabel('Episode number').fill('3');
await page.getByRole('button', { name: /Line up the first 8 shots/ }).click();
await page.waitForTimeout(600);
const p2 = await project();
const v = p2.clips.filter(c => c.kind === 'video').sort((a, b) => a.start - b.start);
check('Best of joined the shots with a fade', v.length === 2 && v[1].transitionIn?.type === 'fade' && v[1].start === v[0].start + v[0].duration - v[1].transitionIn.frames);
check('series label saved', p2.style?.title?.series?.name === 'Daily Joy' && p2.style.title.series.episode === 3);
check('graphic follows the show (Happiness badge)', p2.style?.title?.data?.badge === 'HAPPY MOMENT');
await page.screenshot({ path: `${out}/05-output.png` });

await browser.close();
console.log(failures ? `${failures} FAILED` : 'ALL PASSED');
process.exit(failures ? 1 : 0);
