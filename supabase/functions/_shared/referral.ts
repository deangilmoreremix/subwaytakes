// Recording that a new account was invited. Nothing is granted here: rewards come only from the invited customer's first real purchase
// (a database trigger on order_fulfil), so this endpoint cannot be used to mint credits.
export interface ReferralCaller { id: string; emailConfirmed: boolean; anonymous: boolean }
export interface ReferralDeps {
  hit(userId: string): Promise<void>;                       // throws Error('rate_limited')
  claim(userId: string, code: string): Promise<void>;       // throws an Error whose message contains the database code
  log(event: string, data: Record<string, unknown>): void;
}
export interface Resp { status: number; body: unknown }
const reply = (status: number, body: unknown): Resp => ({ status, body });

export async function referralHandle(caller: ReferralCaller | null, body: unknown, deps: ReferralDeps): Promise<Resp> {
  if (!caller) return reply(401, { error: 'Sign in.', code: 'unauthenticated' });
  if (caller.anonymous) return reply(403, { error: 'Create an account first.', code: 'account_required' });
  if (!caller.emailConfirmed) return reply(403, { error: 'Confirm your email address first.', code: 'verify_email' });
  const raw = body && typeof body === 'object' && !Array.isArray(body) ? (body as { code?: unknown }).code : undefined;
  const code = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  if (!/^[A-Z0-9]{8}$/.test(code)) return reply(400, { error: 'That invite link is not valid.', code: 'unknown_code' });
  try { await deps.hit(caller.id); } catch { return reply(429, { error: 'Too many requests. Wait a moment.', code: 'rate_limited' }); }
  try {
    await deps.claim(caller.id, code);
    return reply(200, { status: 'claimed' });
  } catch (e) {
    const m = e instanceof Error ? e.message : '';
    if (m.includes('unknown_code')) return reply(404, { error: 'That invite link is not valid.', code: 'unknown_code' });
    if (m.includes('self_referral') || m.includes('reciprocal_referral')) return reply(400, { error: 'This invite cannot be used on this account.', code: 'self_referral' });
    if (m.includes('already_claimed')) return reply(409, { error: 'An invite was already applied to this account.', code: 'already_claimed' });
    if (m.includes('not_new_customer')) return reply(400, { error: 'Invites are for new customers.', code: 'not_new_customer' });
    if (m.includes('referrals_disabled')) return reply(503, { error: 'Invites are paused right now.', code: 'referrals_disabled' });
    deps.log('referral_claim_failed', {});
    return reply(500, { error: 'Could not apply the invite. Try again.', code: 'internal' });
  }
}
