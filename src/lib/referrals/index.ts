import { useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../auth';

const KEY = 'subwaytakes.ref';
const CODE = /^[A-Za-z0-9]{8}$/;

/** The invite code in a link like /login?ref=ABCD1234, or null. */
export function parseRefCode(search: string): string | null {
  const v = new URLSearchParams(search).get('ref');
  return v && CODE.test(v) ? v.toUpperCase() : null;
}
export function captureReferral(search: string): void {
  const c = parseRefCode(search);
  if (c) { try { localStorage.setItem(KEY, c); } catch { /* storage unavailable */ } }
}
const stored = (): string | null => { try { const v = localStorage.getItem(KEY); return v && CODE.test(v) ? v : null; } catch { return null; } };
const forget = (): void => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } };

/** Codes that will never work for this account: stop trying. Anything else (offline, server error) keeps the code for next time. */
const FINAL = ['unknown_code', 'self_referral', 'already_claimed', 'not_new_customer', 'referrals_disabled'];

export async function claimStoredReferral(): Promise<'none' | 'claimed' | 'dropped' | 'retry'> {
  const code = stored();
  if (!code) return 'none';
  const { data, error } = await supabase.functions.invoke('referral-claim', { body: { code } });
  if (!error && (data as { status?: string } | null)?.status === 'claimed') { forget(); return 'claimed'; }
  const ctx = (error as { context?: Response } | null)?.context;
  if (ctx && typeof ctx.clone === 'function') {
    try { const b = await ctx.clone().json() as { code?: string }; if (b.code && FINAL.includes(b.code)) { forget(); return 'dropped'; } } catch { /* not JSON */ }
  }
  return 'retry';
}

/** Once a customer has a real, confirmed account, tell the server who invited them. */
export function useReferralClaim(): void {
  const { user, isGuest } = useAuth();
  const ready = !!user && !isGuest && !!user.email_confirmed_at;
  useEffect(() => { if (ready) void claimStoredReferral().catch(() => undefined); }, [ready]);
}

export interface MyReferral { code: string; claimed: number; rewarded: number; credits_earned: number; enabled: boolean; referrer_reward: number; referee_reward: number }
export async function myReferral(): Promise<MyReferral> {
  const { data, error } = await supabase.rpc('my_referral');
  if (error || !data) throw new Error('Could not load your invite link.');
  return data as MyReferral;
}
export const inviteLink = (code: string, origin = window.location.origin): string => `${origin}/login?ref=${code}`;
