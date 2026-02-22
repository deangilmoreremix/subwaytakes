import { useState, useMemo } from 'react';
import { useClipCreation } from '../../hooks/useClipCreation';
import type { WizardStepDef } from '../../hooks/useClipCreation';
import { PageHeader, EffectsModal } from '../../components/create/CommonCreateSections';
import { CreationWizard } from '../../components/create/CreationWizard';
import { AdvancedSettingsDrawer } from '../../components/create/AdvancedSettingsDrawer';
import { QuickGenerateModal } from '../../components/create/QuickGenerateModal';
import { ContentStep } from '../../components/create/steps/ContentStep';
import { WisdomStyleStep } from '../../components/create/steps/WisdomStyleStep';
import { GenerateStep } from '../../components/create/steps/GenerateStep';
import { SelectionSummary } from '../../components/create/SelectionSummary';
import type {
  WisdomTone,
  WisdomFormat,
  WisdomDemographic,
  WisdomSetting,
} from '../../lib/types';

const STEPS: WizardStepDef[] = [
  { label: 'Content' },
  { label: 'Style' },
  { label: 'Generate' },
];

export function CreateWisdomPage() {
  const clip = useClipCreation('wisdom_interview', STEPS);
  const [showQuickGen, setShowQuickGen] = useState(false);

  const [wisdomTone, setWisdomTone] = useState<WisdomTone>('gentle');
  const [wisdomFormat, setWisdomFormat] = useState<WisdomFormat>('street_conversation');
  const [wisdomDemographic, setWisdomDemographic] = useState<WisdomDemographic>('retirees');
  const [wisdomSetting, setWisdomSetting] = useState<WisdomSetting>('park_bench');

  function handleGenerate() {
    clip.generateClip({
      wisdomTone,
      wisdomFormat,
      wisdomDemographic,
      wisdomSetting,
      interviewStyle: 'man_on_street',
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
      label: 'Style',
      stepIndex: 1,
      items: [
        { label: 'Format', value: wisdomFormat.replace(/_/g, ' ') },
        { label: 'Tone', value: wisdomTone },
        { label: 'Demographic', value: wisdomDemographic },
        { label: 'Setting', value: wisdomSetting.replace(/_/g, ' ') },
      ],
    },
  ], [clip.topic, clip.duration, wisdomFormat, wisdomTone, wisdomDemographic, wisdomSetting]);

  const quickGenDefaults = [
    { label: 'Topic', value: clip.topic },
    { label: 'Duration', value: `${clip.duration}s` },
    { label: 'Format', value: 'Street Conversation' },
    { label: 'Tone', value: 'Gentle' },
    { label: 'Demographic', value: 'Retirees' },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader
        title="Wisdom Interview"
        description="Heartfelt conversations with experienced voices sharing life lessons."
        clip={clip}
      />

      <CreationWizard clip={clip} steps={STEPS} accentColor="amber" onGenerate={handleGenerate}>
        <ContentStep clip={clip} onQuickGenerate={() => setShowQuickGen(true)} />

        <WisdomStyleStep
          clip={clip}
          wisdomFormat={wisdomFormat}
          setWisdomFormat={setWisdomFormat}
          wisdomTone={wisdomTone}
          setWisdomTone={setWisdomTone}
          wisdomDemographic={wisdomDemographic}
          setWisdomDemographic={setWisdomDemographic}
          wisdomSetting={wisdomSetting}
          setWisdomSetting={setWisdomSetting}
        />

        <GenerateStep
          clip={clip}
          onGenerate={handleGenerate}
          showSpeechScript={true}
          summaryCard={<SelectionSummary groups={summaryGroups} onEditStep={clip.goToStep} />}
          scriptContext={{ wisdomTone, wisdomFormat, wisdomDemographic, wisdomSetting }}
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
