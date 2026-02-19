import { clsx } from '../lib/format';
import type { WisdomDemographic } from '../lib/types';
import { getWisdomDemographicOptions } from '../lib/wisdomPromptEngine';

interface WisdomDemographicSelectorProps {
  value: WisdomDemographic;
  onChange: (demographic: WisdomDemographic) => void;
  disabled?: boolean;
}

export function WisdomDemographicSelector({ value, onChange, disabled }: WisdomDemographicSelectorProps) {
  const options = getWisdomDemographicOptions();

  return (
    <div>
      <label className="block text-sm font-medium text-zinc-300 mb-3">
        Speaker Profile
      </label>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const isActive = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={clsx(
                'rounded-xl border p-3 text-left transition-all duration-200',
                isActive
                  ? 'border-amber-500/50 bg-amber-500/10 ring-1 ring-amber-500/20'
                  : 'border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 hover:border-zinc-700',
                disabled && 'opacity-60 cursor-not-allowed'
              )}
            >
              <div className={clsx(
                'text-sm font-semibold',
                isActive ? 'text-amber-400' : 'text-zinc-200'
              )}>
                {option.label}
              </div>
              <div className="mt-1 text-xs text-zinc-500">{option.description}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
