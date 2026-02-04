import { useState } from 'react';
import { Target, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { NICHE_CONFIGS } from '../lib/constants';
import { clsx } from '../lib/format';
import type { NicheCategory } from '../lib/types';

interface NicheSelectorProps {
  value: NicheCategory;
  onChange: (value: NicheCategory) => void;
  disabled?: boolean;
}

export function NicheSelector({ value, onChange, disabled }: NicheSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const currentNiche = NICHE_CONFIGS.find(n => n.value === value);

  const filteredNiches = NICHE_CONFIGS.filter(niche =>
    niche.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    niche.defaultKeywords.some(k => k.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-zinc-300 flex items-center gap-2">
        <Target className="h-4 w-4" />
        Niche
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
          <div className="text-xl">{currentNiche?.icon}</div>
          <div className="text-left">
            <div className="text-sm font-medium text-white">{currentNiche?.label}</div>
            <div className="text-xs text-zinc-500">
              {currentNiche?.defaultKeywords.slice(0, 3).join(', ')}
            </div>
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
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search niches..."
              className="w-full pl-10 pr-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          {/* Niche grid */}
          <div className="grid grid-cols-2 gap-1 max-h-60 overflow-y-auto">
            {filteredNiches.map((niche) => {
              const isSelected = value === niche.value;

              return (
                <button
                  key={niche.value}
                  type="button"
                  onClick={() => {
                    onChange(niche.value);
                    setIsExpanded(false);
                    setSearchQuery('');
                  }}
                  disabled={disabled}
                  className={clsx(
                    'flex items-start gap-2 p-2 rounded-lg transition-all text-left',
                    isSelected
                      ? 'bg-emerald-500/20 border border-emerald-500/30'
                      : 'hover:bg-zinc-800',
                    disabled && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <span className="text-lg">{niche.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className={clsx(
                      'text-xs font-medium truncate',
                      isSelected ? 'text-emerald-400' : 'text-white'
                    )}>
                      {niche.label}
                    </div>
                    <div className="text-[10px] text-zinc-500 truncate">
                      {niche.defaultKeywords.slice(0, 2).join(', ')}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
