import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Label, inputCls } from './studio/ui';
import { adminCall } from '../lib/admin';
import { formatPrice } from '../lib/billing/features';

interface AdminProduct { key: string; kind: string; name: string; description: string; price_cents: number; currency: string; credits: number; entitlements: string[]; active: boolean; sort: number }
interface BillingStats { paid_cents: number; refunded_cents: number; orders_paid: number; orders_reversed: number; clawback_shortfall_credits: number; needs_attention: number }
interface AdminOrder { id: string; product_name: string; amount_cents: number; currency: string; credits: number; status: string; credits_clawed: number; clawback_shortfall: number; created_at: string }

/** Operator billing tools: sales numbers, the price list (edit before launch), a customer's orders, manual unlocks and refunds. Every call is checked on the server. */
export function AdminBilling() {
  const [stats, setStats] = useState<BillingStats | null>(null);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [enforce, setEnforce] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [owned, setOwned] = useState<string[]>([]);
  const [key, setKey] = useState('pro_pack');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    const [b, s] = await Promise.all([adminCall<{ stats: BillingStats; products: AdminProduct[] }>({ action: 'billing' }), adminCall<{ enforce_entitlements?: boolean }>({ action: 'settings' })]);
    setStats(b.stats); setProducts(b.products); setEnforce(s.enforce_entitlements !== false);
  }, []);
  useEffect(() => { load().catch(() => setMsg({ ok: false, text: 'Could not load billing.' })); }, [load]);

  async function run<T>(name: string, fn: () => Promise<T>, done?: (r: T) => string) {
    setBusy(name); setMsg(null);
    try { const r = await fn(); setMsg({ ok: true, text: done ? done(r) : 'Saved.' }); } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'Failed' }); } finally { setBusy(''); }
  }
  const saveProduct = (p: AdminProduct, patch: Record<string, unknown>) => run('product-' + p.key, async () => { const r = await adminCall<{ products: AdminProduct[] }>({ action: 'set_product', key: p.key, patch }); setProducts(r.products); });
  const findOrders = () => run('orders', async () => { const r = await adminCall<{ orders: AdminOrder[]; entitlements: string[] }>({ action: 'orders', email }); setOrders(r.orders); setOwned(r.entitlements); }, () => 'Loaded.');
  const setUnlock = (on: boolean) => run('unlock', async () => { const r = await adminCall<{ entitlements: string[] }>({ action: 'set_entitlement', email, key, on }); setOwned(r.entitlements); }, () => (on ? 'Unlocked.' : 'Removed.'));
  const refund = (o: AdminOrder) => { if (window.confirm(`Refund ${formatPrice(o.amount_cents, o.currency)} for "${o.product_name}"? The customer's credits and unlocks are removed when Stripe confirms.`)) void run('refund-' + o.id, () => adminCall<{ note: string }>({ action: 'refund', orderId: o.id }), r => r.note); };
  const toggleEnforce = () => run('enforce', async () => { const next = !enforce; await adminCall({ action: 'set_settings', patch: { enforceEntitlements: next } }); setEnforce(next); }, () => 'Saved.');

  return (
    <section className="rounded-2xl border border-line bg-ink-850 p-5" aria-label="Billing">
      <div className="flex items-center justify-between"><Label>Billing</Label>
        {enforce !== null && <button onClick={toggleEnforce} disabled={!!busy} className="h-8 rounded-lg border border-line bg-ink-800 px-3 text-[12px] text-zinc-200">{enforce ? 'Pack locks: ON (turn off)' : 'Pack locks: OFF (turn on)'}</button>}
      </div>
      {msg && <p role="status" className={`mt-2 rounded-xl border px-3 py-2 text-[12px] ${msg.ok ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' : 'border-red-500/25 bg-red-500/10 text-red-300'}`}>{msg.text}</p>}

      {stats ? (
        <dl className="mt-3 grid grid-cols-2 gap-3 text-[12px] sm:grid-cols-5">
          {([['Revenue', formatPrice(stats.paid_cents)], ['Refunded / disputed', formatPrice(stats.refunded_cents)], ['Paid orders', stats.orders_paid], ['Unrecovered credits', stats.clawback_shortfall_credits], ['Needs attention', stats.needs_attention]] as Array<[string, string | number]>).map(([k, v]) => (
            <div key={k} className="rounded-xl bg-ink-950 p-3"><dt className="text-zinc-500">{k}</dt><dd className={`tnum text-lg font-semibold ${k === 'Needs attention' && Number(v) > 0 ? 'text-amber-300' : 'text-white'}`}>{typeof v === 'number' ? v.toLocaleString('en-US') : v}</dd></div>
          ))}
        </dl>
      ) : <Loader2 className="mt-3 h-4 w-4 animate-spin text-zinc-500" />}
      {stats && stats.needs_attention > 0 && <p className="mt-2 text-[11px] text-amber-300">A customer paid but could not be matched to an order, or a partial refund needs a decision. Check the stripe_events table (outcome needs_attention) and the Stripe dashboard.</p>}

      <p className="mb-1 mt-4 text-[11px] font-medium uppercase tracking-wider text-zinc-500">Price list (placeholders until you edit them)</p>
      <div className="overflow-x-auto"><table className="w-full text-left text-[12px]">
        <thead className="text-zinc-500"><tr><th className="py-1 pr-2 font-medium">Product</th><th className="pr-2 font-medium">Price $</th><th className="pr-2 font-medium">Credits</th><th className="pr-2 font-medium">Unlocks</th><th className="font-medium">On sale</th></tr></thead>
        <tbody className="divide-y divide-line">{products.map(p => <ProductRow key={p.key + p.price_cents + p.credits + String(p.active)} p={p} onSave={patch => saveProduct(p, patch)} disabled={!!busy} />)}</tbody>
      </table></div>

      <p className="mb-1 mt-5 text-[11px] font-medium uppercase tracking-wider text-zinc-500">Customer</p>
      <div className="flex flex-wrap gap-2">
        <input className={`${inputCls} max-w-xs`} placeholder="Customer email" aria-label="Customer email" value={email} onChange={e => setEmail(e.target.value)} />
        <button onClick={findOrders} disabled={!email || !!busy} className="h-9 rounded-xl border border-line bg-ink-800 px-4 text-[12px] text-zinc-200 disabled:opacity-40">Orders and unlocks</button>
      </div>
      {orders && (<>
        <p className="mt-3 text-[12px] text-zinc-300">Unlocks: {owned.length ? owned.join(', ') : 'none'}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <select className={`${inputCls} max-w-[160px]`} aria-label="Unlock key" value={key} onChange={e => setKey(e.target.value)}>{['pro_pack', 'recast', 'happiness', 'bible', 'motivation', 'commercial'].map(k => <option key={k}>{k}</option>)}</select>
          <button onClick={() => setUnlock(true)} disabled={!!busy} className="h-9 rounded-xl border border-line bg-ink-800 px-3 text-[12px] text-zinc-200">Give unlock</button>
          <button onClick={() => setUnlock(false)} disabled={!!busy} className="h-9 rounded-xl border border-line bg-ink-800 px-3 text-[12px] text-zinc-200">Remove unlock</button>
        </div>
        {orders.length === 0 ? <p className="mt-2 text-[12px] text-zinc-600">No orders.</p> : (
          <ul className="mt-2 divide-y divide-line text-[12px]">{orders.map(o => (
            <li key={o.id} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0"><span className="block truncate text-zinc-200">{o.product_name} · {formatPrice(o.amount_cents, o.currency)} · <span className={o.status === 'paid' ? 'text-emerald-300' : 'text-amber-300'}>{o.status}</span></span>
                <span className="block truncate text-[11px] text-zinc-600">{new Date(o.created_at).toLocaleString()}{o.status !== 'paid' && o.status !== 'pending' ? ` · ${o.credits_clawed} credits taken back${o.clawback_shortfall ? `, ${o.clawback_shortfall} already spent` : ''}` : ''}</span></span>
              {o.status === 'paid' && <button onClick={() => refund(o)} disabled={!!busy} className="h-8 shrink-0 rounded-lg bg-red-500/15 px-3 text-[12px] font-medium text-red-300">Refund</button>}
            </li>))}
          </ul>)}
      </>)}
    </section>
  );
}

function ProductRow({ p, onSave, disabled }: { p: AdminProduct; onSave: (patch: Record<string, unknown>) => void; disabled: boolean }) {
  const [price, setPrice] = useState(String(p.price_cents / 100));
  const [credits, setCredits] = useState(String(p.credits));
  const dirty = Math.round(Number(price) * 100) !== p.price_cents || Number(credits) !== p.credits;
  return (
    <tr>
      <td className="py-1.5 pr-2 text-zinc-200">{p.name}<span className="block text-[10px] text-zinc-600">{p.key}</span></td>
      <td className="pr-2"><input className={`${inputCls} w-24`} aria-label={`${p.key} price`} value={price} onChange={e => setPrice(e.target.value)} /></td>
      <td className="pr-2"><input className={`${inputCls} w-24`} aria-label={`${p.key} credits`} value={credits} onChange={e => setCredits(e.target.value)} /></td>
      <td className="pr-2 text-zinc-500">{p.entitlements.join(', ') || '-'}</td>
      <td className="whitespace-nowrap">
        <input type="checkbox" aria-label={`${p.key} on sale`} checked={p.active} disabled={disabled} onChange={e => onSave({ active: e.target.checked })} />
        {dirty && <button onClick={() => onSave({ priceCents: Math.round(Number(price) * 100), credits: Math.round(Number(credits)) })} disabled={disabled} className="ml-2 h-7 rounded-lg bg-accent px-2 text-[11px] font-semibold text-black">Save</button>}
      </td>
    </tr>
  );
}
