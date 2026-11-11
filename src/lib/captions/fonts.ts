import { continueRender, delayRender } from 'remotion';
import { useEffect, useState } from 'react';

export type FontId = 'inter' | 'anton' | 'bangers';

interface FontDef { id: FontId; label: string; blurb: string; load: () => { fontFamily: string; waitUntilDone: () => Promise<unknown> } | Promise<{ fontFamily: string; waitUntilDone: () => Promise<unknown> }>; weight: number }

/** Google fonts via @remotion/google-fonts (the only route the web renderer embeds reliably). Loaded lazily. */
export const FONTS: Record<FontId, FontDef> = {
  inter: { id: 'inter', label: 'Inter', blurb: 'Clean', weight: 800, load: () => import('@remotion/google-fonts/Inter').then(m => m.loadFont('normal', { weights: ['800'], subsets: ['latin'] })) },
  anton: { id: 'anton', label: 'Anton', blurb: 'Bold & tall', weight: 400, load: () => import('@remotion/google-fonts/Anton').then(m => m.loadFont('normal', { weights: ['400'], subsets: ['latin'] })) },
  bangers: { id: 'bangers', label: 'Bangers', blurb: 'Comic', weight: 400, load: () => import('@remotion/google-fonts/Bangers').then(m => m.loadFont('normal', { weights: ['400'], subsets: ['latin'] })) },
};
export const FONT_IDS = Object.keys(FONTS) as FontId[];
export const DEFAULT_FONT: FontId = 'inter';

export function isFontId(v: unknown): v is FontId { return typeof v === 'string' && v in FONTS; }

/**
 * Loads a caption font and blocks Remotion rendering until it is ready (so exports never use a fallback face).
 * Falls back to a system sans stack if the font cannot be fetched.
 */
export function useCaptionFont(id: FontId | undefined): { family: string; weight: number } {
  const def = FONTS[id && isFontId(id) ? id : DEFAULT_FONT];
  const [family, setFamily] = useState<string>('system-ui, sans-serif');
  const [handle] = useState(() => delayRender(`font:${def.id}`));
  useEffect(() => {
    let live = true;
    Promise.resolve(def.load())
      .then(async f => { await f.waitUntilDone(); if (live) setFamily(`${f.fontFamily}, system-ui, sans-serif`); })
      .catch(() => { /* keep fallback: export still works */ })
      .finally(() => { if (live) continueRender(handle); });
    return () => { live = false; };
  }, [def, handle]);
  return { family, weight: def.weight };
}
