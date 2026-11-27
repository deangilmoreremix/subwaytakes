import { describe, expect, it, vi } from 'vitest';
vi.mock('../supabase', () => ({ supabase: {} }));
import { expandQuery, highlight, norm, rank, SYNONYMS, type Searchable } from './rank';
import { allVerses, searchVerses, searchVersesRanked, TRANSLATIONS } from '../bible';
import { QUOTES, allQuotes, attribution, composeQuoteLine, findQuote, pickQuote, searchQuotes, searchQuotesRanked, QUOTE_THEMES } from '../quotes';
import { checkText } from '../safety';
import { recomposeBible, quoteComposition } from '../bible/spec';
import { DEFAULT_TAKE, buildNativePrompt, guestWordBudget, spokenLines } from '../interview';
import { applyShow, titleFor } from '../shows';
import { CITIES, cardMicPhrase } from '../places';

const items: Searchable[] = [
  { id: 'a', title: 'Psalm 23:1', text: 'The LORD is my shepherd; I shall not want.', tags: ['peace'] },
  { id: 'b', title: 'Psalm 123:1', text: 'To you I lift up my eyes.', tags: ['hope'] },
  { id: 'c', title: 'Isaiah 41:10', text: 'Fear not, for I am with you; be not dismayed.', tags: ['courage'] },
];

describe('rank', () => {
  it('returns everything in order for an empty query', () => { expect(rank(items, '').map(r => r.item.id)).toEqual(['a', 'b', 'c']); expect(rank(items, '  ').length).toBe(3); });
  it('matches the start of words as you type, ignoring case, accents and punctuation', () => { expect(rank(items, 'SHEPH').map(r => r.item.id)).toEqual(['a']); expect(norm('  Crème—Brûlée!! ')).toBe('creme brulee'); });
  it('a reference matches as a whole and does not match inside another number', () => {
    expect(rank(items, 'psalm 23').map(r => r.item.id)).toEqual(['a']); expect(rank(items, 'psalm 23:1')[0].item.id).toBe('a'); expect(rank(items, 'psalm 24').length).toBe(0); expect(rank(items, 'Psalm 123 1')[0].item.id).toBe('b');
  });
  it('every word must match (AND), and tags count', () => { expect(rank(items, 'shepherd want').length).toBe(1); expect(rank(items, 'shepherd dismayed').length).toBe(0); expect(rank(items, 'courage')[0].item.id).toBe('c'); });
  it('understands everyday intent through related words, ranked below direct matches', () => {
    expect(rank(items, "I'm scared")[0].item.id).toBe('c');
    const q = rank([{ id: 'x', title: 'T', text: 'a fearful night', tags: [] }, { id: 'y', title: 'T2', text: 'scared stiff', tags: [] }], 'scared'); expect(q[0].item.id).toBe('y'); expect(q.length).toBe(2);
  });
  it('ignores filler words but keeps a single stop word', () => { expect(expandQuery("what is the verse about fear").length).toBe(1); expect(expandQuery('the').length).toBe(1); });
  it('two-word phrases use the combined synonym key', () => { expect(Object.keys(SYNONYMS)).toContain('giveup'); const g = expandQuery('give up'); expect(g.length).toBe(1); expect(g[0].some(x => x.term === 'persevere')).toBe(true); });
  it('highlights matched words and word starts only', () => {
    const h = highlight('Fear not, for I am with you', ['fear']); expect(h.filter(p => p.match).map(p => p.t)).toEqual(['Fear']); expect(highlight('plain', []).length).toBe(1);
  });
  it('is fast on the whole library', () => { const t = Date.now(); for (let i = 0; i < 50; i++) { searchVerses({ query: 'strength and peace' }); searchQuotes({ query: 'dreams' }); } expect(Date.now() - t).toBeLessThan(2000); });
});

describe('verse search finds what people look for', () => {
  const top = (query: string, n = 5) => searchVersesRanked({ query }).slice(0, n).map(r => r.item.ref);
  it('by reference in any typing style', () => { for (const q of ['John 3:16', 'john 3 16', 'JOHN 3:16']) expect(top(q, 1)).toEqual(['John 3:16']); expect(top('Psalm 23').every(r => r.startsWith('Psalm 23'))).toBe(true); });
  it('by a word, in every translation', () => { for (const t of TRANSLATIONS) expect(searchVersesRanked({ query: 'peace', translation: t }).length, t).toBeGreaterThan(3); });
  it('by what a person is going through', () => {
    for (const q of ['scared', 'worried', 'tired', 'sad', 'lonely', 'angry', 'forgive me', 'new beginnings', 'give up', 'stuck', 'thankful', 'marriage', 'protect me', 'morning']) expect(searchVerses({ query: q }).length, q).toBeGreaterThan(0);
  });
  it('a theme filter and a query combine', () => { const r = searchVerses({ query: 'God', theme: 'peace' }); expect(r.length).toBeGreaterThan(0); expect(r.every(v => v.theme === 'peace')).toBe(true); });
  it('nonsense finds nothing', () => { expect(searchVerses({ query: 'zzzzqqqq' })).toEqual([]); });
  it('every verse can be found by its own reference', () => { for (const v of allVerses().slice(0, 60)) expect(searchVerses({ query: v.ref })[0]?.ref, v.ref).toBe(v.ref); });
});

describe('quote library', () => {
  it('has real, attributed quotes with sources and no duplicates', () => {
    expect(QUOTES.length).toBeGreaterThanOrEqual(70); expect(new Set(QUOTES.map(q => q.id)).size).toBe(QUOTES.length); expect(new Set(QUOTES.map(q => q.text)).size).toBe(QUOTES.length);
    for (const q of QUOTES) { expect(q.author, q.id).toBeTruthy(); expect(q.work, q.id).toBeTruthy(); expect(q.gutenberg, q.id).toBeGreaterThan(0); expect(q.text.length, q.id).toBeGreaterThanOrEqual(25); expect(q.text.length, q.id).toBeLessThanOrEqual(260); expect(QUOTE_THEMES).toContain(q.theme); }
  });
  it('quotes read as clean sentences: start with a capital, end with punctuation, no markup, no one else quoted', () => {
    for (const q of QUOTES) { expect(q.text, q.id).toMatch(/^[A-Z]/); expect(q.text, q.id).toMatch(/[.!]$/); expect(q.text, q.id).not.toMatch(/[<>{}_[\]]|[“”]/); expect(q.text, q.id).not.toMatch(/\b(?:said|says|wrote|maxim|proverb)\b/i); }
  });
  it('quotes carry no stray quote marks, speaker labels or stage directions, and no text is a longer or shorter copy of another', () => {
    for (const q of QUOTES) { expect(q.text, q.id).not.toMatch(/['\u2018\u2019]$|^['\u2018]|[()]|^[A-Z]{3,}\b/); }
    for (const a of QUOTES) for (const b of QUOTES) if (a !== b) expect(b.text.includes(a.text), `${a.id} inside ${b.id}`).toBe(false);
  });
  it('every theme has at least 5 quotes and the library has many voices', () => {
    for (const t of QUOTE_THEMES) expect(QUOTES.filter(q => q.theme === t).length, t).toBeGreaterThanOrEqual(5);
    expect(new Set(QUOTES.map(q => q.author)).size).toBeGreaterThanOrEqual(10);
    const per: Record<string, number> = {}; for (const q of QUOTES) per[q.author] = (per[q.author] ?? 0) + 1; expect(Math.max(...Object.values(per))).toBeLessThanOrEqual(22);
  });
  it('books with plays or sayings are cleaned (no "The Master said", no speaker labels) and known lines are exact', () => {
    const has = (s: string) => QUOTES.some(q => q.text === s);
    expect(has('The journey of a thousand li commenced with a single step.')).toBe(true);
    expect(has('He who has conquered doubt and fear has conquered failure.')).toBe(true); expect(has('He who fights with monsters should be careful lest he thereby become a monster.')).toBe(true); expect(has('Learning without thought is labour lost; thought without learning is perilous.')).toBe(true);
    for (const q of QUOTES) expect(q.text, q.id).not.toMatch(/^The Master|^(?:LORD|LADY|MRS|MR)\b/);
  });
  it('no quote is a character\'s speech: nothing from plays, novels, dialogue or the Prophet / Zarathustra / Teufelsdroeckh', () => {
    const banned = [790, 844, 885, 174, 1998, 1051, 58585, 1497, 46, 98, 1400]; for (const q of QUOTES) expect(banned, q.id).not.toContain(q.gutenberg);
    for (const q of QUOTES) expect(q.text, q.id).not.toMatch(/\bDarlington\b|\bAlgernon\b|\bLord Henry\b|\bZarathustra\b|\bTeufelsdr/);
  });
  it('is only from authors who died long ago (public domain)', () => { const ok = new Set(['Marcus Aurelius', 'Epictetus', 'James Allen', 'Ralph Waldo Emerson', 'Henry David Thoreau', 'Samuel Smiles', 'Benjamin Franklin', 'Mark Twain', 'William James', 'Friedrich Nietzsche', 'Confucius', 'Lao Tzu', 'Booker T. Washington', 'Thomas Carlyle']); for (const q of QUOTES) expect(ok.has(q.author), q.author).toBe(true); });
  it('known lines are exact (hand-written here, not copied from the library)', () => {
    const has = (s: string) => QUOTES.some(q => q.text === s);
    expect(has('Nothing great was ever achieved without enthusiasm.')).toBe(true); expect(has('To be great is to be misunderstood.')).toBe(true); expect(has('Dream lofty dreams, and as you dream, so shall you become.')).toBe(true); expect(has('Time is but the stream I go a-fishing in.')).toBe(true);
  });
  it('no quote trips the content screen, with or without its author line', () => { for (const q of QUOTES) { expect(checkText(q.text).ok, q.id).toBe(true); expect(checkText(`${q.author} wrote: ${q.text}`).ok, q.id).toBe(true); } });
  it('is searchable by author, work, word, theme and intent', () => {
    expect(searchQuotes({ query: 'Emerson' }).every(q => q.author.includes('Emerson'))).toBe(true); expect(searchQuotes({ query: 'Walden' }).length).toBeGreaterThan(3);
    for (const q of ['dreams', 'calm', 'courage', 'I want to quit', 'focus', 'work', 'failure', 'Twain', 'Confucius', 'habit', 'truth', 'fear']) expect(searchQuotes({ query: q }).length, q).toBeGreaterThan(0);
    expect(searchQuotes({ query: 'zzzzqqqq' })).toEqual([]); expect(searchQuotesRanked({ query: 'enthusiasm' })[0].item.text).toContain('enthusiasm');
    for (const t of QUOTE_THEMES) expect(searchQuotes({ theme: t }).length, t).toBeGreaterThan(0);
  });
  it('findQuote and attribution', () => { const q = allQuotes()[0]; expect(findQuote(q.id)).toBe(q); expect(attribution(q)).toBe(`${q.author}, ${q.work}`); expect(findQuote('nope')).toBeUndefined(); });
});

describe('sharing a quote on screen and aloud', () => {
  const short = pickQuote(QUOTES.find(q => q.text === 'To be great is to be misunderstood.')!);
  const long = pickQuote(QUOTES.reduce((a, b) => (b.text.length > a.text.length ? b : a)));
  it('speaks the whole quote when it fits, then the comment', () => {
    const c = composeQuoteLine(short, 'That helps me when people doubt me at work.', 40);
    expect(c.readsQuote).toBe(true); expect(c.line.startsWith('Ralph Waldo Emerson wrote: To be great is to be misunderstood.')).toBe(true); expect(c.line).toContain('doubt me'); expect(c.line.split(/\s+/).length).toBeLessThanOrEqual(40);
  });
  it('never cuts a quote short', () => { const c = composeQuoteLine(long, 'It keeps me going.', 12); expect(c.readsQuote).toBe(false); expect(c.line).not.toContain(long.text.split(' ').slice(0, 6).join(' ')); expect(c.line.split(/\s+/).length).toBeLessThanOrEqual(12); });
  it('works with no quote and an empty comment', () => { expect(composeQuoteLine(undefined, 'Own words here.', 10).line).toBe('Own words here.'); expect(composeQuoteLine(short, '', 40).line).toBe('Ralph Waldo Emerson wrote: To be great is to be misunderstood.'); });
  it('Motivation with a quote composes the spoken line to fit the clip; without one it is untouched', () => {
    const base = { ...applyShow(DEFAULT_TAKE, 'motivation'), durationSeconds: 12 };
    const s = recomposeBible({ ...base, quote: short, reflection: 'It helps me when people doubt me, and I keep going anyway because it is true.' });
    expect(s.take.split(/\s+/).length).toBeLessThanOrEqual(guestWordBudget(s)); expect(spokenLines(s).trimmed).toBe(false); expect(quoteComposition(s).readsQuote).toBe(true);
    expect(recomposeBible(base)).toBe(base);
  });
  it('the on-screen card carries the exact quote and its author and work', () => { const d = titleFor({ show: 'motivation', take: 'spoken', quote: short }); expect(d.variant).toBe('quote'); expect(d.headline).toBe(short.text); expect(d.value).toBe('Ralph Waldo Emerson, Essays: First Series'); expect(titleFor({ show: 'motivation', take: 'Own advice' }).variant).toBe('take'); });
  it('leaving Motivation drops the quote and the composed line', () => {
    const s = recomposeBible({ ...applyShow(DEFAULT_TAKE, 'motivation'), durationSeconds: 15, quote: short, reflection: 'Comment A' }); expect(s.take).toContain('wrote:');
    const hot = applyShow(s, 'hot_take'); expect(hot.quote).toBeUndefined(); expect(hot.take).not.toContain('wrote:');
  });
  it('prompts with a quote pass the screen in every city and keep each city\'s own card', () => {
    for (const city of CITIES) { const spec = recomposeBible({ ...applyShow(DEFAULT_TAKE, 'motivation'), durationSeconds: 15, place: { ...DEFAULT_TAKE.place, city: city.id }, quote: short, reflection: 'It helps.' }); const p = buildNativePrompt(spec); expect(checkText(p).ok, city.id).toBe(true); expect(p).toContain(cardMicPhrase(city.id)); if (city.id !== 'nyc') expect(p).not.toContain('MetroCard'); }
  });
});

describe('search ranking details', () => {
  it('a direct word match beats a related word, and only visible words are highlighted', () => {
    const r = searchQuotesRanked({ query: 'dreams' })[0]; expect(r.item.text).toContain('dreams'); expect(r.hits).toEqual(['dreams']);
    const v = searchVersesRanked({ query: 'fear' }); expect(v[0].hits.length).toBeGreaterThan(0);
  });
});

describe('search never trips on words that exist on every JavaScript object', () => {
  it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf', 'prototype', 'constructor strength'])('"%s" is just a word with no results or ordinary results', q => {
    expect(() => searchVersesRanked({ query: q })).not.toThrow(); expect(() => searchQuotesRanked({ query: q })).not.toThrow(); expect(() => expandQuery(q)).not.toThrow();
  });
});
