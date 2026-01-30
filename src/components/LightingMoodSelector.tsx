import type { LightingMood } from '../lib/types';
import { LIGHTING_MOODS } from '../lib/constants';
import { Sun, Moon, Contrast, Lightbulb, Sparkles } from 'lucide-react';

interface LightingMoodSelectorProps {
  value: LightingMood;
  onChange: (value: LightingMood) => void;
  disabled?: boolean;
}

const LIGHTING_ICONS: Record<LightingMood, typeof Sun> = {
  golden_hour: Sun,
  dramatic_shadows: Moon,
  high_contrast: Contrast,
  studio_clean: Lightbulb,
  moody_backlit: Sparkles,
};

const LIGHTING_COLORS: Record<LightingMood, { bg: string; border: string; text: string }> = {
  golden_hour: { bg: 'bg-amber-500/15', border: 'border-amber-500/50', text: 'text-amber-400' },
  dramatic_shadows: { bg: 'bg-zinc-500/15', border: 'border-zinc-500/50', text: 'text-zinc-300' },
  high_contrast: { bg: 'bg-white/10', border: 'border-white/30', text: 'text-white' },
  studio_clean: { bg: 'bg-blue-500/15', border: 'border-blue-500/50', text: 'text-blue-400' },
  moody_backlit: { bg: 'bg-rose-500/15', border: 'border-rose-500/50', text: 'text-rose-400' },
};

export function LightingMoodSelector({ value, onChange, disabled }: LightingMoodSelectorProps) {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-zinc-300">
        Lighting Mood
      </label>
      <div className="flex flex-wrap gap-2">
        {LIGHTING_MOODS.map((lighting) => {
          const isSelected = value === lighting.value;
          const Icon = LIGHTING_ICONS[lighting.value];
          const colors = LIGHTING_COLORS[lighting.value];

          return (
            <button
              key={lighting.value}
              type="button"
              onClick={() => onChange(lighting.value)}
              disabled={disabled}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                isSelected
                  ? `${colors.bg} ${colors.border} ${colors.text}`
                  : 'bg-zinc-800/50 border-zinc-700 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Icon className="h-4 w-4" />
              <span className="text-sm font-medium">{lighting.label}</span>
            </button>
          );
        })}
      </div>
      {value && (
        <p className="text-xs text-zinc-500">
          {LIGHTING_MOODS.find(l => l.value === value)?.description}
        </p>
      )}
    </div>
  );
}
