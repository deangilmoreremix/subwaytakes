import { useState } from 'react';
import { User, Mic, Hand, Heart, Zap, Crown, Target } from 'lucide-react';
import type { SpeakerArchetypeConfig, SpeakerArchetype } from '../lib/types';
import { SPEAKER_ARCHETYPES } from '../lib/constants';

interface SpeakerArchetypeSelectorProps {
  value: SpeakerArchetypeConfig | undefined;
  onChange: (config: SpeakerArchetypeConfig | undefined) => void;
  disabled?: boolean;
}

const ARCHETYPE_ICONS: Record<SpeakerArchetype, typeof User> = {
  drill_sergeant: Target,
  tony_robbins: Zap,
  brene_brown: Heart,
  gary_vee: Mic,
  oprah: Crown,
  eric_thomas: Hand,
  simon_sinek: User,
};

const ARCHETYPE_COLORS: Record<SpeakerArchetype, { bg: string; border: string; text: string }> = {
  drill_sergeant: { bg: 'bg-red-500/15', border: 'border-red-500/50', text: 'text-red-400' },
  tony_robbins: { bg: 'bg-amber-500/15', border: 'border-amber-500/50', text: 'text-amber-400' },
  brene_brown: { bg: 'bg-pink-500/15', border: 'border-pink-500/50', text: 'text-pink-400' },
  gary_vee: { bg: 'bg-blue-500/15', border: 'border-blue-500/50', text: 'text-blue-400' },
  oprah: { bg: 'bg-purple-500/15', border: 'border-purple-500/50', text: 'text-purple-400' },
  eric_thomas: { bg: 'bg-emerald-500/15', border: 'border-emerald-500/50', text: 'text-emerald-400' },
  simon_sinek: { bg: 'bg-cyan-500/15', border: 'border-cyan-500/50', text: 'text-cyan-400' },
};

export function SpeakerArchetypeSelector({ value, onChange, disabled }: SpeakerArchetypeSelectorProps) {
  const [isEnabled, setIsEnabled] = useState(value?.enabled ?? false);
  const [archetype, setArchetype] = useState<SpeakerArchetype>(value?.archetype ?? 'tony_robbins');
  const [deliveryStyle, setDeliveryStyle] = useState(value?.deliveryStyle ?? '');
  const [bodyLanguage, setBodyLanguage] = useState(value?.bodyLanguage ?? '');
  const [vocalTone, setVocalTone] = useState(value?.vocalTone ?? '');

  const enabled = isEnabled && !disabled;

  function toggleEnabled() {
    const newEnabled = !isEnabled;
    setIsEnabled(newEnabled);
    if (newEnabled) {
      const archetypeData = SPEAKER_ARCHETYPES.find(a => a.value === archetype);
      onChange({
        enabled: true,
        archetype,
        deliveryStyle: deliveryStyle || archetypeData?.style || '',
        bodyLanguage: bodyLanguage || '',
        vocalTone: vocalTone || '',
      });
    } else {
      onChange(undefined);
    }
  }

  function updateArchetype(newArchetype: SpeakerArchetype) {
    setArchetype(newArchetype);
    const archetypeData = SPEAKER_ARCHETYPES.find(a => a.value === newArchetype);
    onChange({
      enabled: true,
      archetype: newArchetype,
      deliveryStyle: deliveryStyle || archetypeData?.style || '',
      bodyLanguage: bodyLanguage || '',
      vocalTone: vocalTone || '',
    });
  }

  function updateDeliveryStyle(style: string) {
    setDeliveryStyle(style);
    onChange({ enabled: true, archetype, deliveryStyle: style, bodyLanguage, vocalTone });
  }

  function updateBodyLanguage(language: string) {
    setBodyLanguage(language);
    onChange({ enabled: true, archetype, deliveryStyle, bodyLanguage: language, vocalTone });
  }

  function updateVocalTone(tone: string) {
    setVocalTone(tone);
    onChange({ enabled: true, archetype, deliveryStyle, bodyLanguage, vocalTone: tone });
  }

  const colors = ARCHETYPE_COLORS[archetype];
  const Icon = ARCHETYPE_ICONS[archetype];
  const archetypeData = SPEAKER_ARCHETYPES.find(a => a.value === archetype);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
              type="button"
              onClick={toggleEnabled}
              disabled={disabled}
              aria-label="Enable speaker archetype"
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
            <span className="text-sm font-medium text-zinc-200">Speaker Archetype</span>
            <p className="text-xs text-zinc-500">Drill Sergeant, Tony Robbins, Brené Brown, Gary Vee, Oprah, etc.</p>
          </div>
        </div>
      </div>

      {enabled && (
        <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          {/* Archetype Selection */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Select Archetype</label>
            <div className="grid grid-cols-2 gap-2">
              {SPEAKER_ARCHETYPES.map((type) => {
                const TypeIcon = ARCHETYPE_ICONS[type.value];
                const isSelected = archetype === type.value;
                const typeColors = ARCHETYPE_COLORS[type.value];

                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => updateArchetype(type.value)}
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

          {/* Archetype Details */}
          {archetypeData && (
            <div className={`rounded-lg border ${colors.border} ${colors.bg} p-3 space-y-2`}>
              <div className="flex items-center gap-2">
                <Icon className={`h-3.5 w-3.5 ${colors.text}`} />
                <span className={`text-xs font-medium ${colors.text}`}>{archetypeData.label} Style</span>
              </div>
              <p className="text-xs text-zinc-400">{archetypeData.description}</p>
              <div className="space-y-1 text-[10px] text-zinc-500">
                <p><span className="text-zinc-400">Style:</span> {archetypeData.style}</p>
              </div>
            </div>
          )}

          {/* Customization */}
          <div className="space-y-3">
            <label className="text-xs font-medium text-zinc-400">Customize Style (Optional)</label>
            
            <div className="space-y-2">
              <input
                type="text"
                value={deliveryStyle}
                onChange={(e) => updateDeliveryStyle(e.target.value)}
                placeholder={`Delivery style (default: ${archetypeData?.style || 'dynamic'})`}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:border-red-500/50 focus:outline-none"
              />
            </div>

            <div className="space-y-2">
              <input
                type="text"
                value={bodyLanguage}
                onChange={(e) => updateBodyLanguage(e.target.value)}
                placeholder="Body language (e.g., expressive gestures, commanding stance)"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:border-red-500/50 focus:outline-none"
              />
            </div>

            <div className="space-y-2">
              <input
                type="text"
                value={vocalTone}
                onChange={(e) => updateVocalTone(e.target.value)}
                placeholder="Vocal tone (e.g., powerful, warm, intense)"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:border-red-500/50 focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
