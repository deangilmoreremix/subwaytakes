import { useEffect, useRef, useState } from 'react';
import { Lightbulb } from 'lucide-react';
import { loadIdeas, groupIdeas, STARTER_IDEAS } from '../../lib/ideas';

/** "Ideas" popover: pick a take from the saved question bank (or the built-in starters). */
export function IdeasButton({ onPick }: { onPick: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState(() => groupIdeas(STARTER_IDEAS));
  const loaded = useRef(false);

  useEffect(() => {
    if (!open || loaded.current) return;
    loaded.current = true;
    loadIdeas().then(r => setGroups(r.groups)).catch(() => undefined);
  }, [open]);

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} className="flex items-center gap-1 text-[11px] font-medium text-zinc-500 hover:text-accent">
        <Lightbulb className="h-3.5 w-3.5" />Ideas
      </button>
      {open && (
        <div role="dialog" aria-label="Take ideas" className="absolute right-0 z-20 mt-1 max-h-72 w-60 overflow-y-auto rounded-xl border border-line bg-ink-900 p-2 shadow-panel">
          {groups.map(g => (
            <div key={g.category} className="mb-2">
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{g.category}</p>
              {g.ideas.map(i => (
                <button key={i.id} type="button" onClick={() => { onPick(i.text); setOpen(false); }} className="block w-full rounded-lg px-2 py-1.5 text-left text-[12px] leading-snug text-zinc-300 hover:bg-white/5 hover:text-white">{i.text}</button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
