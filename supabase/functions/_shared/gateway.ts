// The gateway's decision logic, with every side effect injected so it can be tested without Deno, Supabase or muapi.
// index.ts wires the real dependencies. Rules that matter:
//   - a customer never sees muapi USD or the margin: estimates are returned in credits only
//   - credits are reserved BEFORE the muapi call and refunded on any failure (exactly once, enforced by the database)
//   - a customer can only poll request ids they own
//   - if the price cannot be determined, the call is refused (never guess a price)
import { creditsFor, readEstimateUsd } from './pricing.ts';
import { classify } from './paths.ts';
import { isFailedBody, normalizeStatus, readRequestId } from './status.ts';

export interface Caller { id: string; isAnonymous: boolean; emailConfirmed: boolean }
export interface GatewayRequest { method: string; path: string; body?: unknown; idempotencyKey?: string }
export interface GatewayResponse { status: number; body: unknown }
export interface Settings { margin: number; maxCreditsPerCall: number; killSwitch: boolean }
export interface ModelRule { enabled: boolean; margin: number | null; minCredits: number }

/** Thrown by the database layer; `code` is one of the codes raised by credit_reserve. */
export class GatewayDbError extends Error {
  constructor(public code: string) { super(code); this.name = 'GatewayDbError'; }
}

export interface Deps {
  settings(): Promise<Settings>;
  modelRule(slug: string): Promise<ModelRule | null>;
  reserve(userId: string, amount: number, slug: string, idem: string | null): Promise<{ holdId: string; balance: number; reused: boolean }>;
  attach(holdId: string, requestId: string, usd: number): Promise<void>;
  callByHold(holdId: string): Promise<{ requestId: string } | null>;
  callOwner(requestId: string): Promise<{ userId: string; status: 'submitted' | 'completed' | 'failed' } | null>;
  settle(requestId: string): Promise<string>;
  release(requestId: string, reason: string): Promise<string>;
  releaseHold(holdId: string, reason: string): Promise<string>;
  balance(userId: string): Promise<number>;
  /** Talks to muapi with the SERVER key. Throws on a network error. */
  muapi(method: 'GET' | 'POST', path: string, body?: unknown): Promise<{ status: number; json: unknown }>;
  /** Structured log. Never pass keys, prompts or request bodies. */
  log(event: string, data: Record<string, unknown>): void;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const err = (status: number, code: string, error: string, extra: Record<string, unknown> = {}): GatewayResponse => ({ status, body: { error, code, ...extra } });

async function dbErrorResponse(e: unknown, deps: Deps, callerId: string, credits: number): Promise<GatewayResponse> {
  const code = e instanceof GatewayDbError ? e.code : '';
  switch (code) {
    case 'insufficient_credits': return err(402, code, 'Not enough credits.', { needed: credits, balance: await deps.balance(callerId).catch(() => 0) });
    case 'killed': return err(503, code, 'Generation is paused for maintenance. You were not charged.');
    case 'rate_limited': return err(429, code, 'You are going too fast. Wait a moment and try again. You were not charged.');
    case 'too_many_open': return err(429, code, 'You have too many generations running. Wait for one to finish. You were not charged.');
    case 'daily_cap': return err(429, code, 'You reached today\'s generation limit. You were not charged.');
    case 'amount_too_large': return err(400, code, 'That request is too large to run in one go.', { needed: credits });
    default:
      deps.log('db_error', { code: code || 'unknown', message: e instanceof Error ? e.message.slice(0, 200) : 'unknown' });
      return err(500, 'internal', 'Something went wrong. You were not charged.');
  }
}

/** Price for one call, in credits. Returns a response instead when the price cannot be determined or the model is off. */
async function quote(slug: string, body: unknown, deps: Deps, settings: Settings): Promise<{ credits: number; usd: number } | GatewayResponse> {
  const rule = await deps.modelRule(slug);
  if (rule && !rule.enabled) return err(403, 'model_disabled', 'That model is not available right now.');
  let res: { status: number; json: unknown };
  try { res = await deps.muapi('POST', `/api/v1/models/${slug}/estimate-cost`, body ?? {}); } catch { return err(503, 'price_unavailable', 'Could not get a price right now. You were not charged.'); }
  const usd = res.status >= 200 && res.status < 300 ? readEstimateUsd(res.json) : null;
  if (usd === null) {
    // a bad request body is the customer's to fix; anything else is on us
    if (res.status === 400 || res.status === 422) return { status: res.status, body: res.json };
    return err(503, 'price_unavailable', 'Could not get a price right now. You were not charged.');
  }
  return { credits: creditsFor(usd, rule?.margin ?? settings.margin, rule?.minCredits ?? 1), usd };
}

export async function handle(caller: Caller | null, req: GatewayRequest, deps: Deps): Promise<GatewayResponse> {
  if (!caller) return err(401, 'unauthorized', 'Sign in to continue.');
  if (caller.isAnonymous) return err(403, 'account_required', 'Create an account to generate.');
  const method = String(req.method ?? 'POST').toUpperCase();
  if (method !== 'GET' && method !== 'POST') return err(400, 'bad_request', 'Bad method.');
  const route = classify(method, String(req.path ?? ''));
  if (route.kind === 'denied') return err(400, 'path_not_allowed', 'Path not allowed.');

  // ---- free: model metadata (voice lists, schemas)
  if (route.kind === 'meta') {
    try { const r = await deps.muapi('GET', `/api/v1/models/${route.slug}`); return { status: r.status, body: r.json }; } catch { return err(502, 'upstream', 'Temporarily unavailable. Try again.'); }
  }

  const settings = await deps.settings();

  // ---- free: price in credits
  if (route.kind === 'estimate') {
    const q = await quote(route.slug, req.body, deps, settings);
    if ('status' in q) return q;
    return { status: 200, body: { cost: q.credits, unit: 'credits' } };
  }

  // ---- poll: only the owner, and this is where the charge is settled or refunded
  if (route.kind === 'poll') {
    const owner = await deps.callOwner(route.requestId);
    if (!owner || owner.userId !== caller.id) return err(404, 'unknown_request', 'Unknown request.');
    let res: { status: number; json: unknown };
    try { res = await deps.muapi('GET', `/api/v1/predictions/${route.requestId}/result`); } catch { return err(502, 'upstream', 'Temporarily unavailable. Try again.'); }
    const ok = res.status >= 200 && res.status < 300;
    if (ok) {
      const st = normalizeStatus(res.json);
      if (st === 'completed') await deps.settle(route.requestId);
      else if (st === 'failed' || st === 'cancelled') { await deps.release(route.requestId, 'generation failed'); deps.log('refund', { requestId: route.requestId }); }
    } else if (isFailedBody(res.json)) {
      await deps.release(route.requestId, 'generation failed'); deps.log('refund', { requestId: route.requestId });
    } else if (res.status >= 500 || res.status === 429) {
      return err(502, 'upstream', 'Temporarily unavailable. Try again.'); // transient: keep the hold, the client retries
    }
    return { status: res.status, body: res.json };
  }

  // ---- submit: the paid path
  if (settings.killSwitch) return err(503, 'killed', 'Generation is paused for maintenance. You were not charged.');
  if (!caller.emailConfirmed) return err(403, 'verify_email', 'Confirm your email address to generate.');
  if (!isObj(req.body)) return err(400, 'bad_request', 'The request body must be an object.');

  const q = await quote(route.slug, req.body, deps, settings);
  if ('status' in q) return q;
  if (q.credits > settings.maxCreditsPerCall) return err(400, 'amount_too_large', 'That request is too large to run in one go.', { needed: q.credits });

  let hold: { holdId: string; balance: number; reused: boolean };
  try { hold = await deps.reserve(caller.id, q.credits, route.slug, req.idempotencyKey ?? null); } catch (e) { return dbErrorResponse(e, deps, caller.id, q.credits); }

  if (hold.reused) {
    // the same call was already reserved: never submit twice
    const existing = await deps.callByHold(hold.holdId);
    if (existing) return { status: 200, body: { request_id: existing.requestId, status: 'processing', credits: { charged: q.credits, balance: hold.balance } } };
  }

  let res: { status: number; json: unknown };
  try { res = await deps.muapi('POST', `/api/v1/${route.slug}`, req.body); } catch {
    await deps.releaseHold(hold.holdId, 'submit failed');
    return err(502, 'upstream', 'Could not reach the generator. You were not charged.');
  }
  const requestId = res.status >= 200 && res.status < 300 ? readRequestId(res.json) : null;
  if (!requestId) {
    await deps.releaseHold(hold.holdId, 'submit rejected');
    if (res.status === 401 || res.status === 402 || res.status === 403) {
      deps.log('upstream_account_problem', { status: res.status, slug: route.slug }); // our muapi key or balance: alert the operator
      return err(503, 'service_unavailable', 'The service is temporarily unavailable. You were not charged.');
    }
    if (res.status === 429 || res.status >= 500) return err(503, 'upstream_busy', 'The generator is busy. Try again in a moment. You were not charged.');
    return { status: res.status >= 400 ? res.status : 502, body: res.json }; // e.g. a validation message the customer can act on
  }
  try { await deps.attach(hold.holdId, requestId, q.usd); } catch (e) {
    // we cannot track this job, so the customer could not poll it: refund and alert
    await deps.releaseHold(hold.holdId, 'could not record the request');
    deps.log('attach_failed', { requestId, message: e instanceof Error ? e.message.slice(0, 200) : 'unknown' });
    return err(500, 'internal', 'Something went wrong. You were not charged.');
  }
  deps.log('charged', { slug: route.slug, credits: q.credits, requestId });
  return { status: 200, body: { ...(isObj(res.json) ? res.json : {}), request_id: requestId, credits: { charged: q.credits, balance: hold.balance } } };
}
