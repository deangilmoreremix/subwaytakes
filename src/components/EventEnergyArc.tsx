import { useState } from 'react';
import { Activity, Play, TrendingUp, Trophy, Film, ArrowRight } from 'lucide-react';
import type { EventEnergyArcConfig, EventPhase } from '../lib/types';

interface EventEnergyArcProps {
  value: EventEnergyArcConfig | undefined;
  onChange: (config: EventEnergyArcConfig | undefined) => void;
  disabled?: boolean;
}

const PHASE_ICONS: Record<EventPhase, typeof Play> = {
  pre_event: Play,
  mid_event: TrendingUp,
  peak_moment: Trophy,
  closing: Film,
};

const PHASE_COLORS: Record<EventPhase, string> = {
  pre_event: 'text-blue-400',
  mid_event: 'text-amber-400',
  peak_moment: 'text-red-400',
  closing: 'text-emerald-400',
};

const PHASE_BG_COLORS: Record<EventPhase, string> = {
  pre_event: 'bg-blue-500/15 border-blue-500/50',
  mid_event: 'bg-amber-500/15 border-amber-500/50',
  peak_moment: 'bg-red-500/15 border-red-500/50',
  closing: 'bg-emerald-500/15 border-emerald-500/50',
};

const PHASE_LABELS: Record<EventPhase, string> = {
  pre_event: 'Pre-Event',
  mid_event: 'Mid-Event',
  peak_moment: 'Peak Moment',
  closing: 'Closing',
};

const PHASE_DESCRIPTIONS: Record<EventPhase, string> = {
  pre_event: 'Behind the scenes, anticipation building, preparation shots',
  mid_event: 'Energy rising, audience engagement, momentum building',
  peak_moment: 'Climax, maximum impact, transformative revelation',
  closing: 'Resolution, call to action, lasting impression',
};

export function EventEnergyArc({ value, onChange, disabled }: EventEnergyArcProps) {
  const [isEnabled, setIsEnabled] = useState(value?.enabled ?? false);
  const [currentPhase, setCurrentPhase] = useState<EventPhase>(value?.phase ?? 'mid_event');
  const [includeBTS, setIncludeBTS] = useState(value?.behindScenes ?? true);
  const [includeTriumph, setIncludeTriumph] = useState(value?.buildToTriumph ?? true);
  const [energyCurve, setEnergyCurve] = useState<'steady' | 'building' | 'peak' | 'wind_down'>(value?.energyCurve ?? 'building');

  const enabled = isEnabled && !disabled;

  function toggleEnabled() {
    const newEnabled = !isEnabled;
    setIsEnabled(newEnabled);
    if (newEnabled) {
      onChange({
        enabled: true,
        phase: currentPhase,
        behindScenes: includeBTS,
        buildToTriumph: includeTriumph,
        energyCurve,
      });
    } else {
      onChange(undefined);
    }
  }

  function updatePhase(phase: EventPhase) {
    setCurrentPhase(phase);
    onChange({ enabled: true, phase, behindScenes: includeBTS, buildToTriumph: includeTriumph, energyCurve });
  }

  function toggleBTS() {
    const newValue = !includeBTS;
    setIncludeBTS(newValue);
    onChange({ enabled: true, phase: currentPhase, behindScenes: newValue, buildToTriumph: includeTriumph, energyCurve });
  }

  function toggleTriumph() {
    const newValue = !includeTriumph;
    setIncludeTriumph(newValue);
    onChange({ enabled: true, phase: currentPhase, behindScenes: includeBTS, buildToTriumph: newValue, energyCurve });
  }

  function updateEnergyCurve(curve: 'steady' | 'building' | 'peak' | 'wind_down') {
    setEnergyCurve(curve);
    onChange({ enabled: true, phase: currentPhase, behindScenes: includeBTS, buildToTriumph: includeTriumph, energyCurve: curve });
  }

  const phases: EventPhase[] = ['pre_event', 'mid_event', 'peak_moment', 'closing'];
  const currentIndex = phases.indexOf(currentPhase);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
              type="button"
              onClick={toggleEnabled}
              disabled={disabled}
              aria-label="Enable event energy arc"
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
            <span className="text-sm font-medium text-zinc-200">Event Energy Arc</span>
            <p className="text-xs text-zinc-500">Pre/Mid/Peak/Close phases with behind-the-scenes to triumph</p>
          </div>
        </div>
      </div>

      {enabled && (
        <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          {/* Phase Selection */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Current Phase</label>
            <div className="grid grid-cols-2 gap-2">
              {phases.map((phase) => {
                const PhaseIcon = PHASE_ICONS[phase];
                const isSelected = currentPhase === phase;

                return (
                  <button
                    key={phase}
                    type="button"
                    onClick={() => updatePhase(phase)}
                    className={`flex items-start gap-2 p-2 rounded-lg border text-left transition-all ${
                      isSelected
                        ? `${PHASE_BG_COLORS[phase]}`
                        : 'border-zinc-700 bg-zinc-800/30 hover:border-zinc-600'
                    }`}
                  >
                    <PhaseIcon className={`h-4 w-4 mt-0.5 ${isSelected ? PHASE_COLORS[phase] : 'text-zinc-500'}`} />
                    <div>
                      <span className={`text-xs font-medium block ${isSelected ? PHASE_COLORS[phase] : 'text-zinc-300'}`}>
                        {PHASE_LABELS[phase]}
                      </span>
                      <span className="text-[10px] text-zinc-500">{PHASE_DESCRIPTIONS[phase]}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Energy Curve */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Energy Curve</label>
            <div className="flex gap-2">
              {(['steady', 'building', 'peak', 'wind_down'] as const).map((curve) => (
                <button
                  key={curve}
                  type="button"
                  onClick={() => updateEnergyCurve(curve)}
                  className={`flex-1 px-3 py-1.5 rounded-lg border text-xs transition-all ${
                    energyCurve === curve
                      ? 'bg-red-500/15 border-red-500/50 text-red-400'
                      : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                  }`}
                >
                  {curve === 'wind_down' ? 'Wind Down' : curve.charAt(0).toUpperCase() + curve.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Visual Flow */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Visual Flow</label>
            <div className="flex items-center gap-1">
              {phases.map((phase, index) => {
                const PhaseIcon = PHASE_ICONS[phase];
                const isActive = index <= currentIndex;
                const isCurrent = phase === currentPhase;

                return (
                  <div key={phase} className="flex items-center">
                    <div
                      className={`flex items-center justify-center w-8 h-8 rounded-full border transition-all ${
                        isCurrent
                          ? `${PHASE_BG_COLORS[phase]} ${PHASE_COLORS[phase]}`
                          : isActive
                          ? 'border-zinc-600 bg-zinc-800/50 text-zinc-400'
                          : 'border-zinc-800 bg-zinc-900/30 text-zinc-600'
                      }`}
                    >
                      <PhaseIcon className="h-3.5 w-3.5" />
                    </div>
                    {index < phases.length - 1 && (
                      <ArrowRight className={`h-3 w-3 mx-1 ${isActive ? 'text-zinc-500' : 'text-zinc-700'}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Film className="h-3.5 w-3.5 text-zinc-500" />
                <span className="text-xs text-zinc-400">Include behind-the-scenes</span>
              </div>
              <button
                type="button"
                onClick={toggleBTS}
                className={`relative h-5 w-9 rounded-full transition-colors ${
                  includeBTS ? 'bg-red-500' : 'bg-zinc-700'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                    includeBTS ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="h-3.5 w-3.5 text-zinc-500" />
                <span className="text-xs text-zinc-400">Include triumph moment</span>
              </div>
              <button
                type="button"
                onClick={toggleTriumph}
                className={`relative h-5 w-9 rounded-full transition-colors ${
                  includeTriumph ? 'bg-red-500' : 'bg-zinc-700'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                    includeTriumph ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-lg bg-zinc-800/30 p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <Activity className="h-3.5 w-3.5" />
              <span>Energy Arc Preview</span>
            </div>
            <p className="text-xs text-zinc-500">
              {PHASE_LABELS[currentPhase]} • {energyCurve === 'wind_down' ? 'wind down' : energyCurve} energy
              {includeBTS && ' • Behind-the-scenes'}
              {includeTriumph && ' • Triumph moment'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
