import { Sparkles } from 'lucide-react';
import type { CharacterPreset } from '../lib/types';
import { CHARACTER_PRESETS } from '../lib/constants';

interface CharacterPresetSelectorProps {
  value: CharacterPreset;
  onChange: (preset: CharacterPreset) => void;
  disabled?: boolean;
}

const PRESET_COLORS: Record<CharacterPreset, { bg: string; border: string; text: string }> = {
  podcast_pro: { bg: 'bg-blue-500/15', border: 'border-blue-500/50', text: 'text-blue-400' },
  street_vox: { bg: 'bg-green-500/15', border: 'border-green-500/50', text: 'text-green-400' },
  documentary: { bg: 'bg-orange-500/15', border: 'border-orange-500/50', text: 'text-orange-400' },
  random_encounter: { bg: 'bg-rose-500/15', border: 'border-rose-500/50', text: 'text-rose-400' },
  custom: { bg: 'bg-zinc-500/15', border: 'border-zinc-500/50', text: 'text-zinc-400' },
};

export function CharacterPresetSelector({
  value,
  onChange,
  disabled,
}: CharacterPresetSelectorProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-amber-500" />
        <label className="block text-sm font-medium text-zinc-300">
          Quick Presets
        </label>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {CHARACTER_PRESETS.map((preset) => {
          const isSelected = value === preset.value;
          const colors = PRESET_COLORS[preset.value];

          return (
            <button
              key={preset.value}
              type="button"
              onClick={() => onChange(preset.value)}
              disabled={disabled}
              className={`p-3 rounded-xl border transition-all text-left ${
                isSelected
                  ? `${colors.bg} ${colors.border} ring-1 ring-current/30`
                  : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span className={`text-sm font-medium block ${isSelected ? colors.text : 'text-zinc-300'}`}>
                {preset.label}
              </span>
              <span className="text-xs text-zinc-500 block mt-1 line-clamp-2">
                {preset.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
