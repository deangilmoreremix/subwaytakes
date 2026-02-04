import type { StudioLighting } from '../lib/types';
import { STUDIO_LIGHTING } from '../lib/constants';
import { clsx } from '../lib/format';
import { Sun, Moon, Cloud, Palette, Square, Sparkles } from 'lucide-react';

interface StudioLightingSelectorProps {
  value: StudioLighting;
  onChange: (lighting: StudioLighting) => void;
  disabled?: boolean;
}

const ICONS: Record<StudioLighting, React.ReactNode> = {
  three_point: <Sun className="h-5 w-5" />,
  dramatic_key: <Moon className="h-5 w-5" />,
  soft_diffused: <Cloud className="h-5 w-5" />,
  colored_accent: <Palette className="h-5 w-5" />,
  natural_window: <Square className="h-5 w-5" />,
  cinematic: <Sparkles className="h-5 w-5" />,
};

export function StudioLightingSelector({ value, onChange, disabled }: StudioLightingSelectorProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-300 mb-3">
        Studio Lighting
      </label>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {STUDIO_LIGHTING.map((lighting) => {
          const isActive = value === lighting.value;

          return (
            <button
              key={lighting.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(lighting.value)}
              className={clsx(
                'relative rounded-xl border p-3 text-left transition-all duration-200',
                isActive
                  ? 'border-amber-500/50 bg-amber-500/10 ring-1 ring-amber-500/20'
                  : 'border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 hover:border-zinc-700',
                disabled && 'opacity-60 cursor-not-allowed'
              )}
            >
              <div className={clsx(
                'mb-2',
                isActive ? 'text-amber-400' : 'text-zinc-400'
              )}>
                {ICONS[lighting.value]}
              </div>
              <div className="text-sm font-medium text-zinc-100">{lighting.label}</div>
              <div className="mt-1 text-xs text-zinc-500">{lighting.description}</div>
              {isActive && (
                <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-amber-400" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
