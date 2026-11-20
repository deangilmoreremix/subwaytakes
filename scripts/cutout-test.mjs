// REAL background-removal test: runs the real MediaPipe segmenter in headless Chromium on a real portrait and measures the result.
// It downloads the model (about 250 KB) and the wasm runtime from their official hosts. If the sandbox cannot reach them, this says so and exits 2 (UNVERIFIED).
// Run the dev server first. Usage: node scripts/cutout-test.mjs <portrait.png> <outDir> [baseUrl]
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [img, out, base = 'http://localhost:5173'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
let failures = 0;
const check = (name, ok, extra = '') => { console.log(ok ? 'PASS' : 'FAIL', name, extra); if (!ok) failures++; };

const browser = await chromium.launch({ args: ['--disable-dev-shm-usage'] });
const page = await (await browser.newContext({ viewport: { width: 900, height: 700 } })).newPage();
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 200)));
await page.goto(`${base}/login`);
const b64 = readFileSync(img).toString('base64');

const run = id => page.evaluate(async ([b64, id]) => {
  const m = await import('/src/lib/images/cutoutBrowser.ts');
  const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
  const stages = [];
  const t0 = performance.now();
  const r = await m.removeBackground(blob, id, s => stages.push(s));
  const bytes = new Uint8Array(await r.blob.arrayBuffer());
  // measure the result: how much of the corner area is background, how much of the centre is person
  const bmp = await createImageBitmap(r.blob); const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height; const x = c.getContext('2d'); x.drawImage(bmp, 0, 0);
  const px = (fx, fy) => Array.from(x.getImageData(Math.floor(fx * bmp.width), Math.floor(fy * bmp.height), 1, 1).data);
  return { ms: Math.round(performance.now() - t0), stages, width: r.width, height: r.height, coverage: r.coverage, size: bytes.length, b64: btoa(String.fromCharCode(...bytes.slice(0, 0))) , corner: px(0.04, 0.04), centre: px(0.5, 0.45), png: Array.from(bytes).length ? undefined : undefined };
}, [b64, id]).catch(e => ({ error: String(e && e.message || e) }));

const blobOut = id => page.evaluate(async ([b64, id]) => {
  const m = await import('/src/lib/images/cutoutBrowser.ts');
  const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
  const r = await m.removeBackground(blob, id);
  const buf = new Uint8Array(await r.blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}, [b64, id]);

const first = await run('transparent');
if (first.error) {
  console.log('UNVERIFIED: could not run the segmenter here:', first.error.slice(0, 300));
  await browser.close(); process.exit(2);
}
console.log('transparent:', JSON.stringify({ ...first, b64: undefined }));
check('the model loads and a mask is made', first.stages.join() === 'model,segment,compose');
check('a person was found (coverage between 5% and 90% of the picture)', first.coverage > 0.05 && first.coverage < 0.9, first.coverage.toFixed(3));
check('the corner background is transparent', first.corner[3] === 0, JSON.stringify(first.corner));
check('the middle of the person stays opaque', first.centre[3] > 200, JSON.stringify(first.centre));
for (const id of ['transparent', 'grey', 'blur']) {
  const png = await blobOut(id);
  writeFileSync(`${out}/cutout-${id}.png`, Buffer.from(png, 'base64'));
}
const white = await run('white');
check('on white the corner is white and opaque', white.corner[0] > 240 && white.corner[1] > 240 && white.corner[2] > 240 && white.corner[3] === 255, JSON.stringify(white.corner));
console.log('seconds for one picture (CPU, headless):', (first.ms / 1000).toFixed(1));
await browser.close();
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED (real model, real portrait; headless CPU)');
process.exit(failures ? 1 : 0);
