import { describe, it, expect, vi } from 'vitest';
vi.mock('./supabase', () => ({ supabase: {} }));
import { mediaPath } from './storage';

describe('mediaPath', () => {
  it('puts the user id first (the storage RLS folder check) and sanitises the name', () => {
    const p = mediaPath('u-123', 'My Portrait (final).PNG', 1000, 'abc123');
    expect(p).toBe('u-123/1000-abc123-My-Portrait-final-.PNG');
    expect(p.split('/')[0]).toBe('u-123');
  });
  it('never allows path traversal or empty names', () => {
    expect(mediaPath('u', '../../etc/passwd', 1, 'r')).not.toContain('..');
    expect(mediaPath('u', '***', 1, 'r').endsWith('-file')).toBe(true);
    expect(mediaPath('u', '..', 1, 'r').endsWith('-file')).toBe(true);
  });
});
