import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronDown, X } from 'lucide-react';
import { allDone, nextStep, onboardingSteps, type StepInput } from '../lib/onboarding';

/** First-run checklist. Ticks come from real state; dismissing it is remembered. */
export function OnboardingCard({ input, onDismiss }: { input: StepInput; onDismiss: () => void }) {
  const steps = onboardingSteps(input);
  const [open, setOpen] = useState(true);
  if (allDone(steps)) return null;
  const done = steps.filter(s => s.done).length;
  const next = nextStep(steps);
  const noCredits = (input.balance ?? 0) <= 0 && input.videoClips === 0;
  return (
    <section aria-label="Getting started" className="mx-4 mt-4 rounded-2xl border border-line bg-ink-850 p-3 shadow-panel">
      <div className="flex items-center gap-2">
        <button onClick={() => setOpen(o => !o)} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <ChevronDown className={`h-4 w-4 shrink-0 text-zinc-500 transition ${open ? '' : '-rotate-90'}`} />
          <span className="font-display text-[14px] font-semibold text-white">Getting started</span>
          <span className="tnum text-[12px] text-zinc-500" data-testid="onboarding-progress">{done} of {steps.length}</span>
          {!open && next && <span className="hidden truncate text-[12px] text-zinc-400 sm:inline">Next: {next.label}</span>}
        </button>
        <button onClick={onDismiss} aria-label="Hide getting started" className="rounded-md p-1 text-zinc-500 hover:text-white"><X className="h-4 w-4" /></button>
      </div>
      {open && (
        <>
          <ol className="mt-2 grid gap-1 sm:grid-cols-2">
            {steps.map(s => (
              <li key={s.id} className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-[12px]" data-done={s.done}>
                <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full ${s.done ? 'bg-emerald-500/25 text-emerald-300' : 'border border-white/15 text-transparent'}`}><Check className="h-3 w-3" /></span>
                <span className="min-w-0"><span className={s.done ? 'text-zinc-500 line-through' : 'text-zinc-200'}>{s.label}</span>{!s.done && <span className="block text-[11px] text-zinc-500">{s.hint}</span>}</span>
              </li>
            ))}
          </ol>
          {noCredits && (
            <p className="mt-2 rounded-lg bg-accent-soft px-3 py-2 text-[12px] text-zinc-200">
              You have no credits yet. You can explore everything for free, and when you are ready to generate, <Link to="/settings" className="font-medium text-accent underline">get credits in Settings</Link>.
            </p>
          )}
        </>
      )}
    </section>
  );
}
