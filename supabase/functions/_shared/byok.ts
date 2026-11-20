// The BYOK door to muapi: a thin pass-through that forwards the customer's OWN muapi key. Decision logic only; index.ts wires the network.
// Rules that matter:
//   - the key arrives in a header, is forwarded as x-api-key and is NEVER stored, logged, echoed in a response or put in an error
//   - only signed-in, confirmed accounts may use it (it must not become an open proxy), every call is counted first (rate limit)
//   - the content screen runs on submits before anything reaches muapi
//   - only known muapi paths pass (same allowlist as the gateway, plus the wallet balance read)
//   - the customer pays muapi directly: nothing here reserves, charges or refunds
import { classify } from './paths.ts';
import { checkBody } from './safety.ts';
import { creditsFor, readEstimateUsd } from './pricing.ts';

export interface ByokCaller { id: string; isAnonymous: boolean; emailConfirmed: boolean }
export interface ByokRequest { method: string; path: string; body?: unknown }
export interface ByokResponse { status: number; body: unknown }
export interface ByokDeps {
  /** Counts one attempt. Throws an Error whose message contains 'rate_limited' when over the limit. */
  hit(userId: string, kind: 'free' | 'submit'): Promise<void>;
  /** Talks to muapi with the CUSTOMER's key. Throws on a network error. */
  muapi(method: 'GET' | 'POST', path: string, key: string, body?: unknown): Promise<{ status: number; json: unknown }>;
  blockedTerms?(): Promise<string[]>;
  /** Structured log. Never pass keys, headers, prompts or bodies. */
  log(event: string, data: Record<string, unknown>): void;
}

const err = (status: number, code: string, error: string, extra: Record<string, unknown> = {}): ByokResponse => ({ status, body: { error, code, ...extra } });
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

export const BALANCE_PATH = '/api/v1/account/balance';

/** Same shape rule as the browser: one run of printable characters, 16 to 200 long. */
export function keyShapeOk(key: unknown): key is string {
  return typeof key === 'string' && key.length >= 16 && key.length <= 200 && /^[\x21-\x7e]+$/.test(key);
}

/** A message that is safe to show: muapi's own words, with the key removed if it ever appears. */
function safeMessage(json: unknown, key: string): string {
  let m = '';
  if (isObj(json)) {
    for (const f of ['error', 'detail', 'message']) {
      const v = json[f];
      if (typeof v === 'string' && v.trim()) { m = v; break; }
      if (isObj(v) && typeof v.message === 'string') { m = v.message; break; }
    }
  }
  return m.split(key).join('[key removed]').slice(0, 300);
}

export async function handle(caller: ByokCaller | null, req: ByokRequest, key: string | null, deps: ByokDeps): Promise<ByokResponse> {
  if (!caller) return err(401, 'unauthorized', 'Sign in to continue.');
  if (caller.isAnonymous) return err(403, 'account_required', 'Create an account to generate.');
  if (!caller.emailConfirmed) return err(403, 'verify_email', 'Confirm your email address to generate.');
  if (!key) return err(400, 'no_key', 'Add your muapi key to continue.');
  if (!keyShapeOk(key)) return err(400, 'invalid_key', 'That does not look like a muapi key. Check it and try again.');

  const method = String(req.method ?? 'POST').toUpperCase();
  if (method !== 'GET' && method !== 'POST') return err(400, 'bad_request', 'Bad method.');
  const path = String(req.path ?? '');
  const isBalance = method === 'GET' && path === BALANCE_PATH;
  const route = isBalance ? ({ kind: 'balance' } as const) : classify(method, path);
  if (route.kind === 'denied') return err(400, 'path_not_allowed', 'Path not allowed.');

  try { await deps.hit(caller.id, route.kind === 'submit' ? 'submit' : 'free'); } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('rate_limited')) return err(429, 'rate_limited', 'You are going too fast. Wait a moment and try again.');
    deps.log('hit_error', { message: msg.slice(0, 120) });
    return err(500, 'internal', 'Something went wrong. Try again.');
  }

  let body: unknown;
  if (route.kind === 'submit' || route.kind === 'estimate') {
    if (route.kind === 'submit' && !isObj(req.body)) return err(400, 'bad_request', 'The request body must be an object.');
    body = req.body ?? {};
    if (route.kind === 'submit') {
      let extra: string[] = [];
      try { extra = (await deps.blockedTerms?.()) ?? []; } catch { /* the built-in screen still runs */ }
      const verdict = checkBody(body, extra);
      if (!verdict.ok) { deps.log('content_blocked', { category: verdict.category }); return err(400, 'blocked', verdict.message, { category: verdict.category }); }
    }
  }

  const upstreamPath = route.kind === 'balance' ? BALANCE_PATH : path;
  const upstreamMethod: 'GET' | 'POST' = route.kind === 'submit' || route.kind === 'estimate' ? 'POST' : 'GET';
  let res: { status: number; json: unknown };
  try { res = await deps.muapi(upstreamMethod, upstreamPath, key, body); } catch {
    return err(502, 'upstream', 'Could not reach muapi. Try again in a moment.');
  }

  if (res.status === 401 || res.status === 403) return err(401, 'invalid_key', 'muapi did not accept this key. Check it, or create a new one in your muapi account.');
  if (res.status === 402) return err(402, 'muapi_balance', 'Your muapi balance is too low for this. Top up your muapi account and try again.');
  if (res.status === 429) return err(429, 'upstream_busy', 'muapi is busy or you are over its rate limit. Try again in a moment.');
  if (res.status >= 500) return err(502, 'upstream', 'muapi is temporarily unavailable. Try again in a moment.');

  if (res.status >= 200 && res.status < 300) {
    if (route.kind === 'estimate') {
      const usd = readEstimateUsd(res.json);
      if (usd === null) return err(503, 'price_unavailable', 'Could not get a price for this right now.');
      // whole cents, minimum 1, so a display of "$0.60" and the confirm threshold work the same as before
      return { status: 200, body: { cost: creditsFor(usd, 1, 1), unit: 'cents' } };
    }
    return { status: 200, body: res.json };
  }
  // validation problems are the customer's to fix: pass muapi's own message through
  const message = safeMessage(res.json, key);
  if (/insufficient|balance|credit/i.test(message) && res.status === 400) return err(402, 'muapi_balance', 'Your muapi balance is too low for this. Top up your muapi account and try again.');
  return err(res.status === 404 ? 404 : res.status === 422 ? 422 : 400, 'rejected', message || 'muapi did not accept the request.');
}
