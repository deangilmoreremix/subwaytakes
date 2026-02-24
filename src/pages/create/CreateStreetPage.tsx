import { useState, useMemo } from 'react';
import { useClipCreation } from '../../hooks/useClipCreation';
import type { WizardStepDef } from '../../hooks/useClipCreation';
import { PageHeader, EffectsModal } from '../../components/create/CommonCreateSections';
import { CreationWizard } from '../../components/create/CreationWizard';
import { AdvancedSettingsDrawer } from '../../components/create/AdvancedSettingsDrawer';
import { QuickGenerateModal } from '../../components/create/QuickGenerateModal';
import { ContentStep } from '../../components/create/steps/ContentStep';
import { StreetSceneStep } from '../../components/create/steps/StreetSceneStep';
import { StreetEnhancementsStep } from '../../components/create/steps/StreetEnhancementsStep';
import { GenerateStep } from '../../components/create/steps/GenerateStep';
import { SelectionSummary } from '../../components/create/SelectionSummary';
import type {
  StreetScene,
  InterviewStyle,
  TimeOfDay,
  EnergyLevel,
  Neighborhood,
  StreetMultiLocationJourney,
  StreetCrowdConfig,
  UrbanSoundscapeConfig,
  StreetPlotTwist,
  StreetPoll as StreetPollType,
  StreetDramaticMoment as StreetDramaticMomentType,
  StreetSeasonalContext,
  CrossStreetPivot as CrossStreetPivotType,
  StreetEnhancementConfig,
  SocialDynamicsConfig,
} from '../../lib/types';

const STEPS: WizardStepDef[] = [
  { label: 'Content' },
  { label: 'Scene' },
  { label: 'Enhance', optional: true },
  { label: 'Generate' },
];

export function CreateStreetPage() {
  const clip = useClipCreation('street_interview', STEPS);
  const [showQuickGen, setShowQuickGen] = useState(false);

  const [streetScene, setStreetScene] = useState<StreetScene>('busy_sidewalk');
  const [interviewStyle, setInterviewStyle] = useState<InterviewStyle>('man_on_street');
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('midday');
  const [energyLevel, setEnergyLevel] = useState<EnergyLevel>('conversational');
  const [scenarioDescription, setScenarioDescription] = useState('');
  const [socialDynamics, setSocialDynamics] = useState<SocialDynamicsConfig>({
    crowdReaction: 'mixed',
    passerbyInteraction: 'moderate',
    bodyLanguage: 'natural',
  });

  const [neighborhood, setNeighborhood] = useState<Neighborhood | undefined>('soho');
  const [streetMultiLocationJourney, setStreetMultiLocationJourney] = useState<StreetMultiLocationJourney | undefined>();
  const [streetCrowdConfig, setStreetCrowdConfig] = useState<StreetCrowdConfig | undefined>();
  const [urbanSoundscape, setUrbanSoundscape] = useState<UrbanSoundscapeConfig | undefined>();
  const [streetPlotTwist, setStreetPlotTwist] = useState<StreetPlotTwist | undefined>();
  const [streetPoll, setStreetPoll] = useState<StreetPollType | undefined>();
  const [streetDramaticMoment, setStreetDramaticMoment] = useState<StreetDramaticMomentType | undefined>();
  const [streetSeasonalContext, setStreetSeasonalContext] = useState<StreetSeasonalContext | undefined>();
  const [crossStreetPivot, setCrossStreetPivot] = useState<CrossStreetPivotType | undefined>();

  function buildStreetEnhancements(): StreetEnhancementConfig | undefined {
    const hasEnhancements = streetMultiLocationJourney?.enabled ||
      streetCrowdConfig?.enabled ||
      urbanSoundscape?.enabled ||
      streetPlotTwist ||
      streetPoll?.enabled ||
      streetDramaticMoment?.enabled ||
      streetSeasonalContext?.enabled ||
      crossStreetPivot?.enabled;
    if (!hasEnhancements) return undefined;
    return {
      multiLocationJourney: streetMultiLocationJourney,
      crowdDynamics: streetCrowdConfig,
      urbanSoundscape,
      plotTwist: streetPlotTwist,
      streetPoll,
      neighborhood,
      dramaticMoment: streetDramaticMoment,
      seasonalContext: streetSeasonalContext,
      crossStreetPivot,
    };
  }

  function handleGenerate() {
    clip.generateClip({
      streetScene,
      interviewStyle,
      timeOfDay,
      energyLevel,
      neighborhood,
      scenarioDescription: scenarioDescription || undefined,
      socialDynamics,
      streetEnhancements: buildStreetEnhancements(),
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
      label: 'Scene',
      stepIndex: 1,
      items: [
        { label: 'Scene', value: streetScene.replace(/_/g, ' ') },
        { label: 'Style', value: interviewStyle.replace(/_/g, ' ') },
        { label: 'Time', value: timeOfDay.replace(/_/g, ' ') },
        { label: 'Energy', value: energyLevel },
      ],
    },
    {
      label: 'Enhancements',
      stepIndex: 2,
      items: [
        ...(neighborhood ? [{ label: 'Hood', value: neighborhood }] : []),
        ...(streetMultiLocationJourney?.enabled ? [{ label: '', value: 'Journey' }] : []),
        ...(streetCrowdConfig?.enabled ? [{ label: '', value: 'Crowd' }] : []),
        ...(urbanSoundscape?.enabled ? [{ label: '', value: 'Soundscape' }] : []),
        ...(streetPlotTwist ? [{ label: '', value: 'Plot Twist' }] : []),
        ...(streetPoll?.enabled ? [{ label: '', value: 'Poll' }] : []),
        ...(streetDramaticMoment?.enabled ? [{ label: '', value: 'Dramatic' }] : []),
        ...(streetSeasonalContext?.enabled ? [{ label: '', value: 'Seasonal' }] : []),
        ...(crossStreetPivot?.enabled ? [{ label: '', value: 'Pivot' }] : []),
        ...(!buildStreetEnhancements() && !neighborhood ? [{ label: '', value: 'None' }] : []),
      ],
    },
  ], [clip.topic, clip.duration, streetScene, interviewStyle, timeOfDay, energyLevel, neighborhood, streetMultiLocationJourney, streetCrowdConfig, urbanSoundscape, streetPlotTwist, streetPoll, streetDramaticMoment, streetSeasonalContext, crossStreetPivot]);

  const quickGenDefaults = [
    { label: 'Topic', value: clip.topic },
    { label: 'Duration', value: `${clip.duration}s` },
    { label: 'Scene', value: 'Busy Sidewalk' },
    { label: 'Style', value: 'Man on Street' },
    { label: 'Time', value: 'Midday' },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader
        title="Street Interview"
        description="Sidewalk documentary style with authentic vox pop content."
        clip={clip}
      />

      <CreationWizard clip={clip} steps={STEPS} accentColor="emerald" onGenerate={handleGenerate}>
        <ContentStep clip={clip} onQuickGenerate={() => setShowQuickGen(true)} />

        <StreetSceneStep
          clip={clip}
          streetScene={streetScene}
          setStreetScene={setStreetScene}
          interviewStyle={interviewStyle}
          setInterviewStyle={setInterviewStyle}
          timeOfDay={timeOfDay}
          setTimeOfDay={setTimeOfDay}
          energyLevel={energyLevel}
          setEnergyLevel={setEnergyLevel}
          scenarioDescription={scenarioDescription}
          setScenarioDescription={setScenarioDescription}
          socialDynamics={socialDynamics}
          setSocialDynamics={setSocialDynamics}
        />

        <StreetEnhancementsStep
          clip={clip}
          neighborhood={neighborhood}
          setNeighborhood={setNeighborhood}
          streetMultiLocationJourney={streetMultiLocationJourney}
          setStreetMultiLocationJourney={setStreetMultiLocationJourney}
          streetCrowdConfig={streetCrowdConfig}
          setStreetCrowdConfig={setStreetCrowdConfig}
          urbanSoundscape={urbanSoundscape}
          setUrbanSoundscape={setUrbanSoundscape}
          streetPlotTwist={streetPlotTwist}
          setStreetPlotTwist={setStreetPlotTwist}
          streetPoll={streetPoll}
          setStreetPoll={setStreetPoll}
          streetDramaticMoment={streetDramaticMoment}
          setStreetDramaticMoment={setStreetDramaticMoment}
          streetSeasonalContext={streetSeasonalContext}
          setStreetSeasonalContext={setStreetSeasonalContext}
          crossStreetPivot={crossStreetPivot}
          setCrossStreetPivot={setCrossStreetPivot}
        />

        <GenerateStep
          clip={clip}
          onGenerate={handleGenerate}
          showSpeechScript={true}
          summaryCard={<SelectionSummary groups={summaryGroups} onEditStep={clip.goToStep} clip={clip} />}
          scriptContext={{ interviewStyle, energyLevel, neighborhood }}
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
