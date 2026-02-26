import { useState } from 'react';
import { Plus, Trash2, Clock, ArrowRight } from 'lucide-react';
import type { StreetMultiLocationJourney, StreetJourneyStop, StreetLocation } from '../lib/types';
import { STREET_LOCATIONS } from '../lib/constants';

interface StreetJourneyBuilderProps {
  value: StreetMultiLocationJourney | undefined;
  onChange: (journey: StreetMultiLocationJourney | undefined) => void;
  disabled?: boolean;
}

const NARRATIVE_ARCS = [
  { value: 'discovery', label: 'Discovery', description: 'Uncovering something new together', emoji: '🔍' },
  { value: 'debate', label: 'Debate', description: 'Back-and-forth argument that evolves', emoji: '⚔️' },
  { value: 'transformation', label: 'Transformation', description: 'Changing perspectives by the end', emoji: '🦋' },
  { value: 'cultural_exploration', label: 'Cultural', description: 'Exploring neighborhood culture', emoji: '🌍' },
] as const;


const PURPOSE_COLORS: Record<StreetJourneyStop['narrativePurpose'], { bg: string; border: string; text: string }> = {
  hook: { bg: 'bg-emerald-500/15', border: 'border-emerald-500/50', text: 'text-emerald-400' },
  development: { bg: 'bg-blue-500/15', border: 'border-blue-500/50', text: 'text-blue-400' },
  climax: { bg: 'bg-rose-500/15', border: 'border-rose-500/50', text: 'text-rose-400' },
  resolution: { bg: 'bg-amber-500/15', border: 'border-amber-500/50', text: 'text-amber-400' },
};

const LOCATION_NAMES: Record<StreetLocation, string[]> = {
  coffee_shop: ['Blue Bottle Coffee', 'Starbucks', 'Joe\'s Cafe', 'Local Roasters', 'The Coffee Shop'],
  park: ['Washington Square Park', 'Bryant Park', 'Central Park Bench', 'Union Square', 'Madison Square'],
  landmark: ['Brooklyn Bridge', 'Times Square', 'Empire State', 'Flatiron Building', 'Charging Bull'],
  street_corner: ['Broadway & 42nd', '5th & 23rd', 'Canal & Bowery', '14th & 8th', 'Houston & Lafayette'],
  shopping_area: ['5th Avenue', 'SoHo District', 'Chelsea Market', 'Brooklyn Flea', 'Union Square Holiday Market'],
};

export function StreetJourneyBuilder({ value, onChange, disabled }: StreetJourneyBuilderProps) {
  const [isEnabled, setIsEnabled] = useState(value?.enabled ?? false);
  const [stops, setStops] = useState<StreetJourneyStop[]>(value?.stops ?? []);
  const [narrativeArc, setNarrativeArc] = useState<StreetMultiLocationJourney['narrativeArc']>(value?.narrativeArc ?? 'discovery');

  const enabled = isEnabled && !disabled;

  function toggleEnabled() {
    const newEnabled = !isEnabled;
    setIsEnabled(newEnabled);
    if (newEnabled && stops.length === 0) {
      const initialStops: StreetJourneyStop[] = [
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

  function createStop(purpose: StreetJourneyStop['narrativePurpose']): StreetJourneyStop {
    const location: StreetLocation = purpose === 'hook' ? 'coffee_shop' : 
      purpose === 'development' ? 'park' : 
      purpose === 'climax' ? 'landmark' : 'street_corner';
    
    return {
      id: Math.random().toString(36).substring(7),
      location,
      locationName: LOCATION_NAMES[location][0],
      duration: purpose === 'hook' ? 15 : purpose === 'resolution' ? 10 : 20,
      narrativePurpose: purpose,
      transitionType: 'walking',
    };
  }

  function updateStop(id: string, updates: Partial<StreetJourneyStop>) {
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
    if (stops.length <= 2) return;
    const newStops = stops.filter(s => s.id !== id);
    setStops(newStops);
    onChange({
      enabled: true,
      stops: newStops,
      totalDuration: newStops.reduce((sum, s) => sum + s.duration, 0),
      narrativeArc,
    });
  }

  function updateNarrativeArc(arc: StreetMultiLocationJourney['narrativeArc']) {
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
              aria-label="Enable multi-location journey"
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
            <span className="text-sm font-medium text-zinc-200">Multi-Location Journey</span>
            <p className="text-xs text-zinc-500">Coffee shop → Park → Landmark progression</p>
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
                      ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400'
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
              const locations = LOCATION_NAMES[stop.location];

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
                      value={stop.location}
                      onChange={(e) => {
                        const newLocation = e.target.value as StreetLocation;
                        updateStop(stop.id, { 
                          location: newLocation,
                          locationName: LOCATION_NAMES[newLocation][0]
                        });
                      }}
                      className="rounded-md border border-zinc-700 bg-zinc-800/50 px-2 py-1.5 text-xs text-zinc-200 focus:border-emerald-500/50 focus:outline-none"
                    >
                      {STREET_LOCATIONS.map((loc) => (
                        <option key={loc.value} value={loc.value}>
                          {loc.emoji} {loc.label}
                        </option>
                      ))}
                    </select>

                    <select
                      value={stop.locationName}
                      onChange={(e) => updateStop(stop.id, { locationName: e.target.value })}
                      className="rounded-md border border-zinc-700 bg-zinc-800/50 px-2 py-1.5 text-xs text-zinc-200 focus:border-emerald-500/50 focus:outline-none"
                    >
                      {locations.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>

                    <select
                      value={stop.duration}
                      onChange={(e) => updateStop(stop.id, { duration: parseInt(e.target.value) })}
                      className="rounded-md border border-zinc-700 bg-zinc-800/50 px-2 py-1.5 text-xs text-zinc-200 focus:border-emerald-500/50 focus:outline-none"
                    >
                      {[10, 15, 20, 25, 30].map((d) => (
                        <option key={d} value={d}>{d}s</option>
                      ))}
                    </select>

                    <select
                      value={stop.transitionType}
                      onChange={(e) => updateStop(stop.id, { transitionType: e.target.value as StreetJourneyStop['transitionType'] })}
                      className="rounded-md border border-zinc-700 bg-zinc-800/50 px-2 py-1.5 text-xs text-zinc-200 focus:border-emerald-500/50 focus:outline-none"
                    >
                      <option value="walking">🚶 Walking</option>
                      <option value="cut">✂️ Cut</option>
                      <option value="fade">🎬 Fade</option>
                    </select>
                  </div>

                  <input
                    type="text"
                    value={stop.question || ''}
                    onChange={(e) => updateStop(stop.id, { question: e.target.value })}
                    placeholder="Question for this stop (optional)"
                    className="w-full rounded-md border border-zinc-700 bg-zinc-800/50 px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:border-emerald-500/50 focus:outline-none"
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
