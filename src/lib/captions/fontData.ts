import type { FontKey } from './model';

/** Pure font facts (no Remotion import): display name, family name written into ASS files, and the weights each family offers. */
export interface FontMeta { key: FontKey; label: string; family: string; weights: number[]; scripts: string[] }

export const FONT_META: Record<FontKey, FontMeta> = {
  inter: { key: 'inter', label: 'Inter', family: 'Inter', weights: [300, 400, 500, 600, 700, 800, 900], scripts: ['latin', 'cyrillic'] },
  anton: { key: 'anton', label: 'Anton', family: 'Anton', weights: [400], scripts: ['latin'] },
  bangers: { key: 'bangers', label: 'Bangers', family: 'Bangers', weights: [400], scripts: ['latin'] },
  montserrat: { key: 'montserrat', label: 'Montserrat', family: 'Montserrat', weights: [300, 400, 500, 600, 700, 800, 900], scripts: ['latin', 'cyrillic'] },
  poppins: { key: 'poppins', label: 'Poppins', family: 'Poppins', weights: [300, 400, 500, 600, 700, 800, 900], scripts: ['latin'] },
  bebas: { key: 'bebas', label: 'Bebas Neue', family: 'Bebas Neue', weights: [400], scripts: ['latin'] },
  oswald: { key: 'oswald', label: 'Oswald', family: 'Oswald', weights: [300, 400, 500, 600, 700], scripts: ['latin', 'cyrillic'] },
  marker: { key: 'marker', label: 'Permanent Marker', family: 'Permanent Marker', weights: [400], scripts: ['latin'] },
  firacode: { key: 'firacode', label: 'Fira Code', family: 'Fira Code', weights: [300, 400, 500, 600, 700], scripts: ['latin', 'cyrillic'] },
  playfair: { key: 'playfair', label: 'Playfair Display', family: 'Playfair Display', weights: [400, 500, 600, 700, 800, 900], scripts: ['latin', 'cyrillic'] },
  archivoblack: { key: 'archivoblack', label: 'Archivo Black', family: 'Archivo Black', weights: [400], scripts: ['latin'] },
  lilita: { key: 'lilita', label: 'Lilita One', family: 'Lilita One', weights: [400], scripts: ['latin'] },
  noto_jp: { key: 'noto_jp', label: 'Noto Sans JP', family: 'Noto Sans JP', weights: [400, 700, 900], scripts: ['japanese'] },
  noto_kr: { key: 'noto_kr', label: 'Noto Sans KR', family: 'Noto Sans KR', weights: [400, 700, 900], scripts: ['korean'] },
  noto_sc: { key: 'noto_sc', label: 'Noto Sans SC', family: 'Noto Sans SC', weights: [400, 700, 900], scripts: ['chinese'] },
  noto_arabic: { key: 'noto_arabic', label: 'Noto Sans Arabic', family: 'Noto Sans Arabic', weights: [400, 700, 900], scripts: ['arabic'] },
  noto_devanagari: { key: 'noto_devanagari', label: 'Noto Sans Devanagari', family: 'Noto Sans Devanagari', weights: [400, 700, 900], scripts: ['devanagari'] },
  noto_thai: { key: 'noto_thai', label: 'Noto Sans Thai', family: 'Noto Sans Thai', weights: [400, 700, 900], scripts: ['thai'] },
  noto_hebrew: { key: 'noto_hebrew', label: 'Noto Sans Hebrew', family: 'Noto Sans Hebrew', weights: [400, 700, 900], scripts: ['hebrew'] },
};

/** The nearest weight this family actually has (so a preset's 900 on a family with only 400 still renders). */
export function nearestWeight(key: FontKey, weight: number): number {
  const w = FONT_META[key].weights;
  return w.reduce((best, x) => (Math.abs(x - weight) < Math.abs(best - weight) ? x : best), w[0]);
}

/** Fonts a customer can choose for Latin text (script fonts are picked automatically). */
export const CHOOSABLE_FONTS: FontKey[] = ['inter', 'anton', 'bangers', 'montserrat', 'poppins', 'bebas', 'oswald', 'marker', 'firacode', 'playfair', 'archivoblack', 'lilita'];
