import type { RecastMode, RecastModel } from './limits';

/** Our own prompt text. Structure follows the open-genjutsu approach (MIT); wording is original. */

export const PLATE_PROMPT = 'Remove every person from this image completely, including shadows, reflections and anything they hold or wear. Fill the space with the natural background that would be behind them. Keep the camera angle, lighting, colours and every other detail exactly as they are. Do not add any new people or text.';

export function buildSheetPrompt(outfit?: string): string {
  const wardrobe = outfit?.trim() ? `Dress the person in: ${outfit.trim()}.` : 'Keep the same outfit as in the photo.';
  return `Create a clean character reference sheet from this photo: the same person shown from the front, three-quarter and side views plus a close-up of the face, on a plain light background. Keep the face, hair, skin tone and build exactly consistent across every view. ${wardrobe} No text, no logos, no extra people.`;
}

/** Reference labels differ per model: Seedance reads "@image1", Wan reads "Image1". */
export function refLabel(model: RecastModel, kind: 'image' | 'video', n: number): string {
  return model === 'seedance' ? `@${kind}${n}` : `${kind === 'image' ? 'Image' : 'Video'}${n}`;
}

export interface WriterInput { model: RecastModel; mode: RecastMode; sheets: number; plates: number; seconds: number; brief?: string; outfit?: string; sceneSummary?: string }

export const WRITER_SYSTEM = 'You write production prompts for a reference-guided video generator. You never mention the tool, model or provider that will run the prompt. Reply with the final prompt text only.';

export function buildWriterPrompt(i: WriterInput): string {
  const img = (n: number) => refLabel(i.model, 'image', n);
  const vid = refLabel(i.model, 'video', 1);
  const characters = Array.from({ length: i.sheets }, (_, k) => img(k + 1)).join(', ');
  const scenes = i.plates ? Array.from({ length: i.plates }, (_, k) => img(i.sheets + k + 1)).join(', ') : 'none';
  const task = i.mode === 'motion_transfer'
    ? `Use ${vid} only for body motion, choreography, timing and camera movement. Rebuild the performer entirely from the character sheets (${characters}); do not keep the identity or clothing of the person in ${vid}.`
    : `Keep the filmed scene, framing and motion from ${vid}. Replace only the requested character, product or clothing with what the references (${characters}) show.`;
  return [
    'The attached contact sheet shows the reference images with their labels. Write one detailed prompt for a reference-guided video of ' + `${i.seconds} seconds.`,
    `Reference key: ${vid} is a depth map of the source motion. Character sheets: ${characters}. Clean scene plates: ${scenes}.`,
    task,
    i.sceneSummary ? `Scene of the source clip: ${i.sceneSummary}` : '',
    i.outfit?.trim() ? `Wardrobe: ${i.outfit.trim()}` : '',
    i.brief?.trim() ? `Creative brief from the user: ${i.brief.trim()}` : '',
    'Structure the prompt with these labelled sections: REFERENCE KEY, SCENE AND CAST, MOTION REFERENCE, CAMERA, CONSISTENCY AND PHYSICS, PRIORITY ORDER. Put identity and motion fidelity first in the priority order. Describe lighting, expressions and gestures concretely.',
    'Return only the final prompt text, with no preamble and no JSON.',
  ].filter(Boolean).join('\n\n');
}

/** Seedance needs @-labels; make sure the written prompt carries a reference key even if the writer forgot. */
export function ensureReferenceKey(prompt: string, model: RecastModel, sheets: number, plates: number): string {
  const p = prompt.trim();
  if (model !== 'seedance' || /@video1/i.test(p)) return p;
  const lines = [`@video1 is the motion reference.`, ...Array.from({ length: sheets }, (_, k) => `@image${k + 1} is a character sheet.`), ...Array.from({ length: plates }, (_, k) => `@image${sheets + k + 1} is a clean scene plate.`)];
  return `REFERENCE KEY: ${lines.join(' ')}\n\n${p}`;
}

/** Wan labels are plain words; translate any @-style labels the writer used. */
export function normalizeLabels(prompt: string, model: RecastModel): string {
  if (model !== 'wan') return prompt;
  return prompt.replace(/@(image|video)(\d+)/gi, (_m, k: string, n: string) => `${k[0].toUpperCase()}${k.slice(1).toLowerCase()}${n}`);
}

export const MAX_RENDER_PROMPT = 4000;
