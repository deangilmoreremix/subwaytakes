import { VERSES, type VerseRecord, type VerseTheme } from './verses.generated';
import type { PickedVerse } from './types';
import { fitWords, wordCount as words } from '../compose';
import { rank, type Ranked, type Searchable } from '../search/rank';

// The verse library (KJV and WEB, public domain; see verses.generated.ts for the sources and how every verse was cross-checked).
// RULE: verse text comes ONLY from this library or from what the customer types. It is never written by a model, and the on-screen text is never trimmed.

export type { PickedVerse } from './types';
export type { VerseRecord, VerseTheme } from './verses.generated';
export type Translation = 'KJV' | 'WEB' | 'BSB';
export const TRANSLATIONS: Translation[] = ['KJV', 'WEB', 'BSB'];
export const TRANSLATION_NAMES: Record<Translation, string> = { KJV: 'King James Version', WEB: 'World English Bible', BSB: 'Berean Standard Bible' };
/** One line about each text's licence, shown under the verse in the picker. All three are public domain (the BSB since 30 April 2023, per its publisher). */
export const TRANSLATION_LICENCE: Record<Translation, string> = { KJV: 'King James Version, public domain.', WEB: 'World English Bible, public domain.', BSB: 'Berean Standard Bible, public domain (placed there by its publisher on 30 April 2023).' };
export const THEME_LABELS: Record<VerseTheme, string> = { strength: 'Strength', peace: 'Peace', hope: 'Hope', love: 'Love', gratitude: 'Gratitude', courage: 'Courage', wisdom: 'Wisdom', forgiveness: 'Forgiveness', perseverance: 'Perseverance', joy: 'Joy', comfort: 'Comfort', trust: 'Trust', kindness: 'Kindness', purpose: 'Purpose' };
export const THEMES = Object.keys(THEME_LABELS) as VerseTheme[];
export const MAX_TYPED_VERSE = 300;

export const allVerses = (): readonly VerseRecord[] => VERSES;
export const textOf = (v: VerseRecord, t: Translation): string => (t === 'KJV' ? v.kjv : t === 'WEB' ? v.web : v.bsb);
const norm = (s: string): string => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** Look a verse up by reference, forgiving about case, punctuation and "Psalms". "john 3 16", "John 3:16" and "Jn" style full names all work. */
export function findVerse(ref: string): VerseRecord | undefined {
  const q = norm(ref).replace(/^psalms\b/, 'psalm').replace(/ verse /, ' ');
  return VERSES.find(v => norm(v.ref) === q);
}

export interface VerseQuery { query?: string; theme?: VerseTheme | 'all'; translation?: Translation }
const searchable = (v: VerseRecord, t: Translation): Searchable => ({ id: v.ref, title: v.ref, text: textOf(v, t), tags: [v.theme, THEME_LABELS[v.theme]] });
/** Search by reference ("john 3 16"), a word in the verse, a theme, or an everyday need ("scared", "can't sleep"). Best match first; with no query, library order. */
export function searchVersesRanked({ query = '', theme = 'all', translation = 'KJV' }: VerseQuery = {}): Array<Ranked<VerseRecord>> {
  const pool = theme === 'all' ? VERSES : VERSES.filter(v => v.theme === theme);
  const byId = new Map(pool.map(v => [v.ref, v]));
  return rank(pool.map(v => searchable(v, translation)), query).map(r => ({ item: byId.get(r.item.id)!, score: r.score, hits: r.hits }));
}
export const searchVerses = (q: VerseQuery = {}): VerseRecord[] => searchVersesRanked(q).map(r => r.item);

export const pickVerse = (v: VerseRecord, t: Translation): PickedVerse => ({ ref: v.ref, translation: t, text: textOf(v, t), source: 'library' });

/** A verse the customer typed (any translation). It is theirs: shown as typed, labelled "your text", with no accuracy claim. */
export function typedVerse(text: string, ref = 'Scripture'): PickedVerse {
  const clean = text.replace(/\s+/g, ' ').trim().slice(0, MAX_TYPED_VERSE);
  return { ref: ref.trim().slice(0, 40) || 'Scripture', translation: 'custom', text: clean, source: 'typed' };
}

/** "Psalm 23:1" read aloud. */
export const spokenRef = (ref: string): string => ref.replace(/(\d+):(\d+)/, '$1 verse $2');

export interface Composed { line: string; /** the whole verse is spoken (it fit the clip) */ readsVerse: boolean; verseWords: number; budget: number }

/**
 * What the guest says. If the verse fits the clip it is spoken word for word ("Psalm 23 verse 1 says: ..."), then as much of the reflection as fits.
 * If it does not fit, the guest names the reference and gives the reflection, and the exact verse is shown on screen: a spoken verse is never cut short.
 */
export function composeSpokenLine(verse: PickedVerse | undefined, reflection: string, budgetWords: number): Composed {
  const refl = reflection.trim();
  if (!verse?.text) return { line: fitWords(refl, budgetWords), readsVerse: false, verseWords: 0, budget: budgetWords };
  const intro = `${spokenRef(verse.ref)} says:`;
  const verseWords = words(verse.text);
  const used = words(intro) + verseWords;
  if (used <= budgetWords) {
    const left = budgetWords - used;
    const extra = refl && left >= 4 ? ` ${fitWords(refl, left)}` : '';
    return { line: `${intro} ${verse.text}${extra}`, readsVerse: true, verseWords, budget: budgetWords };
  }
  const head = `${spokenRef(verse.ref)}.`;
  const left = Math.max(0, budgetWords - words(head));
  return { line: refl && left >= 3 ? `${head} ${fitWords(refl, left)}` : head, readsVerse: false, verseWords, budget: budgetWords };
}
