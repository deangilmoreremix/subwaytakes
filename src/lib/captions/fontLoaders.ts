import { continueRender, delayRender } from 'remotion';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FontKey } from './model';
import { FONT_META, nearestWeight } from './fontData';

// Loads caption fonts through @remotion/google-fonts (the one route the web renderer embeds reliably) and blocks Remotion rendering until they are
// ready, so an export never uses a fallback face. A font family is loaded only when a caption actually needs it.

interface Loaded { fontFamily: string; waitUntilDone: () => Promise<unknown> }
type Load = (weights: string[]) => Promise<Loaded>;
const latin = ['latin'] as const;
const latinCyr = ['latin', 'cyrillic'] as const;
// The package types each family's weights and subsets separately; the values below are checked against it by the test suite.
const L = (importer: () => Promise<{ loadFont: (style: 'normal', o: { weights: never[]; subsets: never[]; ignoreTooManyRequestsWarning?: boolean }) => Loaded }>, subsets: readonly string[]): Load =>
  (weights) => importer().then(m => m.loadFont('normal', { weights: weights as never[], subsets: subsets as unknown as never[], ignoreTooManyRequestsWarning: true }));

const LOADERS: Record<FontKey, Load> = {
  inter: L(() => import('@remotion/google-fonts/Inter') as never, latinCyr),
  anton: L(() => import('@remotion/google-fonts/Anton') as never, latin),
  bangers: L(() => import('@remotion/google-fonts/Bangers') as never, latin),
  montserrat: L(() => import('@remotion/google-fonts/Montserrat') as never, latinCyr),
  poppins: L(() => import('@remotion/google-fonts/Poppins') as never, latin),
  bebas: L(() => import('@remotion/google-fonts/BebasNeue') as never, latin),
  oswald: L(() => import('@remotion/google-fonts/Oswald') as never, latinCyr),
  marker: L(() => import('@remotion/google-fonts/PermanentMarker') as never, latin),
  firacode: L(() => import('@remotion/google-fonts/FiraCode') as never, latinCyr),
  playfair: L(() => import('@remotion/google-fonts/PlayfairDisplay') as never, latinCyr),
  archivoblack: L(() => import('@remotion/google-fonts/ArchivoBlack') as never, latin),
  lilita: L(() => import('@remotion/google-fonts/LilitaOne') as never, latin),
  noto_jp: L(() => import('@remotion/google-fonts/NotoSansJP') as never, ['japanese', 'latin']),
  noto_kr: L(() => import('@remotion/google-fonts/NotoSansKR') as never, ['korean', 'latin']),
  noto_sc: L(() => import('@remotion/google-fonts/NotoSansSC') as never, ['chinese-simplified', 'latin']),
  noto_arabic: L(() => import('@remotion/google-fonts/NotoSansArabic') as never, ['arabic', 'latin']),
  noto_devanagari: L(() => import('@remotion/google-fonts/NotoSansDevanagari') as never, ['devanagari', 'latin']),
  noto_thai: L(() => import('@remotion/google-fonts/NotoSansThai') as never, ['thai', 'latin']),
  noto_hebrew: L(() => import('@remotion/google-fonts/NotoSansHebrew') as never, ['hebrew', 'latin']),
};

export interface FontRequest { key: FontKey; weights: number[] }
export const FALLBACK_STACK = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Which weights of which families a set of captions needs (deduplicated, snapped to weights the family has). */
export function fontRequests(items: Array<{ key: FontKey; weight: number; weightTo?: number }>): FontRequest[] {
  const map = new Map<FontKey, Set<number>>();
  for (const it of items) { const set = map.get(it.key) ?? new Set<number>(); set.add(nearestWeight(it.key, it.weight)); if (it.weightTo) set.add(nearestWeight(it.key, it.weightTo)); map.set(it.key, set); }
  return [...map].map(([key, w]) => ({ key, weights: [...w].sort((a, b) => a - b) }));
}

/**
 * Load the requested fonts. Returns the CSS family string for each key (a safe system stack until it has loaded). While the first load is pending
 * Remotion waits, so exports and thumbnails never show a fallback face.
 */
export function useFontFamilies(requests: FontRequest[]): Record<string, string> {
  const sig = useMemo(() => JSON.stringify(requests), [requests]);
  const [families, setFamilies] = useState<Record<string, string>>({});
  const [handle] = useState(() => delayRender('caption-fonts'));
  const released = useRef(false);
  useEffect(() => {
    let live = true;
    const reqs = JSON.parse(sig) as FontRequest[];
    Promise.all(reqs.map(async r => {
      try { const f = await LOADERS[r.key](r.weights.map(String)); await f.waitUntilDone(); return [r.key, `${f.fontFamily}, ${FALLBACK_STACK}`] as const; }
      catch { return [r.key, `"${FONT_META[r.key].family}", ${FALLBACK_STACK}`] as const; }   // keep going: the export still works with a fallback
    })).then(entries => { if (live) setFamilies(f => ({ ...f, ...Object.fromEntries(entries) })); }).finally(() => { if (!released.current) { released.current = true; continueRender(handle); } });
    return () => { live = false; };
  }, [sig, handle]);
  return families;
}

/** Load fonts into the page for plain DOM previews (preset grid, pickers). Resolves to the CSS family per key; never throws. */
export async function loadFamilies(requests: FontRequest[]): Promise<Record<string, string>> {
  const entries = await Promise.all(requests.map(async r => {
    try { const f = await LOADERS[r.key](r.weights.map(String)); await f.waitUntilDone(); return [r.key, `${f.fontFamily}, ${FALLBACK_STACK}`] as const; }
    catch { return [r.key, `"${FONT_META[r.key].family}", ${FALLBACK_STACK}`] as const; }
  }));
  return Object.fromEntries(entries);
}
