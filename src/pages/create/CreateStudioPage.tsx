import { Film } from 'lucide-react';
import { useState } from 'react';
import { useClipCreation } from '../../hooks/useClipCreation';
import {
  PageHeader,
  KeywordSection,
  TopicDurationRow,
  CharacterSection,
  ModelSection,
  AdvancedOptionsSection,
  GenerateSection,
  EffectsModal,
} from '../../components/create/CommonCreateSections';
import { StudioSetupSelector } from '../../components/StudioSetupSelector';
import { StudioLightingSelector } from '../../components/StudioLightingSelector';
import type { StudioSetup, StudioLighting } from '../../lib/types';

export function CreateStudioPage() {
  const clip = useClipCreation('studio_interview');

  const [studioSetup, setStudioSetup] = useState<StudioSetup>('podcast_desk');
  const [studioLighting, setStudioLighting] = useState<StudioLighting>('three_point');

  function handleGenerate() {
    clip.generateClip({
      studioSetup,
      studioLighting,
      interviewStyle: 'deep_conversation',
    });
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader
        title="Studio Interview"
        description="One prompt generates a single 2-8 second clip. Professional studio interviews with polished lighting and set design."
        clip={clip}
      />

      <KeywordSection clip={clip} />

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 space-y-6">
        <TopicDurationRow clip={clip} />

        <div className="border-t border-zinc-800 pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Film className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium text-amber-400">Studio Setup</span>
          </div>
          <div className="space-y-4">
            <StudioSetupSelector value={studioSetup} onChange={setStudioSetup} disabled={clip.busy} />
            <StudioLightingSelector value={studioLighting} onChange={setStudioLighting} disabled={clip.busy} />
          </div>
        </div>

        <CharacterSection clip={clip} />
        <ModelSection clip={clip} showSpeechScript={true} />
        <AdvancedOptionsSection clip={clip} />
        <GenerateSection
          clip={clip}
          onGenerate={handleGenerate}
        />
      </div>

      <p className="mt-6 text-xs text-zinc-600">
        Professional studio interview clips. Configure your set, lighting, and guest setup for polished content.
      </p>

      <EffectsModal clip={clip} />
    </div>
  );
}
