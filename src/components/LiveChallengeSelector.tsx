import { useState } from 'react';
import { Users, Hand, Hash, Calendar, Target, Plus, Trash2 } from 'lucide-react';
import type { LiveChallenge, LiveChallengeType } from '../lib/types';
import { LIVE_CHALLENGE_TYPES } from '../lib/constants';

interface LiveChallengeSelectorProps {
  value: LiveChallenge | undefined;
  onChange: (challenge: LiveChallenge | undefined) => void;
  disabled?: boolean;
  maxDuration?: number;
}

const CHALLENGE_ICONS: Record<LiveChallengeType, typeof Users> = {
  stand_up: Users,
  raise_hand: Hand,
  hashtag_display: Hash,
  thirty_day_challenge: Calendar,
  commitment_moment: Target,
};

const CHALLENGE_COLORS: Record<LiveChallengeType, { bg: string; border: string; text: string }> = {
  stand_up: { bg: 'bg-blue-500/15', border: 'border-blue-500/50', text: 'text-blue-400' },
  raise_hand: { bg: 'bg-amber-500/15', border: 'border-amber-500/50', text: 'text-amber-400' },
  hashtag_display: { bg: 'bg-purple-500/15', border: 'border-purple-500/50', text: 'text-purple-400' },
  thirty_day_challenge: { bg: 'bg-emerald-500/15', border: 'border-emerald-500/50', text: 'text-emerald-400' },
  commitment_moment: { bg: 'bg-red-500/15', border: 'border-red-500/50', text: 'text-red-400' },
};

export function LiveChallengeSelector({ value, onChange, disabled, maxDuration = 60 }: LiveChallengeSelectorProps) {
  const [isEnabled, setIsEnabled] = useState(value?.enabled ?? false);
  const [challengeType, setChallengeType] = useState<LiveChallengeType>(value?.challengeType ?? 'stand_up');
  const [timing, setTiming] = useState(value?.timing ?? Math.floor(maxDuration * 0.7));
  const [description, setDescription] = useState(value?.description ?? '');
  const [callToAction, setCallToAction] = useState(value?.callToAction ?? '');

  const enabled = isEnabled && !disabled;

  function toggleEnabled() {
    const newEnabled = !isEnabled;
    setIsEnabled(newEnabled);
    if (newEnabled) {
      onChange({
        enabled: true,
        challengeType,
        timing,
        description: description || getDefaultDescription(challengeType),
        callToAction: callToAction || getDefaultCTA(challengeType),
      });
    } else {
      onChange(undefined);
    }
  }

  function updateChallengeType(type: LiveChallengeType) {
    setChallengeType(type);
    onChange({
      enabled: true,
      challengeType: type,
      timing,
      description: description || getDefaultDescription(type),
      callToAction: callToAction || getDefaultCTA(type),
    });
  }

  function updateTiming(newTiming: number) {
    setTiming(newTiming);
    onChange({ enabled: true, challengeType, timing: newTiming, description, callToAction });
  }

  function updateDescription(newDescription: string) {
    setDescription(newDescription);
    onChange({ enabled: true, challengeType, timing, description: newDescription, callToAction });
  }

  function updateCallToAction(newCTA: string) {
    setCallToAction(newCTA);
    onChange({ enabled: true, challengeType, timing, description, callToAction: newCTA });
  }

  function getDefaultDescription(type: LiveChallengeType): string {
    const defaults: Record<LiveChallengeType, string> = {
      stand_up: 'Everyone in the audience stands up to commit to the message',
      raise_hand: 'Ask the audience to raise their hand if they resonate with the message',
      hashtag_display: 'Show the social media hashtag for viewers to share their journey',
      thirty_day_challenge: 'Launch a 30-day challenge for viewers to transform their lives',
      commitment_moment: 'Create a powerful moment where viewers commit to taking action',
    };
    return defaults[type];
  }

  function getDefaultCTA(type: LiveChallengeType): string {
    const defaults: Record<LiveChallengeType, string> = {
      stand_up: 'Stand up if you\'re ready to change your life!',
      raise_hand: 'Raise your hand if this message speaks to you!',
      hashtag_display: 'Use #MyTransformation and share your story!',
      thirty_day_challenge: 'Join the 30-day challenge starting today!',
      commitment_moment: 'Say it with me: I commit to my greatness!',
    };
    return defaults[type];
  }

  const colors = CHALLENGE_COLORS[challengeType];
  const Icon = CHALLENGE_ICONS[challengeType];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
              type="button"
              onClick={toggleEnabled}
              disabled={disabled}
              aria-label="Enable live challenge integration"
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
            <span className="text-sm font-medium text-zinc-200">Live Challenge Integration</span>
            <p className="text-xs text-zinc-500">"Everyone stand up" moments, hashtags, 30-day challenges</p>
          </div>
        </div>
      </div>

      {enabled && (
        <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          {/* Challenge Type Selection */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Challenge Type</label>
            <div className="grid grid-cols-2 gap-2">
              {LIVE_CHALLENGE_TYPES.map((type) => {
                const TypeIcon = CHALLENGE_ICONS[type.value];
                const isSelected = challengeType === type.value;

                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => updateChallengeType(type.value)}
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
              placeholder={getDefaultDescription(challengeType)}
              rows={2}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:border-red-500/50 focus:outline-none resize-none"
            />
          </div>

          {/* Call to Action */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Call to Action</label>
            <input
              type="text"
              value={callToAction}
              onChange={(e) => updateCallToAction(e.target.value)}
              placeholder={getDefaultCTA(challengeType)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:border-red-500/50 focus:outline-none"
            />
          </div>

          {/* Preview */}
          <div className={`rounded-lg border ${colors.border} ${colors.bg} p-3 space-y-1`}>
            <div className="flex items-center gap-2">
              <Icon className={`h-3.5 w-3.5 ${colors.text}`} />
              <span className={`text-xs font-medium ${colors.text}`}>Challenge Preview</span>
            </div>
            <p className="text-xs text-zinc-400">
              At {timing}s: {description || getDefaultDescription(challengeType)}
            </p>
            <p className="text-xs text-zinc-500 italic">
              "{callToAction || getDefaultCTA(challengeType)}"
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
