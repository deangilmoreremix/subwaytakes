import { useState } from 'react';
import { Clapperboard, Loader2 } from 'lucide-react';
import { clsx } from '../../lib/format';
import { inputCls } from './ui';
import { FALLBACK_ELEVEN, MINIMAX_VOICES, type Voice } from '../../lib/muapi/voices';
import { KINDS, NARRATED_STYLES, DEFAULT_STYLE, estimateSeconds, planNarrated, type NarratedInput, type NarratedKind, type NarratedStyleId } from '../../lib/narrated';

export interface NarratedRequest { input: NarratedInput; style: NarratedStyleId; voice: Voice }
const VOICES: Voice[] = [...FALLBACK_ELEVEN, ...MINIMAX_VOICES];

/**
 * Faceless narrated video: a script read aloud over a few generated pictures that drift slowly, with the words as captions.
 * Quote and Verse use whatever is picked in the Take tab, word for word. One cost confirmation before anything is bought.
 */
export function NarratedBox({ disabled, quote, verse, onRun, busy }: {
  disabled: string;
  quote?: { text: string; attribution: string };
  verse?: { text: string; attribution: string };
  onRun: (r: NarratedRequest) => void;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<NarratedKind>('story');
  const [story, setStory] = useState('The train was late again. Maya checked her phone and sighed. Then a stranger offered her a seat, and the whole morning changed. It taught her to look up more often.');
  const [title, setTitle] = useState('Three things I learned on the train');
  const [items, setItems] = useState('Show up early\nSay thank you\nKeep going');
  const [style, setStyle] = useState<NarratedStyleId>(DEFAULT_STYLE);
  const [voiceId, setVoiceId] = useState(VOICES[0].id);
  const input: NarratedInput = kind === 'story' ? { kind, text: story }
    : kind === 'listicle' ? { kind, title, items: items.split(/\r?\n/) }
    : kind === 'quote' ? { kind, text: quote?.text ?? '', attribution: quote?.attribution }
    : { kind, text: verse?.text ?? '', attribution: verse?.attribution };
  const plan = planNarrated(input);
  return (
    <div className="rounded-xl border border-line bg-ink-950 p-3">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} data-testid="narrated-toggle" className="flex w-full items-center gap-2 text-[11px] font-medium text-zinc-400 hover:text-zinc-200"><Clapperboard className="h-3.5 w-3.5" />Narrated video (no faces)</button>
      {open && (
        <div className="mt-2 space-y-2" data-testid="narrated-box">
          <p className="text-[11px] text-zinc-600">A voice reads your script over a few pictures that drift slowly, with the words on screen. The cheapest kind of video here: one voice and one picture per scene, no talking face.</p>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Kind of narrated video">
            {KINDS.map(k => <button key={k.id} role="radio" aria-checked={kind === k.id} data-kind={k.id} title={k.hint} onClick={() => setKind(k.id)}
              className={clsx('rounded-lg border px-2.5 py-1 text-[12px] transition', kind === k.id ? 'border-accent bg-accent-soft text-white' : 'border-line text-zinc-400 hover:border-zinc-500')}>{k.label}</button>)}
          </div>
          {kind === 'story' && <textarea className={inputCls} rows={5} value={story} onChange={e => setStory(e.target.value)} aria-label="Story" data-testid="narrated-story" />}
          {kind === 'listicle' && <>
            <input className={inputCls} value={title} maxLength={80} onChange={e => setTitle(e.target.value)} aria-label="List title" />
            <textarea className={inputCls} rows={5} value={items} onChange={e => setItems(e.target.value)} aria-label="List items, one per line" data-testid="narrated-items" />
          </>}
          {kind === 'quote' && <p className="rounded-lg border border-line p-2 text-[12px] text-zinc-300" data-testid="narrated-source">{quote ? `“${quote.text}” ${quote.attribution}` : 'Pick a quote in the Take tab (Find a quote). It is read exactly as written.'}</p>}
          {kind === 'verse' && <p className="rounded-lg border border-line p-2 text-[12px] text-zinc-300" data-testid="narrated-source">{verse ? `${verse.text} ${verse.attribution}` : 'Pick a verse in the Take tab (Find a verse). It is read exactly as written.'}</p>}
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] text-zinc-500">Pictures
              <select className={`${inputCls} mt-1`} value={style} onChange={e => setStyle(e.target.value as NarratedStyleId)} data-testid="narrated-style">{NARRATED_STYLES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
            <label className="text-[11px] text-zinc-500">Voice
              <select className={`${inputCls} mt-1`} value={voiceId} onChange={e => setVoiceId(e.target.value)} data-testid="narrated-voice">{VOICES.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}</select></label>
          </div>
          {plan.problem ? <p className="text-[11px] text-amber-300/90" data-testid="narrated-problem">{plan.problem}</p>
            : <p className="text-[11px] text-zinc-500" data-testid="narrated-plan">{plan.beats.length} pictures, about {estimateSeconds(plan.script)} seconds of voice.</p>}
          {disabled && <p className="text-[11px] text-amber-300/90">{disabled}</p>}
          <button type="button" disabled={!!plan.problem || !!disabled || busy} data-testid="narrated-run" onClick={() => onRun({ input, style, voice: VOICES.find(v => v.id === voiceId) ?? VOICES[0] })}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-white/5 text-[12px] font-semibold text-zinc-100 transition hover:bg-white/10 disabled:opacity-40">
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Make the narrated video
          </button>
        </div>
      )}
    </div>
  );
}
