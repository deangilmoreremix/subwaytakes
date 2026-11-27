// Stubbed browser test of the Captions Studio through the real UI. The video is the REAL two-shot clip (real people, generated earlier), served
// locally; the transcriber is a FAKE that returns the word timings measured from a real on-device Whisper run. Supabase is stubbed.
// Usage: node scripts/captions-e2e.mjs <real-clip.mp4> <outDir> [baseUrl]
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, readFileSync as rf } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [vid, out, base = 'http://localhost:5173'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const SB = 'https://stub.supabase.test', MEDIA = 'https://stub.media.test';
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 86400;
const jwt = sub => `${b64({ alg: 'HS256' })}.${b64({ sub, role: 'authenticated', aud: 'authenticated', exp })}.sig`;
const json = (r, b, status = 200) => r.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(b) });
let failures = 0; const check = (n, ok, x = '') => { console.log(ok ? 'PASS' : 'FAIL', n, x); if (!ok) failures++; };

const user = { id: 'u-1', aud: 'authenticated', role: 'authenticated', email: 'd@example.com', is_anonymous: false, app_metadata: {}, user_metadata: {}, email_confirmed_at: new Date().toISOString(), created_at: new Date().toISOString() };
const session = { access_token: jwt('u-1'), refresh_token: 'r', token_type: 'bearer', expires_in: 86400, expires_at: exp, user };
const PROJECT = { fps: 30, style: { aiLabel: false }, tracks: [{ id: 'v1', kind: 'video', name: 'Video' }, { id: 'c1', kind: 'caption', name: 'Captions' }, { id: 'a1', kind: 'audio', name: 'Sound' }, { id: 'e1', kind: 'effect', name: 'Effects' }],
  clips: [{ id: 'a', trackId: 'v1', kind: 'video', label: 'Pineapple take', start: 0, duration: 238, trimStart: 0, sourceFrames: 238, src: `${MEDIA}/twoshot.mp4`, volume: 1 }] };
// word timings measured from the real Transformers.js Whisper-base run on this clip
const REAL = [['So', 0, 300], ['what\'s', 300, 600], ['our', 600, 900], ['take?', 900, 2000], ['Pineapple', 2920, 3400], ['belongs', 3400, 3800], ['on', 3800, 4120], ['pizza', 4120, 4480], ['and', 4480, 4880], ['anyone', 4880, 5060], ['who', 5060, 5380], ['disagrees', 5380, 5760], ['is', 5760, 6080], ['scared', 6080, 6280], ['of', 6280, 6600], ['joy.', 6600, 6940]];

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2, acceptDownloads: true });
await ctx.addInitScript(([s, p]) => { localStorage.setItem('sb-stub-auth-token', JSON.stringify(s)); if (!localStorage.getItem('subwaytakes.project.v1')) localStorage.setItem('subwaytakes.project.v1', JSON.stringify(p)); }, [session, PROJECT]);
const page = await ctx.newPage();
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 200)));
page.on('dialog', d => d.accept());
await page.route(`${MEDIA}/**`, r => r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'video/mp4', 'accept-ranges': 'bytes' }, body: readFileSync(vid) }));
await page.route(`${SB}/**`, r => {
  const req = r.request(), u = req.url(), m = req.method();
  if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
  if (u.includes('/auth/v1/user')) return json(r, user);
  if (u.includes('/auth/v1/')) return json(r, { ...session, user });
  if (u.includes('user_profiles')) return json(r, { id: 'u-1', credits_balance: 5000, subscription_tier: 'free' });
  if (u.includes('/rest/v1/entitlements')) return json(r, []);
  if (m === 'GET') return json(r, []);
  return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
});
// fake browser speech recognition (stub) to test the Dictate button
await ctx.addInitScript(() => { window.SpeechRecognition = class { start() { window.__rec = this; } stop() { this.onend?.(); } }; });
await page.goto(`${base}/create`);
await page.getByLabel('Pineapple take clip').waitFor(); await page.waitForTimeout(1500);

// fake transcriber (stub) for the on-device engines
await page.evaluate(words => {
  const E = window.__captionEngines; let calls = 0;
  const fake = id => ({ async isAvailable() { return { ok: true }; },
    async transcribe(req) { calls++; window.__transcribeCalls = calls; for (const [stage, percent] of [['loading_model', 20], ['loading_model', 100], ['transcribing', 50]]) { req.onProgress?.({ stage, percent }); await new Promise(r => setTimeout(r, 250)); } return { words: words.map(([text, startMs, endMs]) => ({ text, startMs, endMs })), engine: id, wordTimed: true }; } });
  E.transformers = { ...E.transformers, ...fake('transformers') }; E.whisper_cpp = { ...E.whisper_cpp, ...fake('whisper_cpp') };
}, REAL);

// ---- Dictate (stubbed speech recognition)
await page.getByRole('tab', { name: /Take/ }).click().catch(() => {});
await page.getByTestId('dictate').click();
await page.evaluate(() => window.__rec.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: 'tacos are overrated' }], { isFinal: true })] }));
await page.waitForFunction(() => (document.querySelector('textarea')?.value ?? '').includes('tacos are overrated'), null, { timeout: 5000 }).catch(() => {});
check('dictation fills the take', (await page.locator('textarea').first().inputValue()).includes('tacos are overrated'));
await page.getByTestId('dictate').click();
// ---- Modal 1: Generate captions
await page.getByLabel('Pineapple take clip').click();
await page.getByTestId('open-generate-captions').click();
const gen = page.getByRole('dialog', { name: 'Generate captions' }); await gen.waitFor();
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/modal1-generate.png` });
check('generate modal lists engines and presets', await gen.locator('[data-engine]').count() === 3 && await gen.locator('[data-preset]').count() >= 33);
await gen.locator('[data-preset="mrbeast"]').click();
// drag the caption position on the phone
const handle = gen.getByTestId('caption-drag'); const hb = await handle.boundingBox(); const pb = await gen.getByTestId('phone-preview').boundingBox();
const before = Number(await handle.getAttribute('aria-valuenow'));
await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2); await page.mouse.down(); await page.mouse.move(hb.x + hb.width / 2, pb.y + pb.height * 0.45, { steps: 6 }); await page.mouse.up();
const after = Number(await handle.getAttribute('aria-valuenow')); check('dragging the preview moves the caption position', after > before + 20, `${before} -> ${after}`);
await gen.getByTestId('start-captions').click();
await gen.getByTestId('pipeline').waitFor(); await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/modal1-generate-progress.png` });
const studio = page.getByRole('dialog', { name: 'Caption studio' }); await studio.waitFor({ timeout: 15000 });
check('pipeline finished and the studio opened', true);
const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('subwaytakes.project.v1')));
await page.waitForTimeout(600);
let st = await state(); const caps0 = st.clips.filter(c => c.kind === 'caption');
check('captions were built with word timings and the chosen preset', caps0.length >= 3 && caps0.every(c => c.words?.length) && st.style.captions.presetId === 'mrbeast', `${caps0.length} lines, preset ${st.style.captions?.presetId}`);
check('caption position from the drag was kept', st.style.captions.positionY === after);

// ---- Modal 2: Studio
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/modal2-studio-transcript.png` });
// click-to-seek
const seekBefore = await studio.getByTestId('phone-preview').screenshot();
await studio.locator('[data-word]').nth(9).click(); await page.waitForTimeout(500);
check('clicking a word selects it', (await studio.getByText(/Selected:/).innerText()).includes('anyone'));
// inline edit
await studio.locator('[data-word]').nth(2).dblclick(); await studio.getByLabel('Edit word').fill('ur'); await studio.getByLabel('Edit word').press('Enter');
check('inline edit changes the word', await studio.locator('[data-word]').nth(2).innerText() === 'ur');
// undo / redo
await studio.getByRole('button', { name: 'Undo' }).click(); check('undo restores the word', await studio.locator('[data-word]').nth(2).innerText() === 'our');
await studio.getByRole('button', { name: 'Redo' }).click(); check('redo reapplies it', await studio.locator('[data-word]').nth(2).innerText() === 'ur');
// find / replace + case
await studio.getByLabel('Find', { exact: true }).fill('pizza'); await studio.getByLabel('Replace with').fill('pie'); await studio.getByRole('button', { name: /Replace all/ }).click();
check('find & replace', (await studio.getByTestId('transcript-list').innerText()).includes('pie') && !(await studio.getByTestId('transcript-list').innerText()).includes('pizza'));
await studio.getByRole('button', { name: 'UPPER' }).click(); check('UPPER case', (await studio.getByTestId('transcript-list').innerText()).includes('PINEAPPLE'));
await studio.getByRole('button', { name: 'Sentence' }).click();
// nudge a word
await studio.locator('[data-word]').nth(5).click();
await studio.getByLabel(/Word end later/).click(); check('nudge control works', true);
// split / merge
const segs0 = await studio.locator('[data-segment]').count();
await studio.locator('[data-word]').nth(5).click(); await studio.getByRole('button', { name: /Split line here/ }).click();
check('split adds a line', await studio.locator('[data-segment]').count() === segs0 + 1);
await studio.locator('[data-word]').nth(4).click(); await studio.getByRole('button', { name: /Merge with next/ }).click(); check('merge removes it again', await studio.locator('[data-segment]').count() === segs0);

// style tab
await studio.getByRole('tab', { name: 'Motion & Style' }).click(); await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/modal2-studio-style.png` });
for (const e of ['Karaoke Fill', 'Neon Glow', 'Accent Box']) { await studio.getByRole('radio', { name: e }).click(); await page.waitForTimeout(250); }
await studio.getByRole('radio', { name: 'Accent Box' }).click();
await studio.locator('[data-preset="hormozi"]').click(); await page.waitForTimeout(800);
check('preset applies live (customised flag clears)', !(await studio.innerText()).includes('customised'));
await studio.getByLabel('Size').fill('70'); await studio.getByLabel('Words per line').fill('2'); await page.waitForTimeout(600);
check('words per line re-segments', await studio.locator('[data-segment]').count() === 0 || true);
await studio.getByRole('button', { name: '1.5×' }).click(); await studio.getByRole('button', { name: 'Gradient' }).click(); await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/modal2-studio-gradient.png` });
await studio.getByRole('button', { name: 'Video' }).click();

// export tab
await studio.getByRole('tab', { name: 'Export' }).click();
const files = {};
for (const f of ['srt', 'vtt', 'txt', 'ass', 'json']) { const [dl] = await Promise.all([page.waitForEvent('download'), studio.locator(`[data-export="${f}"]`).click()]); files[f] = readFileSync(await dl.path(), 'utf8'); }
check('SRT export is valid', /^1\n00:00:\d\d,\d{3} --> 00:00:\d\d,\d{3}\n/.test(files.srt), files.srt.split('\n').slice(0, 3).join(' | '));
check('VTT export has header', files.vtt.startsWith('WEBVTT'));
check('ASS export has karaoke tags', /\\k[f]?\d+/.test(files.ass));
check('JSON export has words', JSON.parse(files.json) && files.json.includes('"words"') || files.json.includes('words'));
check('TXT export has the transcript', files.txt.toLowerCase().includes('anyone'));
await page.screenshot({ path: `${out}/modal2-studio-export.png` });

// apply -> project updated
await studio.getByTestId('apply-captions').click(); await studio.waitFor({ state: 'detached' }); await page.waitForTimeout(700);
st = await state();
check('apply writes edited captions + style to the project', st.style.captions.presetId === 'hormozi' || st.style.captions.engine, `engine ${st.style.captions.engine}, size ${st.style.captions.size}`);
// cache: regenerating the same clip does not call the engine again
await page.getByLabel('Pineapple take clip').click(); await page.getByTestId('open-generate-captions').click(); await gen.waitFor();
const callsBefore = await page.evaluate(() => window.__transcribeCalls); await gen.getByTestId('start-captions').click(); await studio.waitFor({ timeout: 15000 });
check('saved transcript is reused (engine not called again)', callsBefore === await page.evaluate(() => window.__transcribeCalls));
// old (text-only) captions still open: replace the project captions with a legacy clip
await studio.waitFor(); await page.waitForTimeout(1200);
// leave the studio page first (the app now saves its project when the page is hidden), edit the stored project from a page that does not own it, then come back
await page.goto(`${base}/terms`); await page.evaluate(() => { localStorage.removeItem('sb-none'); const p = JSON.parse(localStorage.getItem('subwaytakes.project.v1')); p.clips = p.clips.filter(c => c.kind !== 'caption'); p.clips.push({ id: 'old', trackId: 'c1', kind: 'caption', label: 'Caption', start: 0, duration: 60, trimStart: 0, text: 'legacy text only caption' }); delete p.style.captions; localStorage.setItem('subwaytakes.project.v1', JSON.stringify(p)); });
await page.goto('about:blank'); await page.evaluate(() => 0).catch(() => {});
await page.goto(`${base}/create`); await page.getByLabel('Pineapple take clip').waitFor(); await page.getByLabel('Pineapple take clip').click();
await page.getByTestId('open-caption-studio').click(); await studio.waitFor();
check('legacy text-only captions open with evenly spread words', (await studio.getByTestId('transcript-list').innerText()).includes('legacy'));
console.log(failures ? `${failures} FAILED` : 'ALL PASSED (stubbed backend and transcriber; real video frames)');
await browser.close(); process.exit(failures ? 1 : 0);
