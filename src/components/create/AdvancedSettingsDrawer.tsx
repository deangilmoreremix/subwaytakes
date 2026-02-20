import { X } from 'lucide-react';
import type { ClipCreationHook } from '../../hooks/useClipCreation';
import { InterviewFormatSelector } from '../InterviewFormatSelector';
import { DurationSelector } from '../DurationSelector';
import { LanguageSelector } from '../LanguageSelector';
import { NicheSelector } from '../NicheSelector';
import { CaptionStyleSelector } from '../CaptionStyleSelector';
import { PlatformExportSelector } from '../PlatformExportSelector';
import { ProductPlacementPanel } from '../ProductPlacementConfig';
import { KeywordGenerator } from '../KeywordGenerator';

interface AdvancedSettingsDrawerProps {
  clip: ClipCreationHook;
}

export function AdvancedSettingsDrawer({ clip }: AdvancedSettingsDrawerProps) {
  if (!clip.showAdvanced) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => clip.setShowAdvanced(false)}
      />

      <div className="relative w-full max-w-md bg-zinc-900 border-l border-zinc-800 overflow-y-auto animate-slide-in-right">
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/95 backdrop-blur-sm">
          <h2 className="text-lg font-semibold text-zinc-100">Advanced Settings</h2>
          <button
            type="button"
            onClick={() => clip.setShowAdvanced(false)}
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-6 space-y-8">
          <section>
            <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-4">Output</h3>
            <div className="space-y-4">
              <InterviewFormatSelector
                value={clip.interviewFormat}
                onChange={clip.setInterviewFormat}
                disabled={clip.busy}
              />
              <DurationSelector
                value={clip.durationPreset}
                onChange={clip.setDurationPreset}
                disabled={clip.busy}
              />
              <CaptionStyleSelector
                value={clip.captionStyle}
                onChange={clip.setCaptionStyle}
                disabled={clip.busy}
              />
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-4">Distribution</h3>
            <div className="space-y-4">
              <LanguageSelector
                value={clip.language}
                onChange={clip.setLanguage}
                disabled={clip.busy}
              />
              <PlatformExportSelector
                value={clip.exportPlatforms}
                onChange={clip.setExportPlatforms}
                disabled={clip.busy}
              />
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-4">Audience</h3>
            <NicheSelector
              value={clip.niche}
              onChange={clip.setNiche}
              disabled={clip.busy}
            />
          </section>

          <section>
            <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-4">Monetization</h3>
            <ProductPlacementPanel
              config={clip.productPlacement}
              onChange={clip.setProductPlacement}
              disabled={clip.busy}
            />
          </section>

          <section>
            <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-4">Keywords</h3>
            <KeywordGenerator
              keyword={clip.keyword}
              onKeywordChange={clip.setKeyword}
              niche={clip.niche}
              onNicheChange={clip.setNiche}
              onGenerate={() => clip.setIsGeneratingKeywords(true)}
              isGenerating={clip.isGeneratingKeywords}
              disabled={clip.busy}
            />
          </section>
        </div>

        <div className="sticky bottom-0 px-6 py-4 border-t border-zinc-800 bg-zinc-900/95 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => clip.setShowAdvanced(false)}
            className="w-full py-2.5 text-sm font-semibold text-black bg-amber-500 hover:bg-amber-400 rounded-xl transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
