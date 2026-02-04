import type { InterviewMode } from '../lib/types';
import { INTERVIEW_MODES } from '../lib/constants';
import { clsx } from '../lib/format';

interface InterviewModeSelectorProps {
  value: InterviewMode;
  onChange: (mode: InterviewMode) => void;
  disabled?: boolean;
}

export function InterviewModeSelector({ value, onChange, disabled }: InterviewModeSelectorProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-300 mb-3">
        Interview Mode
        <span className="ml-2 text-xs text-zinc-500 font-normal">Choose a viral format</span>
      </label>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {INTERVIEW_MODES.map((mode) => {
          const isActive = value === mode.value;
          const isNone = mode.value === 'none';

          return (
            <button
              key={mode.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(mode.value)}
              className={clsx(
                'relative rounded-xl border p-3 text-left transition-all duration-200',
                isActive
                  ? 'border-pink-500/50 bg-pink-500/10 ring-1 ring-pink-500/20'
                  : 'border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 hover:border-zinc-700',
                isNone && !isActive && 'border-zinc-700/50',
                disabled && 'opacity-60 cursor-not-allowed'
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{mode.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className={clsx(
                    'text-sm font-medium truncate',
                    isActive ? 'text-pink-400' : 'text-zinc-100'
                  )}>
                    {mode.label}
                  </div>
                </div>
              </div>
              <div className="mt-1 text-xs text-zinc-500 line-clamp-2">{mode.description}</div>
              {isActive && (
                <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-pink-400" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
