import { runModel } from './client';
import { uploadMedia } from '../storage';

export const PORTRAIT_LIMITS = { minRatio: 0.4, maxRatio: 2.5, maxBytes: 10 * 1024 * 1024 } as const;

/** Pure: why an image can't be used as a lipsync portrait (OmniHuman: aspect 0.4-2.5, under 30 MB; we cap at 10 MB). */
export function portraitProblem(width: number, height: number, bytes: number, type: string): string | null {
  if (!type.startsWith('image/')) return 'Please choose an image file (PNG, JPG or WebP).';
  if (bytes > PORTRAIT_LIMITS.maxBytes) return `That image is ${(bytes / 1048576).toFixed(1)} MB. Please use one under 10 MB.`;
  if (!(width > 0 && height > 0)) return 'Could not read the image size.';
  const ratio = width / height;
  if (ratio < PORTRAIT_LIMITS.minRatio || ratio > PORTRAIT_LIMITS.maxRatio) return `The image is too ${ratio < PORTRAIT_LIMITS.minRatio ? 'tall and narrow' : 'wide'} (${width}x${height}). Lipsync needs a width-to-height ratio between 0.4 and 2.5.`;
  return null;
}

export async function imageSize(file: Blob): Promise<{ width: number; height: number }> {
  const bmp = await createImageBitmap(file);
  const size = { width: bmp.width, height: bmp.height };
  bmp.close();
  return size;
}

/** Validate and upload a user's photo. Returns a permanent public URL. */
export async function uploadPortrait(file: File): Promise<string> {
  const { width, height } = await imageSize(file).catch(() => ({ width: 0, height: 0 }));
  const problem = portraitProblem(width, height, file.size, file.type);
  if (problem) throw new Error(problem);
  return uploadMedia(file, file.name);
}

/** Generate a 9:16 portrait with GPT Image 2, then copy it to our storage (muapi output links expire after ~30 days). */
export async function generatePortrait(prompt: string, signal?: AbortSignal): Promise<string> {
  const { url } = await runModel('gpt-image-2-text-to-image', { prompt, aspect_ratio: '9:16', resolution: '1K', quality: 'low' }, { signal, intervalMs: 3000 });
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Could not download the generated portrait (${res.status}).`);
  return uploadMedia(await res.blob(), 'portrait.png');
}
