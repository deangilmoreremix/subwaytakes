// One small search engine for the verse and quote libraries. Pure and fast (the libraries are a few hundred items), no dependencies.
// What it does that a plain "contains" filter does not: ranks the best match first, matches word starts as you type ("strengt"), ignores
// case, punctuation and accents, searches reference/author/theme as well as the text, and understands everyday intent
// ("I'm scared", "tired", "can't sleep", "want to quit") by also looking for the related words the texts actually use.

export const norm = (s: string): string => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Everyday words and the words the texts use for the same idea. Each side is matched as whole words or word starts. */
export const SYNONYMS: Record<string, string[]> = {
  scared: ['afraid', 'fear', 'fearful', 'dismayed', 'courage'], afraid: ['fear', 'courage', 'dismayed'], fear: ['afraid', 'courage', 'dismayed'], nervous: ['afraid', 'fear', 'anxious', 'peace'],
  worry: ['anxious', 'anxiety', 'trouble', 'troubled', 'peace', 'care'], worried: ['anxious', 'anxiety', 'trouble', 'troubled', 'peace'], anxious: ['anxiety', 'trouble', 'troubled', 'peace', 'worry'], stress: ['anxious', 'trouble', 'burden', 'rest', 'peace'], stressed: ['anxious', 'trouble', 'burden', 'rest', 'peace'],
  tired: ['weary', 'faint', 'rest', 'strength', 'renew'], exhausted: ['weary', 'faint', 'rest', 'strength', 'renew'], burnout: ['weary', 'rest', 'renew', 'strength'], weak: ['strength', 'strong', 'weakness'],
  sad: ['sorrow', 'mourn', 'mourning', 'grief', 'tears', 'comfort', 'broken'], depressed: ['sorrow', 'broken', 'comfort', 'hope', 'tears'], grief: ['mourn', 'sorrow', 'comfort', 'loss'], loss: ['mourn', 'grief', 'comfort', 'sorrow'], lonely: ['alone', 'forsake', 'comfort', 'with you', 'friend'], alone: ['lonely', 'forsake', 'with you', 'comfort'],
  angry: ['anger', 'wrath', 'patient', 'patience', 'calm', 'gentle'], mad: ['anger', 'patient', 'calm'], forgive: ['forgiven', 'forgiveness', 'mercy', 'pardon'], sorry: ['forgive', 'forgiven', 'mercy'], guilt: ['forgive', 'forgiven', 'mercy', 'cleanse'], guilty: ['forgive', 'forgiven', 'mercy', 'cleanse'],
  quit: ['persevere', 'perseverance', 'endure', 'patient', 'not weary', 'strong', 'continue'], quitting: ['persevere', 'perseverance', 'endure', 'continue'], giveup: ['persevere', 'endure', 'continue'], stuck: ['guide', 'direct', 'way', 'path', 'wisdom', 'begin'], lost: ['guide', 'direct', 'way', 'path', 'wisdom', 'hope'],
  sleep: ['rest', 'lie down', 'peace', 'safety'], insomnia: ['rest', 'sleep', 'peace'], rest: ['peace', 'quiet', 'still', 'sleep'], calm: ['peace', 'still', 'quiet', 'steady'], peace: ['calm', 'quiet', 'still', 'rest'],
  hope: ['future', 'expect', 'wait', 'renew'], hopeless: ['hope', 'future', 'comfort', 'renew'], future: ['hope', 'plans', 'tomorrow'], change: ['new', 'renew', 'begin', 'transform'], start: ['begin', 'new', 'first'], beginning: ['begin', 'new', 'first', 'start'], fresh: ['new', 'renew', 'begin'],
  money: ['treasure', 'riches', 'content', 'enough', 'provide'], work: ['labour', 'labor', 'diligent', 'diligence', 'deed', 'toil', 'industry'], job: ['work', 'labour', 'diligent', 'deed'], boss: ['work', 'serve', 'diligent'], success: ['achieve', 'achieves', 'prosper', 'accomplish', 'great'], goals: ['purpose', 'vision', 'dream', 'plans', 'aim'], dream: ['vision', 'dreams', 'ideal', 'purpose'], dreams: ['vision', 'dream', 'ideal', 'purpose'],
  motivated: ['enthusiasm', 'energy', 'action', 'strength'], motivation: ['enthusiasm', 'energy', 'action', 'strength', 'purpose'], lazy: ['diligent', 'idle', 'action', 'work', 'energy'], procrastinate: ['today', 'now', 'action', 'begin', 'time'], procrastinating: ['today', 'now', 'action', 'begin', 'time'],
  confidence: ['trust', 'courage', 'strong', 'self'], confident: ['trust', 'courage', 'strong'], brave: ['courage', 'courageous', 'strong', 'fear'], strong: ['strength', 'courage', 'mighty'], failure: ['fail', 'wisdom', 'learn', 'mistake', 'stumble'], mistake: ['fail', 'learn', 'wisdom', 'forgive'], mistakes: ['fail', 'learn', 'wisdom', 'forgive'],
  thankful: ['thanks', 'gratitude', 'grateful', 'praise'], grateful: ['thanks', 'thankful', 'gratitude', 'praise'], happy: ['joy', 'rejoice', 'glad', 'cheerful', 'smile'], joy: ['rejoice', 'glad', 'happy', 'cheerful'], love: ['loved', 'beloved', 'charity', 'kind'],
  kind: ['kindness', 'gentle', 'compassion', 'tender', 'love'], friend: ['friends', 'friendship', 'companion', 'brother'], family: ['children', 'household', 'parents', 'father', 'mother', 'home'], kids: ['children', 'child', 'train up'], marriage: ['wife', 'husband', 'love', 'two are better'],
  health: ['body', 'strength', 'rest', 'wholesome'], protect: ['refuge', 'shield', 'safety', 'keep', 'deliver'], safe: ['refuge', 'safety', 'protect', 'keep', 'shield'], travel: ['go', 'way', 'journey', 'keep', 'guide'], commute: ['go', 'way', 'journey', 'keep', 'guide', 'daily'], morning: ['dawn', 'new', 'early', 'day'], night: ['sleep', 'evening', 'lie down', 'rest'],
  patience: ['patient', 'wait', 'endure', 'persevere'], wait: ['patient', 'patience', 'endure', 'hope'], decision: ['wisdom', 'guide', 'direct', 'counsel', 'plans'], choices: ['wisdom', 'guide', 'direct', 'counsel'], advice: ['counsel', 'wisdom', 'wise'], humble: ['humility', 'humbly', 'meek', 'lowly'], proud: ['pride', 'humble', 'humility'],
  truth: ['true', 'honest', 'honesty', 'faithful'], honest: ['truth', 'true', 'integrity', 'upright'], integrity: ['upright', 'honest', 'truth', 'mind'], focus: ['concentration', 'present', 'one thing', 'attention', 'mind'], habit: ['habits', 'actions', 'practice', 'discipline'], discipline: ['habit', 'control', 'master', 'self'],
};

export interface Searchable { id: string; /** highest weight (reference, author) */ title: string; text: string; /** theme and other tags */ tags: string[] }
export interface Ranked<T> { item: T; score: number; /** words to highlight */ hits: string[] }

const wordsOf = (s: string): string[] => norm(s).split(' ').filter(Boolean);
const STOP = new Set(['a', 'an', 'and', 'the', 'of', 'to', 'in', 'is', 'it', 'i', 'me', 'my', 'im', 'am', 'be', 'for', 'with', 'on', 'at', 'by', 'or', 'about', 'that', 'this', 'what', 'how', 'do', 'does', 'can', 'cant', 'want', 'need', 'feel', 'feeling', 'verse', 'verses', 'quote', 'quotes', 'something', 'some', 'when', 'im']);

/** Synonyms for a word, also trying its singular and its -ing form ("beginnings", "worrying"). */
const synonymsFor = (w: string): string[] => SYNONYMS[w] ?? SYNONYMS[w.replace(/s$/, '')] ?? SYNONYMS[w.replace(/ing$/, '')] ?? SYNONYMS[w.replace(/ing$/, 'e')] ?? [];

/** Expand a query into groups: every group must be satisfied (AND); inside a group any alternative will do (the word itself, or its synonyms at lower weight). */
export function expandQuery(query: string): Array<Array<{ term: string; weight: number }>> {
  const raw = wordsOf(query.replace(/['’]/g, ''));
  const groups: Array<Array<{ term: string; weight: number }>> = [];
  const keep = raw.filter(w => !STOP.has(w) || raw.length === 1);
  const ws = keep.length ? keep : raw;
  for (let i = 0; i < ws.length; i++) {
    // a two-word phrase with its own entry ("give up", "lie down") becomes ONE group: the phrase itself or its related words
    const pair = i + 1 < ws.length ? ws[i] + ws[i + 1] : '';
    if (pair && SYNONYMS[pair]) { groups.push([{ term: `${ws[i]} ${ws[i + 1]}`, weight: 1 }, ...SYNONYMS[pair].map(t => ({ term: norm(t), weight: 0.3 }))]); i++; continue; }
    groups.push([{ term: ws[i], weight: 1 }, ...synonymsFor(ws[i]).map(t => ({ term: norm(t), weight: 0.3 }))]);
  }
  return groups;
}

/** Score of one term against an item: `shown` is the part that comes from words you can see (title and text), so only that is highlighted. */
function scoreTerm(term: string, title: string, titleWords: string[], text: string, textWords: string[], tags: string[]): { score: number; shown: number } {
  let s = 0;
  if (title.startsWith(term)) s += 40; else if (titleWords.some(w => w.startsWith(term))) s += 24;;
  const shown0 = s;
  if (tags.some(t => t === term)) s += 22; else if (tags.some(t => t.startsWith(term))) s += 12;
  const tagPart = s - shown0; s = shown0;
  if (textWords.includes(term)) s += 10; else if (textWords.some(w => w.length > 3 && w.startsWith(term))) s += 6; else if (term.length > 3 && text.includes(term)) s += 3;
  return { score: s + tagPart, shown: s };
}

/** Rank items for a query. An empty query returns everything in its original order. */
export function rank<T extends Searchable>(items: readonly T[], query: string): Array<Ranked<T>> {
  const q = norm(query);
  if (!q) return items.map(item => ({ item, score: 0, hits: [] }));
  const groups = expandQuery(query);
  const out: Array<Ranked<T>> = [];
  for (const item of items) {
    const title = norm(item.title), text = norm(item.text), tags = item.tags.map(norm);
    const titleWords = title.split(' '), textWords = text.split(' ');
    let total = 0; const hits: string[] = []; let ok = true;
    // a reference typed with a colon or spaces ("john 3 16") matches the title as a whole
    if (title === q || title.replace(/ /g, '') === q.replace(/ /g, '')) { out.push({ item, score: 1000, hits: [q] }); continue; }
    for (const g of groups) {
      let best = 0, bestShown = 0, shownTerm = '';
      for (const { term, weight } of g) { const r = scoreTerm(term, title, titleWords, text, textWords, tags); const v = r.score * weight; if (v > best) best = v; if (r.shown * weight > bestShown) { bestShown = r.shown * weight; shownTerm = term; } }
      if (best <= 0) { ok = false; break; }
      total += best; if (shownTerm) hits.push(shownTerm);
    }
    if (ok) out.push({ item, score: total, hits });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** Split text into pieces for highlighting: `match` pieces are the words that matched (whole words and word starts). */
export function highlight(text: string, hits: readonly string[]): Array<{ t: string; match: boolean }> {
  const terms = [...new Set(hits.filter(h => h.length > 1))].sort((a, b) => b.length - a.length);
  if (!terms.length) return [{ t: text, match: false }];
  const pieces: Array<{ t: string; match: boolean }> = [];
  for (const part of text.split(/(\s+|[.,;:!?"“”'’—-]+)/)) {
    if (!part) continue; const n = norm(part);
    pieces.push({ t: part, match: n.length > 0 && terms.some(t => n === t || (t.length > 3 && n.startsWith(t)) || (n.length > 3 && t.startsWith(n))) });
  }
  return pieces;
}
