import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Label, inputCls } from './studio/ui';
import { adminCall } from '../lib/admin';

interface Alert { id: number; kind: string; severity: 'info' | 'warn' | 'critical'; message: string; created_at: string }
interface Overview { metrics: Record<string, number | string>; alerts: Alert[] }
interface ClientError { id: number; message: string; url: string | null; created_at: string }

const SEV = { critical: 'border-red-500/30 bg-red-500/10 text-red-200', warn: 'border-amber-400/30 bg-amber-400/10 text-amber-100', info: 'border-line bg-ink-800 text-zinc-300' } as const;

/** What needs the operator's attention right now, the blocked-terms list, and recent browser errors. Every call is checked on the server. */
export function AdminOps() {
  const [ov, setOv] = useState<Overview | null>(null);
  const [terms, setTerms] = useState<string[]>([]);
  const [errors, setErrors] = useState<ClientError[]>([]);
  const [term, setTerm] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [o, t, e] = await Promise.all([adminCall<Overview>({ action: 'ops' }), adminCall<{ terms: string[] }>({ action: 'safety_terms' }), adminCall<{ errors: ClientError[] }>({ action: 'client_errors' })]);
    setOv(o); setTerms(t.terms); setErrors(e.errors);
  }, []);
  useEffect(() => { load().catch(() => setMsg({ ok: false, text: 'Could not load operations.' })); }, [load]);

  async function run<T>(fn: () => Promise<T>, ok: string) {
    setBusy(true); setMsg(null);
    try { await fn(); setMsg({ ok: true, text: ok }); } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'Failed' }); } finally { setBusy(false); }
  }
  const resolve = (id: number) => run(async () => setOv(await adminCall<Overview>({ action: 'resolve_alert', id })), 'Alert resolved.');
  const add = () => run(async () => { const r = await adminCall<{ terms: string[] }>({ action: 'add_safety_term', term }); setTerms(r.terms); setTerm(''); }, 'Blocked term added.');
  const remove = (t: string) => run(async () => setTerms((await adminCall<{ terms: string[] }>({ action: 'remove_safety_term', term: t })).terms), 'Removed.');

  return (
    <section className="rounded-2xl border border-line bg-ink-850 p-5" aria-label="Operations">
      <Label>Operations</Label>
      {msg && <p role="status" className={`mt-2 rounded-xl border px-3 py-2 text-[12px] ${msg.ok ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' : 'border-red-500/25 bg-red-500/10 text-red-300'}`}>{msg.text}</p>}
      {!ov ? <Loader2 className="mt-3 h-4 w-4 animate-spin text-zinc-500" /> : (
        <>
          {ov.alerts.length === 0
            ? <p className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-[12px] text-emerald-300" data-testid="no-alerts">Nothing needs attention right now.</p>
            : <ul className="mt-3 space-y-2" aria-label="Open alerts">{ov.alerts.map(a => (
              <li key={a.id} className={`flex items-start justify-between gap-3 rounded-xl border px-3 py-2 text-[12px] ${SEV[a.severity]}`}>
                <span><span className="font-semibold uppercase">{a.severity}</span> · {a.message}<span className="block text-[10px] opacity-70">since {new Date(a.created_at).toLocaleString()}</span></span>
                <button onClick={() => resolve(a.id)} disabled={busy} className="h-7 shrink-0 rounded-lg bg-white/10 px-2 text-[11px] text-zinc-100">Resolve</button>
              </li>))}</ul>}
          <p className="mt-2 text-[11px] text-zinc-600">Alerts are raised by the scheduled <code>ops-alerts</code> check and clear themselves when the problem goes away. Resolving one by hand closes it until the problem returns.</p>
        </>
      )}

      <p className="mb-1 mt-5 text-[11px] font-medium uppercase tracking-wider text-zinc-500">Blocked terms (added to the built-in content screen)</p>
      <div className="flex flex-wrap gap-2">
        <input className={`${inputCls} max-w-xs`} aria-label="Blocked term" placeholder="a name or phrase" value={term} onChange={e => setTerm(e.target.value)} />
        <button onClick={add} disabled={busy || term.trim().length < 2} className="h-9 rounded-xl border border-line bg-ink-800 px-4 text-[12px] text-zinc-200 disabled:opacity-40">Add</button>
      </div>
      <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Blocked terms list">
        {terms.map(t => <li key={t} className="flex items-center gap-1 rounded-lg bg-ink-950 px-2 py-1 text-[12px] text-zinc-300">{t}<button onClick={() => remove(t)} aria-label={`Remove ${t}`} className="text-zinc-500 hover:text-red-300">×</button></li>)}
        {terms.length === 0 && <li className="text-[12px] text-zinc-600">None added.</li>}
      </ul>

      <p className="mb-1 mt-5 text-[11px] font-medium uppercase tracking-wider text-zinc-500">Recent browser errors</p>
      {errors.length === 0 ? <p className="text-[12px] text-zinc-600">None reported.</p> : (
        <ul className="divide-y divide-line text-[12px]">{errors.slice(0, 10).map(e => <li key={e.id} className="py-1.5"><span className="text-zinc-300">{e.message}</span><span className="block text-[10px] text-zinc-600">{new Date(e.created_at).toLocaleString()}{e.url ? ` · ${e.url}` : ''}</span></li>)}</ul>
      )}
    </section>
  );
}
