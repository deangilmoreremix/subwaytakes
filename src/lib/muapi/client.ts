import { supabase } from '../supabase';
import { extractError, extractMediaUrl, normalizeStatus, pickMessage } from './result';
export { pickMessage };
import { checkBody, ContentBlockedError } from '../safety';
import { AccountRequiredError, InsufficientCreditsError, LockedFeatureError, publishBalance } from '../credits';
import { IS_BYOK } from '../mode';
import { getKey, InvalidKeyError, MissingKeyError, MuapiBalanceError, openKeyModal, parseBalance, publishKeyBalance, scrubKey } from './key';

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
  return scrubKey(error.message || 'The generator failed');
}

/** Turn a failed gateway call into the right error: not enough credits, account problems, or muapi's own message. */
export async function interpretGatewayFailure(error: { message?: string; context?: unknown }): Promise<Error> {
  const ctx = error.context as Response | undefined;
  if (ctx && typeof ctx.clone === 'function') {
    try {
      const b = await ctx.clone().json() as { code?: string; needed?: unknown; balance?: unknown; error?: unknown; entitlement?: unknown; category?: unknown };
      if (b.code === 'no_key') { openKeyModal('Add your muapi key to generate.'); return new MissingKeyError(); }
      if (b.code === 'invalid_key') { openKeyModal('muapi did not accept the saved key. Check it or paste a new one.'); return new InvalidKeyError(typeof b.error === 'string' ? b.error : undefined); }
      if (b.code === 'muapi_balance') return new MuapiBalanceError(typeof b.error === 'string' ? b.error : undefined);
      if (b.code === 'insufficient_credits') {
        const balance = Number(b.balance) || 0;
        publishBalance(balance);
        return new InsufficientCreditsError(Number(b.needed) || balance + 1, balance);
      }
      if (b.code === 'blocked' && typeof b.error === 'string') return new ContentBlockedError(typeof b.category === 'string' ? b.category : 'blocked', b.error);
      if (b.code === 'locked' && typeof b.entitlement === 'string') return new LockedFeatureError(b.entitlement, typeof b.error === 'string' ? b.error : 'This feature is not unlocked.');
      if ((b.code === 'account_required' || b.code === 'verify_email') && typeof b.error === 'string') return new AccountRequiredError(b.code, b.error);
    } catch { /* not JSON: fall through to the generic message */ }
  }
  return new Error(await describeError(error));
}

/** Calls the muapi-gateway edge function. The server holds the muapi key and charges credits; nothing secret is sent from here. */
async function proxy<T>(method: 'GET' | 'POST', path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
  // the same content screen the gateway runs: a clear message before anything is sent (the server still enforces it)
  if (method === 'POST' && !path.endsWith('/estimate-cost')) { const v = checkBody(body); if (!v.ok) throw new ContentBlockedError(v.category, `${v.message} You were not charged.`); }
  let fn = 'muapi-gateway'; let headers: Record<string, string> | undefined;
  if (IS_BYOK) {
    // bring-your-own-key: the key stays in this browser and rides in a header to the proxy, which forwards it and keeps nothing
    const key = getKey();
    if (!key) { openKeyModal('Add your muapi key to generate.'); throw new MissingKeyError(); }
    fn = 'muapi-byok'; headers = { 'x-muapi-key': key };
  }
  const { data, error } = await supabase.functions.invoke(fn, { body: IS_BYOK ? { method, path, body } : { method, path, body, idempotencyKey }, headers });
  if (error) throw await interpretGatewayFailure(error);
  if (data && typeof data === 'object' && 'error' in data && !('status' in data)) {
    throw new Error(String((data as { error: unknown }).error));
  }
  const bal = (data as { credits?: { balance?: unknown } } | null)?.credits?.balance;
  if (typeof bal === 'number') publishBalance(bal);
  return data as T;
}

export const muapi = {
  /** One idempotency key per submit, so a retry of the same call can never be charged twice. */
  submit: (slug: string, input: Record<string, unknown>) =>
    proxy<{ request_id: string }>('POST', `/api/v1/${slug}`, input, crypto.randomUUID()),
  result: (requestId: string) => proxy<Prediction>('GET', `/api/v1/predictions/${requestId}/result`),
  model: (slug: string) => proxy<Record<string, unknown>>('GET', `/api/v1/models/${slug}`),
  /** Price of a call in CREDITS, or in whole CENTS when bringing your own key (1 unit = $0.01 either way). */
  estimate: (slug: string, input: Record<string, unknown>) =>
    proxy<{ cost: number; unit?: string }>('POST', `/api/v1/models/${slug}/estimate-cost`, input),
};

/** The customer's own muapi wallet (BYOK). Publishes it for the top-bar pill; returns null when the shape is unknown. */
export async function refreshKeyBalance(): Promise<number | null> {
  const json = await proxy<unknown>('GET', '/api/v1/account/balance');
  const n = parseBalance(json);
  publishKeyBalance(n);
  return n;
}

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
      if (IS_BYOK) void refreshKeyBalance().catch(() => { /* the pill just keeps its last value */ });
      if (!url && opts.requireUrl !== false) throw new Error('muapi completed without an output URL');
      return { requestId, url: url ?? '', prediction: p };
    }
    if (status === 'failed' || status === 'cancelled') throw new Error(extractError(p) || `muapi job ${status}`);
    if (Date.now() - started > timeout) throw new Error('Timed out waiting for muapi');
    await new Promise(r => setTimeout(r, opts.intervalMs ?? 4000));
  }
}
