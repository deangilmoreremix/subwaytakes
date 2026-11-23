import { describe, expect, it } from 'vitest';
import { CITIES, DEFAULT_PLACE } from '../places';
import { DEFAULT_TAKE, buildNativePrompt, cutsPlan, cutsProblem, spokenLines, type TakeSpec } from '../interview';
import { SAMPLE_ANSWERS, SHOWS, TONE_TEXT, applyShow, extractNumber, extractScore, showOf, splitOptions, splitStatements, titleFor, type ShowId } from './index';
import { resolveTitle } from './stored';

const spec = (id: ShowId, p: Partial<TakeSpec> = {}): TakeSpec => applyShow({ ...DEFAULT_TAKE, ...p }, id);

describe('the show catalogue', () => {
  it('has sixteen shows with unique ids, badges and ideas', () => {
    expect(SHOWS).toHaveLength(16);
    expect(new Set(SHOWS.map(s => s.id)).size).toBe(16);
    expect(new Set(SHOWS.map(s => s.badge)).size).toBe(16);
    for (const s of SHOWS) {
      expect(s.ideas.length, s.id).toBeGreaterThanOrEqual(3);
      expect(s.tones, s.id).toContain(s.defaultTone);
      for (const t of s.tones) expect(TONE_TEXT[t], `${s.id}/${t}`).toBeTruthy();
      expect(SAMPLE_ANSWERS[s.id].length, s.id).toBe(s.guests);
    }
  });
  it('only Hot Take has the fixed opener', () => {
    expect(SHOWS.filter(s => !s.editableQuestion).map(s => s.id)).toEqual(['hot_take']);
    expect(showOf('hot_take').question).toBe("So what's ur take?");
  });
});

describe('every show keeps the card-as-mic grammar', () => {
  for (const s of SHOWS) {
    it(`${s.id}: card is the only microphone, in every city`, () => {
      for (const c of CITIES.filter(x => x.id !== 'custom')) {
        const t = spec(s.id, { place: { ...DEFAULT_PLACE, city: c.id } });
        const out = buildNativePrompt(t);
        expect(out, `${s.id}/${c.id}`).toContain(c.card);
        expect(out).toMatch(/only microphone/);
        expect(out).toMatch(/no real microphone/);
        if (c.id !== 'nyc') expect(out, `${s.id}/${c.id} leaked the NYC card`).not.toContain('MetroCard');
      }
    });
  }
});

describe('shows do not leak into each other', () => {
  it('asks the show\'s own question and uses its own reaction', () => {
    const h = buildNativePrompt(spec('happiness'));
    expect(h).toContain('What made you smile today?');
    expect(h).toContain('warm high-five');
    expect(h).not.toContain("So what's ur take?");
    const hot = buildNativePrompt(spec('hot_take'));
    expect(hot).toContain("So what's ur take?");
    expect(hot).not.toContain('smile today');
  });
  it('uses the tone text of the chosen tone', () => expect(buildNativePrompt(spec('happiness', { tone: 'grateful' }))).toContain(TONE_TEXT.grateful));
  it('adds the guard rail only where a show has one', () => {
    expect(buildNativePrompt(spec('happiness'))).toMatch(/No minors, no medical or therapy claims/);
    expect(buildNativePrompt(spec('reveal'))).toMatch(/fictional AI-generated/);
    expect(buildNativePrompt(spec('hot_take'))).not.toMatch(/No minors/);
  });
});

describe('switching shows', () => {
  it('sets the question, an allowed tone and place defaults', () => {
    const t = spec('reveal', { tone: 'heated' });
    expect(t.question).toBe('How much do you pay in rent?');
    expect(showOf('reveal').tones).toContain(t.tone);
    expect(t.place.mode).toBe('street');
    expect(spec('happiness').place.time).toBe('golden_hour');
  });
  it('replaces an untouched answer with the show\'s sample but never a typed one', () => {
    expect(spec('happiness').take).toBe(SAMPLE_ANSWERS.happiness[0]);
    expect(spec('happiness', { take: 'My own words about my day.' }).take).toBe('My own words about my day.');
    expect(spec('hot_take', { take: '' }).take).toBe(SAMPLE_ANSWERS.hot_take[0]);
  });
  it('clears the question for Hot Take and keeps guest B only for the duel', () => {
    expect(spec('hot_take').question).toBeUndefined();
    expect(spec('duel').take2).toBe(SAMPLE_ANSWERS.duel[1]);
  });
});

describe('spoken lines', () => {
  it('uses the show question as the host line', () => expect(spokenLines(spec('one_question')).host).toBe('Would you ever forgive a friend who lied to protect you?'));
  it('a longer question leaves fewer words for the answer', () => {
    const long = Array.from({ length: 80 }, (_, i) => `w${i}`).join(' ');
    const short = spokenLines({ take: long, durationSeconds: 8, show: 'hot_take' }).guest.split(' ').length;
    const withQ = spokenLines({ take: long, durationSeconds: 8, show: 'would_you_rather' }).guest.split(' ').length;
    expect(withQ).toBeLessThan(short);
  });
  it('splits the answer time between the two duel guests', () => {
    const long = Array.from({ length: 80 }, (_, i) => `w${i}`).join(' ');
    const l = spokenLines({ take: long, take2: long, durationSeconds: 10, show: 'duel' });
    expect(l.guest2).toBeTruthy();
    expect(l.guest.split(' ').length).toBe(l.guest2!.split(' ').length);
    expect(l.trimmed).toBe(true);
  });
});

describe('debate duel', () => {
  const t = spec('duel');
  it('has a three-person native prompt with both sides', () => {
    const out = buildNativePrompt(t);
    expect(out).toMatch(/three people/);
    expect(out).toContain('Guest A'); expect(out).toContain('Guest B');
    expect(out).toContain(SAMPLE_ANSWERS.duel[0].slice(0, 20));
    expect(out).toContain(SAMPLE_ANSWERS.duel[1].slice(0, 20));
  });
  it('plans host, guest A, guest B for Cuts and needs a second guest', () => {
    expect(cutsPlan(t).map(s => s.role)).toEqual(['host', 'guest', 'guest2']);
    expect(cutsPlan(spec('hot_take')).map(s => s.role)).toEqual(['host', 'guest']);
    const ok = { portrait_url: 'https://x/p.png', voice_id: 'v' };
    expect(cutsProblem(ok, ok, undefined, true)).toMatch(/second guest/);
    expect(cutsProblem(ok, ok, { portrait_url: null, voice_id: 'v' }, true)).toMatch(/second guest needs/);
    expect(cutsProblem(ok, ok, ok, true)).toBeNull();
    expect(cutsProblem(ok, ok)).toBeNull();
  });
});

describe('on-screen graphic data', () => {
  it('Hot Take puts the take on screen, the others put the question', () => {
    expect(titleFor({ show: 'hot_take', take: 'Leggings are not pants' }).headline).toBe('Leggings are not pants');
    expect(titleFor({ show: 'happiness', take: 'x', question: 'What made you smile?' }).headline).toBe('What made you smile?');
  });
  it('Reveal extracts the number with its currency', () => {
    expect(titleFor({ show: 'reveal', take: 'I pay $2,400 a month' }).value).toBe('$2,400');
    expect(extractNumber('I make 85k a year')).toBe('85k');
    expect(extractNumber("I'm 6'2 honestly")).toBe("6'2");
    expect(extractNumber('no digits here')).toBeNull();
  });
  it('Rate my extracts a score out of ten and clamps it', () => {
    expect(extractScore('a solid 7 out of 10')).toBe('7/10');
    expect(extractScore('9/10 would ride again')).toBe('9/10');
    expect(extractScore('eleven? make it 15')).toBe('10/10');
    expect(extractScore('7.5 for me')).toBe('7.5/10');
    expect(extractScore('no number')).toBeNull();
  });
  it('Would you rather splits the question into two options', () => {
    expect(splitOptions('Would you rather fly or be invisible?')).toEqual(['fly', 'be invisible']);
    expect(splitOptions('Would you rather skip lunch or skip breakfast forever?')).toEqual(['skip lunch', 'skip breakfast forever']);
    expect(splitOptions('Do you like trains?')).toBeNull();
    expect(titleFor({ show: 'would_you_rather', take: 'x', question: 'Would you rather fly or be invisible?' })).toMatchObject({ variant: 'ab', left: 'fly', right: 'be invisible' });
  });
  it('Duel shows both sides', () => expect(titleFor({ show: 'duel', take: ' Yes ', take2: 'No ' })).toMatchObject({ variant: 'vs', left: 'Yes', right: 'No' }));
});

describe('stored title compatibility', () => {
  it('reads the current shape', () => {
    const data = titleFor({ show: 'hot_take', take: 'x' });
    expect(resolveTitle({ data, guest: 'Maya', showBadge: false })).toEqual({ data, guest: 'Maya', showBadge: false });
  });
  it('upgrades the older { take, guest, badge } shape', () => {
    const r = resolveTitle({ take: 'Old take', guest: 'Maya', badge: true })!;
    expect(r.data).toMatchObject({ variant: 'take', badge: 'HOT TAKE', headline: 'Old take' });
    expect(r.guest).toBe('Maya');
  });
  it('returns null for nothing', () => { expect(resolveTitle(undefined)).toBeNull(); expect(resolveTitle({})).toBeNull(); });
});

describe('game-show formats', () => {
  it('Quick trivia shows the question and a CORRECT reveal pill', () => {
    const t = titleFor({ ...spec('trivia'), question: 'Which ocean is the largest?', take: 'The Pacific.' });
    expect(t.variant).toBe('quiz'); expect(t.headline).toBe('Which ocean is the largest?'); expect(t.value).toMatch(/CORRECT/);
  });
  it('Two truths and a lie shows up to three numbered statements', () => {
    const t = titleFor(spec('truths', { take: 'I have met a chef. I once ate a whole pizza; I have never flown.' }));
    expect(t.variant).toBe('truths'); expect(t.items).toEqual(['I have met a chef.', 'I once ate a whole pizza', 'I have never flown.']);
    expect(splitStatements('One. Two. Three. Four.')).toHaveLength(3);
    expect(splitStatements('1) cats 2) dogs; and birds')).toEqual(['cats 2) dogs', 'birds']);
    expect(splitStatements('')).toEqual([]);
  });
  it('Guess the price reuses the big number, Finish the sentence puts the question on screen', () => {
    expect(titleFor(spec('guess_price', { take: 'I say $6.50.' })).value).toBe('$6.50');
    expect(titleFor(spec('finish_sentence')).headline).toMatch(/Finish the sentence/);
  });
  it('each has a valid default tone, a sample answer, ideas that pass the screen, and a reaction beat', async () => {
    const { checkText } = await import('../safety');
    for (const id of ['trivia', 'truths', 'finish_sentence', 'guess_price'] as const) {
      const s = showOf(id);
      expect(s.tones).toContain(s.defaultTone); expect(SAMPLE_ANSWERS[id][0].length).toBeGreaterThan(5); expect(s.ideas.length).toBeGreaterThanOrEqual(4); expect(s.reaction.length).toBeGreaterThan(10);
      for (const idea of s.ideas) expect(checkText(idea).ok, idea).toBe(true);
      expect(checkText(SAMPLE_ANSWERS[id][0]).ok).toBe(true);
    }
  });
  it('their prompts use the one-card beats and each city\'s own card word', () => {
    for (const id of ['trivia', 'truths', 'finish_sentence', 'guess_price'] as const) {
      for (const c of CITIES.filter(c => c.id !== 'custom')) {
        const p = buildNativePrompt(spec(id, { place: { ...DEFAULT_PLACE, city: c.id } }));
        expect(p).toMatch(/exactly ONE card/); expect(p).toMatch(/Beat 3/);
        if (c.id !== 'nyc') expect(p).not.toMatch(/MetroCard/);
      }
    }
  });
});
