import { useState } from 'react';
import { Layers, Loader2 } from 'lucide-react';
import { inputCls } from './ui';
import { MAX_BATCH, parseBatchLines } from '../../lib/interview/batch';

/** Queue several episodes in one go: one line each, one cost confirmation, failures do not stop the rest. */
export function BatchBox({ show, editableQuestion, duel, disabled, onBatch, batch }: {
  show: string; editableQuestion: boolean; duel: boolean; disabled: boolean;
  onBatch: (lines: string[]) => void; batch: { running: boolean; done: number; total: number; failed: string[] } | null;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const { lines, dropped } = parseBatchLines(text);
  const blocked = duel ? 'Debate duels cannot be batched.' : disabled ? 'Batch works with the Two-shot format and a described host.' : '';
  return (
    <div className="rounded-xl border border-line bg-ink-950 p-3">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} className="flex w-full items-center gap-2 text-[11px] font-medium text-zinc-400 hover:text-zinc-200"><Layers className="h-3.5 w-3.5" />Batch ({show})</button>
      {open && (
        <div className="mt-2 space-y-2">
          <p className="text-[11px] text-zinc-600">One {editableQuestion ? 'question' : 'take'} per line, up to {MAX_BATCH}. Each becomes its own shot on the timeline.</p>
          <textarea className={inputCls} rows={5} value={text} onChange={e => setText(e.target.value)} placeholder={editableQuestion ? 'What made you smile today?\nWho are you grateful for?' : 'Cereal is a soup\nA hot dog is a sandwich'} aria-label="Batch lines" />
          {dropped > 0 && <p className="text-[11px] text-amber-300/90">{dropped} extra line{dropped > 1 ? 's' : ''} will be ignored (max {MAX_BATCH}).</p>}
          {blocked && <p className="text-[11px] text-amber-300/90">{blocked}</p>}
          <button type="button" onClick={() => onBatch(lines)} disabled={!lines.length || !!blocked || !!batch?.running}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-white/5 text-[12px] font-semibold text-zinc-100 transition hover:bg-white/10 disabled:opacity-40">
            {batch?.running && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Queue {lines.length || ''} episode{lines.length === 1 ? '' : 's'}
          </button>
        </div>
      )}
    </div>
  );
}
