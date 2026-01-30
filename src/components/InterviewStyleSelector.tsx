import type { InterviewStyle } from '../lib/types';
import { INTERVIEW_STYLES } from '../lib/constants';

interface InterviewStyleSelectorProps {
  value: InterviewStyle;
  onChange: (value: InterviewStyle) => void;
  disabled?: boolean;
}

const STYLE_COLORS: Record<InterviewStyle, { bg: string; border: string; text: string }> = {
  quick_fire: { bg: 'bg-orange-500/15', border: 'border-orange-500/50', text: 'text-orange-400' },
  deep_conversation: { bg: 'bg-blue-500/15', border: 'border-blue-500/50', text: 'text-blue-400' },
  man_on_street: { bg: 'bg-green-500/15', border: 'border-green-500/50', text: 'text-green-400' },
  ambush_style: { bg: 'bg-red-500/15', border: 'border-red-500/50', text: 'text-red-400' },
  friendly_chat: { bg: 'bg-teal-500/15', border: 'border-teal-500/50', text: 'text-teal-400' },
  hot_take: { bg: 'bg-rose-500/15', border: 'border-rose-500/50', text: 'text-rose-400' },
  confessional: { bg: 'bg-pink-500/15', border: 'border-pink-500/50', text: 'text-pink-400' },
  debate_challenge: { bg: 'bg-amber-500/15', border: 'border-amber-500/50', text: 'text-amber-400' },
  reaction_test: { bg: 'bg-cyan-500/15', border: 'border-cyan-500/50', text: 'text-cyan-400' },
  serious_probe: { bg: 'bg-slate-500/15', border: 'border-slate-500/50', text: 'text-slate-400' },
  storytelling: { bg: 'bg-emerald-500/15', border: 'border-emerald-500/50', text: 'text-emerald-400' },
};

export function InterviewStyleSelector({ value, onChange, disabled }: InterviewStyleSelectorProps) {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-zinc-300">
        Interview Style
      </label>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {INTERVIEW_STYLES.map((style) => {
          const isSelected = value === style.value;
          const colors = STYLE_COLORS[style.value];

          return (
            <button
              key={style.value}
              type="button"
              onClick={() => onChange(style.value)}
              disabled={disabled}
              className={`px-3 py-3 rounded-lg border transition-all text-center ${
                isSelected
                  ? `${colors.bg} ${colors.border} ring-1 ring-current/30`
                  : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span className={`text-sm font-medium whitespace-nowrap ${isSelected ? colors.text : 'text-white'}`}>
                {style.label}
              </span>
            </button>
          );
        })}
      </div>
      {value && (
        <p className="text-xs text-zinc-500 mt-2">
          {INTERVIEW_STYLES.find(s => s.value === value)?.description}
        </p>
      )}
    </div>
  );
}
