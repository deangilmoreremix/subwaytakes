import type { CaptionStyle, FontKey } from './model';

/** Writing systems the caption renderer handles. Chosen from the text itself, so any transcript gets a font that has its letters. */
export type Script = 'latin' | 'cyrillic' | 'japanese' | 'korean' | 'chinese' | 'arabic' | 'devanagari' | 'thai' | 'hebrew';

const RANGES: Array<[Script, RegExp]> = [
  ['japanese', /[぀-ヿㇰ-ㇿｦ-ﾟ]/g],
  ['korean', /[가-힯ᄀ-ᇿ㄰-㆏]/g],
  ['arabic', /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-\ufeff]/g],
  ['devanagari', /[ऀ-ॿ]/g],
  ['thai', /[฀-๿]/g],
  ['hebrew', /[֐-׿יִ-ﭏ]/g],
  ['cyrillic', /[Ѐ-ӿ]/g],
  ['chinese', /[一-鿿㐀-䶿]/g],
];

/** The dominant script of some text. Kana wins over Han (Japanese uses both); Han alone is Chinese. */
export function detectScript(text: string): Script {
  const counts: Partial<Record<Script, number>> = {};
  for (const [s, re] of RANGES) { const n = text.match(re)?.length ?? 0; if (n) counts[s] = n; }
  if (counts.japanese) return 'japanese';
  if (counts.korean) return 'korean';
  let best: Script = 'latin'; let max = 0;
  for (const [s, n] of Object.entries(counts) as Array<[Script, number]>) if (n > max) { best = s; max = n; }
  const latin = text.match(/[A-Za-zÀ-ɏ]/g)?.length ?? 0;
  return max > 0 && max >= latin * 0.5 ? best : 'latin';
}

export const isRtl = (s: Script): boolean => s === 'arabic' || s === 'hebrew';
/** Scripts written without spaces between words: words are joined directly. */
export const isSpaceless = (s: Script): boolean => s === 'japanese' || s === 'chinese' || s === 'thai';

/** The font that has this script's letters. Latin and Cyrillic keep the preset's own font (those families include Cyrillic where it matters). */
export function fontForScript(script: Script, preferred: FontKey): FontKey {
  switch (script) {
    case 'japanese': return 'noto_jp';
    case 'korean': return 'noto_kr';
    case 'chinese': return 'noto_sc';
    case 'arabic': return 'noto_arabic';
    case 'devanagari': return 'noto_devanagari';
    case 'thai': return 'noto_thai';
    case 'hebrew': return 'noto_hebrew';
    case 'cyrillic': return preferred === 'bangers' || preferred === 'marker' || preferred === 'lilita' || preferred === 'bebas' || preferred === 'anton' || preferred === 'firacode' ? 'montserrat' : preferred;
    default: return preferred;
  }
}

/** Join word texts for display in this script. */
export const joinWords = (texts: string[], script: Script): string => texts.join(isSpaceless(script) ? '' : ' ');

/** Uppercasing makes no sense (or changes meaning) outside cased scripts. */
export const supportsCase = (s: Script): boolean => s === 'latin' || s === 'cyrillic';

export const LANGUAGES: Array<{ code: string; label: string }> = [
  { code: 'auto', label: 'Auto-detect' }, { code: 'en', label: 'English' }, { code: 'es', label: 'Spanish' }, { code: 'fr', label: 'French' }, { code: 'de', label: 'German' },
  { code: 'pt', label: 'Portuguese' }, { code: 'it', label: 'Italian' }, { code: 'nl', label: 'Dutch' }, { code: 'ru', label: 'Russian' }, { code: 'pl', label: 'Polish' }, { code: 'tr', label: 'Turkish' },
  { code: 'ja', label: 'Japanese' }, { code: 'ko', label: 'Korean' }, { code: 'zh', label: 'Chinese' }, { code: 'hi', label: 'Hindi' }, { code: 'ar', label: 'Arabic' }, { code: 'he', label: 'Hebrew' }, { code: 'th', label: 'Thai' },
  { code: 'id', label: 'Indonesian' }, { code: 'vi', label: 'Vietnamese' }, { code: 'sv', label: 'Swedish' }, { code: 'uk', label: 'Ukrainian' },
];

export function styleForText(style: CaptionStyle, text: string): { script: Script; font: FontKey; rtl: boolean; upper: boolean } {
  const script = detectScript(text);
  return { script, font: fontForScript(script, style.font), rtl: isRtl(script), upper: style.uppercase && supportsCase(script) };
}
