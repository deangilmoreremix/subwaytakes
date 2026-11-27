import { Link } from 'react-router-dom';
import { Mic, Trash2, UserRound } from 'lucide-react';
import { recordingSupported } from '../../lib/audio/record';
import { Label } from './ui';
import { clsx } from '../../lib/format';
import { cutsProblem } from '../../lib/interview';
import type { CharacterBible } from '../../lib/types';

export interface CutsRecording { line: string; recorded?: { seconds: number } | null; onRecord: () => void; onClear: () => void }

/** One line the customer may read themselves instead of using the Cast voice (free). */
function OwnVoice({ r }: { r: CutsRecording }) {
  return (
    <div className="mt-1.5 flex items-center justify-between gap-2 rounded-lg border border-line bg-ink-950 px-2.5 py-1.5" data-testid="cuts-own-voice">
      <p className="min-w-0 truncate text-[11px] text-zinc-500">{r.recorded ? `Using your recording (${Math.round(r.recorded.seconds)}s)` : 'Read this line yourself: free'}</p>
      {r.recorded
        ? <button onClick={r.onClear} aria-label="Remove recording" className="shrink-0 text-zinc-500 hover:text-red-300"><Trash2 className="h-3.5 w-3.5" /></button>
        : <button onClick={r.onRecord} disabled={!r.line.trim() || !recordingSupported()} data-testid="cuts-record" className="shrink-0 rounded-md border border-accent/50 px-2 py-0.5 text-[11px] font-semibold text-accent disabled:opacity-40"><Mic className="mr-1 inline h-3 w-3" />Record</button>}
    </div>
  );
}

function Picker({ title, characters, value, onChange, own }: { title: string; characters: CharacterBible[]; value?: string; onChange: (id: string) => void; own?: CutsRecording }) {
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
      {own && <OwnVoice r={own} />}
    </div>
  );
}

export function CutsPanel({ characters, hostId, onHost, guestId, onGuest, duel = false, guest2Id, onGuest2, recordings }: {
  /** per role: the line, the customer's recording of it (if any) and the actions */
  recordings?: { host?: CutsRecording; guest?: CutsRecording; guest2?: CutsRecording };
 characters: CharacterBible[]; hostId?: string; onHost: (id: string) => void; guestId?: string; onGuest: (id: string) => void; duel?: boolean; guest2Id?: string; onGuest2?: (id: string) => void }) {
  const withOwn = (id: string | undefined, r?: CutsRecording) => { const c = characters.find(x => x.id === id); return c ? { ...c, ownVoice: !!r?.recorded } : undefined; };
  const problem = cutsProblem(withOwn(hostId, recordings?.host), withOwn(guestId, recordings?.guest), withOwn(guest2Id, recordings?.guest2), duel);
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
      <Picker title="Host" characters={characters} value={hostId} onChange={onHost} own={recordings?.host} />
      <Picker title={duel ? 'Guest A' : 'Guest'} characters={characters} value={guestId} onChange={onGuest} own={recordings?.guest} />
      {duel && onGuest2 && <Picker title="Guest B" characters={characters} value={guest2Id} onChange={onGuest2} own={recordings?.guest2} />}
      {problem && <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">{problem}</p>}
    </div>
  );
}
