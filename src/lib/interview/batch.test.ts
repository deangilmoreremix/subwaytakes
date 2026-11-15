import { describe, expect, it } from 'vitest';
import { DEFAULT_TAKE } from './index';
import { MAX_BATCH, batchSpecs, parseBatchLines } from './batch';
import { applyShow } from '../shows';

describe('parseBatchLines', () => {
  it('splits lines, strips bullets and numbers, drops blanks and duplicates', () => {
    expect(parseBatchLines('1. Cereal is a soup\n- A hot dog is a sandwich\n\n  cereal is a soup  \n* Tipping is out of hand').lines)
      .toEqual(['Cereal is a soup', 'A hot dog is a sandwich', 'Tipping is out of hand']);
  });
  it('caps at ten and reports what was dropped', () => {
    const r = parseBatchLines(Array.from({ length: 14 }, (_, i) => `take ${i}`).join('\n'));
    expect(r.lines).toHaveLength(MAX_BATCH); expect(r.dropped).toBe(4);
  });
});

describe('batchSpecs', () => {
  it('Hot Take: each line is the take', () => {
    const { specs } = batchSpecs(DEFAULT_TAKE, ['A', 'B']);
    expect(specs.map(s => s.take)).toEqual(['A', 'B']);
  });
  it('question shows: each line is the host question', () => {
    const base = applyShow(DEFAULT_TAKE, 'happiness');
    const { specs } = batchSpecs(base, ['Who made you smile?', 'What are you grateful for?']);
    expect(specs.map(s => s.question)).toEqual(['Who made you smile?', 'What are you grateful for?']);
    expect(specs.every(s => s.show === 'happiness')).toBe(true);
  });
  it('refuses duels', () => expect(batchSpecs(applyShow(DEFAULT_TAKE, 'duel'), ['x']).problem).toMatch(/cannot be batched/));
});
