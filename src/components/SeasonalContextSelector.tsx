import { useState } from 'react';
import { Calendar } from 'lucide-react';
import type { SeasonalContext, Season, WeatherCondition, HolidayTheme, CityEvent } from '../lib/types';
import { SEASONS, WEATHER_CONDITIONS, HOLIDAY_THEMES, CITY_EVENTS } from '../lib/constants';

interface SeasonalContextSelectorProps {
  value: SeasonalContext | undefined;
  onChange: (context: SeasonalContext | undefined) => void;
  disabled?: boolean;
}


export function SeasonalContextSelector({ value, onChange, disabled }: SeasonalContextSelectorProps) {
  const [isEnabled, setIsEnabled] = useState(value?.enabled ?? false);
  const [season, setSeason] = useState<Season>(value?.season ?? 'fall');
  const [weather, setWeather] = useState<WeatherCondition>(value?.weather ?? 'clear');
  const [holiday, setHoliday] = useState<HolidayTheme>(value?.holiday ?? 'none');
  const [cityEvent, setCityEvent] = useState<CityEvent>(value?.cityEvent ?? 'none');
  const [decorations, setDecorations] = useState(value?.decorations ?? false);
  const [crowdAttire, setCrowdAttire] = useState<SeasonalContext['crowdAttire']>(value?.crowdAttire ?? 'business_as_usual');

  const enabled = isEnabled && !disabled;

  function toggleEnabled() {
    const newEnabled = !isEnabled;
    setIsEnabled(newEnabled);
    if (newEnabled) {
      onChange({
        enabled: true,
        season,
        weather,
        holiday,
        cityEvent,
        decorations,
        crowdAttire,
      });
    } else {
      onChange(undefined);
    }
  }

  function updateSeason(newSeason: Season) {
    setSeason(newSeason);
    // Auto-update attire based on season
    const newAttire = newSeason === 'summer' ? 'summer_light' 
      : newSeason === 'winter' ? 'winter_coats' 
      : 'business_as_usual';
    setCrowdAttire(newAttire);
    onChange({ enabled: true, season: newSeason, weather, holiday, cityEvent, decorations, crowdAttire: newAttire });
  }

  function updateWeather(newWeather: WeatherCondition) {
    setWeather(newWeather);
    const newAttire = newWeather === 'rainy' ? 'rain_gear' : crowdAttire;
    if (newWeather === 'rainy') setCrowdAttire(newAttire);
    onChange({ enabled: true, season, weather: newWeather, holiday, cityEvent, decorations, crowdAttire: newAttire });
  }

  function updateHoliday(newHoliday: HolidayTheme) {
    setHoliday(newHoliday);
    setDecorations(newHoliday !== 'none');
    onChange({ enabled: true, season, weather, holiday: newHoliday, cityEvent, decorations: newHoliday !== 'none', crowdAttire });
  }

  function updateCityEvent(newEvent: CityEvent) {
    setCityEvent(newEvent);
    onChange({ enabled: true, season, weather, holiday, cityEvent: newEvent, decorations, crowdAttire });
  }

  function toggleDecorations() {
    const newDecorations = !decorations;
    setDecorations(newDecorations);
    onChange({ enabled: true, season, weather, holiday, cityEvent, decorations: newDecorations, crowdAttire });
  }

  function updateAttire(newAttire: SeasonalContext['crowdAttire']) {
    setCrowdAttire(newAttire);
    onChange({ enabled: true, season, weather, holiday, cityEvent, decorations, crowdAttire: newAttire });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
              type="button"
              onClick={toggleEnabled}
              disabled={disabled}
              aria-label="Enable seasonal context"
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
            <span className="text-sm font-medium text-zinc-200">Seasonal Context</span>
            <p className="text-xs text-zinc-500">Holiday decorations, weather, city events</p>
          </div>
        </div>
      </div>

      {enabled && (
        <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          {/* Season Selection */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Season</label>
            <div className="flex gap-2">
              {SEASONS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => updateSeason(s.value)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border text-xs transition-all ${
                    season === s.value
                      ? 'bg-amber-500/15 border-amber-500/50 text-amber-400'
                      : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                  }`}
                >
                  <span className="text-base">{s.emoji}</span>
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Weather Selection */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Weather</label>
            <div className="flex gap-2">
              {WEATHER_CONDITIONS.map((w) => {
                return (
                  <button
                    key={w.value}
                    type="button"
                    onClick={() => updateWeather(w.value)}
                    className={`flex-1 flex flex-col items-center gap-1 px-2 py-2 rounded-lg border text-xs transition-all ${
                      weather === w.value
                        ? 'bg-blue-500/15 border-blue-500/50 text-blue-400'
                        : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                    }`}
                  >
                    <span className="text-base">{w.emoji}</span>
                    <span>{w.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Holiday Theme */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Holiday Theme</label>
            <select
              value={holiday}
              onChange={(e) => updateHoliday(e.target.value as HolidayTheme)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-xs text-zinc-200 focus:border-amber-500/50 focus:outline-none"
            >
              {HOLIDAY_THEMES.map((h) => (
                <option key={h.value} value={h.value}>
                  {h.emoji} {h.label} - {h.description}
                </option>
              ))}
            </select>
          </div>

          {/* City Event */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">City Event</label>
            <select
              value={cityEvent}
              onChange={(e) => updateCityEvent(e.target.value as CityEvent)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-xs text-zinc-200 focus:border-amber-500/50 focus:outline-none"
            >
              {CITY_EVENTS.map((e) => (
                <option key={e.value} value={e.value}>
                  {e.emoji} {e.label} - {e.description}
                </option>
              ))}
            </select>
          </div>

          {/* Decorations Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">Show decorations in background</span>
            <button
              type="button"
              onClick={toggleDecorations}
              className={`relative h-5 w-9 rounded-full transition-colors ${
                decorations ? 'bg-amber-500' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                  decorations ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Crowd Attire */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Crowd Attire</label>
            <div className="flex gap-1">
              {[
                { value: 'summer_light', label: 'Summer Light' },
                { value: 'winter_coats', label: 'Winter Coats' },
                { value: 'rain_gear', label: 'Rain Gear' },
                { value: 'business_as_usual', label: 'Business' },
              ].map((attire) => (
                <button
                  key={attire.value}
                  type="button"
                  onClick={() => updateAttire(attire.value as SeasonalContext['crowdAttire'])}
                  className={`flex-1 px-2 py-1.5 rounded-md border text-[10px] transition-all ${
                    crowdAttire === attire.value
                      ? 'bg-amber-500/15 border-amber-500/50 text-amber-400'
                      : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                  }`}
                >
                  {attire.label}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-lg bg-zinc-800/30 p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <Calendar className="h-3.5 w-3.5" />
              <span>Context Preview</span>
            </div>
            <p className="text-xs text-zinc-300">
              {SEASONS.find(s => s.value === season)?.emoji} {SEASONS.find(s => s.value === season)?.label}
              {' • '}
              {WEATHER_CONDITIONS.find(w => w.value === weather)?.emoji} {WEATHER_CONDITIONS.find(w => w.value === weather)?.label}
              {holiday !== 'none' && (
                <>
                  {' • '}
                  {HOLIDAY_THEMES.find(h => h.value === holiday)?.emoji} {HOLIDAY_THEMES.find(h => h.value === holiday)?.label}
                </>
              )}
              {cityEvent !== 'none' && (
                <>
                  {' • '}
                  {CITY_EVENTS.find(e => e.value === cityEvent)?.emoji} {CITY_EVENTS.find(e => e.value === cityEvent)?.label}
                </>
              )}
            </p>
            <p className="text-xs text-zinc-500">
              Platform atmosphere: {decorations ? 'Decorated' : 'Standard'} • 
              Crowd wearing: {crowdAttire.replace('_', ' ')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
