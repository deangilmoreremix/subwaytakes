import { describe, expect, it } from 'vitest';
import { adminHandle, type AdminDeps } from './admin.ts';

const ORDER = '11111111-1111-1111-1111-111111111111';
function setup(isAdmin = true) {
  const calls: Array<[string, unknown[]]> = []; const logs: unknown[] = [];
  const deps: AdminDeps = {
    isAdmin: async () => isAdmin,
    findUser: async email => (email.toLowerCase() === 'maya@example.com' ? 'u-maya' : null),
    balance: async () => 120,
    ledger: async () => [{ id: 1, delta: 120, kind: 'grant' }],
    apply: async (...a) => { calls.push(['apply', a]); if (a[1] === -999) throw new Error('would_go_negative'); if (a[4] === 'admin:dup') throw new Error('ref_conflict'); return 220; },
    stats: async () => ({ credits_granted: 1 }),
    getSettings: async () => ({ margin: 2.5 }),
    setSettings: async p => { calls.push(['setSettings', [p]]); },
    setModel: async (s, p) => { calls.push(['setModel', [s, p]]); },
    billingStats: async () => ({ paid_cents: 3700 }),
    listProducts: async () => [{ key: 'starter' }],
    setProduct: async (k, p) => { calls.push(['setProduct', [k, p]]); if (k === 'ghost') throw new Error('not_found'); if (p.credits === 0) throw new Error('check'); },
    listOrders: async () => [{ id: 'o1' }],
    listEntitlements: async () => ['pro_pack'],
    setEntitlement: async (...a) => { calls.push(['setEntitlement', a]); },
    paidOrderPayment: async id => (id === ORDER ? { paymentIntent: 'pi_1', userId: 'u-maya' } : null),
    stripeRefund: async pi => { calls.push(['refund', [pi]]); if (pi === 'pi_fail') throw new Error('x'); },
    audit: async (...a) => { calls.push(['audit', a]); },
    newRef: () => 'ref-1',
    log: (e, d) => { logs.push([e, d]); },
  };
  return { deps, calls, logs };
}
const admin = { id: 'a1' };

describe('admin access', () => {
  it('refuses signed-out callers and non-admins before doing anything', async () => {
    const { deps, calls } = setup(false);
    expect((await adminHandle(null, { action: 'stats' }, deps)).status).toBe(401);
    expect((await adminHandle(admin, { action: 'grant', email: 'maya@example.com', amount: 5, reason: 'x' }, deps)).status).toBe(403);
    expect(calls).toHaveLength(0);
  });
  it('rejects a missing or unknown action', async () => {
    const { deps } = setup();
    expect((await adminHandle(admin, {}, deps)).status).toBe(400);
    expect((await adminHandle(admin, { action: 'drop_tables' }, deps)).status).toBe(400);
    expect((await adminHandle(admin, 'x', deps)).status).toBe(400);
  });
});

describe('whoami', () => {
  it('confirms admins and refuses everyone else', async () => {
    expect(await adminHandle(admin, { action: 'whoami' }, setup().deps)).toEqual({ status: 200, body: { admin: true } });
    expect((await adminHandle(admin, { action: 'whoami' }, setup(false).deps)).status).toBe(403);
  });
});

describe('granting and adjusting', () => {
  it('grants credits with a reason and logs who did it', async () => {
    const { deps, calls, logs } = setup();
    const r = await adminHandle(admin, { action: 'grant', email: ' Maya@Example.com ', amount: 100, reason: 'early customer', ref: 'order-7' }, deps);
    expect(r).toEqual({ status: 200, body: { balance: 220 } });
    expect(calls[0]).toEqual(['apply', ['u-maya', 100, 'grant', 'early customer', 'admin:order-7', 'a1']]);
    expect(JSON.stringify(logs)).toContain('admin_credit');
  });
  it('generates a ref when none is given (so each form submission is its own grant)', async () => {
    const { deps, calls } = setup();
    await adminHandle(admin, { action: 'grant', email: 'maya@example.com', amount: 5, reason: 'x' }, deps);
    expect((calls[0][1] as unknown[])[4]).toBe('admin:ref-1');
  });
  it.each([[0], [-5], [1.5], [100001], ['10'], [NaN]])('rejects a grant of %s', async amount => {
    const { deps, calls } = setup();
    expect((await adminHandle(admin, { action: 'grant', email: 'maya@example.com', amount, reason: 'x' }, deps)).status).toBe(400); expect(calls).toHaveLength(0);
  });
  it('requires an email and a reason, and a real user', async () => {
    const { deps } = setup();
    expect((await adminHandle(admin, { action: 'grant', amount: 5, reason: 'x' }, deps)).status).toBe(400);
    expect((await adminHandle(admin, { action: 'grant', email: 'maya@example.com', amount: 5, reason: '  ' }, deps)).status).toBe(400);
    expect((await adminHandle(admin, { action: 'grant', email: 'ghost@example.com', amount: 5, reason: 'x' }, deps)).status).toBe(404);
  });
  it('adjusts down, and explains when it would go below zero', async () => {
    const { deps } = setup();
    expect((await adminHandle(admin, { action: 'adjust', email: 'maya@example.com', amount: -50, reason: 'refund reversal' }, deps)).status).toBe(200);
    expect(await adminHandle(admin, { action: 'adjust', email: 'maya@example.com', amount: -999, reason: 'x' }, deps)).toMatchObject({ status: 400, body: { error: expect.stringContaining('below zero') } });
    expect((await adminHandle(admin, { action: 'adjust', email: 'maya@example.com', amount: 0, reason: 'x' }, deps)).status).toBe(400);
  });
});

describe('lookup, stats and settings', () => {
  it('looks a user up with balance and ledger', async () => {
    const { deps } = setup();
    expect(await adminHandle(admin, { action: 'lookup', email: 'maya@example.com' }, deps)).toMatchObject({ status: 200, body: { userId: 'u-maya', balance: 120 } });
    expect((await adminHandle(admin, { action: 'lookup', email: 'nobody@example.com' }, deps)).status).toBe(404);
  });
  it('validates settings changes and applies only the given fields', async () => {
    const { deps, calls } = setup();
    await adminHandle(admin, { action: 'set_settings', patch: { margin: 3, killSwitch: true } }, deps);
    expect(calls[0]).toEqual(['setSettings', [{ margin: 3, kill_switch: true }]]);
    for (const patch of [{ margin: 0.5 }, { margin: 50 }, { maxCreditsPerCall: 0 }, { killSwitch: 'yes' }, {}]) {
      expect((await adminHandle(admin, { action: 'set_settings', patch }, deps)).status, JSON.stringify(patch)).toBe(400);
    }
  });
  it('turns a model off and reprices it', async () => {
    const { deps, calls } = setup();
    await adminHandle(admin, { action: 'set_model', slug: 'veo3.1-text-to-video', enabled: false, margin: 4 }, deps);
    expect(calls[0]).toEqual(['setModel', ['veo3.1-text-to-video', { enabled: false, margin: 4 }]]);
    expect((await adminHandle(admin, { action: 'set_model', slug: '../x', enabled: true }, deps)).status).toBe(400);
    expect((await adminHandle(admin, { action: 'set_model', slug: 'ok' }, deps)).status).toBe(400);
  });
});


describe('billing admin actions', () => {
  it('shows stats and products', async () => {
    const { deps } = setup(); expect(await adminHandle(admin, { action: 'billing' }, deps)).toMatchObject({ status: 200, body: { stats: { paid_cents: 3700 }, products: [{ key: 'starter' }] } });
  });
  it('lists a user\'s orders and entitlements', async () => {
    const { deps } = setup();
    expect(await adminHandle(admin, { action: 'orders', email: 'maya@example.com' }, deps)).toMatchObject({ status: 200, body: { orders: [{ id: 'o1' }], entitlements: ['pro_pack'] } });
    expect((await adminHandle(admin, { action: 'orders', email: 'nobody@example.com' }, deps)).status).toBe(404);
  });
  it('edits a product with validated fields mapped to columns', async () => {
    const { deps, calls } = setup();
    const r = await adminHandle(admin, { action: 'set_product', key: 'starter', patch: { priceCents: 4900, credits: 2500, active: false, entitlements: ['pro_pack'], name: ' Starter ' } }, deps);
    expect(r.status).toBe(200); expect(calls.find(c => c[0] === 'setProduct')![1]).toEqual(['starter', { price_cents: 4900, credits: 2500, active: false, entitlements: ['pro_pack'], name: 'Starter' }]);
  });
  it.each([[{ priceCents: 10 }], [{ priceCents: 99.5 }], [{ credits: -1 }], [{ active: 'yes' }], [{ entitlements: ['Bad Key'] }], [{ entitlements: 'pro_pack' }], [{ name: '' }], [{}]])('rejects bad product patch %j', async patch => {
    const { deps, calls } = setup(); expect((await adminHandle(admin, { action: 'set_product', key: 'starter', patch }, deps)).status).toBe(400); expect(calls.some(c => c[0] === 'setProduct')).toBe(false);
  });
  it('maps unknown product and constraint failures', async () => {
    const { deps } = setup();
    expect((await adminHandle(admin, { action: 'set_product', key: 'ghost', patch: { active: true } }, deps)).status).toBe(404);
    expect((await adminHandle(admin, { action: 'set_product', key: 'starter', patch: { credits: 0 } }, deps)).status).toBe(400);
    expect((await adminHandle(admin, { action: 'set_product', key: '../x', patch: { active: true } }, deps)).status).toBe(400);
  });
  it('grants and revokes an entitlement for a user', async () => {
    const { deps, calls } = setup();
    expect((await adminHandle(admin, { action: 'set_entitlement', email: 'maya@example.com', key: 'recast', on: true }, deps)).status).toBe(200);
    expect(calls.find(c => c[0] === 'setEntitlement')![1]).toEqual(['u-maya', 'recast', true]);
    expect((await adminHandle(admin, { action: 'set_entitlement', email: 'maya@example.com', key: 'recast', on: 'yes' }, deps)).status).toBe(400);
    expect((await adminHandle(admin, { action: 'set_entitlement', email: 'x@example.com', key: 'recast', on: true }, deps)).status).toBe(404);
  });
  it('refunds a paid order through Stripe and leaves credits to the webhook', async () => {
    const { deps, calls } = setup();
    const r = await adminHandle(admin, { action: 'refund', orderId: ORDER }, deps);
    expect(r.status).toBe(200); expect(calls.find(c => c[0] === 'refund')![1]).toEqual(['pi_1']); expect(calls.some(c => c[0] === 'apply')).toBe(false);
  });
  it('refuses to refund an order that is not paid or a malformed id, and reports a Stripe failure', async () => {
    const { deps } = setup();
    expect((await adminHandle(admin, { action: 'refund', orderId: '22222222-2222-2222-2222-222222222222' }, deps)).status).toBe(404);
    expect((await adminHandle(admin, { action: 'refund', orderId: 'nope' }, deps)).status).toBe(400);
    const w = setup(); w.deps.paidOrderPayment = async () => ({ paymentIntent: 'pi_fail', userId: 'u' });
    expect((await adminHandle(admin, { action: 'refund', orderId: ORDER }, w.deps)).status).toBe(502);
  });
  it('every money or unlock change is written to the audit trail with the acting admin', async () => {
    const { deps, calls } = setup();
    await adminHandle(admin, { action: 'set_product', key: 'starter', patch: { priceCents: 4900 } }, deps);
    await adminHandle(admin, { action: 'set_entitlement', email: 'maya@example.com', key: 'recast', on: true }, deps);
    await adminHandle(admin, { action: 'refund', orderId: ORDER }, deps);
    expect(calls.filter(c => c[0] === 'audit').map(c => [c[1][0], c[1][1]])).toEqual([['a1', 'set_product'], ['a1', 'set_entitlement'], ['a1', 'refund']]);
  });
  it('only admins can use any of it', async () => {
    const { deps, calls } = setup(false);
    for (const a of ['billing', 'orders', 'set_product', 'set_entitlement', 'refund']) expect((await adminHandle(admin, { action: a, orderId: ORDER }, deps)).status).toBe(403);
    expect(calls).toHaveLength(0);
  });
  it('can switch entitlement enforcement', async () => {
    const { deps, calls } = setup(); await adminHandle(admin, { action: 'set_settings', patch: { enforceEntitlements: false } }, deps);
    expect(calls.find(c => c[0] === 'setSettings')![1]).toEqual([{ enforce_entitlements: false }]);
    expect((await adminHandle(admin, { action: 'set_settings', patch: { enforceEntitlements: 'no' } }, deps)).status).toBe(400);
  });
});
