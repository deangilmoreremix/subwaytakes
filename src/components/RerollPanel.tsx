import { useState } from 'react';
import type { RerollIntensity, RerollOptions } from '../lib/types';
import { REROLL_INTENSITY_CONFIG } from '../lib/constants';
import { clsx } from '../lib/format';
import { RefreshCw, Flame, Zap, Sparkles, Wind } from 'lucide-react';

interface RerollPanelProps {
  onReroll: (options: RerollOptions) => void;
  isLoading?: boolean;
  currentTokens?: number;
}

const INTENSITY_ICONS: Record<RerollIntensity, React.ReactNode> = {
  mild: <Wind className="h-4 w-4" />,
  medium: <RefreshCw className="h-4 w-4" />,
  spicy: <Flame className="h-4 w-4" />,
  nuclear: <Zap className="h-4 w-4" />,
};

const INTENSITY_COLORS: Record<RerollIntensity, string> = {
  mild: 'blue',
  medium: 'yellow',
  spicy: 'orange',
  nuclear: 'red',
};

export function RerollPanel({ onReroll, isLoading, currentTokens = 0 }: RerollPanelProps) {
  const [intensity, setIntensity] = useState<RerollIntensity>('medium');
  const [preserveElements, setPreserveElements] = useState({
    topic: true,
    setting: true,
    characters: true,
    duration: true,
  });
  const [enhanceElements, setEnhanceElements] = useState({
    energy: true,
    controversy: false,
    humor: false,
    emotion: true,
  });

  const handleReroll = () => {
    onReroll({
      intensity,
      preserveElements,
      enhanceElements,
    });
  };

  const canAfford = currentTokens >= REROLL_INTENSITY_CONFIG[intensity].tokenCost;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-violet-400" />
        </div>
        <div>
          <h3 className="text-sm font-medium text-zinc-300">Spicier Reroll</h3>
          <p className="text-xs text-zinc-500">Generate a new take on this clip</p>
        </div>
      </div>

      {/* Intensity Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-zinc-300 mb-3">Intensity</label>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(REROLL_INTENSITY_CONFIG) as RerollIntensity[]).map((level) => {
            const config = REROLL_INTENSITY_CONFIG[level];
            const isActive = intensity === level;
            const color = INTENSITY_COLORS[level];

            return (
              <button
                key={level}
                type="button"
                disabled={isLoading}
                onClick={() => setIntensity(level)}
                className={clsx(
                  'relative rounded-xl border p-3 text-left transition-all duration-200',
                  isActive
                    ? `border-${color}-500/50 bg-${color}-500/10 ring-1 ring-${color}-500/20`
                    : 'border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 hover:border-zinc-700',
                  isLoading && 'opacity-60 cursor-not-allowed'
                )}
              >
                <div className={clsx(
                  'flex items-center gap-2 mb-1',
                  isActive ? `text-${color}-400` : 'text-zinc-400'
                )}>
                  {INTENSITY_ICONS[level]}
                  <span className="text-sm font-medium capitalize">{level}</span>
                </div>
                <div className="text-xs text-zinc-500">{config.description}</div>
                <div className={clsx(
                  'mt-2 text-xs font-medium',
                  isActive ? `text-${color}-400` : 'text-zinc-500'
                )}>
                  {config.tokenCost} tokens
                </div>
                {isActive && (
                  <div className={clsx('absolute top-2 right-2 h-2 w-2 rounded-full', `bg-${color}-400`)} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Preserve Elements */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-zinc-300 mb-3">Preserve</label>
        <div className="flex flex-wrap gap-2">
          {Object.entries(preserveElements).map(([key, value]) => (
            <button
              key={key}
              type="button"
              onClick={() => setPreserveElements(prev => ({ ...prev, [key]: !value }))}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                value
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
              )}
            >
              {key.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Enhance Elements */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-zinc-300 mb-3">Enhance</label>
        <div className="flex flex-wrap gap-2">
          {Object.entries(enhanceElements).map(([key, value]) => (
            <button
              key={key}
              type="button"
              onClick={() => setEnhanceElements(prev => ({ ...prev, [key]: !value }))}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                value
                  ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                  : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
              )}
            >
              {key}
            </button>
          ))}
        </div>
      </div>

      {/* Reroll Button */}
      <button
        type="button"
        onClick={handleReroll}
        disabled={isLoading || !canAfford}
        className={clsx(
          'w-full py-3 px-4 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2',
          canAfford
            ? 'bg-violet-500 hover:bg-violet-600 text-white'
            : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
        )}
      >
        <RefreshCw className={clsx('h-4 w-4', isLoading && 'animate-spin')} />
        {isLoading ? 'Rerolling...' : canAfford ? `Reroll (${REROLL_INTENSITY_CONFIG[intensity].tokenCost} tokens)` : 'Insufficient tokens'}
      </button>
    </div>
  );
}
