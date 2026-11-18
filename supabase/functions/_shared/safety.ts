// Content safety for anything that is about to be sent to a generation model. One source of truth, no imports: the gateway enforces it on the
// server and the app runs the same code first so people get a clear message before anything is submitted.
//
// Honest limits: this is a deterministic phrase and pattern screen, not a classifier. It stops the obvious and the lazily obfuscated
// (leetspeak, spacing, punctuation, accents), it does not understand intent. The operator can add blocked terms in the safety_terms table.

export type SafetyCategory = 'minors' | 'sexual' | 'violence' | 'self_harm' | 'likeness' | 'hate' | 'medical' | 'religious' | 'guarantee' | 'oversize';
export type SafetyResult = { ok: true } | { ok: false; category: SafetyCategory; message: string };

const MESSAGES: Record<SafetyCategory, string> = {
  minors: 'This studio does not create videos of children or teenagers.',
  sexual: 'This studio does not create sexual or nude content.',
  violence: 'This studio does not create graphic violence.',
  self_harm: 'This studio does not create content about self-harm.',
  likeness: 'This studio does not create videos of real, named people or celebrity look-alikes. Describe an original character instead.',
  hate: 'This studio does not create hateful content.',
  medical: 'This studio does not make medical or health-treatment claims.',
  religious: 'This studio does not show or voice God, Jesus, prophets or other holy figures, and does not mock anyone\'s faith.',
  guarantee: 'This studio does not promise healing, wealth or guaranteed results.',
  oversize: 'This request is too long or too complicated to check. Shorten it and try again.',
};

/** Lower-case, strip accents and zero-width characters, undo common letter swaps, and turn separators into single spaces. */
const HOMOGLYPHS: Record<string, string> = {
  '\u0430': 'a', '\u0435': 'e', '\u043e': 'o', '\u0440': 'p', '\u0441': 'c', '\u0443': 'y', '\u0445': 'x', '\u0456': 'i', '\u0455': 's', '\u0458': 'j', '\u04bb': 'h', '\u043d': 'h', '\u043a': 'k', '\u043c': 'm', '\u0442': 't', '\u0432': 'b',
  '\u03bf': 'o', '\u03b1': 'a', '\u03b5': 'e', '\u03b9': 'i', '\u03bd': 'v', '\u03c1': 'p', '\u03c4': 't', '\u03ba': 'k', '\u03c5': 'u', '\u03c7': 'x', '\u0131': 'i',
};

/** Lower-case, strip accents, format characters and zero-width characters, map look-alike letters to Latin, undo common letter swaps, and turn separators into single spaces. */
export function normalize(input: string, leet = true): string {
  let t = input.normalize('NFKD').replace(/[\p{M}\p{Cf}\ufe00-\ufe0f]/gu, '').toLowerCase();
  t = t.replace(/[\u0370-\u04ff\u0131]/g, c => HOMOGLYPHS[c] ?? c);
  if (leet) t = t.replace(/[@4]/g, 'a').replace(/3/g, 'e').replace(/1/g, 'i').replace(/0/g, 'o').replace(/[5$]/g, 's').replace(/7/g, 't');
  t = t.replace(/[^a-z0-9\s]/g, ' ');                       // punctuation between letters becomes a space ("n.u.d.e" -> "n u d e")
  t = t.replace(/\b([a-z])(?:\s+(?=[a-z]\b)([a-z]))+\b/g, m => m.replace(/\s+/g, ''));   // collapse spaced-out single letters
  return t.replace(/\s+/g, ' ').trim();
}

/** Runs of the same letter collapse to one ("nuuude" -> "nude"). Matching also runs on this form, against terms collapsed the same way. */
const squash = (t: string): string => t.replace(/([a-z])\1+/g, '$1');

// Words are matched on whole-word boundaries after normalisation, so "class" never trips "ass" and "Essex" never trips "sex".
const TERMS: Record<Exclude<SafetyCategory, 'likeness' | 'oversize' | 'religious' | 'guarantee'>, string[]> = {
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
  { category: 'minors', re: /\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen) ?(?:year|yr)s? ?old (?:boy|girl|child|kid|son|daughter|student|person|guy|baby|brother|sister|youth)\b/ },
  { category: 'minors', plain: true, re: /\b(?:[1-9]|1[0-7]) ?(?:year|yr)s? ?old (?:boy|girl|child|kid|son|daughter|student|person|guy|baby|brother|sister|youth)\b|\b(?:boy|girl|child|kid|son|daughter|student|baby|brother|sister) (?:aged|age) (?:[1-9]|1[0-7])\b|\b(?:[1-9]|1[0-7]) ?yo\b/ },
  // Faith content. Ordinary faith talk ("my faith got me through", "God is my strength", "I read Psalm 23") is fine; showing or voicing holy figures,
  // mocking faith, and promising healing or wealth are not. The figure list is deliberately about depiction words (a video OF, playing, voice of), not mentions.
  { category: 'religious', re: /\b(?:depict\w*|portray\w*|play(?:s|ing|ed)? (?:the role of |the part of )?|act(?:s|ing|or|ors) (?:as|playing)|dressed as|costume of|looks? like|looking like|voice of|voiced by|speaks? as|speaking as|impersonat\w*|(?:video|image|picture|photo|scene|statue|vision|painting|drawing|portrait|likeness|face|appearance|animation|render(?:ing)?|clip) (?:of|as|showing|depicting)) (?:the |a |an |our )?(?:god|jesus|jesus christ|christ|allah|buddha|muhammad|mohammed|holy spirit|virgin mary|mary mother of god|satan|the devil|lucifer|moses|abraham|krishna|prophet|angel|angels|saint|pope)\b/ },
  { category: 'religious', re: /\b(?:show|shows|showing|bring|brings|bringing|put|puts|putting) (?:me |us |them )?(?:the |a |an |our )?(?:god|jesus|jesus christ|christ|allah|buddha|muhammad|mohammed|holy spirit|virgin mary|satan|the devil|lucifer|moses|abraham|krishna|prophet|angels?)\b (?:sitting|standing|walking|appearing|riding|sits|stands|walks|appears|next to|beside|on the|in the|inside|talking|speaking|saying)\b/ },
  // a holy figure doing something in the scene: "Jesus rides the train", "God appears in the car", "Allah talking to the guest", "a video where Jesus ..."
  { category: 'religious', re: /\b(?:god|jesus|jesus christ|christ|allah|buddha|muhammad|mohammed|muhammed|holy spirit|virgin mary|satan|the devil|lucifer|moses|abraham|krishna|prophet|angels?)\b (?:rides?|riding|sits?|sitting|stands?|standing|walks?|walking|appears?|appearing|talks?|talking|enters?|entering|joins?|joining|dances?|dancing|as a character|on the (?:train|subway|tube|metro|platform|bench)|in the (?:train|subway|car|carriage|station|video|scene|frame)|next to|beside|with the (?:host|guest))\b/ },
  { category: 'religious', re: /\b(?:video|scene|clip|movie|film|story|skit|sketch|cartoon|animation|image|picture) (?:where|in which|with|about|featuring|starring|of) (?:the |a |an )?(?:god|jesus|jesus christ|christ|allah|buddha|muhammad|mohammed|muhammed|holy spirit|virgin mary|satan|the devil|lucifer|moses|abraham|krishna|prophet|angels?)\b/ },
  { category: 'religious', re: /\b(?:parody|parodies|spoof|satire|skit|joke|jokes|meme|memes) (?:of|about|on|with) (?:the |a |an )?(?:god|jesus|jesus christ|christ|allah|buddha|muhammad|mohammed|muhammed|holy spirit|virgin mary|satan|the devil|lucifer|moses|abraham|krishna|prophet|angels?)\b/ },
  { category: 'religious', re: /\b(?:mock\w*|make fun of|ridicule\w*|blaspheme|blasphemy|parody|parodies|satiri[sz]e\w*|insult\w*|trash\w*|bash\w*) (?:the |a |an |their |his |her )?(?:bible|scripture|scriptures|faith|church|christians?|muslims?|islam|mormons?|hindus?|hinduism|buddhists?|buddhism|sikhs?|atheists?|catholics?|catholicism|jews|jewish people|judaism|religion|religious people|prayer|pastors?|priests?|nuns?|imams?|rabbis?|the pope|pope|quran|koran|god)\b/ },
  { category: 'guarantee', re: /\bguarantee\w*\b(?! (?:money|a )?(?:money[- ]?back|refund))(?:(?!money back|refund).){0,60}\b(?:rich|riches|wealth\w*|millionaire|healing|healed|heal|cure\w*|blessings?|prosper\w*|success|miracles?|breakthroughs?)\b|\b(?:rich|riches|wealth\w*|healing|healed|cure\w*|prosper\w*|miracles?)\b.{0,40}\bguarantee\w*\b/ },
  { category: 'guarantee', re: /\b(?:god|jesus|the lord|faith|prayer) (?:will|promises|guarantees|always|owes you)\b.{0,30}\b(?:make you rich|heal you|cure you|cure your|heal your (?:body|cancer|disease|illness|sickness|diabetes|tumou?r|pain|condition)|give you (?:money|wealth|a million|riches)|pay your|erase your debt|make you a millionaire)\b/ },
  { category: 'guarantee', re: /\b(?:pray|prayer|believe|faith|tithe|donate|give|send|sow)\w*\b.{0,50}\b(?:and then|and you will|you will|you ll|and it will|and god will)\b.{0,30}\b(?:be healed|cancer (?:will )?(?:disappear|be gone|go away)|disease (?:will )?(?:disappear|be gone)|get rich|become rich|become a millionaire|double your money|never be poor|get a miracle|be cured)\b/ },
  { category: 'guarantee', re: /\b(?:pray\w*|faith|believe\w*|god|jesus|the lord)\b.{0,60}\b(?:cancer|tumou?rs?|disease|illness|diabetes|debt)\b.{0,30}\b(?:disappear\w*|vanish\w*|be gone|go away|gone|healed|cured|erased|wiped)\b/ },
  { category: 'guarantee', re: /\b(?:seed (?:faith|offering|money)|sow (?:a )?seed|send (?:a )?seed offering|prosperity (?:gospel|guarantee))\b/ },
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
const wordReSquashed = (term: string) => new RegExp(`(?:^| )${esc(squash(normalize(term)))}(?: |$)`);
const test = (re: RegExp, reSq: RegExp, t: string, tSq: string): boolean => re.test(t) || reSq.test(tSq);
const COMPILED = (Object.entries(TERMS) as Array<[Exclude<SafetyCategory, 'likeness' | 'oversize' | 'religious' | 'guarantee'>, string[]]>).flatMap(([category, list]) => list.map(t => ({ category, re: wordRe(t), reSq: wordReSquashed(t) })));
const NAME_RES = NAMES.map(n => ({ re: wordRe(n), reSq: wordReSquashed(n) }));
const WEAK_MINOR = ['child', 'children', 'kid', 'kids', 'baby', 'babies', 'teen', 'teens', 'minor', 'boy', 'girl', 'son', 'daughter', 'student'].map(w => ({ re: wordRe(w), reSq: wordReSquashed(w) }));
const ADULT_HARM = COMPILED.filter(c => c.category === 'sexual' || c.category === 'violence');

export const MAX_TEXT = 20_000;
const OVERSIZE: SafetyResult = { ok: false, category: 'oversize', message: MESSAGES.oversize };

/** Check one piece of text. `extraTerms` are the operator's own blocked words and names (Latin letters; category: likeness). Text over the limit is refused, never half-checked. */
export function checkText(text: string, extraTerms: readonly string[] = []): SafetyResult {
  if (!text || typeof text !== 'string') return { ok: true };
  if (text.length > MAX_TEXT) return OVERSIZE;
  const first = scan(text, extraTerms);
  // the Cyrillic \u0443 looks like both "y" and "u": try it as a "u" too
  if (first.ok && text.includes('\u0443')) return scan(text.replace(/\u0443/g, 'u'), extraTerms);
  return first;
}

function scan(text: string, extraTerms: readonly string[]): SafetyResult {
  const t = normalize(text);
  if (!t) return { ok: true };
  const tSq = squash(t);
  const plain = normalize(text, false);   // digits kept, for age statements
  for (const p of PATTERNS) if (p.re.test(p.plain ? plain : t)) return { ok: false, category: p.category, message: MESSAGES[p.category] };
  // a word for a young person next to a sexual or violent word is always refused
  if (WEAK_MINOR.some(w => test(w.re, w.reSq, t, tSq)) && ADULT_HARM.some(c => test(c.re, c.reSq, t, tSq))) return { ok: false, category: 'minors', message: MESSAGES.minors };
  for (const c of COMPILED) if (test(c.re, c.reSq, t, tSq)) return { ok: false, category: c.category, message: MESSAGES[c.category] };
  for (const n of NAME_RES) if (test(n.re, n.reSq, t, tSq)) return { ok: false, category: 'likeness', message: MESSAGES.likeness };
  for (const term of extraTerms) {
    if (normalize(term) && test(wordRe(term), wordReSquashed(term), t, tSq)) return { ok: false, category: 'likeness', message: MESSAGES.likeness };
  }
  return { ok: true };
}

// Values that are known not to be free text. Everything else the customer sends is screened, whatever the field is called.
const ENUM_KEYS = new Set(['aspect_ratio', 'resolution', 'output_format', 'response_format', 'format', 'voice_id', 'model', 'quality', 'mode', 'speed', 'duration', 'seed', 'language', 'thinking_mode', 'enable_audio']);
const URL_KEY = /(?:^|_)urls?$|^(?:images?|videos?|audios?)_list$/;
const WHOLE_URL = /^https?:\/\/\S+$/;

export interface Collected { texts: string[]; truncated: boolean }
const LIMITS = { depth: 8, strings: 300, items: 200 };

/** Every string the customer wrote that will reach a model. A value that is entirely one URL is skipped; any other string is screened, even if it starts with "http". If a limit is hit, `truncated` says so and the caller refuses the request. */
export function collectText(body: unknown, c: Collected = { texts: [], truncated: false }, depth = 0): Collected {
  if (depth > LIMITS.depth) { c.truncated = true; return c; }
  if (typeof body === 'string') {
    if (WHOLE_URL.test(body.trim()) || body.length < 3) return c;
    if (c.texts.length >= LIMITS.strings) { c.truncated = true; return c; }
    c.texts.push(body);
  } else if (Array.isArray(body)) {
    if (body.length > LIMITS.items) c.truncated = true;
    for (const v of body.slice(0, LIMITS.items)) collectText(v, c, depth + 1);
  } else if (body && typeof body === 'object') {
    const entries = Object.entries(body as Record<string, unknown>);
    if (entries.length > LIMITS.items) c.truncated = true;
    for (const [k, v] of entries.slice(0, LIMITS.items)) {
      const key = k.toLowerCase();
      if (typeof v === 'string' && (ENUM_KEYS.has(key) || URL_KEY.test(key)) && (WHOLE_URL.test(v.trim()) || v.length <= 40)) continue;   // a URL or a short enum value
      collectText(v, c, depth + 1);
    }
  }
  return c;
}

/** Check a whole request body. The first problem wins; a body too big or too deep to check completely is refused. */
export function checkBody(body: unknown, extraTerms: readonly string[] = []): SafetyResult {
  const c = collectText(body);
  for (const s of c.texts) { const r = checkText(s, extraTerms); if (!r.ok) return r; }
  return c.truncated ? OVERSIZE : { ok: true };
}

export const SAFETY_CATEGORIES = Object.keys(MESSAGES) as SafetyCategory[];
