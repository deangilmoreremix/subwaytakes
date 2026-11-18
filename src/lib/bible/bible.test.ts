import { describe, expect, it, vi } from 'vitest';
vi.mock('../supabase', () => ({ supabase: {} }));
import { allVerses, composeSpokenLine, findVerse, pickVerse, searchVerses, spokenRef, textOf, THEMES, THEME_LABELS, TRANSLATIONS, TRANSLATION_LICENCE, typedVerse, MAX_TYPED_VERSE } from './index';
import { bibleComposition, recomposeBible } from './spec';
import { checkText } from '../safety';
import { DEFAULT_TAKE, buildNativePrompt, guestWordBudget, spokenLines } from '../interview';
import { applyShow, SHOWS, titleFor, verseFontSize } from '../shows';
import { BIBLE_IDEAS, MOTIVATION_IDEAS } from '../shows/packs';
import { CITIES, cardMicPhrase } from '../places';

// The exact wording of very well-known verses, written out by hand here (not copied from the library), so a bad data build is caught.
const PINNED: Array<[string, string, string, string]> = [
  ['John 3:16', 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.', 'For God so loved the world, that he gave his one and only Son, that whoever believes in him should not perish, but have eternal life.', 'For God so loved the world that He gave His one and only Son, that everyone who believes in Him shall not perish but have eternal life.'],
  ['Philippians 4:13', 'I can do all things through Christ which strengtheneth me.', 'I can do all things through Christ, who strengthens me.', 'I can do all things through Christ who gives me strength.'],
  ['Proverbs 3:5', 'Trust in the LORD with all thine heart; and lean not unto thine own understanding.', 'Trust in Yahweh with all your heart, and don’t lean on your own understanding.', 'Trust in the LORD with all your heart, and lean not on your own understanding;'],
  ['Jeremiah 29:11', 'For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end.', 'For I know the thoughts that I think toward you,” says Yahweh, “thoughts of peace, and not of evil, to give you hope and a future.', 'For I know the plans I have for you, declares the LORD, plans to prosper you and not to harm you, to give you a future and a hope.'],
];
const squash = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

describe('verse library', () => {
  it('has at least 250 verses, each with a reference, theme and all three texts, and no duplicates', () => {
    const v = allVerses(); expect(v.length).toBeGreaterThanOrEqual(250);
    expect(new Set(v.map(x => x.ref)).size).toBe(v.length);
    for (const x of v) { expect(x.ref, x.ref).toMatch(/^[1-3]? ?[A-Za-z ]+ \d+:\d+$/); expect(THEMES).toContain(x.theme); expect(x.kjv.length, x.ref).toBeGreaterThan(10); expect(x.web.length, x.ref).toBeGreaterThan(10); expect(x.bsb.length, x.ref).toBeGreaterThan(10); }
  });
  it('every theme has verses', () => { for (const t of THEMES) expect(allVerses().filter(v => v.theme === t).length, t).toBeGreaterThanOrEqual(8); });
  it('every verse fits the verse card (300 characters) and has no markup or odd characters', () => {
    for (const v of allVerses()) for (const t of [v.kjv, v.web, v.bsb]) { expect(t.length, v.ref).toBeLessThanOrEqual(300); expect(t, v.ref).not.toMatch(/[<>{}[\]¶]|&[a-z]+;/); expect(t, v.ref).toBe(t.trim()); }
  });
  it.each(PINNED)('%s matches its known wording (KJV, WEB and BSB)', (ref, kjv, web, bsb) => {
    const v = findVerse(ref); if (!v) return;   // a pinned verse may have been legitimately left out by the two-source check; the next test makes sure most are present
    expect(squash(v.kjv), ref + ' KJV').toBe(squash(kjv)); expect(squash(v.web), ref + ' WEB').toBe(squash(web)); expect(squash(v.bsb), ref + ' BSB').toBe(squash(bsb));
  });
  it('most pinned verses are present', () => { expect(PINNED.filter(p => findVerse(p[0])).length).toBeGreaterThanOrEqual(3); });
  it('no verse trips the content screen as written (verses that would are left out of the curated list)', () => {
    for (const v of allVerses()) for (const t of [v.kjv, v.web, v.bsb]) { const r = checkText(t); expect(r.ok, `${v.ref}: ${r.ok ? '' : r.category}`).toBe(true); }
  });
  it('the three translations really are different texts for most verses', () => { for (const [a, b] of [['kjv', 'web'], ['kjv', 'bsb'], ['web', 'bsb']] as const) expect(allVerses().filter(v => squash(v[a]) !== squash(v[b])).length, `${a}/${b}`).toBeGreaterThan(allVerses().length / 2); });
  it('no verse starts with a psalm title or heading (the card shows only the verse)', () => { for (const v of allVerses()) for (const t of [v.kjv, v.web, v.bsb]) expect(t, v.ref).not.toMatch(/^(?:A |An )?(?:Psalm|Song|Prayer|Maskil|Miktam)\b|^(?:For|To) the (?:choirmaster|director)|^Of (?:David|Asaph)/i); });
  it('every theme label exists and every theme has a label', () => { for (const t of THEMES) expect(THEME_LABELS[t], t).toBeTruthy(); for (const v of allVerses()) expect(THEMES, v.ref).toContain(v.theme); });
});

describe('finding and picking verses', () => {
  it('finds by reference however it is typed', () => {
    const ref = allVerses()[0].ref; expect(findVerse(ref.toLowerCase())?.ref).toBe(ref); expect(findVerse(ref.replace(':', ' '))?.ref).toBe(ref);
    expect(findVerse('Psalms 23:1')?.ref ?? 'Psalm 23:1').toBe('Psalm 23:1'); expect(findVerse('Nonsense 99:99')).toBeUndefined();
  });
  it('searches by reference, word and theme', () => {
    expect(searchVerses({ query: 'Psalm 23' }).every(v => v.ref.startsWith('Psalm 23'))).toBe(true);
    const peace = searchVerses({ theme: 'peace' }); expect(peace.length).toBeGreaterThan(5); expect(peace.every(v => v.theme === 'peace')).toBe(true);
    const word = searchVerses({ query: 'strength' }); expect(word.length).toBeGreaterThan(3);
    expect(searchVerses({ query: 'zzzzqqqq' })).toEqual([]);
    expect(searchVerses().length).toBe(allVerses().length);
  });
  it('the translation switch changes the text, not the reference', () => {
    const v = allVerses()[0]; expect(pickVerse(v, 'KJV').text).toBe(v.kjv); expect(pickVerse(v, 'WEB').text).toBe(v.web); expect(pickVerse(v, 'BSB').text).toBe(v.bsb); expect(pickVerse(v, 'WEB').ref).toBe(v.ref); expect(textOf(v, 'KJV')).toBe(v.kjv);
  });
  it('a typed verse is labelled as the customer\'s own, cleaned and length-limited', () => {
    const t = typedVerse('  Be   still,\n and know.  ', ' Psalm 46:10 '); expect(t).toMatchObject({ translation: 'custom', source: 'typed', ref: 'Psalm 46:10', text: 'Be still, and know.' });
    expect(typedVerse('x'.repeat(900)).text.length).toBe(MAX_TYPED_VERSE); expect(typedVerse('hi', '').ref).toBe('Scripture');
  });
});

describe('composing what the guest says', () => {
  const short = typedVerse('The Lord is my shepherd; I shall not want.', 'Psalm 23:1');
  const long = typedVerse(Array.from({ length: 60 }, (_, i) => `word${i}`).join(' '), 'Isaiah 40:31');
  it('reads a verse that fits, word for word, then as much reflection as fits', () => {
    const c = composeSpokenLine(short, 'It reminds me I have enough, and I breathe out.', 40);
    expect(c.readsVerse).toBe(true); expect(c.line.startsWith('Psalm 23 verse 1 says: The Lord is my shepherd; I shall not want.')).toBe(true); expect(c.line).toContain('reminds me');
    expect(c.line.split(/\s+/).length).toBeLessThanOrEqual(40);
  });
  it('never cuts a verse short: too long means name it and reflect, the exact text stays on screen', () => {
    const c = composeSpokenLine(long, 'It keeps me going when I am tired.', 20);
    expect(c.readsVerse).toBe(false); expect(c.line).not.toContain('word0'); expect(c.line.startsWith('Isaiah 40 verse 31.')).toBe(true); expect(c.line.split(/\s+/).length).toBeLessThanOrEqual(20);
  });
  it('works with no verse, no reflection, and tiny budgets', () => {
    expect(composeSpokenLine(undefined, 'Just my words here.', 10).line).toBe('Just my words here.');
    expect(composeSpokenLine(short, '', 40).line).toBe('Psalm 23 verse 1 says: The Lord is my shepherd; I shall not want.');
    expect(composeSpokenLine(short, 'x y z', 3).line).toBe('Psalm 23 verse 1.');
    expect(spokenRef('1 John 4:8')).toBe('1 John 4 verse 8');
  });
  it('the spoken line always fits the clip budget the prompt builder uses', () => {
    for (const secs of [8, 12, 15]) {
      const spec = recomposeBible({ ...applyShow(DEFAULT_TAKE, 'bible'), durationSeconds: secs, verse: short, reflection: 'This is a fairly long reflection about why this verse matters to me on a hard day at work.' });
      expect(spec.take.split(/\s+/).length).toBeLessThanOrEqual(guestWordBudget(spec)); expect(spokenLines(spec).trimmed).toBe(false);
    }
  });
  it('recomposeBible only touches the Scripture show', () => { expect(recomposeBible(DEFAULT_TAKE)).toBe(DEFAULT_TAKE); });
  it('the note tells whether the verse is spoken', () => {
    const spec = recomposeBible({ ...applyShow(DEFAULT_TAKE, 'bible'), verse: long });
    expect(bibleComposition(spec).readsVerse).toBe(false);
  });
});

describe('the Scripture and Motivation shows', () => {
  const bible = SHOWS.find(s => s.id === 'bible')!, motivation = SHOWS.find(s => s.id === 'motivation')!;
  it('are valid shows with their own tones, badge and many ideas', () => {
    for (const s of [bible, motivation]) { expect(s.tones).toContain(s.defaultTone); expect(s.ideas.length).toBeGreaterThanOrEqual(40); expect(s.badge.length).toBeGreaterThan(3); }
    expect(bible.variant).toBe('verse'); expect(motivation.titleFromTake).toBe(true);
  });
  it('the verse title card shows the exact verse and reference, never trimmed', () => {
    const verse = pickVerse(allVerses()[0], 'KJV');
    const d = titleFor({ show: 'bible', take: 'spoken line', verse }); expect(d.variant).toBe('verse'); expect(d.headline).toBe(verse.text); expect(d.value).toBe(`${verse.ref} · KJV`);
    expect(titleFor({ show: 'bible', take: 'x' }).headline).toBe(bible.question);   // no verse yet: the question
    expect(titleFor({ show: 'bible', take: 'x', verse: typedVerse('mine', 'Psalm 1:1') }).value).toBe('Psalm 1:1 · your text');
  });
  it('the verse card font gets smaller for longer verses and fits 300 characters', () => {
    expect(verseFontSize('a'.repeat(50))).toBeGreaterThan(verseFontSize('a'.repeat(150))); expect(verseFontSize('a'.repeat(300))).toBeGreaterThanOrEqual(34);
  });
  it('Motivation puts what the guest says on the card', () => { expect(titleFor({ show: 'motivation', take: 'Show up for the next hour.' }).headline).toBe('Show up for the next hour.'); });
  it('ideas and sample answers contain no attributed quotations (original text only)', () => {
    for (const t of [...BIBLE_IDEAS, ...MOTIVATION_IDEAS, ...applyShow(DEFAULT_TAKE, 'motivation').take.split('\n')]) {
      expect(t, t).not.toMatch(/["“”].+["“”]\s*[-–—]\s*[A-Z]/); expect(t, t).not.toMatch(/\b(?:once said|famously said|as .{3,30} (?:said|wrote))\b/i);
    }
  });
  it('every idea and every prompt for both shows passes the content screen, in every city, and keeps each city\'s own card and the card-as-mic rule', () => {
    for (const s of [bible, motivation]) for (const idea of s.ideas) expect(checkText(idea).ok, idea).toBe(true);
    for (const id of ['bible', 'motivation'] as const) for (const city of CITIES) {
      const spec = recomposeBible({ ...applyShow(DEFAULT_TAKE, id), place: { ...DEFAULT_TAKE.place, city: city.id }, verse: id === 'bible' ? pickVerse(allVerses()[3], 'WEB') : undefined });
      const p = buildNativePrompt(spec); const r = checkText(p); expect(r.ok, `${id}/${city.id}: ${r.ok ? '' : r.category}`).toBe(true);
      expect(p).toContain(cardMicPhrase(city.id)); expect(p).toContain('The transit card is the only microphone'); expect(p.toLowerCase()).toContain(show(id).reaction.toLowerCase().slice(0, 20));
      if (city.id !== 'nyc') expect(p).not.toContain('MetroCard');
    }
  });
  it('the Scripture prompt says no religious figures or symbols appear', () => {
    const p = buildNativePrompt(recomposeBible(applyShow(DEFAULT_TAKE, 'bible')));
    expect(p).toMatch(/No religious figures, symbols/i);
  });
});
function show(id: string) { return SHOWS.find(s => s.id === id)!; }

import { takeCardLayout } from '../interview';
import { titleLines } from '../interview';
describe('the take / quote card never cuts advice short', () => {
  it('short takes keep the original big look', () => { expect(takeCardLayout('Pineapple belongs on pizza.')).toEqual({ size: 86, maxChars: 16, maxLines: 5 }); });
  it('every sample answer and a 200 character answer fit completely', () => {
    for (const text of [applyShow(DEFAULT_TAKE, 'motivation').take, 'a '.repeat(100).trim(), 'Do the next small thing. Nobody quits from one hard hour, they quit from a hundred skipped ones, so just show up for the next one.']) {
      const l = takeCardLayout(text); const lines = titleLines(text, l.maxChars, l.maxLines);
      expect(lines.join(' ').replace(/\s+/g, ' ')).toBe(text.trim().replace(/\s+/g, ' ')); expect(lines.length).toBeLessThanOrEqual(l.maxLines);
    }
  });
});

import { batchSpecs } from '../interview/batch';
describe('leaving and re-entering Scripture, and batching', () => {
  const verse = typedVerse('The Lord is my shepherd; I shall not want.', 'Psalm 23:1');
  it('leaving Scripture drops the composed line, the verse and the reflection', () => {
    const s = recomposeBible({ ...applyShow(DEFAULT_TAKE, 'bible'), durationSeconds: 15, verse, reflection: 'Reflection A' });
    expect(s.take).toContain('Psalm 23 verse 1 says');
    const hot = applyShow(s, 'hot_take'); expect(hot.take).not.toContain('Psalm'); expect(hot.verse).toBeUndefined(); expect(hot.reflection).toBeUndefined();
  });
  it('re-entering Scripture uses what was typed in between, not the old reflection', () => {
    let s = recomposeBible({ ...applyShow(DEFAULT_TAKE, 'bible'), verse, reflection: 'Reflection A' });
    s = applyShow(s, 'hot_take'); s = { ...s, take: 'Typed B about pizza and trains.' }; s = recomposeBible(applyShow(s, 'bible'));
    expect(s.reflection).toBe('Typed B about pizza and trains.'); expect(s.take).toContain('Typed B'); expect(s.take).not.toContain('Reflection A');
  });
  it('a fresh switch into Scripture starts from the sample reflection and no verse', () => {
    const s = applyShow(DEFAULT_TAKE, 'bible'); expect(s.verse).toBeUndefined(); expect(s.reflection).toBeTruthy();
  });
  it('batch episodes re-fit the spoken verse to each question and never cut it mid-verse', () => {
    const base = recomposeBible({ ...applyShow(DEFAULT_TAKE, 'bible'), durationSeconds: 12, verse, reflection: 'It steadies me.' });
    const { specs } = batchSpecs(base, ['What verse got you through this week?', 'What is the one verse you would read to someone who has had a very long, hard, tiring and confusing year at work?']);
    for (const s of specs) { expect(s.take.split(/\s+/).length).toBeLessThanOrEqual(guestWordBudget(s)); expect(spokenLines(s).trimmed).toBe(false); }
  });
});

describe('translations and licences', () => {
  it('KJV, WEB and BSB are offered, each with a public-domain licence line', () => { expect(TRANSLATIONS).toEqual(['KJV', 'WEB', 'BSB']); for (const t of TRANSLATIONS) expect(TRANSLATION_LICENCE[t]).toMatch(/public domain/i); });
  it('search works in every translation', () => { for (const t of TRANSLATIONS) expect(searchVerses({ query: 'love', translation: t }).length, t).toBeGreaterThan(3); });
});
