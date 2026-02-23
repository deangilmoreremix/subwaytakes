import { Users } from 'lucide-react';
import type {
  SocialDynamicsConfig,
  CrowdReactionStyle,
  PasserbyInteraction,
  BodyLanguageIntensity,
} from '../lib/types';

interface SocialDynamicsPanelProps {
  value: SocialDynamicsConfig;
  onChange: (v: SocialDynamicsConfig) => void;
  disabled?: boolean;
}

const CROWD_OPTIONS: { value: CrowdReactionStyle; label: string; desc: string }[] = [
  { value: 'supportive', label: 'Supportive', desc: 'Nodding, agreeing' },
  { value: 'skeptical', label: 'Skeptical', desc: 'Doubtful glances' },
  { value: 'curious', label: 'Curious', desc: 'Leaning in' },
  { value: 'mixed', label: 'Mixed', desc: 'Varied reactions' },
];

const PASSERBY_OPTIONS: { value: PasserbyInteraction; label: string; desc: string }[] = [
  { value: 'none', label: 'None', desc: 'No interruptions' },
  { value: 'light', label: 'Light', desc: 'Brief glances' },
  { value: 'moderate', label: 'Moderate', desc: 'Occasional stops' },
  { value: 'heavy', label: 'Heavy', desc: 'Active participation' },
];

const BODY_LANGUAGE_OPTIONS: { value: BodyLanguageIntensity; label: string; desc: string }[] = [
  { value: 'reserved', label: 'Reserved', desc: 'Minimal gestures' },
  { value: 'natural', label: 'Natural', desc: 'Relaxed movement' },
  { value: 'animated', label: 'Animated', desc: 'Expressive hands' },
  { value: 'dramatic', label: 'Dramatic', desc: 'Big reactions' },
];

function ChipGroup<T extends string>({
  label,
  options,
  selected,
  onSelect,
  disabled,
}: {
  label: string;
  options: { value: T; label: string; desc: string }[];
  selected: T;
  onSelect: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-zinc-400 mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(opt.value)}
            className={`px-3 py-1.5 rounded-lg border text-xs transition-all ${
              selected === opt.value
                ? 'border-amber-500/60 bg-amber-500/10 text-amber-300'
                : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={opt.desc}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SocialDynamicsPanel({
  value,
  onChange,
  disabled = false,
}: SocialDynamicsPanelProps) {
  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-zinc-300">
        <Users className="inline w-4 h-4 mr-1.5 -mt-0.5 text-zinc-400" />
        Social Dynamics
      </label>

      <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/20 p-4 space-y-4">
        <ChipGroup
          label="Crowd Reaction"
          options={CROWD_OPTIONS}
          selected={value.crowdReaction}
          onSelect={(v) => onChange({ ...value, crowdReaction: v })}
          disabled={disabled}
        />
        <ChipGroup
          label="Passerby Interaction"
          options={PASSERBY_OPTIONS}
          selected={value.passerbyInteraction}
          onSelect={(v) => onChange({ ...value, passerbyInteraction: v })}
          disabled={disabled}
        />
        <ChipGroup
          label="Body Language"
          options={BODY_LANGUAGE_OPTIONS}
          selected={value.bodyLanguage}
          onSelect={(v) => onChange({ ...value, bodyLanguage: v })}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
