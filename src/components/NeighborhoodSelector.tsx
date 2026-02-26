import { Info } from 'lucide-react';
import type { Neighborhood } from '../lib/types';
import { NEIGHBORHOODS, NEIGHBORHOOD_PERSONALITIES } from '../lib/constants';

interface NeighborhoodSelectorProps {
  value: Neighborhood | undefined;
  onChange: (neighborhood: Neighborhood | undefined) => void;
  disabled?: boolean;
}

export function NeighborhoodSelector({ value, onChange, disabled }: NeighborhoodSelectorProps) {
  const selectedNeighborhood = value;
  const personality = selectedNeighborhood ? NEIGHBORHOOD_PERSONALITIES[selectedNeighborhood] : null;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-300">Neighborhood Personality</label>
        <p className="text-xs text-zinc-500">Each NYC neighborhood has its own distinct vibe</p>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {NEIGHBORHOODS.map((neighborhood) => {
          const isSelected = selectedNeighborhood === neighborhood.value;
          
          return (
            <button
              key={neighborhood.value}
              type="button"
              onClick={() => onChange(isSelected ? undefined : neighborhood.value)}
              disabled={disabled}
              aria-label={`Select ${neighborhood.label} neighborhood`}
              aria-pressed={isSelected}
              className={`relative flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${
                isSelected
                  ? 'border-emerald-500/50 bg-emerald-500/10'
                  : 'border-zinc-700 bg-zinc-800/30 hover:border-zinc-600'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {/* Neighborhood Circle */}
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white mb-2"
                style={{ backgroundColor: neighborhood.color }}
              >
                {neighborhood.label.charAt(0)}
              </div>
              <span className={`text-xs font-medium ${isSelected ? 'text-emerald-200' : 'text-zinc-400'}`}>
                {neighborhood.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected Neighborhood Details */}
      {selectedNeighborhood && personality && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white shrink-0"
              style={{ backgroundColor: NEIGHBORHOODS.find(n => n.value === selectedNeighborhood)?.color }}
            >
              {NEIGHBORHOODS.find(n => n.value === selectedNeighborhood)?.label.charAt(0)}
            </div>
            <div>
              <h4 className="text-sm font-medium text-zinc-200">
                {NEIGHBORHOODS.find(n => n.value === selectedNeighborhood)?.label}
              </h4>
              <p className="text-xs text-zinc-500">
                {NEIGHBORHOODS.find(n => n.value === selectedNeighborhood)?.description}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Info className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-xs font-medium text-zinc-400">Vibe</span>
            </div>
            <p className="text-xs text-zinc-300 pl-5">{personality.vibe}</p>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-medium text-zinc-400">Typical People</span>
            <div className="flex flex-wrap gap-1">
              {personality.typicalPeople.map((person, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded-full bg-zinc-800 text-[10px] text-zinc-400"
                >
                  {person}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-medium text-zinc-400">Visual Cues</span>
            <div className="flex flex-wrap gap-1">
              {personality.visualCues.map((cue, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-[10px] text-emerald-400 border border-emerald-500/20"
                >
                  {cue}
                </span>
              ))}
            </div>
          </div>

          <p className="text-xs text-zinc-500 italic">{personality.atmosphere}</p>
        </div>
      )}
    </div>
  );
}
