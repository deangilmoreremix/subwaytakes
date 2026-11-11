import { useEffect, useState } from 'react';
import { Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DEFAULT_TAKE, buildNativePrompt, type TakeSpec } from '../lib/muapi/prompt';
import { NATIVE_MODELS, type Tier, type Aspect } from '../lib/muapi/registry';
import { getMuapiKey } from '../lib/muapi/client';
import { runNativeJob, listJobs, type ClipJob } from '../lib/muapi/jobs';

const TIERS: Tier[] = ['best', 'balanced', 'fast', 'budget'];
const field = 'w-full px-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:border-amber-500/50';

export function CreateTakePage() {
  const [spec, setSpec] = useState<TakeSpec>(DEFAULT_TAKE);
  const [tier, setTier] = useState<Tier>('fast');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [jobs, setJobs] = useState<ClipJob[]>([]);
  const hasKey = !!getMuapiKey();

  useEffect(() => { listJobs().then(setJobs).catch(() => undefined); }, []);

  const set = <K extends keyof TakeSpec>(k: K, v: TakeSpec[K]) => setSpec(s => ({ ...s, [k]: v }));

  async function generate() {
    setBusy(true); setError(''); setStatus('Submitting…');
    try {
      await runNativeJob({ spec, tier, onUpdate: p => setStatus(`muapi: ${p.status}`) });
      setStatus('Done');
      setJobs(await listJobs());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
      setStatus('');
      listJobs().then(setJobs).catch(() => undefined);
    } finally { setBusy(false); }
  }

  const model = NATIVE_MODELS.find(m => m.tier === tier && m.mode === 'text' && m.aspects.includes(spec.aspect));

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-6">
      <h1 className="text-2xl font-bold text-white">What's ur take?</h1>

      {!hasKey && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
          <AlertCircle className="w-4 h-4" /> Add your muapi key in <Link to="/settings" className="underline">Settings</Link> to generate.
        </div>
      )}

      <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <label className="block text-sm text-zinc-300">The take
          <textarea className={field + ' mt-2'} rows={3} value={spec.take} onChange={e => set('take', e.target.value)} />
        </label>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block text-sm text-zinc-300">Guest
            <input className={field + ' mt-2'} value={spec.guestDescription} onChange={e => set('guestDescription', e.target.value)} />
          </label>
          <label className="block text-sm text-zinc-300">Setting
            <input className={field + ' mt-2'} value={spec.setting} onChange={e => set('setting', e.target.value)} />
          </label>
          <label className="block text-sm text-zinc-300">Tone
            <select className={field + ' mt-2'} value={spec.tone} onChange={e => set('tone', e.target.value as TakeSpec['tone'])}>
              <option value="playful">Playful</option><option value="deadpan">Deadpan</option><option value="heated">Heated</option>
            </select>
          </label>
          <label className="block text-sm text-zinc-300">Aspect
            <select className={field + ' mt-2'} value={spec.aspect} onChange={e => set('aspect', e.target.value as Aspect)}>
              <option value="9:16">9:16 vertical</option><option value="16:9">16:9</option><option value="1:1">1:1</option>
            </select>
          </label>
          <label className="block text-sm text-zinc-300">Quality tier
            <select className={field + ' mt-2'} value={tier} onChange={e => setTier(e.target.value as Tier)}>
              {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="block text-sm text-zinc-300">Length: {spec.durationSeconds}s
            <input type="range" min={4} max={12} value={spec.durationSeconds} onChange={e => set('durationSeconds', Number(e.target.value))} className="w-full mt-3" />
          </label>
        </div>
        <details className="text-xs text-zinc-500"><summary className="cursor-pointer">Prompt preview{model ? ` · ${model.label}` : ''}</summary><p className="mt-2 whitespace-pre-wrap">{buildNativePrompt(spec)}</p></details>
        <button onClick={generate} disabled={busy || !hasKey} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 text-black font-semibold disabled:opacity-50">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Generate
        </button>
        {status && <span className="ml-3 text-sm text-zinc-400">{status}</span>}
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>

      <div className="space-y-3">
        {jobs.map(j => (
          <div key={j.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex justify-between text-xs text-zinc-500"><span>{j.model}</span><span>{j.status}</span></div>
            {j.output_url && <video src={j.output_url} controls className="mt-3 max-h-96 rounded-lg" />}
            {j.error && <p className="mt-2 text-sm text-red-400">{j.error}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
