import { useState } from 'react';
import { Drama, CloudRain, Sun, TrainFront, DoorOpen, Zap, Users } from 'lucide-react';
import type { StreetDramaticMoment, StreetDramaticMomentType } from '../lib/types';

interface StreetDramaticMomentProps {
  value: StreetDramaticMoment | undefined;
  onChange: (moment: StreetDramaticMoment | undefined) => void;
  disabled?: boolean;
  maxDuration?: number;
}

const MOMENT_TYPES: { value: StreetDramaticMomentType; label: string; emoji: string; description: string }[] = [
  { value: 'rain_starts', label: 'Rain Starts', emoji: '🌧️', description: 'Sudden downpour changes the scene' },
  { value: 'sun_bursts', label: 'Sun Bursts', emoji: '☀️', description: 'Clouds part, golden light emerges' },
  { value: 'train_passes_overhead', label: 'Train Overhead', emoji: '🚇', description: 'Elevated train rumbles past' },
  { value: 'door_reveals', label: 'Door Reveals', emoji: '🚪', description: 'Someone emerges from doorway dramatically' },
  { value: 'light_changes', label: 'Light Changes', emoji: '💡', description: 'Street lights flicker on at dusk' },
  { value: 'crowd_gathers', label: 'Crowd Gathers', emoji: '👥', description: 'People stop to watch the interview' },
];

const MOMENT_ICONS: Record<StreetDramaticMomentType, typeof Drama> = {
  rain_starts: CloudRain,
  sun_bursts: Sun,
  train_passes_overhead: TrainFront,
  door_reveals: DoorOpen,
  light_changes: Zap,
  crowd_gathers: Users,
};

export function StreetDramaticMoment({ value, onChange, disabled, maxDuration = 60 }: StreetDramaticMomentProps) {
  const [isEnabled, setIsEnabled] = useState(value?.enabled ?? false);
  const [momentType, setMomentType] = useState<StreetDramaticMomentType>(value?.momentType ?? 'rain_starts');
  const [timing, setTiming] = useState(value?.timing ?? Math.floor(maxDuration * 0.5));
  const [description, setDescription] = useState(value?.description ?? '');
  const [effect, setEffect] = useState<StreetDramaticMoment['effect']>(value?.effect ?? 'both');

  const enabled = isEnabled && !disabled;

  function toggleEnabled() {
    const newEnabled = !isEnabled;
    setIsEnabled(newEnabled);
    if (newEnabled) {
      onChange({
        enabled: true,
        momentType,
        timing,
        description: description || getDefaultDescription(momentType),
        effect,
      });
    } else {
      onChange(undefined);
    }
  }

  function updateMomentType(type: StreetDramaticMomentType) {
    setMomentType(type);
    onChange({
      enabled: true,
      momentType: type,
      timing,
      description: description || getDefaultDescription(type),
      effect,
    });
  }

  function updateTiming(newTiming: number) {
    setTiming(newTiming);
    onChange({ enabled: true, momentType, timing: newTiming, description, effect });
  }

  function updateEffect(newEffect: StreetDramaticMoment['effect']) {
    setEffect(newEffect);
    onChange({ enabled: true, momentType, timing, description, effect: newEffect });
  }

  function updateDescription(newDescription: string) {
    setDescription(newDescription);
    onChange({ enabled: true, momentType, timing, description: newDescription, effect });
  }

  function getDefaultDescription(type: StreetDramaticMomentType): string {
    const defaults: Record<StreetDramaticMomentType, string> = {
      rain_starts: 'Sudden rain begins, people scramble for cover',
      sun_bursts: 'Clouds part and golden sunlight floods the scene',
      train_passes_overhead: 'Elevated train rumbles past, creating urban soundtrack',
      door_reveals: 'Door swings open revealing unexpected backdrop',
      light_changes: 'Street lights flicker on as evening approaches',
      crowd_gathers: 'Small crowd gathers to watch the interview unfold',
    };
    return defaults[type];
  }

  const Icon = MOMENT_ICONS[momentType];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
              type="button"
              onClick={toggleEnabled}
              disabled={disabled}
              aria-label="Enable environmental dramatic moments"
              aria-pressed={isEnabled}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                isEnabled ? 'bg-emerald-500' : 'bg-zinc-700'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  isEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          <div>
            <span className="text-sm font-medium text-zinc-200">Environmental Dramatic Moments</span>
            <p className="text-xs text-zinc-500">Rain starts, sun bursts, train passes</p>
          </div>
        </div>
      </div>

      {enabled && (
        <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          {/* Moment Type Selection */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Dramatic Moment</label>
            <div className="grid grid-cols-2 gap-2">
              {MOMENT_TYPES.map((type) => {
                const TypeIcon = MOMENT_ICONS[type.value];
                const isSelected = momentType === type.value;

                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => updateMomentType(type.value)}
                    className={`flex items-start gap-2 p-2 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'border-emerald-500/50 bg-emerald-500/10'
                        : 'border-zinc-700 bg-zinc-800/30 hover:border-zinc-600'
                    }`}
                  >
                    <TypeIcon className={`h-4 w-4 mt-0.5 ${isSelected ? 'text-emerald-400' : 'text-zinc-500'}`} />
                    <div>
                      <span className={`text-xs font-medium block ${isSelected ? 'text-emerald-200' : 'text-zinc-300'}`}>
                        {type.label}
                      </span>
                      <span className="text-[10px] text-zinc-500">{type.description}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Effect Type */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Effect Type</label>
            <div className="flex gap-2">
              {(['visual', 'audio', 'both'] as const).map((eff) => (
                <button
                  key={eff}
                  type="button"
                  onClick={() => updateEffect(eff)}
                  className={`flex-1 px-3 py-1.5 rounded-lg border text-xs transition-all ${
                    effect === eff
                      ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400'
                      : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                  }`}
                >
                  {eff.charAt(0).toUpperCase() + eff.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Timing Slider */}
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
              className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <div className="flex justify-between text-[10px] text-zinc-600">
              <span>Early</span>
              <span>Mid</span>
              <span>Late</span>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Description</label>
            <textarea
              value={description}
              onChange={(e) => updateDescription(e.target.value)}
              placeholder={getDefaultDescription(momentType)}
              rows={2}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:border-emerald-500/50 focus:outline-none resize-none"
            />
          </div>

          {/* Preview */}
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 space-y-1">
            <div className="flex items-center gap-2">
              <Icon className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-xs font-medium text-emerald-400">Moment Preview</span>
            </div>
            <p className="text-xs text-zinc-400">
              At {timing}s: {description || getDefaultDescription(momentType)}
            </p>
            <p className="text-xs text-zinc-500">
              Effect: {effect} • Type: {momentType.replace('_', ' ')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
