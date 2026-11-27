import { clampPixelCrop } from '../timeline/crop';

/** Cut a rectangle (in pixels of the original picture) out of an image and return it as a PNG. Browser only. */
export async function cropToBlob(src: string, area: { x: number; y: number; width: number; height: number }): Promise<Blob> {
  const img = new Image();
  img.crossOrigin = 'anonymous'; img.src = src;
  await img.decode();
  const r = clampPixelCrop(area, img.naturalWidth, img.naturalHeight);
  const canvas = document.createElement('canvas'); canvas.width = r.width; canvas.height = r.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot draw pictures.');
  ctx.drawImage(img, r.x, r.y, r.width, r.height, 0, 0, r.width, r.height);
  return new Promise<Blob>((res, rej) => canvas.toBlob(b => (b ? res(b) : rej(new Error('Could not write the picture.'))), 'image/png'));
}
