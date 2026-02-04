import { useState } from 'react';
import { Trophy, Award, GraduationCap, Sparkles, TrendingUp, RotateCcw, Star } from 'lucide-react';
import type { AchievementContext, AchievementContextType } from '../lib/types';
import { ACHIEVEMENT_CONTEXT_TYPES } from '../lib/constants';

interface AchievementContextSelectorProps {
  value: AchievementContext | undefined;
  onChange: (context: AchievementContext | undefined) => void;
  disabled?: boolean;
}

const ACHIEVEMENT_ICONS: Record<AchievementContextType, typeof Trophy> = {
  championship: Trophy,
  award_ceremony: Award,
  graduation: GraduationCap,
  grand_opening: Sparkles,
  record_breaking: TrendingUp,
  comeback_victory: RotateCcw,
  lifetime_achievement: Star,
};

const ACHIEVEMENT_COLORS: Record<AchievementContextType, { bg: string; border: string; text: string }> = {
  championship: { bg: 'bg-amber-500/15', border: 'border-amber-500/50', text: 'text-amber-400' },
  award_ceremony: { bg: 'bg-purple-500/15', border: 'border-purple-500/50', text: 'text-purple-400' },
  graduation: { bg: 'bg-blue-500/15', border: 'border-blue-500/50', text: 'text-blue-400' },
  grand_opening: { bg: 'bg-emerald-500/15', border: 'border-emerald-500/50', text: 'text-emerald-400' },
  record_breaking: { bg: 'bg-red-500/15', border: 'border-red-500/50', text: 'text-red-400' },
  comeback_victory: { bg: 'bg-orange-500/15', border: 'border-orange-500/50', text: 'text-orange-400' },
  lifetime_achievement: { bg: 'bg-yellow-500/15', border: 'border-yellow-500/50', text: 'text-yellow-400' },
};

export function AchievementContextSelector({ value, onChange, disabled }: AchievementContextSelectorProps) {
  const [isEnabled, setIsEnabled] = useState(value?.enabled ?? false);
  const [contextType, setContextType] = useState<AchievementContextType>(value?.contextType ?? 'championship');
  const [backdrop, setBackdrop] = useState(value?.backdrop ?? '');
  const [props, setProps] = useState<string[]>(value?.props ?? []);
  const [atmosphere, setAtmosphere] = useState(value?.atmosphere ?? '');

  const enabled = isEnabled && !disabled;

  function toggleEnabled() {
    const newEnabled = !isEnabled;
    setIsEnabled(newEnabled);
    if (newEnabled) {
      onChange({
        enabled: true,
        contextType,
        backdrop: backdrop || getDefaultBackdrop(contextType),
        props: props.length > 0 ? props : getDefaultProps(contextType),
        atmosphere: atmosphere || getDefaultAtmosphere(contextType),
      });
    } else {
      onChange(undefined);
    }
  }

  function updateContextType(type: AchievementContextType) {
    setContextType(type);
    onChange({
      enabled: true,
      contextType: type,
      backdrop: backdrop || getDefaultBackdrop(type),
      props: props.length > 0 ? props : getDefaultProps(type),
      atmosphere: atmosphere || getDefaultAtmosphere(type),
    });
  }

  function updateBackdrop(newBackdrop: string) {
    setBackdrop(newBackdrop);
    onChange({ enabled: true, contextType, backdrop: newBackdrop, props, atmosphere });
  }

  function updateAtmosphere(newAtmosphere: string) {
    setAtmosphere(newAtmosphere);
    onChange({ enabled: true, contextType, backdrop, props, atmosphere: newAtmosphere });
  }

  function addProp(prop: string) {
    if (prop && !props.includes(prop)) {
      const newProps = [...props, prop];
      setProps(newProps);
      onChange({ enabled: true, contextType, backdrop, props: newProps, atmosphere });
    }
  }

  function removeProp(prop: string) {
    const newProps = props.filter(p => p !== prop);
    setProps(newProps);
    onChange({ enabled: true, contextType, backdrop, props: newProps, atmosphere });
  }

  function getDefaultBackdrop(type: AchievementContextType): string {
    const defaults: Record<AchievementContextType, string> = {
      championship: 'Stadium or arena with championship banners',
      award_ceremony: 'Elegant stage with velvet curtains and spotlights',
      graduation: 'University campus with academic architecture',
      grand_opening: 'Ribbon-cutting setup with branded backdrop',
      record_breaking: 'Historic venue with achievement displays',
      comeback_victory: 'Arena or field where the comeback happened',
      lifetime_achievement: 'Prestigious hall of fame or legacy venue',
    };
    return defaults[type];
  }

  function getDefaultProps(type: AchievementContextType): string[] {
    const defaults: Record<AchievementContextType, string[]> = {
      championship: ['trophy', 'confetti', 'championship banner'],
      award_ceremony: ['microphone', 'award statue', 'spotlight'],
      graduation: ['diploma', 'cap and gown', 'academic regalia'],
      grand_opening: ['ribbon', 'oversized scissors', 'balloons'],
      record_breaking: ['scoreboard', 'timer', 'record certificate'],
      comeback_victory: ['victory banner', 'team colors', 'celebration props'],
      lifetime_achievement: ['legacy trophy', 'commemorative plaque', 'hall of fame backdrop'],
    };
    return defaults[type];
  }

  function getDefaultAtmosphere(type: AchievementContextType): string {
    const defaults: Record<AchievementContextType, string> = {
      championship: 'Triumphant, celebratory, peak achievement energy',
      award_ceremony: 'Prestigious, elegant, recognition moment',
      graduation: 'Hopeful, accomplished, new beginnings',
      grand_opening: 'Exciting, fresh start, entrepreneurial spirit',
      record_breaking: 'Historic, groundbreaking, milestone moment',
      comeback_victory: 'Inspirational, redemption, never give up',
      lifetime_achievement: 'Respectful, legacy, career culmination',
    };
    return defaults[type];
  }

  const colors = ACHIEVEMENT_COLORS[contextType];
  const Icon = ACHIEVEMENT_ICONS[contextType];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
              type="button"
              onClick={toggleEnabled}
              disabled={disabled}
              aria-label="Enable achievement/milestone context"
              aria-pressed={isEnabled}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                isEnabled ? 'bg-red-500' : 'bg-zinc-700'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                isEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
          <div>
            <span className="text-sm font-medium text-zinc-200">Achievement/Milestone Context</span>
            <p className="text-xs text-zinc-500">Championship backdrops, award ceremonies, graduations</p>
          </div>
        </div>
      </div>

      {enabled && (
        <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          {/* Achievement Type Selection */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Achievement Type</label>
            <div className="grid grid-cols-2 gap-2">
              {ACHIEVEMENT_CONTEXT_TYPES.map((type) => {
                const TypeIcon = ACHIEVEMENT_ICONS[type.value];
                const isSelected = contextType === type.value;
                const typeColors = ACHIEVEMENT_COLORS[type.value];

                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => updateContextType(type.value)}
                    className={`flex items-start gap-2 p-2 rounded-lg border text-left transition-all ${
                      isSelected
                        ? `${typeColors.bg} ${typeColors.border}`
                        : 'border-zinc-700 bg-zinc-800/30 hover:border-zinc-600'
                    }`}
                  >
                    <TypeIcon className={`h-4 w-4 mt-0.5 ${isSelected ? typeColors.text : 'text-zinc-500'}`} />
                    <div>
                      <span className={`text-xs font-medium block ${isSelected ? typeColors.text : 'text-zinc-300'}`}>
                        {type.label}
                      </span>
                      <span className="text-[10px] text-zinc-500">{type.description}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Backdrop */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Backdrop Setting</label>
            <input
              type="text"
              value={backdrop}
              onChange={(e) => updateBackdrop(e.target.value)}
              placeholder={getDefaultBackdrop(contextType)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:border-red-500/50 focus:outline-none"
            />
          </div>

          {/* Props */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Props & Elements</label>
            <div className="flex flex-wrap gap-2">
              {props.map((prop) => (
                <span
                  key={prop}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-zinc-800 text-xs text-zinc-300"
                >
                  {prop}
                  <button
                    type="button"
                    onClick={() => removeProp(prop)}
                    className="text-zinc-500 hover:text-red-400"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              placeholder="Add a prop and press Enter"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  addProp(e.currentTarget.value);
                  e.currentTarget.value = '';
                }
              }}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:border-red-500/50 focus:outline-none"
            />
          </div>

          {/* Atmosphere */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Atmosphere</label>
            <input
              type="text"
              value={atmosphere}
              onChange={(e) => updateAtmosphere(e.target.value)}
              placeholder={getDefaultAtmosphere(contextType)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:border-red-500/50 focus:outline-none"
            />
          </div>

          {/* Preview */}
          <div className={`rounded-lg border ${colors.border} ${colors.bg} p-3 space-y-1`}>
            <div className="flex items-center gap-2">
              <Icon className={`h-3.5 w-3.5 ${colors.text}`} />
              <span className={`text-xs font-medium ${colors.text}`}>Achievement Context Preview</span>
            </div>
            <p className="text-xs text-zinc-400">
              {backdrop || getDefaultBackdrop(contextType)}
            </p>
            <p className="text-xs text-zinc-500">
              {props.length > 0 ? props.join(', ') : getDefaultProps(contextType).join(', ')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
