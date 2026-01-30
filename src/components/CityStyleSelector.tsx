import { Train, MapPin } from 'lucide-react';
import type { CityStyle } from '../lib/types';
import { CITY_STYLES } from '../lib/constants';

interface CityStyleSelectorProps {
  value: CityStyle | null;
  onChange: (value: CityStyle) => void;
  compact?: boolean;
}

const CITY_THEMES: Record<CityStyle, { primary: string; secondary: string; accent: string; icon: string }> = {
  nyc: {
    primary: 'from-yellow-500/20 to-zinc-800/80',
    secondary: 'border-yellow-500/40',
    accent: 'text-yellow-400',
    icon: 'bg-yellow-500/20',
  },
  london: {
    primary: 'from-red-500/20 to-zinc-800/80',
    secondary: 'border-red-500/40',
    accent: 'text-red-400',
    icon: 'bg-red-500/20',
  },
  tokyo: {
    primary: 'from-sky-500/20 to-zinc-800/80',
    secondary: 'border-sky-500/40',
    accent: 'text-sky-400',
    icon: 'bg-sky-500/20',
  },
  paris: {
    primary: 'from-emerald-500/20 to-zinc-800/80',
    secondary: 'border-emerald-500/40',
    accent: 'text-emerald-400',
    icon: 'bg-emerald-500/20',
  },
  generic: {
    primary: 'from-zinc-500/20 to-zinc-800/80',
    secondary: 'border-zinc-500/40',
    accent: 'text-zinc-400',
    icon: 'bg-zinc-500/20',
  },
};

export function CityStyleSelector({ value, onChange, compact = false }: CityStyleSelectorProps) {
  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {CITY_STYLES.map((city) => {
          const isSelected = value === city.value;
          const theme = CITY_THEMES[city.value];

          return (
            <button
              key={city.value}
              type="button"
              onClick={() => onChange(city.value)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                isSelected
                  ? `bg-gradient-to-r ${theme.primary} ${theme.secondary} ring-1 ring-${city.value === 'nyc' ? 'yellow' : city.value === 'london' ? 'red' : city.value === 'tokyo' ? 'sky' : city.value === 'paris' ? 'emerald' : 'zinc'}-500/30`
                  : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600'
              }`}
            >
              <Train className={`h-4 w-4 ${isSelected ? theme.accent : 'text-zinc-500'}`} />
              <span className={`text-sm font-medium ${isSelected ? theme.accent : 'text-zinc-300'}`}>
                {city.label.split(' ')[0]}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-zinc-500" />
        <label className="text-sm font-medium text-zinc-300">Subway Style</label>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {CITY_STYLES.map((city) => {
          const isSelected = value === city.value;
          const theme = CITY_THEMES[city.value];

          return (
            <button
              key={city.value}
              type="button"
              onClick={() => onChange(city.value)}
              className={`relative overflow-hidden rounded-xl border p-4 transition-all ${
                isSelected
                  ? `${theme.secondary} ring-1 ring-offset-1 ring-offset-zinc-900`
                  : 'border-zinc-700 hover:border-zinc-600'
              }`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${theme.primary} opacity-50`} />
              <div className="relative">
                <div
                  className={`inline-flex items-center justify-center w-10 h-10 rounded-lg mb-3 ${
                    isSelected ? theme.icon : 'bg-zinc-700/50'
                  }`}
                >
                  <Train className={`h-5 w-5 ${isSelected ? theme.accent : 'text-zinc-400'}`} />
                </div>
                <div className={`text-sm font-medium ${isSelected ? theme.accent : 'text-zinc-200'}`}>
                  {city.label.split(' ')[0]}
                </div>
                <div className="text-xs text-zinc-500 mt-1 line-clamp-2">
                  {city.description}
                </div>
              </div>
              {isSelected && (
                <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
                  city.value === 'nyc' ? 'bg-yellow-400' :
                  city.value === 'london' ? 'bg-red-400' :
                  city.value === 'tokyo' ? 'bg-sky-400' :
                  city.value === 'paris' ? 'bg-emerald-400' : 'bg-zinc-400'
                }`} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
