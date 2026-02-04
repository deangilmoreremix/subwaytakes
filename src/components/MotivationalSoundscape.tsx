import { useState } from 'react';
import { Volume2, Music, VolumeX, Users, Plus, Trash2 } from 'lucide-react';
import type { MotivationalSoundscapeConfig, MotivationalMusicType } from '../lib/types';
import { MOTIVATIONAL_MUSIC_TYPES } from '../lib/constants';

interface MotivationalSoundscapeProps {
  value: MotivationalSoundscapeConfig | undefined;
  onChange: (config: MotivationalSoundscapeConfig | undefined) => void;
  disabled?: boolean;
}

const MUSIC_ICONS: Record<MotivationalMusicType, string> = {
  epic_orchestral: '🎻',
  ambient_electronic: '🎹',
  piano_inspirational: '🎼',
  rock_anthem: '🎸',
  minimal: '🔇',
};

export function MotivationalSoundscape({ value, onChange, disabled }: MotivationalSoundscapeProps) {
  const [isEnabled, setIsEnabled] = useState(value?.enabled ?? false);
  const [musicType, setMusicType] = useState<MotivationalMusicType>(value?.musicType ?? 'epic_orchestral');
  const [musicIntensity, setMusicIntensity] = useState<MotivationalSoundscapeConfig['musicIntensity']>(value?.musicIntensity ?? 'building');
  const [silenceMoments, setSilenceMoments] = useState<number[]>(value?.silenceMoments ?? []);
  const [crowdSounds, setCrowdSounds] = useState(value?.crowdSounds ?? true);

  const enabled = isEnabled && !disabled;

  function toggleEnabled() {
    const newEnabled = !isEnabled;
    setIsEnabled(newEnabled);
    if (newEnabled) {
      onChange({
        enabled: true,
        musicType,
        musicIntensity,
        silenceMoments,
        crowdSounds,
      });
    } else {
      onChange(undefined);
    }
  }

  function updateMusicType(type: MotivationalMusicType) {
    setMusicType(type);
    onChange({ enabled: true, musicType: type, musicIntensity, silenceMoments, crowdSounds });
  }

  function updateMusicIntensity(intensity: MotivationalSoundscapeConfig['musicIntensity']) {
    setMusicIntensity(intensity);
    onChange({ enabled: true, musicType, musicIntensity: intensity, silenceMoments, crowdSounds });
  }

  function toggleCrowdSounds() {
    const newValue = !crowdSounds;
    setCrowdSounds(newValue);
    onChange({ enabled: true, musicType, musicIntensity, silenceMoments, crowdSounds: newValue });
  }

  function addSilenceMoment() {
    const newMoments = [...silenceMoments, 15];
    setSilenceMoments(newMoments);
    onChange({ enabled: true, musicType, musicIntensity, silenceMoments: newMoments, crowdSounds });
  }

  function updateSilenceMoment(index: number, value: number) {
    const newMoments = silenceMoments.map((m, i) => i === index ? value : m);
    setSilenceMoments(newMoments);
    onChange({ enabled: true, musicType, musicIntensity, silenceMoments: newMoments, crowdSounds });
  }

  function removeSilenceMoment(index: number) {
    const newMoments = silenceMoments.filter((_, i) => i !== index);
    setSilenceMoments(newMoments);
    onChange({ enabled: true, musicType, musicIntensity, silenceMoments: newMoments, crowdSounds });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
              type="button"
              onClick={toggleEnabled}
              disabled={disabled}
              aria-label="Enable motivational soundscape"
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
            <span className="text-sm font-medium text-zinc-200">Motivational Soundscape</span>
            <p className="text-xs text-zinc-500">Epic music swells, silence moments, crowd murmurs</p>
          </div>
        </div>
      </div>

      {enabled && (
        <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          {/* Music Type */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Music Style</label>
            <div className="grid grid-cols-2 gap-2">
              {MOTIVATIONAL_MUSIC_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => updateMusicType(type.value)}
                  className={`flex items-start gap-2 p-2 rounded-lg border text-left transition-all ${
                    musicType === type.value
                      ? 'border-red-500/50 bg-red-500/10'
                      : 'border-zinc-700 bg-zinc-800/30 hover:border-zinc-600'
                  }`}
                >
                  <span className="text-lg">{type.emoji}</span>
                  <div>
                    <span className={`text-xs font-medium block ${musicType === type.value ? 'text-red-200' : 'text-zinc-300'}`}>
                      {type.label}
                    </span>
                    <span className="text-[10px] text-zinc-500">{type.description}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Music Intensity */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Music Intensity</label>
            <div className="flex gap-2">
              {(['background', 'building', 'peak'] as const).map((intensity) => (
                <button
                  key={intensity}
                  type="button"
                  onClick={() => updateMusicIntensity(intensity)}
                  className={`flex-1 px-3 py-1.5 rounded-lg border text-xs transition-all ${
                    musicIntensity === intensity
                      ? 'bg-red-500/15 border-red-500/50 text-red-400'
                      : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                  }`}
                >
                  {intensity.charAt(0).toUpperCase() + intensity.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Silence Moments */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Strategic Silence Moments</label>
            {silenceMoments.map((moment, index) => (
              <div key={index} className="flex items-center gap-2">
                <VolumeX className="h-3.5 w-3.5 text-zinc-500" />
                <span className="text-xs text-zinc-400">At</span>
                <input
                  type="number"
                  value={moment}
                  onChange={(e) => updateSilenceMoment(index, parseInt(e.target.value) || 0)}
                  min={0}
                  max={120}
                  className="w-16 rounded-md border border-zinc-700 bg-zinc-800/50 px-2 py-1 text-xs text-zinc-200 focus:border-red-500/50 focus:outline-none"
                />
                <span className="text-xs text-zinc-400">seconds</span>
                <button
                  type="button"
                  onClick={() => removeSilenceMoment(index)}
                  className="text-zinc-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addSilenceMoment}
              className="flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-dashed border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300 transition-colors text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Silence Moment
            </button>
          </div>

          {/* Crowd Sounds Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-zinc-500" />
              <span className="text-xs text-zinc-400">Include crowd sounds</span>
            </div>
            <button
              type="button"
              onClick={toggleCrowdSounds}
              className={`relative h-5 w-9 rounded-full transition-colors ${
                crowdSounds ? 'bg-red-500' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                  crowdSounds ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Preview */}
          <div className="rounded-lg bg-zinc-800/30 p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <Music className="h-3.5 w-3.5" />
              <span>Soundscape Preview</span>
            </div>
            <p className="text-xs text-zinc-500">
              {MOTIVATIONAL_MUSIC_TYPES.find(m => m.value === musicType)?.label} • {musicIntensity} intensity
              {silenceMoments.length > 0 && ` • ${silenceMoments.length} silence moment${silenceMoments.length > 1 ? 's' : ''}`}
              {crowdSounds && ' • Crowd sounds included'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
