// REAL test of the share tools: runs the real GIF encoder and poster maker in headless Chromium on a real exported MP4, saves the files and inspects them with ffprobe.
// Run the dev server first. Usage: node scripts/share-test.mjs <exported.mp4> <outDir> [baseUrl]
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [mp4, out, base = 'http://localhost:5173'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
let failures = 0;
const check = (name, ok, extra = '') => { console.log(ok ? 'PASS' : 'FAIL', name, extra); if (!ok) failures++; };
const VIDEO = readFileSync(mp4);

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: 900, height: 700 } })).newPage();
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 200)));
await page.route('https://stub.media.test/**', r => {
  const range = r.request().headers().range;
  if (range) { const m = /bytes=(\d+)-(\d*)/.exec(range); const s = Number(m[1]); const e = m[2] ? Number(m[2]) : VIDEO.length - 1; return r.fulfill({ status: 206, contentType: 'video/mp4', headers: { 'access-control-allow-origin': '*', 'accept-ranges': 'bytes', 'content-range': `bytes ${s}-${e}/${VIDEO.length}` }, body: VIDEO.subarray(s, e + 1) }); }
  return r.fulfill({ status: 200, contentType: 'video/mp4', headers: { 'access-control-allow-origin': '*', 'accept-ranges': 'bytes' }, body: VIDEO });
});
await page.goto(`${base}/login`);

const make = (kind, caption) => page.evaluate(async ([kind, caption]) => {
  const m = await import('/src/lib/share/gifBrowser.ts');
  const t0 = performance.now(); let steps = 0;
  const blob = kind === 'gif' ? await m.makeGif('https://stub.media.test/e.mp4', () => { steps++; }) : await m.makePoster('https://stub.media.test/e.mp4', caption);
  const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return { ms: Math.round(performance.now() - t0), steps, size: blob.size, type: blob.type, b64: btoa(s) };
}, [kind, caption]).catch(e => ({ error: String(e && e.message || e) }));

const gif = await make('gif');
if (gif.error) { console.log('FAILED to run:', gif.error.slice(0, 300)); process.exit(1); }
writeFileSync(`${out}/teaser.gif`, Buffer.from(gif.b64, 'base64'));
const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,nb_read_frames,r_frame_rate,codec_name', '-of', 'json', `${out}/teaser.gif`]).toString()).streams[0];
check('the GIF is a real GIF file', Buffer.from(gif.b64, 'base64').subarray(0, 6).toString() === 'GIF89a' && gif.type === 'image/gif');
check('it is 480 px wide and keeps the video\'s shape', Number(probe.width) === 480 && Math.abs(Number(probe.height) / Number(probe.width) - 1920 / 1080) < 0.02, `${probe.width}x${probe.height}`);
const frames = Number(probe.nb_read_frames);
check('it has about 10 frames a second for the video (2 s source means up to 18 frames)', frames >= 8 && frames <= 20, `${frames} frames, ${probe.r_frame_rate}`);
check('it is a size you can post (under 8 MB)', gif.size < 8 * 1024 * 1024, `${(gif.size / 1024).toFixed(0)} KB`);
const loop = Buffer.from(gif.b64, 'base64').includes(Buffer.from('NETSCAPE2.0'));
check('it loops (has the Netscape loop block)', loop);
console.log('  GIF made in', gif.ms, 'ms (headless CPU),', gif.steps, 'frames encoded');

const poster = await make('poster', 'So what\'s ur take?');
writeFileSync(`${out}/poster.png`, Buffer.from(poster.b64, 'base64'));
const pp = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'json', `${out}/poster.png`]).toString()).streams[0];
check('the poster is a PNG at video size (up to 1600 px)', poster.type === 'image/png' && Number(pp.width) <= 1600 && Number(pp.height) <= 1600 && Number(pp.height) > Number(pp.width), `${pp.width}x${pp.height}`);
// the caption bar darkens the bottom of the picture compared with a poster made without one
const bare = await make('poster', '');
writeFileSync(`${out}/poster-bare.png`, Buffer.from(bare.b64, 'base64'));
const dark = execFileSync('ffmpeg', ['-v', 'error', '-i', `${out}/poster.png`, '-vf', 'crop=iw:ih*0.06:0:ih*0.92,format=gray', '-f', 'rawvideo', '-'], { maxBuffer: 1 << 28 });
const light = execFileSync('ffmpeg', ['-v', 'error', '-i', `${out}/poster-bare.png`, '-vf', 'crop=iw:ih*0.06:0:ih*0.92,format=gray', '-f', 'rawvideo', '-'], { maxBuffer: 1 << 28 });
const avg = b => b.reduce((a, x) => a + x, 0) / b.length;
check('a caption line adds a dark bar along the bottom', avg(dark) < avg(light) - 10, `${avg(dark).toFixed(0)} vs ${avg(light).toFixed(0)}`);
await browser.close();
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED (real encoder on a real exported video; headless CPU)');
process.exit(failures ? 1 : 0);
