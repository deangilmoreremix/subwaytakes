import { useState } from 'react';
import { Drama, Zap, MessageCircle, Dog, Store, Phone, Users, CloudRain, Ban } from 'lucide-react';
import type { StreetPlotTwist, StreetPlotTwistType } from '../lib/types';
import { STREET_PLOT_TWIST_TYPES } from '../lib/constants';

interface StreetPlotTwistSelectorProps {
  value: StreetPlotTwist | undefined;
  onChange: (twist: StreetPlotTwist | undefined) => void;
  disabled?: boolean;
  maxDuration?: number;
}

const TWIST_ICONS: Record<StreetPlotTwistType, typeof Drama> = {
  car_horn_interruption: Zap,
  dog_approaches: Dog,
  vendor_interruption: Store,
  friend_recognition: Users,
  phone_call: Phone,
  someone_joins: MessageCircle,
  unexpected_weather: CloudRain,
  none: Ban,
};

const IMPACT_COLORS: Record<StreetPlotTwist['impact'], { bg: string; border: string; text: string }> = {
  comedic: { bg: 'bg-yellow-500/15', border: 'border-yellow-500/50', text: 'text-yellow-400' },
  dramatic: { bg: 'bg-rose-500/15', border: 'border-rose-500/50', text: 'text-rose-400' },
  awkward: { bg: 'bg-orange-500/15', border: 'border-orange-500/50', text: 'text-orange-400' },
  intriguing: { bg: 'bg-purple-500/15', border: 'border-purple-500/50', text: 'text-purple-400' },
};

export function StreetPlotTwistSelector({ value, onChange, disabled, maxDuration = 60 }: StreetPlotTwistSelectorProps) {
  const [isEnabled, setIsEnabled] = useState(value?.type !== 'none' && value?.type !== undefined);
  const [twistType, setTwistType] = useState<StreetPlotTwistType>(value?.type ?? 'car_horn_interruption');
  const [timing, setTiming] = useState(value?.timing ?? Math.floor(maxDuration * 0.7));
  const [impact, setImpact] = useState<StreetPlotTwist['impact']>(value?.impact ?? 'comedic');
  const [description, setDescription] = useState(value?.description ?? '');

  const enabled = isEnabled && !disabled;

  function toggleEnabled() {
    const newEnabled = !isEnabled;
    setIsEnabled(newEnabled);
    if (newEnabled) {
      onChange({
        type: twistType,
        timing,
        impact,
        description: description || getDefaultDescription(twistType),
      });
    } else {
      onChange(undefined);
    }
  }

  function updateTwistType(type: StreetPlotTwistType) {
    setTwistType(type);
    onChange({
      type,
      timing,
      impact,
      description: description || getDefaultDescription(type),
    });
  }

  function updateTiming(newTiming: number) {
    setTiming(newTiming);
    onChange({ type: twistType, timing: newTiming, impact, description });
  }

  function updateImpact(newImpact: StreetPlotTwist['impact']) {
    setImpact(newImpact);
    onChange({ type: twistType, timing, impact: newImpact, description });
  }

  function updateDescription(newDescription: string) {
    setDescription(newDescription);
    onChange({ type: twistType, timing, impact, description: newDescription });
  }

  function getDefaultDescription(type: StreetPlotTwistType): string {
    const defaults: Record<StreetPlotTwistType, string> = {
      car_horn_interruption: 'Sudden car horn interrupts the interview moment',
      dog_approaches: 'A friendly dog wanders into frame, creating a charming moment',
      vendor_interruption: 'Street vendor offers something, adding local flavor',
      friend_recognition: '"Hey!" - someone recognizes the interviewee',
      phone_call: 'Important phone call interrupts with perfect timing',
      someone_joins: 'A stranger jumps into the conversation with their take',
      unexpected_weather: 'Sudden gust of wind or rain changes the scene',
      none: '',
    };
    return defaults[type];
  }

  const colors = IMPACT_COLORS[impact];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
              type="button"
              onClick={toggleEnabled}
              disabled={disabled}
              aria-label="Enable unexpected interruptions"
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
            <span className="text-sm font-medium text-zinc-200">Unexpected Interruptions</span>
            <p className="text-xs text-zinc-500">Car horns, dogs, vendors add authenticity</p>
          </div>
        </div>
      </div>

      {enabled && (
        <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          {/* Twist Type Selection */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Interruption Type</label>
            <div className="grid grid-cols-2 gap-2">
              {STREET_PLOT_TWIST_TYPES.filter(t => t.value !== 'none').map((type) => {
                const Icon = TWIST_ICONS[type.value];
                const isSelected = twistType === type.value;

                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => updateTwistType(type.value)}
                    className={`flex items-start gap-2 p-2 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'border-emerald-500/50 bg-emerald-500/10'
                        : 'border-zinc-700 bg-zinc-800/30 hover:border-zinc-600'
                    }`}
                  >
                    <Icon className={`h-4 w-4 mt-0.5 ${isSelected ? 'text-emerald-400' : 'text-zinc-500'}`} />
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

          {/* Impact Selection */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Impact Tone</label>
            <div className="flex gap-2">
              {(['comedic', 'dramatic', 'awkward', 'intriguing'] as const).map((imp) => (
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
              placeholder={getDefaultDescription(twistType)}
              rows={2}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:border-emerald-500/50 focus:outline-none resize-none"
            />
          </div>

          {/* Preview */}
          <div className={`rounded-lg border ${colors.border} ${colors.bg} p-3 space-y-1`}>
            <div className="flex items-center gap-2">
              <Drama className={`h-3.5 w-3.5 ${colors.text}`} />
              <span className={`text-xs font-medium ${colors.text}`}>Interruption Preview</span>
            </div>
            <p className="text-xs text-zinc-400">
              At {timing}s: {description || getDefaultDescription(twistType)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
