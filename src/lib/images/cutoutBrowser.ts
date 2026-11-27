/**
 * Background removal in the browser (free, on device). The segmentation model is Google's MediaPipe selfie segmenter; it and its WebAssembly
 * runtime are downloaded from their official hosts the first time and cached by the browser. Nothing is uploaded: the picture never leaves this page
 * until you press "Use this portrait".
 */
import { MAX_CUTOUT_SIDE, applyMask, cutoutProblem, fitCutoutSize, maskCoverage, BACKGROUND_CHOICES, type Background, type BackgroundId } from './cutout';

// Pinned to the installed package version; fetched at run time, never bundled.
export const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.0/wasm';
export const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';

export const cutoutSupported = (): boolean => typeof WebAssembly !== 'undefined' && typeof document !== 'undefined' && typeof createImageBitmap === 'function';

type Segmenter = { segment: (img: ImageData) => { confidenceMasks?: Array<{ getAsFloat32Array: () => Float32Array; close: () => void }>; close?: () => void } };
let segmenterPromise: Promise<Segmenter> | null = null;

/** Load the model once. A failure is reported (with the real reason) and the next call tries again. */
async function loadSegmenter(): Promise<Segmenter> {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      try {
        const { FilesetResolver, ImageSegmenter } = await import('@mediapipe/tasks-vision');
        const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
        return await ImageSegmenter.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
          runningMode: 'IMAGE', outputConfidenceMasks: true, outputCategoryMask: false,
        }) as unknown as Segmenter;
      } catch (e) {
        segmenterPromise = null;
        throw new Error(`Could not load the background-removal model (${e instanceof Error ? e.message : 'unknown error'}). Check your connection and try again.`);
      }
    })();
  }
  return segmenterPromise;
}

export interface CutoutResult { blob: Blob; width: number; height: number; coverage: number }

export function backgroundFor(id: BackgroundId, blurred: () => Uint8ClampedArray): Background {
  const choice = BACKGROUND_CHOICES.find(c => c.id === id);
  if (!choice || choice.id === 'transparent') return { kind: 'transparent' };
  if (choice.id === 'blur') return { kind: 'blur', rgba: blurred() };
  return { kind: 'color', rgb: (choice as { rgb: [number, number, number] }).rgb };
}

/** Cut the person out of a picture and put them on the chosen background. Throws a readable Error when it cannot (no person, model not loadable). */
export async function removeBackground(file: Blob, id: BackgroundId, onStage?: (s: 'model' | 'segment' | 'compose') => void): Promise<CutoutResult> {
  onStage?.('model');
  const seg = await loadSegmenter();
  const bmp = await createImageBitmap(file);
  const { width, height } = fitCutoutSize(bmp.width, bmp.height, MAX_CUTOUT_SIDE);
  if (!width) throw new Error('That picture has no size.');
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('This browser cannot draw pictures.');
  ctx.drawImage(bmp, 0, 0, width, height); bmp.close?.();
  const image = ctx.getImageData(0, 0, width, height);

  onStage?.('segment');
  const result = seg.segment(image);
  const m = result.confidenceMasks?.[0];
  if (!m) throw new Error('The model returned no mask.');
  const mask = Float32Array.from(m.getAsFloat32Array());
  m.close(); result.close?.();
  if (mask.length !== width * height) throw new Error(`The mask was ${mask.length} pixels but the picture has ${width * height}.`);
  const coverage = maskCoverage(mask);
  const problem = cutoutProblem(coverage);
  if (problem) throw new Error(problem);

  onStage?.('compose');
  const blurred = () => {
    const c2 = document.createElement('canvas'); c2.width = width; c2.height = height;
    const x2 = c2.getContext('2d', { willReadFrequently: true })!;
    x2.filter = `blur(${Math.max(6, Math.round(width / 60))}px)`; x2.drawImage(canvas, 0, 0);
    return x2.getImageData(0, 0, width, height).data;
  };
  const out = applyMask(image.data, mask, width, height, backgroundFor(id, blurred));
  const outCanvas = document.createElement('canvas'); outCanvas.width = width; outCanvas.height = height;
  outCanvas.getContext('2d')!.putImageData(new ImageData(out, width, height), 0, 0);
  const blob = await new Promise<Blob>((res, rej) => outCanvas.toBlob(b => (b ? res(b) : rej(new Error('Could not write the picture.'))), 'image/png'));
  return { blob, width, height, coverage };
}
