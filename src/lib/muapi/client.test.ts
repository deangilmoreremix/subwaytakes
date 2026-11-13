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

describe('describeError with real muapi failure shapes', () => {
  it('failed prediction: {detail:{id,status,error}} (seen live from gemini-3-5-flash)', async () => {
    const body = { detail: { id: 'x', status: 'failed', error: "provider error: no candidates in response: {'code': 410, 'msg': 'Gemini 3.5 Flash has been deprecated'}" } };
    expect(await describeError({ message: 'Edge Function returned a non-2xx status code', context: res(body, 400) })).toMatch(/deprecated/);
  });
  it('unknown model: {detail:{error:{code,message}}}', async () => {
    expect(await describeError({ context: res({ detail: { error: { code: 'MODEL_NOT_FOUND', message: 'Unknown model: nope' } } }, 404) })).toBe('Unknown model: nope');
  });
  it('plain and validation-list shapes still work', async () => {
    expect(await describeError({ context: res({ error: 'Insufficient credits' }) })).toBe('Insufficient credits');
    expect(await describeError({ context: res({ detail: [{ msg: 'field required' }] }, 422) })).toBe('field required');
  });
});
