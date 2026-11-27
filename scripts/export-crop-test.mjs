// REAL export proof for reframing: makes a test video whose colours encode position (red = across, green = down), exports it twice through the real
// web exporter (headless Chromium), once plain and once with a 2x crop centred at (0.75, 0.5), and checks the pixels moved where the maths says.
// Needs ffmpeg and the dev server. Usage: node scripts/export-crop-test.mjs <outDir> [baseUrl]
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const [out, base = 'http://localhost:5173'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const grad = `${out}/grad.mp4`;
execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=720x1280:d=4:r=30', '-vf', "geq=r='255*X/W':g='255*Y/H':b=128", '-c:v', 'libx264', '-pix_fmt', 'yuv420p', grad]);
const clip = { id: 'a', trackId: 'v1', kind: 'video', label: 'shot', start: 0, duration: 60, trimStart: 0, sourceFrames: 120, src: 'https://stub.media.test/grad.mp4', volume: 1 };
const proj = c => ({ fps: 30, tracks: [{ id: 'v1', kind: 'video', name: 'Video' }, { id: 'c1', kind: 'caption', name: 'Captions' }, { id: 'a1', kind: 'audio', name: 'Sound' }, { id: 'e1', kind: 'effect', name: 'Effects' }], clips: [{ ...clip, ...(c ? { crop: c } : {}) }] });
writeFileSync(`${out}/plain.json`, JSON.stringify(proj(null)));
writeFileSync(`${out}/crop.json`, JSON.stringify(proj({ zoom: 2, x: 0.75, y: 0.5 })));
for (const n of ['plain', 'crop']) execFileSync('node', ['scripts/export-project.mjs', grad, `${out}/${n}.json`, `${out}/${n}.mp4`, base], { stdio: ['ignore', 'ignore', 'inherit'] });

function pixel(file, fx, fy) {
  const png = `${file}.png`;
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', '1', '-i', file, '-frames:v', '1', png]);
  const probe = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', png]).toString().trim().split('x').map(Number);
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', png, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 28 });
  const [w, h] = probe; const i = (Math.floor(fy * h) * w + Math.floor(fx * w)) * 3;
  return [raw[i], raw[i + 1], raw[i + 2]];
}
let failures = 0;
const check = (name, ok, extra = '') => { console.log(ok ? 'PASS' : 'FAIL', name, extra); if (!ok) failures++; };
const near = (a, b, tol = 14) => Math.abs(a - b) <= tol;
const pc = pixel(`${out}/plain.mp4`, 0.5, 0.5), cc = pixel(`${out}/crop.mp4`, 0.5, 0.5);
check('uncropped: the middle of the frame is the middle of the picture (red 128, green 128)', near(pc[0], 128) && near(pc[1], 128), JSON.stringify(pc));
check('2x crop at (0.75, 0.5): the middle of the frame shows the picture at 75% across (red 191, green 128)', near(cc[0], 191) && near(cc[1], 128), JSON.stringify(cc));
const ul = pixel(`${out}/crop.mp4`, 0.25, 0.25);
check('2x crop: a quarter in from the corner shows the picture at 62.5% across and 37.5% down (red 159, green 96)', near(ul[0], 159) && near(ul[1], 96), JSON.stringify(ul));
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED (real web export of a real video, pixels measured)');
process.exit(failures ? 1 : 0);
