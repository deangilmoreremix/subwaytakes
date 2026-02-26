import { useState } from 'react';
import { Camera, Volume2, Zap } from 'lucide-react';
import type { PauseForEffectConfig } from '../lib/types';

interface PauseForEffectProps {
  value: PauseForEffectConfig | undefined;
  onChange: (config: PauseForEffectConfig | undefined) => void;
  disabled?: boolean;
  maxDuration?: number;
}

const CAMERA_ACTIONS: { value: PauseForEffectConfig['cameraAction']; label: string; description: string }[] = [
  { value: 'zoom_in', label: 'Zoom In', description: 'Gradual push into speaker\'s face' },
  { value: 'hold_static', label: 'Hold Static', description: 'Fixed frame, let the moment breathe' },
  { value: 'slow_push', label: 'Slow Push', description: 'Gentle camera movement forward' },
  { value: 'cut_wide', label: 'Cut Wide', description: 'Sudden wide shot for perspective' },
];

const MUSIC_ACTIONS: { value: PauseForEffectConfig['musicAction']; label: string; description: string }[] = [
  { value: 'drop', label: 'Drop Out', description: 'Music cuts to silence' },
  { value: 'fade', label: 'Fade Down', description: 'Music gradually lowers' },
  { value: 'continue', label: 'Continue', description: 'Music keeps playing' },
  { value: 'swell', label: 'Swell Up', description: 'Music builds to crescendo' },
];

export function PauseForEffect({ value, onChange, disabled, maxDuration = 60 }: PauseForEffectProps) {
  const [isEnabled, setIsEnabled] = useState(value?.enabled ?? false);
  const [timing, setTiming] = useState(value?.timing ?? Math.floor(maxDuration * 0.6));
  const [duration, setDuration] = useState(value?.duration ?? 3);
  const [cameraAction, setCameraAction] = useState<PauseForEffectConfig['cameraAction']>(value?.cameraAction ?? 'zoom_in');
  const [musicAction, setMusicAction] = useState<PauseForEffectConfig['musicAction']>(value?.musicAction ?? 'drop');

  const enabled = isEnabled && !disabled;

  function toggleEnabled() {
    const newEnabled = !isEnabled;
    setIsEnabled(newEnabled);
    if (newEnabled) {
      onChange({
        enabled: true,
        timing,
        duration,
        cameraAction,
        musicAction,
      });
    } else {
      onChange(undefined);
    }
  }

  function updateTiming(newTiming: number) {
    setTiming(newTiming);
    onChange({ enabled: true, timing: newTiming, duration, cameraAction, musicAction });
  }

  function updateDuration(newDuration: number) {
    setDuration(newDuration);
    onChange({ enabled: true, timing, duration: newDuration, cameraAction, musicAction });
  }

  function updateCameraAction(action: PauseForEffectConfig['cameraAction']) {
    setCameraAction(action);
    onChange({ enabled: true, timing, duration, cameraAction: action, musicAction });
  }

  function updateMusicAction(action: PauseForEffectConfig['musicAction']) {
    setMusicAction(action);
    onChange({ enabled: true, timing, duration, cameraAction, musicAction: action });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
              type="button"
              onClick={toggleEnabled}
              disabled={disabled}
              aria-label="Enable pause for effect"
              aria-pressed={isEnabled}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                isEnabled ? 'bg-red-500' : 'bg-zinc-700'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                isEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
          <div>
            <span className="text-sm font-medium text-zinc-200">Pause for Effect</span>
            <p className="text-xs text-zinc-500">Strategic silence timing, camera zooms, music drops</p>
          </div>
        </div>
      </div>

      {enabled && (
        <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          {/* Timing */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-400">Timing</label>
              <span className="text-xs text-zinc-500">{timing}s into clip</span>
            </div>
            <input
              type="range"
              min={Math.floor(maxDuration * 0.2)}
              max={Math.floor(maxDuration * 0.8)}
              value={timing}
              onChange={(e) => updateTiming(parseInt(e.target.value))}
              className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-red-500"
            />
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-400">Pause Duration</label>
              <span className="text-xs text-zinc-500">{duration} seconds</span>
            </div>
            <input
              type="range"
              min={1}
              max={8}
              step={0.5}
              value={duration}
              onChange={(e) => updateDuration(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-red-500"
            />
            <div className="flex justify-between text-[10px] text-zinc-600">
              <span>1s</span>
              <span>4s</span>
              <span>8s</span>
            </div>
          </div>

          {/* Camera Action */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Camera Action</label>
            <div className="grid grid-cols-2 gap-2">
              {CAMERA_ACTIONS.map((action) => (
                <button
                  key={action.value}
                  type="button"
                  onClick={() => updateCameraAction(action.value)}
                  className={`flex items-start gap-2 p-2 rounded-lg border text-left transition-all ${
                    cameraAction === action.value
                      ? 'bg-red-500/15 border-red-500/50'
                      : 'border-zinc-700 bg-zinc-800/30 hover:border-zinc-600'
                  }`}
                >
                  <Camera className={`h-3.5 w-3.5 mt-0.5 ${cameraAction === action.value ? 'text-red-400' : 'text-zinc-500'}`} />
                  <div>
                    <span className={`text-xs font-medium block ${cameraAction === action.value ? 'text-red-200' : 'text-zinc-300'}`}>
                      {action.label}
                    </span>
                    <span className="text-[10px] text-zinc-500">{action.description}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Music Action */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Music Action</label>
            <div className="grid grid-cols-2 gap-2">
              {MUSIC_ACTIONS.map((action) => (
                <button
                  key={action.value}
                  type="button"
                  onClick={() => updateMusicAction(action.value)}
                  className={`flex items-start gap-2 p-2 rounded-lg border text-left transition-all ${
                    musicAction === action.value
                      ? 'bg-red-500/15 border-red-500/50'
                      : 'border-zinc-700 bg-zinc-800/30 hover:border-zinc-600'
                  }`}
                >
                  <Volume2 className={`h-3.5 w-3.5 mt-0.5 ${musicAction === action.value ? 'text-red-400' : 'text-zinc-500'}`} />
                  <div>
                    <span className={`text-xs font-medium block ${musicAction === action.value ? 'text-red-200' : 'text-zinc-300'}`}>
                      {action.label}
                    </span>
                    <span className="text-[10px] text-zinc-500">{action.description}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 space-y-1">
            <div className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-red-400" />
              <span className="text-xs font-medium text-red-400">Pause Preview</span>
            </div>
            <p className="text-xs text-zinc-400">
              At {timing}s: {duration}s pause with {CAMERA_ACTIONS.find(a => a.value === cameraAction)?.label.toLowerCase()} and {MUSIC_ACTIONS.find(a => a.value === musicAction)?.label.toLowerCase()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
