import { useState } from 'react';
import { Type, Palette, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { CAPTION_PRESETS } from '../lib/constants';
import { clsx } from '../lib/format';
import type { CaptionStyleConfig } from '../lib/types';

interface CaptionStyleSelectorProps {
  value: string;
  onChange: (presetId: string) => void;
  customConfig?: CaptionStyleConfig;
  onCustomConfigChange?: (config: CaptionStyleConfig) => void;
  disabled?: boolean;
}

const PREVIEW_COLORS: Record<string, { bg: string; text: string }> = {
  standard: { bg: 'bg-black/60', text: 'text-white' },
  tiktok: { bg: 'bg-black/70', text: 'text-white' },
  youtube: { bg: 'bg-black/50', text: 'text-white' },
  attention_grabber: { bg: 'bg-black/80', text: 'text-amber-400' },
  minimalist: { bg: '', text: 'text-white' },
};

export function CaptionStyleSelector({ 
  value, 
  onChange,
  customConfig,
  onCustomConfigChange,
  disabled 
}: CaptionStyleSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const presetKeys = Object.keys(CAPTION_PRESETS);

  const currentPreset = CAPTION_PRESETS[value] || CAPTION_PRESETS.standard;
  const previewColors = PREVIEW_COLORS[value] || PREVIEW_COLORS.standard;

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-zinc-300 flex items-center gap-2">
        <Type className="h-4 w-4" />
        Caption Style
      </label>

      {/* Current selection */}
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
          <div className="h-8 w-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
            <Palette className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-left">
            <div className="text-sm font-medium text-white capitalize">{value.replace('_', ' ')}</div>
            <div className="text-xs text-zinc-500">{currentPreset.fontFamily} • {currentPreset.fontSize}px</div>
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
        <div className="grid grid-cols-2 gap-2 p-3 bg-zinc-900/50 rounded-xl border border-zinc-800">
          {presetKeys.map((presetId) => {
            const preset = CAPTION_PRESETS[presetId];
            const isSelected = value === presetId;
            const colors = PREVIEW_COLORS[presetId] || PREVIEW_COLORS.standard;

            return (
              <button
                key={presetId}
                type="button"
                onClick={() => {
                  onChange(presetId);
                  setIsExpanded(false);
                }}
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

                {/* Preview */}
                <div className="mb-2">
                  <div className={clsx(
                    'px-2 py-1 rounded text-xs font-medium',
                    colors.bg,
                    colors.text
                  )}>
                    Your text here
                  </div>
                </div>

                <div className="text-xs">
                  <div className="font-medium text-white capitalize">{presetId.replace('_', ' ')}</div>
                  <div className="text-zinc-500">{preset.fontFamily} • {preset.fontSize}px</div>
                  {preset.highlightWords.length > 0 && (
                    <div className="text-emerald-400 mt-1">✨ Animated highlights</div>
                  )}
                </div>
              </button>
            );
          })}

          {/* Custom option */}
          <button
            type="button"
            onClick={() => {
              onChange('custom');
              setIsExpanded(false);
            }}
            disabled={disabled}
            className={clsx(
              'relative p-3 rounded-lg border border-dashed transition-all text-center',
              value === 'custom'
                ? 'border-emerald-500/50 bg-emerald-500/10'
                : 'border-zinc-600 hover:border-zinc-500 bg-zinc-800/30',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <div className="flex flex-col items-center gap-1">
              <Sparkles className="h-5 w-5 text-zinc-400" />
              <div className="text-xs font-medium text-white">Custom</div>
              <div className="text-[10px] text-zinc-500">Design your own</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
