import type { TimeOfDay } from '../lib/types';
import { TIME_OF_DAY_OPTIONS } from '../lib/constants';
import { Sunrise, Sun, Sunset, CloudMoon, Moon } from 'lucide-react';

interface TimeOfDaySelectorProps {
  value: TimeOfDay;
  onChange: (value: TimeOfDay) => void;
  disabled?: boolean;
}

const TIME_ICONS: Record<TimeOfDay, typeof Sun> = {
  morning: Sunrise,
  midday: Sun,
  golden_hour: Sunset,
  dusk: CloudMoon,
  night: Moon,
};

const TIME_COLORS: Record<TimeOfDay, { bg: string; border: string; text: string }> = {
  morning: { bg: 'bg-sky-500/15', border: 'border-sky-500/50', text: 'text-sky-400' },
  midday: { bg: 'bg-yellow-500/15', border: 'border-yellow-500/50', text: 'text-yellow-400' },
  golden_hour: { bg: 'bg-amber-500/15', border: 'border-amber-500/50', text: 'text-amber-400' },
  dusk: { bg: 'bg-rose-500/15', border: 'border-rose-500/50', text: 'text-rose-400' },
  night: { bg: 'bg-slate-500/15', border: 'border-slate-500/50', text: 'text-slate-300' },
};

export function TimeOfDaySelector({ value, onChange, disabled }: TimeOfDaySelectorProps) {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-zinc-300">
        Time of Day
      </label>
      <div className="flex flex-wrap gap-2">
        {TIME_OF_DAY_OPTIONS.map((time) => {
          const isSelected = value === time.value;
          const Icon = TIME_ICONS[time.value];
          const colors = TIME_COLORS[time.value];

          return (
            <button
              key={time.value}
              type="button"
              onClick={() => onChange(time.value)}
              disabled={disabled}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                isSelected
                  ? `${colors.bg} ${colors.border} ${colors.text}`
                  : 'bg-zinc-800/50 border-zinc-700 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Icon className="h-4 w-4" />
              <span className="text-sm font-medium">{time.label}</span>
            </button>
          );
        })}
      </div>
      {value && (
        <p className="text-xs text-zinc-500">
          {TIME_OF_DAY_OPTIONS.find(t => t.value === value)?.description}
        </p>
      )}
    </div>
  );
}
