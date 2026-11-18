// Builds src/lib/bible/verses.generated.ts: uplifting verses in THREE PUBLIC-DOMAIN translations (KJV, WEB, BSB).
// Verse text never comes from a model, and a verse is only kept when independent sources agree (after normalising punctuation and case):
//   KJV  = at least 2 of: wldeh/bible-api (jsDelivr), api.getbible.net, scrollmapper/bible_databases
//   WEB  = wldeh and getbible agree, or (if they differ: different WEB editions) bible-api.com agrees with one of them
//   BSB  = scrollmapper and bible-api.com agree (the BSB is public domain since 2023-04-30, per berean.bible/licensing.htm)
// Which verses to consider: a hand-picked core list, plus single-verse references from OpenBible.info topic scores (CC BY 4.0; ONLY the references are used,
// never its ESV text). Anything a source disagrees on, or that is missing, is left out and listed. Fetches are cached on disk (VERSE_CACHE).
// Usage: NODE_USE_ENV_PROXY=1 VERSE_DATA=<dir with BSB.json KJV.json topic-scores.txt> node scripts/build-verses.mjs [--drop-mismatches]
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DROP = process.argv.includes('--drop-mismatches');
const DATA = process.env.VERSE_DATA; if (!DATA) { console.error('Set VERSE_DATA to a folder holding BSB.json, KJV.json (scrollmapper/bible_databases formats/json) and topic-scores.txt (openbible.info).'); process.exit(1); }
const CACHE = process.env.VERSE_CACHE || join(tmpdir(), 'verse-cache'); mkdirSync(CACHE, { recursive: true });

const BOOKS = ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalm', 'Proverbs', 'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi', 'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude', 'Revelation'];
const OSIS = ['Gen', 'Exod', 'Lev', 'Num', 'Deut', 'Josh', 'Judg', 'Ruth', '1Sam', '2Sam', '1Kgs', '2Kgs', '1Chr', '2Chr', 'Ezra', 'Neh', 'Esth', 'Job', 'Ps', 'Prov', 'Eccl', 'Song', 'Isa', 'Jer', 'Lam', 'Ezek', 'Dan', 'Hos', 'Joel', 'Amos', 'Obad', 'Jonah', 'Mic', 'Nah', 'Hab', 'Zeph', 'Hag', 'Zech', 'Mal', 'Matt', 'Mark', 'Luke', 'John', 'Acts', 'Rom', '1Cor', '2Cor', 'Gal', 'Eph', 'Phil', 'Col', '1Thess', '2Thess', '1Tim', '2Tim', 'Titus', 'Phlm', 'Heb', 'Jas', '1Pet', '2Pet', '1John', '2John', '3John', 'Jude', 'Rev'];

// Hand-picked core (kept from the first build): uplifting, short to medium.
const CORE = {
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
// OpenBible.info topic names are matched by keyword to one of our themes. Topics about healing, money, blessing-for-giving, judgment, sin, death, sex and the like are
// deliberately NOT used (the content screen refuses promises of healing or wealth, and the studio wants uplifting verses).
const THEME_KEYWORDS = [
  ['strength', /\bstrength|\bstrong|\bpower of god|refuge/], ['peace', /\bpeace|\banxi|\bworry|\brest\b|\bcalm|content(?:ment)?\b|\bstill\b/], ['hope', /\bhope|encourag|\bfuture|new beginning|renew/],
  ['love', /\blove|\bcompassion|\bmercy/], ['gratitude', /grateful|gratitude|thank|\bpraise/], ['courage', /courage|\bfear|\bbrave|\bafraid|boldness/], ['wisdom', /wisdom|guidance|understanding|\bdecision/],
  ['forgiveness', /forgiv|\bgrace\b|reconcil/], ['perseverance', /persever|patien|endur|\bwaiting|steadfast|\bhard times/], ['joy', /\bjoy|happi|\brejoic|\bcheerful|\bsmile|\bcelebrat/],
  ['comfort', /comfort|\bgrief|mourning|\bsorrow|\bloss\b|\blonely|loneliness/], ['trust', /\btrust|\bfaith\b|\bfaithful|\bbelief|believing/], ['kindness', /kindness|friend|humil|\bgentle|generos|\bserving|helping others/],
  ['purpose', /purpose|\bcalling|\bwork\b|\bdiligen|\bpersonal growth|\bgoals?\b/],
];
const TOPIC_SKIP = /heal|sick|disease|cancer|rich|money|wealth|prosper|bless|tithe|giving to|judg|hell\b|wrath|punish|sin\b|sins\b|sinful|death|dying|suicide|war\b|kill|murder|sex|adulter|divorce|homosex|abortion|slave|demon|satan|devil|curse|enemy|enemies|vengeance|revenge|end times|apocalypse|rapture|tribulation|idol|witch|drunk|wine|alcohol|pride|anger|hate|lust|nude|naked|rape|violence|blood|sacrifice|circumcis|virgin|women should|submission|gay|lesbian/;
const themeOfTopic = t => { if (TOPIC_SKIP.test(t)) return null; const hit = THEME_KEYWORDS.find(([, re]) => re.test(t)); return hit ? hit[0] : null; };
const THEME_LIST = ['strength', 'peace', 'hope', 'love', 'gratitude', 'courage', 'wisdom', 'forgiveness', 'perseverance', 'joy', 'comfort', 'trust', 'kindness', 'purpose'];
const PER_THEME = Number(process.env.PER_THEME || 32), MIN_SCORE = 2, NEW_MAX_CHARS = 240, MAX_CHARS = 300, MIN_CHARS = 25;
// Verses the content screen or common sense kept out (add references here after a test run, with a reason).
const EXCLUDE = new Set(JSON.parse(process.env.VERSE_EXCLUDE || '[]'));

const TITLE = /^(?:A |An )?(?:Psalm|Song|Prayer|Maskil|Miktam|Shiggaion|Contemplation|Davidic)\b|^(?:For|To) the (?:choirmaster|director|chief musician)\b|^Of (?:David|Asaph|Solomon|the sons of Korah)\b/i;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clean = s => s.replace(/[¶¶]/g, '').replace(/\s+/g, ' ').trim();
const norm = s => clean(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
const key = url => join(CACHE, createHash('sha1').update(url).digest('hex') + '.json');
async function getJson(url, tries = 5) {
  const f = key(url); if (existsSync(f)) return JSON.parse(readFileSync(f, 'utf8'));
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) { const j = await r.json(); writeFileSync(f, JSON.stringify(j)); return j; }
      if (r.status === 404) { writeFileSync(f, 'null'); return null; }
      await sleep(2500 * (i + 1));
    } catch { await sleep(2000 * (i + 1)); }
  }
  return null;
}
async function pool(items, n, fn) { const out = new Array(items.length); let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } })); return out; }

const parse = ref => { const m = /^(.+?) (\d+):(\d+)$/.exec(ref); const book = m[1]; return { book, chapter: +m[2], verse: +m[3], nr: BOOKS.indexOf(book) + 1 }; };
const slug = book => (book === 'Psalm' ? 'psalms' : book.toLowerCase().replace(/\s+/g, ''));

// ---- local datasets (scrollmapper) -------------------------------------------------------------------
const load = f => JSON.parse(readFileSync(join(DATA, f), 'utf8'));
const scroll = { bsb: load('BSB.json'), kjv: load('KJV.json') };
const scrollIdx = {}; for (const [t, d] of Object.entries(scroll)) { scrollIdx[t] = new Map(); d.books.forEach((b, bi) => b.chapters.forEach(c => c.verses.forEach(v => scrollIdx[t].set(`${bi + 1}:${c.chapter}:${v.verse}`, clean(v.text))))); }
const fromScroll = (t, ref) => { const p = parse(ref); return scrollIdx[t].get(`${p.nr}:${p.chapter}:${p.verse}`) ?? null; };

// ---- remote sources -----------------------------------------------------------------------------------
const wldeh = async (t, ref) => { const p = parse(ref); const j = await getJson(`https://cdn.jsdelivr.net/gh/wldeh/bible-api/bibles/en-${t}/books/${slug(p.book)}/chapters/${p.chapter}/verses/${p.verse}.json`); return j?.text ? clean(j.text) : null; };
const getbible = async (t, ref) => { const p = parse(ref); const j = await getJson(`https://api.getbible.net/v2/${t}/${p.nr}/${p.chapter}.json`); const v = j?.verses?.find(x => x.verse === p.verse); return v ? clean(v.text) : null; };
let lastApi = 0;
async function bibleApi(t, ref) {
  const url = `https://bible-api.com/${encodeURIComponent(ref)}?translation=${t}`; if (!existsSync(key(url))) { const wait = 2300 - (Date.now() - lastApi); if (wait > 0) await sleep(wait); lastApi = Date.now(); }
  const j = await getJson(url); const v = j?.verses; return v && v.length === 1 ? clean(v[0].text) : null;
}

// ---- candidate list -------------------------------------------------------------------------------------
const cand = new Map();   // ref -> theme
for (const [theme, refs] of Object.entries(CORE)) for (const r of refs) if (!cand.has(r)) cand.set(r, { theme, core: true });
const bsbLen = ref => (fromScroll('bsb', ref) ?? '').length;
const byTheme = new Map();
for (const line of readFileSync(join(DATA, 'topic-scores.txt'), 'utf8').split('\n')) {
  const [topic, osis, score] = line.split('\t'); const theme = themeOfTopic((topic ?? '').toLowerCase()); if (!theme || !osis || osis.includes('-') || +score < MIN_SCORE) continue;
  const [o, c, v] = osis.split('.'); const bi = OSIS.indexOf(o); if (bi < 0) continue; const ref = `${BOOKS[bi]} ${c}:${v}`;
  const m = byTheme.get(theme) ?? new Map(); m.set(ref, Math.max(m.get(ref) ?? 0, +score)); byTheme.set(theme, m);
}
for (const [theme, m] of byTheme) {
  const coreCount = [...cand.values()].filter(c => c.theme === theme).length;
  const ranked = [...m].sort((a, b) => b[1] - a[1]).filter(([ref]) => { const n = bsbLen(ref); return n >= MIN_CHARS && n <= NEW_MAX_CHARS; });
  let added = 0; for (const [ref] of ranked) { if (coreCount + added >= PER_THEME) break; if (!cand.has(ref)) { cand.set(ref, { theme, core: false }); added++; } }
}
for (const x of EXCLUDE) cand.delete(x);
console.log(`${cand.size} candidate references (${[...cand.values()].filter(c => c.core).length} core + ${[...cand.values()].filter(c => !c.core).length} from OpenBible topics)`);

// ---- verify each verse ----------------------------------------------------------------------------------------
const refs = [...cand.keys()];
const results = await pool(refs, 8, async ref => {
  const why = []; const row = { ref, theme: cand.get(ref).theme, ...parse(ref) };
  // KJV: two of three
  const k = { w: await wldeh('kjv', ref), g: await getbible('kjv', ref), s: fromScroll('kjv', ref) }; const kv = Object.entries(k).filter(([, t]) => t);
  const kAgree = kv.find(([, a], i) => kv.some(([, b], j) => i !== j && norm(a) === norm(b)));
  if (kAgree) row.kjv = (k.s && norm(k.s) === norm(kAgree[1])) ? k.s : (k.g && norm(k.g) === norm(kAgree[1])) ? k.g : kAgree[1]; else why.push(`kjv: no two sources agree (${kv.map(([n, t]) => `${n}=${t.slice(0, 60)}`).join(' | ')})`);
  // WEB
  const w = { w: await wldeh('web', ref), g: await getbible('web', ref) };
  if (w.w && w.g && norm(w.w) === norm(w.g)) row.web = w.g;
  else if (w.w || w.g) { const api = await bibleApi('web', ref); const hit = api && [w.w, w.g].find(t => t && norm(t) === norm(api)); if (hit) row.web = api; else why.push(`web: sources differ\n   wldeh: ${w.w}\n   getbible: ${w.g}\n   bible-api: ${api}`); }
  else why.push('web: missing');
  // BSB
  const bs = fromScroll('bsb', ref); const ba = await bibleApi('bsb', ref);
  if (bs && ba && norm(bs) === norm(ba)) row.bsb = bs; else why.push(`bsb: ${!bs || !ba ? 'missing' : 'sources differ'}\n   scrollmapper: ${bs}\n   bible-api: ${ba}`);
  // some texts carry a psalm title in front of the verse ("A Psalm of David. ..."): the card must show only the verse, so leave those out
  if (!why.length && [row.kjv, row.web, row.bsb].some(t => TITLE.test(t))) why.push('begins with a psalm title or heading');
  if (!why.length) for (const t of ['kjv', 'web', 'bsb']) { const n = row[t].length; const lim = cand.get(ref).core ? MAX_CHARS : NEW_MAX_CHARS + 60; if (n < MIN_CHARS || n > Math.max(MAX_CHARS, lim)) why.push(`${t}: length ${n} outside limits`); }
  return { row, why };
});
const verses = results.filter(r => !r.why.length).map(r => r.row);
const dropped = results.filter(r => r.why.length).map(r => ({ ref: r.row.ref, why: r.why }));
if (dropped.length) {
  console.log(`\n${dropped.length} verse(s) did not pass the source checks:`);
  for (const d of dropped) console.log(` - ${d.ref}\n   ${d.why.join('\n   ')}`);
  if (!DROP) { console.error('\nFAILED. Re-run with --drop-mismatches to leave them out.'); process.exit(1); }
}
const order = ref => { const p = parse(ref); return p.nr * 1e6 + p.chapter * 1e3 + p.verse; };
verses.sort((a, b) => THEME_LIST.indexOf(a.theme) - THEME_LIST.indexOf(b.theme) || order(a.ref) - order(b.ref));
const header = `// GENERATED by scripts/build-verses.mjs on ${new Date().toISOString().slice(0, 10)}. Do not edit by hand.
// Texts: King James Version (KJV), World English Bible (WEB) and Berean Standard Bible (BSB). All three are public domain (the BSB since 2023-04-30:
// https://berean.bible/licensing.htm). Every verse matched in independent sources after normalising punctuation and case (see scripts/build-verses.mjs).
// Which verses were considered: a hand-picked core list plus verse REFERENCES (never text) from OpenBible.info topic scores, CC BY 4.0, https://www.openbible.info/topics/.
// ${dropped.length ? `Left out because sources disagreed or a verse was missing (${dropped.length}): ${dropped.map(d => d.ref).join(', ')}.` : 'No verses were left out.'}
`;
const body = `export type VerseTheme = ${THEME_LIST.map(t => `'${t}'`).join(' | ')};
export interface VerseRecord { ref: string; book: string; chapter: number; verse: number; theme: VerseTheme; kjv: string; web: string; bsb: string }
export const VERSES: VerseRecord[] = ${JSON.stringify(verses.map(({ ref, book, chapter, verse, theme, kjv, web, bsb }) => ({ ref, book, chapter, verse, theme, kjv, web, bsb })), null, 1)};
`;
mkdirSync(new URL('../src/lib/bible/', import.meta.url), { recursive: true });
writeFileSync(new URL('../src/lib/bible/verses.generated.ts', import.meta.url), header + body);
console.log(`Wrote ${verses.length} verses (${dropped.length} left out).`);
