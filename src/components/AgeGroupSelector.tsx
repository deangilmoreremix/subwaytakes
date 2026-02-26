/**
 * Age Group Selector Component
 * Visual selection of 5 age groups with kid-friendly icons and colors
 */

import { useState } from 'react';
import { Sparkles, Zap, Users, Briefcase, Crown } from 'lucide-react';
import type { AgeGroup } from '../lib/types';
import { AGE_GROUP_CONFIGS } from '../lib/constants';
import { getSuggestedTopics, filterModesByAge } from '../lib/contentFilter';

interface AgeGroupSelectorProps {
  value: AgeGroup | null;
  onChange: (ageGroup: AgeGroup) => void;
  showSuggestions?: boolean;
  className?: string;
}

const AGE_GROUPS: { key: AgeGroup; icon: React.ReactNode; label: string; color: string; bgColor: string }[] = [
  { 
    key: 'kids', 
    icon: <Sparkles className="w-6 h-6" />, 
    label: 'Kids',
    color: '#4ade80',
    bgColor: 'bg-green-500/10',
  },
  { 
    key: 'teens', 
    icon: <Zap className="w-6 h-6" />, 
    label: 'Teens',
    color: '#60a5fa',
    bgColor: 'bg-blue-500/10',
  },
  { 
    key: 'older_adults', 
    icon: <Crown className="w-6 h-6" />, 
    label: 'Older Adults',
    color: '#f97316',
    bgColor: 'bg-orange-500/10',
  },
  { 
    key: 'adults', 
    icon: <Briefcase className="w-6 h-6" />, 
    label: 'Adults',
    color: '#f87171',
    bgColor: 'bg-red-500/10',
  },
  { 
    key: 'all_ages', 
    icon: <Users className="w-6 h-6" />, 
    label: 'All Ages',
    color: '#fbbf24',
    bgColor: 'bg-yellow-500/10',
  },
];

export function AgeGroupSelector({ 
  value, 
  onChange, 
  showSuggestions = true,
  className = '',
}: AgeGroupSelectorProps) {
  const [hoveredGroup, setHoveredGroup] = useState<AgeGroup | null>(null);

  const selectedConfig = value ? AGE_GROUP_CONFIGS[value] : null;
  const suggestedTopics = value ? getSuggestedTopics(value) : [];
  const allowedModes = value ? filterModesByAge(value) : [];

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Label */}
      <div className="flex items-center gap-2">
        <Users className="w-5 h-5 text-gray-400" />
        <label className="text-sm font-medium text-gray-300">
          Target Age Group
        </label>
      </div>

      {/* Age Group Cards */}
      <div className="grid grid-cols-5 gap-3">
        {AGE_GROUPS.map((group) => {
          const isSelected = value === group.key;
          const isHovered = hoveredGroup === group.key;
          const config = AGE_GROUP_CONFIGS[group.key];

          return (
            <button
              key={group.key}
              type="button"
              onClick={() => onChange(group.key)}
              onMouseEnter={() => setHoveredGroup(group.key)}
              onMouseLeave={() => setHoveredGroup(null)}
              className={`
                relative p-4 rounded-xl border-2 transition-all duration-300
                flex flex-col items-center gap-2 text-center
                ${isSelected 
                  ? 'border-current shadow-lg scale-105' 
                  : 'border-gray-700 hover:border-gray-600 hover:bg-gray-800/50'
                }
              `}
              style={{ 
                borderColor: isSelected || isHovered ? group.color : undefined,
              }}
            >
              {/* Background Glow */}
              <div 
                className={`absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 ${group.bgColor}`}
                style={{ opacity: isSelected || isHovered ? 1 : 0 }}
              />

              {/* Icon */}
              <div 
                className="relative z-10 p-2 rounded-full transition-transform duration-300"
                style={{ 
                  color: group.color,
                  transform: (isSelected || isHovered) ? 'scale(1.1)' : undefined
                }}
              >
                {group.icon}
              </div>

              {/* Label */}
              <span 
                className="relative z-10 text-sm font-semibold"
                style={{ color: isSelected ? group.color : undefined }}
              >
                {group.label}
              </span>

              {/* Age Range Badge */}
              <span 
                className="relative z-10 text-xs text-gray-500"
              >
                {config.ageRange}
              </span>

              {/* Selection Indicator */}
              {isSelected && (
                <div 
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: group.color }}
                >
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Group Info */}
      {selectedConfig && (
        <div className="p-4 rounded-lg border border-gray-700 bg-gray-800/50">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">{selectedConfig.icon}</span>
            <div>
              <h4 className="font-semibold text-white">
                {selectedConfig.displayName}
              </h4>
              <p className="text-sm text-gray-400">
                {selectedConfig.ageRange} • {selectedConfig.contentRating}-rated
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-300">
            {selectedConfig.description}
          </p>
        </div>
      )}

      {/* Suggestions Panel */}
      {showSuggestions && value && (
        <div className="grid grid-cols-2 gap-4">
          {/* Suggested Topics */}
          <div className="p-4 rounded-lg border border-gray-700 bg-gray-800/30">
            <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Suggested Topics
            </h4>
            <div className="flex flex-wrap gap-2">
              {suggestedTopics.slice(0, 8).map((topic) => (
                <span
                  key={topic}
                  className="px-3 py-1 text-xs rounded-full bg-gray-700/50 text-gray-300 border border-gray-600"
                >
                  {topic}
                </span>
              ))}
            </div>
          </div>

          {/* Available Modes */}
          <div className="p-4 rounded-lg border border-gray-700 bg-gray-800/30">
            <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Available Modes
            </h4>
            <div className="flex flex-wrap gap-2">
              {allowedModes.slice(0, 5).map((mode) => (
                <span
                  key={mode.mode}
                  className="px-3 py-1 text-xs rounded-full bg-gray-700/50 text-gray-300 border border-gray-600 flex items-center gap-1"
                >
                  <span>{mode.emoji}</span>
                  <span>{mode.label}</span>
                </span>
              ))}
              {allowedModes.length > 5 && (
                <span className="px-3 py-1 text-xs rounded-full bg-gray-700/50 text-gray-400">
                  +{allowedModes.length - 5} more
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Info Notice for Restricted Content */}
      {value === 'kids' && (
        <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
          <p className="text-sm text-yellow-200 flex items-center gap-2">
            <span className="text-lg">ℹ️</span>
            Kids mode includes only family-friendly content with appropriate language and topics.
          </p>
        </div>
      )}

      {value === 'older_adults' && (
        <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/30">
          <p className="text-sm text-orange-200 flex items-center gap-2">
            <span className="text-lg">👴</span>
            Older Adults mode focuses on wisdom, life lessons, and experience-based content.
          </p>
        </div>
      )}

      {value === 'adults' && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
          <p className="text-sm text-red-200 flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            Adults mode allows mature topics. Please ensure content is appropriate for your audience.
          </p>
        </div>
      )}
    </div>
  );
}

export default AgeGroupSelector;
