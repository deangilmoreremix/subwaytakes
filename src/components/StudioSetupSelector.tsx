import type { StudioSetup } from '../lib/types';
import { STUDIO_SETUPS } from '../lib/constants';
import { clsx } from '../lib/format';
import { Armchair, Sofa, Sparkles, Tv, Users, Flame, Newspaper, Palette } from 'lucide-react';

interface StudioSetupSelectorProps {
  value: StudioSetup;
  onChange: (setup: StudioSetup) => void;
  disabled?: boolean;
}

const ICONS: Record<StudioSetup, React.ReactNode> = {
  podcast_desk: <Armchair className="h-5 w-5" />,
  living_room: <Sofa className="h-5 w-5" />,
  minimalist_stage: <Sparkles className="h-5 w-5" />,
  late_night: <Tv className="h-5 w-5" />,
  roundtable: <Users className="h-5 w-5" />,
  fireside: <Flame className="h-5 w-5" />,
  news_desk: <Newspaper className="h-5 w-5" />,
  creative_loft: <Palette className="h-5 w-5" />,
};

export function StudioSetupSelector({ value, onChange, disabled }: StudioSetupSelectorProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-300 mb-3">
        Studio Setup
      </label>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STUDIO_SETUPS.map((setup) => {
          const isActive = value === setup.value;

          return (
            <button
              key={setup.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(setup.value)}
              className={clsx(
                'relative rounded-xl border p-3 text-left transition-all duration-200',
                isActive
                  ? 'border-violet-500/50 bg-violet-500/10 ring-1 ring-violet-500/20'
                  : 'border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 hover:border-zinc-700',
                disabled && 'opacity-60 cursor-not-allowed'
              )}
            >
              <div className={clsx(
                'mb-2',
                isActive ? 'text-violet-400' : 'text-zinc-400'
              )}>
                {ICONS[setup.value]}
              </div>
              <div className="text-sm font-medium text-zinc-100">{setup.label}</div>
              <div className="mt-1 text-xs text-zinc-500 line-clamp-2">{setup.description}</div>
              {isActive && (
                <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-violet-400" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
