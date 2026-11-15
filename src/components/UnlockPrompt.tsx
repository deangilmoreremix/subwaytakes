import { useState } from 'react';
import { Loader2, Lock } from 'lucide-react';
import { startCheckout } from '../lib/billing';
import { FEATURES, formatPrice, type Feature } from '../lib/billing/features';
import { useBilling } from '../lib/billing/useBilling';

/** Shown where a locked feature would be: what it is, what it costs, and one button to buy it. */
export function UnlockPrompt({ feature, onClose, className = '' }: { feature: Feature; onClose?: () => void; className?: string }) {
  const { products } = useBilling();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const info = FEATURES[feature];
  const product = products.find(p => p.key === info.product);
  async function buy() {
    setBusy(true); setError('');
    try { await startCheckout(info.product); } catch (e) { setError(e instanceof Error ? e.message : 'Could not start checkout.'); setBusy(false); }
  }
  return (
    <div role="group" aria-label={`Unlock ${info.label}`} className={`rounded-xl border border-accent/30 bg-accent-soft p-3 text-[12px] ${className}`}>
      <p className="flex items-center gap-1.5 font-medium text-white"><Lock className="h-3.5 w-3.5 text-accent" />{info.label} {product ? `is part of ${product.name}` : 'is locked'}</p>
      {product && product.description && <p className="mt-1 text-zinc-400">{product.description}</p>}
      <div className="mt-2 flex items-center gap-2">
        <button onClick={buy} disabled={busy || !product} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-[12px] font-semibold text-black disabled:opacity-60">
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{product ? `Get ${product.name} · ${formatPrice(product.price_cents, product.currency)}` : 'Not available yet'}
        </button>
        {onClose && <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200">Not now</button>}
      </div>
      {error && <p className="mt-2 text-red-300" role="alert">{error}</p>}
    </div>
  );
}
