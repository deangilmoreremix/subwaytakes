import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Label, inputCls } from './studio/ui';
import { adminCall } from '../lib/admin';

interface RetentionStats { active_users_7d: number; paying_users: number; repeat_buyers: number; projects_saved: number; referrals_claimed: number; referrals_rewarded: number }
interface ReferralSettings { enabled: boolean; referrer_reward: number; referee_reward: number; min_order_cents: number; max_rewards_per_referrer: number }

/** Operator view of retention and the referral programme. Every call is checked on the server. */
export function AdminRetention() {
  const [stats, setStats] = useState<RetentionStats | null>(null);
  const [ref, setRef] = useState<ReferralSettings | null>(null);
  const [form, setForm] = useState({ referrerReward: '', refereeReward: '', minOrder: '', cap: '' });
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const apply = useCallback((s: ReferralSettings) => {
    setRef(s); setForm({ referrerReward: String(s.referrer_reward), refereeReward: String(s.referee_reward), minOrder: String(s.min_order_cents / 100), cap: String(s.max_rewards_per_referrer) });
  }, []);
  useEffect(() => { adminCall<{ stats: RetentionStats; referral: ReferralSettings }>({ action: 'retention' }).then(r => { setStats(r.stats); apply(r.referral); }).catch(() => setMsg({ ok: false, text: 'Could not load retention numbers.' })); }, [apply]);

  async function run<T>(fn: () => Promise<T>, ok: string) {
    setBusy(true); setMsg(null);
    try { await fn(); setMsg({ ok: true, text: ok }); } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'Failed' }); } finally { setBusy(false); }
  }
  const save = () => run(async () => {
    const r = await adminCall<{ referral: ReferralSettings }>({ action: 'set_referral', patch: { referrerReward: Number(form.referrerReward), refereeReward: Number(form.refereeReward), minOrderCents: Math.round(Number(form.minOrder) * 100), maxRewardsPerReferrer: Number(form.cap) } });
    apply(r.referral);
  }, 'Referral settings saved.');
  const toggle = () => ref && run(async () => { const r = await adminCall<{ referral: ReferralSettings }>({ action: 'set_referral', patch: { enabled: !ref.enabled } }); apply(r.referral); }, 'Saved.');
  const voidIt = () => run(() => adminCall({ action: 'void_referral', email }), 'Referral voided. It will not pay out.');

  return (
    <section className="rounded-2xl border border-line bg-ink-850 p-5" aria-label="Retention">
      <div className="flex items-center justify-between"><Label>Retention and referrals</Label>
        {ref && <button onClick={toggle} disabled={busy} className="h-8 rounded-lg border border-line bg-ink-800 px-3 text-[12px] text-zinc-200">{ref.enabled ? 'Referrals: ON (turn off)' : 'Referrals: OFF (turn on)'}</button>}
      </div>
      {msg && <p role="status" className={`mt-2 rounded-xl border px-3 py-2 text-[12px] ${msg.ok ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' : 'border-red-500/25 bg-red-500/10 text-red-300'}`}>{msg.text}</p>}
      {stats ? (
        <dl className="mt-3 grid grid-cols-2 gap-3 text-[12px] sm:grid-cols-6">
          {([['Active (7d)', stats.active_users_7d], ['Paying users', stats.paying_users], ['Repeat buyers', stats.repeat_buyers], ['Projects saved', stats.projects_saved], ['Referrals claimed', stats.referrals_claimed], ['Referrals rewarded', stats.referrals_rewarded]] as Array<[string, number]>).map(([k, v]) => (
            <div key={k} className="rounded-xl bg-ink-950 p-3"><dt className="text-zinc-500">{k}</dt><dd className="tnum text-lg font-semibold text-white">{v.toLocaleString('en-US')}</dd></div>
          ))}
        </dl>
      ) : <Loader2 className="mt-3 h-4 w-4 animate-spin text-zinc-500" />}
      {ref && (
        <div className="mt-4 grid gap-2 sm:grid-cols-5">
          {([['referrerReward', 'Referrer credits'], ['refereeReward', 'Friend credits'], ['minOrder', 'Min first order $'], ['cap', 'Rewards per referrer']] as const).map(([k, label]) => (
            <div key={k}><Label>{label}</Label><input className={inputCls} aria-label={label} value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} /></div>
          ))}
          <div className="flex items-end"><button onClick={save} disabled={busy} className="h-9 w-full rounded-xl bg-accent px-3 text-[12px] font-semibold text-black">Save</button></div>
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <div className="min-w-[220px] flex-1"><Label>Void a pending referral (friend's email)</Label><input className={inputCls} aria-label="Referred friend email" placeholder="friend@example.com" value={email} onChange={e => setEmail(e.target.value)} /></div>
        <button onClick={voidIt} disabled={busy || !email} className="h-9 rounded-xl border border-line bg-ink-800 px-4 text-[12px] text-zinc-200 disabled:opacity-40">Void</button>
      </div>
    </section>
  );
}
