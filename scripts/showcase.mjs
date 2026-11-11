// Populated timeline (video+transition, captions, sound, light leak) + UI add-effect check. Usage: node scripts/showcase.mjs <media-dir> <outDir> [baseUrl]
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const [dir, out, base = 'http://localhost:5173'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const SB = 'https://stub.supabase.test';
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 86400;
const jwt = `${b64({ alg: 'HS256' })}.${b64({ sub: 'u-1', role: 'authenticated', aud: 'authenticated', exp })}.sig`;
const user = { id: 'u-1', aud: 'authenticated', role: 'authenticated', email: 'd@example.com', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
const session = { access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 86400, expires_at: exp, user };
const v = (id, label, start, dur, src, extra = {}) => ({ id, trackId: 'v1', kind: 'video', label, start, duration: dur, trimStart: 0, sourceFrames: 90, src: 'https://stub.media.test/' + src, volume: 1, ...extra });
const project = { fps: 30, style: { captionFont: 'anton' }, tracks: [{ id: 'v1', kind: 'video', name: 'Video' }, { id: 'c1', kind: 'caption', name: 'Captions' }, { id: 'a1', kind: 'audio', name: 'Sound' }, { id: 'e1', kind: 'effect', name: 'Effects' }],
  clips: [v('a', 'Pineapple take', 0, 75, 'red.mp4'), v('b', 'Cereal take', 60, 75, 'blue.mp4', { transitionIn: { type: 'wipe', frames: 15 } }),
    { id: 'k1', trackId: 'c1', kind: 'caption', label: 'Caption', start: 8, duration: 45, trimStart: 0, text: 'Pineapple belongs on pizza' }, { id: 'k2', trackId: 'c1', kind: 'caption', label: 'Caption', start: 75, duration: 50, trimStart: 0, text: 'Cereal is a soup' },
    { id: 's1', trackId: 'a1', kind: 'audio', label: 'Whoosh', start: 52, duration: 12, trimStart: 0, sourceFrames: 12, src: 'https://remotion.media/whoosh.wav', volume: 1 },
    { id: 'f1', trackId: 'e1', kind: 'effect', label: 'Light leak', start: 50, duration: 40, trimStart: 0, effect: { type: 'light-leak', seed: 3, hueShift: 20 } }] };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript(([s, pr]) => { localStorage.setItem('sb-stub-auth-token', JSON.stringify(s)); localStorage.setItem('subwaytakes.project.v1', JSON.stringify(pr)); localStorage.setItem('subwaytakes.muapi_key', 'mu_test'); }, [session, project]);
const page = await ctx.newPage();
const json = (r, b) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(b) });
await page.route('https://stub.media.test/**', r => { const buf = readFileSync(join(dir, basename(new URL(r.request().url()).pathname))); const range = r.request().headers()['range']; const h = { 'access-control-allow-origin': '*', 'accept-ranges': 'bytes', 'content-type': 'video/mp4' }; if (range) { const m = /bytes=(\d+)-(\d*)/.exec(range); const a = +m[1], b = m[2] ? +m[2] : buf.length - 1; return r.fulfill({ status: 206, headers: { ...h, 'content-range': `bytes ${a}-${b}/${buf.length}`, 'content-length': String(b - a + 1) }, body: buf.subarray(a, b + 1) }); } return r.fulfill({ status: 200, headers: { ...h, 'content-length': String(buf.length) }, body: buf }); });
await page.route(`${SB}/**`, r => { const u = r.request().url(); if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } }); if (u.includes('/auth/v1/user')) return json(r, user); if (u.includes('/auth/v1/')) return json(r, { ...session, user }); if (u.includes('user_profiles')) return json(r, { id: 'u-1', credits_balance: 1, subscription_tier: 'free' }); if (u.includes('muapi-proxy')) return json(r, { balance: 5 }); return json(r, []); });
await page.goto(`${base}/create`);
await page.getByLabel('Pineapple take clip').waitFor(); await page.waitForTimeout(1500);
// seek into the leak+transition area
const ruler = await page.getByLabel('Cereal take clip').boundingBox();
await page.mouse.click(ruler.x + 40, ruler.y - 22); await page.waitForTimeout(1200);
await page.getByLabel('Light leak clip').click(); await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/90-all-tracks-effect-selected.png` });
// UI add path
await page.getByRole('button', { name: 'Media', exact: true }).click();
await page.getByRole('button', { name: 'Add Light leak' }).click(); await page.waitForTimeout(500);
const fx = await page.evaluate(() => JSON.parse(localStorage.getItem('subwaytakes.project.v1')).clips.filter(c => c.kind === 'effect').map(c => [c.start, c.duration]));
console.log('EFFECT CLIPS after Add', JSON.stringify(fx));
await page.getByRole('button', { name: 'Media', exact: true }).click();
await page.screenshot({ path: `${out}/91-media-tab-effects-sfx.png` });
await browser.close();
