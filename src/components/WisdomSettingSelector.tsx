import { clsx } from '../lib/format';
import type { WisdomSetting } from '../lib/types';
import { getWisdomSettingOptions } from '../lib/wisdomPromptEngine';

interface WisdomSettingSelectorProps {
  value: WisdomSetting;
  onChange: (setting: WisdomSetting) => void;
  disabled?: boolean;
}

const SETTING_ICONS: Record<string, string> = {
  park_bench: 'bg-emerald-500/20 border-emerald-500/30',
  coffee_shop: 'bg-amber-500/20 border-amber-500/30',
  living_room: 'bg-rose-500/20 border-rose-500/30',
  library: 'bg-blue-500/20 border-blue-500/30',
  main_street: 'bg-orange-500/20 border-orange-500/30',
  subway_platform: 'bg-zinc-500/20 border-zinc-500/30',
  community_center: 'bg-teal-500/20 border-teal-500/30',
};

export function WisdomSettingSelector({ value, onChange, disabled }: WisdomSettingSelectorProps) {
  const options = getWisdomSettingOptions();

  return (
    <div>
      <label className="block text-sm font-medium text-zinc-300 mb-3">
        Setting
      </label>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const isActive = value === option.value;
          const colorClass = SETTING_ICONS[option.value] || 'bg-zinc-500/20 border-zinc-500/30';
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={clsx(
                'rounded-xl border p-3 text-left transition-all duration-200',
                isActive
                  ? 'border-amber-500/50 bg-amber-500/10 ring-1 ring-amber-500/20'
                  : `border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 hover:border-zinc-700`,
                disabled && 'opacity-60 cursor-not-allowed'
              )}
            >
              <div className="flex items-center gap-2">
                <div className={clsx('w-2 h-2 rounded-full border', colorClass)} />
                <span className={clsx(
                  'text-sm font-semibold',
                  isActive ? 'text-amber-400' : 'text-zinc-200'
                )}>
                  {option.label}
                </span>
              </div>
              <div className="mt-1 text-xs text-zinc-500 pl-4">{option.description}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
