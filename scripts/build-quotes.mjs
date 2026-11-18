// Builds src/lib/quotes/quotes.generated.ts: motivational quotes from PUBLIC-DOMAIN books, each one found VERBATIM in the book's Project Gutenberg text.
// A person (or a model) may only supply a rough HINT of what a passage says. The text that ships is always the sentence(s) found in the book, so wording is never
// from memory, a hint that matches nothing is dropped, and every quote carries its author, work and Gutenberg id.
// Why not a quotes API or dataset: they are full of misattributed and reworded quotes. This library only has what a book actually says.
// Usage: QUOTE_DATA=<folder with g<ID>.txt files from gutenberg.org> node scripts/build-quotes.mjs   (see README for the download command)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DATA = process.env.QUOTE_DATA; if (!DATA) { console.error('Set QUOTE_DATA to the folder holding the Gutenberg text files (g2680.txt, ...).'); process.exit(1); }

// id = Project Gutenberg ebook number. year = first publication (all authors died before 1930 and all translations are public domain).
const WORKS = {
  2680: { author: 'Marcus Aurelius', work: 'Meditations', note: 'trans. Meric Casaubon, 1634', year: '2nd c.' },
  10661: { author: 'Epictetus', work: 'Discourses and Enchiridion', note: 'trans. George Long, 1877', year: '2nd c.' },
  4507: { author: 'James Allen', work: 'As a Man Thinketh', note: '', year: '1903' },
  2944: { author: 'Ralph Waldo Emerson', work: 'Essays: First Series', note: '', year: '1841' },
  205: { author: 'Henry David Thoreau', work: 'Walden', note: '', year: '1854' },
  935: { author: 'Samuel Smiles', work: 'Self-Help', note: '', year: '1859' },
  148: { author: 'Benjamin Franklin', work: 'The Autobiography of Benjamin Franklin', note: '', year: '1791' },
};
const THEMES = ['mindset', 'discipline', 'courage', 'perseverance', 'action', 'calm', 'purpose', 'growth'];

// [work id, theme, rough hint]. The hint only has to share most of its key words with the real sentence.
const HINTS = [
  [2680, 'mindset', 'Such as are thy habitual thoughts, such also will be the character of thy mind; for the soul is dyed by the thoughts'],
  [2680, 'discipline', 'If it is not right do not do it; if it is not true do not say it'],
  [2680, 'mindset', 'The best way of avenging thyself is not to become like the wrong doer'],
  [2680, 'action', 'The impediment to action advances action. What stands in the way becomes the way'],
  [2680, 'calm', 'Remember that very little is needed to make a happy life'],
  [2680, 'calm', 'Take away thy opinion, and then there is taken away the complaint, I have been harmed'],
  [2680, 'purpose', 'It is not death that a man should fear, but he should fear never beginning to live'],
  [2680, 'calm', 'Confine thyself to the present'],
  [2680, 'mindset', 'Look within. Within is the fountain of good, and it will ever bubble up, if thou wilt ever dig'],
  [2680, 'discipline', 'Do not act as if thou wert going to live ten thousand years'],
  [2680, 'courage', 'Be like the promontory against which the waves continually break, but it stands firm'],
  [2680, 'action', 'Let every deed and word and thought be those of a man who could depart from life this moment'],
  [2680, 'growth', 'Waste no more time arguing about what a good man should be. Be one'],
  [2680, 'mindset', 'Thou hast power over thy mind, not outside events'],
  [2680, 'perseverance', 'What is the use of the shame of failing when you can try again'],
  [10661, 'mindset', 'Men are disturbed, not by things, but by the principles and notions which they form concerning things'],
  [10661, 'purpose', 'First say to yourself what you would be; and then do what you have to do'],
  [10661, 'calm', 'Wealth consists not in having great possessions, but in having few wants'],
  [10661, 'discipline', 'No man is free who is not master of himself'],
  [10661, 'growth', 'If you wish to be a writer, write; if you want to improve, practise'],
  [10661, 'action', 'Every habit and faculty is preserved and increased by correspondent actions'],
  [4507, 'mindset', 'A man is literally what he thinks'],
  [4507, 'mindset', 'Circumstance does not make the man, it reveals him to himself'],
  [4507, 'purpose', 'Dream lofty dreams, and as you dream, so shall you become'],
  [4507, 'purpose', 'He who cherishes a beautiful vision, a lofty ideal in his heart, will one day realise it'],
  [4507, 'growth', 'Men are anxious to improve their circumstances, but are unwilling to improve themselves'],
  [4507, 'mindset', 'All that a man achieves and all that he fails to achieve is the direct result of his own thoughts'],
  [4507, 'purpose', 'Cherish your visions. Cherish your ideals. Cherish the music that stirs in your heart'],
  [4507, 'calm', 'Calmness of mind is one of the beautiful jewels of wisdom'],
  [4507, 'discipline', 'The strong man is the calm man'],
  [4507, 'courage', 'Those who have no central purpose in their life fall an easy prey to petty worries, fears, troubles'],
  [4507, 'perseverance', 'He who would accomplish little must sacrifice little; he who would achieve much must sacrifice much'],
  [2944, 'courage', 'Trust thyself: every heart vibrates to that iron string'],
  [2944, 'courage', 'Whoso would be a man must be a nonconformist'],
  [2944, 'calm', 'Nothing can bring you peace but yourself'],
  [2944, 'action', 'Nothing great was ever achieved without enthusiasm'],
  [2944, 'courage', 'To be great is to be misunderstood'],
  [2944, 'mindset', 'A foolish consistency is the hobgoblin of little minds'],
  [2944, 'action', 'Do the thing and you shall have the power'],
  [2944, 'growth', 'Insist on yourself; never imitate'],
  [2944, 'mindset', 'The only way to have a friend is to be one'],
  [2944, 'courage', 'What I must do is all that concerns me, not what the people think'],
  [2944, 'purpose', 'Every man is a divinity in disguise'],
  [2944, 'perseverance', 'The one prudence in life is concentration'],
  [205, 'purpose', 'If one advances confidently in the direction of his dreams, and endeavors to live the life which he has imagined, he will meet with a success unexpected in common hours'],
  [205, 'mindset', 'The mass of men lead lives of quiet desperation'],
  [205, 'mindset', 'The question is not what you look at, but what you see'],
  [205, 'purpose', 'How many a man has dated a new era in his life from the reading of a book'],
  [205, 'action', 'Every morning was a cheerful invitation to make my life of equal simplicity'],
  [205, 'purpose', 'I went to the woods because I wished to live deliberately'],
  [205, 'growth', 'Our life is frittered away by detail. Simplify, simplify'],
  [205, 'calm', 'Time is but the stream I go a-fishing in'],
  [205, 'courage', 'I know of no more encouraging fact than the unquestionable ability of man to elevate his life by a conscious endeavor'],
  [935, 'action', 'Heaven helps those who help themselves'],
  [935, 'perseverance', 'The spirit of self-help is the root of all genuine growth in the individual'],
  [935, 'growth', 'We learn wisdom from failure much more than from success'],
  [935, 'discipline', 'Energy of will is the very central power of character in a man'],
  [935, 'perseverance', 'Perseverance is one of the foundations of character'],
  [935, 'discipline', 'The shortest way to do many things is to do only one thing at a time'],
  [935, 'action', 'It is not by accident that men succeed, but by the improvement of their time'],
  [935, 'growth', 'Cheerfulness is an excellent wearing quality'],
  [935, 'perseverance', 'Patient labour will do more than genius'],
  [2680, 'mindset', 'Let opinion be taken away, and no man will think himself wronged'],
  [2680, 'mindset', 'The best kind of revenge is, not to become like unto them'],
  [2680, 'mindset', 'Look within; within is the fountain of all good'],
  [10661, 'mindset', 'Men are disturbed not by the things which happen, but by the opinions about the things'],
  [10661, 'discipline', 'Every habit and faculty is maintained and increased by the corresponding actions'],
  [4507, 'mindset', 'Good thoughts and actions can never produce bad results; bad thoughts and actions can never produce good results'],
  [4507, 'purpose', 'You will become as small as your controlling desire; as great as your dominant aspiration'],
  [4507, 'purpose', 'The vision that you glorify in your mind, the ideal that you enthrone in your heart, this you will build your life by, and this you will become'],
  [4507, 'discipline', 'Self-control is strength. Right thought is mastery. Calmness is power'],
  [4507, 'growth', 'Thought and character are one'],
  [4507, 'calm', 'Calmness of mind is one of the beautiful jewels of wisdom'],
  [2944, 'action', 'The law of nature is, Do the thing, and you shall have the power'],
  [2944, 'courage', 'Nothing is at last sacred but the integrity of your own mind'],
  [2944, 'courage', 'Society everywhere is in conspiracy against the manhood of every one of its members'],
  [2944, 'growth', 'Our strength grows out of our weakness'],
  [2944, 'mindset', 'The reward of a thing well done is to have done it'],
  [2944, 'growth', 'Make yourself necessary to somebody'],
  [2944, 'courage', 'Always do what you are afraid to do'],
  [2944, 'purpose', 'Let me never forget that a man is only what he thinks'],
  [205, 'mindset', 'Things do not change; we change'],
  [205, 'calm', 'I have never found the companion that was so companionable as solitude'],
  [205, 'courage', 'However mean your life is, meet it and live it; do not shun it and call it hard names'],
  [205, 'purpose', 'I wanted to live deep and suck out all the marrow of life'],
  [205, 'action', 'The cost of a thing is the amount of what I will call life which is required to be exchanged for it'],
  [205, 'purpose', 'Rather than love, than money, than fame, give me truth'],
  [205, 'growth', 'Be not simply good; be good for something'],
  [205, 'purpose', 'Live free, child of the mist'],
  [935, 'perseverance', 'Whatever is worth doing at all is worth doing well'],
  [935, 'growth', 'The man who is determined to be a better man will be one'],
  [935, 'discipline', 'Wealth does not make the man; character does'],
  [935, 'perseverance', 'Difficulties act as a bracing tonic'],
  [935, 'growth', 'Resolution is the great thing'],
  [935, 'action', 'No man is useless while he has a friend'],
  [148, 'discipline', 'Lose no time; be always employed in something useful'],
  [148, 'growth', 'I made a little book in which I allotted a page for each of the virtues'],
  [148, 'discipline', 'Order. Let all your things have their places; let each part of your business have its time'],
];

// ---- text handling --------------------------------------------------------------------------------------------------
const cleanBook = raw => {
  let t = raw.replace(/\r/g, ''); const s = t.search(/\*\*\* ?START OF (?:THE|THIS) PROJECT GUTENBERG[^\n]*\n/i); if (s >= 0) t = t.slice(t.indexOf('\n', s) + 1);
  const e = t.search(/\*\*\* ?END OF (?:THE|THIS) PROJECT GUTENBERG/i); if (e >= 0) t = t.slice(0, e);
  return t;
};
const tidy = s => s.replace(/_/g, '').replace(/\s+/g, ' ').replace(/\[[^\]]*\]/g, '').replace(/\s+([,.;:!?])/g, '$1').trim();
const sentencesOf = text => {
  const paras = text.split(/\n\s*\n/).map(p => tidy(p)).filter(p => p.length > 20);
  const out = [];
  for (const p of paras) { const parts = p.match(/[^.!?]+(?:[.!?]+["”’']?|$)/g) ?? [p]; parts.forEach((x, i) => { const s = tidy(x); if (s.length > 15) out.push({ s, para: p, i }); }); }
  return out;
};
const STOP = new Set('a an and the of to in is it that this be as for with on at by or if are was not no but so from his her he she they them we you your thy thee thou which who what when than then there their its our us do does did have has had will shall would should can could may might one all any'.split(' '));
const words = s => s.toLowerCase().replace(/[^a-z0-9\s']/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w));
// how much of the hint's key words the passage contains (0 to 1)
const sim = (hint, cand) => { const H = new Set(hint), C = new Set(cand); if (!H.size || !C.size) return 0; let i = 0; for (const x of H) if (C.has(x)) i++; return i / H.size; };

const books = {};
for (const id of Object.keys(WORKS)) { const f = join(DATA, `g${id}.txt`); if (!existsSync(f)) { console.error('missing', f); process.exit(1); } books[id] = sentencesOf(cleanBook(readFileSync(f, 'utf8'))); }

const quotes = []; const dropped = [];
for (const [id, theme, hint] of HINTS) {
  const hw = words(hint); const sents = books[id];
  let best = null;
  // try single sentences, sentence pairs within a paragraph, and the ';' clauses of a long sentence (a hint can be a part of a sentence)
  const consider = (text, penaltySpan) => {
    const w = words(text); const ratio = w.length / Math.max(1, hw.length);
    const sc = sim(hw, w) - Math.max(0, ratio - 1.8) * 0.12 - penaltySpan;
    if (!best || sc > best.sc) best = { sc, text };
  };
  for (let k = 0; k < sents.length; k++) for (const span of [1, 2]) {
    const parts = sents.slice(k, k + span); if (parts.length < span || parts.some(p => p.para !== parts[0].para)) continue;
    const text = parts.map(p => p.s).join(' '); consider(text, span === 2 ? 0.04 : 0);
    if (span === 1 && text.includes(';')) for (const clause of text.split(/;\s*/)) { const c = clause.trim().replace(/[.,:]+$/, ''); if (c.length > 25) consider(/[.!?]$/.test(c) ? c : c + '.', 0.03); }
  }
  if (!best || best.sc < 0.68) { dropped.push({ id, hint, why: `no passage close enough (best ${best ? best.sc.toFixed(2) : '0'})`, got: best?.text?.slice(0, 120) }); continue; }
  let text = best.text.replace(/^[—–-]+\s*/, '').trim();
  // unbalanced curly quotes at the edges come from cutting a passage out of a longer one: drop them
  if ((text.match(/“/g) ?? []).length !== (text.match(/”/g) ?? []).length) text = text.replace(/^[“]+/, '').replace(/[”]+$/, '').trim();
  // some editions print the first word in capitals ("CALMNESS of mind..."): sentence case it
  text = text.replace(/^([A-Z]{2,})(\b)/, (_, w) => w[0] + w.slice(1).toLowerCase());
  if (text.length < 25 || text.length > 260) { dropped.push({ id, hint, why: `length ${text.length}`, got: text.slice(0, 120) }); continue; }
  if (/\b(?:chapter|section|vol\.|page)\b|\d{2,}/i.test(text)) { dropped.push({ id, hint, why: 'looks like a heading or footnote', got: text.slice(0, 120) }); continue; }
  // reject: fragments, questions, other people's words quoted by the author (it would be misattributed), and pieces that quote or report someone
  const why = /^(?:Hence|Thus|But|And|So|Therefore|Yet|Still|For|Nor|Then|Also)\b/.test(text) ? 'continues a previous sentence' : !/^[A-Z“]/.test(text) ? 'starts mid-sentence' : /\?$/.test(text) ? 'is a question' : /[“”]|\b(?:said|says|saying|remarked|observed|wrote|maxim|proverb|called|according to|quoted?|replied)\b/i.test(text) ? 'quotes or reports someone else' : /^[a-z]/.test(text) ? 'starts lower case' : '';
  if (why) { dropped.push({ id, hint, why, got: text.slice(0, 120) }); continue; }
  if (quotes.some(q => q.text === text)) continue;
  quotes.push({ id: `${id}-${quotes.length + 1}`, text, author: WORKS[id].author, work: WORKS[id].work, note: WORKS[id].note, year: WORKS[id].year, gutenberg: Number(id), theme, score: Number(best.sc.toFixed(2)) });
}
console.log(`${quotes.length} quotes found, ${dropped.length} dropped`);
for (const d of dropped) console.log(` - dropped [${WORKS[d.id].author}] "${d.hint.slice(0, 70)}" : ${d.why}${d.got ? ' | nearest: ' + d.got : ''}`);
console.log('\nMatched (check each reads as a good, whole quote):');
for (const q of quotes) console.log(` ${q.score} [${q.author}] ${q.text}`);

const header = `// GENERATED by scripts/build-quotes.mjs on ${new Date().toISOString().slice(0, 10)}. Do not edit by hand.
// Every quote is a sentence (or two) found VERBATIM in a public-domain book on Project Gutenberg (author died before 1930; translations are public domain).
// A rough hint was matched to the book's own text; the shipped wording is the book's, never a model's or a quote site's. Anything that did not match was dropped.
`;
const body = `export type QuoteTheme = ${THEMES.map(t => `'${t}'`).join(' | ')};
export interface QuoteRecord { id: string; text: string; author: string; work: string; /** translator or edition note */ note: string; year: string; gutenberg: number; theme: QuoteTheme }
export const QUOTES: QuoteRecord[] = ${JSON.stringify(quotes.map(({ score: _s, ...q }) => q), null, 1)};
`;
import { mkdirSync } from 'node:fs';
mkdirSync(new URL('../src/lib/quotes/', import.meta.url), { recursive: true });
writeFileSync(new URL('../src/lib/quotes/quotes.generated.ts', import.meta.url), header + body);
console.log(`Wrote src/lib/quotes/quotes.generated.ts (${quotes.length} quotes).`);
