import { QUOTES, type QuoteRecord, type QuoteTheme } from './quotes.generated';
import { fitWords, wordCount } from '../compose';
import type { PickedQuote } from './types';
import { rank, type Ranked, type Searchable } from '../search/rank';

// The quote library: sentences found word for word in public-domain books (see quotes.generated.ts for how). A quote always carries its author and work.
// RULE: quotes come ONLY from this library. Never from a model or a quote website (they are full of misattributions), never reworded.

export type { QuoteRecord, QuoteTheme } from './quotes.generated';
export { QUOTES };
export const QUOTE_THEME_LABELS: Record<QuoteTheme, string> = { mindset: 'Mindset', discipline: 'Discipline', courage: 'Courage', perseverance: 'Perseverance', action: 'Action', calm: 'Calm', purpose: 'Purpose', growth: 'Growth' };
export const QUOTE_THEMES = Object.keys(QUOTE_THEME_LABELS) as QuoteTheme[];
export const allQuotes = (): readonly QuoteRecord[] => QUOTES;

export type { PickedQuote } from './types';
export const pickQuote = (q: QuoteRecord): PickedQuote => ({ id: q.id, text: q.text, author: q.author, work: q.work });
export const attribution = (q: Pick<PickedQuote, 'author' | 'work'>): string => `${q.author}, ${q.work}`;
export const findQuote = (id: string): QuoteRecord | undefined => QUOTES.find(q => q.id === id);

export interface QuoteQuery { query?: string; theme?: QuoteTheme | 'all' }
const searchable = (q: QuoteRecord): Searchable => ({ id: q.id, title: `${q.author} ${q.work}`, text: q.text, tags: [q.theme, QUOTE_THEME_LABELS[q.theme]] });
/** Search by author, book, a word in the quote, a theme, or an everyday need ("I want to quit", "scared"). Best match first. */
export function searchQuotesRanked({ query = '', theme = 'all' }: QuoteQuery = {}): Array<Ranked<QuoteRecord>> {
  const pool = theme === 'all' ? QUOTES : QUOTES.filter(q => q.theme === theme);
  const byId = new Map(pool.map(q => [q.id, q]));
  return rank(pool.map(searchable), query).map(r => ({ item: byId.get(r.item.id)!, score: r.score, hits: r.hits }));
}
export const searchQuotes = (q: QuoteQuery = {}): QuoteRecord[] => searchQuotesRanked(q).map(r => r.item);

export interface ComposedQuote { line: string; /** the whole quote is spoken */ readsQuote: boolean; quoteWords: number; budget: number }
/**
 * What the guest says when they share a quote: "<Author> wrote: <quote>" if the whole quote fits the clip, then as much of their own comment as fits.
 * A quote that does not fit is never cut short: the guest names the author and comments, and the exact quote is on screen.
 */
export function composeQuoteLine(quote: PickedQuote | undefined, comment: string, budgetWords: number): ComposedQuote {
  const c = comment.trim();
  if (!quote?.text) return { line: fitWords(c, budgetWords), readsQuote: false, quoteWords: 0, budget: budgetWords };
  const intro = `${quote.author} wrote:`;
  const quoteWords = wordCount(quote.text); const used = wordCount(intro) + quoteWords;
  if (used <= budgetWords) { const left = budgetWords - used; return { line: `${intro} ${quote.text}${c && left >= 4 ? ' ' + fitWords(c, left) : ''}`, readsQuote: true, quoteWords, budget: budgetWords }; }
  const head = `${quote.author} said it best.`; const left = Math.max(0, budgetWords - wordCount(head));
  return { line: c && left >= 3 ? `${head} ${fitWords(c, left)}` : head, readsQuote: false, quoteWords, budget: budgetWords };
}
