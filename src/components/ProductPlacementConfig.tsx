import { useState } from 'react';
import { ShoppingBag, Link, Tag, ChevronDown, ChevronUp, X } from 'lucide-react';
import { clsx } from '../lib/format';
import type { ProductPlacementConfig } from '../lib/types';

interface ProductPlacementConfigProps {
  config: ProductPlacementConfig;
  onChange: (config: ProductPlacementConfig) => void;
  disabled?: boolean;
}

export function ProductPlacementPanel({ config, onChange, disabled }: ProductPlacementConfigProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggle = () => {
    onChange({ ...config, enabled: !config.enabled });
  };

  const handleChange = (field: keyof ProductPlacementConfig, value: string) => {
    onChange({ ...config, [field]: value });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-zinc-300 flex items-center gap-2">
          <ShoppingBag className="h-4 w-4" />
          Product Placement
        </label>
        <button
          type="button"
          onClick={handleToggle}
          disabled={disabled}
          className={clsx(
            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
            config.enabled ? 'bg-amber-500' : 'bg-zinc-700',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <span
            className={clsx(
              'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
              config.enabled ? 'translate-x-6' : 'translate-x-1'
            )}
          />
        </button>
      </div>

      {config.enabled && (
        <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800 space-y-4">
          {/* Product Name */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Product/Service Name
            </label>
            <input
              type="text"
              value={config.productName}
              onChange={(e) => handleChange('productName', e.target.value)}
              placeholder="e.g., My Course, App Name, etc."
              className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-500/50"
            />
          </div>

          {/* Product Description */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Description (what it does)
            </label>
            <textarea
              value={config.productDescription}
              onChange={(e) => handleChange('productDescription', e.target.value)}
              placeholder="Brief description of your product..."
              rows={2}
              className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-500/50 resize-none"
            />
          </div>

          {/* Call to Action */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Call to Action
            </label>
            <input
              type="text"
              value={config.callToAction}
              onChange={(e) => handleChange('callToAction', e.target.value)}
              placeholder="e.g., Link in bio, Get started below"
              className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-500/50"
            />
          </div>

          {/* Placement Style */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">
              Placement Style
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'subtle', label: 'Subtle' },
                { value: 'moderate', label: 'Moderate' },
                { value: 'prominent', label: 'Prominent' },
              ].map((style) => (
                <button
                  key={style.value}
                  type="button"
                  onClick={() => handleChange('placementStyle', style.value)}
                  className={clsx(
                    'px-3 py-2 text-xs font-medium rounded-lg border transition-all',
                    config.placementStyle === style.value
                      ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                      : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-600'
                  )}
                >
                  {style.label}
                </button>
              ))}
            </div>
          </div>

          {/* Integration Type */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">
              Integration Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'end_card', label: 'End Card' },
                { value: 'natural_mention', label: 'Natural' },
                { value: 'demonstration', label: 'Demo' },
              ].map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => handleChange('integrationType', type.value)}
                  className={clsx(
                    'px-3 py-2 text-xs font-medium rounded-lg border transition-all',
                    config.integrationType === type.value
                      ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                      : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-600'
                  )}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Optional Fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1 flex items-center gap-1">
                <Tag className="h-3 w-3" />
                Offer Code
              </label>
              <input
                type="text"
                value={config.offerCode || ''}
                onChange={(e) => handleChange('offerCode', e.target.value)}
                placeholder="Optional"
                className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1 flex items-center gap-1">
                <Link className="h-3 w-3" />
                Affiliate Link
              </label>
              <input
                type="text"
                value={config.affiliateLink || ''}
                onChange={(e) => handleChange('affiliateLink', e.target.value)}
                placeholder="Optional"
                className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-500/50"
              />
            </div>
          </div>

          {/* Tips */}
          <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
            <p className="text-xs text-amber-400">
              💡 Tip: Natural mentions convert better. Focus on the value/benefit, not the sales pitch.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
