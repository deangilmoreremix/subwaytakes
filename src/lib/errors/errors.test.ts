import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../supabase', () => ({ supabase: {} }));
import { cleanUrl, resetReporter, scrub, shouldSend } from './report';

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

describe('scrub', () => {
  it('removes queries and hashes from URLs inside messages and stacks, and caps the length', () => {
    expect(scrub('Failed to load https://x.supabase.co/storage/v1/object/sign/a.mp4?token=SECRET&t=1 now', 300)).toBe('Failed to load https://x.supabase.co/storage/v1/object/sign/a.mp4 now');
    expect(scrub('at https://app.test/a.js?v=1:10:5 (https://app.test/b.js#x)', 300)).not.toMatch(/\?v=1|#x/);
    expect(scrub('x'.repeat(5000), 300)).toHaveLength(300);
  });
});
