import { useState, useMemo } from 'react';
import { useClipCreation } from '../../hooks/useClipCreation';
import type { WizardStepDef } from '../../hooks/useClipCreation';
import { PageHeader, EffectsModal } from '../../components/create/CommonCreateSections';
import { CreationWizard } from '../../components/create/CreationWizard';
import { AdvancedSettingsDrawer } from '../../components/create/AdvancedSettingsDrawer';
import { QuickGenerateModal } from '../../components/create/QuickGenerateModal';
import { ContentStep } from '../../components/create/steps/ContentStep';
import { MotivationalStyleStep } from '../../components/create/steps/MotivationalStyleStep';
import { GenerateStep } from '../../components/create/steps/GenerateStep';
import { SelectionSummary } from '../../components/create/SelectionSummary';
import type {
  SpeakerStyle,
  MotivationalSetting,
  CameraStyle,
  LightingMood,
  TransformationArc,
  AudienceEnergyConfig,
  MotivationalSoundscapeConfig,
  BreakthroughMoment,
  EventEnergyArcConfig,
  LiveChallenge,
  SpeakerArchetypeConfig,
  PauseForEffectConfig,
  AchievementContext,
  CTAPivotConfig,
  MotivationalEnhancementConfig,
} from '../../lib/types';

const STEPS: WizardStepDef[] = [
  { label: 'Content' },
  { label: 'Style & Enhance' },
  { label: 'Generate' },
];

export function CreateMotivationalPage() {
  const clip = useClipCreation('motivational', STEPS);
  const [showQuickGen, setShowQuickGen] = useState(false);

  const [speakerStyle, setSpeakerStyle] = useState<SpeakerStyle>('intense_coach');
  const [motivationalSetting, setMotivationalSetting] = useState<MotivationalSetting>('gym');
  const [cameraStyle, setCameraStyle] = useState<CameraStyle>('dramatic_push');
  const [lightingMood, setLightingMood] = useState<LightingMood>('dramatic_shadows');

  const [transformationArc, setTransformationArc] = useState<TransformationArc | undefined>();
  const [audienceEnergy, setAudienceEnergy] = useState<AudienceEnergyConfig | undefined>();
  const [motivationalSoundscape, setMotivationalSoundscape] = useState<MotivationalSoundscapeConfig | undefined>();
  const [breakthroughMoment, setBreakthroughMoment] = useState<BreakthroughMoment | undefined>();
  const [eventEnergyArc, setEventEnergyArc] = useState<EventEnergyArcConfig | undefined>();
  const [liveChallenge, setLiveChallenge] = useState<LiveChallenge | undefined>();
  const [speakerArchetype, setSpeakerArchetype] = useState<SpeakerArchetypeConfig | undefined>();
  const [pauseForEffect, setPauseForEffect] = useState<PauseForEffectConfig | undefined>();
  const [achievementContext, setAchievementContext] = useState<AchievementContext | undefined>();
  const [ctaPivot, setCtaPivot] = useState<CTAPivotConfig | undefined>();

  function buildMotivationalEnhancements(): MotivationalEnhancementConfig | undefined {
    const hasEnhancements = transformationArc?.enabled ||
      audienceEnergy?.enabled ||
      motivationalSoundscape?.enabled ||
      breakthroughMoment?.enabled ||
      eventEnergyArc?.enabled ||
      liveChallenge?.enabled ||
      speakerArchetype?.enabled ||
      pauseForEffect?.enabled ||
      achievementContext?.enabled ||
      ctaPivot?.enabled;
    if (!hasEnhancements) return undefined;
    return {
      transformationArc, audienceEnergy,
      soundscape: motivationalSoundscape,
      breakthroughMoment, eventEnergyArc, liveChallenge,
      speakerArchetype, pauseForEffect, achievementContext, ctaPivot,
    };
  }

  function handleGenerate() {
    clip.generateClip({
      speakerStyle,
      motivationalSetting,
      cameraStyle,
      lightingMood,
      motivationalEnhancements: buildMotivationalEnhancements(),
    });
  }

  const activeEnhancements = [
    transformationArc?.enabled && 'Arc',
    audienceEnergy?.enabled && 'Audience',
    motivationalSoundscape?.enabled && 'Sound',
    breakthroughMoment?.enabled && 'Breakthrough',
    eventEnergyArc?.enabled && 'Energy',
    liveChallenge?.enabled && 'Challenge',
    speakerArchetype?.enabled && 'Archetype',
    pauseForEffect?.enabled && 'Pause',
    achievementContext?.enabled && 'Achievement',
    ctaPivot?.enabled && 'CTA',
  ].filter(Boolean) as string[];

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
        { label: 'Speaker', value: speakerStyle.replace(/_/g, ' ') },
        { label: 'Setting', value: motivationalSetting.replace(/_/g, ' ') },
        { label: 'Camera', value: cameraStyle.replace(/_/g, ' ') },
        { label: 'Lighting', value: lightingMood.replace(/_/g, ' ') },
      ],
    },
    {
      label: 'Enhancements',
      stepIndex: 1,
      items: activeEnhancements.length > 0
        ? activeEnhancements.map(e => ({ label: '', value: e }))
        : [{ label: '', value: 'None' }],
    },
  ], [clip.topic, clip.duration, speakerStyle, motivationalSetting, cameraStyle, lightingMood, activeEnhancements]);

  const quickGenDefaults = [
    { label: 'Topic', value: clip.topic },
    { label: 'Duration', value: `${clip.duration}s` },
    { label: 'Speaker', value: 'Intense Coach' },
    { label: 'Setting', value: 'Gym' },
    { label: 'Camera', value: 'Dramatic Push' },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader
        title="Motivational"
        description="Cinematic motivational speaker clips with dramatic camera work."
        clip={clip}
      />

      <CreationWizard clip={clip} steps={STEPS} accentColor="red" onGenerate={handleGenerate}>
        <ContentStep clip={clip} onQuickGenerate={() => setShowQuickGen(true)} />

        <MotivationalStyleStep
          clip={clip}
          speakerStyle={speakerStyle}
          setSpeakerStyle={setSpeakerStyle}
          motivationalSetting={motivationalSetting}
          setMotivationalSetting={setMotivationalSetting}
          cameraStyle={cameraStyle}
          setCameraStyle={setCameraStyle}
          lightingMood={lightingMood}
          setLightingMood={setLightingMood}
          transformationArc={transformationArc}
          setTransformationArc={setTransformationArc}
          audienceEnergy={audienceEnergy}
          setAudienceEnergy={setAudienceEnergy}
          motivationalSoundscape={motivationalSoundscape}
          setMotivationalSoundscape={setMotivationalSoundscape}
          breakthroughMoment={breakthroughMoment}
          setBreakthroughMoment={setBreakthroughMoment}
          eventEnergyArc={eventEnergyArc}
          setEventEnergyArc={setEventEnergyArc}
          liveChallenge={liveChallenge}
          setLiveChallenge={setLiveChallenge}
          speakerArchetype={speakerArchetype}
          setSpeakerArchetype={setSpeakerArchetype}
          pauseForEffect={pauseForEffect}
          setPauseForEffect={setPauseForEffect}
          achievementContext={achievementContext}
          setAchievementContext={setAchievementContext}
          ctaPivot={ctaPivot}
          setCtaPivot={setCtaPivot}
        />

        <GenerateStep
          clip={clip}
          onGenerate={handleGenerate}
          showSpeechScript={false}
          summaryCard={<SelectionSummary groups={summaryGroups} onEditStep={clip.goToStep} />}
          scriptContext={{ speakerStyle }}
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
