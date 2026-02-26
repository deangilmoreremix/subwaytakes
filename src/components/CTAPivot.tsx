import { useState } from 'react';
import { ArrowRight, Edit3, Target, Users, Share2 } from 'lucide-react';
import type { CTAPivotConfig, CTAPivotType } from '../lib/types';
import { CTA_PIVOT_TYPES } from '../lib/constants';

interface CTAPivotProps {
  value: CTAPivotConfig | undefined;
  onChange: (config: CTAPivotConfig | undefined) => void;
  disabled?: boolean;
  maxDuration?: number;
}

const PIVOT_ICONS: Record<CTAPivotType, typeof ArrowRight> = {
  story_to_advice: Edit3,
  write_this_down: Edit3,
  final_challenge: Target,
  join_movement: Users,
  share_message: Share2,
};

const PIVOT_COLORS: Record<CTAPivotType, { bg: string; border: string; text: string }> = {
  story_to_advice: { bg: 'bg-blue-500/15', border: 'border-blue-500/50', text: 'text-blue-400' },
  write_this_down: { bg: 'bg-amber-500/15', border: 'border-amber-500/50', text: 'text-amber-400' },
  final_challenge: { bg: 'bg-red-500/15', border: 'border-red-500/50', text: 'text-red-400' },
  join_movement: { bg: 'bg-purple-500/15', border: 'border-purple-500/50', text: 'text-purple-400' },
  share_message: { bg: 'bg-emerald-500/15', border: 'border-emerald-500/50', text: 'text-emerald-400' },
};

export function CTAPivot({ value, onChange, disabled, maxDuration = 60 }: CTAPivotProps) {
  const [isEnabled, setIsEnabled] = useState(value?.enabled ?? false);
  const [pivotType, setPivotType] = useState<CTAPivotType>(value?.pivotType ?? 'story_to_advice');
  const [timing, setTiming] = useState(value?.timing ?? Math.floor(maxDuration * 0.75));
  const [transitionPhrase, setTransitionPhrase] = useState(value?.transitionPhrase ?? '');
  const [callToAction, setCallToAction] = useState(value?.callToAction ?? '');

  const enabled = isEnabled && !disabled;

  function toggleEnabled() {
    const newEnabled = !isEnabled;
    setIsEnabled(newEnabled);
    if (newEnabled) {
      onChange({
        enabled: true,
        pivotType,
        timing,
        transitionPhrase: transitionPhrase || getDefaultTransition(pivotType),
        callToAction: callToAction || getDefaultCTA(pivotType),
      });
    } else {
      onChange(undefined);
    }
  }

  function updatePivotType(type: CTAPivotType) {
    setPivotType(type);
    onChange({
      enabled: true,
      pivotType: type,
      timing,
      transitionPhrase: transitionPhrase || getDefaultTransition(type),
      callToAction: callToAction || getDefaultCTA(type),
    });
  }

  function updateTiming(newTiming: number) {
    setTiming(newTiming);
    onChange({ enabled: true, pivotType, timing: newTiming, transitionPhrase, callToAction });
  }

  function updateTransitionPhrase(phrase: string) {
    setTransitionPhrase(phrase);
    onChange({ enabled: true, pivotType, timing, transitionPhrase: phrase, callToAction });
  }

  function updateCallToAction(cta: string) {
    setCallToAction(cta);
    onChange({ enabled: true, pivotType, timing, transitionPhrase, callToAction: cta });
  }

  function getDefaultTransition(type: CTAPivotType): string {
    const defaults: Record<CTAPivotType, string> = {
      story_to_advice: 'Now let me tell you what you need to do with this...',
      write_this_down: 'Write this down. I\'m serious, get a pen...',
      final_challenge: 'I\'m going to leave you with one final challenge...',
      join_movement: 'This isn\'t just about you anymore. This is bigger...',
      share_message: 'If this message resonated with you, I need you to do something...',
    };
    return defaults[type];
  }

  function getDefaultCTA(type: CTAPivotType): string {
    const defaults: Record<CTAPivotType, string> = {
      story_to_advice: 'Take this advice and apply it today. Don\'t wait.',
      write_this_down: 'Your future self will thank you for remembering this moment.',
      final_challenge: 'I challenge you to take action within the next 24 hours.',
      join_movement: 'Join us. Be part of something that matters.',
      share_message: 'Share this with someone who needs to hear it right now.',
    };
    return defaults[type];
  }

  const colors = PIVOT_COLORS[pivotType];
  const Icon = PIVOT_ICONS[pivotType];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
              type="button"
              onClick={toggleEnabled}
              disabled={disabled}
              aria-label="Enable call-to-action pivot"
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
            <span className="text-sm font-medium text-zinc-200">Call-to-Action Pivot</span>
            <p className="text-xs text-zinc-500">Story to advice transition, "Write this down" moments, final challenges</p>
          </div>
        </div>
      </div>

      {enabled && (
        <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          {/* Pivot Type Selection */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Pivot Type</label>
            <div className="grid grid-cols-2 gap-2">
              {CTA_PIVOT_TYPES.map((type) => {
                const TypeIcon = PIVOT_ICONS[type.value];
                const isSelected = pivotType === type.value;
                const typeColors = PIVOT_COLORS[type.value];

                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => updatePivotType(type.value)}
                    className={`flex items-start gap-2 p-2 rounded-lg border text-left transition-all ${
                      isSelected
                        ? `${typeColors.bg} ${typeColors.border}`
                        : 'border-zinc-700 bg-zinc-800/30 hover:border-zinc-600'
                    }`}
                  >
                    <TypeIcon className={`h-4 w-4 mt-0.5 ${isSelected ? typeColors.text : 'text-zinc-500'}`} />
                    <div>
                      <span className={`text-xs font-medium block ${isSelected ? typeColors.text : 'text-zinc-300'}`}>
                        {type.label}
                      </span>
                      <span className="text-[10px] text-zinc-500">{type.description}</span>
                    </div>
                  </button>
                );
              })}
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
              min={Math.floor(maxDuration * 0.5)}
              max={Math.floor(maxDuration * 0.95)}
              value={timing}
              onChange={(e) => updateTiming(parseInt(e.target.value))}
              className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-red-500"
            />
            <div className="flex justify-between text-[10px] text-zinc-600">
              <span>Mid</span>
              <span>Late</span>
              <span>End</span>
            </div>
          </div>

          {/* Transition Phrase */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Transition Phrase</label>
            <textarea
              value={transitionPhrase}
              onChange={(e) => updateTransitionPhrase(e.target.value)}
              placeholder={getDefaultTransition(pivotType)}
              rows={2}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:border-red-500/50 focus:outline-none resize-none"
            />
          </div>

          {/* Call to Action */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Call to Action</label>
            <textarea
              value={callToAction}
              onChange={(e) => updateCallToAction(e.target.value)}
              placeholder={getDefaultCTA(pivotType)}
              rows={2}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:border-red-500/50 focus:outline-none resize-none"
            />
          </div>

          {/* Preview */}
          <div className={`rounded-lg border ${colors.border} ${colors.bg} p-3 space-y-2`}>
            <div className="flex items-center gap-2">
              <Icon className={`h-3.5 w-3.5 ${colors.text}`} />
              <span className={`text-xs font-medium ${colors.text}`}>CTA Pivot Preview</span>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-zinc-400 italic">
                "{transitionPhrase || getDefaultTransition(pivotType)}"
              </p>
              <p className="text-xs text-zinc-300">
                {callToAction || getDefaultCTA(pivotType)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
