import { Pencil } from 'lucide-react';

interface SummaryGroup {
  label: string;
  items: { label: string; value: string }[];
  stepIndex: number;
}

interface SelectionSummaryProps {
  groups: SummaryGroup[];
  onEditStep: (step: number) => void;
}

export function SelectionSummary({ groups, onEditStep }: SelectionSummaryProps) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-800/20 divide-y divide-zinc-800">
      {groups.map((group, gi) => (
        <div key={gi} className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              {group.label}
            </span>
            <button
              type="button"
              onClick={() => onEditStep(group.stepIndex)}
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-amber-400 transition-colors"
            >
              <Pencil className="w-3 h-3" />
              Edit
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {group.items.map((item, ii) => (
              <span
                key={ii}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800 text-xs text-zinc-300"
              >
                <span className="text-zinc-500">{item.label}:</span>
                {item.value}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
