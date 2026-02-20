import { Heart } from 'lucide-react';
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
import { WisdomFormatSelector } from '../../components/WisdomFormatSelector';
import { WisdomToneSelector } from '../../components/WisdomToneSelector';
import { WisdomDemographicSelector } from '../../components/WisdomDemographicSelector';
import { WisdomSettingSelector } from '../../components/WisdomSettingSelector';
import type {
  WisdomTone,
  WisdomFormat,
  WisdomDemographic,
  WisdomSetting,
} from '../../lib/types';

export function CreateWisdomPage() {
  const clip = useClipCreation('wisdom_interview');

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

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader
        title="Wisdom Interview"
        description="One prompt generates a single 2-8 second clip. Heartfelt conversations with experienced voices sharing life lessons."
        clip={clip}
      />

      <KeywordSection clip={clip} />

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 space-y-6">
        <TopicDurationRow clip={clip} />

        <div className="border-t border-zinc-800 pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Heart className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium text-amber-400">Wisdom Mode Options</span>
          </div>
          <div className="space-y-4">
            <WisdomFormatSelector value={wisdomFormat} onChange={setWisdomFormat} disabled={clip.busy} />
            <WisdomToneSelector value={wisdomTone} onChange={setWisdomTone} disabled={clip.busy} />
            <WisdomDemographicSelector value={wisdomDemographic} onChange={setWisdomDemographic} disabled={clip.busy} />
            <WisdomSettingSelector value={wisdomSetting} onChange={setWisdomSetting} disabled={clip.busy} />
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
        Wisdom interview clips for 55+ audience. Life lessons, retirement advice, and heartfelt conversations.
      </p>

      <EffectsModal clip={clip} />
    </div>
  );
}
