// Stubbed browser test of Phase 9 (saved projects, templates, onboarding, low-credit nudge, brand kit, usage, referrals, dubbing) through the
// real UI. NO real Supabase, no real muapi: a fake backend reproduces the server's behaviour (version-checked saves, kits, rewards, gateway).
// Usage: node scripts/phase9-e2e.mjs <video.mp4> <voice.mp3> <outDir> [baseUrl]
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [vid, mp3, out, base = 'http://localhost:5173'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const SB = 'https://stub.supabase.test', MEDIA = 'https://stub.media.test';
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 86400;
const jwt = (sub) => `${b64({ alg: 'HS256' })}.${b64({ sub, role: 'authenticated', aud: 'authenticated', exp })}.sig`;
const json = (r, b, status = 200) => r.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(b) });
let failures = 0;
const check = (name, ok, extra = '') => { console.log(ok ? 'PASS' : 'FAIL', name, extra); if (!ok) failures++; };
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

const PROJECT = (clips = []) => ({ fps: 30, style: { captionFont: 'anton' }, tracks: [{ id: 'v1', kind: 'video', name: 'Video' }, { id: 'c1', kind: 'caption', name: 'Captions' }, { id: 'a1', kind: 'audio', name: 'Sound' }, { id: 'e1', kind: 'effect', name: 'Effects' }], clips });
const VIDEO_CLIP = { id: 'a', trackId: 'v1', kind: 'video', label: 'shot', start: 0, duration: 240, trimStart: 0, sourceFrames: 240, src: `${MEDIA}/shot.mp4`, volume: 1 };

async function scenario({ balance = 5000, owned = ['pro_pack', 'recast', 'happiness', 'commercial'], local = null, projects = [], kit = null, ledger = [], referral = {}, cloudLink = null }, run) {
  const user = { id: 'u-1', aud: 'authenticated', role: 'authenticated', email: 'd@example.com', is_anonymous: false, app_metadata: {}, user_metadata: {}, email_confirmed_at: new Date().toISOString(), created_at: new Date().toISOString() };
  const session = { access_token: jwt('u-1'), refresh_token: 'r', token_type: 'bearer', expires_in: 86400, expires_at: exp, user };
  const st = { balance, owned, projects: projects.map(p => ({ ...p })), rpcs: [], kit, kitWrites: [], settingsWrites: [], ledger, referral: { code: 'ABCD1234', claimed: 2, rewarded: 1, credits_earned: 300, enabled: true, referrer_reward: 300, referee_reward: 200, ...referral }, claims: [], gateway: [], uploads: 0 };
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(([s, p, link]) => { localStorage.setItem('sb-stub-auth-token', JSON.stringify(s)); if (p) localStorage.setItem('subwaytakes.project.v1', JSON.stringify(p)); if (link) localStorage.setItem('subwaytakes.cloudProject.v1', JSON.stringify(link)); }, [session, local, cloudLink]);
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 200)));
  page.on('dialog', d => d.accept());
  await page.route(`${MEDIA}/**`, r => {
    const n = new URL(r.request().url()).pathname;
    const body = n.endsWith('.mp3') ? readFileSync(mp3) : n.endsWith('.png') ? PNG : readFileSync(vid);
    return r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': n.endsWith('.mp3') ? 'audio/mpeg' : n.endsWith('.png') ? 'image/png' : 'video/mp4', 'accept-ranges': 'bytes' }, body });
  });
  await page.route(`${SB}/**`, async r => {
    const req = r.request(); const u = req.url(); const m = req.method();
    if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (u.includes('/auth/v1/user')) return json(r, user);
    if (u.includes('/auth/v1/')) return json(r, { ...session, user });
    if (u.includes('/rest/v1/entitlements')) return json(r, st.owned.map(key => ({ key })));
    if (u.includes('/rest/v1/products')) return json(r, []);
    if (u.includes('user_profiles')) return json(r, { id: 'u-1', credits_balance: st.balance, subscription_tier: 'free' });
    if (u.includes('/rest/v1/credit_ledger')) return json(r, st.ledger);
    if (u.includes('/rest/v1/orders')) return json(r, []);
    if (u.includes('/rest/v1/clip_jobs')) { if (m === 'POST') return json(r, { id: 'j1', created_at: new Date().toISOString(), error: null, output_url: null, request_id: null, ...JSON.parse(req.postData() || '{}') }, 201); return m === 'GET' ? json(r, []) : r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } }); }
    if (u.includes('/rest/v1/character_bibles')) return json(r, []);
    if (u.includes('/rest/v1/rpc/project_create')) { const b = JSON.parse(req.postData()); const row = { id: `00000000-0000-0000-0000-00000000000${st.projects.length + 1}`, name: b.p_name || 'Untitled episode', version: 1, updated_at: new Date().toISOString(), data: b.p_data }; st.projects.push(row); st.rpcs.push(['create', b]); return json(r, [{ id: row.id, version: 1 }]); }
    if (u.includes('/rest/v1/rpc/project_save')) {
      const b = JSON.parse(req.postData()); st.rpcs.push(['save', b]); const row = st.projects.find(p => p.id === b.p_id);
      if (!row) return json(r, { message: 'not_found' }, 400);
      if (row.version !== b.p_expected) return json(r, { message: 'version_conflict', code: 'P0001' }, 400);
      if (b.p_data) row.data = b.p_data; if (b.p_name) row.name = b.p_name; row.version++; row.updated_at = new Date().toISOString(); return json(r, row.version);
    }
    if (u.includes('/rest/v1/projects')) {
      if (m === 'DELETE') { const id = new URL(u).searchParams.get('id')?.replace('eq.', ''); st.projects = st.projects.filter(p => p.id !== id); return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } }); }
      const id = new URL(u).searchParams.get('id')?.replace('eq.', '');
      if (id) { const row = st.projects.find(p => p.id === id); return row ? json(r, row) : json(r, { message: 'none' }, 406); }
      return json(r, st.projects.map(({ data, ...rest }) => rest));
    }
    if (u.includes('/rest/v1/brand_kits')) {
      if (m === 'POST') { const b = JSON.parse(req.postData()); st.kitWrites.push(b); st.kit = b; return r.fulfill({ status: 201, headers: { 'access-control-allow-origin': '*' } }); }
      return st.kit ? json(r, st.kit) : json(r, { message: 'none' }, 406);
    }
    if (u.includes('/rest/v1/user_settings')) { if (m === 'POST') { st.settingsWrites.push(JSON.parse(req.postData())); return r.fulfill({ status: 201, headers: { 'access-control-allow-origin': '*' } }); } return json(r, { message: 'none' }, 406); }
    if (u.includes('/rest/v1/rpc/my_referral')) return json(r, st.referral);
    if (u.includes('/functions/v1/referral-claim')) { st.claims.push(JSON.parse(req.postData() || '{}')); return json(r, { status: 'claimed' }); }
    if (u.includes('/storage/v1/object/media/')) { st.uploads++; return json(r, { Key: 'media/x' }); }
    if (u.includes('/functions/v1/muapi-gateway')) {
      const { method, path, body } = JSON.parse(req.postData() || '{}');
      if (path.endsWith('/estimate-cost')) return json(r, { cost: 20, unit: 'credits' });
      if (method === 'GET' && path.includes('/models/')) return json(r, { name: 'x' });
      const sub = /^\/api\/v1\/([\w.\-]+)$/.exec(path);
      if (method === 'POST' && sub) { st.gateway.push({ slug: sub[1], body }); st.balance -= 20; return json(r, { request_id: `req-${st.gateway.length}-${sub[1]}`, status: 'processing', credits: { charged: 20, balance: st.balance } }); }
      const pm = /predictions\/req-(\d+)-([\w.\-]+)\/result/.exec(path);
      if (pm) {
        const slug = pm[2]; const n = pm[1];
        if (slug === 'openai-whisper') return json(r, { status: 'completed', output: 'Pineapple belongs on pizza and anyone who disagrees is scared of joy.' });
        if (slug.startsWith('gemini')) return json(r, { status: 'completed', output: '"La pina va en la pizza y quien no esta de acuerdo le tiene miedo a la alegria."' });
        if (slug.includes('tts')) return json(r, { status: 'completed', outputs: [`${MEDIA}/voice-${n}.mp3`] });
        return json(r, { status: 'completed', outputs: [`${MEDIA}/dub-${n}.mp4`] });
      }
    }
    return json(r, []);
  });
  try { await run(page, st); } finally { await ctx.close(); }
}

// ---------------------------------------------------------------- saved projects
await scenario({ local: PROJECT([VIDEO_CLIP]) }, async (page, st) => {
  await page.goto(`${base}/create`);
  await page.getByTestId('save-status').waitFor();
  check('before the first save the project says it is a draft in this browser', /Draft in this browser/.test(await page.getByTestId('save-status').innerText()));
  await page.waitForFunction(() => /Saved/.test(document.querySelector('[data-testid=save-status]')?.textContent ?? ''), null, { timeout: 15000 });
  check('a project with a clip is saved to the account automatically', st.rpcs[0]?.[0] === 'create' && st.rpcs[0][1].p_data.clips.length === 1, JSON.stringify(st.rpcs[0]?.[1]?.p_name));
  await page.screenshot({ path: `${out}/01-saved.png` });

  // edit: rename through the top bar
  await page.getByTestId('project-name').click();
  await page.getByLabel('Project name').fill('Pineapple episode');
  await page.getByLabel('Project name').press('Enter');
  await page.waitForTimeout(800);
  const save = st.rpcs.find(r => r[0] === 'save');
  check('renaming saves against the version the app last saw', save && save[1].p_name === 'Pineapple episode' && save[1].p_expected === 1, JSON.stringify(save?.[1] && { n: save[1].p_name, e: save[1].p_expected }));
  check('the top bar shows the new name', (await page.getByTestId('project-name').innerText()) === 'Pineapple episode');

  // another device saves: our next save must not overwrite it
  st.projects[0].version += 5;
  await page.getByRole('button', { name: 'Model', exact: true }).click().catch(() => undefined);
  await page.getByRole('button', { name: 'Take', exact: true }).click();
  await page.getByRole('button', { name: 'Output', exact: true }).click();
  await page.getByText(/Show the on-screen graphic/).click();
  await page.getByPlaceholder('Series name (optional)').fill('Daily Joy');
  await page.getByRole('alert').filter({ hasText: 'changed on another device' }).waitFor({ timeout: 20000 });
  check('a save made from a stale copy shows the conflict choice, not an overwrite', true);
  const serverBefore = JSON.stringify(st.projects[0].data);
  await page.screenshot({ path: `${out}/02-conflict.png` });
  await page.getByRole('button', { name: 'Keep mine as a new project' }).click();
  await page.waitForTimeout(800);
  check('"keep mine" saves a copy as a NEW project and leaves the other one untouched', st.projects.length === 2 && /\(copy\)$/.test(st.projects[1].name) && JSON.stringify(st.projects[0].data) === serverBefore, st.projects.map(p => p.name).join(' | '));
});

// open from the Library, and guests are told to sign up
await scenario({ projects: [{ id: '00000000-0000-0000-0000-000000000001', name: 'Earlier episode', version: 3, updated_at: new Date().toISOString(), data: PROJECT([{ ...VIDEO_CLIP, label: 'from-server' }]) }] }, async (page) => {
  await page.goto(`${base}/library`);
  await page.getByRole('region', { name: 'Projects' }).getByText('Earlier episode').waitFor({ timeout: 15000 });
  await page.screenshot({ path: `${out}/03-library-projects.png` });
  await page.getByRole('link', { name: 'Open' }).first().click();
  await page.waitForURL(/\/create/, { timeout: 10000 });
  await page.getByTestId('project-name').filter({ hasText: 'Earlier episode' }).waitFor({ timeout: 15000 });
  await page.waitForFunction(() => { try { return JSON.parse(localStorage.getItem('subwaytakes.project.v1')).clips.some(c => c.label === 'from-server'); } catch { return false; } }, null, { timeout: 10000 });
  const clips = await page.evaluate(() => JSON.parse(localStorage.getItem('subwaytakes.project.v1')).clips.map(c => c.label));
  check('opening a saved project loads it into the editor and shows its name', clips.includes('from-server'), JSON.stringify(clips));
});

// ---------------------------------------------------------------- templates and onboarding
await scenario({ owned: [], balance: 0 }, async (page, st) => {
  await page.goto(`${base}/create`);
  const card = page.getByRole('region', { name: 'Getting started' });
  await card.waitFor({ timeout: 15000 });
  check('a new customer sees the checklist, 0 of 6', (await page.getByTestId('onboarding-progress').innerText()).startsWith('0 of 6'));
  check('it is honest that generating needs credits', /no credits yet/.test(await card.innerText()));
  check('and promises no free credits', !/free credits|free trial/i.test(await card.innerText()));
  await page.screenshot({ path: `${out}/04-onboarding.png` });

  await page.getByRole('button', { name: /Start from a template/ }).click();
  await page.getByRole('button', { name: /Golden-hour happiness/ }).click();
  await page.getByRole('group', { name: 'Unlock Happiness show' }).waitFor();
  check('a template that needs a pack shows what it needs instead of applying', true);
  await page.getByRole('button', { name: /London tube take/ }).click();
  await page.waitForTimeout(300);
  check('applying a template sets the city', (await page.getByRole('option', { name: /London/ }).getAttribute('aria-selected')) === 'true');
  check('and the checklist ticks "pick a show, a city or a template" from real state', (await page.getByTestId('onboarding-progress').innerText()).startsWith('1 of 6'));
  await page.screenshot({ path: `${out}/05-template-applied.png` });
  await page.getByRole('button', { name: 'Hide getting started' }).click();
  await page.waitForTimeout(500);
  check('dismissing hides it and is remembered in the account', (await card.count()) === 0 && st.settingsWrites.some(w => w.onboarding?.dismissed === true));
  await page.reload();
  await page.getByRole('button', { name: /Start from a template/ }).waitFor();
  check('and it stays hidden after a reload', (await page.getByRole('region', { name: 'Getting started' }).count()) === 0);
});

// ---------------------------------------------------------------- low-credit nudge
for (const [balance, expectText, name] of [[5000, null, 'plenty of credits: no nudge'], [100, 'Top up', 'under one typical shot: "Top up"'], [0, 'Get credits', 'no credits: "Get credits"']]) {
  await scenario({ balance }, async (page) => {
    await page.goto(`${base}/create`);
    await page.getByTestId('credit-pill').waitFor({ timeout: 15000 });
    const nudge = page.getByTestId('credit-nudge');
    check(name, expectText === null ? (await nudge.count()) === 0 : (await nudge.innerText()).includes(expectText));
    if (balance === 100) await page.screenshot({ path: `${out}/06-low-credits.png`, clip: { x: 700, y: 0, width: 580, height: 60 } });
  });
}

// ---------------------------------------------------------------- brand kit
await scenario({ owned: [] }, async (page) => {
  await page.goto(`${base}/settings`);
  await page.getByRole('group', { name: 'Unlock Brand kit and watermark-free exports' }).waitFor({ timeout: 15000 });
  check('without the licence the brand kit is locked and the fields are disabled', await page.getByLabel('Channel handle').isDisabled());
});
await scenario({ local: PROJECT([VIDEO_CLIP]) }, async (page, st) => {
  await page.goto(`${base}/settings`);
  await page.getByLabel('Channel handle').waitFor({ timeout: 15000 });
  await page.getByLabel('Channel handle').fill('@subwaytakes');
  await page.getByLabel('Sponsor line').fill('Brought to you by Acme');
  await page.getByLabel('Main colour (badges)', { exact: true }).fill('#e61e5a');
  await page.getByLabel('Upload logo').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: PNG });
  await page.waitForFunction(() => !!document.querySelector('img[alt="Your logo"]'), null, { timeout: 10000 });
  check('a logo uploads to the media bucket and previews', st.uploads === 1);
  await page.getByLabel('Upload logo').setInputFiles({ name: 'logo.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>') });
  await page.getByText('Use a PNG, JPEG or WebP image.').waitFor();
  check('an SVG is refused with a clear message and not uploaded', st.uploads === 1);
  await page.getByRole('button', { name: 'Save brand kit' }).click();
  await page.getByText('Brand kit saved').waitFor();
  const w = st.kitWrites[0];
  check('saving writes the kit with the user id, colours and handle', w && w.user_id === 'u-1' && w.handle === '@subwaytakes' && w.primary_color === '#e61e5a' && w.sponsor_text === 'Brought to you by Acme' && w.show_watermark === true, JSON.stringify(w));
  await page.screenshot({ path: `${out}/07-brand-kit.png`, fullPage: true });
  await page.goto(`${base}/create`);
  await page.waitForFunction(() => { try { return !!JSON.parse(localStorage.getItem('subwaytakes.project.v1')).style.brand; } catch { return false; } }, null, { timeout: 15000 });
  const brand = await page.evaluate(() => JSON.parse(localStorage.getItem('subwaytakes.project.v1')).style.brand);
  check('the project carries a snapshot of the brand (so exports are self-contained)', brand.handle === '@subwaytakes' && brand.primary === '#e61e5a' && brand.sponsor === 'Brought to you by Acme' && brand.watermark === true, JSON.stringify(brand));
});

// ---------------------------------------------------------------- usage
await scenario({ ledger: (() => { const d = n => new Date(Date.now() - n * 86400000).toISOString(); return [
  { delta: -150, kind: 'spend', reason: 'veo3.1-fast-text-to-video', ref: 'hold:1', created_at: d(1) },
  { delta: -100, kind: 'spend', reason: 'omnihuman-2-0', ref: 'hold:2', created_at: d(2) },
  { delta: -150, kind: 'spend', reason: 'veo3.1-fast-text-to-video', ref: 'hold:3', created_at: d(2) }, { delta: 150, kind: 'refund', reason: 'job failed', ref: 'hold:3', created_at: d(2) },
  { delta: 1000, kind: 'grant', reason: 'purchase', ref: 'order:1', created_at: d(3) }]; })() }, async (page) => {
  await page.goto(`${base}/settings`);
  await page.getByTestId('usage-total').waitFor({ timeout: 15000 });
  const region = page.getByRole('region', { name: 'Usage' });
  check('usage counts spend net of refunds, not grants', (await page.getByTestId('usage-total').innerText()) === '250');
  const text = await region.innerText();
  check('and splits it by kind of work', text.includes('Video shots') && text.includes('Lip-sync') && !text.includes('Voices'));
  await page.screenshot({ path: `${out}/08-usage.png` });
});

// ---------------------------------------------------------------- referrals
await scenario({}, async (page, st) => {
  await page.goto(`${base}/create?ref=abcd1234`);
  await page.waitForFunction(() => true);
  await page.waitForTimeout(1500);
  check('an invite link is applied to the new account once it is confirmed', st.claims.length === 1 && st.claims[0].code === 'ABCD1234', JSON.stringify(st.claims));
  check('and forgotten afterwards so it is not applied twice', (await page.evaluate(() => localStorage.getItem('subwaytakes.ref'))) === null);
  await page.goto(`${base}/settings`);
  await page.getByLabel('Your invite link').waitFor({ timeout: 15000 });
  check('Settings shows the invite link, the reward terms and the numbers', (await page.getByLabel('Your invite link').inputValue()).endsWith('/login?ref=ABCD1234') && /first purchase/.test(await page.getByRole('region', { name: 'Invite a friend' }).innerText()) && (await page.getByTestId('referral-stats').innerText()).includes('2 invited · 1 rewarded · 300 credits earned'));
  await page.screenshot({ path: `${out}/09-referral.png` });
});
await scenario({ referral: { enabled: false } }, async (page) => {
  await page.goto(`${base}/settings`);
  await page.getByRole('region', { name: 'Credits' }).waitFor({ timeout: 15000 });
  await page.waitForTimeout(800);
  check('when referrals are switched off the card is hidden', (await page.getByRole('region', { name: 'Invite a friend' }).count()) === 0);
});

// ---------------------------------------------------------------- dubbing
await scenario({ local: PROJECT([VIDEO_CLIP]) }, async (page, st) => {
  await page.goto(`${base}/create`);
  await page.getByRole('button', { name: 'Model', exact: true }).waitFor({ timeout: 15000 });
  await page.waitForTimeout(1500);
  // select the clip by clicking it on the timeline
  await page.getByRole('button', { name: 'shot clip' }).click();
  const panel = page.getByLabel('Dub this clip');
  await panel.waitFor({ timeout: 15000 });
  check('the Dub panel appears for a hosted video clip', true);
  await panel.getByRole('button', { name: 'Spanish' }).click();
  await panel.getByRole('button', { name: 'French' }).click();
  const cost = await page.getByTestId('dub-cost').innerText();
  check('the cost is shown in credits before anything runs', /credits/.test(cost), cost);
  await page.screenshot({ path: `${out}/10-dub-panel.png` });
  await panel.getByRole('button', { name: 'Dub it' }).click();
  await panel.getByRole('button', { name: 'Add to timeline' }).first().waitFor({ timeout: 90000 });
  await page.waitForFunction(() => document.querySelectorAll('[aria-label="Dub progress"] li').length === 2 && [...document.querySelectorAll('[aria-label="Dub progress"] li')].every(li => /Add to timeline/.test(li.textContent)), null, { timeout: 90000 });
  const slugs = st.gateway.map(g => g.slug);
  check('whisper ran once, then translate, voice and lip-sync for each language', slugs.filter(s => s === 'openai-whisper').length === 1 && slugs.filter(s => s.startsWith('gemini')).length === 2 && slugs.filter(s => s.includes('tts')).length === 2 && slugs.filter(s => s === 'sync-lipsync').length === 2, slugs.join(','));
  const lip = st.gateway.find(g => g.slug === 'sync-lipsync');
  check('the lip-sync is given the original clip', lip.body.video_url === `${MEDIA}/shot.mp4`, JSON.stringify(lip.body));
  await page.screenshot({ path: `${out}/11-dub-done.png` });
  await panel.getByRole('button', { name: 'Add to timeline' }).first().click();
  await page.waitForTimeout(800);
  const clips = await page.evaluate(() => JSON.parse(localStorage.getItem('subwaytakes.project.v1')).clips.filter(c => c.kind === 'video').map(c => [c.label, c.start]));
  check('a dub is added as its own clip after the original', clips.length === 2 && /dub/.test(clips[1][0]) && clips[1][1] >= 240, JSON.stringify(clips));
});
await scenario({ local: PROJECT([VIDEO_CLIP]), owned: [] }, async (page) => {
  await page.goto(`${base}/create`);
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'shot clip' }).click();
  await page.getByRole('group', { name: 'Unlock Dubbing' }).waitFor({ timeout: 15000 });
  check('without Pro Pack or Recast, dubbing shows its unlock prompt and the controls are off', await page.getByRole('button', { name: 'Spanish' }).isDisabled());
});

await browser.close();
console.log(failures ? `${failures} FAILED` : 'ALL PASSED');
process.exit(failures ? 1 : 0);
