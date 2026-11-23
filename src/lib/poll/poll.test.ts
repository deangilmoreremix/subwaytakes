import { describe, expect, it } from 'vitest';
import { DEFAULT_TAKE, buildNativePrompt } from '../interview';
import { checkText } from '../safety';
import { GUEST_POOL, POLL_MAX_GUESTS, normalizePollResults, parsePollLines, pollBars, pollLabels, pollSpecs, tally } from './index';

const L: [string, string] = ['Yes', 'No'];

describe('labels', () => {
  it('keeps them short and different, with Yes/No as the fallback', () => {
    expect(pollLabels('', '')).toEqual(['Yes', 'No']);
    expect(pollLabels('Pineapple', 'pineapple')).toEqual(['Pineapple', 'No']);
    expect(pollLabels('no', 'NO')).toEqual(['no', 'Yes']);
    expect(pollLabels('x'.repeat(50), 'y')[0]).toHaveLength(14);
  });
});

describe('parsePollLines', () => {
  it('reads "Label: answer" lines and counts them', () => {
    const r = parsePollLines('Yes: obviously\nno: never, ever\nYes: sometimes', L);
    expect(r.problem).toBeNull();
    expect(r.answers).toEqual([{ label: 0, text: 'obviously' }, { label: 1, text: 'never, ever' }, { label: 0, text: 'sometimes' }]);
    expect(tally(r.answers)).toEqual([2, 1]);
  });
  it('refuses a line with no known label (so a count can never be a guess)', () => {
    expect(parsePollLines('Yes: a\nMaybe: b', L).problem).toMatch(/Line 2 must start with "Yes:" or "No:"/);
    expect(parsePollLines('just words', L).problem).toMatch(/Line 1/);
  });
  it('needs at least two guests and ignores extras past five', () => {
    expect(parsePollLines('Yes: only one', L).problem).toMatch(/at least 2/);
    const seven = Array.from({ length: 7 }, (_, i) => `Yes: answer ${i}`).join('\n');
    const r = parsePollLines(seven, L);
    expect(r.answers).toHaveLength(POLL_MAX_GUESTS); expect(r.dropped).toBe(2); expect(r.problem).toBeNull();
    expect(parsePollLines('', L).problem).toMatch(/at least 2/);
  });
  it('works with custom labels', () => { expect(parsePollLines('Cats: purr\nDogs: woof', ['Cats', 'Dogs']).answers.map(a => a.label)).toEqual([0, 1]); });
});

describe('pollBars', () => {
  it('percentages are whole and add up to 100; a tie has no winner', () => {
    for (const c of [[1, 2], [2, 1], [3, 0], [0, 3], [1, 1], [4, 1], [2, 3], [1, 6]] as Array<[number, number]>) {
      const bars = pollBars(L, c);
      expect(bars[0].percent + bars[1].percent).toBe(100);
      expect(bars.map(b => b.count)).toEqual(c);
    }
    expect(pollBars(L, [2, 1]).map(b => b.winner)).toEqual([true, false]);
    expect(pollBars(L, [1, 2]).map(b => b.winner)).toEqual([false, true]);
    expect(pollBars(L, [2, 2]).every(b => !b.winner)).toBe(true);
    expect(pollBars(L, [0, 0]).map(b => b.percent)).toEqual([0, 0]);
    expect(pollBars(L, [1, 2]).map(b => b.percent)).toEqual([33, 67]);
  });
});

describe('results card data', () => {
  it('validates what comes back from a saved project', () => {
    expect(normalizePollResults({ type: 'poll-results', question: 'Pineapple on pizza?', labels: ['Yes', 'No'], counts: [3, 2] })).toEqual({ type: 'poll-results', question: 'Pineapple on pizza?', labels: ['Yes', 'No'], counts: [3, 2] });
    expect(normalizePollResults({ type: 'poll-results', question: 'q', labels: ['a', 'a'], counts: [500, -4] })).toMatchObject({ labels: ['a', 'No'], counts: [99, 0] });
    for (const bad of [null, 'x', {}, { type: 'light-leak' }, { type: 'poll-results', question: 1, labels: [], counts: [] }, { type: 'poll-results', question: 'q', labels: ['a', 'b'], counts: ['x', 1] }]) expect(normalizePollResults(bad)).toBeNull();
  });
});

describe('pollSpecs', () => {
  const answers = parsePollLines('Yes: obviously\nNo: never\nYes: only on Fridays', L).answers;
  const specs = pollSpecs(DEFAULT_TAKE, 'Is a hot dog a sandwich?', answers);
  it('asks the same question of every guest and gives each their own answer', () => {
    expect(specs).toHaveLength(3);
    for (const s of specs) expect(s.question).toBe('Is a hot dog a sandwich?');
    expect(specs.map(s => s.take)).toEqual(['obviously', 'never', 'only on Fridays']);
  });
  it('every guest looks different, from the original pool', () => {
    expect(new Set(specs.map(s => s.guestDescription)).size).toBe(3);
    for (const s of specs) expect(GUEST_POOL).toContain(s.guestDescription);
    expect(new Set(GUEST_POOL).size).toBe(GUEST_POOL.length);
  });
  it('the prompts keep the one-card hand-off and pass the content screen, in every city', () => {
    for (const s of specs) { const p = buildNativePrompt(s); expect(p).toMatch(/exactly ONE card/); expect(p).toContain('Is a hot dog a sandwich?'); expect(checkText(p).ok).toBe(true); }
    for (const g of GUEST_POOL) expect(checkText(g).ok, g).toBe(true);
  });
  it('wraps around the pool and does not change the base', () => {
    const many = pollSpecs(DEFAULT_TAKE, 'q?', Array.from({ length: 10 }, () => ({ label: 0 as const, text: 'x' })));
    expect(many[8].guestDescription).toBe(GUEST_POOL[0]);
    expect(DEFAULT_TAKE.show).toBe('hot_take');
  });
});
