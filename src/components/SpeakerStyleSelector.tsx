import type { SpeakerStyle } from '../lib/types';
import { SPEAKER_STYLES } from '../lib/constants';

interface SpeakerStyleSelectorProps {
  value: SpeakerStyle;
  onChange: (value: SpeakerStyle) => void;
  disabled?: boolean;
}

const STYLE_COLORS: Record<SpeakerStyle, { bg: string; border: string; text: string }> = {
  intense_coach: { bg: 'bg-red-500/15', border: 'border-red-500/50', text: 'text-red-400' },
  calm_mentor: { bg: 'bg-blue-500/15', border: 'border-blue-500/50', text: 'text-blue-400' },
  hype_man: { bg: 'bg-orange-500/15', border: 'border-orange-500/50', text: 'text-orange-400' },
  wise_elder: { bg: 'bg-teal-500/15', border: 'border-teal-500/50', text: 'text-teal-400' },
  corporate_exec: { bg: 'bg-slate-500/15', border: 'border-slate-500/50', text: 'text-slate-400' },
  athlete: { bg: 'bg-green-500/15', border: 'border-green-500/50', text: 'text-green-400' },
};

export function SpeakerStyleSelector({ value, onChange, disabled }: SpeakerStyleSelectorProps) {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-zinc-300">
        Speaker Style
      </label>
      <div className="flex flex-wrap gap-2">
        {SPEAKER_STYLES.map((style) => {
          const isSelected = value === style.value;
          const colors = STYLE_COLORS[style.value];

          return (
            <button
              key={style.value}
              type="button"
              onClick={() => onChange(style.value)}
              disabled={disabled}
              className={`px-4 py-2 rounded-lg border transition-all ${
                isSelected
                  ? `${colors.bg} ${colors.border} ring-1 ring-current/30`
                  : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span className={`text-sm font-medium ${isSelected ? colors.text : 'text-white'}`}>
                {style.label}
              </span>
            </button>
          );
        })}
      </div>
      {value && (
        <p className="text-xs text-zinc-500">
          {SPEAKER_STYLES.find(s => s.value === value)?.description}
        </p>
      )}
    </div>
  );
}
