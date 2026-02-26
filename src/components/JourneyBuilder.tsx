import { useState } from 'react';
import { Plus, Trash2, Clock, ArrowRight } from 'lucide-react';
import type { MultiStopJourney, JourneyStop, SubwaySceneType, SubwayLine } from '../lib/types';
import { SUBWAY_LINES, SUBWAY_STATIONS, SUBWAY_SCENES } from '../lib/constants';

interface JourneyBuilderProps {
  value: MultiStopJourney | undefined;
  onChange: (journey: MultiStopJourney | undefined) => void;
  disabled?: boolean;
}

const NARRATIVE_ARCS = [
  { value: 'discovery', label: 'Discovery', description: 'Uncovering something new together', emoji: '🔍' },
  { value: 'debate', label: 'Debate', description: 'Back-and-forth argument that evolves', emoji: '⚔️' },
  { value: 'transformation', label: 'Transformation', description: 'Changing perspectives by the end', emoji: '🦋' },
  { value: 'mystery', label: 'Mystery', description: 'Unraveling a question across stops', emoji: '🕵️' },
] as const;

const PURPOSE_COLORS: Record<JourneyStop['narrativePurpose'], { bg: string; border: string; text: string }> = {
  hook: { bg: 'bg-amber-500/15', border: 'border-amber-500/50', text: 'text-amber-400' },
  development: { bg: 'bg-blue-500/15', border: 'border-blue-500/50', text: 'text-blue-400' },
  climax: { bg: 'bg-rose-500/15', border: 'border-rose-500/50', text: 'text-rose-400' },
  resolution: { bg: 'bg-emerald-500/15', border: 'border-emerald-500/50', text: 'text-emerald-400' },
};

export function JourneyBuilder({ value, onChange, disabled }: JourneyBuilderProps) {
  const [isEnabled, setIsEnabled] = useState(value?.enabled ?? false);
  const [stops, setStops] = useState<JourneyStop[]>(value?.stops ?? []);
  const [narrativeArc, setNarrativeArc] = useState<MultiStopJourney['narrativeArc']>(value?.narrativeArc ?? 'discovery');

  const enabled = isEnabled && !disabled;

  function toggleEnabled() {
    const newEnabled = !isEnabled;
    setIsEnabled(newEnabled);
    if (newEnabled && stops.length === 0) {
      // Add initial stops
      const initialStops: JourneyStop[] = [
        createStop('hook'),
        createStop('development'),
        createStop('climax'),
        createStop('resolution'),
      ];
      setStops(initialStops);
      onChange({
        enabled: true,
        stops: initialStops,
        totalDuration: initialStops.reduce((sum, s) => sum + s.duration, 0),
        narrativeArc,
      });
    } else if (!newEnabled) {
      onChange(undefined);
    }
  }

  function createStop(purpose: JourneyStop['narrativePurpose']): JourneyStop {
    return {
      id: Math.random().toString(36).substring(7),
      stationName: 'Times Square',
      line: 'any',
      sceneType: 'platform_waiting',
      duration: purpose === 'hook' ? 15 : purpose === 'resolution' ? 10 : 20,
      narrativePurpose: purpose,
      question: '',
    };
  }

  function updateStop(id: string, updates: Partial<JourneyStop>) {
    const newStops = stops.map(s => s.id === id ? { ...s, ...updates } : s);
    setStops(newStops);
    onChange({
      enabled: true,
      stops: newStops,
      totalDuration: newStops.reduce((sum, s) => sum + s.duration, 0),
      narrativeArc,
    });
  }

  function addStop() {
    const newStop = createStop('development');
    const newStops = [...stops, newStop];
    setStops(newStops);
    onChange({
      enabled: true,
      stops: newStops,
      totalDuration: newStops.reduce((sum, s) => sum + s.duration, 0),
      narrativeArc,
    });
  }

  function removeStop(id: string) {
    if (stops.length <= 2) return; // Minimum 2 stops
    const newStops = stops.filter(s => s.id !== id);
    setStops(newStops);
    onChange({
      enabled: true,
      stops: newStops,
      totalDuration: newStops.reduce((sum, s) => sum + s.duration, 0),
      narrativeArc,
    });
  }

  function updateNarrativeArc(arc: MultiStopJourney['narrativeArc']) {
    setNarrativeArc(arc);
    onChange({
      enabled: true,
      stops,
      totalDuration: stops.reduce((sum, s) => sum + s.duration, 0),
      narrativeArc: arc,
    });
  }

  const totalDuration = stops.reduce((sum, s) => sum + s.duration, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
              type="button"
              onClick={toggleEnabled}
              disabled={disabled}
              aria-label="Enable multi-stop journey mode"
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
            <span className="text-sm font-medium text-zinc-200">Multi-Stop Journey</span>
            <p className="text-xs text-zinc-500">Episode across multiple subway stops</p>
          </div>
        </div>
        {isEnabled && (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Clock className="h-4 w-4" />
            {totalDuration}s total
          </div>
        )}
      </div>

      {enabled && (
        <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          {/* Narrative Arc Selection */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Narrative Arc</label>
            <div className="flex flex-wrap gap-2">
              {NARRATIVE_ARCS.map((arc) => (
                <button
                  key={arc.value}
                  type="button"
                  onClick={() => updateNarrativeArc(arc.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-all ${
                    narrativeArc === arc.value
                      ? 'bg-amber-500/15 border-amber-500/50 text-amber-400'
                      : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                  }`}
                >
                  <span>{arc.emoji}</span>
                  <span>{arc.label}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-zinc-500">
              {NARRATIVE_ARCS.find(a => a.value === narrativeArc)?.description}
            </p>
          </div>

          {/* Stops List */}
          <div className="space-y-3">
            <label className="text-xs font-medium text-zinc-400">Journey Stops</label>
            {stops.map((stop, index) => {
              const colors = PURPOSE_COLORS[stop.narrativePurpose];
              const stations = SUBWAY_STATIONS[stop.line] || SUBWAY_STATIONS.any;

              return (
                <div
                  key={stop.id}
                  className={`rounded-lg border ${colors.border} ${colors.bg} p-3 space-y-3`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium ${colors.text}`}>
                        Stop {index + 1}: {stop.narrativePurpose.charAt(0).toUpperCase() + stop.narrativePurpose.slice(1)}
                      </span>
                      {index < stops.length - 1 && (
                        <ArrowRight className="h-3 w-3 text-zinc-600" />
                      )}
                    </div>
                    {stops.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeStop(stop.id)}
                        className="text-zinc-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={stop.line}
                      onChange={(e) => updateStop(stop.id, { line: e.target.value as SubwayLine })}
                      className="rounded-md border border-zinc-700 bg-zinc-800/50 px-2 py-1.5 text-xs text-zinc-200 focus:border-amber-500/50 focus:outline-none"
                    >
                      {SUBWAY_LINES.map((line) => (
                        <option key={line.value} value={line.value}>
                          {line.label}
                        </option>
                      ))}
                    </select>

                    <select
                      value={stop.stationName}
                      onChange={(e) => updateStop(stop.id, { stationName: e.target.value })}
                      className="rounded-md border border-zinc-700 bg-zinc-800/50 px-2 py-1.5 text-xs text-zinc-200 focus:border-amber-500/50 focus:outline-none"
                    >
                      {stations.map((station) => (
                        <option key={station} value={station}>
                          {station}
                        </option>
                      ))}
                    </select>

                    <select
                      value={stop.sceneType}
                      onChange={(e) => updateStop(stop.id, { sceneType: e.target.value as SubwaySceneType })}
                      className="rounded-md border border-zinc-700 bg-zinc-800/50 px-2 py-1.5 text-xs text-zinc-200 focus:border-amber-500/50 focus:outline-none"
                    >
                      {SUBWAY_SCENES.map((scene) => (
                        <option key={scene.value} value={scene.value}>
                          {scene.label}
                        </option>
                      ))}
                    </select>

                    <select
                      value={stop.duration}
                      onChange={(e) => updateStop(stop.id, { duration: parseInt(e.target.value) })}
                      className="rounded-md border border-zinc-700 bg-zinc-800/50 px-2 py-1.5 text-xs text-zinc-200 focus:border-amber-500/50 focus:outline-none"
                    >
                      {[10, 15, 20, 25, 30].map((d) => (
                        <option key={d} value={d}>{d}s</option>
                      ))}
                    </select>
                  </div>

                  <input
                    type="text"
                    value={stop.question || ''}
                    onChange={(e) => updateStop(stop.id, { question: e.target.value })}
                    placeholder="Question for this stop (optional)"
                    className="w-full rounded-md border border-zinc-700 bg-zinc-800/50 px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none"
                  />
                </div>
              );
            })}

            <button
              type="button"
              onClick={addStop}
              className="flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-dashed border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300 transition-colors text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Stop
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
