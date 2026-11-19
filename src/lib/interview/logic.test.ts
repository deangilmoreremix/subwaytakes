import { describe, expect, it, vi } from 'vitest';
vi.mock('../supabase', () => ({ supabase: {} }));
import { CUTS_COMPOSED_WORDS, DEFAULT_TAKE, FORMATS, NO_MIC_RULE, buildNativePrompt, buildStillPrompt, buildTwoShotStillPrompt, cutsPlan, guestWordBudget, isComposedShow, spokenLines, type TakeSpec } from './index';
import { batchSpecs } from './batch';
import { restoreSpec, snapshotSpec, type RestoreRules } from './snapshot';
import { SHOWS, applyShow, titleFor, type ShowId } from '../shows';
import { CITIES, cardMicPhrase } from '../places';
import { allVerses, pickVerse, typedVerse, TRANSLATIONS } from '../bible';
import { allQuotes, pickQuote } from '../quotes';
import { applyTakeEdit, editableField, editableText, isComposed, recomposeBible } from '../bible/spec';
import { checkText } from '../safety';
import { buildGuestStillPrompt } from '../muapi/prompt';
import { MAX_SCRIPT_CHARS } from '../muapi/lipsync';
import { TEMPLATES, applyTemplate, templateNeeds } from '../templates';
import { showLocked } from '../billing/features';

const open: RestoreRules = { showLocked: () => false, cutsLocked: false };
const verse0 = pickVerse(allVerses()[0], 'KJV');
const quote0 = pickQuote(allQuotes()[0]);
const BIBLE = (over: Partial<TakeSpec> = {}): TakeSpec => recomposeBible({ ...applyShow(DEFAULT_TAKE, 'bible'), verse: verse0, reflection: 'It slows me down when the week gets loud.', ...over });
const MOTIV = (over: Partial<TakeSpec> = {}): TakeSpec => recomposeBible({ ...applyShow(DEFAULT_TAKE, 'motivation'), quote: quote0, reflection: 'It helps on a flat Monday.', ...over });

describe('typing into the prompt bar changes the guest\'s own words, not the composed line', () => {
  it('Scripture and Motivation-with-a-quote edit the reflection; every other show edits the take', () => {
    expect(editableField(BIBLE())).toBe('reflection'); expect(editableField(MOTIV())).toBe('reflection');
    expect(editableField(applyShow(DEFAULT_TAKE, 'motivation'))).toBe('take'); expect(editableField(DEFAULT_TAKE)).toBe('take');
    for (const s of SHOWS.filter(x => x.id !== 'bible' && x.id !== 'motivation')) expect(editableField(applyShow(DEFAULT_TAKE, s.id as ShowId)), s.id).toBe('take');
    expect(isComposed(BIBLE())).toBe(true); expect(isComposed(applyShow(DEFAULT_TAKE, 'motivation'))).toBe(false);
  });
  it('an edit survives later changes (new verse, longer clip) and never compounds the line', () => {
    let s = applyTakeEdit(BIBLE({ durationSeconds: 15 }), 'My own words about this verse.');
    expect(s.reflection).toBe('My own words about this verse.'); expect(s.take).toContain('My own words');
    const again = applyTakeEdit(s, 'My own words about this verse.');
    expect(again.take).toBe(s.take);   // same input, same line: nothing piles up
    s = recomposeBible({ ...s, verse: pickVerse(allVerses()[5], 'WEB'), durationSeconds: 12 });
    expect(s.reflection).toBe('My own words about this verse.');
    expect(s.take.match(/says:/g)?.length ?? 0).toBeLessThanOrEqual(1);
  });
  it('the box shows the reflection for composed shows and the take otherwise, and limits typing to 220 characters', () => {
    expect(editableText(BIBLE())).toBe('It slows me down when the week gets loud.'); expect(editableText(DEFAULT_TAKE)).toBe(DEFAULT_TAKE.take);
    expect(applyTakeEdit(DEFAULT_TAKE, 'x'.repeat(500)).take.length).toBe(220);
    expect(applyTakeEdit(BIBLE(), '').reflection).toBe('');
  });
});

describe('what a project remembers about the episode (save, reload, reopen)', () => {
  const specs: Array<[string, TakeSpec]> = [
    ['hot take', DEFAULT_TAKE], ['scripture library verse', BIBLE({ durationSeconds: 12 })], ['scripture typed verse', BIBLE({ verse: typedVerse('Be still, and know that I am God.', 'Psalm 46:10') })],
    ['motivation with a quote', MOTIV({ durationSeconds: 12 })], ['motivation own advice', applyShow(DEFAULT_TAKE, 'motivation')],
    ...SHOWS.map(s => [`show ${s.id}`, recomposeBible(applyShow(DEFAULT_TAKE, s.id as ShowId))] as [string, TakeSpec]),
  ];
  it.each(specs)('round trip keeps %s exactly (spoken line and on-screen card)', (_n, spec) => {
    const snap = JSON.parse(JSON.stringify(snapshotSpec(spec)));   // through JSON like localStorage and the cloud save
    const back = restoreSpec(snap, open)!;
    expect(back).not.toBeNull(); expect(back.show).toBe(spec.show); expect(back.take).toBe(spec.take); expect(back.reflection).toBe(spec.reflection);
    expect(back.verse?.text).toBe(spec.verse?.text); expect(back.quote?.id).toBe(spec.quote?.id); expect(back.place).toEqual(spec.place); expect(back.tone).toBe(spec.tone);
    expect(titleFor(back)).toEqual(titleFor(spec));
  });
  it('a restored snapshot is stable: restoring twice gives the same episode', () => { for (const [, s] of specs) { const a = restoreSpec(snapshotSpec(s), open)!; expect(restoreSpec(snapshotSpec(a), open)).toEqual(a); } });
  it('verse and quote text always come from the verified libraries, never from the saved copy', () => {
    const snap = JSON.parse(JSON.stringify(snapshotSpec(BIBLE()))); snap.verse.text = 'TAMPERED TEXT'; snap.take = 'TAMPERED';
    const back = restoreSpec(snap, open)!; expect(back.verse!.text).toBe(verse0.text); expect(back.take).not.toContain('TAMPERED');
    const q = JSON.parse(JSON.stringify(snapshotSpec(MOTIV()))); q.take = 'TAMPERED'; expect(restoreSpec(q, open)!.quote!.text).toBe(quote0.text);
  });
  it('a verse or quote that no longer exists is dropped, not invented', () => {
    const s = JSON.parse(JSON.stringify(snapshotSpec(BIBLE()))); s.verse = { ref: 'Nope 99:99', translation: 'KJV' }; expect(restoreSpec(s, open)!.verse).toBeUndefined();
    const t = JSON.parse(JSON.stringify(snapshotSpec(BIBLE()))); t.verse.translation = 'NIV'; expect(restoreSpec(t, open)!.verse).toBeUndefined();   // not an offered translation
    const q = JSON.parse(JSON.stringify(snapshotSpec(MOTIV()))); q.quoteId = 'gone-1'; expect(restoreSpec(q, open)!.quote).toBeUndefined();
  });
  it('never unlocks a pack or a format: a locked show restores as the default show with none of its text, a locked Cuts becomes Two-shot', () => {
    const locked: RestoreRules = { showLocked: id => id === 'bible' || id === 'motivation' || id === 'happiness', cutsLocked: true };
    for (const spec of [BIBLE(), MOTIV(), applyShow(DEFAULT_TAKE, 'happiness')]) { const b = restoreSpec(snapshotSpec(spec), locked)!; expect(b.show).toBe(DEFAULT_TAKE.show); expect(b.verse).toBeUndefined(); expect(b.quote).toBeUndefined(); expect(b.reflection).toBeUndefined(); expect(b.take).toBe(DEFAULT_TAKE.take); }
    expect(restoreSpec(snapshotSpec({ ...DEFAULT_TAKE, format: 'cuts' }), locked)!.format).toBe('twoshot');
    expect(restoreSpec(snapshotSpec({ ...DEFAULT_TAKE, format: 'cuts' }), open)!.format).toBe('cuts');
  });
  it('bad or hostile saved data falls back safely', () => {
    for (const junk of [null, undefined, 5, 'x', [], {}, { v: 2, show: 'hot_take' }, { v: 1 }, { v: 1, show: 7 }]) expect(restoreSpec(junk, open)).toBeNull();
    const base = JSON.parse(JSON.stringify(snapshotSpec(DEFAULT_TAKE)));
    const b = restoreSpec({ ...base, show: 'not_a_show', tone: 'angry', durationSeconds: 9999, aspect: '4:3', format: 'hologram', place: { city: 'atlantis', scene: 7, ambience: ['x', 'footsteps'], custom: 'y'.repeat(999) }, take: 'z'.repeat(5000) }, open)!;
    expect(b.show).toBe(DEFAULT_TAKE.show); expect(b.durationSeconds).toBe(12); expect(b.aspect).toBe('9:16'); expect(b.format).toBe(DEFAULT_TAKE.format);
    expect(CITIES.some(c => c.id === b.place.city)).toBe(true); expect(b.place.ambience).toEqual(['footsteps']); expect((b.place.custom ?? '').length).toBeLessThanOrEqual(200);
    expect(restoreSpec({ ...base, durationSeconds: 1 }, open)!.durationSeconds).toBe(4);
    expect(restoreSpec({ ...base, durationSeconds: 'abc' }, open)!.durationSeconds).toBe(DEFAULT_TAKE.durationSeconds);
    expect(restoreSpec({ ...base, take: 'z'.repeat(5000) }, open)!.take.length).toBeLessThanOrEqual(600);
  });
  it('an old project with no snapshot simply has nothing to restore', () => { expect(restoreSpec(undefined, open)).toBeNull(); });
});

describe('every show x format x city builds safe prompts that keep the rules', () => {
  const cities = ['nyc', 'london', 'tokyo', 'paris', 'generic', 'custom', ...CITIES.map(c => c.id).filter((_, i) => i % 5 === 0)].filter((c, i, a) => a.indexOf(c) === i);
  const forShow = (show: ShowId, format: TakeSpec['format'], city: string): TakeSpec => {
    const base = { ...applyShow(DEFAULT_TAKE, show), format, place: { ...DEFAULT_TAKE.place, city }, durationSeconds: 8 };
    return show === 'bible' ? recomposeBible({ ...base, verse: verse0, reflection: 'It steadies me.' }) : show === 'motivation' ? recomposeBible({ ...base, quote: quote0, reflection: 'It helps.' }) : base;
  };
  it('prompts pass the screen, keep the city\'s own card and the card-as-mic rule, and never say MetroCard outside NYC', () => {
    for (const show of SHOWS) for (const format of FORMATS.map(f => f.id)) for (const city of cities) {
      const spec = forShow(show.id as ShowId, format, city); const tag = `${show.id}/${format}/${city}`;
      const prompts = [buildNativePrompt(spec), buildStillPrompt(spec, 'host'), buildStillPrompt(spec, 'guest'), buildTwoShotStillPrompt(spec), buildGuestStillPrompt(spec), ...cutsPlan(spec).map(p => p.portraitPrompt)];
      for (const p of prompts) { const r = checkText(p); expect(r.ok, `${tag}: ${r.ok ? '' : r.category}`).toBe(true); if (city !== 'nyc') expect(p, tag).not.toContain('MetroCard'); }
      const native = buildNativePrompt(spec); expect(native, tag).toContain(NO_MIC_RULE); expect(native, tag).toContain(cardMicPhrase(city));
    }
  });
  it('the guest line is always inside the clip budget (Two-shot and Solo) and never cut mid-verse or mid-quote', () => {
    for (const show of ['bible', 'motivation'] as ShowId[]) for (const secs of [4, 8, 12]) for (const format of ['twoshot', 'solo'] as const) {
      const s = forShow(show, format, 'nyc'); const s2 = { ...s, durationSeconds: secs }; const r = recomposeBible(s2);
      expect(spokenLines(r).trimmed, `${show}/${secs}s`).toBe(false); expect(r.take.split(/\s+/).length).toBeLessThanOrEqual(guestWordBudget(r));
    }
  });
  it('the on-screen card follows the show for every show and aspect-independent spec', () => {
    for (const show of SHOWS) { const t = titleFor(forShow(show.id as ShowId, 'twoshot', 'nyc')); expect(t.headline.length, show.id).toBeGreaterThan(0); expect(t.badge, show.id).toBe(show.badge); }
    expect(titleFor(BIBLE()).variant).toBe('verse'); expect(titleFor(MOTIV()).variant).toBe('quote'); expect(titleFor(applyShow(DEFAULT_TAKE, 'motivation')).variant).toBe('take');
  });
});

describe('Cuts reads the whole verse or quote exactly (it is not squeezed into the clip-length slider)', () => {
  it('a composed show gets the Cuts budget, other shows keep the slider budget', () => {
    expect(guestWordBudget({ ...BIBLE(), format: 'cuts' })).toBe(CUTS_COMPOSED_WORDS); expect(guestWordBudget({ ...BIBLE(), format: 'twoshot' })).toBeLessThan(CUTS_COMPOSED_WORDS);
    expect(guestWordBudget({ ...DEFAULT_TAKE, format: 'cuts' })).toBe(guestWordBudget({ ...DEFAULT_TAKE, format: 'twoshot' }));
    expect(isComposedShow(MOTIV())).toBe(true); expect(isComposedShow(applyShow(DEFAULT_TAKE, 'motivation'))).toBe(false);
  });
  it('EVERY library verse in EVERY translation is spoken in full in Cuts at the default clip length, with the longest reflection, and fits the lip-sync script limit', () => {
    const reflection = 'x'.repeat(0) + 'It reminds me that I am not alone and that every hard week passes, and I read it again each morning on the train before work starts and the day gets loud.'.slice(0, 220);
    for (const v of allVerses()) for (const t of TRANSLATIONS) {
      const spec = recomposeBible({ ...applyShow(DEFAULT_TAKE, 'bible'), format: 'cuts', durationSeconds: 8, verse: pickVerse(v, t), reflection });
      const plan = cutsPlan(spec); const guest = plan.find(p => p.role === 'guest')!.text;
      expect(guest, `${v.ref} ${t}`).toContain(pickVerse(v, t).text); expect(spokenLines(spec).trimmed, `${v.ref} ${t}`).toBe(false);
      expect(guest.length, `${v.ref} ${t}`).toBeLessThanOrEqual(MAX_SCRIPT_CHARS);
    }
  });
  it('EVERY quote is spoken in full in Cuts, with the author, within the script limit', () => {
    for (const q of allQuotes()) {
      const spec = recomposeBible({ ...applyShow(DEFAULT_TAKE, 'motivation'), format: 'cuts', durationSeconds: 8, quote: pickQuote(q), reflection: 'This is a fairly long comment about why this matters to me when work gets hard and I feel behind and tired.' });
      const guest = cutsPlan(spec).find(p => p.role === 'guest')!.text;
      expect(guest, q.id).toContain(q.text); expect(guest, q.id).toContain(q.author); expect(guest.length, q.id).toBeLessThanOrEqual(MAX_SCRIPT_CHARS);
    }
  });
  it('the host line is the show\'s own question and the guest line is never empty', () => { for (const s of [BIBLE(), MOTIV()]) { const p = cutsPlan({ ...s, format: 'cuts' }); expect(p[0].role).toBe('host'); expect(p[1].text.length).toBeGreaterThan(5); } });
  it('changing to Cuts recomposes (the line stops being squeezed) and back to Two-shot re-fits it', () => {
    const tw = BIBLE({ durationSeconds: 8 }); const cuts = recomposeBible({ ...tw, format: 'cuts' }); const back = recomposeBible({ ...cuts, format: 'twoshot' });
    expect(cuts.take.length).toBeGreaterThan(tw.take.length); expect(back.take).toBe(tw.take);
  });
});

describe('batches of Scripture and Motivation episodes', () => {
  const questions = ['What verse got you through this week?', 'What verse do you read when you cannot sleep?', 'What is the one verse you would read to someone who has had a very long, hard, tiring and confusing year at work?'];
  it('each episode re-fits the spoken verse to its own question and nothing is cut mid-verse', () => {
    for (const secs of [8, 12]) { const base = BIBLE({ durationSeconds: secs }); const { specs, problem } = batchSpecs(base, questions); expect(problem).toBeNull(); expect(specs).toHaveLength(3);
      for (const s of specs) { expect(spokenLines(s).trimmed).toBe(false); expect(s.take.split(/\s+/).length).toBeLessThanOrEqual(guestWordBudget(s)); expect(s.verse?.text).toBe(verse0.text); } }
  });
  it('a Motivation quote batch keeps the quote on every episode; own-advice batches use the lines as the take', () => {
    const { specs } = batchSpecs(MOTIV({ durationSeconds: 12 }), ['What got you through your hardest day?', 'What do you tell yourself when you want to quit?']);
    for (const s of specs) { expect(s.quote?.id).toBe(quote0.id); expect(spokenLines(s).trimmed).toBe(false); }
    const own = batchSpecs(applyShow(DEFAULT_TAKE, 'hot_take'), ['A take.', 'Another take.']); expect(own.specs.map(s => s.take)).toEqual(['A take.', 'Another take.']);
  });
  it('Debate duels cannot be batched', () => { expect(batchSpecs(applyShow(DEFAULT_TAKE, 'duel'), ['a']).problem).toMatch(/Debate duels/); });
});

describe('packs and templates', () => {
  it('a locked show is reported as locked for exactly its own pack, and templates ask for the right unlock', () => {
    for (const t of TEMPLATES) { const needs = templateNeeds(t, []); const locked = showLocked(t.show, []); expect(needs.includes(t.show === 'bible' ? 'bible' : t.show === 'motivation' ? 'motivation' : 'happiness') || !locked, t.id).toBe(true); }
    expect(templateNeeds(TEMPLATES.find(t => t.show === 'bible')!, [])).toContain('bible'); expect(templateNeeds(TEMPLATES.find(t => t.show === 'bible')!, ['bible'])).not.toContain('bible');
    expect(templateNeeds(TEMPLATES.find(t => t.show === 'motivation')!, ['bible'])).toContain('motivation');
  });
  it('every template applies to a spec that restores cleanly and builds screen-safe prompts', () => {
    for (const t of TEMPLATES) { const spec = recomposeBible(applyTemplate(DEFAULT_TAKE, t).spec); const back = restoreSpec(snapshotSpec(spec), open)!; expect(back.show, t.id).toBe(t.show); expect(checkText(buildNativePrompt(back)).ok, t.id).toBe(true); }
  });
});

describe('what a customer types is screened before any credit is reserved', () => {
  const hostile: Array<[string, Partial<TakeSpec>]> = [
    ['a typed verse that depicts a holy figure', { verse: typedVerse('A video of Jesus walking through the train car', 'Scripture') }],
    ['a reflection that promises healing', { reflection: 'Pray and your cancer will disappear, God guarantees it.' }],
    ['a reflection about a child', { reflection: 'My 9 year old boy sits next to me and reads it.' }],
    ['a reflection naming a celebrity', { reflection: 'Taylor Swift reads this one with me.' }],
  ];
  it.each(hostile)('Scripture refuses %s in the prompt', (_n, over) => { const p = buildNativePrompt(BIBLE(over)); expect(checkText(p).ok).toBe(false); });
  it('Motivation refuses hostile comments on a quote and hostile own advice', () => {
    expect(checkText(buildNativePrompt(MOTIV({ reflection: 'God will make you rich if you send a seed offering.' }))).ok).toBe(false);
    expect(checkText(buildNativePrompt({ ...applyShow(DEFAULT_TAKE, 'motivation'), take: 'Make a nude video of me.' })).ok).toBe(false);
  });
  it('ordinary faith talk and ordinary advice still pass, typed or from the libraries', () => {
    expect(checkText(buildNativePrompt(BIBLE({ reflection: 'My faith got me through a hard year and I read Psalm 23 every morning.' }))).ok).toBe(true);
    expect(checkText(buildNativePrompt(BIBLE({ verse: typedVerse('The Lord is my shepherd; I shall not want.', 'Psalm 23:1') }))).ok).toBe(true);
    expect(checkText(buildNativePrompt(MOTIV({ reflection: 'Do the next small thing, then the one after it.' }))).ok).toBe(true);
  });
});
