import type { InterviewFormat } from '../lib/types';
import { INTERVIEW_FORMATS } from '../lib/constants';
import { clsx } from '../lib/format';

interface InterviewFormatSelectorProps {
  value: InterviewFormat;
  onChange: (value: InterviewFormat) => void;
  disabled?: boolean;
}

const FORMAT_COLORS: Record<InterviewFormat, { bg: string; border: string; text: string; icon: string }> = {
  solo: { bg: 'bg-blue-500/15', border: 'border-blue-500/50', text: 'text-blue-400', icon: '👤' },
  face_to_face: { bg: 'bg-purple-500/15', border: 'border-purple-500/50', text: 'text-purple-400', icon: '👥' },
  reporter_style: { bg: 'bg-amber-500/15', border: 'border-amber-500/50', text: 'text-amber-400', icon: '🎤' },
  full_body: { bg: 'bg-green-500/15', border: 'border-green-500/50', text: 'text-green-400', icon: '🚶' },
  pov_interviewer: { bg: 'bg-cyan-500/15', border: 'border-cyan-500/50', text: 'text-cyan-400', icon: '👁️' },
  group: { bg: 'bg-pink-500/15', border: 'border-pink-500/50', text: 'text-pink-400', icon: '👥👥' },
};

export function InterviewFormatSelector({ value, onChange, disabled }: InterviewFormatSelectorProps) {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-zinc-300">
        Interview Format
      </label>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {INTERVIEW_FORMATS.map((format) => {
          const isSelected = value === format.value;
          const colors = FORMAT_COLORS[format.value];

          return (
            <button
              key={format.value}
              type="button"
              onClick={() => onChange(format.value)}
              disabled={disabled}
              className={clsx(
                'relative p-3 rounded-xl border transition-all text-center',
                isSelected
                  ? `${colors.bg} ${colors.border} ring-1 ring-current/30`
                  : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800',
                disabled ? 'opacity-50 cursor-not-allowed' : ''
              )}
            >
              <div className="text-2xl mb-1">{format.icon}</div>
              <span className={clsx(
                'text-xs font-medium',
                isSelected ? colors.text : 'text-white'
              )}>
                {format.label}
              </span>
              {isSelected && (
                <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-current" />
              )}
            </button>
          );
        })}
      </div>
      {value && (
        <p className="text-xs text-zinc-500 mt-2">
          {INTERVIEW_FORMATS.find(f => f.value === value)?.description}
        </p>
      )}
    </div>
  );
}
