import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, ShieldCheck } from 'lucide-react';
import { Label, inputCls } from '../components/studio/ui';
import { adminCall, checkAdmin } from '../lib/admin';
import { AdminBilling } from '../components/AdminBilling';

interface Stats { credits_granted: number; credits_spent_net: number; credits_outstanding: number; est_muapi_usd_completed: number; est_muapi_usd_24h: number; calls_24h: number; failed_24h: number; open_holds: number }
interface Settings { margin: number; max_credits_per_call: number; max_calls_per_minute: number; max_open_holds: number; daily_credit_cap: number; kill_switch: boolean }
interface Lookup { userId: string; balance: number; ledger: Array<{ id: number; delta: number; kind: string; reason: string; created_at: string }> }

/** Operator tools. Reachable by URL, but every call is checked on the server against admin_users. */
export function AdminPage() {
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [email, setEmail] = useState(''); const [amount, setAmount] = useState('100'); const [reason, setReason] = useState('');
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    const [s, st] = await Promise.all([adminCall<Stats>({ action: 'stats' }), adminCall<Settings>({ action: 'settings' })]);
    setStats(s); setSettings(st);
  }, []);
  useEffect(() => { checkAdmin().then(ok => { setAdmin(ok); if (ok) load().catch(() => undefined); }); }, [load]);

  async function run<T>(name: string, fn: () => Promise<T>, done?: (r: T) => string) {
    setBusy(name); setMsg(null);
    try { const r = await fn(); setMsg({ ok: true, text: done ? done(r) : 'Done.' }); await load().catch(() => undefined); } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'Failed' }); } finally { setBusy(''); }
  }
  const find = () => run('lookup', async () => { const r = await adminCall<Lookup>({ action: 'lookup', email }); setLookup(r); return r; }, r => `Balance ${r.balance.toLocaleString('en-US')} credits.`);
  // a fresh ref per press, so two quick clicks can grant twice; the button is disabled while busy (busy state is the guard)
  const grant = (kind: 'grant' | 'adjust') => run(kind, async () => {
    const r = await adminCall<{ balance: number }>({ action: kind, email, amount: Number(amount), reason, ref: crypto.randomUUID() });
    setLookup(await adminCall<Lookup>({ action: 'lookup', email }).catch(() => null));
    return r;
  }, r => `Done. New balance ${r.balance.toLocaleString('en-US')} credits.`);
  const patch = (p: Record<string, unknown>) => run('settings', async () => { setSettings(await adminCall<Settings>({ action: 'set_settings', patch: p })); });

  if (admin === null) return <div className="grid place-items-center py-24 text-zinc-500"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!admin) return <div className="mx-auto max-w-md p-8 text-center text-[13px] text-zinc-400">This page is for the operator only. <Link to="/create" className="text-accent underline">Back to Create</Link></div>;

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-white"><ShieldCheck className="h-5 w-5 text-accent" />Admin</h1>
      {msg && <p role="status" className={`rounded-xl border px-3 py-2 text-[12px] ${msg.ok ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' : 'border-red-500/25 bg-red-500/10 text-red-300'}`}>{msg.text}</p>}

      <section className="rounded-2xl border border-line bg-ink-850 p-5" aria-label="Money">
        <Label>Money</Label>
        {stats ? (
          <dl className="grid grid-cols-2 gap-3 text-[12px] sm:grid-cols-4">
            {([['Credits sold', stats.credits_granted], ['Credits spent (net)', stats.credits_spent_net], ['Credits outstanding', stats.credits_outstanding], ['Open holds', stats.open_holds], ['Calls (24h)', stats.calls_24h], ['Failed (24h)', stats.failed_24h],
              ['Est. muapi cost (all)', `$${Number(stats.est_muapi_usd_completed).toFixed(2)}`], ['Est. muapi cost (24h)', `$${Number(stats.est_muapi_usd_24h).toFixed(2)}`]] as Array<[string, number | string]>).map(([k, v]) => (
              <div key={k} className="rounded-xl bg-ink-950 p-3"><dt className="text-zinc-500">{k}</dt><dd className="tnum text-lg font-semibold text-white">{typeof v === 'number' ? v.toLocaleString('en-US') : v}</dd></div>
            ))}
          </dl>
        ) : <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />}
        <p className="mt-2 text-[11px] text-zinc-600">Estimated muapi cost comes from the quotes taken at call time. Compare it with your real muapi balance regularly.</p>
      </section>

      <section className="rounded-2xl border border-line bg-ink-850 p-5" aria-label="Grant credits">
        <Label>Grant or adjust credits</Label>
        <div className="grid gap-2 sm:grid-cols-[1fr_120px_1fr]">
          <input className={inputCls} placeholder="User email" aria-label="User email" value={email} onChange={e => setEmail(e.target.value)} />
          <input className={inputCls} type="number" aria-label="Amount" value={amount} onChange={e => setAmount(e.target.value)} />
          <input className={inputCls} placeholder="Reason (required)" aria-label="Reason" value={reason} onChange={e => setReason(e.target.value)} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={find} disabled={!email || !!busy} className="h-9 rounded-xl border border-line bg-ink-800 px-4 text-[12px] font-medium text-zinc-200 disabled:opacity-40">Look up</button>
          <button onClick={() => grant('grant')} disabled={!email || !reason || !!busy} className="h-9 rounded-xl bg-gradient-to-br from-accent to-accent-hot px-4 text-[12px] font-semibold text-black disabled:opacity-40">Grant credits</button>
          <button onClick={() => grant('adjust')} disabled={!email || !reason || !!busy} className="h-9 rounded-xl border border-line bg-ink-800 px-4 text-[12px] font-medium text-zinc-200 disabled:opacity-40">Adjust (can be negative)</button>
        </div>
        {lookup && (
          <div className="mt-4"><p className="text-[12px] text-zinc-300">Balance <span className="tnum font-semibold text-white">{lookup.balance.toLocaleString('en-US')}</span> credits</p>
            <ul className="mt-2 divide-y divide-line text-[12px]">{lookup.ledger.map(r => <li key={r.id} className="flex justify-between gap-3 py-1.5"><span className="min-w-0 truncate text-zinc-400">{r.kind} · {r.reason}</span><span className="tnum text-zinc-200">{r.delta > 0 ? '+' : ''}{r.delta}</span></li>)}</ul></div>
        )}
      </section>

      <AdminBilling />

      <section className="rounded-2xl border border-line bg-ink-850 p-5" aria-label="Gateway settings">
        <div className="flex items-center justify-between"><Label>Gateway</Label>
          {settings && <button onClick={() => { if (!settings.kill_switch || window.confirm('Turn generation back on for everyone?')) patch({ killSwitch: !settings.kill_switch }); }} disabled={!!busy}
            className={`h-8 rounded-lg px-3 text-[12px] font-semibold ${settings.kill_switch ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>{settings.kill_switch ? 'Generation is PAUSED: turn back on' : 'Pause all generation'}</button>}
        </div>
        {settings && <dl className="mt-2 grid grid-cols-2 gap-3 text-[12px] sm:grid-cols-5">{([['Margin', `${settings.margin}x`], ['Max per call', settings.max_credits_per_call], ['Calls / minute', settings.max_calls_per_minute], ['Open holds', settings.max_open_holds], ['Daily cap', settings.daily_credit_cap]] as Array<[string, string | number]>).map(([k, v]) => <div key={k} className="rounded-xl bg-ink-950 p-3"><dt className="text-zinc-500">{k}</dt><dd className="tnum font-semibold text-white">{v}</dd></div>)}</dl>}
        <p className="mt-2 text-[11px] text-zinc-600">Change limits with the admin-credits function (set_settings, set_model) until a full editor exists.</p>
      </section>
    </div>
  );
}
