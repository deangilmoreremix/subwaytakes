import { useState } from 'react';
import { Calendar, Cloud, Sun, Snowflake, CloudRain, Wind, Umbrella, Thermometer, Trophy } from 'lucide-react';
import type { StreetSeasonalContext, Season, WeatherCondition, StreetFestival, HolidayTheme } from '../lib/types';
import { SEASONS, WEATHER_CONDITIONS, HOLIDAY_THEMES, STREET_FESTIVALS } from '../lib/constants';

interface StreetSeasonalSelectorProps {
  value: StreetSeasonalContext | undefined;
  onChange: (context: StreetSeasonalContext | undefined) => void;
  disabled?: boolean;
}

const WEATHER_ICONS: Record<WeatherCondition, typeof Sun> = {
  clear: Sun,
  rainy: CloudRain,
  snowy: Snowflake,
  humid: Thermometer,
  windy: Wind,
};

export function StreetSeasonalSelector({ value, onChange, disabled }: StreetSeasonalSelectorProps) {
  const [isEnabled, setIsEnabled] = useState(value?.enabled ?? false);
  const [season, setSeason] = useState<Season>(value?.season ?? 'fall');
  const [weather, setWeather] = useState<WeatherCondition>(value?.weather ?? 'clear');
  const [festival, setFestival] = useState<StreetFestival>(value?.festival ?? 'none');
  const [holidayDecorations, setHolidayDecorations] = useState<HolidayTheme | undefined>(value?.holidayDecorations);
  const [sportingEvent, setSportingEvent] = useState(value?.sportingEvent ?? false);
  const [crowdAttire, setCrowdAttire] = useState<StreetSeasonalContext['crowdAttire']>(value?.crowdAttire ?? 'business_as_usual');

  const enabled = isEnabled && !disabled;

  function toggleEnabled() {
    const newEnabled = !isEnabled;
    setIsEnabled(newEnabled);
    if (newEnabled) {
      onChange({
        enabled: true,
        season,
        weather,
        festival,
        holidayDecorations,
        sportingEvent,
        crowdAttire,
      });
    } else {
      onChange(undefined);
    }
  }

  function updateSeason(newSeason: Season) {
    setSeason(newSeason);
    const newAttire = newSeason === 'summer' ? 'summer_light' 
      : newSeason === 'winter' ? 'winter_coats' 
      : 'business_as_usual';
    setCrowdAttire(newAttire);
    onChange({ enabled: true, season: newSeason, weather, festival, holidayDecorations, sportingEvent, crowdAttire: newAttire });
  }

  function updateWeather(newWeather: WeatherCondition) {
    setWeather(newWeather);
    const newAttire = newWeather === 'rainy' ? 'rain_gear' : crowdAttire;
    if (newWeather === 'rainy') setCrowdAttire(newAttire);
    onChange({ enabled: true, season, weather: newWeather, festival, holidayDecorations, sportingEvent, crowdAttire: newAttire });
  }

  function updateFestival(newFestival: StreetFestival) {
    setFestival(newFestival);
    onChange({ enabled: true, season, weather, festival: newFestival, holidayDecorations, sportingEvent, crowdAttire });
  }

  function updateHolidayDecorations(newHoliday: HolidayTheme | undefined) {
    setHolidayDecorations(newHoliday);
    onChange({ enabled: true, season, weather, festival, holidayDecorations: newHoliday, sportingEvent, crowdAttire });
  }

  function toggleSportingEvent() {
    const newValue = !sportingEvent;
    setSportingEvent(newValue);
    onChange({ enabled: true, season, weather, festival, holidayDecorations, sportingEvent: newValue, crowdAttire });
  }

  function updateAttire(newAttire: StreetSeasonalContext['crowdAttire']) {
    setCrowdAttire(newAttire);
    onChange({ enabled: true, season, weather, festival, holidayDecorations, sportingEvent, crowdAttire: newAttire });
  }

  const WeatherIcon = WEATHER_ICONS[weather];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
              type="button"
              onClick={toggleEnabled}
              disabled={disabled}
              aria-label="Enable seasonal/cultural context"
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
            <span className="text-sm font-medium text-zinc-200">Seasonal/Cultural Context</span>
            <p className="text-xs text-zinc-500">Street festivals, holiday decorations, sporting events</p>
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
                      ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400'
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
                const Icon = WEATHER_ICONS[w.value];
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

          {/* Festival Selection */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Street Festival</label>
            <select
              value={festival}
              onChange={(e) => updateFestival(e.target.value as StreetFestival)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-xs text-zinc-200 focus:border-emerald-500/50 focus:outline-none"
            >
              {STREET_FESTIVALS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.emoji} {f.label} - {f.description}
                </option>
              ))}
            </select>
          </div>

          {/* Holiday Decorations */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Holiday Decorations</label>
            <select
              value={holidayDecorations || ''}
              onChange={(e) => updateHolidayDecorations(e.target.value as HolidayTheme || undefined)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-xs text-zinc-200 focus:border-emerald-500/50 focus:outline-none"
            >
              <option value="">No Holiday Decorations</option>
              {HOLIDAY_THEMES.filter(h => h.value !== 'none').map((h) => (
                <option key={h.value} value={h.value}>
                  {h.emoji} {h.label}
                </option>
              ))}
            </select>
          </div>

          {/* Sporting Event Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-zinc-500" />
              <span className="text-xs text-zinc-400">Major sporting event nearby</span>
            </div>
            <button
              type="button"
              onClick={toggleSportingEvent}
              className={`relative h-5 w-9 rounded-full transition-colors ${
                sportingEvent ? 'bg-emerald-500' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                  sportingEvent ? 'translate-x-4' : 'translate-x-0'
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
                  onClick={() => updateAttire(attire.value as StreetSeasonalContext['crowdAttire'])}
                  className={`flex-1 px-2 py-1.5 rounded-md border text-[10px] transition-all ${
                    crowdAttire === attire.value
                      ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400'
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
              {festival !== 'none' && (
                <>
                  {' • '}
                  {STREET_FESTIVALS.find(f => f.value === festival)?.emoji} {STREET_FESTIVALS.find(f => f.value === festival)?.label}
                </>
              )}
              {holidayDecorations && (
                <>
                  {' • '}
                  {HOLIDAY_THEMES.find(h => h.value === holidayDecorations)?.emoji} Decorations
                </>
              )}
              {sportingEvent && ' • 🏆 Sporting Event'}
            </p>
            <p className="text-xs text-zinc-500">
              Crowd wearing: {crowdAttire.replace('_', ' ')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
