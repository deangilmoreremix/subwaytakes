import { VALID_CLIP_TYPES } from '../lib/types';
import type { ClipType } from '../lib/types';
import { clsx, prettyType } from '../lib/format';

type FilterValue = 'all' | ClipType;

interface FilterTabsProps {
  value: FilterValue;
  onChange: (value: FilterValue) => void;
  disabled?: boolean;
}

export function FilterTabs({ value, onChange, disabled }: FilterTabsProps) {
  const tabs: FilterValue[] = ['all', ...VALID_CLIP_TYPES];

  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const isActive = value === tab;
        const label = tab === 'all' ? 'All' : prettyType(tab);

        return (
          <button
            key={tab}
            type="button"
            onClick={() => onChange(tab)}
            disabled={disabled}
            className={clsx(
              'rounded-xl border px-4 py-2 text-sm font-medium transition-all duration-200',
              isActive
                ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200',
              disabled && 'opacity-60 cursor-not-allowed'
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
