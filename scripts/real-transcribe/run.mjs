// Usage: node scripts/real-transcribe/run.mjs <engine> <model> <clip.mp4> <durationSec> [language]
import { createRequire } from 'node:module';
import fs from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [engine, model, clip, dur, lang = 'auto'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--enable-unsafe-webgpu'] });
const ctx = await browser.newContext({ proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined });
const page = await ctx.newPage();
page.on('console', m => console.log('[page]', m.type(), m.text().slice(0, 300)));
page.on('crash', () => console.log('PAGE CRASHED'));
page.on('pageerror', e => console.log('PAGEERROR', String(e).slice(0,300)));
// the clip is served same-origin so no CORS/COEP issue; COEP also needs CORP on cross-origin sub-resources, so route HF files through with CORP added
await page.route('**/stub-clip.mp4', r => r.fulfill({ status: 200, contentType: 'video/mp4', body: fs.readFileSync(clip) }));
await page.route(/huggingface\.co|hf\.co|cdn-lfs|jsdelivr|remotion/, async r => { const resp = await r.fetch(); await r.fulfill({ response: resp, headers: { ...resp.headers(), 'cross-origin-resource-policy': 'cross-origin', 'access-control-allow-origin': '*' } }); });
await page.goto('http://localhost:5199/scripts/real-transcribe/index.html');
await page.waitForFunction(() => typeof window.runEngine === 'function', null, { timeout: 60000 });
console.log('cross-origin isolated:', await page.evaluate(() => window.isolated), '| webgpu:', await page.evaluate(() => !!navigator.gpu));
const res = await page.evaluate(([e, m, d, l, dev]) => window.runEngine(e, m, '/stub-clip.mp4', Number(d), l, dev), [engine, model, dur, lang, process.env.DEVICE || 'auto']);
console.log(JSON.stringify(res, null, 1).slice(0, 4000));
await browser.close();
