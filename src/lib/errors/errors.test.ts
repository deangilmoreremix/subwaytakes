import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../supabase', () => ({ supabase: {} }));
import { cleanUrl, resetReporter, shouldSend } from './report';

beforeEach(() => resetReporter());

describe('error reporting limits', () => {
  it('never sends the same message twice in a row', () => { expect(shouldSend('boom', 1000)).toBe(true); expect(shouldSend('boom', 1001)).toBe(false); expect(shouldSend('other', 1002)).toBe(true); expect(shouldSend('boom', 1003)).toBe(true); });
  it('sends at most five a minute, then again once the minute has passed', () => {
    for (let i = 0; i < 5; i++) expect(shouldSend(`e${i}`, 10_000 + i)).toBe(true);
    expect(shouldSend('e5', 10_010)).toBe(false); expect(shouldSend('e6', 10_020)).toBe(false);
    expect(shouldSend('e7', 10_000 + 61_000)).toBe(true);
  });
  it('ignores empty messages', () => { expect(shouldSend('')).toBe(false); });
  it('strips queries and hashes from the page address so no tokens or invite codes are reported', () => {
    expect(cleanUrl('https://app.example/create?ref=ABCD1234&token=secret#frag')).toBe('https://app.example/create'); expect(cleanUrl('not a url')).toBe('');
  });
});
