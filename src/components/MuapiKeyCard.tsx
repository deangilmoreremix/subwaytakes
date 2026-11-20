import { useSyncExternalStore } from 'react';
import { KeyRound } from 'lucide-react';
import { getKey, getKeyBalance, maskKey, openKeyModal, subscribeKey, subscribeKeyBalance } from '../lib/muapi/key';

export function MuapiKeyCard() {
  const key = useSyncExternalStore(subscribeKey, getKey);
  const bal = useSyncExternalStore(subscribeKeyBalance, getKeyBalance);
  return (
    <section className="rounded-2xl border border-line bg-ink-850 p-4" data-testid="muapi-key-card">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-display text-[15px] font-semibold text-white"><KeyRound className="h-4 w-4 text-accent" />muapi key</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">Videos, voices and images are made with your own muapi account, so you pay muapi directly. The key stays in this browser.</p>
          {key ? <p className="mt-2 font-mono text-[13px] text-zinc-200" data-testid="settings-key-masked">{maskKey(key)}{bal?.amount != null && <span className="ml-2 font-sans text-[12px] text-emerald-400">{bal.amount.toLocaleString('en-US', { maximumFractionDigits: 2 })} muapi credits</span>}</p> : <p className="mt-2 text-[12px] text-amber-300">No key yet: you can explore the editor, but you need a key to generate.</p>}
        </div>
        <button onClick={() => openKeyModal()} data-testid="settings-key-button" className="h-9 shrink-0 rounded-xl bg-accent px-4 text-[13px] font-semibold text-black">{key ? 'Change' : 'Add key'}</button>
      </div>
    </section>
  );
}
