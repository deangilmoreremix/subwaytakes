import { useState } from 'react';
import { Sparkles, Wand2, ArrowRight, RefreshCw } from 'lucide-react';
import { clsx } from '../lib/format';
import { NICHE_CONFIGS } from '../lib/constants';
import type { NicheCategory } from '../lib/types';

interface KeywordGeneratorProps {
  keyword: string;
  onKeywordChange: (keyword: string) => void;
  niche: NicheCategory;
  onNicheChange: (niche: NicheCategory) => void;
  onGenerate: () => void;
  isGenerating?: boolean;
  disabled?: boolean;
}

export function KeywordGenerator({
  keyword,
  onKeywordChange,
  niche,
  onNicheChange,
  onGenerate,
  isGenerating,
  disabled,
}: KeywordGeneratorProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const currentNiche = NICHE_CONFIGS.find(n => n.value === niche);

  const generateSuggestions = () => {
    const nicheKeywords = currentNiche?.defaultKeywords || [];
    // Generate variations
    const variations = [
      `Best ${keyword} for 2024`,
      `${keyword} mistakes to avoid`,
      `How to ${keyword}`,
      `${keyword} tips and tricks`,
      `${keyword} everyone should know`,
      `Why ${keyword} matters`,
    ];
    setSuggestions(variations);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-zinc-300 flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          Topic Keyword
        </label>
        <button
          type="button"
          onClick={generateSuggestions}
          className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
        >
          <Wand2 className="h-3 w-3" />
          Get suggestions
        </button>
      </div>

      {/* Keyword input with niche context */}
      <div className="relative">
        <input
          type="text"
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
          placeholder="Enter a keyword or topic..."
          disabled={disabled}
          className={clsx(
            'w-full px-4 py-3 pr-12 text-sm bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-500',
            'focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        />
        {keyword && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <span className="text-lg">{currentNiche?.icon}</span>
          </div>
        )}
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="p-3 bg-zinc-900/50 rounded-xl border border-zinc-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-zinc-500">Suggestions for "{keyword}":</span>
            <button
              type="button"
              onClick={() => setSuggestions([])}
              className="text-zinc-500 hover:text-zinc-300"
            >
              ×
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                type="button"
                onClick={() => {
                  onKeywordChange(suggestion);
                  setSuggestions([]);
                }}
                disabled={disabled}
                className="px-3 py-2 text-xs text-left bg-zinc-800 border border-zinc-700 rounded-lg hover:border-emerald-500/50 hover:bg-zinc-700 transition-colors disabled:opacity-50"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Niche selector */}
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-2">
          Niche (for better results)
        </label>
        <div className="flex flex-wrap gap-2">
          {NICHE_CONFIGS.slice(0, 8).map((n) => (
            <button
              key={n.value}
              type="button"
              onClick={() => onNicheChange(n.value)}
              disabled={disabled}
              className={clsx(
                'flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border transition-all',
                niche === n.value
                  ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                  : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <span>{n.icon}</span>
              <span>{n.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Generate button */}
      <button
        type="button"
        onClick={onGenerate}
        disabled={disabled || !keyword || isGenerating}
        className={clsx(
          'w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-all',
          keyword
            ? 'bg-emerald-500 text-white hover:bg-emerald-400'
            : 'bg-zinc-800 text-zinc-500 cursor-not-allowed',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        {isGenerating ? (
          <>
            <RefreshCw className="h-4 w-4 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Generate Interview
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>

      {/* Tips */}
      <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
        <p className="text-xs text-emerald-400">
          💡 Pro tip: Specific keywords like "best crypto investment 2024" generate more engaging content than generic ones like "crypto".
        </p>
      </div>
    </div>
  );
}
