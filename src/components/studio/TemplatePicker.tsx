import { useState } from 'react';
import { LayoutTemplate, Lock } from 'lucide-react';
import { TEMPLATES, templateNeeds, type Template } from '../../lib/templates';
import { useBilling } from '../../lib/billing/useBilling';
import { UnlockPrompt } from '../UnlockPrompt';
import type { Feature } from '../../lib/billing/features';
import { showOf } from '../../lib/shows';
import { cityOf } from '../../lib/places';

/** One-click starting points. A template that needs a pack the customer has not got shows what it needs instead of applying. */
export function TemplatePicker({ onPick }: { onPick: (t: Template) => void }) {
  const { owned } = useBilling();
  const [open, setOpen] = useState(false);
  const [blocked, setBlocked] = useState<Feature | null>(null);
  return (
    <div>
      <button onClick={() => { setOpen(o => !o); setBlocked(null); }} aria-expanded={open} className="flex h-8 items-center gap-1.5 rounded-lg border border-line bg-ink-850 px-2.5 text-[12px] font-medium text-zinc-200 hover:border-white/15">
        <LayoutTemplate className="h-3.5 w-3.5 text-accent" />Start from a template
      </button>
      {open && (
        <div className="mt-2 space-y-2" role="group" aria-label="Templates">
          <div className="grid grid-cols-1 gap-1.5">
            {TEMPLATES.map(t => {
              const needs = templateNeeds(t, owned);
              return (
                <button key={t.id} onClick={() => { if (needs.length) { setBlocked(needs[0]); return; } setBlocked(null); setOpen(false); onPick(t); }}
                  className="flex items-start justify-between gap-2 rounded-xl border border-line bg-ink-850 px-3 py-2 text-left hover:border-white/15">
                  <span className="min-w-0"><span className="block text-[12px] font-medium text-zinc-100">{t.name}</span>
                    <span className="block text-[11px] text-zinc-500">{t.blurb} {showOf(t.show).label} · {t.place.city ? cityOf(t.place.city).label : ''}</span></span>
                  {needs.length > 0 && <Lock aria-label="locked" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" />}
                </button>
              );
            })}
          </div>
          {blocked && <UnlockPrompt feature={blocked} onClose={() => setBlocked(null)} />}
        </div>
      )}
    </div>
  );
}
