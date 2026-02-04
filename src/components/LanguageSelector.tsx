import { useState } from 'react';
import { Globe, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { LANGUAGE_OPTIONS } from '../lib/constants';
import { clsx } from '../lib/format';
import type { SupportedLanguage } from '../lib/types';

interface LanguageSelectorProps {
  value: SupportedLanguage;
  onChange: (value: SupportedLanguage) => void;
  disabled?: boolean;
}

export function LanguageSelector({ value, onChange, disabled }: LanguageSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const currentLanguage = LANGUAGE_OPTIONS.find(l => l.code === value);

  const filteredLanguages = LANGUAGE_OPTIONS.filter(lang =>
    lang.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lang.nativeName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-zinc-300 flex items-center gap-2">
        <Globe className="h-4 w-4" />
        Language
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
          <div className="text-xl">{currentLanguage?.flag}</div>
          <div className="text-left">
            <div className="text-sm font-medium text-white">{currentLanguage?.name}</div>
            <div className="text-xs text-zinc-500">{currentLanguage?.nativeName}</div>
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
              placeholder="Search languages..."
              className="w-full pl-10 pr-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          {/* Language grid */}
          <div className="grid grid-cols-2 gap-1 max-h-60 overflow-y-auto">
            {filteredLanguages.map((lang) => {
              const isSelected = value === lang.code;

              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => {
                    onChange(lang.code);
                    setIsExpanded(false);
                    setSearchQuery('');
                  }}
                  disabled={disabled}
                  className={clsx(
                    'flex items-center gap-2 px-3 py-2 rounded-lg transition-all',
                    isSelected
                      ? 'bg-emerald-500/20 border border-emerald-500/30'
                      : 'hover:bg-zinc-800',
                    disabled && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <span className="text-lg">{lang.flag}</span>
                  <div className="text-left">
                    <div className={clsx(
                      'text-xs font-medium',
                      isSelected ? 'text-emerald-400' : 'text-white'
                    )}>
                      {lang.name}
                    </div>
                    <div className="text-[10px] text-zinc-500">{lang.nativeName}</div>
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
