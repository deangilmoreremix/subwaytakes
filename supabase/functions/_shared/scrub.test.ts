import { describe, expect, it } from 'vitest';
import { isOurAccountProblem, predictionView, scrub } from './scrub';
import { requestHash } from './hash';

describe('scrub', () => {
  it('drops money, account and key fields at any depth and keeps the rest', () => {
    expect(scrub({ name: 'x', cost: 1, nested: { Balance: 2, ok: [{ api_key: 'k', v: 1 }] }, raw: '<html>' })).toEqual({ name: 'x', nested: { ok: [{ v: 1 }] } });
  });
  it('caps long strings and deep nesting, and never throws', () => {
    expect((scrub('a'.repeat(5000)) as string).length).toBe(2000);
    let deep: unknown = 'end'; for (let i = 0; i < 20; i++) deep = { a: deep };
    expect(() => scrub(deep)).not.toThrow();
    expect(scrub(null)).toBeNull(); expect(scrub(7)).toBe(7);
  });
  it('predictionView keeps only the fields the app reads', () => {
    expect(predictionView({ status: 'completed', outputs: ['u'], cost: 1, extra: 1, error: 'e' })).toEqual({ status: 'completed', outputs: ['u'], error: 'e' });
    expect(predictionView('nope')).toEqual({}); expect(predictionView(null)).toEqual({});
  });
  it('flags muapi account statuses', () => {
    expect([401, 402, 403].every(isOurAccountProblem)).toBe(true); expect([400, 404, 422, 500].some(isOurAccountProblem)).toBe(false);
  });
});

describe('requestHash', () => {
  it('is stable across key order, and differs by model or content', async () => {
    const a = await requestHash('m', { a: 1, b: { c: [1, 2], d: 'x' } });
    expect(await requestHash('m', { b: { d: 'x', c: [1, 2] }, a: 1 })).toBe(a);
    expect(await requestHash('n', { a: 1, b: { c: [1, 2], d: 'x' } })).not.toBe(a);
    expect(await requestHash('m', { a: 2, b: { c: [1, 2], d: 'x' } })).not.toBe(a);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});
