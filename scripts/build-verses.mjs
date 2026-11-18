// Builds src/lib/bible/verses.generated.ts: a curated list of uplifting verses in two PUBLIC-DOMAIN translations (KJV and WEB).
// Verse text never comes from a model. Every verse is fetched from TWO independent sources and compared after normalising punctuation and case:
//   A = bible-api.com   B = api.getbible.net
// A verse whose two sources disagree (or that is missing) fails the build unless --drop-mismatches is passed, in which case it is left out and listed.
// Usage: NODE_USE_ENV_PROXY=1 node scripts/build-verses.mjs [--drop-mismatches]
import { writeFileSync, mkdirSync } from 'node:fs';

const DROP = process.argv.includes('--drop-mismatches');
const BOOKS = ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalm', 'Proverbs', 'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi', 'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude', 'Revelation'];

// Curated by hand: uplifting, short to medium, no violence or judgement language. Themes are for the picker.
const THEMES = {
  strength: ['Isaiah 40:31', 'Philippians 4:13', 'Psalm 46:1', 'Isaiah 41:10', 'Joshua 1:9', 'Psalm 28:7', 'Nehemiah 8:10', 'Deuteronomy 31:6', '2 Corinthians 12:9', 'Psalm 18:2', 'Exodus 15:2', 'Psalm 27:1', 'Habakkuk 3:19', 'Ephesians 6:10', 'Psalm 73:26', '1 Chronicles 16:11'],
  peace: ['John 14:27', 'Philippians 4:6', 'Philippians 4:7', 'Isaiah 26:3', 'Psalm 23:1', 'Psalm 23:4', 'Psalm 4:8', 'Matthew 11:28', 'John 16:33', 'Colossians 3:15', 'Psalm 29:11', 'Romans 15:13', 'Isaiah 43:2', 'Psalm 91:1', '2 Thessalonians 3:16', 'Psalm 34:18'],
  hope: ['Jeremiah 29:11', 'Romans 8:28', 'Romans 12:12', 'Psalm 42:11', 'Lamentations 3:22', 'Lamentations 3:23', 'Psalm 130:5', 'Hebrews 11:1', 'Hebrews 6:19', 'Psalm 71:14', 'Romans 5:5', 'Psalm 33:22', 'Proverbs 23:18', '1 Peter 1:3', 'Micah 7:7', 'Psalm 121:1'],
  love: ['John 3:16', '1 Corinthians 13:4', '1 Corinthians 13:7', '1 Corinthians 13:13', '1 John 4:8', '1 John 4:19', 'John 15:13', 'Romans 5:8', '1 John 4:18', 'Proverbs 17:17', 'John 13:34', 'Colossians 3:14', '1 Peter 4:8', 'Zephaniah 3:17', 'Psalm 136:1', 'Ephesians 3:17'],
  gratitude: ['1 Thessalonians 5:18', 'Psalm 107:1', 'Psalm 100:4', 'Psalm 118:24', 'Colossians 3:17', 'Psalm 9:1', 'Psalm 95:2', 'Philippians 1:3', 'Psalm 103:2', 'Psalm 34:1', '1 Chronicles 16:34', 'Psalm 118:1', 'Colossians 4:2', 'Psalm 92:1', 'James 1:17', 'Psalm 106:1'],
  courage: ['Psalm 27:14', 'Isaiah 41:13', '2 Timothy 1:7', 'Psalm 56:3', 'Psalm 118:6', 'Deuteronomy 31:8', '1 Corinthians 16:13', 'Psalm 31:24', 'Proverbs 28:1', 'Isaiah 12:2', 'Matthew 14:27', 'Romans 8:31', 'Psalm 27:3', 'Hebrews 13:6', 'John 14:1', 'Joshua 1:7'],
  wisdom: ['Proverbs 3:5', 'Proverbs 3:6', 'Proverbs 4:7', 'James 1:5', 'Proverbs 9:10', 'Proverbs 16:3', 'Proverbs 11:2', 'Proverbs 15:1', 'Proverbs 18:21', 'Proverbs 22:6', 'Ecclesiastes 3:1', 'Proverbs 27:17', 'Psalm 119:105', 'Proverbs 12:15', 'Proverbs 19:21', 'Proverbs 16:9', 'Proverbs 13:20'],
  forgiveness: ['Ephesians 4:32', 'Colossians 3:13', '1 John 1:9', 'Psalm 103:12', 'Matthew 6:14', 'Luke 6:37', 'Isaiah 1:18', 'Micah 7:19', 'Psalm 86:5', 'Romans 8:1', 'Luke 23:34', 'Mark 11:25', 'Psalm 32:1', 'Acts 3:19', 'Proverbs 17:9', 'Matthew 18:21'],
  perseverance: ['Galatians 6:9', 'James 1:12', 'Romans 5:3', 'Romans 5:4', 'Hebrews 12:1', '2 Corinthians 4:17', '1 Corinthians 15:58', 'Philippians 3:14', '2 Timothy 4:7', 'James 1:2', 'James 1:3', 'Psalm 126:5', 'Hebrews 10:36', 'Matthew 24:13', '2 Chronicles 15:7', 'Proverbs 24:16'],
};

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getJson(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(url);
    if (r.ok) return r.json();
    if (r.status === 429 || r.status >= 500) { await sleep(2500 * (i + 1)); continue; }
    throw new Error(`${r.status} for ${url}`);
  }
  throw new Error(`gave up on ${url}`);
}
const clean = s => s.replace(/[¶¶]/g, '').replace(/\s+/g, ' ').trim();
const norm = s => clean(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
const parse = ref => { const m = /^(.+?) (\d+):(\d+)$/.exec(ref); const book = m[1]; return { book, chapter: +m[2], verse: +m[3], nr: BOOKS.indexOf(book) + 1 }; };

// source A: bible-api.com, one request per verse (it has no multi-book lookups)
async function sourceA(refs, translation) {
  const out = new Map();
  for (const ref of refs) {
    try {
      const data = await getJson(`https://bible-api.com/${encodeURIComponent(ref)}?translation=${translation}`);
      const v = data.verses?.[0]; if (v && data.verses.length === 1) out.set(ref, clean(v.text));
    } catch (e) { console.log(`  A failed for ${ref} (${translation}): ${e.message.slice(0, 80)}`); }
    await sleep(2200);   // the free API allows about 15 requests per 30 seconds
  }
  return out;
}
// source B: api.getbible.net, one request per chapter
const chapterCache = new Map();
async function sourceB(ref, translation) {
  const { nr, chapter, verse } = parse(ref);
  const key = `${translation}/${nr}/${chapter}`;
  if (!chapterCache.has(key)) chapterCache.set(key, await getJson(`https://api.getbible.net/v2/${translation}/${nr}/${chapter}.json`));
  const v = chapterCache.get(key).verses.find(x => x.verse === verse);
  return v ? clean(v.text) : null;
}

const all = [];
for (const [theme, refs] of Object.entries(THEMES)) for (const ref of refs) if (!all.some(x => x.ref === ref)) all.push({ ref, theme });
console.log(`${all.length} curated references`);

const A = { kjv: await sourceA(all.map(x => x.ref), 'kjv'), web: await sourceA(all.map(x => x.ref), 'web') };
const verses = []; const dropped = [];
for (const { ref, theme } of all) {
  const row = { ref, theme, ...parse(ref) }; let ok = true; const why = [];
  for (const t of ['kjv', 'web']) {
    const a = A[t].get(ref); const b = await sourceB(ref, t).catch(() => null);
    if (!a || !b) { ok = false; why.push(`${t}: missing from ${!a ? 'A' : 'B'}`); continue; }
    if (norm(a) !== norm(b)) { ok = false; why.push(`${t}: sources differ\n   A: ${a}\n   B: ${b}`); continue; }
    row[t] = a;
  }
  if (ok) verses.push(row); else dropped.push({ ref, why });
}
if (dropped.length) {
  console.log(`\n${dropped.length} verse(s) did not pass the two-source check:`);
  for (const d of dropped) console.log(` - ${d.ref}\n   ${d.why.join('\n   ')}`);
  if (!DROP) { console.error('\nFAILED. Re-run with --drop-mismatches to leave them out.'); process.exit(1); }
}

const header = `// GENERATED by scripts/build-verses.mjs on ${new Date().toISOString().slice(0, 10)}. Do not edit by hand.
// Texts: King James Version (KJV) and World English Bible (WEB), both public domain.
// Every verse below matched (after normalising punctuation and case) in two independent sources: bible-api.com and api.getbible.net.
// ${dropped.length ? `Left out because the sources disagreed or a verse was missing: ${dropped.map(d => d.ref).join(', ')}.` : 'No verses were left out.'}
`;
const body = `export type VerseTheme = ${Object.keys(THEMES).map(t => `'${t}'`).join(' | ')};
export interface VerseRecord { ref: string; book: string; chapter: number; verse: number; theme: VerseTheme; kjv: string; web: string }
export const VERSES: VerseRecord[] = ${JSON.stringify(verses.map(({ ref, book, chapter, verse, theme, kjv, web }) => ({ ref, book, chapter, verse, theme, kjv, web })), null, 1)};
`;
mkdirSync(new URL('../src/lib/bible/', import.meta.url), { recursive: true });
writeFileSync(new URL('../src/lib/bible/verses.generated.ts', import.meta.url), header + body);
console.log(`Wrote ${verses.length} verses (${dropped.length} left out).`);
