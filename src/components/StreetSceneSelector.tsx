import type { StreetScene } from '../lib/types';
import { STREET_SCENES } from '../lib/constants';

interface StreetSceneSelectorProps {
  value: StreetScene;
  onChange: (value: StreetScene) => void;
  disabled?: boolean;
}

export function StreetSceneSelector({ value, onChange, disabled }: StreetSceneSelectorProps) {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-zinc-300">
        Street Scene
      </label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {STREET_SCENES.map((scene) => {
          const isSelected = value === scene.value;

          return (
            <button
              key={scene.value}
              type="button"
              onClick={() => onChange(scene.value)}
              disabled={disabled}
              className={`px-3 py-2.5 rounded-lg border transition-all text-left ${
                isSelected
                  ? 'bg-emerald-500/15 border-emerald-500/50'
                  : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span className={`text-sm font-medium ${isSelected ? 'text-emerald-400' : 'text-zinc-200'}`}>
                {scene.label}
              </span>
            </button>
          );
        })}
      </div>
      {value && (
        <p className="text-xs text-zinc-500">
          {STREET_SCENES.find(s => s.value === value)?.description}
        </p>
      )}
    </div>
  );
}
