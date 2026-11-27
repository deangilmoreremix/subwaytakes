import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowUpToLine, ClipboardCopy, Merge, Plus, Redo2, Scissors, Trash2, Undo2, Minus, Search } from 'lucide-react';
import type { Clip } from '../../../lib/timeline/types';
import { activeWordIndex, ensureWords } from '../../../lib/captions/words';
import { addWordAfter, convertCase, countMatches, deleteWord, editWord, findReplace, mergeWithNext, nudgeBoundary, nudgeWord, splitClip, transcriptText, type CaseMode } from '../../../lib/captions/edit';
import { NUDGE_FRAMES } from '../../../lib/captions/model';
import { framesToTime, newId } from '../../../lib/timeline/ops';
import { clsx } from '../../../lib/format';
import { inputCls } from '../ui';

interface Sel { id: string; i: number }
const btn = 'inline-flex h-7 items-center gap-1 rounded-lg border border-line bg-ink-950 px-2 text-[11px] text-zinc-300 hover:border-zinc-600 disabled:opacity-40 disabled:hover:border-line';
const NUDGE_SECONDS = (NUDGE_FRAMES / 30).toFixed(1);   // shown as about 0.1 s at 30 fps

export function TranscriptPanel({ caps, frame, fps, onSeek, apply, undo, redo, canUndo, canRedo }: {
  caps: Clip[]; frame: number; fps: number; onSeek: (timelineFrame: number) => void; apply: (fn: (c: Clip[]) => Clip[]) => void; undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean;
}) {
  const [sel, setSel] = useState<Sel | null>(null);
  const [editing, setEditing] = useState<Sel | null>(null);
  const [draft, setDraft] = useState('');
  const [find, setFind] = useState(''); const [repl, setRepl] = useState(''); const [matchCase, setMatchCase] = useState(false);
  const [auto, setAuto] = useState(true);
  const [copied, setCopied] = useState(false);
  const activeRef = useRef<HTMLButtonElement>(null);
  const sorted = useMemo(() => [...caps].sort((a, b) => a.start - b.start), [caps]);
  const matches = useMemo(() => (find ? countMatches(caps, find, { matchCase }) : 0), [caps, find, matchCase]);
  const selClip = sel ? caps.find(c => c.id === sel.id) : undefined;
  const selWord = selClip && sel ? ensureWords(selClip)[sel.i] : undefined;

  // the word being spoken right now (for highlight + auto-scroll)
  const live = useMemo(() => { const c = sorted.find(x => frame >= x.start && frame < x.start + x.duration); return c ? { id: c.id, i: activeWordIndex(ensureWords(c), frame - c.start) } : null; }, [sorted, frame]);
  useEffect(() => { if (auto) activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [live?.id, live?.i, auto]);
  useEffect(() => { if (sel) { const c = caps.find(x => x.id === sel.id); if (!c || !ensureWords(c)[sel.i]) setSel(null); } }, [caps, sel]);

  const commit = () => { if (editing) { const t = draft.trim(); apply(cs => (t ? editWord(cs, editing.id, editing.i, t) : deleteWord(cs, editing.id, editing.i))); } setEditing(null); };
  const copy = async () => { try { await navigator.clipboard.writeText(transcriptText(caps)); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch { /* clipboard blocked */ } };
  const CASES: Array<[CaseMode, string]> = [['upper', 'UPPER'], ['lower', 'lower'], ['title', 'Title'], ['sentence', 'Sentence']];

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <button className={btn} onClick={undo} disabled={!canUndo} aria-label="Undo"><Undo2 className="h-3.5 w-3.5" />Undo</button>
        <button className={btn} onClick={redo} disabled={!canRedo} aria-label="Redo"><Redo2 className="h-3.5 w-3.5" />Redo</button>
        <button className={btn} onClick={copy}><ClipboardCopy className="h-3.5 w-3.5" />{copied ? 'Copied' : 'Copy'}</button>
        <label className="ml-auto flex items-center gap-1.5 text-[11px] text-zinc-500"><input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} />Auto-scroll</label>
      </div>

      <div className="space-y-2 rounded-xl border border-line bg-ink-950 p-2.5">
        <div className="flex items-center gap-1.5">
          <Search className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
          <input className={clsx(inputCls, '!py-1 !text-[12px]')} placeholder="Find" value={find} onChange={e => setFind(e.target.value)} aria-label="Find" />
          <input className={clsx(inputCls, '!py-1 !text-[12px]')} placeholder="Replace with" value={repl} onChange={e => setRepl(e.target.value)} aria-label="Replace with" />
          <button className={btn} disabled={!find || !matches} onClick={() => apply(cs => findReplace(cs, find, repl, { matchCase }).clips)}>Replace all{find ? ` (${matches})` : ''}</button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
          <label className="flex items-center gap-1"><input type="checkbox" checked={matchCase} onChange={e => setMatchCase(e.target.checked)} />Match case</label>
          <span className="ml-2">Case:</span>
          {CASES.map(([m, l]) => <button key={m} className={btn} onClick={() => apply(cs => convertCase(cs, m))}>{l}</button>)}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1" data-testid="transcript-list">
        {sorted.length === 0 && <p className="rounded-xl border border-dashed border-line p-4 text-center text-[12px] text-zinc-500">No captions yet. Generate them first.</p>}
        {sorted.map(c => {
          const words = ensureWords(c);
          return (
            <div key={c.id} className={clsx('rounded-xl border p-2', sel?.id === c.id ? 'border-accent/50 bg-accent-soft/20' : 'border-line bg-ink-950')} data-segment={c.id}>
              <div className="mb-1 flex items-center justify-between text-[10px] text-zinc-600 tnum"><span>{framesToTime(c.start, fps)} – {framesToTime(c.start + c.duration, fps)}</span><span>{words.length} {words.length === 1 ? 'word' : 'words'}</span></div>
              <div className="flex flex-wrap gap-1">
                {words.map((w, i) => {
                  const isLive = live?.id === c.id && live.i === i; const isSel = sel?.id === c.id && sel.i === i;
                  if (editing?.id === c.id && editing.i === i) return (
                    <input key={i} autoFocus value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit} aria-label="Edit word"
                      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(null); }}
                      className="h-7 rounded-md border border-accent bg-ink-900 px-1.5 text-[13px] text-white outline-none" style={{ width: `${Math.max(3, draft.length + 1)}ch` }} />
                  );
                  return (
                    <button key={i} ref={isLive ? activeRef : undefined} data-word={`${c.id}:${i}`}
                      onClick={() => { setSel({ id: c.id, i }); onSeek(c.start + w.s); }}
                      onDoubleClick={() => { setSel({ id: c.id, i }); setEditing({ id: c.id, i }); setDraft(w.t); }}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === 'F2') { setEditing({ id: c.id, i }); setDraft(w.t); } }}
                      className={clsx('rounded-md px-1.5 py-0.5 text-[13px] transition-colors', isLive ? 'bg-accent text-black' : isSel ? 'bg-zinc-700 text-white' : 'text-zinc-200 hover:bg-zinc-800')}>{w.t}</button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* tools for the selected word / line */}
      <div className="rounded-xl border border-line bg-ink-950 p-2.5" aria-live="polite">
        {!selClip || !selWord ? <p className="text-[11px] text-zinc-600">Click a word to jump to it. Double-click (or press Enter) to edit it.</p> : (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px]"><span className="text-zinc-400">Selected: <b className="text-white">{selWord.t}</b> <span className="tnum text-zinc-600">{framesToTime(selClip.start + selWord.s, fps)}</span></span></div>
            <div className="flex flex-wrap gap-1.5">
              <button className={btn} onClick={() => { setEditing(sel); setDraft(selWord.t); }}>Edit</button>
              <button className={btn} onClick={() => apply(cs => addWordAfter(cs, sel!.id, sel!.i, 'word'))}><Plus className="h-3 w-3" />Add after</button>
              <button className={btn} onClick={() => apply(cs => deleteWord(cs, sel!.id, sel!.i))}><Trash2 className="h-3 w-3" />Delete</button>
              <button className={btn} disabled={sel!.i === 0} onClick={() => apply(cs => splitClip(cs, sel!.id, sel!.i, () => newId('cap')))}><Scissors className="h-3 w-3" />Split line here</button>
              <button className={btn} disabled={sorted.indexOf(selClip) === sorted.length - 1} onClick={() => apply(cs => mergeWithNext(cs, sel!.id))}><Merge className="h-3 w-3" />Merge with next</button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
              <span>Word start</span>
              <button className={btn} aria-label={`Word start earlier ${NUDGE_SECONDS} seconds`} onClick={() => apply(cs => nudgeWord(cs, sel!.id, sel!.i, 'start', -NUDGE_FRAMES))}><Minus className="h-3 w-3" />{NUDGE_SECONDS}s</button>
              <button className={btn} aria-label={`Word start later ${NUDGE_SECONDS} seconds`} onClick={() => apply(cs => nudgeWord(cs, sel!.id, sel!.i, 'start', NUDGE_FRAMES))}><Plus className="h-3 w-3" />{NUDGE_SECONDS}s</button>
              <span className="ml-2">Word end</span>
              <button className={btn} aria-label={`Word end earlier ${NUDGE_SECONDS} seconds`} onClick={() => apply(cs => nudgeWord(cs, sel!.id, sel!.i, 'end', -NUDGE_FRAMES))}><Minus className="h-3 w-3" />{NUDGE_SECONDS}s</button>
              <button className={btn} aria-label={`Word end later ${NUDGE_SECONDS} seconds`} onClick={() => apply(cs => nudgeWord(cs, sel!.id, sel!.i, 'end', NUDGE_FRAMES))}><Plus className="h-3 w-3" />{NUDGE_SECONDS}s</button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
              <span>Line</span>
              <button className={btn} aria-label="Line starts earlier" onClick={() => apply(cs => nudgeBoundary(cs, sel!.id, 'start', -NUDGE_FRAMES))}><ArrowUpToLine className="h-3 w-3" />start −</button>
              <button className={btn} aria-label="Line starts later" onClick={() => apply(cs => nudgeBoundary(cs, sel!.id, 'start', NUDGE_FRAMES))}><ArrowUpToLine className="h-3 w-3" />start +</button>
              <button className={btn} aria-label="Line ends earlier" onClick={() => apply(cs => nudgeBoundary(cs, sel!.id, 'end', -NUDGE_FRAMES))}><ArrowDownToLine className="h-3 w-3" />end −</button>
              <button className={btn} aria-label="Line ends later" onClick={() => apply(cs => nudgeBoundary(cs, sel!.id, 'end', NUDGE_FRAMES))}><ArrowDownToLine className="h-3 w-3" />end +</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
