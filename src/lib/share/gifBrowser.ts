import { applyPalette, GIFEncoder, quantize } from 'gifenc';
import { extractFrames } from '../recast/frames';
import { gifPlan, gifProblem, posterTime } from './gif';

async function metadata(url: string): Promise<{ duration: number; w: number; h: number }> {
  const v = document.createElement('video'); v.muted = true; v.preload = 'metadata'; v.crossOrigin = 'anonymous'; v.src = url;
  await new Promise<void>((res, rej) => { v.onloadedmetadata = () => res(); v.onerror = () => rej(new Error('Could not read the exported video.')); });
  const out = { duration: v.duration, w: v.videoWidth, h: v.videoHeight };
  v.removeAttribute('src'); v.load();
  return out;
}

async function toCanvas(blob: Blob, w: number, h: number): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(blob);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d', { willReadFrequently: true })!.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  return c;
}

/** A looping GIF teaser (up to 3 seconds, 10 frames a second, 480 px wide) from an exported video. */
export async function makeGif(videoUrl: string, onProgress?: (done: number, total: number) => void): Promise<Blob> {
  const meta = await metadata(videoUrl);
  const plan = gifPlan(meta.duration, meta.w, meta.h);
  const problem = gifProblem(plan);
  if (problem) throw new Error(problem);
  const frames = await extractFrames(videoUrl, plan.times, Math.max(plan.width, plan.height));
  const gif = GIFEncoder();
  for (let i = 0; i < frames.length; i++) {
    const c = await toCanvas(frames[i], plan.width, plan.height);
    const { data } = c.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, plan.width, plan.height);
    const palette = quantize(data, 256, { format: 'rgb565' });
    gif.writeFrame(applyPalette(data, palette, 'rgb565'), plan.width, plan.height, { palette, delay: plan.delayMs, repeat: 0 });
    onProgress?.(i + 1, frames.length);
    await new Promise(r => setTimeout(r, 0));   // let the page breathe between frames
  }
  gif.finish();
  return new Blob([gif.bytes() as BlobPart], { type: 'image/gif' });
}

/** A poster picture (PNG) from the best moment of an exported video, with an optional line of text along the bottom. */
export async function makePoster(videoUrl: string, caption?: string): Promise<Blob> {
  const meta = await metadata(videoUrl);
  const [frame] = await extractFrames(videoUrl, [posterTime(meta.duration)], 1600);
  const bmp = await createImageBitmap(frame);
  const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
  const g = c.getContext('2d')!;
  g.drawImage(bmp, 0, 0); bmp.close?.();
  const text = (caption ?? '').trim().slice(0, 80);
  if (text) {
    const size = Math.round(c.width * 0.045), pad = Math.round(size * 0.7);
    g.font = `bold ${size}px sans-serif`;
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, c.height - size - pad * 2, c.width, size + pad * 2);
    g.fillStyle = '#ffffff'; g.textBaseline = 'middle'; g.textAlign = 'center';
    g.fillText(text, c.width / 2, c.height - pad - size / 2, c.width - pad * 2);
  }
  return new Promise<Blob>((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('Could not write the picture.'))), 'image/png'));
}
