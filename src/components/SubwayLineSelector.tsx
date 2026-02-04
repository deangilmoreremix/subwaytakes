import { TrainFront, Info } from 'lucide-react';
import type { SubwayLine } from '../lib/types';
import { SUBWAY_LINES, LINE_PERSONALITIES } from '../lib/constants';

interface SubwayLineSelectorProps {
  value: SubwayLine | undefined;
  onChange: (line: SubwayLine | undefined) => void;
  disabled?: boolean;
}

export function SubwayLineSelector({ value, onChange, disabled }: SubwayLineSelectorProps) {
  const selectedLine = value || 'any';
  const personality = LINE_PERSONALITIES[selectedLine];

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-300">Subway Line Personality</label>
        <p className="text-xs text-zinc-500">Each NYC line has its own distinct vibe and typical riders</p>
      </div>

      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
        {SUBWAY_LINES.map((line) => {
          const isSelected = selectedLine === line.value;
          
          return (
            <button
              key={line.value}
              type="button"
              onClick={() => onChange(line.value === 'any' ? undefined : line.value)}
              disabled={disabled}
              aria-label={`Select ${line.label} subway line`}
              aria-pressed={isSelected}
              className={`relative flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${
                isSelected
                  ? 'border-amber-500/50 bg-amber-500/10'
                  : 'border-zinc-700 bg-zinc-800/30 hover:border-zinc-600'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {/* Line Circle */}
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white mb-1"
                style={{ backgroundColor: line.color }}
              >
                {line.value === 'any' ? '?' : line.value}
              </div>
              <span className={`text-[10px] ${isSelected ? 'text-amber-200' : 'text-zinc-400'}`}>
                {line.value === 'any' ? 'Any' : line.label.split(' ')[0]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected Line Details */}
      {selectedLine !== 'any' && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold text-white shrink-0"
              style={{ backgroundColor: SUBWAY_LINES.find(l => l.value === selectedLine)?.color }}
            >
              {selectedLine}
            </div>
            <div>
              <h4 className="text-sm font-medium text-zinc-200">
                {SUBWAY_LINES.find(l => l.value === selectedLine)?.label}
              </h4>
              <p className="text-xs text-zinc-500">
                {SUBWAY_LINES.find(l => l.value === selectedLine)?.description}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Info className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-xs font-medium text-zinc-400">Vibe</span>
            </div>
            <p className="text-xs text-zinc-300 pl-5">{personality?.vibe}</p>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-medium text-zinc-400">Typical Riders</span>
            <div className="flex flex-wrap gap-1">
              {personality?.typicalRiders.map((rider, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded-full bg-zinc-800 text-[10px] text-zinc-400"
                >
                  {rider}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div>
              <span className="text-zinc-500">Energy: </span>
              <span className="text-zinc-300 capitalize">{personality?.energy}</span>
            </div>
          </div>

          <p className="text-xs text-zinc-500 italic">{personality?.atmosphere}</p>
        </div>
      )}
    </div>
  );
}
