import { describe, expect, it } from 'vitest';
import { checkoutHandle, webhookHandle, type CheckoutCaller, type CheckoutDeps, type WebhookDeps } from './billing';
import { hmacHex, verifyStripeSignature } from './stripeSig';
import { createCheckoutSession, refundPayment, type Fetcher } from './stripe';

const SECRET = 'whsec_test';
const NOW = 1_800_000_000;
async function sign(body: string, t = NOW, secret = SECRET) { return `t=${t},v1=${await hmacHex(secret, `${t}.${body}`)}`; }

describe('stripe signature', () => {
  it('accepts a correct signature', async () => {
    const b = '{"a":1}'; expect(await verifyStripeSignature(b, await sign(b), SECRET, NOW)).toEqual({ ok: true });
  });
  it('rejects a tampered body, wrong secret, stale timestamp, malformed and missing headers', async () => {
    const b = '{"a":1}';
    expect(await verifyStripeSignature('{"a":2}', await sign(b), SECRET, NOW)).toMatchObject({ ok: false, reason: 'mismatch' });
    expect(await verifyStripeSignature(b, await sign(b, NOW, 'other'), SECRET, NOW)).toMatchObject({ ok: false, reason: 'mismatch' });
    expect(await verifyStripeSignature(b, await sign(b, NOW - 301), SECRET, NOW)).toMatchObject({ ok: false, reason: 'stale' });
    expect(await verifyStripeSignature(b, await sign(b, NOW + 301), SECRET, NOW)).toMatchObject({ ok: false, reason: 'stale' });
    expect(await verifyStripeSignature(b, 'garbage', SECRET, NOW)).toMatchObject({ ok: false, reason: 'malformed' });
    expect(await verifyStripeSignature(b, null, SECRET, NOW)).toMatchObject({ ok: false, reason: 'missing' });
    expect(await verifyStripeSignature(b, await sign(b), '', NOW)).toMatchObject({ ok: false, reason: 'missing' });
  });
  it('accepts when any of several v1 signatures matches (secret rotation)', async () => {
    const b = 'x'; const good = await hmacHex(SECRET, `${NOW}.${b}`);
    expect((await verifyStripeSignature(b, `t=${NOW},v1=deadbeef,v1=${good}`, SECRET, NOW)).ok).toBe(true);
  });
});

// ---------------------------------------------------------------- webhook
function hookWorld(opts: { fulfil?: (...a: unknown[]) => Promise<string>; reverse?: () => Promise<string> } = {}) {
  const w = { fulfils: [] as unknown[][], reverses: [] as unknown[][], records: [] as unknown[][], logs: [] as string[], seenIds: new Set<string>() };
  const deps: WebhookDeps = {
    seen: async id => w.seenIds.has(id),
    fulfil: async (...a) => { w.fulfils.push(a); return opts.fulfil ? opts.fulfil(...a) : 'fulfilled'; },
    reverse: async (...a) => { w.reverses.push(a); return opts.reverse ? opts.reverse() : 'reversed'; },
    record: async (...a) => { w.records.push(a); },
    log: e => { w.logs.push(e); },
  };
  return { deps, w };
}
const evt = (type: string, object: Record<string, unknown>, id = 'evt_1') => JSON.stringify({ id, type, data: { object } });
const paid = { id: 'cs_1', payment_status: 'paid', payment_intent: 'pi_1', amount_total: 3700, currency: 'usd' };
async function send(body: string, deps: WebhookDeps, sig?: string | null) { return webhookHandle(body, sig === undefined ? await sign(body) : sig, SECRET, NOW, deps); }

describe('webhook: signature first', () => {
  it('refuses bad signatures with 400 and touches nothing', async () => {
    const { deps, w } = hookWorld(); const body = evt('checkout.session.completed', paid);
    for (const sig of [null, 'junk', await sign(body, NOW, 'attacker')]) expect((await send(body, deps, sig)).status).toBe(400);
    expect(w.fulfils.length + w.records.length).toBe(0);
  });
  it('refuses a validly signed body that is not an event', async () => {
    const { deps } = hookWorld(); expect((await send('{"hello":1}', deps)).status).toBe(400); expect((await send('not json', deps)).status).toBe(400);
  });
});

describe('webhook: purchases', () => {
  it('fulfils a paid session with the amounts Stripe reports', async () => {
    const { deps, w } = hookWorld(); const r = await send(evt('checkout.session.completed', paid), deps);
    expect(r.status).toBe(200); expect(w.fulfils).toEqual([['cs_1', 'pi_1', 3700, 'usd']]); expect(w.records[0].slice(0, 3)).toEqual(['evt_1', 'checkout.session.completed', 'processed']);
  });
  it('ignores a session that is not paid yet (async methods) and does not grant', async () => {
    const { deps, w } = hookWorld(); await send(evt('checkout.session.completed', { ...paid, payment_status: 'unpaid' }), deps);
    expect(w.fulfils).toHaveLength(0); expect(w.records[0][2]).toBe('ignored');
  });
  it('fulfils when an async payment later succeeds', async () => {
    const { deps, w } = hookWorld(); await send(evt('checkout.session.async_payment_succeeded', paid), deps); expect(w.fulfils).toHaveLength(1);
  });
  it('a refund that arrives before the purchase is fulfilled is remembered (the database refuses to grant later) and still recorded', async () => {
    const { deps, w } = hookWorld({ reverse: async () => 'unknown' });
    expect((await send(evt('charge.dispute.created', { payment_intent: 'pi_early' }), deps)).status).toBe(200);
    expect(w.reverses).toEqual([['pi_early', 'disputed', 'chargeback opened']]);
  });
  it('a duplicate event id is acknowledged and does nothing', async () => {
    const { deps, w } = hookWorld(); w.seenIds.add('evt_1');
    const r = await send(evt('checkout.session.completed', paid), deps);
    expect(r).toMatchObject({ status: 200, body: { duplicate: true } }); expect(w.fulfils).toHaveLength(0);
  });
  it('an amount or order mismatch is acknowledged (so Stripe stops retrying) but recorded as needing a human', async () => {
    for (const code of ['amount_mismatch', 'order_not_found']) {
      const { deps, w } = hookWorld({ fulfil: async () => { throw new Error(code); } });
      const r = await send(evt('checkout.session.completed', paid), deps);
      expect(r.status).toBe(200); expect(w.records[0][2]).toBe('needs_attention'); expect(w.logs).toContain('purchase_needs_attention');
    }
  });
  it('an unexpected failure returns 500 so Stripe retries, and records nothing', async () => {
    const { deps, w } = hookWorld({ fulfil: async () => { throw new Error('connection lost'); } });
    expect((await send(evt('checkout.session.completed', paid), deps)).status).toBe(500); expect(w.records).toHaveLength(0);
  });
  it('a malformed session is flagged, never granted', async () => {
    for (const bad of [{ ...paid, amount_total: '3700' }, { ...paid, payment_intent: null }, { ...paid, amount_total: 37.5 }, { ...paid, currency: '' }]) {
      const { deps, w } = hookWorld(); await send(evt('checkout.session.completed', bad), deps);
      expect(w.fulfils).toHaveLength(0); expect(w.records[0][2]).toBe('needs_attention');
    }
  });
});

describe('webhook: refunds and disputes', () => {
  it('a full refund reverses the order', async () => {
    const { deps, w } = hookWorld(); await send(evt('charge.refunded', { payment_intent: 'pi_1', refunded: true }), deps);
    expect(w.reverses).toEqual([['pi_1', 'refunded', 'refunded in Stripe']]);
  });
  it('a partial refund is not automated: flagged for the operator, nothing reversed', async () => {
    const { deps, w } = hookWorld(); await send(evt('charge.refunded', { payment_intent: 'pi_1', refunded: false }), deps);
    expect(w.reverses).toHaveLength(0); expect(w.records[0][2]).toBe('needs_attention');
  });
  it('a dispute reverses the order', async () => {
    const { deps, w } = hookWorld(); await send(evt('charge.dispute.created', { payment_intent: 'pi_1' }), deps);
    expect(w.reverses).toEqual([['pi_1', 'disputed', 'chargeback opened']]);
  });
  it('a payment that is not one of our orders is ignored quietly', async () => {
    const { deps, w } = hookWorld({ reverse: async () => 'unknown' }); await send(evt('charge.refunded', { payment_intent: 'pi_x', refunded: true }), deps);
    expect(w.records[0][2]).toBe('ignored');
  });
  it('other event types are acknowledged and ignored', async () => {
    const { deps, w } = hookWorld(); const r = await send(evt('customer.created', {}), deps);
    expect(r.status).toBe(200); expect(w.fulfils.length + w.reverses.length).toBe(0);
  });
});

// ---------------------------------------------------------------- checkout
const user: CheckoutCaller = { id: 'u1', email: 'buyer@example.com', emailConfirmed: true, anonymous: false };
function coWorld(over: Partial<CheckoutDeps> = {}) {
  const w = { pending: [] as unknown[][], sessions: [] as Array<Record<string, unknown>>, attached: [] as unknown[][], hits: 0 };
  const deps: CheckoutDeps = {
    hit: async () => { w.hits++; },
    createPending: async (u, k) => { w.pending.push([u, k]); return { orderId: 'ord-1', amountCents: 3700, currency: 'usd', productName: 'Studio Starter' }; },
    attach: async (o, s) => { w.attached.push([o, s]); },
    createSession: async a => { w.sessions.push(a); return { id: 'cs_1', url: 'https://checkout.stripe.com/c/cs_1' }; },
    log: () => {},
    ...over,
  };
  return { deps, w };
}
describe('checkout', () => {
  it('creates a session priced by the SERVER order, whatever the browser sends', async () => {
    const { deps, w } = coWorld();
    const r = await checkoutHandle(user, { productKey: 'starter', price: 1, amount: 1, credits: 999999 }, deps);
    expect(r).toEqual({ status: 200, body: { url: 'https://checkout.stripe.com/c/cs_1' } });
    expect(w.pending).toEqual([['u1', 'starter']]); expect(w.sessions[0]).toMatchObject({ amountCents: 3700, orderId: 'ord-1', userId: 'u1' }); expect(w.attached).toEqual([['ord-1', 'cs_1']]);
  });
  it('refuses signed-out, guest and unconfirmed users before creating anything', async () => {
    const { deps, w } = coWorld();
    expect((await checkoutHandle(null, { productKey: 'starter' }, deps)).status).toBe(401);
    expect((await checkoutHandle({ ...user, anonymous: true }, { productKey: 'starter' }, deps)).status).toBe(403);
    expect((await checkoutHandle({ ...user, emailConfirmed: false }, { productKey: 'starter' }, deps)).status).toBe(403);
    expect(w.pending).toHaveLength(0);
  });
  it('rejects malformed product keys', async () => {
    const { deps, w } = coWorld();
    for (const b of [{}, null, { productKey: 5 }, { productKey: '../x' }, { productKey: 'A' }, { productKey: '' }]) expect((await checkoutHandle(user, b, deps)).status).toBe(400);
    expect(w.pending).toHaveLength(0);
  });
  it.each([['unknown_product', 404], ['billing_blocked', 403], ['already_owned', 409], ['too_many_pending', 429], ['boom', 500]])('maps %s to %i', async (code, status) => {
    const { deps } = coWorld({ createPending: async () => { throw new Error(code); } });
    expect((await checkoutHandle(user, { productKey: 'starter' }, deps)).status).toBe(status);
  });
  it('is rate limited', async () => {
    const { deps, w } = coWorld({ hit: async () => { throw new Error('rate_limited'); } });
    expect((await checkoutHandle(user, { productKey: 'starter' }, deps)).status).toBe(429); expect(w.pending).toHaveLength(0);
  });
  it('a Stripe outage is a clear 502 and leaks nothing', async () => {
    const { deps } = coWorld({ createSession: async () => { throw new Error('stripe_session_401 sk_live_secret'); } });
    const r = await checkoutHandle(user, { productKey: 'starter' }, deps);
    expect(r.status).toBe(502); expect(JSON.stringify(r.body)).not.toMatch(/sk_live|401/);
  });
});

// ---------------------------------------------------------------- stripe REST
describe('stripe calls', () => {
  const fakeFetch = (status: number, json: unknown, seen: Array<{ url: string; init: { method: string; headers: Record<string, string>; body: string } }> = []): Fetcher =>
    async (url, init) => { seen.push({ url, init }); return { status, json: async () => json }; };
  it('creates a one-time payment session with an inline price and the order in metadata', async () => {
    const seen: Array<{ url: string; init: { method: string; headers: Record<string, string>; body: string } }> = [];
    const s = await createCheckoutSession(fakeFetch(200, { id: 'cs_9', url: 'https://checkout.stripe.com/x' }, seen), 'sk_test', 'https://app.example', { orderId: 'o1', userId: 'u1', email: 'b@example.com', amountCents: 3700, currency: 'usd', productName: 'Studio Starter' });
    expect(s).toEqual({ id: 'cs_9', url: 'https://checkout.stripe.com/x' });
    const p = new URLSearchParams(seen[0].init.body);
    expect(seen[0].init.headers.Authorization).toBe('Bearer sk_test');
    expect(p.get('mode')).toBe('payment'); expect(p.get('line_items[0][price_data][unit_amount]')).toBe('3700'); expect(p.get('metadata[order_id]')).toBe('o1');
    expect(p.get('success_url')).toBe('https://app.example/billing/success?order=o1'); expect(p.get('client_reference_id')).toBe('u1'); expect(p.get('customer_email')).toBe('b@example.com');
  });
  it('fails on a bad Stripe answer, including a non-https url', async () => {
    const a = { orderId: 'o', userId: 'u', email: null, amountCents: 100, currency: 'usd', productName: 'x' };
    await expect(createCheckoutSession(fakeFetch(400, { error: 'x' }), 'k', 'https://a', a)).rejects.toThrow();
    await expect(createCheckoutSession(fakeFetch(200, { id: 'cs', url: 'http://evil.example' }), 'k', 'https://a', a)).rejects.toThrow();
    await expect(createCheckoutSession(fakeFetch(200, {}), 'k', 'https://a', a)).rejects.toThrow();
  });
  it('refunds a payment intent', async () => {
    const seen: Array<{ url: string; init: { method: string; headers: Record<string, string>; body: string } }> = [];
    await refundPayment(fakeFetch(200, {}, seen), 'sk', 'pi_1'); expect(seen[0].url).toBe('https://api.stripe.com/v1/refunds'); expect(seen[0].init.body).toBe('payment_intent=pi_1');
    await expect(refundPayment(fakeFetch(402, {}), 'sk', 'pi_1')).rejects.toThrow();
  });
});
