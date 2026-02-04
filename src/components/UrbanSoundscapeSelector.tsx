import { useState } from 'react';
import { Volume2, Car, HardHat, Music, Siren, Footprints, CloudRain } from 'lucide-react';
import type { UrbanSoundscapeConfig, UrbanAmbientSound } from '../lib/types';
import { URBAN_AMBIENT_SOUNDS } from '../lib/constants';

interface UrbanSoundscapeSelectorProps {
  value: UrbanSoundscapeConfig | undefined;
  onChange: (config: UrbanSoundscapeConfig | undefined) => void;
  disabled?: boolean;
}

const SOUND_ICONS: Record<UrbanAmbientSound, typeof Volume2> = {
  traffic: Car,
  construction: HardHat,
  street_performer: Music,
  sirens: Siren,
  pedestrians: Footprints,
  weather_audio: CloudRain,
};

export function UrbanSoundscapeSelector({ value, onChange, disabled }: UrbanSoundscapeSelectorProps) {
  const [isEnabled, setIsEnabled] = useState(value?.enabled ?? false);
  const [layers, setLayers] = useState<UrbanSoundscapeConfig['layers']>(value?.layers ?? []);
  const [weatherAudio, setWeatherAudio] = useState(value?.weatherAudio ?? false);

  const enabled = isEnabled && !disabled;

  function toggleEnabled() {
    const newEnabled = !isEnabled;
    setIsEnabled(newEnabled);
    if (newEnabled) {
      onChange({
        enabled: true,
        layers: layers.length > 0 ? layers : [{ sound: 'traffic', intensity: 'present', timing: 'continuous' }],
        weatherAudio,
      });
    } else {
      onChange(undefined);
    }
  }

  function toggleSound(sound: UrbanAmbientSound) {
    const existing = layers.find(l => l.sound === sound);
    let newLayers: UrbanSoundscapeConfig['layers'];
    
    if (existing) {
      newLayers = layers.filter(l => l.sound !== sound);
    } else {
      newLayers = [...layers, { sound, intensity: 'present', timing: 'continuous' }];
    }
    
    setLayers(newLayers);
    onChange({ enabled: true, layers: newLayers, weatherAudio });
  }

  function updateLayer(sound: UrbanAmbientSound, updates: Partial<UrbanSoundscapeConfig['layers'][0]>) {
    const newLayers = layers.map(l => 
      l.sound === sound ? { ...l, ...updates } : l
    );
    setLayers(newLayers);
    onChange({ enabled: true, layers: newLayers, weatherAudio });
  }

  function toggleWeatherAudio() {
    const newWeatherAudio = !weatherAudio;
    setWeatherAudio(newWeatherAudio);
    onChange({ enabled: true, layers, weatherAudio: newWeatherAudio });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
              type="button"
              onClick={toggleEnabled}
              disabled={disabled}
              aria-label="Enable urban soundscape"
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
            <span className="text-sm font-medium text-zinc-200">Urban Soundscape</span>
            <p className="text-xs text-zinc-500">Traffic, construction, street performers</p>
          </div>
        </div>
      </div>

      {enabled && (
        <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          {/* Ambient Sound Layers */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Ambient Sounds</label>
            <div className="grid grid-cols-2 gap-2">
              {URBAN_AMBIENT_SOUNDS.map((sound) => {
                const Icon = SOUND_ICONS[sound.value];
                const isSelected = layers.some(l => l.sound === sound.value);
                const layer = layers.find(l => l.sound === sound.value);

                return (
                  <div
                    key={sound.value}
                    className={`rounded-lg border p-2 transition-all ${
                      isSelected
                        ? 'border-emerald-500/50 bg-emerald-500/10'
                        : 'border-zinc-700 bg-zinc-800/30 hover:border-zinc-600'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSound(sound.value)}
                      className="flex items-center gap-2 w-full"
                    >
                      <Icon className={`h-4 w-4 ${isSelected ? 'text-emerald-400' : 'text-zinc-500'}`} />
                      <span className={`text-xs ${isSelected ? 'text-emerald-200' : 'text-zinc-400'}`}>
                        {sound.label}
                      </span>
                    </button>

                    {isSelected && layer && (
                      <div className="mt-2 flex gap-1">
                        {(['faint', 'present', 'prominent'] as const).map((intensity) => (
                          <button
                            key={intensity}
                            type="button"
                            onClick={() => updateLayer(sound.value, { intensity })}
                            className={`flex-1 px-1.5 py-0.5 rounded text-[10px] transition-all ${
                              layer.intensity === intensity
                                ? 'bg-emerald-500/30 text-emerald-300'
                                : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'
                            }`}
                          >
                            {intensity.charAt(0).toUpperCase()}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Weather Audio Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CloudRain className="h-4 w-4 text-zinc-500" />
              <span className="text-xs text-zinc-400">Include weather audio (rain, wind)</span>
            </div>
            <button
              type="button"
              onClick={toggleWeatherAudio}
              className={`relative h-5 w-9 rounded-full transition-colors ${
                weatherAudio ? 'bg-emerald-500' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                  weatherAudio ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Preview */}
          <div className="rounded-lg bg-zinc-800/30 p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <Volume2 className="h-3.5 w-3.5" />
              <span>Audio Preview</span>
            </div>
            <p className="text-xs text-zinc-500">
              {layers.length === 0 && 'No ambient sounds selected'}
              {layers.length > 0 && (
                <>
                  <span className="text-zinc-400">Sounds: </span>
                  {layers.map(l => URBAN_AMBIENT_SOUNDS.find(s => s.value === l.sound)?.label).join(', ')}
                </>
              )}
              {weatherAudio && (
                <span className="text-zinc-400 ml-2">• Weather audio enabled</span>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
