import { Link } from 'react-router-dom';
import { Mic, UserRound } from 'lucide-react';
import { Label } from './ui';
import { clsx } from '../../lib/format';
import { cutsProblem } from '../../lib/interview';
import type { CharacterBible } from '../../lib/types';

function Picker({ title, characters, value, onChange }: { title: string; characters: CharacterBible[]; value?: string; onChange: (id: string) => void }) {
  return (
    <div><Label>{title}</Label>
      <div className="grid gap-1.5">
        {characters.map(c => (
          <button key={c.id} onClick={() => onChange(c.id)} aria-pressed={c.id === value}
            className={clsx('flex items-center gap-2.5 rounded-xl border p-2 text-left transition', c.id === value ? 'border-accent/60 bg-accent-soft' : 'border-line bg-ink-850 hover:border-white/15')}>
            <div className="h-9 w-7 shrink-0 overflow-hidden rounded-lg bg-ink-800">{c.portrait_url ? <img src={c.portrait_url} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-zinc-600"><UserRound className="h-4 w-4" /></div>}</div>
            <div className="min-w-0 flex-1"><p className="truncate text-[12px] font-medium text-zinc-100">{c.name}</p>
              <p className="flex items-center gap-1 text-[10px] text-zinc-500"><Mic className="h-3 w-3" />{c.voice_id ? c.voice_provider : 'no voice'}{!c.portrait_url && ' · no portrait'}</p></div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function CutsPanel({ characters, hostId, onHost, guestId, onGuest }: { characters: CharacterBible[]; hostId?: string; onHost: (id: string) => void; guestId?: string; onGuest: (id: string) => void }) {
  const problem = cutsProblem(characters.find(c => c.id === hostId), characters.find(c => c.id === guestId));
  if (characters.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 p-4 text-center">
        <UserRound className="mx-auto mb-2 h-6 w-6 text-zinc-600" />
        <p className="text-[12px] text-zinc-400">Cuts needs a host and a guest.</p>
        <Link to="/cast" className="mt-2 inline-block text-[12px] font-medium text-accent underline">Create them in Cast</Link>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <p className="text-[11px] leading-relaxed text-zinc-500">Two lip-synced shots, host asks then guest answers, placed back to back. Each person is shown holding a card to their mouth.</p>
      <Picker title="Host" characters={characters} value={hostId} onChange={onHost} />
      <Picker title="Guest" characters={characters} value={guestId} onChange={onGuest} />
      {problem && <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">{problem}</p>}
    </div>
  );
}
