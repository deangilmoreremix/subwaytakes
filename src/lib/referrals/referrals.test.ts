import { describe, expect, it, vi } from 'vitest';
vi.mock('../supabase', () => ({ supabase: {} }));
vi.mock('../auth', () => ({ useAuth: () => ({ user: null, isGuest: true }) }));
import { inviteLink, parseRefCode } from './index';

describe('invite codes', () => {
  it('reads a valid code from a link and normalises it', () => { expect(parseRefCode('?ref=ab12cd34')).toBe('AB12CD34'); expect(parseRefCode('?x=1&ref=AB12CD34')).toBe('AB12CD34'); });
  it('ignores anything that is not an 8 character code', () => {
    for (const s of ['', '?ref=', '?ref=short', '?ref=AB12CD345', '?ref=AB12-D34', '?ref=<script>', '?other=AB12CD34']) expect(parseRefCode(s), s).toBeNull();
  });
  it('builds a link that goes to sign-up', () => { expect(inviteLink('AB12CD34', 'https://studio.example')).toBe('https://studio.example/login?ref=AB12CD34'); });
});
