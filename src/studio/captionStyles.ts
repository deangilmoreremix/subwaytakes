/**
 * SubwayTakes Studio — caption placement + style helpers.
 *
 * WHY THIS FILE EXISTS (schema constraint): `StudioCaption` in
 * `src/studio/types.ts` is owned elsewhere and cannot be extended here. The
 * caption contract already has exactly three `kind` values
 * ('dialogue' | 'hook' | 'lower_third'), and those three kinds are precisely
 * the three placements the editor offers:
 *
 *   placement      kind           rendered by the composition
 *   -------------  -------------  ---------------------------------------------
 *   bottom-center  dialogue       bottom-center text (default)
 *   top-center     hook           top-center title card
 *   center         lower_third    centered accent plate
 *
 * So placement is encoded in `kind` — no schema change, no corrupted fields.
 *
 * STYLE is the remaining dimension (bold / boxed / minimal / yellow). Adding a
 * `style` field to `StudioCaption` would be the clean fix, but that type is not
 * editable from here. Instead the style travels ON the caption object as an
 * optional unknown field, written through `withStyle()` and read back through
 * `readCaptionStyle()` (both use a narrow cast inside this module):
 *
 *   - in the editing session and in the saved project JSON the field survives
 *     (`saveProject` persists the whole caption object, style included);
 *   - `parseProject()` in types.ts whitelists known fields and drops unknown
 *     ones, so a RELOADED project falls back to 'bold'. That is an accepted,
 *     documented trade-off — the alternative (writing style tokens into
 *     `speaker` or inventing fake kinds) would corrupt semantics. If the
 *     schema owner adds `style?: CaptionStyle` to `StudioCaption`, these
 *     helpers keep working unchanged.
 */

import type { StudioCaption } from './types';

// ---------------------------------------------------------------------------
// Caption styles
// ---------------------------------------------------------------------------

export const CAPTION_STYLES = ['bold', 'boxed', 'minimal', 'yellow'] as const;

export type CaptionStyle = (typeof CAPTION_STYLES)[number];

export const DEFAULT_CAPTION_STYLE: CaptionStyle = 'bold';

export const CAPTION_STYLE_LABELS: Record<CaptionStyle, string> = {
  bold: 'Bold stroke',
  boxed: 'Boxed',
  minimal: 'Minimal',
  yellow: 'Yellow highlight',
};

export function isCaptionStyle(value: unknown): value is CaptionStyle {
  return typeof value === 'string' && (CAPTION_STYLES as readonly string[]).includes(value);
}

type StyledCaption = StudioCaption & { style?: CaptionStyle };

/**
 * Read the style carried on a caption. Anything missing, unknown or malformed
 * falls back to the default (never throws, never fabricates a variant).
 */
export function readCaptionStyle(caption: StudioCaption | null | undefined): CaptionStyle {
  const style = (caption as StyledCaption | null | undefined)?.style;
  return isCaptionStyle(style) ? style : DEFAULT_CAPTION_STYLE;
}

/**
 * Return a copy of the caption carrying `style` (narrow cast write). The input
 * object is never mutated, so reducer/undo snapshots stay intact.
 */
export function withStyle<T extends StudioCaption>(caption: T, style: CaptionStyle): T {
  return { ...caption, style } as T;
}

// ---------------------------------------------------------------------------
// Caption placement (encoded in the existing `kind` field)
// ---------------------------------------------------------------------------

export const CAPTION_PLACEMENTS = ['bottom-center', 'top-center', 'center'] as const;

export type CaptionPlacement = (typeof CAPTION_PLACEMENTS)[number];

export const CAPTION_PLACEMENT_LABELS: Record<CaptionPlacement, string> = {
  'bottom-center': 'Bottom center',
  'top-center': 'Top center',
  center: 'Center',
};

export const CAPTION_PLACEMENT_KINDS: Record<CaptionPlacement, StudioCaption['kind']> = {
  'bottom-center': 'dialogue',
  'top-center': 'hook',
  center: 'lower_third',
};

const PLACEMENT_BY_KIND: Record<StudioCaption['kind'], CaptionPlacement> = {
  dialogue: 'bottom-center',
  hook: 'top-center',
  lower_third: 'center',
};

/** Placement a caption kind renders at (inverse of CAPTION_PLACEMENT_KINDS). */
export function placementForKind(kind: StudioCaption['kind']): CaptionPlacement {
  return PLACEMENT_BY_KIND[kind] ?? 'bottom-center';
}

/** Caption kind that renders a caption at the given placement. */
export function kindForPlacement(placement: CaptionPlacement): StudioCaption['kind'] {
  return CAPTION_PLACEMENT_KINDS[placement] ?? 'dialogue';
}
