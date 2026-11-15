/**
 * Credits: what customers pay in. 1 credit = $0.01. The server (muapi-gateway) is the only authority on prices;
 * everything here is for display, errors and keeping the balance in step with what the gateway reports.
 */

/** Display-only margin, used for the few built-in USD price tables (Recast steps). Live quotes always win. */
export const CREDIT_MARGIN = 2.5;
/** Ask for confirmation before any action that costs more than this many credits ($1). */
export const CONFIRM_CREDITS = 100;

export function formatCredits(n: number): string {
  const r = Math.round(n);
  return `${r.toLocaleString('en-US')} credit${r === 1 ? '' : 's'}`;
}

/** Same rounding as the server (ceil of USD x 100 x margin, minimum 1), for built-in price estimates. */
export function usdToCredits(usd: number, margin = CREDIT_MARGIN): number {
  const raw = Math.round(usd * 100 * margin * 1e4) / 1e4;
  return Math.max(1, Math.ceil(raw));
}

export class InsufficientCreditsError extends Error {
  constructor(public needed: number, public balance: number) {
    super(`You need ${Math.max(0, needed - balance).toLocaleString('en-US')} more credits (this costs ${needed.toLocaleString('en-US')}, you have ${balance.toLocaleString('en-US')}).`);
    this.name = 'InsufficientCreditsError';
  }
}

export class AccountRequiredError extends Error {
  constructor(public code: 'account_required' | 'verify_email', message: string) { super(message); this.name = 'AccountRequiredError'; }
}

// ---- balance store: the gateway reports the new balance on every paid call, so the pill updates without a refetch
let balance: number | null = null;
const listeners = new Set<(n: number) => void>();
export const getBalance = (): number | null => balance;
export function publishBalance(n: number): void {
  if (!Number.isFinite(n)) return;
  balance = n;
  listeners.forEach(l => l(n));
}
export function subscribeBalance(l: (n: number) => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/** Why this account cannot generate, or null when it can. */
export function generationBlock(a: { isGuest: boolean; emailConfirmed: boolean } | null): 'guest' | 'unverified' | null {
  if (!a || a.isGuest) return 'guest';
  if (!a.emailConfirmed) return 'unverified';
  return null;
}

export const BLOCK_TEXT = {
  guest: 'Create an account to generate.',
  unverified: 'Confirm your email address to generate. Check your inbox.',
} as const;
