import { useEffect, useState } from 'react';
import { Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { clsx } from '../../lib/format';
import type { Aspect } from '../../lib/muapi/registry';
import type { ClipJob } from '../../lib/muapi/jobs';

export interface Running { status: string; startedAt: number }

const STAGES = ['Queued', 'Rendering', 'Finishing'];
function stageIndex(status: string) { return status === 'completed' ? 3 : status === 'processing' ? 1 : 0; }

function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  const s = Math.floor((now - since) / 1000);
  return <span className="tnum">{String(Math.floor(s / 60)).padStart(2, '0')}:{String(s % 60).padStart(2, '0')}</span>;
}

const ASPECT_CLASS: Record<Aspect, string> = { '9:16': 'aspect-[9/16] h-full max-h-full', '16:9': 'aspect-video w-full', '1:1': 'aspect-square h-full max-h-full' };

export function PreviewCanvas({ aspect, job, running, take, hasKey }: { aspect: Aspect; job?: ClipJob; running?: Running | null; take: string; hasKey: boolean }) {
  const idx = running ? stageIndex(running.status) : 0;
  return (
    <div className="bg-grid relative flex h-full items-center justify-center overflow-hidden rounded-2xl border border-line bg-ink-950 p-4">
      <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-accent/10 blur-3xl" />
      <div className={clsx('relative overflow-hidden rounded-[22px] border border-white/10 bg-black shadow-2xl ring-1 ring-black', ASPECT_CLASS[aspect])} style={{ maxHeight: '100%' }}>
        {job?.output_url && !running ? (
          <video key={job.id} src={job.output_url} controls playsInline loop className="h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-[#1b1408] via-[#0d0d12] to-[#050507]">
            {/* subway tile lines */}
            <div className="absolute inset-x-0 bottom-0 h-1/3 opacity-40" style={{ backgroundImage: 'linear-gradient(rgba(255,176,0,.16) 1px, transparent 1px), linear-gradient(90deg, rgba(255,176,0,.10) 1px, transparent 1px)', backgroundSize: '34px 34px' }} />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
              {job?.status === 'failed' && !running ? (
                <>
                  <AlertCircle className="h-8 w-8 text-red-400" />
                  <p className="text-[13px] font-medium text-red-300">Generation failed</p>
                  <p className="max-w-[240px] text-[12px] text-zinc-400">{job.error}</p>
                </>
              ) : running ? (
                <>
                  <div className="relative grid h-16 w-16 place-items-center">
                    <span className="absolute inset-0 rounded-full bg-accent/30 animate-pulseRing" />
                    <Loader2 className="h-8 w-8 animate-spin text-accent" />
                  </div>
                  <div className="space-y-1.5">
                    {STAGES.map((s, i) => (
                      <div key={s} className={clsx('flex items-center justify-center gap-2 text-[12px]', i < idx ? 'text-zinc-500' : i === idx ? 'text-white' : 'text-zinc-600')}>
                        <span className={clsx('h-1.5 w-1.5 rounded-full', i < idx ? 'bg-emerald-400' : i === idx ? 'bg-accent' : 'bg-zinc-700')} />{s}
                      </div>
                    ))}
                  </div>
                  <div className="text-[11px] text-zinc-500">Elapsed <Elapsed since={running.startedAt} /></div>
                </>
              ) : (
                <>
                  <span className="rounded-full border border-accent/30 bg-accent-soft px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-accent">Host</span>
                  <p className="font-display text-[26px] font-semibold leading-tight text-white">So what's ur take?</p>
                  <div className="h-px w-10 bg-accent/60" />
                  <p className="line-clamp-4 text-[13px] italic text-zinc-300">“{take}”</p>
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] text-zinc-500"><Sparkles className="h-3.5 w-3.5" />{hasKey ? 'Press Generate to render this shot' : 'Add your muapi key to render'}</div>
                </>
              )}
            </div>
            {/* MetroCard mic motif */}
            <div className="absolute bottom-5 right-4 h-9 w-14 -rotate-6 rounded-md bg-gradient-to-br from-yellow-300 to-amber-500 shadow-lg"><div className="mx-auto mt-1 h-1 w-10 rounded bg-black/50" /></div>
          </div>
        )}
      </div>
    </div>
  );
}
