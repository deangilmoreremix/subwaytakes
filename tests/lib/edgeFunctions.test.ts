import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionMock = vi.fn();

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => getSessionMock(),
    },
  },
}));

import { EdgeFunctionError, callEdgeFunction } from '../../src/lib/edgeFunctions';

const SUPABASE_URL = 'https://test-project.supabase.co';
const ANON_KEY = 'test-anon-key';
const ACCESS_TOKEN = 'user-access-token-abc123';

interface CapturedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

function mockSession(accessToken: string | null): void {
  getSessionMock.mockResolvedValue({
    data: { session: accessToken ? { access_token: accessToken } : null },
  });
}

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function installFetch(response: Response): { calls: CapturedCall[] } {
  const calls: CapturedCall[] = [];
  vi.stubGlobal('fetch', (url: string, init: RequestInit) => {
    calls.push({
      url,
      method: init.method ?? 'GET',
      headers: (init.headers ?? {}) as Record<string, string>,
      body: init.body ? JSON.parse(init.body as string) : undefined,
    });
    return Promise.resolve(response);
  });
  return { calls };
}

beforeEach(() => {
  vi.unstubAllGlobals();
  getSessionMock.mockReset();
  mockSession(ACCESS_TOKEN);
});

describe('callEdgeFunction', () => {
  it('POSTs to the function URL with the user access token (not the anon key)', async () => {
    const { calls } = installFetch(jsonResponse({ ok: true }));

    await callEdgeFunction('plan-interview', { topic: 'pizza' });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`${SUPABASE_URL}/functions/v1/plan-interview`);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].headers.Authorization).toBe(`Bearer ${ACCESS_TOKEN}`);
    expect(calls[0].headers.Authorization).not.toBe(`Bearer ${ANON_KEY}`);
    expect(calls[0].headers['Content-Type']).toBe('application/json');
    expect(calls[0].body).toEqual({ topic: 'pizza' });
  });

  it('parses and returns the JSON body', async () => {
    installFetch(jsonResponse({ plan: { title: 'My Interview' }, extra: 7 }));

    const result = await callEdgeFunction<{ plan: { title: string } }>('plan-interview', {});

    expect(result).toEqual({ plan: { title: 'My Interview' }, extra: 7 });
  });

  it('wraps non-JSON success bodies as { raw }', async () => {
    installFetch({
      ok: true,
      status: 200,
      text: async () => 'plain text reply',
    } as unknown as Response);

    await expect(callEdgeFunction('render-project', {})).resolves.toEqual({ raw: 'plain text reply' });
  });

  it('returns null for an empty body', async () => {
    installFetch({
      ok: true,
      status: 200,
      text: async () => '',
    } as unknown as Response);

    await expect(callEdgeFunction('render-project', {})).resolves.toBeNull();
  });

  it('throws EdgeFunctionError with server message and status on 4xx', async () => {
    installFetch(jsonResponse({ error: 'Project not found or access denied' }, { ok: false, status: 404 }));

    const error = await callEdgeFunction('scene-status', {}).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(EdgeFunctionError);
    expect((error as EdgeFunctionError).name).toBe('EdgeFunctionError');
    expect((error as EdgeFunctionError).status).toBe(404);
    expect((error as EdgeFunctionError).message).toBe('Project not found or access denied');
    expect((error as EdgeFunctionError).data).toEqual({ error: 'Project not found or access denied' });
  });

  it('throws EdgeFunctionError with status on 5xx', async () => {
    installFetch(jsonResponse({ error: 'Worker exploded' }, { ok: false, status: 500 }));

    const error = await callEdgeFunction('muapi-captions', {}).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(EdgeFunctionError);
    expect((error as EdgeFunctionError).status).toBe(500);
    expect((error as EdgeFunctionError).message).toBe('Worker exploded');
  });

  it('falls back to a generic message when the error body is not JSON', async () => {
    installFetch({
      ok: false,
      status: 502,
      text: async () => '<html>bad gateway</html>',
    } as unknown as Response);

    const error = await callEdgeFunction('render-project', {}).catch((e: unknown) => e);

    expect((error as EdgeFunctionError).status).toBe(502);
    expect((error as EdgeFunctionError).message).toBe('Edge function render-project failed with status 502');
  });

  it('falls back to the anon key only when no session exists', async () => {
    mockSession(null);
    const { calls } = installFetch(jsonResponse({ ok: true }));

    await callEdgeFunction('generate-scene', { beat_id: 'opening_hook' });

    expect(calls[0].headers.Authorization).toBe(`Bearer ${ANON_KEY}`);
  });

  it('aborts the request when timeoutMs elapses', async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi.fn((_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('aborted by timeout')), { once: true });
        }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const pending = callEdgeFunction('render-project', {}, { timeoutMs: 50 });
      const assertion = expect(pending).rejects.toThrow('aborted by timeout');
      await vi.advanceTimersByTimeAsync(60);
      await assertion;
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('forwards an external abort signal', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn((_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new Error('aborted externally')), { once: true });
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const pending = callEdgeFunction('render-project', {}, { signal: controller.signal });
    // wait until fetch has been reached and the abort listener is attached
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const assertion = expect(pending).rejects.toThrow('aborted externally');
    controller.abort();
    await assertion;
  });

  it('clears the timeout on success (no dangling timers)', async () => {
    vi.useFakeTimers();
    try {
      installFetch(jsonResponse({ ok: true }));
      await callEdgeFunction('render-project', {}, { timeoutMs: 50 });
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
