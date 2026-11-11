import { useState } from 'react';
import { KeyRound, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { getMuapiKey, setMuapiKey, muapi } from '../lib/muapi/client';

export function MuapiKeyCard() {
  const [key, setKey] = useState(getMuapiKey());
  const [status, setStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function save() {
    setMuapiKey(key);
    if (!key.trim()) { setStatus('idle'); setMessage('Key removed.'); return; }
    setStatus('checking');
    try {
      const b = await muapi.balance();
      const amount = b.balance ?? b.credits ?? b.credit_balance;
      setStatus('ok');
      setMessage(amount !== undefined ? `Connected. Balance: ${String(amount)}` : 'Connected.');
    } catch (e) {
      setStatus('error');
      setMessage(e instanceof Error ? e.message : 'Could not verify key');
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-ink-850 shadow-panel p-5 space-y-4">
      <div className="flex items-center gap-2 text-white font-semibold"><KeyRound className="w-4 h-4 text-accent" /> muapi API key</div>
      <p className="text-sm text-zinc-500">
        Video, voice and recast generation run on your own muapi account. The key stays in this browser and is
        forwarded per request; it is never saved on our servers.
      </p>
      <input
        type="password"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder="muapi key"
        autoComplete="off"
        className="w-full rounded-xl bg-ink-950 border border-line px-3 py-2.5 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/10 transition"
      />
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={status === 'checking'} className="px-4 py-2 rounded-xl bg-gradient-to-br from-accent to-accent-hot text-black font-semibold text-sm shadow-glow disabled:opacity-50">
          {status === 'checking' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save & verify'}
        </button>
        {status === 'ok' && <span className="flex items-center gap-1 text-sm text-emerald-400"><CheckCircle2 className="w-4 h-4" />{message}</span>}
        {status === 'error' && <span className="flex items-center gap-1 text-sm text-red-400"><AlertCircle className="w-4 h-4" />{message}</span>}
        {status === 'idle' && message && <span className="text-sm text-zinc-500">{message}</span>}
      </div>
    </div>
  );
}
