// E2E: Generate captions for a clip (muapi Whisper stubbed -> SRT), verify timeline state, then export and inspect.
// Usage: node scripts/captions-test.mjs <clip.mp4> <outDir> [baseUrl]
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [clipPath, out, base = 'http://localhost:5173'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const SB = 'https://stub.supabase.test';
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 86400;
const jwt = `${b64({ alg: 'HS256' })}.${b64({ sub: 'u-1', role: 'authenticated', aud: 'authenticated', exp })}.sig`;
const user = { id: 'u-1', aud: 'authenticated', role: 'authenticated', email: 'd@example.com', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
const session = { access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 86400, expires_at: exp, user };
const src = 'https://stub.media.test/clip.mp4';
// clip placed at timeline 30 (1s in), trimmed 15 frames off the front of a 90-frame source -> visible source frames 15..75
const project = { fps: 30, tracks: [{ id: 'v1', kind: 'video', name: 'Video' }, { id: 'c1', kind: 'caption', name: 'Captions' }], clips: [{ id: 'a', trackId: 'v1', kind: 'video', label: 'Pineapple take', start: 30, duration: 60, trimStart: 15, sourceFrames: 90, src, volume: 1 }] };
const SRT = '1\n00:00:00,100 --> 00:00:00,900\nBefore the trim\n\n2\n00:00:01,000 --> 00:00:01,800\nPineapple belongs on pizza\n\n3\n00:00:02,000 --> 00:00:02,400\nand anyone who disagrees\n\n4\n00:00:02,700 --> 00:00:03,000\nOutside the visible part\n';
const mode = process.env.WHISPER_MODE || 'ok'; // ok | empty | fail

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
await ctx.addInitScript(([s, pr]) => { localStorage.setItem('sb-stub-auth-token', JSON.stringify(s)); localStorage.setItem('subwaytakes.project.v1', JSON.stringify(pr)); localStorage.setItem('subwaytakes.muapi_key', 'mu_test'); }, [session, project]);
const page = await ctx.newPage();
const json = (r, b, st = 200) => r.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(b) });
let whisperBody = null;
await page.route('https://stub.media.test/**', r => { const buf = readFileSync(clipPath); const range = r.request().headers()['range']; const h = { 'access-control-allow-origin': '*', 'accept-ranges': 'bytes', 'content-type': 'video/mp4' }; if (range) { const m = /bytes=(\d+)-(\d*)/.exec(range); const a = +m[1], b = m[2] ? +m[2] : buf.length - 1; return r.fulfill({ status: 206, headers: { ...h, 'content-range': `bytes ${a}-${b}/${buf.length}`, 'content-length': String(b - a + 1) }, body: buf.subarray(a, b + 1) }); } return r.fulfill({ status: 200, headers: { ...h, 'content-length': String(buf.length) }, body: buf }); });
await page.route(`${SB}/**`, r => {
  const u = r.request().url();
  if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
  if (u.includes('/auth/v1/user')) return json(r, user);
  if (u.includes('/auth/v1/')) return json(r, { ...session, user });
  if (u.includes('/functions/v1/muapi-proxy')) {
    const b = JSON.parse(r.request().postData() || '{}');
    if (b.path?.includes('openai-whisper')) { whisperBody = b.body; return mode === 'fail' ? json(r, { error: 'Insufficient credits' }, 402) : json(r, { request_id: 'w1' }); }
    if (b.path?.includes('predictions')) return json(r, { status: 'completed', text: mode === 'empty' ? '' : SRT });
    return json(r, { balance: 5 });
  }
  if (u.includes('user_profiles')) return json(r, { id: 'u-1', credits_balance: 1, subscription_tier: 'free' });
  return json(r, []);
});
const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('subwaytakes.project.v1')).clips.filter(c => c.kind === 'caption').map(c => [c.start, c.duration, c.text]));

await page.goto(`${base}/create`);
await page.getByLabel('Pineapple take clip').waitFor(); await page.waitForTimeout(1200);
await page.getByLabel('Pineapple take clip').click();
await page.getByRole('button', { name: /Generate captions/ }).click();
if (mode !== 'ok') {
  await page.waitForTimeout(3500);
  console.log('MODE', mode, 'ERROR UI:', await page.locator('.text-red-300').allInnerTexts(), 'captions:', JSON.stringify(await state()));
  await page.screenshot({ path: `${out}/60-captions-${mode}.png` }); await browser.close(); process.exit(0);
}
await page.getByRole('button', { name: /Regenerate/ }).waitFor({ timeout: 15000 });
console.log('WHISPER REQUEST', JSON.stringify(whisperBody));
await page.waitForTimeout(600); console.log('CAPTIONS', JSON.stringify(await state()));
await page.mouse.click(1, 1);
await page.getByLabel('Pineapple take clip').click();
await page.screenshot({ path: `${out}/61-captions-generated.png` });
// regenerate must not duplicate
await page.getByRole('button', { name: /Regenerate/ }).click(); await page.getByRole('button', { name: /Regenerate/ }).waitFor();
await page.waitForTimeout(500);
console.log('AFTER REGENERATE', JSON.stringify(await state()));
// export
await page.getByRole('button', { name: 'Export', exact: true }).click();
await page.getByRole('button', { name: 'Start export' }).click();
await page.getByText('Export ready').waitFor({ timeout: 240000 });
const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: /Download/ }).click()]);
await dl.saveAs(`${out}/episode.mp4`); console.log('SAVED');
await browser.close();
