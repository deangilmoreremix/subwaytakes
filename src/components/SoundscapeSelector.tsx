import { useState } from 'react';
import { Volume2, Music, TrainFront, Megaphone, Footprints, MessageCircle, Ticket, Bell } from 'lucide-react';
import type { SoundscapeConfig, AmbientSound } from '../lib/types';
import { AMBIENT_SOUNDS } from '../lib/constants';

interface SoundscapeSelectorProps {
  value: SoundscapeConfig | undefined;
  onChange: (config: SoundscapeConfig | undefined) => void;
  disabled?: boolean;
}

const SOUND_ICONS: Record<AmbientSound, typeof Volume2> = {
  train_rumble: TrainFront,
  announcements: Megaphone,
  footsteps: Footprints,
  conversations: MessageCircle,
  turnstiles: Ticket,
  platform_buzzer: Bell,
};

const MUSIC_MOODS = [
  { value: 'none', label: 'No Music', description: 'Ambient sounds only' },
  { value: 'tense', label: 'Tense', description: 'Building suspense, dramatic' },
  { value: 'curious', label: 'Curious', description: 'Inquisitive, engaging' },
  { value: 'light', label: 'Light', description: 'Upbeat, casual vibe' },
  { value: 'dramatic', label: 'Dramatic', description: 'Intense, cinematic' },
] as const;

export function SoundscapeSelector({ value, onChange, disabled }: SoundscapeSelectorProps) {
  const [isEnabled, setIsEnabled] = useState(value?.enabled ?? false);
  const [layers, setLayers] = useState<SoundscapeConfig['layers']>(value?.layers ?? []);
  const [musicMood, setMusicMood] = useState<SoundscapeConfig['musicMood']>(value?.musicMood ?? 'none');

  const enabled = isEnabled && !disabled;

  function toggleEnabled() {
    const newEnabled = !isEnabled;
    setIsEnabled(newEnabled);
    if (newEnabled) {
      onChange({
        enabled: true,
        layers: layers.length > 0 ? layers : [{ sound: 'train_rumble', intensity: 'present', timing: 'continuous' }],
        musicMood,
      });
    } else {
      onChange(undefined);
    }
  }

  function toggleSound(sound: AmbientSound) {
    const existing = layers.find(l => l.sound === sound);
    let newLayers: SoundscapeConfig['layers'];
    
    if (existing) {
      newLayers = layers.filter(l => l.sound !== sound);
    } else {
      newLayers = [...layers, { sound, intensity: 'present', timing: 'continuous' }];
    }
    
    setLayers(newLayers);
    onChange({ enabled: true, layers: newLayers, musicMood });
  }

  function updateLayer(sound: AmbientSound, updates: Partial<SoundscapeConfig['layers'][0]>) {
    const newLayers = layers.map(l => 
      l.sound === sound ? { ...l, ...updates } : l
    );
    setLayers(newLayers);
    onChange({ enabled: true, layers: newLayers, musicMood });
  }

  function updateMusicMood(mood: SoundscapeConfig['musicMood']) {
    setMusicMood(mood);
    onChange({ enabled: true, layers, musicMood: mood });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
              type="button"
              onClick={toggleEnabled}
              disabled={disabled}
              aria-label="Enable soundscape designer"
              aria-pressed={isEnabled}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                isEnabled ? 'bg-amber-500' : 'bg-zinc-700'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                isEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
          <div>
            <span className="text-sm font-medium text-zinc-200">Soundscape Designer</span>
            <p className="text-xs text-zinc-500">Dynamic audio layers and ambient sounds</p>
          </div>
        </div>
      </div>

      {enabled && (
        <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          {/* Ambient Sound Layers */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Ambient Sounds</label>
            <div className="grid grid-cols-2 gap-2">
              {AMBIENT_SOUNDS.map((sound) => {
                const Icon = SOUND_ICONS[sound.value];
                const isSelected = layers.some(l => l.sound === sound.value);
                const layer = layers.find(l => l.sound === sound.value);

                return (
                  <div
                    key={sound.value}
                    className={`rounded-lg border p-2 transition-all ${
                      isSelected
                        ? 'border-amber-500/50 bg-amber-500/10'
                        : 'border-zinc-700 bg-zinc-800/30 hover:border-zinc-600'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSound(sound.value)}
                      className="flex items-center gap-2 w-full"
                    >
                      <Icon className={`h-4 w-4 ${isSelected ? 'text-amber-400' : 'text-zinc-500'}`} />
                      <span className={`text-xs ${isSelected ? 'text-amber-200' : 'text-zinc-400'}`}>
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
                                ? 'bg-amber-500/30 text-amber-300'
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

          {/* Music Mood */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Music Mood</label>
            <div className="flex flex-wrap gap-2">
              {MUSIC_MOODS.map((mood) => (
                <button
                  key={mood.value}
                  type="button"
                  onClick={() => updateMusicMood(mood.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-all ${
                    musicMood === mood.value
                      ? 'bg-amber-500/15 border-amber-500/50 text-amber-400'
                      : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                  }`}
                >
                  {mood.value !== 'none' && <Music className="h-3 w-3" />}
                  <span>{mood.label}</span>
                </button>
              ))}
            </div>
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
                  {layers.map(l => AMBIENT_SOUNDS.find(s => s.value === l.sound)?.label).join(', ')}
                </>
              )}
              {musicMood !== 'none' && (
                <>
                  <span className="text-zinc-400 ml-2">• Music: </span>
                  {MUSIC_MOODS.find(m => m.value === musicMood)?.label}
                </>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
