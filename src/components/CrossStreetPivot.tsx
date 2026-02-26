import { useState } from 'react';
import { ArrowRightLeft, MapPin, ArrowRight, CornerDownRight, MessageSquare, Brain, Heart, Smile } from 'lucide-react';
import type { CrossStreetPivot, CrossStreetPivotType } from '../lib/types';
import { CROSS_STREET_PIVOT_TYPES } from '../lib/constants';

interface CrossStreetPivotProps {
  value: CrossStreetPivot | undefined;
  onChange: (pivot: CrossStreetPivot | undefined) => void;
  disabled?: boolean;
}

const PIVOT_ICONS: Record<CrossStreetPivotType, typeof ArrowRight> = {
  deeper: CornerDownRight,
  challenge: MessageSquare,
  personal: Heart,
  philosophical: Brain,
  comedic: Smile,
};

export function CrossStreetPivot({ value, onChange, disabled }: CrossStreetPivotProps) {
  const [isEnabled, setIsEnabled] = useState(value?.enabled ?? false);
  const [pivotType, setPivotType] = useState<CrossStreetPivotType>(value?.pivotType ?? 'deeper');
  const [triggerLocation, setTriggerLocation] = useState(value?.triggerLocation ?? 'Intersection');
  const [newQuestion, setNewQuestion] = useState(value?.newQuestion ?? '');
  const [transitionPhrase, setTransitionPhrase] = useState(value?.transitionPhrase ?? '');

  const enabled = isEnabled && !disabled;

  function toggleEnabled() {
    const newEnabled = !isEnabled;
    setIsEnabled(newEnabled);
    if (newEnabled) {
      onChange({
        enabled: true,
        triggerLocation,
        pivotType,
        newQuestion: newQuestion || getDefaultQuestion(pivotType),
        transitionPhrase: transitionPhrase || getDefaultTransition(pivotType),
      });
    } else {
      onChange(undefined);
    }
  }

  function getDefaultQuestion(type: CrossStreetPivotType): string {
    const defaults: Record<CrossStreetPivotType, string> = {
      deeper: 'But why do you really think that?',
      challenge: 'What would you say to someone who disagrees?',
      personal: 'Has this ever happened to you personally?',
      philosophical: 'What does that say about human nature?',
      comedic: 'What\'s the most ridiculous version of that?',
    };
    return defaults[type];
  }

  function getDefaultTransition(type: CrossStreetPivotType): string {
    const defaults: Record<CrossStreetPivotType, string> = {
      deeper: 'Let me push back on that...',
      challenge: 'But here\'s the thing...',
      personal: 'Speaking of which...',
      philosophical: 'That makes me think...',
      comedic: 'Okay but imagine...',
    };
    return defaults[type];
  }

  function updatePivotType(type: CrossStreetPivotType) {
    setPivotType(type);
    onChange({
      enabled: true,
      triggerLocation,
      pivotType: type,
      newQuestion: newQuestion || getDefaultQuestion(type),
      transitionPhrase: transitionPhrase || getDefaultTransition(type),
    });
  }

  function updateTriggerLocation(location: string) {
    setTriggerLocation(location);
    onChange({ enabled: true, triggerLocation: location, pivotType, newQuestion, transitionPhrase });
  }

  function updateNewQuestion(question: string) {
    setNewQuestion(question);
    onChange({ enabled: true, triggerLocation, pivotType, newQuestion: question, transitionPhrase });
  }

  function updateTransitionPhrase(phrase: string) {
    setTransitionPhrase(phrase);
    onChange({ enabled: true, triggerLocation, pivotType, newQuestion, transitionPhrase: phrase });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
              type="button"
              onClick={toggleEnabled}
              disabled={disabled}
              aria-label="Enable cross-street pivot"
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
            <span className="text-sm font-medium text-zinc-200">Cross-Street Pivot</span>
            <p className="text-xs text-zinc-500">Topic direction changes at intersections</p>
          </div>
        </div>
      </div>

      {enabled && (
        <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          {/* Pivot Direction */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Pivot Direction</label>
            <div className="grid grid-cols-2 gap-2">
              {CROSS_STREET_PIVOT_TYPES.map((dir) => {
                const Icon = PIVOT_ICONS[dir.value];
                const isSelected = pivotType === dir.value;

                return (
                  <button
                    key={dir.value}
                    type="button"
                    onClick={() => updatePivotType(dir.value)}
                    className={`flex items-start gap-2 p-2 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'border-emerald-500/50 bg-emerald-500/10'
                        : 'border-zinc-700 bg-zinc-800/30 hover:border-zinc-600'
                    }`}
                  >
                    <Icon className={`h-4 w-4 mt-0.5 ${isSelected ? 'text-emerald-400' : 'text-zinc-500'}`} />
                    <div>
                      <span className={`text-xs font-medium block ${isSelected ? 'text-emerald-200' : 'text-zinc-300'}`}>
                        {dir.label}
                      </span>
                      <span className="text-[10px] text-zinc-500">{dir.description}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Trigger Location */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Trigger Location</label>
            <select
              value={triggerLocation}
              onChange={(e) => updateTriggerLocation(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-xs text-zinc-200 focus:border-emerald-500/50 focus:outline-none"
            >
              <option value="Intersection">🚦 Intersection</option>
              <option value="Street Corner">🗺️ Street Corner</option>
              <option value="Crosswalk">🚶 Crosswalk</option>
              <option value="Block Change">🏢 Block Change</option>
              <option value="Landmark">🏛️ Landmark</option>
            </select>
          </div>

          {/* Transition Phrase */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Transition Phrase</label>
            <input
              type="text"
              value={transitionPhrase}
              onChange={(e) => updateTransitionPhrase(e.target.value)}
              placeholder={getDefaultTransition(pivotType)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-emerald-500/50 focus:outline-none"
            />
          </div>

          {/* New Question */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">New Question</label>
            <input
              type="text"
              value={newQuestion}
              onChange={(e) => updateNewQuestion(e.target.value)}
              placeholder={getDefaultQuestion(pivotType)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-emerald-500/50 focus:outline-none"
            />
          </div>

          {/* Preview */}
          <div className="rounded-lg bg-zinc-800/30 p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <ArrowRightLeft className="h-3.5 w-3.5" />
              <span>Pivot Preview</span>
            </div>
            <div className="space-y-1 text-xs">
              <p className="text-zinc-500">
                <MapPin className="h-3 w-3 inline mr-1" />
                At {triggerLocation}...
              </p>
              <p className="text-emerald-400">
                <ArrowRight className="h-3 w-3 inline mr-1" />
                "{transitionPhrase || getDefaultTransition(pivotType)}"
              </p>
              <p className="text-zinc-300">
                {newQuestion || getDefaultQuestion(pivotType)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
