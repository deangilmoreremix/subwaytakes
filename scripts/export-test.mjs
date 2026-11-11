// Real end-to-end export in headless Chromium against a local clip (network stubbed). Usage: node scripts/export-test.mjs <clip.mp4> <outDir> [container] [baseUrl]
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [clipPath, out, container = 'mp4', base = 'http://localhost:5173'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const SB = 'https://stub.supabase.test';
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 86400;
const jwt = `${b64({ alg: 'HS256' })}.${b64({ sub: 'u-1', role: 'authenticated', aud: 'authenticated', exp })}.sig`;
const user = { id: 'u-1', aud: 'authenticated', role: 'authenticated', email: 'd@example.com', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
const session = { access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 86400, expires_at: exp, user };
const src = 'https://stub.media.test/clip.mp4';
const v = (id, start, duration, trimStart) => ({ id, trackId: 'v1', kind: 'video', label: id, start, duration, trimStart, sourceFrames: 90, src, volume: 1 });
const project = { fps: 30, tracks: [{ id: 'v1', kind: 'video', name: 'Video' }, { id: 'c1', kind: 'caption', name: 'Captions' }], clips: [v('a', 0, 60, 0), v('b', 60, 30, 60), { id: 'k', trackId: 'c1', kind: 'caption', label: 'Caption', start: 10, duration: 50, trimStart: 0, text: 'Pineapple belongs on pizza' }] };

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
await ctx.addInitScript(([s, pr]) => { localStorage.setItem('sb-stub-auth-token', JSON.stringify(s)); localStorage.setItem('subwaytakes.project.v1', JSON.stringify(pr)); }, [session, project]);
const page = await ctx.newPage();
page.on('console', m => { if (['error', 'warning'].includes(m.type())) console.log('[console.' + m.type() + ']', m.text().slice(0, 300)); });
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 300)));
const json = (r, b) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(b) });
await page.route('https://stub.media.test/**', r => {
  const buf = readFileSync(clipPath); const range = r.request().headers()['range'];
  const h = { ...(process.env.NOCORS ? {} : { 'access-control-allow-origin': '*' }), 'accept-ranges': 'bytes', 'content-type': 'video/mp4' };
  if (range) { const m = /bytes=(\d+)-(\d*)/.exec(range); const a = +m[1], b = m[2] ? +m[2] : buf.length - 1; return r.fulfill({ status: 206, headers: { ...h, 'content-range': `bytes ${a}-${b}/${buf.length}`, 'content-length': String(b - a + 1) }, body: buf.subarray(a, b + 1) }); }
  return r.fulfill({ status: 200, headers: { ...h, 'content-length': String(buf.length) }, body: buf });
});
await page.route(`${SB}/**`, r => { const u = r.request().url(); if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } }); if (u.includes('/auth/v1/user')) return json(r, user); if (u.includes('/auth/v1/')) return json(r, { ...session, user }); if (u.includes('user_profiles')) return json(r, { id: 'u-1', credits_balance: 1, subscription_tier: 'free' }); return json(r, []); });

await page.goto(`${base}/create`);
await page.getByRole('button', { name: 'Export', exact: true }).waitFor();
await page.waitForTimeout(1500);
await page.getByRole('button', { name: 'Export', exact: true }).click();
await page.getByRole('dialog').waitFor();
await page.screenshot({ path: `${out}/50-export-dialog-idle.png` });
if (container === 'webm') await page.getByRole('button', { name: /WebM/ }).click();
await page.getByRole('button', { name: 'Start export' }).click();
let shotRendering = false;
const t0 = Date.now();
const result = await Promise.race([
  page.getByText('Export ready').waitFor({ timeout: 240000 }).then(() => 'done'),
  page.getByText(/Try again/).waitFor({ timeout: 240000 }).then(() => 'error'),
  (async () => { while (Date.now() - t0 < 240000) { await page.waitForTimeout(700); if (!shotRendering && await page.getByText('Rendering').count()) { await page.screenshot({ path: `${out}/51-export-dialog-rendering.png` }); shotRendering = true; } } return 'timeout'; })(),
]);
console.log('RESULT', result, ((Date.now() - t0) / 1000).toFixed(1) + 's');
if (result === 'error') { console.log('ERROR TEXT:', await page.locator('[role=dialog] .text-red-300').allInnerTexts()); await page.screenshot({ path: `${out}/52-export-dialog-error.png` }); }
if (result === 'done') {
  await page.screenshot({ path: `${out}/52-export-dialog-done.png` });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: /Download/ }).click()]);
  await dl.saveAs(`${out}/episode.${container}`); console.log('SAVED', `${out}/episode.${container}`);
}
await browser.close();
