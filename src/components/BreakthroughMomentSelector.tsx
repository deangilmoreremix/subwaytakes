import { useState } from 'react';
import { Zap, Mic, UserCircle, Users, Film, VolumeX, Camera, Lightbulb } from 'lucide-react';
import type { BreakthroughMoment, BreakthroughType } from '../lib/types';
import { BREAKTHROUGH_TYPES } from '../lib/constants';

interface BreakthroughMomentSelectorProps {
  value: BreakthroughMoment | undefined;
  onChange: (moment: BreakthroughMoment | undefined) => void;
  disabled?: boolean;
  maxDuration?: number;
}

const BREAKTHROUGH_ICONS: Record<BreakthroughType, typeof Zap> = {
  mic_drop: Mic,
  mentor_appears: UserCircle,
  crowd_erupts: Users,
  visual_metaphor: Film,
  silence_pregnant: VolumeX,
  camera_freeze: Camera,
  lighting_shift: Lightbulb,
};

const IMPACT_COLORS: Record<BreakthroughMoment['impact'], { bg: string; border: string; text: string }> = {
  subtle: { bg: 'bg-blue-500/15', border: 'border-blue-500/50', text: 'text-blue-400' },
  powerful: { bg: 'bg-amber-500/15', border: 'border-amber-500/50', text: 'text-amber-400' },
  transformative: { bg: 'bg-purple-500/15', border: 'border-purple-500/50', text: 'text-purple-400' },
};

export function BreakthroughMomentSelector({ value, onChange, disabled, maxDuration = 60 }: BreakthroughMomentSelectorProps) {
  const [isEnabled, setIsEnabled] = useState(value?.enabled ?? false);
  const [breakthroughType, setBreakthroughType] = useState<BreakthroughType>(value?.type ?? 'mic_drop');
  const [timing, setTiming] = useState(value?.timing ?? Math.floor(maxDuration * 0.7));
  const [impact, setImpact] = useState<BreakthroughMoment['impact']>(value?.impact ?? 'powerful');
  const [description, setDescription] = useState(value?.description ?? '');

  const enabled = isEnabled && !disabled;

  function toggleEnabled() {
    const newEnabled = !isEnabled;
    setIsEnabled(newEnabled);
    if (newEnabled) {
      onChange({
        enabled: true,
        type: breakthroughType,
        timing,
        impact,
        description: description || getDefaultDescription(breakthroughType),
      });
    } else {
      onChange(undefined);
    }
  }

  function updateBreakthroughType(type: BreakthroughType) {
    setBreakthroughType(type);
    onChange({
      enabled: true,
      type,
      timing,
      impact,
      description: description || getDefaultDescription(type),
    });
  }

  function updateTiming(newTiming: number) {
    setTiming(newTiming);
    onChange({ enabled: true, type: breakthroughType, timing: newTiming, impact, description });
  }

  function updateImpact(newImpact: BreakthroughMoment['impact']) {
    setImpact(newImpact);
    onChange({ enabled: true, type: breakthroughType, timing, impact: newImpact, description });
  }

  function updateDescription(newDescription: string) {
    setDescription(newDescription);
    onChange({ enabled: true, type: breakthroughType, timing, impact, description: newDescription });
  }

  function getDefaultDescription(type: BreakthroughType): string {
    const defaults: Record<BreakthroughType, string> = {
      mic_drop: 'Speaker drops the mic after the ultimate truth bomb',
      mentor_appears: 'Wise mentor figure enters frame at the perfect moment',
      crowd_erupts: 'Audience explodes in thunderous applause and cheers',
      visual_metaphor: 'Symbolic imagery appears representing the breakthrough',
      silence_pregnant: 'Complete silence lets the message land with maximum impact',
      camera_freeze: 'Time freezes on the speaker\'s powerful expression',
      lighting_shift: 'Dramatic lighting change emphasizes the revelation',
    };
    return defaults[type];
  }

  const colors = IMPACT_COLORS[impact];
  const Icon = BREAKTHROUGH_ICONS[breakthroughType];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
              type="button"
              onClick={toggleEnabled}
              disabled={disabled}
              aria-label="Enable breakthrough moment"
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
            <span className="text-sm font-medium text-zinc-200">The "Breakthrough" Moment</span>
            <p className="text-xs text-zinc-500">Mic drops, mentor appearances, crowd erupts</p>
          </div>
        </div>
      </div>

      {enabled && (
        <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          {/* Breakthrough Type Selection */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Breakthrough Type</label>
            <div className="grid grid-cols-2 gap-2">
              {BREAKTHROUGH_TYPES.map((type) => {
                const TypeIcon = BREAKTHROUGH_ICONS[type.value];
                const isSelected = breakthroughType === type.value;

                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => updateBreakthroughType(type.value)}
                    className={`flex items-start gap-2 p-2 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'border-red-500/50 bg-red-500/10'
                        : 'border-zinc-700 bg-zinc-800/30 hover:border-zinc-600'
                    }`}
                  >
                    <TypeIcon className={`h-4 w-4 mt-0.5 ${isSelected ? 'text-red-400' : 'text-zinc-500'}`} />
                    <div>
                      <span className={`text-xs font-medium block ${isSelected ? 'text-red-200' : 'text-zinc-300'}`}>
                        {type.label}
                      </span>
                      <span className="text-[10px] text-zinc-500">{type.description}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Impact Selection */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Impact Level</label>
            <div className="flex gap-2">
              {(['subtle', 'powerful', 'transformative'] as const).map((imp) => (
                <button
                  key={imp}
                  type="button"
                  onClick={() => updateImpact(imp)}
                  className={`flex-1 px-3 py-1.5 rounded-lg border text-xs transition-all ${
                    impact === imp
                      ? `${IMPACT_COLORS[imp].bg} ${IMPACT_COLORS[imp].border} ${IMPACT_COLORS[imp].text}`
                      : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                  }`}
                >
                  {imp.charAt(0).toUpperCase() + imp.slice(1)}
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
              min={Math.floor(maxDuration * 0.3)}
              max={Math.floor(maxDuration * 0.9)}
              value={timing}
              onChange={(e) => updateTiming(parseInt(e.target.value))}
              className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-red-500"
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
              placeholder={getDefaultDescription(breakthroughType)}
              rows={2}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:border-red-500/50 focus:outline-none resize-none"
            />
          </div>

          {/* Preview */}
          <div className={`rounded-lg border ${colors.border} ${colors.bg} p-3 space-y-1`}>
            <div className="flex items-center gap-2">
              <Icon className={`h-3.5 w-3.5 ${colors.text}`} />
              <span className={`text-xs font-medium ${colors.text}`}>Breakthrough Preview</span>
            </div>
            <p className="text-xs text-zinc-400">
              At {timing}s: {description || getDefaultDescription(breakthroughType)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
