import { useState } from 'react';
import { Globe2, Loader2 } from 'lucide-react';
import { clsx } from '../../lib/format';
import { TOUR_CITIES, TOUR_MAX_CITIES, tourProblem } from '../../lib/tour';

/**
 * World tour: the current take asked in several cities, each with its own station look and its own card as the microphone.
 * Same rules as a batch: one cost confirmation, a failed city never stops the rest, a paid result is kept.
 */
export function TourBox({ disabled, onTour, batch }: {
  disabled: string;
  onTour: (cityIds: string[]) => void;
  batch: { running: boolean; done: number; total: number; failed: string[] } | null;
}) {
  const [open, setOpen] = useState(false);
  const [ids, setIds] = useState<string[]>(['nyc', 'london', 'tokyo']);
  const problem = tourProblem(ids);
  const toggle = (id: string) => setIds(cur => cur.includes(id) ? cur.filter(x => x !== id) : cur.length >= TOUR_MAX_CITIES ? cur : [...cur, id]);
  return (
    <div className="rounded-xl border border-line bg-ink-950 p-3">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} data-testid="tour-toggle" className="flex w-full items-center gap-2 text-[11px] font-medium text-zinc-400 hover:text-zinc-200"><Globe2 className="h-3.5 w-3.5" />World tour (same take, several cities)</button>
      {open && (
        <div className="mt-2 space-y-2" data-testid="tour-box">
          <p className="text-[11px] text-zinc-600">Asks the take above in each city you pick (2 to {TOUR_MAX_CITIES}). Each city keeps its own station look and its own card as the microphone, with a different guest each time, and a city name tags the start of every stop.</p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Cities to visit">
            {TOUR_CITIES.map(c => (
              <button key={c.id} type="button" aria-pressed={ids.includes(c.id)} data-city={c.id} onClick={() => toggle(c.id)}
                className={clsx('rounded-lg border px-2.5 py-1 text-[12px] transition', ids.includes(c.id) ? 'border-accent bg-accent-soft text-white' : 'border-line text-zinc-400 hover:border-zinc-500')}>{c.label}</button>
            ))}
          </div>
          {problem && <p className="text-[11px] text-amber-300/90" data-testid="tour-problem">{problem}</p>}
          {disabled && <p className="text-[11px] text-amber-300/90">{disabled}</p>}
          <button type="button" disabled={!!problem || !!disabled || !!batch?.running} data-testid="tour-run" onClick={() => onTour(ids)}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-white/5 text-[12px] font-semibold text-zinc-100 transition hover:bg-white/10 disabled:opacity-40">
            {batch?.running && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Take the tour ({ids.length} cities)
          </button>
        </div>
      )}
    </div>
  );
}
