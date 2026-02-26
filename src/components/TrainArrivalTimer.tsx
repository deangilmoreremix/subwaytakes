import { useState } from 'react';
import type { TrainArrivalMoment, SubwayLine } from '../lib/types';
import { SUBWAY_LINES } from '../lib/constants';

interface TrainArrivalTimerProps {
  value: TrainArrivalMoment | undefined;
  onChange: (moment: TrainArrivalMoment | undefined) => void;
  disabled?: boolean;
  selectedLine?: SubwayLine;
}

const TIMING_OPTIONS = [
  { value: 'early', label: 'Early', description: 'Sets the scene', emoji: '🌅' },
  { value: 'mid', label: 'Mid', description: 'Builds tension', emoji: '⏱️' },
  { value: 'late', label: 'Late', description: 'Creates urgency', emoji: '🔥' },
  { value: 'climax', label: 'Climax', description: 'Perfect timing', emoji: '⚡' },
] as const;

const EFFECT_OPTIONS = [
  { value: 'interrupt', label: 'Interrupt', description: 'Train cuts off dialogue' },
  { value: 'tension', label: 'Tension', description: 'Waiting creates suspense' },
  { value: 'transition', label: 'Transition', description: 'Natural scene change' },
  { value: 'backdrop', label: 'Backdrop', description: 'Ambient background' },
] as const;

const DIRECTION_OPTIONS = [
  { value: 'downtown', label: 'Downtown' },
  { value: 'uptown', label: 'Uptown' },
  { value: 'brooklyn', label: 'To Brooklyn' },
  { value: 'queens', label: 'To Queens' },
  { value: 'bronx', label: 'To Bronx' },
] as const;

export function TrainArrivalTimer({ value, onChange, disabled, selectedLine }: TrainArrivalTimerProps) {
  const [isEnabled, setIsEnabled] = useState(value?.enabled ?? false);
  const [timing, setTiming] = useState<TrainArrivalMoment['timing']>(value?.timing ?? 'mid');
  const [effect, setEffect] = useState<TrainArrivalMoment['effect']>(value?.effect ?? 'tension');
  const [line, setLine] = useState<SubwayLine | undefined>(value?.line || selectedLine);
  const [direction, setDirection] = useState<TrainArrivalMoment['direction']>(value?.direction);

  const enabled = isEnabled && !disabled;

  function toggleEnabled() {
    const newEnabled = !isEnabled;
    setIsEnabled(newEnabled);
    if (newEnabled) {
      onChange({
        enabled: true,
        timing,
        effect,
        line: line || selectedLine,
        direction,
      });
    } else {
      onChange(undefined);
    }
  }

  function updateTiming(newTiming: TrainArrivalMoment['timing']) {
    setTiming(newTiming);
    onChange({ enabled: true, timing: newTiming, effect, line: line || selectedLine, direction });
  }

  function updateEffect(newEffect: TrainArrivalMoment['effect']) {
    setEffect(newEffect);
    onChange({ enabled: true, timing, effect: newEffect, line: line || selectedLine, direction });
  }

  function updateLine(newLine: SubwayLine | undefined) {
    setLine(newLine);
    onChange({ enabled: true, timing, effect, line: newLine, direction });
  }

  function updateDirection(newDirection: TrainArrivalMoment['direction']) {
    setDirection(newDirection);
    onChange({ enabled: true, timing, effect, line: line || selectedLine, direction: newDirection });
  }

  const lineColor = SUBWAY_LINES.find(l => l.value === (line || selectedLine))?.color || '#888888';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
              type="button"
              onClick={toggleEnabled}
              disabled={disabled}
              aria-label="Enable train arrival dramatic pause"
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
            <span className="text-sm font-medium text-zinc-200">Train Arrival Dramatic Pause</span>
            <p className="text-xs text-zinc-500">Strategic train arrivals create tension</p>
          </div>
        </div>
      </div>

      {enabled && (
        <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          {/* Timing Selection */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Arrival Timing</label>
            <div className="grid grid-cols-2 gap-2">
              {TIMING_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateTiming(opt.value)}
                  className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all ${
                    timing === opt.value
                      ? 'border-amber-500/50 bg-amber-500/10'
                      : 'border-zinc-700 bg-zinc-800/30 hover:border-zinc-600'
                  }`}
                >
                  <span className="text-lg">{opt.emoji}</span>
                  <div>
                    <span className={`text-xs font-medium block ${timing === opt.value ? 'text-amber-200' : 'text-zinc-300'}`}>
                      {opt.label}
                    </span>
                    <span className="text-[10px] text-zinc-500">{opt.description}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Effect Selection */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Dramatic Effect</label>
            <div className="flex flex-wrap gap-2">
              {EFFECT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateEffect(opt.value)}
                  className={`px-3 py-1.5 rounded-lg border text-xs transition-all ${
                    effect === opt.value
                      ? 'bg-amber-500/15 border-amber-500/50 text-amber-400'
                      : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-zinc-500">
              {EFFECT_OPTIONS.find(e => e.value === effect)?.description}
            </p>
          </div>

          {/* Line & Direction */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400">Train Line</label>
              <select
                value={line || selectedLine || 'any'}
                onChange={(e) => updateLine(e.target.value as SubwayLine)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-xs text-zinc-200 focus:border-amber-500/50 focus:outline-none"
              >
                <option value="any">Any Line</option>
                {SUBWAY_LINES.filter(l => l.value !== 'any').map((line) => (
                  <option key={line.value} value={line.value}>
                    {line.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400">Direction</label>
              <select
                value={direction || ''}
                onChange={(e) => updateDirection(e.target.value as TrainArrivalMoment['direction'] || undefined)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-xs text-zinc-200 focus:border-amber-500/50 focus:outline-none"
              >
                <option value="">Any Direction</option>
                {DIRECTION_OPTIONS.map((dir) => (
                  <option key={dir.value} value={dir.value}>
                    {dir.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-lg bg-zinc-800/30 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ backgroundColor: lineColor }}
              >
                {(line || selectedLine || '?').toString().charAt(0)}
              </div>
              <span className="text-xs text-zinc-400">Scene Preview</span>
            </div>
            <p className="text-xs text-zinc-500">
              {timing === 'early' && 'Train arrives early, setting the urban atmosphere'}
              {timing === 'mid' && 'Train arrival punctuates the conversation mid-flow'}
              {timing === 'late' && 'Train creates urgency as time runs out'}
              {timing === 'climax' && 'Perfect dramatic timing at the peak moment'}
              {' • '}
              {effect === 'interrupt' && 'Sound cuts off dialogue abruptly'}
              {effect === 'tension' && 'Waiting builds anticipation'}
              {effect === 'transition' && 'Smooth scene transition'}
              {effect === 'backdrop' && 'Ambient train as background'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
