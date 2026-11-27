// Browser test for saving an episode to a file and opening it again (network stubbed). Uses a REAL downloaded file and real file input.
// Run the dev server in the default mode. Usage: node scripts/projectfile-e2e.mjs <outDir> [baseUrl]
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const [out, base = 'http://localhost:5173'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const SB = 'https://stub.supabase.test';
const GOOD = 'mk_live_FILETESTKEY0123456789abcd';
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 86400;
const jwt = `${b64({ alg: 'HS256' })}.${b64({ sub: 'u-1', role: 'authenticated', aud: 'authenticated', exp })}.sig`;
const json = (r, b, status = 200) => r.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(b) });
let failures = 0;
const check = (name, ok, extra = '') => { console.log(ok ? 'PASS' : 'FAIL', name, extra); if (!ok) failures++; };
const user = { id: 'u-1', aud: 'authenticated', role: 'authenticated', email: 'd@example.com', is_anonymous: false, app_metadata: {}, user_metadata: {}, email_confirmed_at: new Date().toISOString(), created_at: new Date().toISOString() };
const session = { access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 86400, expires_at: exp, user };
const SRC = 'https://stub.media.test/clip.mp4';
const project = { fps: 30, tracks: [{ id: 'v1', kind: 'video', name: 'Video' }, { id: 'c1', kind: 'caption', name: 'Captions' }, { id: 'a1', kind: 'audio', name: 'Sound' }, { id: 'e1', kind: 'effect', name: 'Effects' }],
  clips: [{ id: 'a', trackId: 'v1', kind: 'video', label: 'My saved shot', start: 0, duration: 90, trimStart: 0, sourceFrames: 238, src: SRC, volume: 1 }] };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
await ctx.addInitScript(([s, k, pr]) => { localStorage.setItem('sb-stub-auth-token', JSON.stringify(s)); localStorage.setItem('subwaytakes.muapi.key', k); if (pr) localStorage.setItem('subwaytakes.project.v1', JSON.stringify(pr)); }, [session, GOOD, project]);
// headless Chromium has a native save dialog nobody can answer: remove it so the download fallback (used by Firefox and Safari) is what runs
await ctx.addInitScript(() => { delete window.showSaveFilePicker; delete window.showOpenFilePicker; });
const page = await ctx.newPage();
page.on('pageerror', e => { if (!/MediaPlaybackError/.test(String(e))) console.log('[pageerror]', String(e).slice(0, 200)); });
page.on('dialog', d => d.accept());
await page.route('https://stub.media.test/**', r => r.fulfill({ status: 200, contentType: 'video/mp4', headers: { 'access-control-allow-origin': '*' }, body: Buffer.alloc(10) }));
await page.route(`${SB}/**`, async r => {
  const req = r.request(); const u = req.url();
  if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
  if (u.includes('/auth/v1/user')) return json(r, user);
  if (u.includes('/auth/v1/')) return json(r, { ...session, user });
  if (u.includes('subwaytakes-byok')) return json(r, { balance: 5 });
  if (u.includes('user_profiles')) return json(r, { id: 'u-1', credits_balance: 0, subscription_tier: 'free' });
  return json(r, []);
});

await page.goto(`${base}/create`);
await page.getByRole('button', { name: 'Output', exact: true }).click();
await page.getByTestId('project-file').waitFor({ timeout: 20000 });
check('the Output tab has a project file card', true);
await page.screenshot({ path: `${out}/01-card.png` });

// ---- save: a real downloaded file
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.getByTestId('project-save-file').click()]);
const file = join(out, dl.suggestedFilename());
await dl.saveAs(file);
const text = readFileSync(file, 'utf8');
const parsed = JSON.parse(text);
check('a file is downloaded with a safe name', /\.subwaytakes\.json$/.test(dl.suggestedFilename()), dl.suggestedFilename());
check('it holds the timeline and its clip link', parsed.app === 'subwaytakes' && parsed.project.clips[0].src === SRC && parsed.project.clips[0].label === 'My saved shot');
check('it never contains the muapi key or the session token', !text.includes(GOOD) && !text.includes(jwt));
check('the card says it was saved', /Saved/.test(await page.getByTestId('project-file-msg').innerText()));

// ---- change the project, then open the file back
await page.evaluate(() => localStorage.removeItem('subwaytakes.project.v1'));
await page.goto(`${base}/create`);
await page.getByRole('button', { name: 'Output', exact: true }).click();
await page.getByTestId('project-file').waitFor();
await page.getByTestId('project-file-input').setInputFiles(file);
await page.getByTestId('project-file-msg').waitFor();
check('opening the file says so', /Opened/.test(await page.getByTestId('project-file-msg').innerText()), await page.getByTestId('project-file-msg').innerText());
await page.waitForTimeout(700);
const stored = JSON.parse(await page.evaluate(() => localStorage.getItem('subwaytakes.project.v1') ?? '{}'));
check('the opened episode is now the working draft (saved locally)', stored.clips?.[0]?.label === 'My saved shot', JSON.stringify(stored.clips?.map(c => c.label)));
await page.screenshot({ path: `${out}/02-opened.png` });

// ---- bad files are refused with a reason and change nothing
const bads = {
  'not-json.json': 'hello',
  'other-app.json': JSON.stringify({ app: 'other', fileVersion: 1, project }),
  'future.json': JSON.stringify({ app: 'subwaytakes', fileVersion: 99, project }),
  'evil-media.json': JSON.stringify({ app: 'subwaytakes', fileVersion: 1, name: 'x', project: { ...project, clips: [{ ...project.clips[0], src: 'javascript:alert(1)' }] } }),
};
for (const [name, body] of Object.entries(bads)) {
  const f = join(out, name); writeFileSync(f, body);
  await page.getByTestId('project-file-input').setInputFiles(f);
  await page.waitForFunction(() => document.querySelector('[data-testid=project-file-msg]')?.getAttribute('role') === 'alert', null, { timeout: 5000 });
  check(`a bad file is refused with a reason: ${name}`, (await page.getByTestId('project-file-msg').innerText()).length > 10, await page.getByTestId('project-file-msg').innerText());
}
await page.waitForTimeout(500);
const after = JSON.parse(await page.evaluate(() => localStorage.getItem('subwaytakes.project.v1') ?? '{}'));
check('bad files changed nothing', after.clips?.length === 1 && after.clips[0].src === SRC);
await page.screenshot({ path: `${out}/03-refused.png` });

await browser.close();
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED (real file download and upload, stubbed network)');
process.exit(failures ? 1 : 0);
