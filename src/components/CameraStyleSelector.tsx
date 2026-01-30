import type { CameraStyle } from '../lib/types';
import { CAMERA_STYLES } from '../lib/constants';
import { Video, RotateCw, Focus, Maximize, Move } from 'lucide-react';

interface CameraStyleSelectorProps {
  value: CameraStyle;
  onChange: (value: CameraStyle) => void;
  disabled?: boolean;
}

const CAMERA_ICONS: Record<CameraStyle, typeof Video> = {
  dramatic_push: Video,
  slow_orbit: RotateCw,
  tight_closeup: Focus,
  wide_epic: Maximize,
  handheld_raw: Move,
};

export function CameraStyleSelector({ value, onChange, disabled }: CameraStyleSelectorProps) {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-zinc-300">
        Camera Movement
      </label>
      <div className="flex flex-wrap gap-2">
        {CAMERA_STYLES.map((camera) => {
          const isSelected = value === camera.value;
          const Icon = CAMERA_ICONS[camera.value];

          return (
            <button
              key={camera.value}
              type="button"
              onClick={() => onChange(camera.value)}
              disabled={disabled}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                isSelected
                  ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-400'
                  : 'bg-zinc-800/50 border-zinc-700 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Icon className="h-4 w-4" />
              <span className="text-sm font-medium">{camera.label}</span>
            </button>
          );
        })}
      </div>
      {value && (
        <p className="text-xs text-zinc-500">
          {CAMERA_STYLES.find(c => c.value === value)?.description}
        </p>
      )}
    </div>
  );
}
