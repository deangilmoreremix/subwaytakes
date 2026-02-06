import type { InterviewStyle } from '../lib/types';
import { INTERVIEW_STYLES } from '../lib/interviewStyleSpecs';

interface InterviewStyleSelectorProps {
  value: InterviewStyle;
  onChange: (value: InterviewStyle) => void;
  disabled?: boolean;
}

export function InterviewStyleSelector({ value, onChange, disabled }: InterviewStyleSelectorProps) {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-zinc-300">
        Interview Style
      </label>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {INTERVIEW_STYLES.map((style) => {
          const isSelected = value === style.value;
          const colors = style.colors;

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
              title={style.description}
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
