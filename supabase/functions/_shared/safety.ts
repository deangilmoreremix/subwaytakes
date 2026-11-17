// Content safety for anything that is about to be sent to a generation model. One source of truth, no imports: the gateway enforces it on the
// server and the app runs the same code first so people get a clear message before anything is submitted.
//
// Honest limits: this is a deterministic phrase and pattern screen, not a classifier. It stops the obvious and the lazily obfuscated
// (leetspeak, spacing, punctuation, accents), it does not understand intent. The operator can add blocked terms in the safety_terms table.

export type SafetyCategory = 'minors' | 'sexual' | 'violence' | 'self_harm' | 'likeness' | 'hate' | 'medical';
export type SafetyResult = { ok: true } | { ok: false; category: SafetyCategory; message: string };

const MESSAGES: Record<SafetyCategory, string> = {
  minors: 'This studio does not create videos of children or teenagers.',
  sexual: 'This studio does not create sexual or nude content.',
  violence: 'This studio does not create graphic violence.',
  self_harm: 'This studio does not create content about self-harm.',
  likeness: 'This studio does not create videos of real, named people or celebrity look-alikes. Describe an original character instead.',
  hate: 'This studio does not create hateful content.',
  medical: 'This studio does not make medical or health-treatment claims.',
};

/** Lower-case, strip accents and zero-width characters, undo common letter swaps, and turn separators into single spaces. */
export function normalize(input: string, leet = true): string {
  let t = input.normalize('NFKD').replace(/[\u0300-\u036f\u200b-\u200f\u2060\ufeff]/g, '').toLowerCase();
  if (leet) t = t.replace(/[@4]/g, 'a').replace(/3/g, 'e').replace(/1/g, 'i').replace(/0/g, 'o').replace(/[5$]/g, 's').replace(/7/g, 't');
  t = t.replace(/[^a-z0-9\s]/g, ' ');                       // punctuation between letters becomes a space ("n.u.d.e" -> "n u d e")
  t = t.replace(/\b([a-z])(?:\s+(?=[a-z]\b)([a-z]))+\b/g, m => m.replace(/\s+/g, ''));   // collapse spaced-out single letters
  return t.replace(/\s+/g, ' ').trim();
}

// Words are matched on whole-word boundaries after normalisation, so "class" never trips "ass" and "Essex" never trips "sex".
const TERMS: Record<Exclude<SafetyCategory, 'likeness'>, string[]> = {
  // Unambiguous words for children. Ordinary words like "kids" or "baby" are only blocked next to sexual or violent words (see WEAK_MINOR).
  minors: ['toddler', 'infant', 'newborn', 'preteen', 'preteens', 'teenager', 'teenagers', 'underage', 'schoolboy', 'schoolgirl', 'little boy', 'little girl', 'young boy', 'young girl', 'tween', 'tweens'],
  sexual: ['nude', 'nudes', 'naked', 'nsfw', 'porn', 'porno', 'pornographic', 'erotic', 'sex scene', 'sexual intercourse', 'topless', 'lingerie model', 'explicit sex', 'sexually explicit', 'strip tease', 'stripper', 'orgy', 'fetish'],
  violence: ['gore', 'gory', 'beheading', 'decapitation', 'dismember', 'dismemberment', 'mutilation', 'mutilated', 'bloodbath', 'graphic violence'],
  self_harm: ['suicide method', 'how to kill myself', 'kill myself', 'cut myself', 'self harm', 'selfharm', 'hang myself', 'end my life'],
  hate: ['white power', 'heil hitler', 'gas the', 'ethnic cleansing', 'race war', 'subhuman'],
  medical: ['cures cancer', 'cure cancer', 'cures diabetes', 'cure for cancer', 'guaranteed cure', 'treats depression', 'replaces your medication', 'stop taking your medication', 'miracle cure', 'cures anxiety'],
};

// Patterns for "make a video of a real person": impersonation and look-alike language, deepfake/face-swap requests, and age statements.
const PATTERNS: Array<{ category: SafetyCategory; re: RegExp; plain?: boolean }> = [
  { category: 'likeness', re: /\b(deepfake|deep fake|face swap|faceswap|swap (?:the )?face|lookalike|look alike|impersonat\w*|likeness of|in the likeness|resembl\w+ (?:the )?(?:real|actual))\b/ },
  { category: 'likeness', re: /\b(?:looks? like|looking like|dressed as|portrayed as|playing the role of|as if (?:he|she) were) (?:the )?(?:president|prime minister|king|queen|pope|celebrity|actor|actress|singer|rapper|politician|famous)\b/ },
  { category: 'likeness', re: /\b(?:a |an |the )?(?:celebrity|famous (?:person|actor|actress|singer|rapper|politician|athlete)|real person)\b/ },
  { category: 'minors', plain: true, re: /\b(?:[1-9]|1[0-7]) ?(?:year|yr)s? ?old (?:boy|girl|child|kid|son|daughter|student|person|guy|baby|brother|sister|youth)\b|\b(?:boy|girl|child|kid|son|daughter|student|baby|brother|sister) (?:aged|age) (?:[1-9]|1[0-7])\b|\b(?:[1-9]|1[0-7]) ?yo\b/ },
  { category: 'minors', plain: true, re: /\b(?:under ?18|under ?age|high school (?:student|girl|boy)|middle school|elementary school)\b/ },
];

/** A starter list of widely known public figures. The operator extends it in the safety_terms table; it is a screen, not a promise. */
const NAMES = [
  'taylor swift', 'beyonce', 'kanye west', 'elon musk', 'donald trump', 'joe biden', 'barack obama', 'kamala harris', 'vladimir putin', 'xi jinping', 'narendra modi', 'justin trudeau', 'emmanuel macron', 'king charles',
  'tom cruise', 'brad pitt', 'leonardo dicaprio', 'scarlett johansson', 'dwayne johnson', 'kim kardashian', 'kylie jenner', 'rihanna', 'ariana grande', 'selena gomez', 'justin bieber', 'zendaya', 'tom hanks',
  'cristiano ronaldo', 'lionel messi', 'lebron james', 'mr beast', 'mrbeast', 'pewdiepie', 'joe rogan', 'oprah', 'jeff bezos', 'mark zuckerberg', 'bill gates', 'pope francis',
];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordRe = (term: string) => new RegExp(`(?:^| )${esc(normalize(term))}(?: |$)`);
const COMPILED = (Object.entries(TERMS) as Array<[Exclude<SafetyCategory, 'likeness'>, string[]]>).flatMap(([category, list]) => list.map(t => ({ category, re: wordRe(t) })));
const NAME_RES = NAMES.map(n => wordRe(n));
const WEAK_MINOR = ['child', 'children', 'kid', 'kids', 'baby', 'babies', 'teen', 'teens', 'minor', 'boy', 'girl', 'son', 'daughter', 'student'].map(wordRe);
const ADULT_HARM = COMPILED.filter(c => c.category === 'sexual' || c.category === 'violence');

/** Check one piece of text. `extraTerms` are the operator's own blocked words and names (category: likeness unless they look like hate/sexual words). */
export function checkText(text: string, extraTerms: readonly string[] = []): SafetyResult {
  if (!text || typeof text !== 'string') return { ok: true };
  const raw = text.slice(0, 20_000);
  const t = normalize(raw);
  if (!t) return { ok: true };
  const plain = normalize(raw, false);   // digits kept, for age statements
  for (const p of PATTERNS) if (p.re.test(p.plain ? plain : t)) return { ok: false, category: p.category, message: MESSAGES[p.category] };
  // a word for a young person next to a sexual or violent word is always refused
  if (WEAK_MINOR.some(re => re.test(t)) && ADULT_HARM.some(c => c.re.test(t))) return { ok: false, category: 'minors', message: MESSAGES.minors };
  for (const c of COMPILED) if (c.re.test(t)) return { ok: false, category: c.category, message: MESSAGES[c.category] };
  for (const re of NAME_RES) if (re.test(t)) return { ok: false, category: 'likeness', message: MESSAGES.likeness };
  for (const term of extraTerms) {
    const n = normalize(term);
    if (n && wordRe(term).test(t)) return { ok: false, category: 'likeness', message: MESSAGES.likeness };
  }
  return { ok: true };
}

/** Every string the customer wrote that will reach a model: prompts, scripts, descriptions. URLs and short identifiers are skipped. */
export function collectText(body: unknown, depth = 0, out: string[] = []): string[] {
  if (depth > 6 || out.length > 200) return out;
  if (typeof body === 'string') { if (!/^https?:\/\//.test(body) && body.length >= 3) out.push(body); }
  else if (Array.isArray(body)) for (const v of body.slice(0, 100)) collectText(v, depth + 1, out);
  else if (body && typeof body === 'object') for (const [k, v] of Object.entries(body as Record<string, unknown>)) { if (!/(?:url|image|video|audio|voice_id|aspect|resolution|format|model)/i.test(k)) collectText(v, depth + 1, out); }
  return out;
}

/** Check a whole request body. The first problem wins. */
export function checkBody(body: unknown, extraTerms: readonly string[] = []): SafetyResult {
  for (const s of collectText(body)) { const r = checkText(s, extraTerms); if (!r.ok) return r; }
  return { ok: true };
}

export const SAFETY_CATEGORIES = Object.keys(MESSAGES) as SafetyCategory[];
