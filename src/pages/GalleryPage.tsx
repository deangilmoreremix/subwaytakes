import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clapperboard, AlertCircle, Loader2 } from 'lucide-react';
import { listJobs, type ClipJob } from '../lib/muapi/jobs';
import { clsx } from '../lib/format';

const STARTERS = ['Pineapple belongs on pizza', 'Cereal is a soup', 'Subway delays build character', 'Pigeons run this city'];

export function GalleryPage() {
  const [jobs, setJobs] = useState<ClipJob[] | null>(null);
  useEffect(() => { listJobs(100).then(setJobs).catch(() => setJobs([])); }, []);
  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <div className="mb-5 flex items-end justify-between">
        <div><h1 className="font-display text-2xl font-semibold tracking-tight text-white">Library</h1><p className="text-[13px] text-zinc-500">Everything you've generated</p></div>
        <Link to="/create" className="flex h-9 items-center gap-2 rounded-xl bg-gradient-to-br from-accent to-accent-hot px-4 text-[13px] font-semibold text-black"><Clapperboard className="h-4 w-4" />New take</Link>
      </div>
      {jobs === null && <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[...Array(8)].map((_, i) => <div key={i} className="skeleton aspect-[9/16] rounded-2xl" />)}</div>}
      {jobs && jobs.length === 0 && (
        <div className="grid place-items-center rounded-2xl border border-dashed border-white/10 bg-ink-950 py-20 text-center">
          <Clapperboard className="mb-3 h-8 w-8 text-zinc-600" />
          <p className="font-display text-lg text-white">No shots yet</p>
          <p className="mb-4 text-[13px] text-zinc-500">Start with a hot take:</p>
          <div className="flex flex-wrap justify-center gap-2">{STARTERS.map(s => <Link key={s} to="/create" className="rounded-full border border-line bg-ink-800 px-3 py-1.5 text-[12px] text-zinc-300 hover:border-accent/50">{s}</Link>)}</div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {jobs?.map(j => (
          <Link to="/create" key={j.id} className={clsx('group relative aspect-[9/16] overflow-hidden rounded-2xl border bg-ink-800', j.status === 'failed' ? 'border-red-500/30' : 'border-line hover:border-accent/50')}>
            {j.output_url
              ? <video src={j.output_url} muted loop playsInline preload="metadata" onMouseEnter={e => e.currentTarget.play().catch(() => undefined)} onMouseLeave={e => e.currentTarget.pause()} className="h-full w-full object-cover" />
              : <div className="grid h-full place-items-center p-4 text-center">{j.status === 'failed' ? <div><AlertCircle className="mx-auto mb-2 h-5 w-5 text-red-400" /><p className="text-[11px] text-red-300">{j.error}</p></div> : <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />}</div>}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-3 pt-8">
              <p className="truncate text-[12px] font-medium text-white">{typeof j.input?.take === 'string' ? j.input.take : 'Untitled take'}</p>
              <p className="truncate text-[10px] text-zinc-400">{j.model} · {new Date(j.created_at).toLocaleDateString()}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
