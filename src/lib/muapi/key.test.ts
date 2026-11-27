import { beforeEach, describe, expect, it } from 'vitest';
import { clearKey, getKey, hasKey, keyProblem, maskKey, parseBalance, scrubKey, setKey, subscribeKey } from './key';

const GOOD = 'mk_live_1234567890abcdef1234';
beforeEach(() => { clearKey(); });

describe('key shape', () => {
  it('accepts a plausible key and rejects bad ones', () => {
    expect(keyProblem(GOOD)).toBeNull();
    expect(keyProblem('')).toMatch(/Paste/);
    expect(keyProblem('abc def ghi jkl mno pqr')).toMatch(/spaces/);
    expect(keyProblem('short')).toMatch(/short/);
    expect(keyProblem('x'.repeat(201))).toMatch(/long/);
    expect(keyProblem('é'.repeat(20))).toMatch(/plain/);
  });
  it('trims pasted whitespace', () => { expect(keyProblem(`  ${GOOD}\n`)).toBeNull(); setKey(`  ${GOOD}\n`); expect(getKey()).toBe(GOOD); });
  it('masks, never revealing the middle', () => { const m = maskKey(GOOD); expect(m.startsWith('mk_l')).toBe(true); expect(m.endsWith('1234')).toBe(true); expect(m).not.toContain('567890abcdef'); });
});

describe('store', () => {
  it('saves, reads, notifies and clears', () => {
    let n = 0; const off = subscribeKey(() => { n++; });
    expect(hasKey()).toBe(false);
    setKey(GOOD); expect(hasKey()).toBe(true); expect(getKey()).toBe(GOOD);
    clearKey(); expect(getKey()).toBeNull(); expect(n).toBe(2); off();
  });
  it('refuses to save a bad key', () => { expect(() => setKey('nope')).toThrow(); expect(hasKey()).toBe(false); });
  it('still works when storage throws', () => {
    const real = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('blocked'); } });
    try { setKey(GOOD); expect(getKey()).toBe(GOOD); clearKey(); expect(getKey()).toBeNull(); }
    finally { if (real) Object.defineProperty(globalThis, 'localStorage', real); }
  });
  it('scrubs the key out of text', () => { setKey(GOOD); expect(scrubKey(`failed with ${GOOD} here`)).toBe('failed with [key removed] here'); });
});

describe('parseBalance', () => {
  it('reads the usual shapes', () => {
    expect(parseBalance(12.5)).toBe(12.5);
    expect(parseBalance({ balance: 3 })).toBe(3);
    expect(parseBalance({ data: { credits: '7.25' } })).toBe(7.25);
    expect(parseBalance({ hello: 1 })).toBeNull();
    expect(parseBalance(null)).toBeNull();
  });
});
