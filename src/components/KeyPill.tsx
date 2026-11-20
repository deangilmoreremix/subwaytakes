import { useEffect, useSyncExternalStore } from 'react';
import { KeyRound } from 'lucide-react';
import { clsx } from '../lib/format';
import { getKey, getKeyBalance, openKeyModal, subscribeKey, subscribeKeyBalance } from '../lib/muapi/key';
import { refreshKeyBalance } from '../lib/muapi/client';
import { useAuth } from '../lib/auth';

/** Top-bar button for bringing your own muapi key: "Add muapi key" when there is none, otherwise the key's wallet balance. */
export function KeyPill() {
  const { user } = useAuth();
  const key = useSyncExternalStore(subscribeKey, getKey);
  const bal = useSyncExternalStore(subscribeKeyBalance, getKeyBalance);
  const signedIn = !!user && !user.is_anonymous && !!user.email_confirmed_at;

  // read the wallet once per session start (and when a key appears), never when signed out
  useEffect(() => { if (key && signedIn && !getKeyBalance()) void refreshKeyBalance().catch(() => { /* the modal explains problems */ }); }, [key, signedIn]);

  return (
    <button onClick={() => openKeyModal()} data-testid="key-pill" aria-label={key ? 'Your muapi key' : 'Add your muapi key'}
      title={key ? 'Your muapi key and balance' : 'Add your muapi key to generate'}
      className={clsx('flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium tnum transition',
        key ? 'border-line bg-ink-800 text-zinc-200 hover:border-white/15' : 'border-accent/40 bg-accent-soft text-accent')}>
      <KeyRound className="h-3.5 w-3.5" />
      {key ? <span data-testid="key-pill-text">muapi{bal?.amount != null ? ` · ${bal.amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : ''}</span> : <span data-testid="key-pill-text">Add muapi key</span>}
    </button>
  );
}
