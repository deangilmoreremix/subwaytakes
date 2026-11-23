/**
 * "Looks": the art direction of an episode. The default is the handheld documentary look every prompt used before (its text is unchanged, so old
 * episodes behave exactly as they did). The others restyle the same interview: the host, the guest, the one card and the hand-off stay, only the
 * rendering style changes. A look never changes WHO is shown: no real people, no children, the content screen is unchanged for every look.
 */
export type LookId = 'documentary' | 'animated3d' | 'claymation' | 'cartoon' | 'vhs' | 'noir';

export interface Look {
  id: LookId;
  label: string;
  hint: string;
  /** One sentence for a video prompt (empty for the default). */
  video: string;
  /** What replaces "documentary framing, natural light, photorealistic" in a starting-image prompt. */
  still: string;
}

export const DEFAULT_LOOK: LookId = 'documentary';

export const LOOKS: readonly Look[] = [
  { id: 'documentary', label: 'Documentary', hint: 'Real-looking handheld footage (default)', video: '', still: 'Handheld documentary framing, natural light, photorealistic' },
  { id: 'animated3d', label: '3D animated', hint: 'Soft, colourful 3D animated-movie look', video: 'Visual style: a polished 3D animated feature-film look with soft stylised faces, rich colour, smooth shading and expressive animation. Not photorealistic.', still: 'Polished 3D animated feature-film style, soft stylised faces, rich colour, smooth shading, not photorealistic' },
  { id: 'claymation', label: 'Claymation', hint: 'Handmade stop-motion clay', video: 'Visual style: handmade stop-motion claymation, visible clay texture and fingerprints, slightly jerky stop-motion movement, miniature set feel. Not photorealistic.', still: 'Handmade claymation style, visible clay texture, miniature set, not photorealistic' },
  { id: 'cartoon', label: 'Cartoon', hint: 'Flat 2D cel-shaded cartoon', video: 'Visual style: a flat 2D hand-drawn cartoon with bold outlines, cel shading and bright flat colours, lively limited animation. Not photorealistic.', still: 'Flat 2D hand-drawn cartoon style, bold outlines, cel shading, bright colours, not photorealistic' },
  { id: 'vhs', label: 'VHS tape', hint: '90s camcorder footage', video: 'Visual style: grainy 1990s VHS camcorder footage, soft focus, tape noise, slightly washed colours and a gentle tracking wobble.', still: 'Grainy 1990s VHS camcorder frame, soft focus, tape noise, slightly washed colours' },
  { id: 'noir', label: 'Black and white', hint: 'High-contrast film noir', video: 'Visual style: high-contrast black and white film noir, deep shadows, strong rim light, fine film grain.', still: 'High-contrast black and white film noir photograph, deep shadows, fine film grain' },
];

export const isLook = (v: unknown): v is LookId => typeof v === 'string' && LOOKS.some(l => l.id === v);
export const lookOf = (id: unknown): Look => LOOKS.find(l => l.id === id) ?? LOOKS[0];

/** The sentence added to a video prompt ("" for the default look, so default prompts are byte for byte what they were). */
export const lookVideoLine = (id: unknown): string => lookOf(id).video;

/** The style words for a starting-image prompt. */
export const lookStillLine = (id: unknown): string => lookOf(id).still;
