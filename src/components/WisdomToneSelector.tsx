import { clsx } from '../lib/format';
import type { WisdomTone } from '../lib/types';

interface WisdomToneSelectorProps {
  value: WisdomTone;
  onChange: (tone: WisdomTone) => void;
  disabled?: boolean;
}

const TONES: { value: WisdomTone; label: string; description: string }[] = [
  { value: 'gentle', label: 'Gentle', description: 'Warm, patient, supportive' },
  { value: 'direct', label: 'Direct', description: 'No-nonsense, straightforward' },
  { value: 'funny', label: 'Funny', description: 'Dry wit, clever humor' },
  { value: 'heartfelt', label: 'Heartfelt', description: 'Emotional, genuine, moving' },
];

export function WisdomToneSelector({ value, onChange, disabled }: WisdomToneSelectorProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-300 mb-3">
        Tone
      </label>
      <div className="grid grid-cols-2 gap-3">
        {TONES.map((tone) => {
          const isActive = value === tone.value;
          return (
            <button
              key={tone.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(tone.value)}
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
                {tone.label}
              </div>
              <div className="mt-1 text-xs text-zinc-500">{tone.description}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
