// Builds src/lib/quotes/quotes.generated.ts: motivational quotes from PUBLIC-DOMAIN books, each one found VERBATIM in the book's Project Gutenberg text.
// A person (or a model) may only supply a rough HINT of what a passage says. The text that ships is always the sentence(s) found in the book, so wording is never
// from memory, a hint that matches nothing is dropped, and every quote carries its author, work and Gutenberg id.
// Why not a quotes API or dataset: they are full of misattributed and reworded quotes. This library only has what a book actually says.
// Usage: QUOTE_DATA=<folder with g<ID>.txt files from gutenberg.org> node scripts/build-quotes.mjs   (see README for the download command)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DATA = process.env.QUOTE_DATA; if (!DATA) { console.error('Set QUOTE_DATA to the folder holding the Gutenberg text files (g2680.txt, ...).'); process.exit(1); }

// id = Project Gutenberg ebook number. Every text here is public domain (published before 1929, or an old translation) and was checked by reading the ebook's own header.
// `aliases` are the author names used by the open quote lists (see DATASET below), so a list row is only ever matched against that author's own books.
const A = (author, aliases = [author]) => ({ author, aliases });
const WORKS = {
  2680: { ...A('Marcus Aurelius'), work: 'Meditations', note: 'trans. Meric Casaubon, 1634', year: '2nd c.' },
  10661: { ...A('Epictetus'), work: 'Discourses and Enchiridion', note: 'trans. George Long, 1877', year: '2nd c.' },
  4507: { ...A('James Allen'), work: 'As a Man Thinketh', note: '', year: '1903' },
  2944: { ...A('Ralph Waldo Emerson'), work: 'Essays: First Series', note: '', year: '1841' },
  16643: { ...A('Ralph Waldo Emerson'), work: 'Essays', note: '', year: '1844' },
  205: { ...A('Henry David Thoreau'), work: 'Walden', note: '', year: '1854' },
  935: { ...A('Samuel Smiles'), work: 'Self-Help', note: '', year: '1859' },
  148: { ...A('Benjamin Franklin'), work: 'The Autobiography of Benjamin Franklin', note: '', year: '1791' },
  102: { ...A('Mark Twain'), work: "Pudd'nhead Wilson", note: '', year: '1894' },
  3176: { ...A('Mark Twain'), work: 'The Innocents Abroad', note: '', year: '1869' },
  245: { ...A('Mark Twain'), work: 'Life on the Mississippi', note: '', year: '1883' },
  2895: { ...A('Mark Twain'), work: 'Following the Equator', note: '', year: '1897' },
  86: { ...A('Mark Twain'), work: "A Connecticut Yankee in King Arthur's Court", note: '', year: '1889' },
  174: { ...A('Oscar Wilde'), work: 'The Picture of Dorian Gray', note: '', year: '1890' },
  790: { ...A('Oscar Wilde'), work: "Lady Windermere's Fan", note: '', year: '1893' },
  844: { ...A('Oscar Wilde'), work: 'The Importance of Being Earnest', note: '', year: '1895' },
  885: { ...A('Oscar Wilde'), work: 'An Ideal Husband', note: '', year: '1895' },
  921: { ...A('Oscar Wilde'), work: 'De Profundis', note: '', year: '1905' },
  774: { ...A('Oscar Wilde'), work: 'Intentions', note: '', year: '1891' },
  46: { ...A('Charles Dickens'), work: 'A Christmas Carol', note: '', year: '1843' },
  98: { ...A('Charles Dickens'), work: 'A Tale of Two Cities', note: '', year: '1859' },
  1400: { ...A('Charles Dickens'), work: 'Great Expectations', note: '', year: '1861' },
  26659: { ...A('William James'), work: 'The Will to Believe', note: '', year: '1897' },
  16287: { ...A('William James'), work: 'Talks to Teachers on Psychology', note: '', year: '1899' },
  621: { ...A('William James'), work: 'The Varieties of Religious Experience', note: '', year: '1902' },
  5116: { ...A('William James'), work: 'Pragmatism', note: '', year: '1907' },
  1998: { ...A('Friedrich Nietzsche'), work: 'Thus Spake Zarathustra', note: 'trans. Thomas Common, 1909', year: '1883' },
  4363: { ...A('Friedrich Nietzsche'), work: 'Beyond Good and Evil', note: 'trans. Helen Zimmern, 1907', year: '1886' },
  132: { ...A('Sun Tzu'), work: 'The Art of War', note: 'trans. Lionel Giles, 1910', year: '5th c. BC' },
  3330: { ...A('Confucius'), work: 'The Analects', note: 'trans. James Legge', year: '5th c. BC' },
  216: { ...A('Lao Tzu', ['Lao Tzu', 'Laozi']), work: 'Tao Te Ching', note: 'trans. James Legge', year: '6th c. BC' },
  1497: { ...A('Plato'), work: 'The Republic', note: 'trans. Benjamin Jowett', year: '4th c. BC' },
  8438: { ...A('Aristotle'), work: 'Nicomachean Ethics', note: 'trans. D. P. Chase, 1847', year: '4th c. BC' },
  2376: { ...A('Booker T. Washington'), work: 'Up from Slavery', note: '', year: '1901' },
  23: { ...A('Frederick Douglass'), work: 'Narrative of the Life of Frederick Douglass', note: '', year: '1845' },
  1051: { ...A('Thomas Carlyle'), work: 'Sartor Resartus', note: '', year: '1836' },
  1091: { ...A('Thomas Carlyle'), work: 'On Heroes, Hero-Worship, and the Heroic in History', note: '', year: '1841' },
  1293: { ...A('John Ruskin'), work: 'Sesame and Lilies', note: '', year: '1865' },
  58585: { ...A('Kahlil Gibran', ['Khalil Gibran', 'Kahlil Gibran']), work: 'The Prophet', note: '', year: '1923' },
};
const AUTHOR_WORKS = new Map();   // dataset author name -> work ids
for (const [id, w] of Object.entries(WORKS)) for (const al of w.aliases) AUTHOR_WORKS.set(al, [...(AUTHOR_WORKS.get(al) ?? []), id]);
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

  // ---- more authors (each hint is verified against the book; one that matches nothing is dropped)
  [2376, 'courage', 'I resolved that I would permit no man to narrow and degrade my soul by making me hate him'],
  [2376, 'growth', 'There are two ways of exerting one\'s strength: one is pushing down, the other is pulling up'],
  [2376, 'mindset', 'Character, not circumstances, makes the man'],
  [2376, 'action', 'No man who continues to add something to the material, intellectual, and moral well-being of the place in which he lives is left long without proper reward'],
  [1051, 'action', 'Do the Duty which lies nearest thee, which thou knowest to be a Duty! Thy second Duty will already have become clearer'],
  [1051, 'action', 'Work while it is called To-day; for the Night cometh, wherein no man can work'],
  [1091, 'courage', 'The first duty for a man is still that of subduing Fear'],
  [[102, 2895], 'discipline', 'Habit is habit, and not to be flung out of the window by any man, but coaxed down-stairs a step at a time'],
  [[102, 2895], 'discipline', 'Do something every day that you do not want to do; this is the golden rule for acquiring the habit of doing your duty without pain'],
  [[102, 2895], 'mindset', 'Always do right. This will gratify some people, and astonish the rest'],
  [[102, 2895, 245], 'perseverance', 'Few things are impossible to diligence and skill'],
  [[174, 790, 844, 885, 921, 774], 'mindset', 'Nowadays people know the price of everything and the value of nothing'],
  [[174, 790, 844, 885, 921, 774], 'growth', 'Experience is merely the name men gave to their mistakes'],
  [[174, 790, 844, 885, 921, 774], 'purpose', 'We are all in the gutter, but some of us are looking at the stars'],
  [[174, 790, 844, 885, 921, 774], 'purpose', 'Ambition is the last refuge of the failure'],
  [[16287, 26659, 5116, 621], 'discipline', 'Habit is the enormous fly-wheel of society, its most precious conservative agent'],
  [[16287, 26659, 5116, 621], 'action', 'Nothing is so fatiguing as the eternal hanging on of an uncompleted task'],
  [[16287, 26659, 5116, 621], 'growth', 'The art of being wise is the art of knowing what to overlook'],
  [[16287, 26659, 5116, 621], 'mindset', 'The greatest discovery of my generation is that human beings can alter their lives by altering their attitudes of mind'],
  [[16287, 26659, 5116, 621], 'courage', 'Be not afraid of life'],
  [1998, 'purpose', 'One must still have chaos in oneself to be able to give birth to a dancing star'],
  [4363, 'courage', 'He who fights with monsters should be careful lest he thereby become a monster'],
  [3330, 'growth', 'Learning without thought is labour lost; thought without learning is perilous'],
  [3330, 'courage', 'To see what is right and not to do it is want of courage'],
  [3330, 'action', 'The superior man is modest in his speech, but exceeds in his actions'],
  [3330, 'mindset', 'Virtue is not left to stand alone. He who practises it will have neighbours'],
  [216, 'growth', 'He who overcomes others is strong; he who overcomes himself is mighty'],
  [216, 'action', 'The journey of a thousand li commenced with a single step'],
  [216, 'calm', 'He who is satisfied with his lot is rich'],
  [8438, 'perseverance', 'For as it is not one swallow or one fine day that makes a spring, so it is not one day or a short time that makes a man blessed and happy'],
  [8438, 'discipline', 'It makes no small difference then whether we form habits of one kind or another from our very youth; it makes a very great difference, or rather all the difference'],
  [148, 'discipline', 'Resolve to perform what you ought; perform without fail what you resolve'],
  [148, 'calm', 'Speak not but what may benefit others or yourself; avoid trifling conversation'],
  [2944, 'courage', 'Envy is ignorance; imitation is suicide'],
  [2944, 'courage', 'Accept the place the divine providence has found for you'],
  [205, 'purpose', 'Rather than love, than money, than fame, give me truth'],
  [205, 'purpose', 'I wanted to live deep and suck out all the marrow of life'],
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
for (const id of Object.keys(WORKS)) { const f = join(DATA, `g${id}.txt`); if (!existsSync(f)) { console.error('missing', f); process.exit(1); } books[id] = sentencesOf(cleanBook(readFileSync(f, 'utf8'))).map(x => ({ ...x, w: new Set(words(x.s)) })); }

// ---- the open quote list: its rows are only HINTS, matched against the author's own books --------------------------------------------------------------
// DATASET = a CSV "QUOTE;AUTHOR;GENRE" (akhiltak/inspirational-quotes, MIT). Only rows by authors we have books for are used; the list's wording is never shipped.
const DATASET = process.env.QUOTE_DATASET; const PER_AUTHOR = Number(process.env.PER_AUTHOR || 9);
const SKIP_GENRE = new Set(['death', 'war', 'politics', 'government', 'religion', 'god', 'sex', 'women', 'men', 'mom', 'dad', 'marriage', 'romantic', 'relationship', 'legal', 'movies', 'music', 'sports', 'car', 'food', 'cool', 'famous', 'funny', 'humor', 'anger', 'sad', 'dad', 'age']);
const GENRE_THEME = { courage: 'courage', fear: 'courage', strength: 'courage', peace: 'calm', alone: 'calm', nature: 'calm', morning: 'action', work: 'action', business: 'action', time: 'action', power: 'action', change: 'action', best: 'action', success: 'perseverance', failure: 'perseverance', experience: 'growth', learning: 'growth', education: 'growth', knowledge: 'growth', wisdom: 'growth', intelligence: 'growth', teacher: 'growth', hope: 'purpose', dreams: 'purpose', future: 'purpose', imagination: 'purpose', happiness: 'purpose', life: 'purpose', great: 'purpose', trust: 'mindset', faith: 'mindset', truth: 'mindset', attitude: 'mindset', positive: 'mindset', good: 'mindset', respect: 'mindset', beauty: 'mindset', art: 'mindset', freedom: 'courage', leadership: 'action', friendship: 'mindset', love: 'mindset', health: 'discipline', home: 'calm', society: 'mindset', history: 'growth', science: 'growth', technology: 'growth', design: 'growth', travel: 'growth', money: 'discipline', amazing: 'purpose', poetry: 'mindset', family: 'mindset', age: 'growth' };
const KEYWORD_THEME = [['perseverance', /persever|patien|endur|\bagain\b|failure|fail\b|\btry\b|never give/i], ['courage', /courag|\bfear|brave|bold|dare/i], ['calm', /calm|peace|\bstill\b|quiet|serene|content/i], ['discipline', /disciplin|habit|control|order|master|self-/i], ['action', /\bdo\b|\bact\b|action|begin|work|labou?r|industr|energy|today/i], ['growth', /learn|grow|wisdom|knowledge|improv|better|teach/i], ['purpose', /dream|purpose|vision|ideal|aim|goal|life/i]];
const themeOf = (text, genre) => GENRE_THEME[genre] ?? KEYWORD_THEME.find(([, re]) => re.test(text))?.[0] ?? 'mindset';
const datasetHints = [];
if (DATASET && existsSync(DATASET)) {
  for (const row of readFileSync(DATASET, 'latin1').split('\n').slice(1)) {
    const p = row.split(';'); if (p.length < 3) continue; const genre = p.pop().trim(), author = p.pop().trim(), text = p.join(';').trim();
    if (!AUTHOR_WORKS.has(author) || SKIP_GENRE.has(genre) || text.length < 20 || text.length > 300) continue;
    datasetHints.push({ author, text, theme: themeOf(text, genre) });
  }
  console.log(`dataset: ${datasetHints.length} rows by authors we have books for`);
}

function matchHint(ids, hint, minScore) {
  const hw = words(hint); if (hw.length < 2) return null;
  const hset = new Set(hw); let best = null;
  const consider = (text, id, penaltySpan) => {
    const w = words(text); const ratio = w.length / Math.max(1, hw.length);
    const sc = sim(hw, w) - Math.max(0, ratio - 1.8) * 0.12 - penaltySpan;
    if (!best || sc > best.sc) best = { sc, text, id };
  };
  for (const id of ids) {
    const sents = books[id];
    // try single sentences, sentence pairs within a paragraph, and the ';' clauses of a long sentence (a hint can be a part of a sentence)
    for (let k = 0; k < sents.length; k++) {
      let shared = 0; for (const w of hset) if (sents[k].w.has(w)) shared++;
      const nextShared = k + 1 < sents.length ? (() => { let n = 0; for (const w of hset) if (sents[k + 1].w.has(w)) n++; return n; })() : 0;
      if (shared + nextShared < hset.size * 0.5) continue;   // cheap filter: the hint's words must be mostly in this sentence or the next
      for (const span of [1, 2]) {
        const parts = sents.slice(k, k + span); if (parts.length < span || parts.some(p => p.para !== parts[0].para)) continue;
        const text = parts.map(p => p.s).join(' '); consider(text, id, span === 2 ? 0.04 : 0);
        if (span === 1 && text.length > 150) for (let c = text.indexOf(','); c > 0; c = text.indexOf(',', c + 1)) { if (c > 30) consider(text.slice(0, c) + '.', id, text.length <= 260 ? 0.2 : 0.05); }   // a famous opening clause of a long sentence
        if (span === 1 && text.includes(';')) for (const clause of text.split(/;\s*/)) { const c = clause.trim().replace(/[.,:]+$/, ''); if (c.length > 25) consider(/[.!?]$/.test(c) ? c : c + '.', id, 0.03); }
      }
    }
  }
  return !best ? null : best.sc >= minScore ? best : { ...best, below: true };
}

// a reviewer's theme for a quote (by its first words) beats the guess from the hint or the list's genre
const THEME_OVERRIDE = { 'Nothing ever comes to me': 'perseverance', 'I have learned that success': 'perseverance', 'The very greatest things': 'perseverance', 'Progress, however': 'perseverance',
  'The journey of a thousand li': 'perseverance', 'We learn wisdom from failure': 'perseverance', 'In all human affairs': 'perseverance', 'Few things help an individual': 'action', 'When in doubt': 'mindset', 'The truth is rarely': 'mindset',
  'Silence is the element': 'calm', 'Trust the instinct': 'courage', 'A great man is always': 'mindset', 'He who is satisfied': 'calm', 'Our faith comes in moments': 'mindset' };
const CUT_AFTER = ['it reveals him to himself'];
const CUT_BEFORE = [': in the beautiful words of'];
const EXCLUDE_START = ['They who have no central purpose', 'Thou must be like a promontory'];
// speaker labels and stage directions come with plays ("LORD DARLINGTON. ..."): strip the label, refuse text that still has directions
const SPEAKER = /^(?:(?:MRS|MR|DR|LADY|LORD|SIR|MISS|THE)\.?\s+)?[A-Z][A-Z'’-]+(?:\s[A-Z][A-Z'’-]+){0,2}\.\s+(?=[A-Z“])/;
function finish(best, hint) {
  let text = best.text.replace(/^[—–-]+\s*/, '').trim().replace(SPEAKER, '');
  // some books run two sentences together when a full stop is missing, or follow a saying with someone else's words: cut at the real end of the author's own sentence
  for (const cut of CUT_AFTER) { const i = text.indexOf(cut); if (i >= 0 && text.length > i + cut.length + 1) text = text.slice(0, i + cut.length).replace(/[,;:]$/, '') + '.'; }
  for (const cut of CUT_BEFORE) { const i = text.indexOf(cut); if (i > 20) text = text.slice(0, i).replace(/[,;:\s]+$/, '') + '.'; }
  if (EXCLUDE_START.some(x => text.startsWith(x))) return { why: 'excluded by review (cut-off list or not self-contained)', got: text.slice(0, 120) };
  text = text.replace(/^(?:No|Yes|Well|Oh|Ah|Why),\s+/i, '');   // the start of a spoken reply in a play
  // Confucius and Lao Tzu are printed as: The Master said, 'saying.' The sentence is theirs, so keep the saying without the framing
  text = text.replace(/^(?:The Master|Confucius) said,?\s*[\u2018']/, '').replace(/^[\u2018']/, '').replace(/[\u2019']$/, '');
  if ((text.match(/["\u201c\u201d]/g) ?? []).length === 1) text = text.replace(/^["\u201c]|["\u201d]$/g, '').trim();   // one stray quote mark from cutting a passage out
  if (/^[a-z]/.test(text) && /[.!]$/.test(text)) text = text.charAt(0).toUpperCase() + text.slice(1);   // a clause printed after a semicolon
  // unbalanced curly quotes at the edges come from cutting a passage out of a longer one: drop them
  if ((text.match(/“/g) ?? []).length !== (text.match(/”/g) ?? []).length) text = text.replace(/^[“]+/, '').replace(/[”]+$/, '').trim();
  // some editions print the first word in capitals ("CALMNESS of mind..."): sentence case it
  text = text.replace(/^([A-Z]{2,})(\b)/, (_, w) => w[0] + w.slice(1).toLowerCase());
  if (text.length < 25 || text.length > 260) return { why: `length ${text.length}`, got: text.slice(0, 120) };
  if (/\b(?:chapter|section|vol\.|page)\b|\d{2,}|[()]/i.test(text)) return { why: 'looks like a heading, footnote or stage direction', got: text.slice(0, 120) };
  // reject: fragments, questions, other people's words quoted by the author (it would be misattributed), and pieces that quote or report someone
  const why = (/^(?:Hence|Thus|But|And|So|Therefore|Yet|Still|For|Nor|Then|Also|He|She|They|It|His|Her|Their|Its)\b/.test(text) && !/^(?:He|They|She) who\b|^For as\b/.test(text)) ? 'continues a previous sentence or is about someone in a story' : !/^[A-Z“]/.test(text) ? 'starts mid-sentence' : /\?$/.test(text) ? 'is a question' : /[“”"]|\b(?:said|says|saying|remarked|observed|wrote|maxim|proverb|called|according to|quoted?|replied|asked|cried|exclaimed|answered|whispered)\b/i.test(text) ? 'quotes or reports someone else' : /^[a-z]/.test(text) ? 'starts lower case' : '';
  return why ? { why, got: text.slice(0, 120) } : { text };
}

// Rows from the open list must also be ABOUT something a motivation video can use (and not about drink, government, marriage, money, war...). The hand-written hints were chosen by eye.
const USEFUL = /\b(courag\w*|fear\w*|hope\w*|dream\w*|success\w*|work|hard work|effort\w*|persever\w*|patien\w*|failure|mistake\w*|learn\w*|wisdom|begin\w*|achiev\w*|strong\w*|strength|energy|enthusiasm|purpose|vision|ideal\w*|believ\w*|faith|worth|calm\w*|silence|progress|resolut\w*|determin\w*|obstacle\w*|hardship|industry|opportunit\w*|responsib\w*|duty|discover\w*|trust\w*|truth|happ\w*|brave\w*|bold|serv\w*|grow\w*|improv\w*|great\w*|noble|honest\w*)\b/i;
const AVOID = /\b(alcohol|drink\w*|drunk\w*|democra\w*|government|govern\w*|soldier\w*|war|enem\w*|devil|marri\w*|wife|husband|romanc\w*|sarcasm|riches|money|wealth|prosper\w*|kill\w*|death|dead|die|dying|sex\w*|wom[ae]n|nude|religio\w*|church|god|philosoph\w*|temperament\w*|histor\w*|cauliflower|peach|prejudice|annoyance|exercise|body|bodily|moral\w*|sympath\w*|sorrowful|weeping|mirror|eternity|useless|disbelief|hate|friends?|fiction|longevity|democracy)\b/i;
// Open-list matches are CANDIDATES. A person reviews them (the script prints them all) and only approved sentences ship. Approval is by the book's exact sentence, so a typo in
// the list can never ship a wrong word. Run with APPROVE_ALL=1 to see every candidate that passed the filters.
const LIST_APPROVED = new Set([
  'When in doubt, tell the truth.', 'Courage is resistance to fear, mastery of fear--not absence of fear.', 'Believe that life is worth living, and your belief will help create the fact.',
  'A chain is no stronger than its weakest link, and life is after all a chain.', 'Nothing ever comes to me, that is worth having, except as the result of hard work.',
  'Few things help an individual more than to place responsibility upon him, and to let him know that you trust him.',
  'I have learned that success is to be measured not so much by the position that one has reached in life as by the obstacles which he has overcome while trying to succeed.',
  'The very greatest things—great thoughts, discoveries, inventions—have usually been nurtured in hardship, often pondered over in sorrow, and at length established with difficulty.',
  'Silence is the element in which great things fashion themselves together.',
  'Progress, however, of the best kind, is comparatively slow. Great results cannot be achieved at once; and we must be satisfied to advance in life as we walk, step by step.',
  "Human felicity is produc'd not so much by great pieces of good fortune that seldom happen, as by little advantages that occur every day.",
  'The first duty for a man is still that of subduing Fear. We must get rid of Fear; we cannot act at all till then.',
  'If he is indeed wise he does not bid you enter the house of his wisdom, but rather leads you to the threshold of your own mind.',
  'To be good is noble; but to show others how to be good is nobler and no trouble.', 'The truth is rarely pure and never simple.',
  'A great man is always willing to be little.', 'Our faith comes in moments; our vice is habitual.', 'Trust the instinct to the end, though you can render no reason.',
  'He who has conquered doubt and fear has conquered failure.', 'In all human affairs there are efforts, and there are results, and the strength of the effort is the measure of the result.',
  'We are by nature observers, and thereby learners. That is our permanent state.', 'If you have built castles in the air, your work need not be lost; that is where they should be. Now put the foundations under them.',
  'No face which we can give to a matter will stead us so well at last as the truth. This alone wears well.', 'The object of the superior man is truth.',
]);
const quotes = []; const dropped = []; const perAuthor = new Map();
const add = (id, theme, hint, best, source) => {
  const f = finish(best, hint); if (f.why) { dropped.push({ id, hint, why: f.why, got: f.got }); return; }
  // shouted text ("TO BE GOOD IS NOBLE...") is printed in capitals by some editions: lower it to sentence case
  const letters = f.text.replace(/[^A-Za-z]/g, ''); if (letters.length > 12 && letters.replace(/[^A-Z]/g, '').length / letters.length > 0.6) f.text = f.text.charAt(0) + f.text.slice(1).toLowerCase();
  if (source === 'list') {
    if (!process.env.APPROVE_ALL && !LIST_APPROVED.has(f.text)) { dropped.push({ id, hint, why: 'not reviewed and approved', got: f.text.slice(0, 120) }); return; }
    if (!USEFUL.test(f.text)) { dropped.push({ id, hint, why: 'not about anything a motivation video can use', got: f.text.slice(0, 120) }); return; }
    if (AVOID.test(f.text)) { dropped.push({ id, hint, why: 'off topic for this library (drink, government, marriage, money, war...)', got: f.text.slice(0, 120) }); return; }
    if (/,\s[A-Z][a-z]+\.$/.test(f.text)) { dropped.push({ id, hint, why: 'addressed to a character by name', got: f.text.slice(0, 120) }); return; }
    if (/\b(?:indifferen\w*|affected with|whosoever|whoso)\b/i.test(f.text)) { dropped.push({ id, hint, why: 'too archaic to read well on screen', got: f.text.slice(0, 120) }); return; }
  }
  if (quotes.some(q => q.text === f.text || q.text.includes(f.text) || f.text.includes(q.text))) return;   // never both a quote and a longer version of it
  theme = Object.entries(THEME_OVERRIDE).find(([k]) => f.text.startsWith(k))?.[1] ?? theme;
  quotes.push({ id: `${id}-${quotes.length + 1}`, text: f.text, author: WORKS[id].author, work: WORKS[id].work, note: WORKS[id].note, year: WORKS[id].year, gutenberg: Number(id), theme, score: Number(best.sc.toFixed(2)), source });
  perAuthor.set(WORKS[id].author, (perAuthor.get(WORKS[id].author) ?? 0) + 1);
};
// 1. hand-written hints (matched with the looser threshold)
for (const [id, theme, hint] of HINTS) { const ids = Array.isArray(id) ? id : [id]; const m = matchHint(ids, hint, 0.68); if (!m || m.below) { dropped.push({ id: ids[0], hint, why: `no passage close enough (best ${m?.sc ? m.sc.toFixed(2) : '0'})`, got: m?.text?.slice(0, 120) }); continue; } add(m.id, theme, hint, m, 'hint'); }
// 2. rows of the open list (stricter: a real quote by this author should be almost word for word in one of their books)
const candidates = [];
for (const h of datasetHints) { const m = matchHint(AUTHOR_WORKS.get(h.author), h.text, 0.85); if (m && !m.below) candidates.push({ ...h, m }); }
console.log(`dataset rows that matched an author's own book: ${candidates.length} of ${datasetHints.length}`);
candidates.sort((a, b) => b.m.sc - a.m.sc || a.m.text.length - b.m.text.length);
for (const c of candidates) { const a = WORKS[c.m.id].author; if (process.env.APPROVE_ALL && (perAuthor.get(a) ?? 0) >= PER_AUTHOR) continue; add(c.m.id, c.theme, c.text, c.m, 'list'); }   // approved quotes are not capped; the cap only limits a review run

console.log(`${quotes.length} quotes found, ${dropped.length} dropped; per author: ${[...perAuthor].map(([a, n]) => a + ' ' + n).join(', ')}`);
for (const d of dropped) console.log(` - dropped [${WORKS[d.id].author}] "${d.hint.slice(0, 70)}" : ${d.why}${d.got ? ' | nearest: ' + d.got : ''}`);
console.log('\nMatched (check each reads as a good, whole quote):');
for (const q of quotes) console.log(` ${q.score} ${q.source} [${q.author}] ${q.text}`);

const header = `// GENERATED by scripts/build-quotes.mjs on ${new Date().toISOString().slice(0, 10)}. Do not edit by hand.
// Every quote is a sentence (or two) found VERBATIM in a public-domain book on Project Gutenberg (author died before 1930; translations are public domain).
// A rough hint was matched to the book's own text; the shipped wording is the book's, never a model's or a quote site's. Anything that did not match was dropped.
`;
const body = `export type QuoteTheme = ${THEMES.map(t => `'${t}'`).join(' | ')};
export interface QuoteRecord { id: string; text: string; author: string; work: string; /** translator or edition note */ note: string; year: string; gutenberg: number; theme: QuoteTheme }
export const QUOTES: QuoteRecord[] = ${JSON.stringify(quotes.map(({ score: _s, source: _src, ...q }) => q), null, 1)};
`;
import { mkdirSync } from 'node:fs';
mkdirSync(new URL('../src/lib/quotes/', import.meta.url), { recursive: true });
writeFileSync(new URL('../src/lib/quotes/quotes.generated.ts', import.meta.url), header + body);
console.log(`Wrote src/lib/quotes/quotes.generated.ts (${quotes.length} quotes).`);
