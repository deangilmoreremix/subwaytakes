/**
 * How customers pay. 'byok' (default): each customer brings their own muapi key and pays muapi directly; no credits, no checkout, no pack locks.
 * 'credits': the earlier model (server-held key, ledger, Stripe). That code is kept but switched off unless VITE_BILLING_MODE=credits.
 */
export type BillingMode = 'byok' | 'credits';
export const BILLING_MODE: BillingMode = (import.meta.env?.VITE_BILLING_MODE === 'credits' ? 'credits' : 'byok');
export const IS_BYOK = BILLING_MODE === 'byok';
