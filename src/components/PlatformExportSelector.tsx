import { useState } from 'react';
import { Share2, ChevronDown, ChevronUp, Smartphone, Monitor } from 'lucide-react';
import { PLATFORM_SPECS } from '../lib/constants';
import { clsx } from '../lib/format';
import type { ExportPlatform } from '../lib/types';

interface PlatformExportSelectorProps {
  value: ExportPlatform[];
  onChange: (platforms: ExportPlatform[]) => void;
  disabled?: boolean;
}

const PLATFORM_ICONS: Record<ExportPlatform, React.ReactNode> = {
  tiktok: <span className="text-lg">🎵</span>,
  instagram_reel: <span className="text-lg">📱</span>,
  youtube_shorts: <span className="text-lg">▶️</span>,
  instagram_post: <span className="text-lg">📷</span>,
  facebook: <span className="text-lg">👤</span>,
  youtube: <span className="text-lg">📺</span>,
};

export function PlatformExportSelector({ value, onChange, disabled }: PlatformExportSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const togglePlatform = (platform: ExportPlatform) => {
    if (value.includes(platform)) {
      onChange(value.filter(p => p !== platform));
    } else {
      onChange([...value, platform]);
    }
  };

  const selectedSpecs = value.map(v => PLATFORM_SPECS[v]);
  const totalDuration = Math.max(...selectedSpecs.map(s => s.maxDuration));

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-zinc-300 flex items-center gap-2">
        <Share2 className="h-4 w-4" />
        Export Platforms
      </label>

      {/* Current selection summary */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        disabled={disabled}
        className={clsx(
          'w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all',
          'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {value.slice(0, 4).map((platform) => (
              <div key={platform} className="h-8 w-8 rounded-full bg-zinc-700 flex items-center justify-center border-2 border-zinc-800">
                {PLATFORM_ICONS[platform]}
              </div>
            ))}
            {value.length > 4 && (
              <div className="h-8 w-8 rounded-full bg-zinc-600 flex items-center justify-center text-xs text-white border-2 border-zinc-800">
                +{value.length - 4}
              </div>
            )}
          </div>
          <div className="text-left">
            <div className="text-sm font-medium text-white">
              {value.length === 0 ? 'Select platforms' : `${value.length} platform${value.length > 1 ? 's' : ''} selected`}
            </div>
            {value.length > 0 && (
              <div className="text-xs text-zinc-500">Up to {totalDuration}s • {value.map(v => PLATFORM_SPECS[v].aspectRatio).filter((v, i, a) => a.indexOf(v) === i).join(', ')}</div>
            )}
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-zinc-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-zinc-400" />
        )}
      </button>

      {/* Expanded options */}
      {isExpanded && (
        <div className="p-3 bg-zinc-900/50 rounded-xl border border-zinc-800 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(PLATFORM_SPECS) as ExportPlatform[]).map((platform) => {
              const spec = PLATFORM_SPECS[platform];
              const isSelected = value.includes(platform);

              return (
                <button
                  key={platform}
                  type="button"
                  onClick={() => togglePlatform(platform)}
                  disabled={disabled}
                  className={clsx(
                    'relative p-3 rounded-lg border transition-all text-left',
                    isSelected
                      ? 'border-emerald-500/50 bg-emerald-500/10'
                      : 'border-zinc-700 hover:border-zinc-600 bg-zinc-800/50',
                    disabled && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {isSelected && (
                    <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-emerald-400" />
                  )}

                  <div className="flex items-center gap-2 mb-1">
                    {PLATFORM_ICONS[platform]}
                    <span className="text-xs font-medium text-white">{spec.name}</span>
                  </div>

                  <div className="text-[10px] text-zinc-500 space-y-0.5">
                    <div>{spec.resolution} • {spec.aspectRatio}</div>
                    <div>Max: {spec.maxDuration}s</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Quick actions */}
          <div className="flex gap-2 pt-2 border-t border-zinc-700">
            <button
              type="button"
              onClick={() => onChange(['tiktok', 'instagram_reel', 'youtube_shorts'])}
              disabled={disabled}
              className="flex-1 px-3 py-2 text-xs font-medium bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 hover:bg-zinc-700 transition-colors"
            >
              <Smartphone className="h-3 w-3 inline mr-1" />
              All Vertical (9:16)
            </button>
            <button
              type="button"
              onClick={() => onChange(['facebook', 'youtube'])}
              disabled={disabled}
              className="flex-1 px-3 py-2 text-xs font-medium bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 hover:bg-zinc-700 transition-colors"
            >
              <Monitor className="h-3 w-3 inline mr-1" />
              All Horizontal (16:9)
            </button>
            <button
              type="button"
              onClick={() => onChange([])}
              disabled={disabled || value.length === 0}
              className="px-3 py-2 text-xs font-medium bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 hover:bg-zinc-700 transition-colors disabled:opacity-50"
            >
              Clear All
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
