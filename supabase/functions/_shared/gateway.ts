// The gateway's decision logic, with every side effect injected so it can be tested without Deno, Supabase or muapi.
// index.ts wires the real dependencies. Rules that matter:
//   - a customer never sees muapi USD, the margin, or anything about OUR muapi account: estimates are credits only and every
//     upstream body is scrubbed before it is returned
//   - credits are reserved BEFORE the muapi call and refunded on any failure (exactly once, enforced by the database)
//   - an idempotency key means ONE request (model + body): reusing it for anything else is refused, never re-submitted
//   - a customer can only poll request ids they own, and a refunded job can never deliver its result
//   - if the price cannot be determined, the call is refused (never guess a price)
//   - every attempt (free or paid) is counted before any muapi call, so floods cannot reach the operator's muapi key
import { creditsFor, readEstimateUsd } from './pricing.ts';
import { classify } from './paths.ts';
import { isFailedBody, normalizeStatus, readRequestId } from './status.ts';
import { hasAccess, requiredEntitlements } from './entitlements.ts';
import { checkBody } from './safety.ts';
import { requestHash } from './hash.ts';
import { isOurAccountProblem, predictionView, scrub } from './scrub.ts';

export interface Caller { id: string; isAnonymous: boolean; emailConfirmed: boolean }
export interface GatewayRequest { method: string; path: string; body?: unknown; idempotencyKey?: string }
export interface GatewayResponse { status: number; body: unknown }
export interface Settings { margin: number; maxCreditsPerCall: number; killSwitch: boolean; enforceEntitlements?: boolean }
export interface ModelRule { enabled: boolean; margin: number | null; minCredits: number }

/** Thrown by the database layer; `code` is one of the codes raised by the credit functions. */
export class GatewayDbError extends Error {
  constructor(public code: string) { super(code); this.name = 'GatewayDbError'; }
}

export interface Deps {
  settings(): Promise<Settings>;
  modelRule(slug: string): Promise<ModelRule | null>;
  /** Counts one attempt. Throws GatewayDbError('rate_limited') when over the limit. */
  hit(userId: string, kind: 'free' | 'submit'): Promise<void>;
  reserve(userId: string, amount: number, slug: string, idem: string | null, hash: string): Promise<{ holdId: string; balance: number; reused: boolean }>;
  attach(holdId: string, requestId: string, usd: number): Promise<void>;
  callByHold(holdId: string): Promise<{ requestId: string } | null>;
  callOwner(requestId: string): Promise<{ userId: string; status: 'submitted' | 'completed' | 'failed' } | null>;
  settle(requestId: string): Promise<string>;
  release(requestId: string, reason: string): Promise<string>;
  releaseHold(holdId: string, reason: string): Promise<string>;
  balance(userId: string): Promise<number>;
  /** The operator's own blocked terms (safety_terms table). A failure here must not block generation, the built-in screen still runs. */
  blockedTerms?(): Promise<string[]>;
  /** Active entitlement keys the user has bought or been given. */
  entitlements(userId: string): Promise<string[]>;
  /** Talks to muapi with the SERVER key. Throws on a network error. */
  muapi(method: 'GET' | 'POST', path: string, body?: unknown): Promise<{ status: number; json: unknown }>;
  /** Structured log. Never pass keys, prompts or request bodies. */
  log(event: string, data: Record<string, unknown>): void;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const err = (status: number, code: string, error: string, extra: Record<string, unknown> = {}): GatewayResponse => ({ status, body: { error, code, ...extra } });
const REFUNDED: GatewayResponse = { status: 200, body: { status: 'failed', error: 'This generation timed out and was refunded.' } };
const UPSTREAM_DOWN = () => err(502, 'upstream', 'Temporarily unavailable. Try again.');

async function dbErrorResponse(e: unknown, deps: Deps, callerId: string, credits: number): Promise<GatewayResponse> {
  const code = e instanceof GatewayDbError ? e.code : '';
  switch (code) {
    case 'insufficient_credits': return err(402, code, 'Not enough credits.', { needed: credits, balance: await deps.balance(callerId).catch(() => 0) });
    case 'killed': return err(503, code, 'Generation is paused for maintenance. You were not charged.');
    case 'rate_limited': return err(429, code, 'You are going too fast. Wait a moment and try again. You were not charged.');
    case 'too_many_open': return err(429, code, 'You have too many generations running. Wait for one to finish. You were not charged.');
    case 'daily_cap': return err(429, code, 'You reached today\'s generation limit. You were not charged.');
    case 'amount_too_large': return err(400, code, 'That request is too large to run in one go.', { needed: credits });
    case 'idem_mismatch': return err(409, code, 'That request key was already used for a different request. You were not charged.');
    case 'idem_reused': return err(409, code, 'That attempt was already refunded. Start it again. You were not charged.');
    default:
      deps.log('db_error', { code: code || 'unknown', message: e instanceof Error ? e.message.slice(0, 200) : 'unknown' });
      return err(500, 'internal', 'Something went wrong. You were not charged.');
  }
}

/** A refusal for a bad upstream answer that is safe to show: validation problems are the customer's to fix, anything else is generic. */
function upstreamRefusal(status: number, json: unknown): GatewayResponse {
  if (isOurAccountProblem(status)) return err(503, 'service_unavailable', 'The service is temporarily unavailable. You were not charged.');
  if (status === 429 || status >= 500) return err(503, 'upstream_busy', 'The generator is busy. Try again in a moment. You were not charged.');
  if (status === 400 || status === 404 || status === 422) {
    const view = predictionView(json);
    return { status, body: Object.keys(view as object).length ? view : { error: 'The request was not accepted.' } };
  }
  return err(502, 'upstream', 'Temporarily unavailable. Try again.');
}

/** Price for one call, in credits. Returns a response instead when the price cannot be determined or the model is off. */
async function quote(slug: string, body: unknown, deps: Deps, settings: Settings): Promise<{ credits: number; usd: number } | GatewayResponse> {
  const rule = await deps.modelRule(slug);
  if (rule && !rule.enabled) return err(403, 'model_disabled', 'That model is not available right now.');
  let res: { status: number; json: unknown };
  try { res = await deps.muapi('POST', `/api/v1/models/${slug}/estimate-cost`, body ?? {}); } catch { return err(503, 'price_unavailable', 'Could not get a price right now. You were not charged.'); }
  const usd = res.status >= 200 && res.status < 300 ? readEstimateUsd(res.json) : null;
  if (usd === null) {
    if (res.status === 400 || res.status === 422) return upstreamRefusal(res.status, res.json); // a bad body is the customer's to fix
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
  // Every route needs a confirmed email: open signups must not be able to spend the operator's muapi quota on quotes or metadata either.
  if (!caller.emailConfirmed) return err(403, 'verify_email', 'Confirm your email address to generate.');

  // Count the attempt BEFORE anything reaches muapi (quotes, polls and rejected submits all count).
  try { await deps.hit(caller.id, route.kind === 'submit' ? 'submit' : 'free'); } catch (e) { return dbErrorResponse(e, deps, caller.id, 0); }

  // ---- free: model metadata (voice lists, schemas)
  if (route.kind === 'meta') {
    let r: { status: number; json: unknown };
    try { r = await deps.muapi('GET', `/api/v1/models/${route.slug}`); } catch { return UPSTREAM_DOWN(); }
    if (r.status < 200 || r.status >= 300) return r.status === 404 ? err(404, 'unknown_model', 'Unknown model.') : upstreamRefusal(r.status, r.json);
    return { status: 200, body: scrub(r.json) };
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
    // A refunded job is closed for good: even if muapi finishes it later, the customer cannot collect it.
    if (owner.status === 'failed') return REFUNDED;
    let res: { status: number; json: unknown };
    try { res = await deps.muapi('GET', `/api/v1/predictions/${route.requestId}/result`); } catch { return UPSTREAM_DOWN(); }
    const ok = res.status >= 200 && res.status < 300;
    if (ok) {
      const st = normalizeStatus(res.json);
      if (st === 'completed') {
        const settled = await deps.settle(route.requestId);
        if (settled === 'failed') return REFUNDED; // the reaper refunded it a moment ago: do not deliver
      } else if (st === 'failed' || st === 'cancelled') { await deps.release(route.requestId, 'generation failed'); deps.log('refund', { requestId: route.requestId }); }
      return { status: 200, body: predictionView(res.json) };
    }
    if (isFailedBody(res.json)) {
      await deps.release(route.requestId, 'generation failed'); deps.log('refund', { requestId: route.requestId });
      return { status: res.status, body: predictionView(res.json) };
    }
    if (isOurAccountProblem(res.status)) { deps.log('upstream_account_problem', { status: res.status, kind: 'poll' }); return err(503, 'service_unavailable', 'The service is temporarily unavailable. Try again.'); }
    if (res.status >= 500 || res.status === 429) return UPSTREAM_DOWN(); // transient: keep the hold, the client retries
    return { status: res.status, body: predictionView(res.json) };
  }

  // ---- submit: the paid path
  if (settings.killSwitch) return err(503, 'killed', 'Generation is paused for maintenance. You were not charged.');
  if (!isObj(req.body)) return err(400, 'bad_request', 'The request body must be an object.');

  // Paid features: checked before anything is quoted, reserved or sent to muapi.
  if (settings.enforceEntitlements !== false && requiredEntitlements(route.slug)) {
    let owned: string[];
    try { owned = await deps.entitlements(caller.id); } catch { return err(503, 'service_unavailable', 'The service is temporarily unavailable. Try again.'); }
    const access = hasAccess(route.slug, owned);
    if (!access.ok) return err(403, 'locked', 'This feature is part of a pack you have not unlocked. You were not charged.', { entitlement: access.needs[0], entitlements: access.needs });
  }

  // Content screen: before anything is quoted, reserved or sent to muapi.
  let extra: string[] = [];
  try { extra = (await deps.blockedTerms?.()) ?? []; } catch { /* the built-in screen still runs */ }
  const verdict = checkBody(req.body, extra);
  if (!verdict.ok) { deps.log('content_blocked', { category: verdict.category, slug: route.slug }); return err(400, 'blocked', `${verdict.message} You were not charged.`, { category: verdict.category }); }

  const q = await quote(route.slug, req.body, deps, settings);
  if ('status' in q) return q;
  if (q.credits > settings.maxCreditsPerCall) return err(400, 'amount_too_large', 'That request is too large to run in one go.', { needed: q.credits });

  const hash = await requestHash(route.slug, req.body);
  let hold: { holdId: string; balance: number; reused: boolean };
  try { hold = await deps.reserve(caller.id, q.credits, route.slug, req.idempotencyKey ?? null, hash); } catch (e) { return dbErrorResponse(e, deps, caller.id, q.credits); }

  if (hold.reused) {
    // The same request was already reserved. Never submit twice: return the job if it exists, otherwise it is still being submitted.
    const existing = await deps.callByHold(hold.holdId);
    if (existing) return { status: 200, body: { request_id: existing.requestId, status: 'processing', credits: { charged: q.credits, balance: hold.balance } } };
    return err(409, 'in_progress', 'That request is already being processed. You were not charged twice.');
  }

  let res: { status: number; json: unknown };
  try { res = await deps.muapi('POST', `/api/v1/${route.slug}`, req.body); } catch {
    // A timeout can still mean muapi accepted the job. We cannot track it, so the customer is refunded; log it so the operator can reconcile.
    deps.log('submit_uncertain', { slug: route.slug, holdId: hold.holdId });
    await deps.releaseHold(hold.holdId, 'submit failed');
    return err(502, 'upstream', 'Could not reach the generator. You were not charged.');
  }
  const requestId = res.status >= 200 && res.status < 300 ? readRequestId(res.json) : null;
  if (!requestId) {
    await deps.releaseHold(hold.holdId, 'submit rejected');
    if (isOurAccountProblem(res.status)) deps.log('upstream_account_problem', { status: res.status, slug: route.slug }); // our muapi key or balance: alert the operator
    return upstreamRefusal(res.status, res.json);
  }
  let attached = false;
  for (let i = 0; i < 3 && !attached; i++) {
    try { await deps.attach(hold.holdId, requestId, q.usd); attached = true; } catch (e) {
      deps.log('attach_retry', { requestId, attempt: i + 1, message: e instanceof Error ? e.message.slice(0, 200) : 'unknown' });
    }
  }
  if (!attached) {
    // The job exists at muapi but the customer cannot poll it: refund, and log the request id so the operator can reconcile.
    await deps.releaseHold(hold.holdId, 'could not record the request');
    deps.log('attach_failed', { requestId, slug: route.slug, holdId: hold.holdId });
    return err(500, 'internal', 'Something went wrong. You were not charged.');
  }
  deps.log('charged', { slug: route.slug, credits: q.credits, requestId });
  return { status: 200, body: { request_id: requestId, status: 'processing', credits: { charged: q.credits, balance: hold.balance } } };
}
