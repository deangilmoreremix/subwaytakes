import { supabase } from '../supabase';
import { extractError, extractMediaUrl, normalizeStatus, pickMessage } from './result';
export { pickMessage };

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
  /** text models (e.g. whisper) */
  text?: string;
  error?: string;
}

/** supabase-js hides the response body of non-2xx function calls; recover muapi's own message from it. */
export async function describeError(error: { message?: string; context?: unknown }): Promise<string> {
  const ctx = error.context as Response | undefined;
  if (ctx && typeof ctx.clone === 'function') {
    try {
      const b = await ctx.clone().json() as Record<string, unknown>;
      const m = pickMessage(b.error) || pickMessage(b.detail) || pickMessage(b.message);
      if (m) return m;
    } catch { /* body not JSON: fall through */ }
  }
  return error.message || 'muapi proxy failed';
}

/** Calls the muapi-proxy edge function, which forwards the user's key and stores nothing. */
async function proxy<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const key = getMuapiKey();
  if (!key) throw new MissingKeyError();
  const { data, error } = await supabase.functions.invoke('muapi-proxy', {
    body: { method, path, body },
    headers: { 'x-muapi-key': key },
  });
  if (error) throw new Error(await describeError(error));
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
  model: (slug: string) => proxy<Record<string, unknown>>('GET', `/api/v1/models/${slug}`),
  estimate: (slug: string, input: Record<string, unknown>) =>
    proxy<Record<string, unknown>>('POST', `/api/v1/models/${slug}/estimate-cost`, input),
};

export function outputUrl(p: Prediction): string | undefined {
  return extractMediaUrl(p);
}

/** Submit then poll until terminal. Surfaces muapi errors; never fabricates output. */
export async function runModel(
  slug: string,
  input: Record<string, unknown>,
  opts: { onUpdate?: (p: Prediction) => void; intervalMs?: number; timeoutMs?: number; signal?: AbortSignal; /** false for text-only models */ requireUrl?: boolean;
    /** called right after submit so callers can persist the id (lets a reload resume polling) */ onSubmitted?: (requestId: string) => void;
    /** skip submitting and poll this existing request instead */ resumeId?: string } = {},
): Promise<{ requestId: string; url: string; prediction: Prediction }> {
  let request_id = opts.resumeId;
  if (!request_id) {
    ({ request_id } = await muapi.submit(slug, input));
    opts.onSubmitted?.(request_id);
  }
  const requestId = request_id;
  const started = Date.now();
  const timeout = opts.timeoutMs ?? 15 * 60_000;
  for (;;) {
    if (opts.signal?.aborted) throw new Error('Cancelled');
    const p = await muapi.result(requestId);
    opts.onUpdate?.(p);
    const status = normalizeStatus(p);
    if (status === 'completed') {
      const url = outputUrl(p);
      if (!url && opts.requireUrl !== false) throw new Error('muapi completed without an output URL');
      return { requestId, url: url ?? '', prediction: p };
    }
    if (status === 'failed' || status === 'cancelled') throw new Error(extractError(p) || `muapi job ${status}`);
    if (Date.now() - started > timeout) throw new Error('Timed out waiting for muapi');
    await new Promise(r => setTimeout(r, opts.intervalMs ?? 4000));
  }
}
