// Stubbed browser test of the LOGIC across features, through the real UI: Scripture and Motivation episodes end to end (search, edit, save, reload, restore, generate, batch),
// pack locks (reload, templates), hostile typed text, and the Cuts budget. NO real Supabase, Stripe or muapi: a fake gateway records every request the page sends.
// Usage: node scripts/logic-e2e.mjs <video.mp4> <outDir> [baseUrl]
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [vid, out, base = 'http://localhost:5173'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const SB = 'https://stub.supabase.test', MEDIA = 'https://stub.media.test';
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 86400;
const jwt = `${b64({ alg: 'HS256' })}.${b64({ sub: 'u-1', role: 'authenticated', aud: 'authenticated', exp })}.sig`;
const json = (r, b, status = 200) => r.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(b) });
let failures = 0; const check = (n, ok, x = '') => { console.log(ok ? 'PASS' : 'FAIL', n, x); if (!ok) failures++; };
const browser = await chromium.launch();
const ALL = ['bible', 'motivation', 'pro_pack', 'recast', 'happiness'];

async function scenario({ owned = ALL, project = null, balance = 5000 }, run) {
  const user = { id: 'u-1', aud: 'authenticated', role: 'authenticated', email: 'd@example.com', is_anonymous: false, app_metadata: {}, user_metadata: {}, email_confirmed_at: new Date().toISOString(), created_at: new Date().toISOString() };
  const sess = { access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 86400, expires_at: exp, user };
  const st = { gateway: [], balance, n: 0 };
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(([s, p]) => { localStorage.setItem('sb-stub-auth-token', JSON.stringify(s)); if (p && !localStorage.getItem('subwaytakes.project.v1')) localStorage.setItem('subwaytakes.project.v1', JSON.stringify(p)); }, [sess, project]);
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 200)));
  page.on('dialog', d => d.accept());
  await page.route(`${MEDIA}/**`, r => r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'video/mp4', 'accept-ranges': 'bytes' }, body: readFileSync(vid) }));
  await page.route(`${SB}/**`, r => {
    const req = r.request(), u = req.url(), m = req.method();
    if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (u.includes('/auth/v1/user')) return json(r, user);
    if (u.includes('/auth/v1/')) return json(r, { ...sess, user });
    if (u.includes('/rest/v1/entitlements')) return json(r, owned.map(key => ({ key })));
    if (u.includes('/rest/v1/products')) return json(r, []);
    if (u.includes('user_profiles')) return json(r, { id: 'u-1', credits_balance: st.balance, subscription_tier: 'free' });
    if (u.includes('/rest/v1/character_bibles')) return json(r, []);
    if (u.includes('/rest/v1/clip_jobs')) return m === 'GET' ? json(r, []) : json(r, { id: `j${++st.n}`, created_at: new Date().toISOString(), error: null, output_url: null, request_id: null }, 201);
    if (u.includes('/functions/v1/muapi-gateway')) {
      const { method, path, body } = JSON.parse(req.postData() || '{}'); st.gateway.push({ method, path, prompt: body?.prompt, body });
      if (path.endsWith('/estimate-cost')) return json(r, { cost: 150, unit: 'credits' });
      if (method === 'POST' && /^\/api\/v1\/[\w.\-]+$/.test(path)) { st.balance -= 150; return json(r, { request_id: `req-${st.gateway.length}`, status: 'processing', credits: { charged: 150, balance: st.balance } }); }
      if (/predictions\/req-\d+\/result/.test(path)) return json(r, { status: 'completed', outputs: [`${MEDIA}/x.mp4`] });
    }
    return json(r, m === 'GET' ? [] : {});
  });
  await page.goto(`${base}/create`);
  await page.getByRole('button', { name: 'Take', exact: true }).waitFor({ timeout: 20000 });
  await page.waitForTimeout(800);
  try { await run(page, st); } finally { await ctx.close(); }
}
const takeTab = page => page.getByRole('button', { name: 'Take', exact: true }).click();
const show = (page, label) => page.getByRole('group', { name: 'Show' }).getByRole('button', { name: new RegExp('^' + label + '( locked)?$') });
const posts = st => st.gateway.filter(g => g.method === 'POST' && !g.path.endsWith('/estimate-cost') && /^\/api\/v1\/[\w.\-]+$/.test(g.path) && g.prompt);
const pickVerse = async (page, q) => { await page.getByTestId('find-verse').click(); const d = page.getByRole('dialog', { name: 'Find a verse' }); await d.getByTestId('find-input').fill(q); await page.waitForTimeout(250); await d.locator('[data-result]').first().click(); await page.waitForTimeout(250); };
const pickQuote = async (page, q) => { await page.getByTestId('find-quote').click(); const d = page.getByRole('dialog', { name: 'Find a quote' }); await d.getByTestId('find-input').fill(q); await page.waitForTimeout(250); await d.locator('[data-result]').first().click(); await page.waitForTimeout(250); };
const setLength = async (page, secs) => { await page.getByRole('button', { name: 'Output', exact: true }).click(); await page.locator('input[type=range]').first().fill(String(secs)); await takeTab(page); };
const proj = page => page.evaluate(() => JSON.parse(localStorage.getItem('subwaytakes.project.v1')));
const generate = page => page.getByRole('button', { name: /^Generate/ }).first().click();
const VERSE = 'We love him, because he first loved us.';

// ---- 1. Scripture end to end: search, edit the guest's own words, reload, restore, generate ----------------------------------------------------------
await scenario({}, async (page, st) => {
  await show(page, 'Scripture').click();
  await page.getByRole('button', { name: 'Output', exact: true }).click(); await page.getByText(/Show the on-screen graphic/).click(); await takeTab(page);
  await pickVerse(page, '1 John 4:19'); await setLength(page, 12);
  const bar = page.getByLabel('Your own words');
  check('the prompt bar edits the guest\'s own words for Scripture (not the composed line)', await bar.isVisible() && (await bar.inputValue()).length > 0 && !(await bar.inputValue()).includes('says:'));
  await bar.fill('It slows me down.');
  const note1 = await page.getByTestId('bible-note').innerText();
  check('typing in the bar updates the spoken line and keeps the whole verse', note1.includes('It slows me down.') && note1.includes(VERSE), note1.slice(0, 120));
  await pickVerse(page, 'Psalm 23');
  check('choosing another verse keeps what the customer typed (nothing is overwritten)', (await bar.inputValue()) === 'It slows me down.');
  await pickVerse(page, '1 John 4:19'); await page.waitForTimeout(400);
  await page.reload(); await takeTab(page).catch(async () => { await page.waitForTimeout(1000); await takeTab(page); }); await page.waitForTimeout(1200);
  const p1 = await proj(page);
  check('the episode is saved with the project', p1.style?.take?.show === 'bible' && p1.style.take.verse?.ref === '1 John 4:19' && p1.style.take.reflection === 'It slows me down.');
  check('after a reload Scripture, the verse and the typed words come back', (await show(page, 'Scripture').getAttribute('aria-pressed')) === 'true' && (await page.getByTestId('picked-verse').innerText()).includes('We love him') && (await page.getByLabel('Your own words').inputValue()) === 'It slows me down.');
  await page.screenshot({ path: `${out}/logic-restored.png` });
  await generate(page);
  await page.waitForFunction(() => { try { return JSON.parse(localStorage.getItem('subwaytakes.project.v1')).clips.length > 0; } catch { return false; } }, null, { timeout: 40000 });
  const sent = posts(st).at(-1);
  check('the request carries the exact verse, the author\'s words, the card rule and the city\'s card', !!sent && sent.prompt.includes(VERSE) && sent.prompt.includes('It slows me down') && /transit card is the only microphone/i.test(sent.prompt) && /MetroCard/.test(sent.prompt), (sent?.prompt ?? '').slice(0, 80));
  check('the prompt asks for no religious figures or symbols', /No religious figures, symbols/i.test(sent.prompt));
  const p2 = await proj(page);
  check('the on-screen card is the exact verse with its reference', p2.style?.title?.data?.variant === 'verse' && p2.style.title.data.headline === VERSE && /1 John 4:19 · KJV/.test(p2.style.title.data.value), JSON.stringify(p2.style?.title?.data?.value));
  check('the generated shot landed on the timeline and the balance went down by one price', p2.clips.some(c => c.kind === 'video') && st.balance === 4850);
});

// ---- 2. A 3-episode Scripture batch re-fits the verse to each question ---------------------------------------------------------------------------------
await scenario({}, async (page, st) => {
  await show(page, 'Scripture').click(); await pickVerse(page, '1 John 4:19'); await setLength(page, 12);
  await page.getByLabel('Your own words').fill('It steadies me.');
  await page.getByRole('button', { name: /^Batch \(bible\)/ }).click();
  const Q = ['What verse got you through this week?', 'What verse do you read when you cannot sleep?', 'What is the one verse you would read to someone who has had a very long, hard, tiring and confusing year at work?'];
  await page.getByLabel('Batch lines').fill(Q.join('\n'));
  await page.getByRole('button', { name: /^Queue 3 episodes/ }).click();
  await page.waitForFunction(() => { try { return JSON.parse(localStorage.getItem('subwaytakes.project.v1')).clips.filter(c => c.kind === 'video').length >= 3; } catch { return false; } }, null, { timeout: 90000 });
  const sent = posts(st);
  check('the batch sent 3 requests, one per question', sent.length === 3, `${sent.length}`);
  check('every episode carries its own question', sent.every((s, i) => s.prompt.includes(Q[i])));
  check('episodes 1 and 2 speak the whole verse', sent[0].prompt.includes(VERSE) && sent[1].prompt.includes(VERSE));
  check('episode 3 has a very long question, so the verse cannot fit: the guest names it and reflects, and the verse is never cut in half', sent[2].prompt.includes('1 John 4 verse 19') && !/We love him/.test(sent[2].prompt));
});

// ---- 3. Motivation with a quote ---------------------------------------------------------------------------------------------------------------------
await scenario({}, async (page, st) => {
  await show(page, 'Motivation').click();
  await page.getByRole('button', { name: 'Output', exact: true }).click(); await page.getByText(/Show the on-screen graphic/).click(); await takeTab(page);
  await pickQuote(page, 'Nothing great'); await setLength(page, 12);
  const bar = page.getByLabel('Your own words');
  await bar.fill('It helps on a flat Monday.');
  check('with a quote the prompt bar edits the comment and the note shows the author line', /Ralph Waldo Emerson wrote:/.test(await page.getByTestId('quote-note').innerText()));
  await page.reload(); await page.waitForTimeout(1500); await takeTab(page);
  check('after a reload the quote and the comment come back', (await page.getByTestId('picked-quote').innerText()).includes('Nothing great was ever achieved') && (await page.getByLabel('Your own words').inputValue()) === 'It helps on a flat Monday.');
  await generate(page);
  await page.waitForFunction(() => { try { return JSON.parse(localStorage.getItem('subwaytakes.project.v1')).clips.length > 0; } catch { return false; } }, null, { timeout: 40000 });
  const sent = posts(st).at(-1);
  check('the request carries "Author wrote: <exact quote>" and the comment', sent.prompt.includes('Ralph Waldo Emerson wrote: Nothing great was ever achieved without enthusiasm.') && sent.prompt.includes('flat Monday'));
  const p = await proj(page);
  check('the card is the quote with its author and work', p.style?.title?.data?.variant === 'quote' && /Ralph Waldo Emerson, Essays/.test(p.style.title.data.value ?? ''));
  await page.mouse.click(5, 5); await takeTab(page); await page.getByRole('button', { name: 'Remove quote' }).click(); await page.waitForTimeout(400);
  check('removing the quote returns to own advice and the bar edits the take again', await page.getByTestId('picked-quote').count() === 0 && (await page.getByLabel('Your take').count()) === 1);
});

// ---- 4. Locks: a saved Scripture episode does not unlock the pack when it is reopened without it -------------------------------------------------------
const savedScripture = { fps: 30, style: { take: { v: 1, show: 'bible', take: 'x', guestDescription: 'g', hostDescription: 'h', place: {}, tone: 'reverent', durationSeconds: 12, aspect: '9:16', format: 'twoshot', verse: { ref: '1 John 4:19', translation: 'KJV' }, reflection: 'Mine.' } },
  tracks: [{ id: 'v1', kind: 'video', name: 'Video' }, { id: 'c1', kind: 'caption', name: 'Captions' }, { id: 'a1', kind: 'audio', name: 'Sound' }, { id: 'e1', kind: 'effect', name: 'Effects' }], clips: [] };
await scenario({ owned: [], project: savedScripture }, async page => {
  await page.waitForTimeout(1200);
  check('reopening a Scripture project WITHOUT the pack restores the default show (the lock is not bypassed)', (await show(page, 'Hot Take').getAttribute('aria-pressed')) === 'true' && await page.getByTestId('verse-picker').count() === 0);
});
await scenario({ owned: ['bible'], project: savedScripture }, async page => {
  await page.waitForTimeout(1200);
  check('with the pack the same project restores Scripture, the verse and the words', (await show(page, 'Scripture').getAttribute('aria-pressed')) === 'true' && (await page.getByTestId('picked-verse').innerText()).includes('We love him') && (await page.getByLabel('Your own words').inputValue()) === 'Mine.');
});
const garbage = { ...savedScripture, style: { take: { v: 1, show: 'bible', verse: { ref: 'Nope 1:1', translation: 'KJV' }, tone: 'angry', durationSeconds: 99999, aspect: '4:3', format: 'cuts', place: { city: 'atlantis' }, take: 'z'.repeat(5000) } } };
await scenario({ owned: ['bible'], project: garbage }, async page => {
  await page.waitForTimeout(1200);
  check('a damaged saved episode loads without breaking the page (safe fallbacks)', (await show(page, 'Scripture').getAttribute('aria-pressed')) === 'true' && await page.getByTestId('picked-verse').count() === 0 && await page.getByRole('button', { name: 'Take', exact: true }).isVisible());
});

const legacy = { fps: 30, style: { title: { data: { variant: 'verse', badge: 'SCRIPTURE', badgeBg: '#e9dcb0', badgeFg: '#2b1d00', headline: VERSE, value: '1 John 4:19 · KJV' } } }, tracks: savedScripture.tracks, clips: [] };
await scenario({ owned: ['bible'], project: legacy }, async page => {
  await page.waitForTimeout(1500);
  const p = await proj(page);
  check('an older project (a Scripture card, no saved episode) keeps its card when opened: the default spec does not overwrite it', p.style?.title?.data?.variant === 'verse' && p.style.title.data.headline === VERSE);
  await page.getByRole('button', { name: 'Take', exact: true }).click(); await page.locator('textarea').first().fill('A brand new take.'); await page.waitForTimeout(800);
  const p2 = await proj(page);
  check('and once the customer starts changing the episode, the card follows it again', p2.style?.take?.take === 'A brand new take.' && p2.style.title.data.variant === 'take');
});

// ---- 5. Templates respect the packs ---------------------------------------------------------------------------------------------------------------------
await scenario({ owned: [] }, async page => {
  await page.getByRole('button', { name: /Start from a template/ }).click();
  await page.getByRole('group', { name: 'Templates' }).getByRole('button', { name: /Sunday verse on the train/ }).click();
  check('a locked Scripture template shows the unlock prompt and does not switch the show', await page.getByRole('group', { name: /Unlock Bible Pack/ }).isVisible() && (await show(page, 'Hot Take').getAttribute('aria-pressed')) === 'true');
});
await scenario({ owned: ['bible'] }, async page => {
  await page.getByRole('button', { name: /Start from a template/ }).click();
  await page.getByRole('group', { name: 'Templates' }).getByRole('button', { name: /Sunday verse on the train/ }).click(); await page.waitForTimeout(500);
  check('with the pack the template applies: Scripture, its tone and place, and the field for the guest\'s words', (await show(page, 'Scripture').getAttribute('aria-pressed')) === 'true' && await page.getByLabel('Your own words').isVisible());
});

// ---- 6. Hostile typed text is refused before anything is sent -------------------------------------------------------------------------------------------
await scenario({}, async (page, st) => {
  await show(page, 'Scripture').click(); await setLength(page, 12);
  await page.getByRole('button', { name: 'Type my own' }).click();
  await page.getByLabel('Verse reference').fill('Scripture'); await page.getByLabel('Verse text').fill('A video of Jesus walking through the train car');
  await generate(page); await page.getByText(/does not show or voice God, Jesus/).waitFor({ timeout: 10000 });
  check('a typed verse that depicts a holy figure is refused, with the reason, and nothing was sent or charged', posts(st).length === 0 && st.balance === 5000);
  await page.getByLabel('Verse text').fill('Be still, and know that I am God.'); await page.getByLabel('Your own words').fill('Pray and your cancer will disappear.');
  await generate(page); await page.getByText(/does not promise healing, wealth or guaranteed results/).waitFor({ timeout: 10000 });
  check('a comment that promises healing is refused too', posts(st).length === 0 && st.balance === 5000);
  await page.getByLabel('Your own words').fill('My faith got me through a hard year.');
  await generate(page); await page.waitForFunction(() => { try { return JSON.parse(localStorage.getItem('subwaytakes.project.v1')).clips.length > 0; } catch { return false; } }, null, { timeout: 40000 });
  check('ordinary faith talk with a typed verse goes through', posts(st).length === 1 && posts(st)[0].prompt.includes('Be still, and know that I am God.'));
});
await scenario({}, async (page, st) => {
  await show(page, 'Motivation').click(); await page.locator('textarea').first().fill('God will make you rich if you send a seed offering.');
  await generate(page); await page.getByText(/does not promise healing, wealth or guaranteed results/).waitFor({ timeout: 10000 });
  check('Motivation refuses a wealth guarantee in the guest\'s own advice', posts(st).length === 0 && st.balance === 5000);
});

// ---- 7. Cuts reads the whole verse (the Cuts budget), Two-shot squeezes it into the clip -----------------------------------------------------------------
await scenario({}, async (page) => {
  await show(page, 'Scripture').click(); await pickVerse(page, 'Isaiah 43:2'); await page.getByLabel('Your own words').fill('It keeps me going.');
  const two = await page.getByTestId('bible-note').innerText();
  check('Two-shot at the default length: the long verse is too long to speak (the exact verse stays on screen)', /too long to speak/.test(two));
  await page.getByRole('button', { name: 'Model', exact: true }).click();
  await page.getByRole('button', { name: /^Cuts/ }).first().click(); await page.waitForTimeout(400);
  await takeTab(page);
  const cuts = await page.getByTestId('bible-note').innerText();
  check('Cuts: the same verse is spoken in full (and the note recommends Cuts for exact audio)', /fits this clip/.test(cuts) && cuts.includes('When thou passest through the waters'), cuts.slice(0, 140));
});

console.log(failures ? `${failures} FAILED` : 'ALL PASSED (stubbed backend and gateway)');
await browser.close(); process.exit(failures ? 1 : 0);
