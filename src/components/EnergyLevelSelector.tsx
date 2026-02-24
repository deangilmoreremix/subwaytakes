import type { EnergyLevel } from '../lib/types';
import { ENERGY_LEVELS } from '../lib/constants';

interface EnergyLevelSelectorProps {
  value: EnergyLevel | null;
  onChange: (value: EnergyLevel) => void;
  disabled?: boolean;
}

const ENERGY_COLORS: Record<EnergyLevel, { bg: string; border: string; text: string }> = {
  calm: { bg: 'bg-blue-500/15', border: 'border-blue-500/50', text: 'text-blue-400' },
  conversational: { bg: 'bg-green-500/15', border: 'border-green-500/50', text: 'text-green-400' },
  high_energy: { bg: 'bg-orange-500/15', border: 'border-orange-500/50', text: 'text-orange-400' },
  chaotic: { bg: 'bg-red-500/15', border: 'border-red-500/50', text: 'text-red-400' },
};

export function EnergyLevelSelector({ value, onChange, disabled }: EnergyLevelSelectorProps) {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-zinc-300">
        Energy Level
      </label>
      <div className="flex flex-wrap gap-2">
        {ENERGY_LEVELS.map((energy) => {
          const isSelected = value === energy.value;
          const colors = ENERGY_COLORS[energy.value];

          return (
            <button
              key={energy.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(energy.value)}
              className={`px-4 py-2 rounded-lg border transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${
                isSelected
                  ? `${colors.bg} ${colors.border} ring-1 ring-current/30`
                  : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800'
              }`}
            >
              <span className={`text-sm font-medium ${isSelected ? colors.text : 'text-white'}`}>
                {energy.label}
              </span>
            </button>
          );
        })}
      </div>
      {value && (
        <p className="text-xs text-zinc-500">
          {ENERGY_LEVELS.find(e => e.value === value)?.description}
        </p>
      )}
    </div>
  );
}
