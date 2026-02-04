import { useState } from 'react';
import type { DurationPreset } from '../lib/types';
import { DURATION_PRESETS } from '../lib/constants';
import { clsx } from '../lib/format';
import { Clock, ChevronDown, ChevronUp } from 'lucide-react';

interface DurationSelectorProps {
  value: DurationPreset;
  onChange: (value: DurationPreset) => void;
  disabled?: boolean;
}

export function DurationSelector({ 
  value, 
  onChange,
  disabled 
}: DurationSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const currentPreset = DURATION_PRESETS.find(p => p.value === value);
  const currentRange = currentPreset ? `${currentPreset.min}-${currentPreset.max}s` : 'Custom';

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-zinc-300 flex items-center gap-2">
        <Clock className="h-4 w-4" />
        Video Length
      </label>

      {/* Current selection */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        disabled={disabled}
        className={clsx(
          'w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all',
          'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
            <Clock className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-left">
            <div className="text-sm font-medium text-white">{currentPreset?.label || 'Custom'}</div>
            <div className="text-xs text-zinc-500">{currentRange}</div>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-zinc-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-zinc-400" />
        )}
      </button>

      {/* Expanded options */}
      {isExpanded && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 bg-zinc-900/50 rounded-xl border border-zinc-800">
          {DURATION_PRESETS.map((preset) => {
            const isSelected = value === preset.value;
            
            return (
              <button
                key={preset.value}
                type="button"
                onClick={() => {
                  onChange(preset.value);
                  setIsExpanded(false);
                }}
                disabled={disabled}
                className={clsx(
                  'relative p-3 rounded-lg border transition-all text-center',
                  isSelected
                    ? 'border-amber-500/50 bg-amber-500/10'
                    : 'border-zinc-700 hover:border-zinc-600 bg-zinc-800/50',
                  disabled && 'opacity-50 cursor-not-allowed'
                )}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-amber-400" />
                )}
                <div className="text-xs font-medium text-white mb-1">{preset.label}</div>
                <div className="text-xs text-zinc-500">{preset.min}-{preset.max}s</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
