import { useState } from 'react';
import { Users, Plus, Trash2, Volume2, Shield } from 'lucide-react';
import type { StreetCrowdConfig, BystanderReaction } from '../lib/types';
import { BYSTANDER_REACTION_TYPES } from '../lib/constants';

interface StreetCrowdPanelProps {
  value: StreetCrowdConfig | undefined;
  onChange: (config: StreetCrowdConfig | undefined) => void;
  disabled?: boolean;
}

export function StreetCrowdPanel({ value, onChange, disabled }: StreetCrowdPanelProps) {
  const [isEnabled, setIsEnabled] = useState(value?.enabled ?? false);
  const [density, setDensity] = useState<StreetCrowdConfig['density']>(value?.density ?? 'moderate');
  const [engagement, setEngagement] = useState<StreetCrowdConfig['engagement']>(value?.engagement ?? 'reactive');
  const [reactions, setReactions] = useState<BystanderReaction[]>(value?.reactions ?? []);
  const [authorityFigureNearby, setAuthorityFigureNearby] = useState(value?.authorityFigureNearby ?? false);

  const enabled = isEnabled && !disabled;

  function toggleEnabled() {
    const newEnabled = !isEnabled;
    setIsEnabled(newEnabled);
    if (newEnabled) {
      onChange({
        enabled: true,
        reactions: reactions.length > 0 ? reactions : [createReaction()],
        density,
        engagement,
        authorityFigureNearby,
      });
    } else {
      onChange(undefined);
    }
  }

  function createReaction(): BystanderReaction {
    return {
      id: Math.random().toString(36).substring(7),
      type: 'curious',
      intensity: 'subtle',
      timing: 5,
      description: '',
    };
  }

  function updateReaction(id: string, updates: Partial<BystanderReaction>) {
    const newReactions = reactions.map(r => r.id === id ? { ...r, ...updates } : r);
    setReactions(newReactions);
    onChange({ enabled: true, reactions: newReactions, density, engagement, authorityFigureNearby });
  }

  function addReaction() {
    const newReactions = [...reactions, createReaction()];
    setReactions(newReactions);
    onChange({ enabled: true, reactions: newReactions, density, engagement, authorityFigureNearby });
  }

  function removeReaction(id: string) {
    const newReactions = reactions.filter(r => r.id !== id);
    setReactions(newReactions);
    onChange({ enabled: true, reactions: newReactions, density, engagement, authorityFigureNearby });
  }

  function updateDensity(newDensity: StreetCrowdConfig['density']) {
    setDensity(newDensity);
    onChange({ enabled: true, reactions, density: newDensity, engagement, authorityFigureNearby });
  }

  function updateEngagement(newEngagement: StreetCrowdConfig['engagement']) {
    setEngagement(newEngagement);
    onChange({ enabled: true, reactions, density, engagement: newEngagement, authorityFigureNearby });
  }

  function toggleAuthorityFigure() {
    const newValue = !authorityFigureNearby;
    setAuthorityFigureNearby(newValue);
    onChange({ enabled: true, reactions, density, engagement, authorityFigureNearby: newValue });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
              type="button"
              onClick={toggleEnabled}
              disabled={disabled}
              aria-label="Enable street crowd dynamics"
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
            <span className="text-sm font-medium text-zinc-200">Street Crowd Dynamics</span>
            <p className="text-xs text-zinc-500">Bystander reactions and density control</p>
          </div>
        </div>
      </div>

      {enabled && (
        <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          {/* Density & Engagement */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400">Crowd Density</label>
              <div className="flex gap-1">
                {(['sparse', 'moderate', 'dense'] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => updateDensity(d)}
                    className={`flex-1 px-2 py-1.5 rounded-md border text-xs transition-all ${
                      density === d
                        ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400'
                        : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                    }`}
                  >
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400">Engagement Level</label>
              <div className="flex gap-1">
                {(['passive', 'reactive', 'interactive'] as const).map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => updateEngagement(e)}
                    className={`flex-1 px-2 py-1.5 rounded-md border text-xs transition-all ${
                      engagement === e
                        ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400'
                        : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                    }`}
                  >
                    {e.charAt(0).toUpperCase() + e.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Authority Figure Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-zinc-500" />
              <span className="text-xs text-zinc-400">Authority figure nearby (security, police)</span>
            </div>
            <button
              type="button"
              onClick={toggleAuthorityFigure}
              className={`relative h-5 w-9 rounded-full transition-colors ${
                authorityFigureNearby ? 'bg-emerald-500' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                  authorityFigureNearby ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Reactions List */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Bystander Reactions</label>
            {reactions.map((reaction, index) => (
              <div
                key={reaction.id}
                className="flex items-center gap-2 p-2 rounded-lg border border-zinc-800 bg-zinc-800/30"
              >
                <span className="text-xs text-zinc-500 w-4">{index + 1}</span>
                
                <select
                  value={reaction.type}
                  onChange={(e) => updateReaction(reaction.id, { type: e.target.value as BystanderReaction['type'] })}
                  className="flex-1 min-w-0 rounded-md border border-zinc-700 bg-zinc-800/50 px-2 py-1.5 text-xs text-zinc-200 focus:border-emerald-500/50 focus:outline-none"
                >
                  {BYSTANDER_REACTION_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.emoji} {type.label}
                    </option>
                  ))}
                </select>

                <select
                  value={reaction.intensity}
                  onChange={(e) => updateReaction(reaction.id, { intensity: e.target.value as BystanderReaction['intensity'] })}
                  className="w-24 rounded-md border border-zinc-700 bg-zinc-800/50 px-2 py-1.5 text-xs text-zinc-200 focus:border-emerald-500/50 focus:outline-none"
                >
                  <option value="subtle">Subtle</option>
                  <option value="noticeable">Noticeable</option>
                  <option value="dramatic">Dramatic</option>
                </select>

                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={reaction.timing}
                    onChange={(e) => updateReaction(reaction.id, { timing: parseInt(e.target.value) || 0 })}
                    min={0}
                    max={120}
                    className="w-14 rounded-md border border-zinc-700 bg-zinc-800/50 px-2 py-1.5 text-xs text-zinc-200 focus:border-emerald-500/50 focus:outline-none"
                  />
                  <span className="text-xs text-zinc-500">s</span>
                </div>

                <button
                  type="button"
                  onClick={() => removeReaction(reaction.id)}
                  className="text-zinc-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={addReaction}
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
              <span>Atmosphere Preview</span>
            </div>
            <p className="text-xs text-zinc-500">
              {density === 'sparse' && 'A few pedestrians in the background, occasional glances'}
              {density === 'moderate' && 'Steady foot traffic, some stopping to listen'}
              {density === 'dense' && 'Packed sidewalk, crowd forming, buzz of reactions'}
              {' • '}
              {engagement === 'passive' && 'People mind their own business'}
              {engagement === 'reactive' && 'Visible reactions to hot takes'}
              {engagement === 'interactive' && 'People jump in with opinions'}
              {authorityFigureNearby && ' • Authority presence adds tension'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
