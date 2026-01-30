import { Sparkles, Zap } from 'lucide-react';
import type { ModelTier } from '../lib/types';
import { MODEL_TIERS } from '../lib/constants';

interface ModelTierSelectorProps {
  value: ModelTier;
  onChange: (tier: ModelTier) => void;
  disabled?: boolean;
}

export function ModelTierSelector({ value, onChange, disabled }: ModelTierSelectorProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-zinc-300">
        Video Quality
      </label>
      <div className="grid grid-cols-2 gap-3">
        {MODEL_TIERS.map((tier) => {
          const isSelected = value === tier.value;
          const Icon = tier.value === 'premium' ? Sparkles : Zap;

          return (
            <button
              key={tier.value}
              type="button"
              onClick={() => onChange(tier.value)}
              disabled={disabled}
              className={`relative flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition-all ${
                isSelected
                  ? 'border-amber-500/50 bg-amber-500/10'
                  : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {tier.badge && (
                <span className="absolute top-2 right-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-amber-500/20 text-amber-400">
                  {tier.badge}
                </span>
              )}
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${isSelected ? 'text-amber-400' : 'text-zinc-400'}`} />
                <span className={`font-medium ${isSelected ? 'text-zinc-100' : 'text-zinc-300'}`}>
                  {tier.label}
                </span>
              </div>
              <span className="text-xs text-zinc-500 leading-tight">
                {tier.description}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-zinc-600">
        All models support speech generation for interview clips
      </p>
    </div>
  );
}
