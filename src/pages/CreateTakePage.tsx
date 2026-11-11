import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Sparkles, KeyRound } from 'lucide-react';
import { PreviewCanvas, type Running } from '../components/studio/PreviewCanvas';
import { Inspector } from '../components/studio/Inspector';
import { Timeline } from '../components/studio/Timeline';
import { Kbd } from '../components/studio/ui';
import { DEFAULT_TAKE, type TakeSpec } from '../lib/muapi/prompt';
import { NATIVE_MODELS, chooseNativeModel } from '../lib/muapi/registry';
import { getMuapiKey } from '../lib/muapi/client';
import { runNativeJob, listJobs, type ClipJob } from '../lib/muapi/jobs';

export function CreateTakePage() {
  const [spec, setSpec] = useState<TakeSpec>(DEFAULT_TAKE);
  const [slug, setSlug] = useState('veo3.1-fast-text-to-video');
  const [jobs, setJobs] = useState<ClipJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>();
  const [running, setRunning] = useState<Running | null>(null);
  const [error, setError] = useState('');
  const hasKey = !!getMuapiKey();

  const refresh = () => listJobs().then(j => { setJobs(j); return j; }).catch(() => [] as ClipJob[]).finally(() => setLoading(false));
  useEffect(() => { refresh().then(j => setSelectedId(s => s ?? j[0]?.id)); }, []);

  const set = <K extends keyof TakeSpec>(k: K, v: TakeSpec[K]) => setSpec(s => {
    const next = { ...s, [k]: v };
    if (k === 'aspect' && !NATIVE_MODELS.find(m => m.slug === slug)?.aspects.includes(v as TakeSpec['aspect'])) {
      setSlug(chooseNativeModel('fast', 'text', v as TakeSpec['aspect']).slug);
    }
    return next;
  });

  async function generate() {
    if (running || !hasKey) return;
    setError(''); setRunning({ status: 'queued', startedAt: Date.now() });
    try {
      const job = await runNativeJob({ spec, tier: 'fast', modelSlug: slug, onUpdate: p => setRunning(r => r && { ...r, status: p.status }) });
      await refresh(); setSelectedId(job.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
      const j = await refresh(); setSelectedId(j[0]?.id);
    } finally { setRunning(null); }
  }

  const selected = useMemo(() => jobs.find(j => j.id === selectedId), [jobs, selectedId]);
  const model = NATIVE_MODELS.find(m => m.slug === slug);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); generate(); } };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  });

  return (
    <div className="flex min-h-full flex-col lg:h-full lg:overflow-hidden">
      <div className="grid flex-1 gap-4 p-4 lg:min-h-0 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-h-0 flex-col gap-3">
          <div className="h-[min(56vh,520px)] min-h-[380px] lg:h-auto lg:min-h-0 lg:flex-1"><PreviewCanvas aspect={spec.aspect} job={selected} running={running} take={spec.take} hasKey={hasKey} /></div>
          {/* prompt bar */}
          <div className="flex items-center gap-2 rounded-2xl border border-line bg-ink-850 p-2 shadow-panel">
            <input value={spec.take} onChange={e => set('take', e.target.value)} placeholder="Type a hot take…" maxLength={220}
              className="min-w-0 flex-1 bg-transparent px-3 py-2 text-[14px] text-white placeholder:text-zinc-600 focus:outline-none" />
            <span className="hidden xl:flex items-center gap-1 text-[11px] text-zinc-600"><Kbd>Ctrl</Kbd><Kbd>↵</Kbd></span>
            {hasKey ? (
              <button onClick={generate} disabled={!!running}
                className="flex h-10 shrink-0 items-center gap-2 rounded-xl bg-gradient-to-br from-accent to-accent-hot px-4 text-[13px] font-semibold text-black shadow-glow transition hover:brightness-110 disabled:opacity-60">
                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {running ? 'Rendering' : 'Generate'}
                {model && <span className="hidden sm:inline rounded-md bg-black/15 px-1.5 py-0.5 text-[10px] font-semibold">{model.label}</span>}
              </button>
            ) : (
              <Link to="/settings" className="flex h-10 shrink-0 items-center gap-2 rounded-xl border border-accent/40 bg-accent-soft px-4 text-[13px] font-semibold text-accent"><KeyRound className="h-4 w-4" />Add muapi key</Link>
            )}
          </div>
          {error && <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[12px] text-red-300">{error}</p>}
        </div>
        <div className="min-w-0 lg:min-h-0"><Inspector spec={spec} set={set} slug={slug} setSlug={setSlug} /></div>
      </div>
      <Timeline jobs={jobs} selectedId={selectedId} onSelect={setSelectedId} onAdd={() => document.querySelector<HTMLInputElement>('input[placeholder^="Type"]')?.focus()} running={!!running} loading={loading} />
    </div>
  );
}
