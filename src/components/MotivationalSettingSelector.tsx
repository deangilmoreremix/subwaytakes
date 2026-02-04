import type { MotivationalSetting } from '../lib/types';
import { MOTIVATIONAL_SETTINGS } from '../lib/constants';

interface MotivationalSettingSelectorProps {
  value: MotivationalSetting;
  onChange: (value: MotivationalSetting) => void;
  disabled?: boolean;
}

const SETTING_ICONS: Record<MotivationalSetting, string> = {
  gym: 'Gym',
  stage: 'Stage',
  outdoor: 'Outdoor',
  studio: 'Studio',
  urban_rooftop: 'Rooftop',
  office: 'Office',
  locker_room: 'Locker',
};

export function MotivationalSettingSelector({ value, onChange, disabled }: MotivationalSettingSelectorProps) {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-zinc-300">
        Visual Setting
      </label>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {MOTIVATIONAL_SETTINGS.map((setting) => {
          const isSelected = value === setting.value;

          return (
            <button
              key={setting.value}
              type="button"
              onClick={() => onChange(setting.value)}
              disabled={disabled}
              aria-label={`Select ${SETTING_ICONS[setting.value]} as motivational setting`}
              aria-pressed={isSelected}
              className={`px-3 py-2.5 rounded-lg border transition-all text-center ${
                isSelected
                  ? 'bg-amber-500/15 border-amber-500/50 text-amber-400'
                  : 'bg-zinc-800/50 border-zinc-700 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span className="text-sm font-medium">{SETTING_ICONS[setting.value]}</span>
            </button>
          );
        })}
      </div>
      {value && (
        <p className="text-xs text-zinc-500">
          {MOTIVATIONAL_SETTINGS.find(s => s.value === value)?.description}
        </p>
      )}
    </div>
  );
}
