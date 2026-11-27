import { describe, expect, it, vi } from 'vitest';
vi.mock('../supabase', () => ({ supabase: {} }));
import { interpretGatewayFailure } from './client';
import { AccountRequiredError, InsufficientCreditsError, LockedFeatureError } from '../credits';

const failure = (body: unknown, status: number) => ({ message: 'Edge Function returned a non-2xx status code', context: new Response(JSON.stringify(body), { status }) });

describe('interpretGatewayFailure', () => {
  it('turns a locked-feature refusal into a LockedFeatureError carrying the pack', async () => {
    const e = await interpretGatewayFailure(failure({ code: 'locked', entitlement: 'pro_pack', error: 'This feature is part of a pack you have not unlocked. You were not charged.' }, 403));
    expect(e).toBeInstanceOf(LockedFeatureError); expect((e as LockedFeatureError).entitlement).toBe('pro_pack'); expect(e.message).toContain('not charged');
  });
  it('still maps insufficient credits (with a pointer to Settings) and account problems', async () => {
    const c = await interpretGatewayFailure(failure({ code: 'insufficient_credits', needed: 150, balance: 20 }, 402));
    expect(c).toBeInstanceOf(InsufficientCreditsError); expect(c.message).toContain('130 more credits'); expect(c.message).toContain('Settings');
    expect(await interpretGatewayFailure(failure({ code: 'verify_email', error: 'Confirm your email.' }, 403))).toBeInstanceOf(AccountRequiredError);
  });
});
