import { describe, it, expect, vi } from 'vitest';
vi.mock('./supabase', () => ({ supabase: {} }));
import { mediaPath, randomToken } from './storage';

describe('mediaPath', () => {
  it('puts the user id first (the storage RLS folder check) and sanitises the name', () => {
    const p = mediaPath('u-123', 'My Portrait (final).PNG', 1000, 'abc123');
    expect(p).toBe('u-123/1000-abc123-My-Portrait-final-.PNG');
    expect(p.split('/')[0]).toBe('u-123');
  });
  it('names files with 128 random bits, so a URL cannot be guessed and two uploads never collide', () => {
    const tokens = new Set(Array.from({ length: 200 }, () => randomToken()));
    expect(tokens.size).toBe(200);
    for (const t of tokens) expect(t).toMatch(/^[0-9a-f]{32}$/);
    expect(mediaPath('u', 'a.png', 1)).toMatch(/^u\/1-[0-9a-f]{32}-a\.png$/);
  });
  it('never allows path traversal or empty names', () => {
    expect(mediaPath('u', '../../etc/passwd', 1, 'r')).not.toContain('..');
    expect(mediaPath('u', '***', 1, 'r').endsWith('-file')).toBe(true);
    expect(mediaPath('u', '..', 1, 'r').endsWith('-file')).toBe(true);
  });
});
