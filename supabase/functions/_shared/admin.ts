// Operator actions on credits. Pure decision logic with injected dependencies (tested without Deno or Supabase).
export interface AdminCaller { id: string }
export interface AdminDeps {
  isAdmin(userId: string): Promise<boolean>;
  findUser(email: string): Promise<string | null>;
  balance(userId: string): Promise<number>;
  ledger(userId: string, limit: number): Promise<Array<Record<string, unknown>>>;
  apply(userId: string, delta: number, kind: 'grant' | 'adjust', reason: string, ref: string, actor: string): Promise<number>;
  stats(): Promise<unknown>;
  getSettings(): Promise<Record<string, unknown>>;
  setSettings(patch: Record<string, unknown>): Promise<void>;
  setModel(slug: string, patch: { enabled?: boolean; margin?: number | null; minCredits?: number }): Promise<void>;
  billingStats(): Promise<unknown>;
  listProducts(): Promise<Array<Record<string, unknown>>>;
  setProduct(key: string, patch: Record<string, unknown>): Promise<void>;
  listOrders(userId: string, limit: number): Promise<Array<Record<string, unknown>>>;
  listEntitlements(userId: string): Promise<string[]>;
  setEntitlement(userId: string, key: string, on: boolean): Promise<void>;
  /** The Stripe payment behind a paid order, or null when the order is unknown or not paid. */
  paidOrderPayment(orderId: string): Promise<{ paymentIntent: string; userId: string } | null>;
  stripeRefund(paymentIntent: string): Promise<void>;
  /** Permanent record of an operator action that changes money or unlocks (who, what). */
  audit(actorId: string, action: string, detail: Record<string, unknown>): Promise<void>;
  retentionStats(): Promise<unknown>;
  getReferralSettings(): Promise<Record<string, unknown>>;
  setReferralSettings(patch: Record<string, unknown>): Promise<void>;
  /** Stops a still-unrewarded referral from ever paying out. Returns false when there was nothing to void. */
  voidReferral(refereeId: string): Promise<boolean>;
  newRef(): string;
  log(event: string, data: Record<string, unknown>): void;
}
export interface AdminResponse { status: number; body: unknown }

const MAX_AMOUNT = 100_000;
const bad = (error: string): AdminResponse => ({ status: 400, body: { error } });
const isInt = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

export async function adminHandle(caller: AdminCaller | null, req: unknown, deps: AdminDeps): Promise<AdminResponse> {
  if (!caller) return { status: 401, body: { error: 'Sign in.' } };
  if (!(await deps.isAdmin(caller.id))) return { status: 403, body: { error: 'Not an admin.' } };
  if (!isObj(req) || typeof req.action !== 'string') return bad('Missing action.');

  switch (req.action) {
    case 'whoami': return { status: 200, body: { admin: true } };
    case 'stats': return { status: 200, body: await deps.stats() };
    case 'settings': return { status: 200, body: await deps.getSettings() };
    case 'lookup': {
      const email = String(req.email ?? '').trim();
      const id = email ? await deps.findUser(email) : null;
      if (!id) return { status: 404, body: { error: 'No user with that email.' } };
      return { status: 200, body: { userId: id, balance: await deps.balance(id), ledger: await deps.ledger(id, 25) } };
    }
    case 'grant':
    case 'adjust': {
      const email = String(req.email ?? '').trim();
      const reason = String(req.reason ?? '').trim();
      if (!email) return bad('Email is required.');
      if (!reason) return bad('A reason is required.');
      if (req.action === 'grant' ? !isInt(req.amount, 1, MAX_AMOUNT) : !(isInt(req.amount, -MAX_AMOUNT, MAX_AMOUNT) && req.amount !== 0)) {
        return bad(req.action === 'grant' ? `Amount must be a whole number from 1 to ${MAX_AMOUNT}.` : `Amount must be a non-zero whole number up to ${MAX_AMOUNT} either way.`);
      }
      const id = await deps.findUser(email);
      if (!id) return { status: 404, body: { error: 'No user with that email.' } };
      const ref = typeof req.ref === 'string' && req.ref.trim() ? `admin:${req.ref.trim().slice(0, 80)}` : `admin:${deps.newRef()}`;
      try {
        const balance = await deps.apply(id, req.amount as number, req.action, reason.slice(0, 200), ref, caller.id);
        deps.log('admin_credit', { action: req.action, userId: id, amount: req.amount, by: caller.id });
        return { status: 200, body: { balance } };
      } catch (e) {
        const m = e instanceof Error ? e.message : '';
        if (m.includes('would_go_negative')) return bad('That adjustment would take the balance below zero.');
        if (m.includes('ref_conflict')) return bad('That reference was already used for a different credit change. Use a new reference.');
        throw e;
      }
    }
    case 'set_settings': {
      const p = isObj(req.patch) ? req.patch : {};
      const out: Record<string, unknown> = {};
      if ('margin' in p) { if (typeof p.margin !== 'number' || p.margin < 1 || p.margin > 20) return bad('Margin must be between 1 and 20.'); out.margin = p.margin; }
      if ('maxCreditsPerCall' in p) { if (!isInt(p.maxCreditsPerCall, 1, 100_000)) return bad('Per-call cap must be a whole number.'); out.max_credits_per_call = p.maxCreditsPerCall; }
      if ('maxCallsPerMinute' in p) { if (!isInt(p.maxCallsPerMinute, 1, 1000)) return bad('Calls per minute must be a whole number.'); out.max_calls_per_minute = p.maxCallsPerMinute; }
      if ('maxOpenHolds' in p) { if (!isInt(p.maxOpenHolds, 1, 200)) return bad('Open holds must be a whole number.'); out.max_open_holds = p.maxOpenHolds; }
      if ('dailyCreditCap' in p) { if (!isInt(p.dailyCreditCap, 1, 1_000_000)) return bad('Daily cap must be a whole number.'); out.daily_credit_cap = p.dailyCreditCap; }
      if ('enforceEntitlements' in p) { if (typeof p.enforceEntitlements !== 'boolean') return bad('enforceEntitlements must be true or false.'); out.enforce_entitlements = p.enforceEntitlements; }
      if ('killSwitch' in p) { if (typeof p.killSwitch !== 'boolean') return bad('Kill switch must be true or false.'); out.kill_switch = p.killSwitch; }
      if (!Object.keys(out).length) return bad('Nothing to change.');
      await deps.setSettings(out);
      deps.log('admin_settings', { keys: Object.keys(out), by: caller.id });
      return { status: 200, body: await deps.getSettings() };
    }
    case 'billing': return { status: 200, body: { stats: await deps.billingStats(), products: await deps.listProducts() } };
    case 'orders': {
      const email = String(req.email ?? '').trim();
      const id = email ? await deps.findUser(email) : null;
      if (!id) return { status: 404, body: { error: 'No user with that email.' } };
      return { status: 200, body: { orders: await deps.listOrders(id, 25), entitlements: await deps.listEntitlements(id) } };
    }
    case 'set_product': {
      const key = String(req.key ?? '');
      if (!/^[a-z0-9_]{2,40}$/.test(key)) return bad('Bad product key.');
      const p = isObj(req.patch) ? req.patch : {};
      const out: Record<string, unknown> = {};
      if ('name' in p) { if (typeof p.name !== 'string' || !p.name.trim() || p.name.length > 80) return bad('Name is required (80 characters max).'); out.name = p.name.trim(); }
      if ('description' in p) { if (typeof p.description !== 'string' || p.description.length > 300) return bad('Description is 300 characters max.'); out.description = p.description; }
      if ('priceCents' in p) { if (!isInt(p.priceCents, 50, 1_000_000)) return bad('Price must be between 50 and 1000000 cents.'); out.price_cents = p.priceCents; }
      if ('credits' in p) { if (!isInt(p.credits, 0, 1_000_000)) return bad('Credits must be a whole number from 0 to 1000000.'); out.credits = p.credits; }
      if ('active' in p) { if (typeof p.active !== 'boolean') return bad('active must be true or false.'); out.active = p.active; }
      if ('sort' in p) { if (!isInt(p.sort, 0, 10_000)) return bad('Sort must be a whole number.'); out.sort = p.sort; }
      if ('entitlements' in p) {
        if (!Array.isArray(p.entitlements) || p.entitlements.length > 10 || !p.entitlements.every(k => typeof k === 'string' && /^[a-z0-9_]{2,40}$/.test(k))) return bad('Entitlements must be a short list of keys like pro_pack.');
        out.entitlements = p.entitlements;
      }
      if (!Object.keys(out).length) return bad('Nothing to change.');
      try { await deps.setProduct(key, out); } catch (e) {
        const m = e instanceof Error ? e.message : '';
        if (m.includes('not_found')) return { status: 404, body: { error: 'No such product.' } };
        if (m.includes('check')) return bad('A product must give credits or an unlock, and the numbers must be in range.');
        throw e;
      }
      await deps.audit(caller.id, 'set_product', { key, patch: out });
      deps.log('admin_product', { key, keys: Object.keys(out), by: caller.id });
      return { status: 200, body: { products: await deps.listProducts() } };
    }
    case 'set_entitlement': {
      const email = String(req.email ?? '').trim();
      const key = String(req.key ?? '');
      if (!email) return bad('Email is required.');
      if (!/^[a-z0-9_]{2,40}$/.test(key)) return bad('Bad entitlement key.');
      if (typeof req.on !== 'boolean') return bad('on must be true or false.');
      const id = await deps.findUser(email);
      if (!id) return { status: 404, body: { error: 'No user with that email.' } };
      await deps.setEntitlement(id, key, req.on);
      await deps.audit(caller.id, 'set_entitlement', { userId: id, key, on: req.on });
      deps.log('admin_entitlement', { userId: id, key, on: req.on, by: caller.id });
      return { status: 200, body: { entitlements: await deps.listEntitlements(id) } };
    }
    case 'refund': {
      const orderId = String(req.orderId ?? '');
      if (!/^[0-9a-f-]{36}$/.test(orderId)) return bad('Bad order id.');
      const pay = await deps.paidOrderPayment(orderId);
      if (!pay) return { status: 404, body: { error: 'That order is not a paid order.' } };
      try { await deps.stripeRefund(pay.paymentIntent); } catch { return { status: 502, body: { error: 'Stripe did not accept the refund. Check the Stripe dashboard.' } }; }
      await deps.audit(caller.id, 'refund', { orderId, userId: pay.userId });
      deps.log('admin_refund', { orderId, userId: pay.userId, by: caller.id });
      // The credits and unlocks are taken back when Stripe's refund webhook arrives, not here, so there is one path and one record.
      return { status: 200, body: { ok: true, note: 'Refund sent. Credits and unlocks are removed when Stripe confirms it.' } };
    }
    case 'retention': return { status: 200, body: { stats: await deps.retentionStats(), referral: await deps.getReferralSettings() } };
    case 'set_referral': {
      const p = isObj(req.patch) ? req.patch : {};
      const out: Record<string, unknown> = {};
      if ('enabled' in p) { if (typeof p.enabled !== 'boolean') return bad('enabled must be true or false.'); out.enabled = p.enabled; }
      if ('referrerReward' in p) { if (!isInt(p.referrerReward, 0, 100_000)) return bad('Referrer reward must be a whole number of credits (0 to 100000).'); out.referrer_reward = p.referrerReward; }
      if ('refereeReward' in p) { if (!isInt(p.refereeReward, 0, 100_000)) return bad('Friend reward must be a whole number of credits (0 to 100000).'); out.referee_reward = p.refereeReward; }
      if ('minOrderCents' in p) { if (!isInt(p.minOrderCents, 100, 1_000_000)) return bad('Minimum order must be at least 100 cents.'); out.min_order_cents = p.minOrderCents; }
      if ('maxRewardsPerReferrer' in p) { if (!isInt(p.maxRewardsPerReferrer, 0, 1000)) return bad('Reward cap must be a whole number from 0 to 1000.'); out.max_rewards_per_referrer = p.maxRewardsPerReferrer; }
      if (!Object.keys(out).length) return bad('Nothing to change.');
      await deps.setReferralSettings(out);
      await deps.audit(caller.id, 'set_referral', { patch: out });
      return { status: 200, body: { referral: await deps.getReferralSettings() } };
    }
    case 'void_referral': {
      const email = String(req.email ?? '').trim();
      if (!email) return bad('Email is required.');
      const id = await deps.findUser(email);
      if (!id) return { status: 404, body: { error: 'No user with that email.' } };
      const done = await deps.voidReferral(id);
      if (!done) return { status: 404, body: { error: 'That customer has no pending referral.' } };
      await deps.audit(caller.id, 'void_referral', { userId: id });
      return { status: 200, body: { ok: true } };
    }
    case 'set_model': {
      const slug = String(req.slug ?? '');
      if (!/^[\w.-]{1,100}$/.test(slug)) return bad('Bad model name.');
      const patch: { enabled?: boolean; margin?: number | null; minCredits?: number } = {};
      if ('enabled' in req) { if (typeof req.enabled !== 'boolean') return bad('enabled must be true or false.'); patch.enabled = req.enabled; }
      if ('margin' in req) { if (req.margin !== null && (typeof req.margin !== 'number' || req.margin < 1 || req.margin > 20)) return bad('Margin must be between 1 and 20, or null.'); patch.margin = req.margin as number | null; }
      if ('minCredits' in req) { if (!isInt(req.minCredits, 1, 10_000)) return bad('Minimum credits must be a whole number.'); patch.minCredits = req.minCredits; }
      if (!Object.keys(patch).length) return bad('Nothing to change.');
      await deps.setModel(slug, patch);
      deps.log('admin_model', { slug, by: caller.id });
      return { status: 200, body: { ok: true } };
    }
    default: return bad('Unknown action.');
  }
}
