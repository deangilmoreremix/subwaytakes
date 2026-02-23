import { useState } from 'react';
import { MapPin, ChevronDown } from 'lucide-react';
import { CITY_STYLES } from '../lib/constants';
import type { CityStyle } from '../lib/types';

interface LocationSelectorProps {
  cityStyle: CityStyle;
  onCityStyleChange: (v: CityStyle) => void;
  customLocation: string;
  onCustomLocationChange: (v: string) => void;
  variant?: 'subway' | 'street' | 'general';
  disabled?: boolean;
}

const LOCATION_SUGGESTIONS: Record<string, string[]> = {
  subway: [
    'Underground tunnel with flickering fluorescent lights',
    'Crowded morning rush hour platform',
    'Empty late-night station with distant echo',
    'Vintage mosaic tile station with ornate ceiling',
  ],
  street: [
    'Bustling food market with steam rising from carts',
    'Graffiti-lined alleyway with string lights',
    'Rainy downtown crosswalk at dusk',
    'Sun-drenched boardwalk near the waterfront',
  ],
  general: [
    'Urban rooftop with city skyline backdrop',
    'Quiet park bench under autumn trees',
    'Neon-lit corner store at midnight',
  ],
};

export function LocationSelector({
  cityStyle,
  onCityStyleChange,
  customLocation,
  onCustomLocationChange,
  variant = 'general',
  disabled = false,
}: LocationSelectorProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestions = LOCATION_SUGGESTIONS[variant] || LOCATION_SUGGESTIONS.general;

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-zinc-300">
        <MapPin className="inline w-4 h-4 mr-1.5 -mt-0.5 text-zinc-400" />
        Location
      </label>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {CITY_STYLES.map((city) => (
          <button
            key={city.value}
            type="button"
            disabled={disabled}
            onClick={() => {
              onCityStyleChange(city.value);
              if (city.value !== 'custom') onCustomLocationChange('');
            }}
            className={`px-3 py-2.5 rounded-xl border text-left transition-all text-sm ${
              cityStyle === city.value
                ? 'border-amber-500/60 bg-amber-500/10 text-amber-300'
                : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span className="block font-medium">{city.label}</span>
            <span className="block text-xs mt-0.5 opacity-70 leading-tight">{city.description}</span>
          </button>
        ))}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onCityStyleChange('custom')}
          className={`px-3 py-2.5 rounded-xl border text-left transition-all text-sm ${
            cityStyle === 'custom'
              ? 'border-amber-500/60 bg-amber-500/10 text-amber-300'
              : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <span className="block font-medium">Custom</span>
          <span className="block text-xs mt-0.5 opacity-70 leading-tight">Describe your own location</span>
        </button>
      </div>

      {cityStyle === 'custom' && (
        <div className="relative">
          <textarea
            value={customLocation}
            onChange={(e) => onCustomLocationChange(e.target.value.slice(0, 200))}
            placeholder="Describe your location..."
            disabled={disabled}
            rows={2}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 focus:outline-none resize-none transition-colors disabled:opacity-50"
          />
          <div className="flex items-center justify-between mt-1.5">
            <button
              type="button"
              onClick={() => setShowSuggestions(!showSuggestions)}
              className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
            >
              Suggestions
              <ChevronDown className={`w-3 h-3 transition-transform ${showSuggestions ? 'rotate-180' : ''}`} />
            </button>
            <span className="text-xs text-zinc-600">{customLocation.length}/200</span>
          </div>

          {showSuggestions && (
            <div className="mt-2 space-y-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    onCustomLocationChange(s);
                    setShowSuggestions(false);
                  }}
                  className="block w-full text-left text-xs px-3 py-2 rounded-lg border border-zinc-700/50 bg-zinc-800/30 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
