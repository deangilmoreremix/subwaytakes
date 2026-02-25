import { Pencil, Settings } from 'lucide-react';
import type { ClipCreationHook } from '../../hooks/useClipCreation';

interface SummaryGroup {
  label: string;
  items: { label: string; value: string }[];
  stepIndex: number;
}

interface SelectionSummaryProps {
  groups: SummaryGroup[];
  onEditStep: (step: number) => void;
  clip?: ClipCreationHook;
}

function countActiveEffects(effects: Record<string, unknown>): number {
  let count = 0;
  for (const val of Object.values(effects)) {
    if (val && typeof val === 'object' && 'enabled' in (val as Record<string, unknown>)) {
      if ((val as Record<string, unknown>).enabled) count++;
    }
  }
  return count;
}

function buildAdvancedItems(clip: ClipCreationHook): { label: string; value: string }[] {
  const items: { label: string; value: string }[] = [];
  if (clip.language !== 'en') items.push({ label: 'Language', value: clip.language });
  if (clip.niche !== 'motivation') items.push({ label: 'Niche', value: clip.niche.replace(/_/g, ' ') });
  if (clip.captionStyle !== 'standard') items.push({ label: 'Captions', value: clip.captionStyle });
  if (clip.interviewFormat !== 'solo') items.push({ label: 'Format', value: clip.interviewFormat });
  if (clip.durationPreset !== 'hook') items.push({ label: 'Preset', value: clip.durationPreset.replace(/_/g, ' ') });
  if (clip.exportPlatforms.length > 0) {
    items.push({ label: 'Platforms', value: clip.exportPlatforms.join(', ') });
  }
  if (clip.modelTier !== 'standard') items.push({ label: 'Model', value: clip.modelTier });
  if (clip.targetAgeGroup !== 'all_ages') items.push({ label: 'Age', value: clip.targetAgeGroup.replace(/_/g, ' ') });
  if (clip.productPlacement.enabled) items.push({ label: 'Product', value: clip.productPlacement.productName || 'Enabled' });
  const activeEffects = countActiveEffects(clip.effects as unknown as Record<string, unknown>);
  if (activeEffects > 0) items.push({ label: 'Effects', value: `${activeEffects} active` });
  return items;
}

export function SelectionSummary({ groups, onEditStep, clip }: SelectionSummaryProps) {
  const advancedItems = clip ? buildAdvancedItems(clip) : [];

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-800/20 divide-y divide-zinc-800">
      {groups.map((group, gi) => (
        <div key={gi} className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              {group.label}
            </span>
            <button
              type="button"
              onClick={() => onEditStep(group.stepIndex)}
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-amber-400 transition-colors"
            >
              <Pencil className="w-3 h-3" />
              Edit
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {group.items.map((item, ii) => (
              <span
                key={ii}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800 text-xs text-zinc-300"
              >
                {item.label && <span className="text-zinc-500">{item.label}:</span>}
                {item.value}
              </span>
            ))}
          </div>
        </div>
      ))}
      {advancedItems.length > 0 && clip && (
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Advanced
            </span>
            <button
              type="button"
              onClick={() => clip.setShowAdvanced(true)}
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-amber-400 transition-colors"
            >
              <Settings className="w-3 h-3" />
              Edit
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {advancedItems.map((item, ii) => (
              <span
                key={ii}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800 text-xs text-zinc-300"
              >
                <span className="text-zinc-500">{item.label}:</span>
                {item.value}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
