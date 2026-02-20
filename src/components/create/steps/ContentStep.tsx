import { useState } from 'react';
import { Wand2, Zap } from 'lucide-react';
import type { ClipCreationHook } from '../../../hooks/useClipCreation';
import { TopicSelect } from '../../TopicSelect';
import { DurationChips } from '../../DurationChips';
import { AgeGroupSelector } from '../../AgeGroupSelector';
import { KeywordInput } from '../../KeywordInput';
import { CompactEffectsBar } from '../../CompactEffectsBar';

interface ContentStepProps {
  clip: ClipCreationHook;
  onQuickGenerate: () => void;
}

export function ContentStep({ clip, onQuickGenerate }: ContentStepProps) {
  const [showKeyword, setShowKeyword] = useState(false);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 space-y-6">
      <AgeGroupSelector
        value={clip.targetAgeGroup}
        onChange={clip.setTargetAgeGroup}
        showSuggestions={true}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TopicSelect
          value={clip.topic}
          topics={clip.topics}
          onChange={clip.setTopic}
          disabled={clip.busy}
          allowCustom={clip.clipType === 'subway_interview'}
        />
        <DurationChips
          value={clip.duration}
          options={clip.DURATION_OPTIONS}
          onChange={clip.setDuration}
          disabled={clip.busy}
        />
      </div>

      <CompactEffectsBar
        clipType={clip.clipType}
        effects={clip.effects}
        onCustomize={() => clip.setShowEffectsModal(true)}
      />

      <div className="border-t border-zinc-800 pt-5">
        {!showKeyword ? (
          <button
            type="button"
            onClick={() => setShowKeyword(true)}
            className="flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 transition-colors"
          >
            <Wand2 className="w-4 h-4" />
            Use AI to pick settings
          </button>
        ) : (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Wand2 className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium text-amber-400">AI Keyword Generator</span>
            </div>
            <KeywordInput
              onKeywordAnalyzed={clip.handleKeywordAnalyzed}
              disabled={clip.busy}
              forceClipType={clip.clipType}
            />
          </div>
        )}
      </div>

      <div className="border-t border-zinc-800 pt-5 flex justify-end">
        <button
          type="button"
          onClick={onQuickGenerate}
          disabled={clip.busy}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-zinc-300 rounded-xl border border-zinc-700 hover:border-amber-500/40 hover:text-amber-400 hover:bg-amber-500/5 transition-all disabled:opacity-50"
        >
          <Zap className="w-4 h-4" />
          Quick Generate
        </button>
      </div>
    </div>
  );
}
