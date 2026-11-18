// REAL export of a Scripture episode: picks the show and the verse through the UI (so the card is computed by the app), exports in headless Chromium,
// saves the MP4. Usage: node scripts/export-verse-test.mjs <clip.mp4> <out.mp4> <verse reference> <KJV|WEB> [show: Scripture|Motivation] [baseUrl]
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [clipPath, outFile, ref = 'Psalm 4:8', tr = 'KJV', showLabel = 'Scripture', base = 'http://localhost:5173'] = process.argv.slice(2);
const SB = 'https://stub.supabase.test';
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 86400;
const jwt = `${b64({ alg: 'HS256' })}.${b64({ sub: 'u-1', role: 'authenticated', aud: 'authenticated', exp })}.sig`;
const user = { id: 'u-1', aud: 'authenticated', role: 'authenticated', email: 'd@example.com', app_metadata: {}, user_metadata: {}, email_confirmed_at: new Date().toISOString(), created_at: new Date().toISOString() };
const session = { access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 86400, expires_at: exp, user };
const src = 'https://stub.media.test/clip.mp4';
const project = { fps: 30, tracks: [{ id: 'v1', kind: 'video', name: 'Video' }, { id: 'c1', kind: 'caption', name: 'Captions' }, { id: 'a1', kind: 'audio', name: 'Sound' }, { id: 'e1', kind: 'effect', name: 'Effects' }],
  clips: [{ id: 'a', trackId: 'v1', kind: 'video', label: 'shot', start: 0, duration: 90, trimStart: 90, sourceFrames: 238, src, volume: 1 }] };
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
await ctx.addInitScript(([s, pr]) => { localStorage.setItem('sb-stub-auth-token', JSON.stringify(s)); localStorage.setItem('subwaytakes.project.v1', JSON.stringify(pr)); }, [session, project]);
const page = await ctx.newPage();
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 300)));
const json = (r, b) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(b) });
await page.route('https://stub.media.test/**', r => {
  const buf = readFileSync(clipPath); const range = r.request().headers()['range']; const h = { 'access-control-allow-origin': '*', 'accept-ranges': 'bytes', 'content-type': 'video/mp4' };
  if (range) { const m = /bytes=(\d+)-(\d*)/.exec(range); const a = +m[1], b = m[2] ? +m[2] : buf.length - 1; return r.fulfill({ status: 206, headers: { ...h, 'content-range': `bytes ${a}-${b}/${buf.length}`, 'content-length': String(b - a + 1) }, body: buf.subarray(a, b + 1) }); }
  return r.fulfill({ status: 200, headers: { ...h, 'content-length': String(buf.length) }, body: buf });
});
await page.route(`${SB}/**`, r => {
  const u = r.request().url();
  if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
  if (u.includes('/auth/v1/user')) return json(r, user);
  if (u.includes('/auth/v1/')) return json(r, { ...session, user });
  if (u.includes('/rest/v1/entitlements')) return json(r, [{ key: 'bible' }, { key: 'motivation' }]);
  if (u.includes('user_profiles')) return json(r, { id: 'u-1', credits_balance: 5000, subscription_tier: 'free' });
  return json(r, []);
});
await page.goto(`${base}/create`);
await page.getByRole('button', { name: 'Take', exact: true }).click();
await page.getByRole('group', { name: 'Show' }).getByRole('button', { name: showLabel, exact: true }).click();
if (showLabel === 'Scripture') {
  const picker = page.getByTestId('verse-picker');
  await picker.getByRole('button', { name: tr, exact: true }).click();
  await page.getByLabel('Search verses').fill(ref);
  await picker.locator(`[data-verse="${ref}"]`).first().click();
} else {
  await page.locator('textarea').first().fill(process.env.ANSWER || 'Do the next small thing. Nobody quits from one hard hour, they quit from a hundred skipped ones.');
}
await page.getByRole('button', { name: 'Output', exact: true }).click();
await page.getByText(/Show the on-screen graphic/).click();
await page.getByRole('button', { name: 'Export', exact: true }).waitFor(); await page.waitForTimeout(1500);
await page.getByRole('button', { name: 'Export', exact: true }).click();
await page.getByRole('dialog').waitFor();
await page.getByRole('button', { name: 'Start export' }).click();
const t0 = Date.now();
const result = await Promise.race([page.getByText('Export ready').waitFor({ timeout: 240000 }).then(() => 'done'), page.getByText(/Try again/).waitFor({ timeout: 240000 }).then(() => 'error')]);
console.log('RESULT', result, ((Date.now() - t0) / 1000).toFixed(1) + 's');
if (result === 'done') { const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: /Download/ }).click()]); await dl.saveAs(outFile); console.log('SAVED', outFile); }
else console.log('ERROR TEXT:', await page.locator('[role=dialog] .text-red-300').allInnerTexts());
await browser.close();
