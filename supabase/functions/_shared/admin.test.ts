import { describe, expect, it } from 'vitest';
import { adminHandle, type AdminDeps } from './admin.ts';

function setup(isAdmin = true) {
  const calls: Array<[string, unknown[]]> = []; const logs: unknown[] = [];
  const deps: AdminDeps = {
    isAdmin: async () => isAdmin,
    findUser: async email => (email.toLowerCase() === 'maya@example.com' ? 'u-maya' : null),
    balance: async () => 120,
    ledger: async () => [{ id: 1, delta: 120, kind: 'grant' }],
    apply: async (...a) => { calls.push(['apply', a]); if (a[1] === -999) throw new Error('would_go_negative'); return 220; },
    stats: async () => ({ credits_granted: 1 }),
    getSettings: async () => ({ margin: 2.5 }),
    setSettings: async p => { calls.push(['setSettings', [p]]); },
    setModel: async (s, p) => { calls.push(['setModel', [s, p]]); },
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

describe('granting and adjusting', () => {
  it('grants credits with a reason and logs who did it', async () => {
    const { deps, calls, logs } = setup();
    const r = await adminHandle(admin, { action: 'grant', email: ' Maya@Example.com ', amount: 100, reason: 'early customer', ref: 'order-7' }, deps);
    expect(r).toEqual({ status: 200, body: { balance: 220 } });
    expect(calls[0]).toEqual(['apply', ['u-maya', 100, 'grant', 'early customer', 'admin:order-7']]);
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
