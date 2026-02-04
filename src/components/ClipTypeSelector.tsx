import { Sparkles, Users, Train, Video, Heart } from 'lucide-react';
import type { ClipType } from '../lib/types';
import { CLIP_TYPE_INFO } from '../lib/constants';
import { clsx } from '../lib/format';

interface ClipTypeSelectorProps {
  value: ClipType;
  onChange: (type: ClipType) => void;
  disabled?: boolean;
}

const ICONS: Record<ClipType, React.ReactNode> = {
  motivational: <Sparkles className="h-5 w-5" />,
  street_interview: <Users className="h-5 w-5" />,
  subway_interview: <Train className="h-5 w-5" />,
  studio_interview: <Video className="h-5 w-5" />,
  wisdom_interview: <Heart className="h-5 w-5" />,
};

export function ClipTypeSelector({ value, onChange, disabled }: ClipTypeSelectorProps) {
  const types: ClipType[] = ['motivational', 'street_interview', 'subway_interview', 'studio_interview', 'wisdom_interview'];

  return (
    <div>
      <label className="block text-sm font-medium text-zinc-300 mb-3">
        Clip Type
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {types.map((type) => {
          const info = CLIP_TYPE_INFO[type];
          const isActive = value === type;

          return (
            <button
              key={type}
              type="button"
              disabled={disabled}
              onClick={() => onChange(type)}
              className={clsx(
                'relative rounded-2xl border p-4 text-left transition-all duration-200',
                isActive
                  ? 'border-emerald-500/50 bg-emerald-500/10 ring-1 ring-emerald-500/20'
                  : 'border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 hover:border-zinc-700',
                disabled && 'opacity-60 cursor-not-allowed'
              )}
            >
              <div className={clsx(
                'mb-2',
                isActive ? 'text-emerald-400' : 'text-zinc-400'
              )}>
                {ICONS[type]}
              </div>
              <div className="text-sm font-semibold text-zinc-100">{info.title}</div>
              <div className="mt-1 text-xs text-zinc-500">{info.subtitle}</div>
              {isActive && (
                <div className="absolute top-3 right-3 h-2 w-2 rounded-full bg-emerald-400" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
