import { describe, expect, it } from 'vitest';
import { referralHandle, type ReferralCaller, type ReferralDeps } from './referral';

const user: ReferralCaller = { id: 'u1', emailConfirmed: true, anonymous: false };
function world(over: Partial<ReferralDeps> = {}) {
  const w = { claims: [] as unknown[][], hits: 0 };
  const deps: ReferralDeps = { hit: async () => { w.hits++; }, claim: async (...a) => { w.claims.push(a); }, log: () => {}, ...over };
  return { deps, w };
}

describe('referral claim', () => {
  it('records a claim for a real, confirmed account (code normalised) and grants nothing itself', async () => {
    const { deps, w } = world();
    expect(await referralHandle(user, { code: ' ab12cd34 ' }, deps)).toEqual({ status: 200, body: { status: 'claimed' } });
    expect(w.claims).toEqual([['u1', 'AB12CD34']]);
  });
  it('refuses signed-out, guest and unconfirmed callers before touching the database', async () => {
    const { deps, w } = world();
    expect((await referralHandle(null, { code: 'AB12CD34' }, deps)).status).toBe(401);
    expect((await referralHandle({ ...user, anonymous: true }, { code: 'AB12CD34' }, deps)).status).toBe(403);
    expect((await referralHandle({ ...user, emailConfirmed: false }, { code: 'AB12CD34' }, deps)).status).toBe(403);
    expect(w.claims).toHaveLength(0); expect(w.hits).toBe(0);
  });
  it('rejects malformed codes without a database call', async () => {
    const { deps, w } = world();
    for (const b of [null, {}, { code: 5 }, { code: '' }, { code: 'short' }, { code: 'TOOLONGCODE1' }, { code: 'AB12-D34' }, { code: "x'; drop" }]) expect((await referralHandle(user, b, deps)).status).toBe(400);
    expect(w.claims).toHaveLength(0);
  });
  it.each([['unknown_code', 404], ['self_referral', 400], ['reciprocal_referral', 400], ['already_claimed', 409], ['not_new_customer', 400], ['referrals_disabled', 503], ['boom', 500]])('maps %s to %i', async (code, status) => {
    const { deps } = world({ claim: async () => { throw new Error(code); } });
    expect((await referralHandle(user, { code: 'AB12CD34' }, deps)).status).toBe(status);
  });
  it('is rate limited', async () => {
    const { deps, w } = world({ hit: async () => { throw new Error('rate_limited'); } });
    expect((await referralHandle(user, { code: 'AB12CD34' }, deps)).status).toBe(429); expect(w.claims).toHaveLength(0);
  });
  it('does not leak database text', async () => {
    const { deps } = world({ claim: async () => { throw new Error('relation "referrals" does not exist'); } });
    expect(JSON.stringify((await referralHandle(user, { code: 'AB12CD34' }, deps)).body)).not.toMatch(/relation|referrals/);
  });
});
