import { useState, useMemo } from 'react';
import { useClipCreation } from '../../hooks/useClipCreation';
import type { WizardStepDef } from '../../hooks/useClipCreation';
import { PageHeader, EffectsModal } from '../../components/create/CommonCreateSections';
import { CreationWizard } from '../../components/create/CreationWizard';
import { AdvancedSettingsDrawer } from '../../components/create/AdvancedSettingsDrawer';
import { QuickGenerateModal } from '../../components/create/QuickGenerateModal';
import { ContentStep } from '../../components/create/steps/ContentStep';
import { StudioSetupStep } from '../../components/create/steps/StudioSetupStep';
import { GenerateStep } from '../../components/create/steps/GenerateStep';
import { SelectionSummary } from '../../components/create/SelectionSummary';
import type { StudioSetup, StudioLighting } from '../../lib/types';

const STEPS: WizardStepDef[] = [
  { label: 'Content' },
  { label: 'Setup' },
  { label: 'Generate' },
];

export function CreateStudioPage() {
  const clip = useClipCreation('studio_interview', STEPS);
  const [showQuickGen, setShowQuickGen] = useState(false);

  const [studioSetup, setStudioSetup] = useState<StudioSetup>('podcast_desk');
  const [studioLighting, setStudioLighting] = useState<StudioLighting>('three_point');

  function handleGenerate() {
    clip.generateClip({
      studioSetup,
      studioLighting,
      interviewStyle: 'deep_conversation',
    });
  }

  const summaryGroups = useMemo(() => [
    {
      label: 'Content',
      stepIndex: 0,
      items: [
        { label: 'Topic', value: clip.topic },
        { label: 'Duration', value: `${clip.duration}s` },
      ],
    },
    {
      label: 'Setup',
      stepIndex: 1,
      items: [
        { label: 'Setup', value: studioSetup.replace(/_/g, ' ') },
        { label: 'Lighting', value: studioLighting.replace(/_/g, ' ') },
      ],
    },
  ], [clip.topic, clip.duration, studioSetup, studioLighting]);

  const quickGenDefaults = [
    { label: 'Topic', value: clip.topic },
    { label: 'Duration', value: `${clip.duration}s` },
    { label: 'Setup', value: 'Podcast Desk' },
    { label: 'Lighting', value: 'Three Point' },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader
        title="Studio Interview"
        description="Professional studio interviews with polished lighting and set design."
        clip={clip}
      />

      <CreationWizard clip={clip} steps={STEPS} accentColor="sky" onGenerate={handleGenerate}>
        <ContentStep clip={clip} onQuickGenerate={() => setShowQuickGen(true)} />

        <StudioSetupStep
          clip={clip}
          studioSetup={studioSetup}
          setStudioSetup={setStudioSetup}
          studioLighting={studioLighting}
          setStudioLighting={setStudioLighting}
        />

        <GenerateStep
          clip={clip}
          onGenerate={handleGenerate}
          showSpeechScript={true}
          summaryCard={<SelectionSummary groups={summaryGroups} onEditStep={clip.goToStep} />}
          scriptContext={{ studioSetup }}
        />
      </CreationWizard>

      <AdvancedSettingsDrawer clip={clip} />
      <EffectsModal clip={clip} />

      <QuickGenerateModal
        open={showQuickGen}
        onClose={() => setShowQuickGen(false)}
        onConfirm={() => { setShowQuickGen(false); handleGenerate(); }}
        onCustomize={() => { setShowQuickGen(false); clip.nextStep(); }}
        defaults={quickGenDefaults}
      />
    </div>
  );
}
