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
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">
      <div className="flex items-center gap-2 text-white font-semibold"><KeyRound className="w-4 h-4 text-amber-500" /> muapi API key</div>
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
        className="w-full px-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 transition"
      />
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={status === 'checking'} className="px-4 py-2 rounded-xl bg-amber-500 text-black font-medium text-sm disabled:opacity-50">
          {status === 'checking' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save & verify'}
        </button>
        {status === 'ok' && <span className="flex items-center gap-1 text-sm text-emerald-400"><CheckCircle2 className="w-4 h-4" />{message}</span>}
        {status === 'error' && <span className="flex items-center gap-1 text-sm text-red-400"><AlertCircle className="w-4 h-4" />{message}</span>}
        {status === 'idle' && message && <span className="text-sm text-zinc-500">{message}</span>}
      </div>
    </div>
  );
}
