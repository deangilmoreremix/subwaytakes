import { describe, it, expect, vi } from 'vitest';
vi.mock('../supabase', () => ({ supabase: {} }));
import { describeError } from './client';

const res = (body: unknown, status = 402) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });

describe('describeError', () => {
  it('surfaces the upstream message instead of the generic supabase one', async () => {
    expect(await describeError({ message: 'Edge Function returned a non-2xx status code', context: res({ error: 'Insufficient credits' }) })).toBe('Insufficient credits');
    expect(await describeError({ message: 'x', context: res({ detail: 'Invalid API key' }, 401) })).toBe('Invalid API key');
  });
  it('stringifies structured details', async () => {
    expect(await describeError({ message: 'x', context: res({ detail: [{ msg: 'field required' }] }, 422) })).toContain('field required');
  });
  it('falls back to the message when the body is not JSON or missing', async () => {
    expect(await describeError({ message: 'boom', context: res('<html>', 502) })).toBe('boom');
    expect(await describeError({ message: 'boom' })).toBe('boom');
    expect(await describeError({})).toBe('muapi proxy failed');
  });
});
