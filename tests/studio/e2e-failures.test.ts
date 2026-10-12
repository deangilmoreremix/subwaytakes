/**
 * Pure failure-handling logic for the studio.
 *
 * Runs without DOM. Mirrors the pure helpers in src/lib/studioProjects.ts and
 * the deny/access-detect rules from the edge functions so that errors
 * surfaced by the browser harness and the server return the same shape.
 */
import { describe, expect, it } from 'vitest';
import { isAccessDenied, describeError } from '../../src/lib/studioProjects';

describe('isAccessDenied — Supabase/PostgRest auth/status error detector', () => {
  it.each([
    [{ status: 401 }, true],
    [{ status: 404 }, true],
    [{ status: 403 }, false],
    [{ status: 500 }, false],
    [{ status: 200 }, false],
    [{ status: 42501 }, false], // Postgres permission code is not enough on its own
    [null, false],
    [undefined, false],
    [{}, false],
  ])('input %o → %s', (input, expected) => {
    expect(isAccessDenied(input)).toBe(expected);
  });
});

describe('describeError — user-facing error message', () => {
  it('passes through a real Error', () => {
    expect(describeError(new Error('boom'), 'fallback')).toBe('boom');
  });
  it('uses fallback for nullish', () => {
    expect(describeError(null, 'fallback')).toBe('fallback');
    expect(describeError(undefined, 'fallback')).toBe('fallback');
  });
  it('extracts a Supabase {message} object', () => {
    expect(describeError({ message: 'supabase-msg' }, 'fallback')).toBe('supabase-msg');
  });
  it('accepts plain string errors', () => {
    expect(describeError('plain', 'fallback')).toBe('plain');
  });
});
