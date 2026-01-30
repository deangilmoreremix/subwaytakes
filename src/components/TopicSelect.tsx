import { useState, useEffect } from 'react';
import { ChevronDown, Pencil } from 'lucide-react';
import { clsx } from '../lib/format';

const CUSTOM_OPTION = '__custom__';

interface TopicSelectProps {
  value: string;
  topics: string[];
  onChange: (topic: string) => void;
  disabled?: boolean;
  allowCustom?: boolean;
}

export function TopicSelect({ value, topics, onChange, disabled, allowCustom = false }: TopicSelectProps) {
  const isCustomValue = allowCustom && value && !topics.includes(value);
  const [isCustomMode, setIsCustomMode] = useState(isCustomValue);
  const [customInput, setCustomInput] = useState(isCustomValue ? value : '');

  useEffect(() => {
    if (!allowCustom) {
      setIsCustomMode(false);
      setCustomInput('');
    }
  }, [allowCustom]);

  useEffect(() => {
    const newIsCustomValue = allowCustom && value && !topics.includes(value);
    if (newIsCustomValue && !isCustomMode) {
      setIsCustomMode(true);
      setCustomInput(value);
    } else if (!newIsCustomValue && isCustomMode && topics.includes(value)) {
      setIsCustomMode(false);
    }
  }, [value, topics, allowCustom, isCustomMode]);

  function handleSelectChange(newValue: string) {
    if (newValue === CUSTOM_OPTION) {
      setIsCustomMode(true);
      setCustomInput('');
    } else {
      setIsCustomMode(false);
      setCustomInput('');
      onChange(newValue);
    }
  }

  function handleCustomInputChange(inputValue: string) {
    setCustomInput(inputValue);
    if (inputValue.trim()) {
      onChange(inputValue.trim());
    }
  }

  function handleBackToPresets() {
    setIsCustomMode(false);
    setCustomInput('');
    onChange(topics[0]);
  }

  const selectValue = isCustomMode ? CUSTOM_OPTION : (topics.includes(value) ? value : topics[0]);

  return (
    <div>
      <label className="block text-sm font-medium text-zinc-300 mb-2">
        Topic
      </label>

      {isCustomMode ? (
        <div className="space-y-2">
          <div className="relative">
            <input
              type="text"
              value={customInput}
              onChange={(e) => handleCustomInputChange(e.target.value)}
              disabled={disabled}
              placeholder="Enter your topic..."
              autoFocus
              className={clsx(
                'w-full rounded-xl border border-amber-500/50 bg-zinc-900/50 px-4 py-3 pr-10 text-sm text-zinc-100 placeholder-zinc-500',
                'outline-none transition focus:border-amber-500 focus:ring-1 focus:ring-amber-500',
                disabled && 'opacity-60 cursor-not-allowed'
              )}
            />
            <Pencil className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-500 pointer-events-none" />
          </div>
          <button
            type="button"
            onClick={handleBackToPresets}
            disabled={disabled}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-50"
          >
            Back to preset topics
          </button>
        </div>
      ) : (
        <div className="relative">
          <select
            value={selectValue}
            onChange={(e) => handleSelectChange(e.target.value)}
            disabled={disabled}
            className={clsx(
              'w-full appearance-none rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 pr-10 text-sm text-zinc-100',
              'outline-none transition focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600',
              disabled && 'opacity-60 cursor-not-allowed'
            )}
          >
            {topics.map((topic) => (
              <option key={topic} value={topic}>
                {topic}
              </option>
            ))}
            {allowCustom && (
              <option value={CUSTOM_OPTION}>Custom topic...</option>
            )}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none" />
        </div>
      )}
    </div>
  );
}
