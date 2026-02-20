import { ReactNode } from 'react';
import { Zap, Layers } from 'lucide-react';
import type { ClipCreationHook } from '../../../hooks/useClipCreation';
import { ModelTierSelector } from '../../ModelTierSelector';
import { AngleInput } from '../../AngleInput';
import { StatusCard } from '../../StatusCard';
import { CompactEffectsBar } from '../../CompactEffectsBar';

interface GenerateStepProps {
  clip: ClipCreationHook;
  onGenerate: () => void;
  showSpeechScript: boolean;
  showBatchMode?: boolean;
  summaryCard: ReactNode;
}

export function GenerateStep({ clip, onGenerate, showSpeechScript, showBatchMode, summaryCard }: GenerateStepProps) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-zinc-300 mb-3">Your Selections</h3>
        {summaryCard}
      </div>

      <div className="border-t border-zinc-800 pt-5 space-y-5">
        <ModelTierSelector
          value={clip.modelTier}
          onChange={clip.setModelTier}
          disabled={clip.busy}
        />

        {showSpeechScript && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-300">
              Speech Script (optional)
            </label>
            <textarea
              value={clip.speechScript}
              onChange={(e) => clip.setSpeechScript(e.target.value)}
              disabled={clip.busy}
              placeholder="What should the person say? Leave blank for AI-generated contextual response..."
              rows={2}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50 disabled:opacity-50 disabled:cursor-not-allowed resize-none"
            />
          </div>
        )}

        <AngleInput
          value={clip.angle}
          placeholder={clip.getPlaceholderText()}
          onChange={clip.setAngle}
          disabled={clip.busy}
          label="Additional Direction (optional)"
        />

        <CompactEffectsBar
          clipType={clip.clipType}
          effects={clip.effects}
          onCustomize={() => clip.setShowEffectsModal(true)}
        />
      </div>

      {showBatchMode && (
        <div className="border-t border-zinc-800 pt-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => clip.setBatchMode(!clip.batchMode)}
                disabled={clip.busy}
                className={`relative h-6 w-11 rounded-full transition-colors ${clip.batchMode ? 'bg-amber-500' : 'bg-zinc-700'} ${clip.busy ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${clip.batchMode ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
              <div>
                <span className="text-sm font-medium text-zinc-200">Generate Series</span>
                <p className="text-xs text-zinc-500">Create multiple clips at once</p>
              </div>
            </div>
            {clip.batchMode && (
              <div className="flex gap-2">
                {clip.BATCH_SIZE_OPTIONS.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => clip.setBatchSize(size)}
                    disabled={clip.busy}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition-all ${clip.batchSize === size ? 'bg-amber-500/15 border-amber-500/50 text-amber-400' : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'} ${clip.busy ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {size} clips
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="border-t border-zinc-800 pt-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={onGenerate}
            disabled={clip.busy}
            className="flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-8 py-3.5 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {clip.batchMode ? (
              <>
                <Layers className="h-4 w-4" />
                {clip.busy ? 'Working...' : `Generate ${clip.batchSize} Clips`}
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                {clip.busy ? 'Working...' : 'Generate Clip'}
              </>
            )}
          </button>
          <p className="text-sm text-zinc-500">
            Vertical 9:16 | {clip.batchMode ? `${clip.batchSize} clip series` : 'Single clip'}
          </p>
        </div>
      </div>

      {clip.status !== 'idle' && (
        <StatusCard
          status={clip.status === 'planning' ? 'planning' : clip.status === 'generating' ? 'generating' : clip.status === 'error' ? 'error' : 'done'}
          message={clip.errorMessage || undefined}
        />
      )}
    </div>
  );
}
