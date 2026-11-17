import { describe, expect, it } from 'vitest';
import { GatewayDbError, handle, type Caller, type Deps, type GatewayRequest } from './gateway.ts';
import { creditsFor, readEstimateUsd } from './pricing.ts';
import { classify } from './paths.ts';
import { isFailedBody, normalizeStatus as serverStatus, readRequestId } from './status.ts';
import { normalizeStatus as clientStatus } from '../../../src/lib/muapi/result';

// ---------------------------------------------------------------- a fake bank that mirrors the SQL semantics, and a fake muapi
function world(opts: { balance?: number; usd?: number | null; settings?: Partial<{ margin: number; maxCreditsPerCall: number; killSwitch: boolean }> } = {}) {
  const w = {
    balance: opts.balance ?? 1000,
    holds: new Map<string, { amount: number; status: 'held' | 'settled' | 'released'; idem: string | null; hash: string; slug: string }>(),
    owned: [] as string[], enforce: true as boolean, entitlementsThrows: false,
    hits: [] as Array<'free' | 'submit'>, hitError: null as string | null, quoteBodies: [] as unknown[], submitBodies: [] as unknown[],
    calls: new Map<string, { userId: string; holdId: string; status: 'submitted' | 'completed' | 'failed' }>(),
    submits: 0, estimates: 0, logs: [] as Array<[string, Record<string, unknown>]>,
    usd: opts.usd === undefined ? 0.6 : opts.usd,
    muapiSubmit: (): { status: number; json: unknown } => ({ status: 200, json: { request_id: 'req-' + w.submits, status: 'processing' } }),
    muapiResult: (): { status: number; json: unknown } => ({ status: 200, json: { status: 'processing' } }),
    muapiThrows: false, estimateThrows: false, attachThrows: false,
    reserveError: null as string | null,
  };
  let n = 0;
  const deps: Deps = {
    settings: async () => ({ margin: 2.5, maxCreditsPerCall: 1500, killSwitch: false, enforceEntitlements: w.enforce, ...opts.settings }),
    modelRule: async () => null,
    entitlements: async () => { if (w.entitlementsThrows) throw new Error('db'); return w.owned; },
    hit: async (_u, kind) => { w.hits.push(kind); if (w.hitError) throw new GatewayDbError(w.hitError); },
    // mirrors credit_reserve: a reused key must carry the same request, and a refunded key can never start a new job
    reserve: async (_u, amount, slug, idem, hash) => {
      if (w.reserveError) throw new GatewayDbError(w.reserveError);
      if (idem) for (const [id, h] of w.holds) if (h.idem === idem) {
        if (h.hash !== hash || h.slug !== slug || h.amount !== amount) throw new GatewayDbError('idem_mismatch');
        if (h.status === 'released') throw new GatewayDbError('idem_reused');
        return { holdId: id, balance: w.balance, reused: true };
      }
      if (w.balance < amount) throw new GatewayDbError('insufficient_credits');
      const id = 'hold-' + ++n; w.balance -= amount; w.holds.set(id, { amount, status: 'held', idem, hash, slug }); return { holdId: id, balance: w.balance, reused: false };
    },
    attach: async (holdId, requestId) => { if (w.attachThrows) throw new Error('db down'); w.calls.set(requestId, { userId: 'u1', holdId, status: 'submitted' }); },
    callByHold: async holdId => { for (const [rid, c] of w.calls) if (c.holdId === holdId) return { requestId: rid }; return null; },
    callOwner: async rid => { const c = w.calls.get(rid); return c ? { userId: c.userId, status: c.status } : null; },
    settle: async rid => { const c = w.calls.get(rid)!; if (c.status === 'failed') return 'failed'; c.status = 'completed'; const h = w.holds.get(c.holdId)!; if (h.status === 'held') h.status = 'settled'; return 'completed'; },
    release: async rid => { const c = w.calls.get(rid)!; if (c.status === 'completed') return 'completed'; const h = w.holds.get(c.holdId)!; if (h.status === 'held') { h.status = 'released'; w.balance += h.amount; } c.status = 'failed'; return 'failed'; },
    releaseHold: async id => { const h = w.holds.get(id)!; if (h.status === 'held') { h.status = 'released'; w.balance += h.amount; } return h.status; },
    balance: async () => w.balance,
    muapi: async (method, path, _b) => {
      if (path.endsWith('/estimate-cost')) { w.estimates++; w.quoteBodies.push(_b); if (w.estimateThrows) throw new Error('net'); return w.usd === null ? { status: 500, json: {} } : { status: 200, json: { cost: w.usd } }; }
      if (w.muapiThrows) throw new Error('net');
      if (method === 'POST') { w.submits++; w.submitBodies.push(_b); return w.muapiSubmit(); }
      return w.muapiResult();
    },
    log: (event, data) => { w.logs.push([event, data]); },
  };
  return { w, deps };
}
const user: Caller = { id: 'u1', isAnonymous: false, emailConfirmed: true };
const submit = (extra: Partial<GatewayRequest> = {}): GatewayRequest => ({ method: 'POST', path: '/api/v1/veo3.1-fast-text-to-video', body: { prompt: 'x' }, ...extra });
const poll = (id = 'req-1'): GatewayRequest => ({ method: 'GET', path: `/api/v1/predictions/${id}/result` });

describe('pricing', () => {
  it('charges ceil(usd x 100 x margin) with no float error', () => {
    expect(creditsFor(0.6, 2.5)).toBe(150);   // 0.6*100*2.5 is 150.00000000000003 in floats
    expect(creditsFor(0.04, 2.5)).toBe(10);
    expect(creditsFor(1.5, 2.5)).toBe(375);
    expect(creditsFor(0.123, 2.5)).toBe(31);  // 30.75 rounds up
  });
  it('never charges less than the minimum and rejects nonsense', () => {
    expect(creditsFor(0, 2.5)).toBe(1);
    expect(creditsFor(0.001, 2.5, 5)).toBe(5);
    expect(() => creditsFor(-1, 2.5)).toThrow(); expect(() => creditsFor(NaN, 2.5)).toThrow(); expect(() => creditsFor(1, 0.5)).toThrow();
  });
  it('reads the estimate whatever shape it arrives in', () => {
    expect(readEstimateUsd({ cost: 0.6 })).toBe(0.6);
    expect(readEstimateUsd({ cost: '0.6' })).toBe(0.6);
    expect(readEstimateUsd({ cost: { amount_usd: 0.25 } })).toBe(0.25);
    expect(readEstimateUsd({ estimated_cost: 1 })).toBe(1);
    expect(readEstimateUsd({ cost: -1 })).toBeNull();
    expect(readEstimateUsd({})).toBeNull(); expect(readEstimateUsd('x')).toBeNull();
  });
});

describe('path classification', () => {
  it('allows only the documented shapes', () => {
    expect(classify('POST', '/api/v1/veo3.1-fast-text-to-video')).toEqual({ kind: 'submit', slug: 'veo3.1-fast-text-to-video' });
    expect(classify('POST', '/api/v1/models/omnihuman-2-0/estimate-cost')).toEqual({ kind: 'estimate', slug: 'omnihuman-2-0' });
    expect(classify('GET', '/api/v1/models/elevenlabs-tts-turbo-2-5')).toEqual({ kind: 'meta', slug: 'elevenlabs-tts-turbo-2-5' });
    expect(classify('GET', '/api/v1/predictions/abc-123/result')).toEqual({ kind: 'poll', requestId: 'abc-123' });
  });
  it('denies account data, uploads, wrong methods and traversal', () => {
    for (const [m, p] of [['GET', '/api/v1/account/balance'], ['POST', '/api/v1/account'], ['POST', '/api/v1/upload_file'], ['POST', '/api/v1/get_upload_url'], ['GET', '/api/v1/balance'],
      ['GET', '/api/v1/veo3.1-fast-text-to-video'], ['POST', '/api/v1/predictions/abc/result'], ['GET', '/api/v1/models/x/estimate-cost'], ['POST', '/api/v1/../account/balance'],
      ['POST', '/api/v1/x?y=1'], ['POST', '//evil.test/api/v1/x'], ['POST', 'api/v1/x'], ['POST', '/other/x']] as const) {
      expect(classify(m, p).kind, `${m} ${p}`).toBe('denied');
    }
  });
});

describe('status parity with the client parser', () => {
  const cases: unknown[] = [{ status: 'completed' }, { status: 'Succeeded' }, { status: 'failed' }, { status: 'error' }, { status: 'canceled' }, { status: 'pending' }, { status: 'processing' },
    { task_status: 'done' }, { prediction: { status: 'failed' } }, { data: { status: 'success' } }, { output: { status: 'queued' } }, {}, null, 'x', { status: '' }];
  it.each(cases.map((c, i) => [i, c]))('case %i', (_i, c) => expect(serverStatus(c)).toBe(clientStatus(c)));
  it('reads failed bodies and request ids', () => {
    expect(isFailedBody({ detail: { id: 'a', status: 'failed', error: 'boom' } })).toBe(true);
    expect(isFailedBody({ detail: 'Not found' })).toBe(false);
    expect(readRequestId({ request_id: 'abc-123' })).toBe('abc-123'); expect(readRequestId({ id: 'x' })).toBeNull(); expect(readRequestId({})).toBeNull();
  });
});

describe('who may call', () => {
  it('rejects signed-out, anonymous and unverified callers on the paid path', async () => {
    const { deps, w } = world();
    expect((await handle(null, submit(), deps)).status).toBe(401);
    expect((await handle({ ...user, isAnonymous: true }, submit(), deps)).status).toBe(403);
    const unverified = await handle({ ...user, emailConfirmed: false }, submit(), deps);
    expect(unverified).toMatchObject({ status: 403, body: { code: 'verify_email' } });
    expect(w.submits).toBe(0); expect(w.balance).toBe(1000);
  });
  it('denies paths outside the allowlist without touching muapi', async () => {
    const { deps, w } = world();
    const r = await handle(user, { method: 'GET', path: '/api/v1/account/balance' }, deps);
    expect(r.status).toBe(400); expect(w.estimates + w.submits).toBe(0);
  });
});

describe('pricing and quotes', () => {
  it('shows the estimate in credits only, never muapi dollars or the margin', async () => {
    const { deps } = world({ usd: 0.6 });
    const r = await handle(user, { method: 'POST', path: '/api/v1/models/veo3.1-fast-text-to-video/estimate-cost', body: { prompt: 'x' } }, deps);
    expect(r).toEqual({ status: 200, body: { cost: 150, unit: 'credits' } });
  });
  it('refuses to guess a price when muapi cannot give one', async () => {
    const a = world({ usd: null }); const r = await handle(user, submit(), a.deps);
    expect(r).toMatchObject({ status: 503, body: { code: 'price_unavailable' } }); expect(a.w.submits).toBe(0); expect(a.w.balance).toBe(1000);
    const b = world(); b.w.estimateThrows = true;
    expect((await handle(user, submit(), b.deps)).status).toBe(503); expect(b.w.submits).toBe(0);
  });
  it('refuses a call over the per-call cap', async () => {
    const { deps, w } = world({ usd: 10, settings: { maxCreditsPerCall: 1500 } }); // 2500 credits
    expect(await handle(user, submit(), deps)).toMatchObject({ status: 400, body: { code: 'amount_too_large', needed: 2500 } }); expect(w.submits).toBe(0);
  });
});

describe('charging', () => {
  it('reserves before submitting, returns the charge and balance, and settles on success', async () => {
    const { deps, w } = world();
    const r = await handle(user, submit(), deps);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ request_id: 'req-1', credits: { charged: 150, balance: 850 } });
    expect(w.balance).toBe(850); expect(w.submits).toBe(1);
    w.muapiResult = () => ({ status: 200, json: { status: 'completed', outputs: ['https://cdn.muapi.ai/a.mp4'] } });
    expect((await handle(user, poll(), deps)).status).toBe(200);
    expect(w.balance).toBe(850); expect(w.holds.get('hold-1')!.status).toBe('settled');
    // polling again is harmless
    await handle(user, poll(), deps); expect(w.balance).toBe(850);
  });
  it('refunds when muapi reports the generation failed (error in a 200 body)', async () => {
    const { deps, w } = world(); await handle(user, submit(), deps);
    w.muapiResult = () => ({ status: 200, json: { status: 'failed', error: 'content policy' } });
    const r = await handle(user, poll(), deps);
    expect(r.status).toBe(200); expect(w.balance).toBe(1000);
    await handle(user, poll(), deps); expect(w.balance).toBe(1000); // once only
  });
  it('refunds when muapi reports failure as an HTTP error with a detail body (the real shape)', async () => {
    const { deps, w } = world(); await handle(user, submit(), deps);
    w.muapiResult = () => ({ status: 400, json: { detail: { id: 'req-1', status: 'failed', error: 'bad input' } } });
    const r = await handle(user, poll(), deps);
    expect(r.status).toBe(400); expect(w.balance).toBe(1000);
  });
  it('keeps the hold on a transient upstream error and lets the client retry', async () => {
    const { deps, w } = world(); await handle(user, submit(), deps);
    w.muapiResult = () => ({ status: 503, json: {} });
    expect((await handle(user, poll(), deps)).status).toBe(502); expect(w.balance).toBe(850);
    w.muapiResult = () => ({ status: 200, json: { status: 'completed', outputs: ['https://cdn.muapi.ai/a.mp4'] } });
    await handle(user, poll(), deps); expect(w.holds.get('hold-1')!.status).toBe('settled');
  });
  it('a failure after delivery never refunds a delivered clip', async () => {
    const { deps, w } = world(); await handle(user, submit(), deps);
    w.muapiResult = () => ({ status: 200, json: { status: 'completed', outputs: ['https://cdn.muapi.ai/a.mp4'] } });
    await handle(user, poll(), deps);
    w.muapiResult = () => ({ status: 200, json: { status: 'failed' } });
    await handle(user, poll(), deps); expect(w.balance).toBe(850);
  });
  it('refunds and reports "not charged" when the submit is rejected or the network fails', async () => {
    const a = world(); a.w.muapiSubmit = () => ({ status: 422, json: { detail: [{ msg: 'prompt too long' }] } });
    const ra = await handle(user, submit(), a.deps);
    expect(ra.status).toBe(422); expect(ra.body).toEqual({ detail: [{ msg: 'prompt too long' }] }); expect(a.w.balance).toBe(1000);
    const b = world(); b.w.muapiThrows = true;
    expect(await handle(user, submit(), b.deps)).toMatchObject({ status: 502 }); expect(b.w.balance).toBe(1000);
  });
  it('hides our own muapi account problems from customers and alerts the operator', async () => {
    const { deps, w } = world(); w.muapiSubmit = () => ({ status: 402, json: { detail: 'Insufficient balance' } });
    const r = await handle(user, submit(), deps);
    expect(r).toMatchObject({ status: 503, body: { code: 'service_unavailable' } });
    expect(JSON.stringify(r.body)).not.toMatch(/balance|402/i); expect(w.balance).toBe(1000);
    expect(w.logs.some(([e]) => e === 'upstream_account_problem')).toBe(true);
  });
  it('refunds if the request cannot be recorded (the customer could not poll it)', async () => {
    const { deps, w } = world(); w.attachThrows = true;
    expect(await handle(user, submit(), deps)).toMatchObject({ status: 500 }); expect(w.balance).toBe(1000);
    expect(w.logs.some(([e]) => e === 'attach_failed')).toBe(true);
  });
  it('returns 402 with how many credits are needed', async () => {
    const { deps, w } = world({ balance: 40 });
    const r = await handle(user, submit(), deps);
    expect(r).toMatchObject({ status: 402, body: { code: 'insufficient_credits', needed: 150, balance: 40 } }); expect(w.submits).toBe(0); expect(w.balance).toBe(40);
  });
  it('a retry with the same idempotency key charges once and submits once', async () => {
    const { deps, w } = world();
    const a = await handle(user, submit({ idempotencyKey: 'k1' }), deps);
    const b = await handle(user, submit({ idempotencyKey: 'k1' }), deps);
    expect((b.body as { request_id: string }).request_id).toBe((a.body as { request_id: string }).request_id);
    expect(w.submits).toBe(1); expect(w.balance).toBe(850);
  });
});

describe('limits and the kill switch', () => {
  it.each([['rate_limited', 429], ['too_many_open', 429], ['daily_cap', 429], ['killed', 503], ['amount_too_large', 400]] as const)('maps the database code %s to HTTP %i without submitting', async (code, status) => {
    const { deps, w } = world(); w.reserveError = code;
    const r = await handle(user, submit(), deps);
    expect(r.status).toBe(status); expect((r.body as { code: string }).code).toBe(code); expect(w.submits).toBe(0);
  });
  it('the kill switch refuses paid calls before any muapi call, but still lets people poll their own jobs', async () => {
    const live = world(); await handle(user, submit(), live.deps);
    const { deps, w } = world({ settings: { killSwitch: true } });
    expect(await handle(user, submit(), deps)).toMatchObject({ status: 503, body: { code: 'killed' } }); expect(w.estimates + w.submits).toBe(0);
    // a job started before the switch can still finish and settle
    live.w.muapiResult = () => ({ status: 200, json: { status: 'completed', outputs: ['https://cdn.muapi.ai/a.mp4'] } });
    const killed: Deps = { ...live.deps, settings: async () => ({ margin: 2.5, maxCreditsPerCall: 1500, killSwitch: true }) };
    expect((await handle(user, poll(), killed)).status).toBe(200);
  });
  it('an unexpected database error is generic and logged, not leaked', async () => {
    const { deps, w } = world(); w.reserveError = 'weird sql text with secrets';
    const r = await handle(user, submit(), deps);
    expect(r).toMatchObject({ status: 500, body: { code: 'internal' } }); expect(JSON.stringify(r.body)).not.toMatch(/secrets|sql/);
  });
});

describe('polling ownership', () => {
  it('404s for other people\'s requests and for unknown ids, without calling muapi', async () => {
    const { deps, w } = world(); await handle(user, submit(), deps);
    const before = w.submits;
    expect((await handle({ ...user, id: 'someone-else' }, poll(), deps)).status).toBe(404);
    expect((await handle(user, poll('never-existed'), deps)).status).toBe(404);
    expect(w.submits).toBe(before);
  });
});

describe('metadata', () => {
  it('passes model metadata through for free', async () => {
    const { deps, w } = world(); w.muapiResult = () => ({ status: 200, json: { voices: ['a'] } });
    expect(await handle(user, { method: 'GET', path: '/api/v1/models/elevenlabs-tts-turbo-2-5' }, deps)).toEqual({ status: 200, body: { voices: ['a'] } });
    expect(w.balance).toBe(1000);
  });
});

describe('logging', () => {
  it('never logs prompts or keys', async () => {
    const { deps, w } = world(); await handle(user, submit({ body: { prompt: 'SECRET PROMPT TEXT' } }), deps);
    expect(JSON.stringify(w.logs)).not.toMatch(/SECRET PROMPT TEXT/);
  });
});


// ================================================================ review findings (security review of the credits system)
describe('H1: a refunded job can never deliver its result', () => {
  const finished = () => ({ status: 200, json: { status: 'completed', outputs: ['https://cdn.muapi.ai/a.mp4'] } });
  it('after the reaper refunded a job (call marked failed) polling returns a refund notice, not the video, and does not ask muapi', async () => {
    const { deps, w } = world(); await handle(user, submit(), deps);
    w.calls.get('req-1')!.status = 'failed'; w.holds.get('hold-1')!.status = 'released'; w.balance += 150; // what the reaper does
    w.muapiResult = finished;
    const r = await handle(user, poll(), deps);
    expect(JSON.stringify(r.body)).not.toContain('cdn.muapi.ai'); expect(r.body).toMatchObject({ status: 'failed' }); expect(w.balance).toBe(1000);
  });
  it('a result that completes in the instant the reaper refunds is not delivered either (settle answers "failed")', async () => {
    const { deps, w } = world(); await handle(user, submit(), deps);
    w.muapiResult = finished;
    const racing: Deps = { ...deps, settle: async () => 'failed' };
    const r = await handle(user, poll(), racing);
    expect(JSON.stringify(r.body)).not.toContain('cdn.muapi.ai'); expect(r.body).toMatchObject({ status: 'failed' });
  });
  it('a normal completed job is still delivered', async () => {
    const { deps, w } = world(); await handle(user, submit(), deps);
    w.muapiResult = finished;
    expect(JSON.stringify((await handle(user, poll(), deps)).body)).toContain('cdn.muapi.ai');
  });
});

describe('H2: an idempotency key means exactly one request', () => {
  it('refuses the same key with a different body (no cheaper charge for a bigger job) and submits nothing more', async () => {
    const { deps, w } = world();
    await handle(user, submit({ idempotencyKey: 'k', body: { prompt: 'short' } }), deps);
    const r = await handle(user, submit({ idempotencyKey: 'k', body: { prompt: 'a much bigger and pricier job' } }), deps);
    expect(r).toMatchObject({ status: 409, body: { code: 'idem_mismatch' } }); expect(w.submits).toBe(1); expect(w.balance).toBe(850);
  });
  it('refuses the same key on a different model', async () => {
    const { deps, w } = world(); w.owned = ['pro_pack'];
    await handle(user, submit({ idempotencyKey: 'k' }), deps);
    const r = await handle(user, { method: 'POST', path: '/api/v1/omnihuman-2-0', body: { prompt: 'x' }, idempotencyKey: 'k' }, deps);
    expect(r).toMatchObject({ status: 409, body: { code: 'idem_mismatch' } }); expect(w.submits).toBe(1);
  });
  it('a key whose attempt was refunded can never start a new, uncharged job', async () => {
    const { deps, w } = world(); w.muapiSubmit = () => ({ status: 422, json: { detail: [{ msg: 'bad' }] } });
    await handle(user, submit({ idempotencyKey: 'k' }), deps); expect(w.balance).toBe(1000); // refunded
    w.muapiSubmit = () => ({ status: 200, json: { request_id: 'req-9' } });
    const r = await handle(user, submit({ idempotencyKey: 'k' }), deps);
    expect(r).toMatchObject({ status: 409, body: { code: 'idem_reused' } }); expect(w.submits).toBe(1);
  });
  it('a retry while the first call is still submitting (no job yet) is told "in progress" and never submits twice', async () => {
    const { deps, w } = world();
    let release!: () => void; const gate = new Promise<void>(r => { release = r; });
    const slow: Deps = { ...deps, muapi: async (m, p, b) => { if (m === 'POST' && !p.endsWith('/estimate-cost')) await gate; return deps.muapi(m, p, b); } };
    const first = handle(user, submit({ idempotencyKey: 'k' }), slow);
    await new Promise(r => setTimeout(r, 5));
    const retry = await handle(user, submit({ idempotencyKey: 'k' }), slow);
    expect(retry).toMatchObject({ status: 409, body: { code: 'in_progress' } });
    release(); await first; expect(w.submits).toBe(1); expect(w.balance).toBe(850);
  });
  it('the same body in a different key order is the same request', async () => {
    const { deps, w } = world();
    const a = await handle(user, submit({ idempotencyKey: 'k', body: { prompt: 'x', duration: 8 } }), deps);
    const b = await handle(user, submit({ idempotencyKey: 'k', body: { duration: 8, prompt: 'x' } }), deps);
    expect((b.body as { request_id: string }).request_id).toBe((a.body as { request_id: string }).request_id); expect(w.submits).toBe(1);
  });
});

describe('M1/M2: every attempt is counted before muapi is touched', () => {
  it('counts quotes, polls and metadata as free hits, and submits as submit hits', async () => {
    const { deps, w } = world();
    await handle(user, { method: 'POST', path: '/api/v1/models/x/estimate-cost', body: {} }, deps);
    await handle(user, { method: 'GET', path: '/api/v1/models/x' }, deps);
    await handle(user, submit(), deps); await handle(user, poll(), deps);
    expect(w.hits).toEqual(['free', 'free', 'submit', 'free']);
  });
  it('a limited user costs muapi nothing: no quote, no submit', async () => {
    const { deps, w } = world(); w.hitError = 'rate_limited';
    for (const r of [submit(), poll(), { method: 'GET', path: '/api/v1/models/x' }, { method: 'POST', path: '/api/v1/models/x/estimate-cost', body: {} }]) {
      expect((await handle(user, r, deps)).status).toBe(429);
    }
    expect(w.estimates + w.submits).toBe(0);
  });
  it('rejected submits still count (so refund loops cannot dodge the limit)', async () => {
    const { deps, w } = world(); w.muapiSubmit = () => ({ status: 422, json: {} });
    await handle(user, submit(), deps); await handle(user, submit(), deps);
    expect(w.hits.filter(h => h === 'submit')).toHaveLength(2);
  });
  it('unconfirmed emails cannot reach ANY route, free ones included, and are not counted', async () => {
    const { deps, w } = world(); const u = { ...user, emailConfirmed: false };
    for (const r of [poll(), { method: 'GET', path: '/api/v1/models/x' }, { method: 'POST', path: '/api/v1/models/x/estimate-cost', body: {} }, submit()]) {
      expect((await handle(u, r, deps)).status).toBe(403);
    }
    expect(w.hits).toHaveLength(0); expect(w.estimates).toBe(0);
  });
});

describe('M3: customers never see muapi money, account state or raw upstream bodies', () => {
  const dirty = { status: 'completed', outputs: ['https://cdn.muapi.ai/a.mp4'], cost: 0.6, price_usd: 0.6, balance: 12.5, credits: 99, account: { balance: 9 }, billing: { amount: 3 }, api_key: 'sk-secret', raw: '<html>upstream</html>' };
  it('poll results keep only the fields the app uses', async () => {
    const { deps, w } = world(); await handle(user, submit(), deps); w.muapiResult = () => ({ status: 200, json: dirty });
    const body = JSON.stringify((await handle(user, poll(), deps)).body);
    expect(body).toContain('cdn.muapi.ai'); expect(body).not.toMatch(/0\.6|12\.5|balance|billing|sk-secret|upstream|price|"cost"/i);
  });
  it('model metadata is scrubbed of prices and balances', async () => {
    const { deps, w } = world(); w.muapiResult = () => ({ status: 200, json: { name: 'x', voices: ['a'], pricing: { usd: 1 }, cost: 2, nested: { balance: 5, ok: true } } });
    const r = await handle(user, { method: 'GET', path: '/api/v1/models/x' }, deps);
    expect(r.body).toEqual({ name: 'x', voices: ['a'], nested: { ok: true } });
  });
  it('a successful submit returns only the request id, status and our own credit numbers', async () => {
    const { deps, w } = world(); w.muapiSubmit = () => ({ status: 200, json: { request_id: 'req-1', status: 'processing', cost: 0.6, balance: 12, extra: 'x' } });
    const r = await handle(user, submit(), deps);
    expect(r.body).toEqual({ request_id: 'req-1', status: 'processing', credits: { charged: 150, balance: 850 } });
  });
  it('our own muapi account problems on poll and metadata read as a generic outage', async () => {
    const { deps, w } = world(); await handle(user, submit(), deps);
    for (const status of [401, 402, 403]) {
      w.muapiResult = () => ({ status, json: { detail: 'Insufficient balance on key sk-live-abc' } });
      for (const r of [poll(), { method: 'GET', path: '/api/v1/models/x' }]) {
        const out = await handle(user, r, deps);
        expect(out.status).toBe(503); expect(JSON.stringify(out.body)).not.toMatch(/balance|sk-live|402|401|403/i);
      }
    }
  });
  it('an upstream HTML error page is never echoed', async () => {
    const { deps, w } = world(); w.muapiSubmit = () => ({ status: 502, json: { raw: '<html>nginx bad gateway internal.host.example</html>' } });
    const out = await handle(user, submit(), deps);
    expect(JSON.stringify(out.body)).not.toMatch(/nginx|internal\.host|html/i);
  });
  it('validation messages for the customer still come through, scrubbed', async () => {
    const { deps, w } = world(); w.muapiSubmit = () => ({ status: 422, json: { detail: [{ msg: 'prompt too long', loc: ['body', 'prompt'] }], balance: 5 } });
    const out = await handle(user, submit(), deps);
    expect(out.status).toBe(422); expect(JSON.stringify(out.body)).toContain('prompt too long'); expect(JSON.stringify(out.body)).not.toContain('balance');
  });
});

describe('M4: only real lowercase model names reach muapi', () => {
  it.each([['POST', '/api/v1/.'], ['POST', '/api/v1/..'], ['POST', '/api/v1/Veo3.1-Fast-Text-To-Video'], ['POST', '/api/v1/-x'], ['POST', '/api/v1/models/./estimate-cost'], ['GET', '/api/v1/models/.'], ['POST', '/api/v1/models/X/estimate-cost'], ['POST', '/api/v1/ACCOUNT']] as const)('denies %s %s', (m, p) => {
    expect(classify(m, p).kind).toBe('denied');
  });
  it('still allows real slugs with dots, digits and dashes', () => {
    for (const s of ['veo3.1-fast-text-to-video', 'seedance-2.5-omni-reference', 'wan3.0-reference-to-video', 'minimax-speech-2.6-turbo', 'kling-v3.0-pro-text-to-video']) expect(classify('POST', `/api/v1/${s}`)).toEqual({ kind: 'submit', slug: s });
  });
});

describe('M6: a submit that cannot be recorded is retried, then refunded and logged for reconciliation', () => {
  it('survives one transient attach failure without refunding', async () => {
    const { deps, w } = world(); let fails = 1; const orig = deps.attach;
    const flaky: Deps = { ...deps, attach: async (...a) => { if (fails-- > 0) throw new Error('blip'); return orig(...a); } };
    const r = await handle(user, submit(), flaky);
    expect(r.status).toBe(200); expect(w.balance).toBe(850); expect(w.calls.size).toBe(1);
  });
  it('after three failures refunds and logs the request id so the operator can reconcile', async () => {
    const { deps, w } = world(); w.attachThrows = true;
    const r = await handle(user, submit(), deps);
    expect(r.status).toBe(500); expect(w.balance).toBe(1000);
    expect(w.logs.some(([e, d]) => e === 'attach_failed' && d.requestId === 'req-1')).toBe(true);
  });
  it('a timeout on submit refunds and logs "uncertain" (muapi may have accepted it)', async () => {
    const { deps, w } = world(); w.muapiThrows = true;
    await handle(user, submit(), deps);
    expect(w.balance).toBe(1000); expect(w.logs.some(([e]) => e === 'submit_uncertain')).toBe(true);
  });
});


// ================================================================ Phase 8: paid features are enforced on the server
describe('entitlements', () => {
  const lipsync = { method: 'POST', path: '/api/v1/omnihuman-2-0', body: { prompt: 'x' } } as const;
  const recast = { method: 'POST', path: '/api/v1/wan3.0-reference-to-video', body: { prompt: 'x' } } as const;
  const tts = { method: 'POST', path: '/api/v1/elevenlabs-tts-turbo-2-5', body: { prompt: 'hi' } } as const;
  it('refuses a locked model with 403 "locked" before quoting, reserving or calling muapi', async () => {
    const { deps, w } = world();
    const r = await handle(user, lipsync, deps);
    expect(r).toMatchObject({ status: 403, body: { code: 'locked', entitlement: 'pro_pack' } });
    expect(w.estimates).toBe(0); expect(w.submits).toBe(0); expect(w.holds.size).toBe(0); expect(w.balance).toBe(1000);
  });
  it('lets the right pack through, and charges as usual', async () => {
    const { deps, w } = world(); w.owned = ['pro_pack'];
    expect((await handle(user, lipsync, deps)).status).toBe(200); expect(w.submits).toBe(1);
  });
  it('a pack for something else does not unlock it', async () => {
    const { deps, w } = world(); w.owned = ['recast'];
    expect((await handle(user, lipsync, deps)).status).toBe(403); expect((await handle(user, recast, deps)).status).toBe(200); expect(w.submits).toBe(1);
  });
  it('shared models accept either pack (voices serve Cuts and the Recast voice stage)', async () => {
    for (const k of ['pro_pack', 'recast']) { const { deps, w } = world(); w.owned = [k]; expect((await handle(user, tts, deps)).status).toBe(200); }
    const { deps } = world(); expect((await handle(user, tts, deps)).status).toBe(403);
  });
  it('ordinary models stay open to anyone with credits', async () => {
    const { deps } = world(); expect((await handle(user, submit(), deps)).status).toBe(200);
  });
  it('a revoked entitlement locks again at once (no caching)', async () => {
    const { deps, w } = world(); w.owned = ['pro_pack']; expect((await handle(user, lipsync, deps)).status).toBe(200);
    w.owned = []; expect((await handle(user, lipsync, deps)).status).toBe(403);
  });
  it('the operator switch turns enforcement off (test accounts, a free promotion)', async () => {
    const { deps, w } = world(); w.enforce = false; expect((await handle(user, lipsync, deps)).status).toBe(200);
  });
  it('if the entitlement lookup fails the request is refused, never allowed through', async () => {
    const { deps, w } = world(); w.entitlementsThrows = true;
    const r = await handle(user, lipsync, deps);
    expect(r.status).toBe(503); expect(w.submits).toBe(0); expect(w.balance).toBe(1000);
  });
  it('quotes stay available for locked models so the app can show the price next to the lock', async () => {
    const { deps } = world(); const r = await handle(user, { method: 'POST', path: '/api/v1/models/omnihuman-2-0/estimate-cost', body: {} }, deps);
    expect(r.status).toBe(200);
  });
});


// ================================================================ Phase 10: content safety in the gateway
describe('content safety', () => {
  const bad = (prompt: string) => ({ method: 'POST', path: '/api/v1/veo3.1-fast-text-to-video', body: { prompt, duration: 8 } } as const);
  it('refuses a blocked prompt with 400 "blocked" before quoting, reserving or calling muapi, and says nothing was charged', async () => {
    const { deps, w } = world();
    const r = await handle(user, bad('a nude person on a train'), deps);
    expect(r).toMatchObject({ status: 400, body: { code: 'blocked', category: 'sexual' } }); expect(JSON.stringify(r.body)).toMatch(/not charged/);
    expect(w.estimates).toBe(0); expect(w.submits).toBe(0); expect(w.holds.size).toBe(0); expect(w.balance).toBe(1000);
  });
  it('lets the studio\'s own prompts through', async () => {
    const { deps, w } = world();
    expect((await handle(user, bad('Handheld vertical two-shot of two commuters. Both hold a flat yellow plastic card held up to the mouth like a microphone. There is no real microphone.'), deps)).status).toBe(200); expect(w.submits).toBe(1);
  });
  it('applies the operator\'s own blocked terms', async () => {
    const { deps, w } = world(); deps.blockedTerms = async () => ['jane roe'];
    expect((await handle(user, bad('a video of Jane Roe'), deps)).status).toBe(400); expect(w.submits).toBe(0);
  });
  it('if the operator list cannot be read the built-in screen still runs and generation is not blocked', async () => {
    const { deps, w } = world(); deps.blockedTerms = async () => { throw new Error('db'); };
    expect((await handle(user, bad('two friends on a train'), deps)).status).toBe(200);
    expect((await handle(user, bad('a nude person'), deps)).status).toBe(400); expect(w.submits).toBe(1);
  });
  it('a blocked attempt still counts against the rate limit', async () => {
    const { deps, w } = world(); await handle(user, bad('a nude person'), deps);
    expect(w.hits).toEqual(['submit']);
  });
  it('is logged for the operator without the customer\'s text', async () => {
    const { deps, w } = world(); await handle(user, bad('a nude person'), deps);
    const log = w.logs.find(([e]) => e === 'content_blocked'); expect(log).toBeTruthy(); expect(JSON.stringify(log)).not.toMatch(/nude person/);
  });
});
