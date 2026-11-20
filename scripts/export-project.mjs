// Export an arbitrary project JSON through the real UI in headless Chromium (network to Supabase/muapi stubbed).
// Usage: node scripts/export-project.mjs <clip.mp4 | dir-of-clips (served by file name)> <project.json> <out.mp4> [baseUrl]
import { createRequire } from 'node:module';
import { readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const [clipPath, projectPath, outFile, base = 'http://localhost:5173'] = process.argv.slice(2);
const SB = 'https://stub.supabase.test';
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 86400;
const jwt = `${b64({ alg: 'HS256' })}.${b64({ sub: 'u-1', role: 'authenticated', aud: 'authenticated', exp })}.sig`;
const user = { id: 'u-1', aud: 'authenticated', role: 'authenticated', email: 'd@example.com', app_metadata: {}, user_metadata: {}, email_confirmed_at: new Date().toISOString(), created_at: new Date().toISOString() };
const session = { access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 86400, expires_at: exp, user };
const project = JSON.parse(readFileSync(projectPath, 'utf8'));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
await ctx.addInitScript(([s, pr]) => { localStorage.setItem('sb-stub-auth-token', JSON.stringify(s)); localStorage.setItem('subwaytakes.project.v1', JSON.stringify(pr)); localStorage.setItem('subwaytakes.muapi_key', 'mu_test'); }, [session, project]);
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text().slice(0, 240)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + String(e).slice(0, 300)));
const json = (r, b) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(b) });
await page.route('https://stub.media.test/**', r => { const buf = readFileSync(statSync(clipPath).isDirectory() ? join(clipPath, basename(new URL(r.request().url()).pathname)) : clipPath); const range = r.request().headers()['range']; const h = { 'access-control-allow-origin': '*', 'accept-ranges': 'bytes', 'content-type': 'video/mp4' }; if (range) { const m = /bytes=(\d+)-(\d*)/.exec(range); const a = +m[1], b = m[2] ? +m[2] : buf.length - 1; return r.fulfill({ status: 206, headers: { ...h, 'content-range': `bytes ${a}-${b}/${buf.length}`, 'content-length': String(b - a + 1) }, body: buf.subarray(a, b + 1) }); } return r.fulfill({ status: 200, headers: { ...h, 'content-length': String(buf.length) }, body: buf }); });
await page.route(`${SB}/**`, r => { const u = r.request().url(); if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } }); if (u.includes('/auth/v1/user')) return json(r, user); if (u.includes('/auth/v1/')) return json(r, { ...session, user }); if (u.includes('user_profiles')) return json(r, { id: 'u-1', credits_balance: 5000, subscription_tier: 'free' }); if (u.includes('muapi-gateway')) return json(r, { balance: 5 }); return json(r, []); });
await page.goto(`${base}/create`);
await page.getByRole('button', { name: 'Export', exact: true }).waitFor(); await page.waitForTimeout(1500);
await page.getByRole('button', { name: 'Export', exact: true }).click();
await page.getByRole('button', { name: 'Start export' }).click();
const r = await Promise.race([page.getByText('Export ready').waitFor({ timeout: 300000 }).then(() => 'done'), page.getByText('Try again').waitFor({ timeout: 300000 }).then(() => 'error')]);
if (r === 'error') { console.log('EXPORT_ERROR', await page.locator('[role=dialog] .text-red-300').allInnerTexts()); console.log(logs.join('\n')); await browser.close(); process.exit(2); }
// SHARE_DIR=<dir>: also use the Share buttons of the finished export and save what they download (poster and GIF)
if (process.env.SHARE_DIR) {
  const { mkdirSync } = await import('node:fs'); mkdirSync(process.env.SHARE_DIR, { recursive: true });
  await page.getByTestId('share-caption').fill('So what is ur take?');
  for (const id of ['share-poster', 'share-gif']) {
    const [d] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), page.getByTestId(id).click()]);
    await d.saveAs(join(process.env.SHARE_DIR, d.suggestedFilename()));
    console.log('SHARED', d.suggestedFilename(), '|', await page.getByTestId('share-note').innerText());
  }
}
const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: /Download/ }).click()]);
await dl.saveAs(outFile);
console.log('EXPORT_OK', outFile); if (process.env.SHOW_LOGS) console.log(logs.join('\n'));
await browser.close();
