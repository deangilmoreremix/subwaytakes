// Checkout and the Stripe webhook. Pure decision logic with injected dependencies (tested without Deno, Supabase or Stripe).
import { verifyStripeSignature } from './stripeSig.ts';

export interface Resp { status: number; body: unknown }
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const reply = (status: number, body: unknown): Resp => ({ status, body });

// ---------------------------------------------------------------- checkout

export interface CheckoutCaller { id: string; email: string | null; emailConfirmed: boolean; anonymous: boolean }
export interface CheckoutDeps {
  hit(userId: string): Promise<void>;                                   // throws Error('rate_limited')
  createPending(userId: string, productKey: string): Promise<{ orderId: string; amountCents: number; currency: string; productName: string }>;
  attach(orderId: string, sessionId: string): Promise<void>;
  createSession(a: { orderId: string; userId: string; email: string | null; amountCents: number; currency: string; productName: string }): Promise<{ id: string; url: string }>;
  log(event: string, data: Record<string, unknown>): void;
}

export async function checkoutHandle(caller: CheckoutCaller | null, body: unknown, deps: CheckoutDeps): Promise<Resp> {
  if (!caller) return reply(401, { error: 'Sign in.', code: 'unauthenticated' });
  if (caller.anonymous) return reply(403, { error: 'Create an account to buy.', code: 'account_required' });
  if (!caller.emailConfirmed) return reply(403, { error: 'Confirm your email address first, then try again.', code: 'verify_email' });
  const key = isObj(body) && typeof body.productKey === 'string' ? body.productKey : '';
  if (!/^[a-z0-9_]{2,40}$/.test(key)) return reply(400, { error: 'Unknown product.', code: 'unknown_product' });
  try { await deps.hit(caller.id); } catch { return reply(429, { error: 'Too many requests. Wait a moment.', code: 'rate_limited' }); }

  let order: Awaited<ReturnType<CheckoutDeps['createPending']>>;
  try { order = await deps.createPending(caller.id, key); } catch (e) {
    const m = e instanceof Error ? e.message : '';
    if (m.includes('unknown_product')) return reply(404, { error: 'That product is not available.', code: 'unknown_product' });
    if (m.includes('already_owned')) return reply(409, { error: 'You already own this.', code: 'already_owned' });
    if (m.includes('billing_blocked')) return reply(403, { error: 'Purchases are not available on this account. Contact support.', code: 'billing_blocked' });
    if (m.includes('too_many_pending')) return reply(429, { error: 'You have several unfinished checkouts. Finish one or wait an hour.', code: 'too_many_pending' });
    deps.log('checkout_order_failed', {});
    return reply(500, { error: 'Could not start checkout. Try again.', code: 'internal' });
  }
  let session: { id: string; url: string };
  try {
    session = await deps.createSession({ orderId: order.orderId, userId: caller.id, email: caller.email, amountCents: order.amountCents, currency: order.currency, productName: order.productName });
    await deps.attach(order.orderId, session.id);
  } catch {
    deps.log('checkout_session_failed', { orderId: order.orderId });
    return reply(502, { error: 'Could not reach the payment page. Try again.', code: 'payments_unavailable' });
  }
  return reply(200, { url: session.url });
}

// ---------------------------------------------------------------- webhook

export interface WebhookDeps {
  seen(eventId: string): Promise<boolean>;
  fulfil(sessionId: string, paymentIntent: string, amountCents: number, currency: string): Promise<string>;   // throws Error containing a code
  reverse(paymentIntent: string, status: 'refunded' | 'disputed', reason: string): Promise<string>;
  record(eventId: string, type: string, outcome: 'processed' | 'ignored' | 'needs_attention', detail?: string): Promise<void>;
  log(event: string, data: Record<string, unknown>): void;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** Returns 400 only for a bad signature or body; 500 for a transient failure (Stripe retries); 200 for everything we have dealt with. */
export async function webhookHandle(rawBody: string, signature: string | null, secret: string, nowSeconds: number, deps: WebhookDeps): Promise<Resp> {
  const sig = await verifyStripeSignature(rawBody, signature, secret, nowSeconds);
  if (!sig.ok) { deps.log('webhook_bad_signature', { reason: sig.reason }); return reply(400, { error: 'Bad signature.' }); }
  let event: unknown;
  try { event = JSON.parse(rawBody); } catch { return reply(400, { error: 'Bad body.' }); }
  if (!isObj(event) || typeof event.id !== 'string' || typeof event.type !== 'string' || !isObj(event.data) || !isObj(event.data.object)) return reply(400, { error: 'Bad event.' });
  const id = event.id, type = event.type, obj = event.data.object;

  try {
    if (await deps.seen(id)) return reply(200, { received: true, duplicate: true });

    if (type === 'checkout.session.completed' || type === 'checkout.session.async_payment_succeeded') {
      if (obj.payment_status !== 'paid') { await deps.record(id, type, 'ignored', 'not paid yet'); return reply(200, { received: true }); }
      const session = str(obj.id), pi = str(obj.payment_intent), currency = str(obj.currency);
      const amount = obj.amount_total;
      if (!session || !pi || !currency || typeof amount !== 'number' || !Number.isInteger(amount)) {
        deps.log('purchase_needs_attention', { eventId: id, reason: 'malformed session' });
        await deps.record(id, type, 'needs_attention', `malformed session ${session}`);
        return reply(200, { received: true });
      }
      try {
        const out = await deps.fulfil(session, pi, amount, currency);
        deps.log('purchase_fulfilled', { eventId: id, result: out });
        await deps.record(id, type, 'processed', out);
      } catch (e) {
        const m = e instanceof Error ? e.message : '';
        const code = m.includes('order_not_found') ? 'order_not_found' : m.includes('amount_mismatch') ? 'amount_mismatch' : '';
        if (!code) throw e;  // unknown failure: let Stripe retry
        // A customer paid but nothing was granted: needs a human. Acknowledge so Stripe stops retrying, and leave a loud record.
        deps.log('purchase_needs_attention', { eventId: id, reason: code, session });
        await deps.record(id, type, 'needs_attention', `${code} ${session}`);
      }
      return reply(200, { received: true });
    }

    if (type === 'charge.refunded') {
      const pi = str(obj.payment_intent);
      if (obj.refunded !== true) { // partial refund: not automated, flag for the operator
        deps.log('purchase_needs_attention', { eventId: id, reason: 'partial_refund' });
        await deps.record(id, type, 'needs_attention', `partial refund ${pi}`);
        return reply(200, { received: true });
      }
      const out = pi ? await deps.reverse(pi, 'refunded', 'refunded in Stripe') : 'unknown';
      await deps.record(id, type, out === 'unknown' ? 'ignored' : 'processed', out);
      return reply(200, { received: true });
    }

    if (type === 'charge.dispute.created') {
      const pi = str(obj.payment_intent);
      const out = pi ? await deps.reverse(pi, 'disputed', 'chargeback opened') : 'unknown';
      deps.log('dispute_opened', { eventId: id, result: out });
      await deps.record(id, type, out === 'unknown' ? 'ignored' : 'processed', out);
      return reply(200, { received: true });
    }

    return reply(200, { received: true, ignored: true });
  } catch {
    deps.log('webhook_failed', { eventId: id, type });
    return reply(500, { error: 'Try again.' });
  }
}
