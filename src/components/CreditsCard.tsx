import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Coins, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { BLOCK_TEXT, formatCredits } from '../lib/credits';
import { checkAdmin } from '../lib/admin';

interface Row { id: number; delta: number; kind: string; reason: string; created_at: string }

const KIND_LABEL: Record<string, string> = { grant: 'Credits added', spend: 'Generation', refund: 'Refund', adjust: 'Adjustment', opening: 'Opening balance' };

/** Balance and recent activity. Rows come from the owner-only credit_ledger table (RLS: you only ever see your own). */
export function CreditsCard() {
  const { profile, user, generationBlock } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const balance = profile?.credits_balance ?? 0;
  useEffect(() => { if (user && !user.is_anonymous) checkAdmin().then(setIsAdmin); }, [user]);

  useEffect(() => {
    if (!user) return;
    let live = true;
    supabase.from('credit_ledger').select('id, delta, kind, reason, created_at').order('id', { ascending: false }).limit(20)
      .then(({ data, error: e }) => { if (!live) return; if (e) { setError('Could not load your activity.'); setRows([]); } else setRows((data ?? []) as Row[]); });
    return () => { live = false; };
    // reload when the balance changes (a generation finished or was refunded)
  }, [user, balance]);

  return (
    <section className="rounded-2xl border border-line bg-ink-850 p-5 shadow-panel" aria-label="Credits">
      <div className="flex items-center gap-2 font-semibold text-white"><Coins className="h-4 w-4 text-accent" />Credits</div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="tnum text-3xl font-semibold text-white" data-testid="credit-balance">{balance.toLocaleString('en-US')}</p>
          <p className="text-[12px] text-zinc-500">credits available. 1 credit is about one cent of generation.</p>
        </div>
        <button disabled title="Credit packs arrive with checkout" className="h-9 rounded-xl border border-line bg-ink-800 px-4 text-[12px] font-medium text-zinc-500">Buy credits · coming soon</button>
      </div>
      {generationBlock && (
        <p className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-200">
          {BLOCK_TEXT[generationBlock]} {generationBlock === 'guest' && <Link to="/login" className="underline">Sign up or sign in</Link>}
        </p>
      )}
      {isAdmin && <p className="mt-3 text-[12px]"><Link to="/admin" className="text-accent underline">Admin tools</Link></p>}
      <div className="mt-4">
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-500">Recent activity</p>
        {rows === null && <div className="flex items-center gap-2 text-[12px] text-zinc-500"><Loader2 className="h-3.5 w-3.5 animate-spin" />Loading…</div>}
        {error && <p className="text-[12px] text-red-300">{error}</p>}
        {rows && rows.length === 0 && !error && <p className="text-[12px] text-zinc-600">Nothing yet. Credits you add and spend will show up here.</p>}
        <ul className="divide-y divide-line">
          {rows?.map(r => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-[12px]">
              <span className="min-w-0"><span className="block truncate text-zinc-200">{KIND_LABEL[r.kind] ?? r.kind}</span><span className="block truncate text-[11px] text-zinc-600">{r.reason ? `${r.reason} · ` : ''}{new Date(r.created_at).toLocaleString()}</span></span>
              <span className={`tnum shrink-0 font-medium ${r.delta > 0 ? 'text-emerald-400' : 'text-zinc-300'}`}>{r.delta > 0 ? '+' : ''}{formatCredits(r.delta).replace(' credits', '').replace(' credit', '')}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
