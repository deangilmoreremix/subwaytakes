import { useState } from 'react';
import { BarChart3, Loader2 } from 'lucide-react';
import { inputCls } from './ui';
import { POLL_MAX_GUESTS, parsePollLines, pollBars, pollLabels, tally, type PollAnswer } from '../../lib/poll';

/**
 * Vox-pop poll: one question, up to five different guests, each answering with one of two labels. Each guest becomes their own shot, then a
 * results card closes the video. Same rules as a batch: one cost confirmation, a failed guest never stops the rest, a paid result is kept.
 */
export function PollBox({ disabled, onPoll, batch }: {
  disabled: string;
  onPoll: (p: { question: string; labels: [string, string]; answers: PollAnswer[] }) => void;
  batch: { running: boolean; done: number; total: number; failed: string[] } | null;
}) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('Is a hot dog a sandwich?');
  const [a, setA] = useState('Yes'); const [b, setB] = useState('No');
  const [text, setText] = useState('Yes: obviously, it is meat between bread.\nNo: absolutely not, it is its own thing.\nYes: if a sub is a sandwich, so is this.');
  const labels = pollLabels(a, b);
  const parsed = parsePollLines(text, labels);
  const counts = tally(parsed.answers);
  const bars = pollBars(labels, counts);
  return (
    <div className="rounded-xl border border-line bg-ink-950 p-3">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} data-testid="poll-toggle" className="flex w-full items-center gap-2 text-[11px] font-medium text-zinc-400 hover:text-zinc-200"><BarChart3 className="h-3.5 w-3.5" />Vox-pop poll (several guests, one question)</button>
      {open && (
        <div className="mt-2 space-y-2" data-testid="poll-box">
          <p className="text-[11px] text-zinc-600">Each guest is a different person on the train. Write one line each, starting with their answer label. They are cut together and finish with a results card.</p>
          <input className={inputCls} value={question} maxLength={160} onChange={e => setQuestion(e.target.value)} aria-label="Poll question" data-testid="poll-question" />
          <div className="grid grid-cols-2 gap-2">
            <input className={inputCls} value={a} maxLength={14} onChange={e => setA(e.target.value)} aria-label="First answer label" />
            <input className={inputCls} value={b} maxLength={14} onChange={e => setB(e.target.value)} aria-label="Second answer label" />
          </div>
          <textarea className={inputCls} rows={5} value={text} onChange={e => setText(e.target.value)} aria-label="Guest answers" data-testid="poll-lines" placeholder={`${labels[0]}: their answer\n${labels[1]}: their answer`} />
          {parsed.problem && <p className="text-[11px] text-amber-300/90" data-testid="poll-problem">{parsed.problem}</p>}
          {parsed.dropped > 0 && <p className="text-[11px] text-amber-300/90">{parsed.dropped} extra line{parsed.dropped > 1 ? 's' : ''} will be ignored (max {POLL_MAX_GUESTS} guests).</p>}
          {!parsed.problem && <p className="text-[11px] text-zinc-500" data-testid="poll-preview">Results will read: {bars.map(x => `${x.label} ${x.percent}%`).join(' · ')}</p>}
          {disabled && <p className="text-[11px] text-amber-300/90">{disabled}</p>}
          <button type="button" disabled={!!parsed.problem || !!disabled || !!batch?.running} data-testid="poll-run"
            onClick={() => onPoll({ question, labels, answers: parsed.answers })}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-white/5 text-[12px] font-semibold text-zinc-100 transition hover:bg-white/10 disabled:opacity-40">
            {batch?.running && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Make the poll ({parsed.answers.length || 0} guests)
          </button>
        </div>
      )}
    </div>
  );
}
