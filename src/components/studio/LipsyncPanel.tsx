import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Mic, UserRound, Clock } from 'lucide-react';
import { Label } from './ui';
import { clsx } from '../../lib/format';
import { LIPSYNC_MODELS, MAX_SCRIPT_CHARS, estimateLipsync, validateLipsync, type LipsyncModel } from '../../lib/muapi/lipsync';
import type { CharacterBible } from '../../lib/types';

const TIER_STYLE: Record<string, string> = { best: 'text-fuchsia-300 bg-fuchsia-500/10', balanced: 'text-sky-300 bg-sky-500/10' };

export function LipsyncPanel({ characters, speakerId, onSpeaker, model, onModel, script, hasKey }: {
  characters: CharacterBible[]; speakerId?: string; onSpeaker: (id: string) => void;
  model: LipsyncModel; onModel: (m: LipsyncModel) => void; script: string; hasKey: boolean;
}) {
  const speaker = characters.find(c => c.id === speakerId);
  const problem = speaker ? validateLipsync({ speaker, script, model }) : 'Choose who speaks.';
  const [cost, setCost] = useState<{ value: number | null; loading: boolean }>({ value: null, loading: false });

  useEffect(() => {
    if (!speaker || problem || !hasKey) { setCost({ value: null, loading: false }); return; }
    let live = true;
    setCost(c => ({ ...c, loading: true }));
    const t = setTimeout(() => {
      estimateLipsync(speaker, script, model).then(v => live && setCost({ value: v, loading: false })).catch(() => live && setCost({ value: null, loading: false }));
    }, 500);
    return () => { live = false; clearTimeout(t); };
  }, [speaker, script, model, problem, hasKey]);

  if (characters.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 p-4 text-center">
        <UserRound className="mx-auto mb-2 h-6 w-6 text-zinc-600" />
        <p className="text-[12px] text-zinc-400">No characters yet.</p>
        <Link to="/cast" className="mt-2 inline-block text-[12px] font-medium text-accent underline">Create one in Cast</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div><Label>Speaker</Label>
        <div className="grid gap-1.5">
          {characters.map(c => (
            <button key={c.id} onClick={() => onSpeaker(c.id)} aria-pressed={c.id === speakerId}
              className={clsx('flex items-center gap-2.5 rounded-xl border p-2 text-left transition', c.id === speakerId ? 'border-accent/60 bg-accent-soft' : 'border-line bg-ink-850 hover:border-white/15')}>
              <div className="h-10 w-8 shrink-0 overflow-hidden rounded-lg bg-ink-800">{c.portrait_url ? <img src={c.portrait_url} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-zinc-600"><UserRound className="h-4 w-4" /></div>}</div>
              <div className="min-w-0 flex-1"><p className="truncate text-[12px] font-medium text-zinc-100">{c.name}</p>
                <p className="flex items-center gap-1 text-[10px] text-zinc-500"><Mic className="h-3 w-3" />{c.voice_id ? c.voice_provider : 'no voice'}{!c.portrait_url && ' · no portrait'}</p></div>
            </button>
          ))}
        </div>
      </div>

      <div><Label hint={`${script.length}/${MAX_SCRIPT_CHARS}`}>Says</Label>
        <p className="rounded-xl border border-line bg-ink-950 p-2.5 text-[12px] italic text-zinc-300">“{script || '…'}”</p>
        <p className="mt-1 text-[10px] text-zinc-600">Edit the take in the prompt bar or Take tab. Audio shorter than 4s is padded with silence automatically.</p></div>

      <div><Label>Lipsync model</Label>
        <div className="grid gap-1.5">
          {LIPSYNC_MODELS.map(m => (
            <button key={m.slug} onClick={() => onModel(m.slug)} aria-pressed={m.slug === model}
              className={clsx('flex items-center justify-between rounded-xl border px-3 py-2 text-left transition', m.slug === model ? 'border-accent/60 bg-accent-soft' : 'border-line bg-ink-850 hover:border-white/15')}>
              <span className="text-[13px] font-medium text-zinc-100">{m.label}</span>
              <span className={clsx('rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase', TIER_STYLE[m.tier])}>{m.tier}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5 rounded-xl border border-line bg-ink-950 p-3 text-[12px]">
        <div className="flex items-center justify-between"><span className="text-zinc-500">Estimated cost</span>
          <span className="tnum font-medium text-zinc-100">{!hasKey ? '—' : cost.loading ? '…' : cost.value !== null ? `$${cost.value.toFixed(2)}` : '—'}</span></div>
        <p className="flex items-center gap-1 text-[10px] text-zinc-600"><Clock className="h-3 w-3" />Rendering typically takes a few minutes (about 4 in testing).</p>
      </div>
      {problem && speaker && <p className="flex gap-1.5 text-[11px] text-amber-300/90"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{problem}</p>}
    </div>
  );
}
