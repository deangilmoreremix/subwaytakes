import { supabase } from '../supabase';
import { describeError } from '../muapi/client';

export interface Product { key: string; kind: 'credits' | 'bundle'; name: string; description: string; price_cents: number; currency: string; credits: number; entitlements: string[]; sort: number }
export interface Order { id: string; product_name: string; amount_cents: number; currency: string; credits: number; status: 'pending' | 'paid' | 'refunded' | 'disputed'; created_at: string; paid_at: string | null }

export async function loadProducts(): Promise<Product[]> {
  const { data, error } = await supabase.from('products').select('key, kind, name, description, price_cents, currency, credits, entitlements, sort').order('sort');
  if (error) throw new Error('Could not load the price list.');
  return (data ?? []) as Product[];
}

export async function loadEntitlements(): Promise<string[]> {
  const { data, error } = await supabase.from('entitlements').select('key').is('revoked_at', null);
  if (error) throw new Error('Could not load your unlocks.');
  return (data ?? []).map(r => (r as { key: string }).key);
}

export async function loadOrders(limit = 20): Promise<Order[]> {
  const { data, error } = await supabase.from('orders').select('id, product_name, amount_cents, currency, credits, status, created_at, paid_at').neq('status', 'pending').order('created_at', { ascending: false }).limit(limit);
  if (error) throw new Error('Could not load your orders.');
  return (data ?? []) as Order[];
}

export async function loadOrder(id: string): Promise<Order | null> {
  const { data } = await supabase.from('orders').select('id, product_name, amount_cents, currency, credits, status, created_at, paid_at').eq('id', id).maybeSingle();
  return (data as Order | null) ?? null;
}

/** Asks the server for a Stripe Checkout page for this product (the server decides the price) and returns its URL. */
export async function createCheckout(productKey: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('checkout-create', { body: { productKey } });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.clone === 'function') {
      try { const b = await ctx.clone().json() as { error?: unknown }; if (typeof b.error === 'string') throw new Error(b.error); } catch (e) { if (e instanceof Error && e.message) throw e; }
    }
    throw new Error(await describeError(error));
  }
  const url = (data as { url?: unknown } | null)?.url;
  if (typeof url !== 'string' || !url.startsWith('https://')) throw new Error('Could not start checkout. Try again.');
  return url;
}

export async function startCheckout(productKey: string): Promise<void> {
  window.location.assign(await createCheckout(productKey));
}
