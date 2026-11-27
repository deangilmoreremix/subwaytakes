import { useEffect, useState } from 'react';
import { Check, Copy, Gift } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { inviteLink, myReferral, type MyReferral } from '../lib/referrals';

/** Invite a friend: you each get credits after their first purchase. Nothing is paid out for a signup alone. */
export function ReferralCard() {
  const { isGuest, generationBlock } = useAuth();
  const [r, setR] = useState<MyReferral | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (!isGuest && !generationBlock) myReferral().then(setR).catch(e => setError(e instanceof Error ? e.message : 'Could not load.')); }, [isGuest, generationBlock]);
  if (isGuest || generationBlock) return null;
  if (r && !r.enabled) return null;
  const link = r ? inviteLink(r.code) : '';
  async function copy() { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard unavailable: the link is selectable */ } }
  return (
    <section className="rounded-2xl border border-line bg-ink-850 p-5 shadow-panel" aria-label="Invite a friend">
      <div className="flex items-center gap-2 font-semibold text-white"><Gift className="h-4 w-4 text-accent" />Invite a friend</div>
      {r && <p className="mt-1 text-[12px] text-zinc-500">When a friend you invite makes their first purchase, you get {r.referrer_reward.toLocaleString('en-US')} credits and they get {r.referee_reward.toLocaleString('en-US')}. Signing up alone earns nothing.</p>}
      {error && <p role="alert" className="mt-2 text-[12px] text-red-300">{error}</p>}
      {r && (
        <>
          <div className="mt-3 flex items-center gap-2">
            <input readOnly aria-label="Your invite link" value={link} onFocus={e => e.currentTarget.select()} className="min-w-0 flex-1 rounded-xl border border-line bg-ink-950 px-3 py-2 text-[12px] text-zinc-200" />
            <button onClick={copy} className="flex h-9 items-center gap-1.5 rounded-xl bg-white/10 px-3 text-[12px] font-medium text-zinc-100 hover:bg-white/15">{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? 'Copied' : 'Copy'}</button>
          </div>
          <p className="mt-2 text-[12px] text-zinc-400" data-testid="referral-stats">{r.claimed} invited · {r.rewarded} rewarded · {r.credits_earned.toLocaleString('en-US')} credits earned</p>
        </>
      )}
    </section>
  );
}
