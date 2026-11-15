import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { loadOrder, type Order } from '../lib/billing';
import { formatPrice } from '../lib/billing/features';
import { useBilling } from '../lib/billing/useBilling';
import { useAuth } from '../lib/auth';

const POLL_MS = 2000;
const GIVE_UP_MS = 90_000;

/** Where Stripe sends the buyer back. The webhook grants the credits, so this page waits for the order to turn paid, then refreshes the balance. */
export function BillingSuccessPage() {
  const [params] = useSearchParams();
  const orderId = params.get('order') ?? '';
  const { refreshProfile } = useAuth();
  const { refresh } = useBilling();
  const [order, setOrder] = useState<Order | null>(null);
  const [waited, setWaited] = useState(false);

  useEffect(() => {
    if (!/^[0-9a-f-]{36}$/.test(orderId)) return;
    let live = true; const started = Date.now();
    async function tick() {
      const o = await loadOrder(orderId).catch(() => null);
      if (!live) return;
      if (o) setOrder(o);
      if (o && o.status === 'paid') { await Promise.all([refreshProfile(), refresh()]); return; }
      if (o && (o.status === 'refunded' || o.status === 'disputed')) return;
      if (Date.now() - started > GIVE_UP_MS) { setWaited(true); return; }
      setTimeout(tick, POLL_MS);
    }
    void tick();
    return () => { live = false; };
  }, [orderId, refreshProfile, refresh]);

  const paid = order?.status === 'paid';
  return (
    <div className="mx-auto max-w-lg p-6 text-center">
      {paid ? <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" /> : waited ? <XCircle className="mx-auto h-10 w-10 text-amber-300" /> : <Loader2 className="mx-auto h-10 w-10 animate-spin text-accent" />}
      <h1 className="mt-4 font-display text-2xl font-semibold text-white" data-testid="billing-title">{paid ? 'Payment received' : waited ? 'Still confirming your payment' : 'Confirming your payment…'}</h1>
      {paid && order && <p className="mt-2 text-[13px] text-zinc-400">{order.product_name} · {formatPrice(order.amount_cents, order.currency)}{order.credits > 0 ? ` · ${order.credits.toLocaleString('en-US')} credits added` : ''}. Receipts come from Stripe.</p>}
      {!paid && !waited && <p className="mt-2 text-[13px] text-zinc-500">This usually takes a few seconds. You can leave this page; your purchase is safe.</p>}
      {waited && <p className="mt-2 text-[13px] text-zinc-400">Your bank may still be confirming. If your credits do not appear within a few minutes, contact support with the order id <span className="font-mono text-zinc-300">{orderId}</span>.</p>}
      <div className="mt-6 flex justify-center gap-3 text-[13px]">
        <Link to="/create" className="rounded-xl bg-accent px-4 py-2 font-semibold text-black">Start creating</Link>
        <Link to="/settings" className="rounded-xl border border-line px-4 py-2 text-zinc-300">Settings</Link>
      </div>
    </div>
  );
}

export function BillingCancelPage() {
  return (
    <div className="mx-auto max-w-lg p-6 text-center">
      <XCircle className="mx-auto h-10 w-10 text-zinc-500" />
      <h1 className="mt-4 font-display text-2xl font-semibold text-white">Checkout cancelled</h1>
      <p className="mt-2 text-[13px] text-zinc-500">You were not charged.</p>
      <div className="mt-6 flex justify-center gap-3 text-[13px]">
        <Link to="/settings" className="rounded-xl bg-accent px-4 py-2 font-semibold text-black">Back to Settings</Link>
        <Link to="/create" className="rounded-xl border border-line px-4 py-2 text-zinc-300">Create</Link>
      </div>
    </div>
  );
}
