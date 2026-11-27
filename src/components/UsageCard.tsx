import { useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { FEATURE_LABEL, loadUsage, type Usage } from '../lib/usage';

/** Where your credits went: eight weeks and the kinds of work. Failed generations are refunded and do not count. */
export function UsageCard() {
  const { user, isGuest } = useAuth();
  const [state, setState] = useState<{ usage: Usage; truncated: boolean } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { if (user && !isGuest) loadUsage().then(setState).catch(e => setError(e instanceof Error ? e.message : 'Could not load usage.')); }, [user, isGuest]);
  if (isGuest) return null;
  const max = Math.max(1, ...(state?.usage.weeks.map(w => w.credits) ?? [1]));
  return (
    <section className="rounded-2xl border border-line bg-ink-850 p-5 shadow-panel" aria-label="Usage">
      <div className="flex items-center gap-2 font-semibold text-white"><BarChart3 className="h-4 w-4 text-accent" />Usage</div>
      {error && <p role="alert" className="mt-2 text-[12px] text-red-300">{error}</p>}
      {state && state.usage.total === 0 && <p className="mt-2 text-[12px] text-zinc-500">No credits spent in the last eight weeks.</p>}
      {state && state.usage.total > 0 && (
        <>
          <p className="mt-1 text-[12px] text-zinc-500"><span className="tnum font-semibold text-zinc-200" data-testid="usage-total">{state.usage.total.toLocaleString('en-US')}</span> credits spent in eight weeks{state.usage.refunded > 0 ? ` (${state.usage.refunded.toLocaleString('en-US')} refunded on failed generations, not counted)` : ''}.</p>
          <div className="mt-3 flex h-24 items-end gap-1.5" role="img" aria-label="Credits spent per week">
            {state.usage.weeks.map(w => (
              <div key={w.start} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`Week of ${w.start}: ${w.credits.toLocaleString('en-US')} credits`}>
                <div className="w-full rounded-t bg-accent/70" style={{ height: `${Math.max(2, Math.round((w.credits / max) * 80))}px` }} />
                <span className="text-[9px] text-zinc-600">{w.start.slice(5)}</span>
              </div>
            ))}
          </div>
          <ul className="mt-3 space-y-1.5">
            {state.usage.byFeature.map(f => (
              <li key={f.feature} className="flex items-center gap-2 text-[12px]">
                <span className="w-32 shrink-0 text-zinc-300">{FEATURE_LABEL[f.feature]}</span>
                <span className="h-2 flex-1 overflow-hidden rounded bg-ink-950"><span className="block h-full rounded bg-accent/60" style={{ width: `${Math.round((f.credits / state.usage.total) * 100)}%` }} /></span>
                <span className="tnum w-16 shrink-0 text-right text-zinc-400">{f.credits.toLocaleString('en-US')}</span>
              </li>
            ))}
          </ul>
          {state.truncated && <p className="mt-2 text-[11px] text-zinc-600">Based on your latest 1,000 transactions.</p>}
        </>
      )}
    </section>
  );
}
