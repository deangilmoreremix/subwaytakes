import { TrainFront, Clock, Users, Moon, Footprints, DoorOpen } from 'lucide-react';
import type { SubwaySceneType } from '../lib/types';
import { SUBWAY_SCENES } from '../lib/constants';

interface SceneTypeSelectorProps {
  value: SubwaySceneType | null;
  onChange: (value: SubwaySceneType) => void;
  disabled?: boolean;
}

const SCENE_ICONS: Record<SubwaySceneType, typeof TrainFront> = {
  platform_waiting: Clock,
  inside_train: TrainFront,
  train_arriving: DoorOpen,
  rush_hour: Users,
  late_night: Moon,
  walking_through: Footprints,
};

export function SceneTypeSelector({ value, onChange, disabled }: SceneTypeSelectorProps) {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-zinc-300">
        Scene Type
      </label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {SUBWAY_SCENES.map((scene) => {
          const Icon = SCENE_ICONS[scene.value];
          const isSelected = value === scene.value;

          return (
            <button
              key={scene.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(scene.value)}
              className={`flex flex-col items-start gap-1 p-3 rounded-lg border transition-all text-left ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${
                isSelected
                  ? 'bg-amber-500/15 border-amber-500/50 ring-1 ring-amber-500/30'
                  : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${isSelected ? 'text-amber-400' : 'text-zinc-400'}`} />
                <span className={`text-sm font-medium ${isSelected ? 'text-amber-400' : 'text-white'}`}>
                  {scene.label}
                </span>
              </div>
              <span className="text-xs text-zinc-500 line-clamp-1">
                {scene.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
