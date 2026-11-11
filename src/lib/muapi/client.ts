import { supabase } from '../supabase';

const KEY_STORAGE = 'subwaytakes.muapi_key';

export function getMuapiKey(): string {
  try { return localStorage.getItem(KEY_STORAGE) || ''; } catch { return ''; }
}
export function setMuapiKey(key: string): void {
  try {
    if (key.trim()) localStorage.setItem(KEY_STORAGE, key.trim());
    else localStorage.removeItem(KEY_STORAGE);
  } catch { /* storage unavailable */ }
}

export class MissingKeyError extends Error {
  constructor() { super('Add your muapi API key in Settings to generate video.'); this.name = 'MissingKeyError'; }
}

export type PredictionStatus = 'queued' | 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
export interface Prediction {
  request_id?: string;
  id?: string;
  status: PredictionStatus;
  outputs?: string[];
  output?: string;
  error?: string;
}

/** Calls the muapi-proxy edge function, which forwards the user's key and stores nothing. */
async function proxy<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const key = getMuapiKey();
  if (!key) throw new MissingKeyError();
  const { data, error } = await supabase.functions.invoke('muapi-proxy', {
    body: { method, path, body },
    headers: { 'x-muapi-key': key },
  });
  if (error) throw new Error(error.message || 'muapi proxy failed');
  if (data && typeof data === 'object' && 'error' in data && !('status' in data)) {
    throw new Error(String((data as { error: unknown }).error));
  }
  return data as T;
}

export const muapi = {
  submit: (slug: string, input: Record<string, unknown>) =>
    proxy<{ request_id: string }>('POST', `/api/v1/${slug}`, input),
  result: (requestId: string) => proxy<Prediction>('GET', `/api/v1/predictions/${requestId}/result`),
  balance: () => proxy<Record<string, unknown>>('GET', '/api/v1/account/balance'),
  estimate: (slug: string, input: Record<string, unknown>) =>
    proxy<Record<string, unknown>>('POST', `/api/v1/models/${slug}/estimate-cost`, input),
};

export function outputUrl(p: Prediction): string | undefined {
  return p.outputs?.[0] ?? p.output;
}

/** Submit then poll until terminal. Surfaces muapi errors; never fabricates output. */
export async function runModel(
  slug: string,
  input: Record<string, unknown>,
  opts: { onUpdate?: (p: Prediction) => void; intervalMs?: number; timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<{ requestId: string; url: string; prediction: Prediction }> {
  const { request_id } = await muapi.submit(slug, input);
  const started = Date.now();
  const timeout = opts.timeoutMs ?? 15 * 60_000;
  for (;;) {
    if (opts.signal?.aborted) throw new Error('Cancelled');
    const p = await muapi.result(request_id);
    opts.onUpdate?.(p);
    if (p.status === 'completed') {
      const url = outputUrl(p);
      if (!url) throw new Error('muapi completed without an output URL');
      return { requestId: request_id, url, prediction: p };
    }
    if (p.status === 'failed' || p.status === 'cancelled') throw new Error(p.error || `muapi job ${p.status}`);
    if (Date.now() - started > timeout) throw new Error('Timed out waiting for muapi');
    await new Promise(r => setTimeout(r, opts.intervalMs ?? 4000));
  }
}
