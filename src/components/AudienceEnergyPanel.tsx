import { useState } from 'react';
import { Users, Plus, Trash2, Volume2, Trophy, Heart } from 'lucide-react';
import type { AudienceEnergyConfig, AudienceMoment, AudienceReactionType } from '../lib/types';

interface AudienceEnergyPanelProps {
  value: AudienceEnergyConfig | undefined;
  onChange: (config: AudienceEnergyConfig | undefined) => void;
  disabled?: boolean;
}

const REACTION_TYPES: { value: AudienceReactionType; label: string; emoji: string; description: string }[] = [
  { value: 'cheering', label: 'Cheering', emoji: '🙌', description: 'Loud applause and celebration' },
  { value: 'inspired', label: 'Inspired', emoji: '✨', description: 'Eyes wide, motivated expressions' },
  { value: 'moved', label: 'Moved', emoji: '😢', description: 'Touched, emotional reactions' },
  { value: 'energized', label: 'Energized', emoji: '⚡', description: 'Pumped up, ready for action' },
  { value: 'contemplative', label: 'Contemplative', emoji: '🤔', description: 'Thoughtful, deep in reflection' },
];


export function AudienceEnergyPanel({ value, onChange, disabled }: AudienceEnergyPanelProps) {
  const [isEnabled, setIsEnabled] = useState(value?.enabled ?? false);
  const [moments, setMoments] = useState<AudienceMoment[]>(value?.moments ?? []);
  const [showCrowd, setShowCrowd] = useState(value?.showCrowd ?? true);
  const [showIndividualReactions, setShowIndividualReactions] = useState(value?.showIndividualReactions ?? true);
  const [standingOvation, setStandingOvation] = useState(value?.standingOvation ?? false);

  const enabled = isEnabled && !disabled;

  function toggleEnabled() {
    const newEnabled = !isEnabled;
    setIsEnabled(newEnabled);
    if (newEnabled) {
      onChange({
        enabled: true,
        moments: moments.length > 0 ? moments : [createMoment()],
        showCrowd,
        showIndividualReactions,
        standingOvation,
      });
    } else {
      onChange(undefined);
    }
  }

  function createMoment(): AudienceMoment {
    return {
      id: Math.random().toString(36).substring(7),
      type: 'inspired',
      timing: 10,
      intensity: 'moderate',
      description: 'Audience reacts to key moment',
    };
  }

  function updateMoment(id: string, updates: Partial<AudienceMoment>) {
    const newMoments = moments.map(m => m.id === id ? { ...m, ...updates } : m);
    setMoments(newMoments);
    onChange({ enabled: true, moments: newMoments, showCrowd, showIndividualReactions, standingOvation });
  }

  function addMoment() {
    const newMoments = [...moments, createMoment()];
    setMoments(newMoments);
    onChange({ enabled: true, moments: newMoments, showCrowd, showIndividualReactions, standingOvation });
  }

  function removeMoment(id: string) {
    const newMoments = moments.filter(m => m.id !== id);
    setMoments(newMoments);
    onChange({ enabled: true, moments: newMoments, showCrowd, showIndividualReactions, standingOvation });
  }

  function toggleShowCrowd() {
    const newValue = !showCrowd;
    setShowCrowd(newValue);
    onChange({ enabled: true, moments, showCrowd: newValue, showIndividualReactions, standingOvation });
  }

  function toggleShowIndividualReactions() {
    const newValue = !showIndividualReactions;
    setShowIndividualReactions(newValue);
    onChange({ enabled: true, moments, showCrowd, showIndividualReactions: newValue, standingOvation });
  }

  function toggleStandingOvation() {
    const newValue = !standingOvation;
    setStandingOvation(newValue);
    onChange({ enabled: true, moments, showCrowd, showIndividualReactions, standingOvation: newValue });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
              type="button"
              onClick={toggleEnabled}
              disabled={disabled}
              aria-label="Enable audience energy response"
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
            <span className="text-sm font-medium text-zinc-200">Audience Energy Response</span>
            <p className="text-xs text-zinc-500">Crowd cheering, inspiration shots, ovations</p>
          </div>
        </div>
      </div>

      {enabled && (
        <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          {/* Display Options */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-zinc-500" />
                <span className="text-xs text-zinc-400">Show crowd reactions</span>
              </div>
              <button
                type="button"
                onClick={toggleShowCrowd}
                className={`relative h-5 w-9 rounded-full transition-colors ${
                  showCrowd ? 'bg-red-500' : 'bg-zinc-700'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                    showCrowd ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-zinc-500" />
                <span className="text-xs text-zinc-400">Show individual inspiration shots</span>
              </div>
              <button
                type="button"
                onClick={toggleShowIndividualReactions}
                className={`relative h-5 w-9 rounded-full transition-colors ${
                  showIndividualReactions ? 'bg-red-500' : 'bg-zinc-700'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                    showIndividualReactions ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-zinc-500" />
                <span className="text-xs text-zinc-400">Standing ovation moment</span>
              </div>
              <button
                type="button"
                onClick={toggleStandingOvation}
                className={`relative h-5 w-9 rounded-full transition-colors ${
                  standingOvation ? 'bg-red-500' : 'bg-zinc-700'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                    standingOvation ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Reaction Moments */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Reaction Moments</label>
            {moments.map((moment, index) => {
              return (
                <div
                  key={moment.id}
                  className="flex items-center gap-2 p-2 rounded-lg border border-zinc-800 bg-zinc-800/30"
                >
                  <span className="text-xs text-zinc-500 w-4">{index + 1}</span>
                  
                  <select
                    value={moment.type}
                    onChange={(e) => updateMoment(moment.id, { type: e.target.value as AudienceReactionType })}
                    className="flex-1 min-w-0 rounded-md border border-zinc-700 bg-zinc-800/50 px-2 py-1.5 text-xs text-zinc-200 focus:border-red-500/50 focus:outline-none"
                  >
                    {REACTION_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.emoji} {type.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={moment.intensity}
                    onChange={(e) => updateMoment(moment.id, { intensity: e.target.value as AudienceMoment['intensity'] })}
                    className="w-24 rounded-md border border-zinc-700 bg-zinc-800/50 px-2 py-1.5 text-xs text-zinc-200 focus:border-red-500/50 focus:outline-none"
                  >
                    <option value="subtle">Subtle</option>
                    <option value="moderate">Moderate</option>
                    <option value="intense">Intense</option>
                  </select>

                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={moment.timing}
                      onChange={(e) => updateMoment(moment.id, { timing: parseInt(e.target.value) || 0 })}
                      min={0}
                      max={120}
                      className="w-14 rounded-md border border-zinc-700 bg-zinc-800/50 px-2 py-1.5 text-xs text-zinc-200 focus:border-red-500/50 focus:outline-none"
                    />
                    <span className="text-xs text-zinc-500">s</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeMoment(moment.id)}
                    className="text-zinc-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}

            <button
              type="button"
              onClick={addMoment}
              className="flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-dashed border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300 transition-colors text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Reaction Moment
            </button>
          </div>

          {/* Preview */}
          <div className="rounded-lg bg-zinc-800/30 p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <Volume2 className="h-3.5 w-3.5" />
              <span>Audience Preview</span>
            </div>
            <p className="text-xs text-zinc-500">
              {showCrowd ? 'Crowd visible • ' : 'No crowd • '}
              {showIndividualReactions ? 'Individual reactions • ' : 'No close-ups • '}
              {standingOvation ? 'Standing ovation finale' : 'No ovation'}
            </p>
            {moments.length > 0 && (
              <p className="text-xs text-zinc-400">
                {moments.length} reaction moment{moments.length > 1 ? 's' : ''} at: {moments.map(m => `${m.timing}s`).join(', ')}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
