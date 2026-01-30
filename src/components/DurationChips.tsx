import { clsx } from '../lib/format';

interface DurationChipsProps {
  value: number;
  options: readonly number[];
  onChange: (duration: number) => void;
  disabled?: boolean;
}

export function DurationChips({ value, options, onChange, disabled }: DurationChipsProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-300 mb-2">
        Duration
      </label>
      <div className="flex flex-wrap gap-2">
        {options.map((duration) => {
          const isActive = value === duration;

          return (
            <button
              key={duration}
              type="button"
              onClick={() => onChange(duration)}
              disabled={disabled}
              className={clsx(
                'rounded-xl border px-4 py-2.5 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                  : 'border-zinc-800 bg-zinc-900/50 text-zinc-300 hover:bg-zinc-900 hover:border-zinc-700',
                disabled && 'opacity-60 cursor-not-allowed'
              )}
            >
              {duration}s
            </button>
          );
        })}
      </div>
    </div>
  );
}
