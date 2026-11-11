import { Plus, Film, AlertCircle, Loader2, Check } from 'lucide-react';
import { clsx } from '../../lib/format';
import type { ClipJob } from '../../lib/muapi/jobs';

export function Timeline({ jobs, selectedId, onSelect, onAdd, running, loading }: {
  jobs: ClipJob[]; selectedId?: string; onSelect: (id: string) => void; onAdd: () => void; running: boolean; loading: boolean;
}) {
  const done = jobs.filter(j => j.status === 'completed').length;
  return (
    <section className="shrink-0 border-t border-line bg-ink-950">
      <div className="flex items-center gap-3 px-4 pt-3 pb-2">
        <Film className="h-3.5 w-3.5 text-zinc-500" />
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Shots</h2>
        <span className="text-[11px] text-zinc-600 tnum">{done} rendered · {jobs.length} total</span>
      </div>
      <div className="flex gap-3 overflow-x-auto px-4 pb-4">
        <button onClick={onAdd} className="grid h-[104px] w-[64px] shrink-0 place-items-center rounded-xl border border-dashed border-white/15 text-zinc-500 transition hover:border-accent/60 hover:text-accent" aria-label="Add shot">
          <Plus className="h-5 w-5" />
        </button>
        {running && (
          <div className="skeleton grid h-[104px] w-[64px] shrink-0 place-items-center rounded-xl border border-accent/40"><Loader2 className="h-4 w-4 animate-spin text-accent" /></div>
        )}
        {loading && !jobs.length && [0, 1, 2].map(i => <div key={i} className="skeleton h-[104px] w-[64px] shrink-0 rounded-xl" />)}
        {jobs.map(j => (
          <button key={j.id} onClick={() => onSelect(j.id)} title={j.error || j.model}
            className={clsx('group relative h-[104px] w-[64px] shrink-0 overflow-hidden rounded-xl border bg-ink-800 transition', j.id === selectedId ? 'border-accent shadow-glow' : 'border-line hover:border-white/20')}>
            {j.output_url
              ? <video src={j.output_url + '#t=0.5'} muted preload="metadata" playsInline className="h-full w-full object-cover" />
              : <div className="grid h-full w-full place-items-center bg-red-500/5">{j.status === 'failed' ? <AlertCircle className="h-4 w-4 text-red-400" /> : <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />}</div>}
            <span className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent px-1.5 pb-1 pt-4 text-[9px] text-zinc-300">
              <span className="truncate">{j.model.replace(/-(text|image)-to-video/, '')}</span>
              {j.status === 'completed' && <Check className="h-3 w-3 text-emerald-400" />}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
