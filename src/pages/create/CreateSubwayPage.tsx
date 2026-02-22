import { useState, useMemo } from 'react';
import { useClipCreation } from '../../hooks/useClipCreation';
import type { WizardStepDef } from '../../hooks/useClipCreation';
import { PageHeader, EffectsModal } from '../../components/create/CommonCreateSections';
import { CreationWizard } from '../../components/create/CreationWizard';
import { AdvancedSettingsDrawer } from '../../components/create/AdvancedSettingsDrawer';
import { QuickGenerateModal } from '../../components/create/QuickGenerateModal';
import { ContentStep } from '../../components/create/steps/ContentStep';
import { SubwaySceneStep } from '../../components/create/steps/SubwaySceneStep';
import { SubwayEnhancementsStep } from '../../components/create/steps/SubwayEnhancementsStep';
import { GenerateStep } from '../../components/create/steps/GenerateStep';
import { SelectionSummary } from '../../components/create/SelectionSummary';
import type {
  SubwaySceneType,
  CityStyle,
  EnergyLevel,
  InterviewStyle,
  SubwayLine,
  MultiStopJourney,
  CrowdReactionConfig,
  SoundscapeConfig,
  PlotTwist,
  PlatformPoll,
  TrainArrivalMoment,
  SeasonalContext,
  TransferPoint,
  SubwayEnhancementConfig,
} from '../../lib/types';

const STEPS: WizardStepDef[] = [
  { label: 'Content' },
  { label: 'Scene' },
  { label: 'Enhance', optional: true },
  { label: 'Generate' },
];

export function CreateSubwayPage() {
  const clip = useClipCreation('subway_interview', STEPS);
  const [showQuickGen, setShowQuickGen] = useState(false);

  const [interviewQuestion, setInterviewQuestion] = useState('');
  const [sceneType, setSceneType] = useState<SubwaySceneType>('platform_waiting');
  const [cityStyle, setCityStyle] = useState<CityStyle>('nyc');
  const [energyLevel, setEnergyLevel] = useState<EnergyLevel>('conversational');
  const [interviewStyle, setInterviewStyle] = useState<InterviewStyle>('man_on_street');
  const [subwayLine, setSubwayLine] = useState<SubwayLine | undefined>('any');

  const [multiStopJourney, setMultiStopJourney] = useState<MultiStopJourney | undefined>();
  const [crowdReactions, setCrowdReactions] = useState<CrowdReactionConfig | undefined>();
  const [soundscape, setSoundscape] = useState<SoundscapeConfig | undefined>();
  const [plotTwist, setPlotTwist] = useState<PlotTwist | undefined>();
  const [platformPoll, setPlatformPoll] = useState<PlatformPoll | undefined>();
  const [trainArrival, setTrainArrival] = useState<TrainArrivalMoment | undefined>();
  const [seasonalContext, setSeasonalContext] = useState<SeasonalContext | undefined>();
  const [transferPoint, setTransferPoint] = useState<TransferPoint | undefined>();

  function buildSubwayEnhancements(): SubwayEnhancementConfig | undefined {
    const hasEnhancements = multiStopJourney?.enabled ||
      crowdReactions?.enabled ||
      soundscape?.enabled ||
      plotTwist ||
      platformPoll?.enabled ||
      trainArrival?.enabled ||
      seasonalContext?.enabled ||
      transferPoint?.enabled;
    if (!hasEnhancements) return undefined;
    return {
      multiStopJourney, crowdReactions, soundscape, plotTwist,
      platformPoll, subwayLine, trainArrival, seasonalContext, transferPoint,
    };
  }

  function handleGenerate() {
    clip.generateClip({
      interviewQuestion: interviewQuestion || undefined,
      sceneType,
      cityStyle,
      energyLevel,
      interviewStyle,
      subwayLine,
      subwayEnhancements: buildSubwayEnhancements(),
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
        { label: 'Scene', value: sceneType.replace(/_/g, ' ') },
        { label: 'City', value: cityStyle.toUpperCase() },
        { label: 'Energy', value: energyLevel },
        { label: 'Style', value: interviewStyle.replace(/_/g, ' ') },
        ...(subwayLine && subwayLine !== 'any' ? [{ label: 'Line', value: subwayLine }] : []),
      ],
    },
    {
      label: 'Enhancements',
      stepIndex: 2,
      items: [
        ...(multiStopJourney?.enabled ? [{ label: '', value: 'Journey' }] : []),
        ...(crowdReactions?.enabled ? [{ label: '', value: 'Crowd' }] : []),
        ...(soundscape?.enabled ? [{ label: '', value: 'Soundscape' }] : []),
        ...(plotTwist ? [{ label: '', value: 'Plot Twist' }] : []),
        ...(platformPoll?.enabled ? [{ label: '', value: 'Poll' }] : []),
        ...(trainArrival?.enabled ? [{ label: '', value: 'Train Arrival' }] : []),
        ...(seasonalContext?.enabled ? [{ label: '', value: 'Seasonal' }] : []),
        ...(transferPoint?.enabled ? [{ label: '', value: 'Transfer' }] : []),
        ...(!buildSubwayEnhancements() ? [{ label: '', value: 'None' }] : []),
      ],
    },
  ], [clip.topic, clip.duration, sceneType, cityStyle, energyLevel, interviewStyle, subwayLine, multiStopJourney, crowdReactions, soundscape, plotTwist, platformPoll, trainArrival, seasonalContext, transferPoint]);

  const quickGenDefaults = [
    { label: 'Topic', value: clip.topic },
    { label: 'Duration', value: `${clip.duration}s` },
    { label: 'Scene', value: 'Platform Waiting' },
    { label: 'City', value: 'NYC' },
    { label: 'Energy', value: 'Conversational' },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader
        title="Subway Interview"
        description="Create SubwayTakes-style viral clips with trending questions and subway scenes."
        clip={clip}
      />

      <CreationWizard clip={clip} steps={STEPS} accentColor="amber" onGenerate={handleGenerate}>
        <ContentStep clip={clip} onQuickGenerate={() => setShowQuickGen(true)} />

        <SubwaySceneStep
          clip={clip}
          interviewQuestion={interviewQuestion}
          setInterviewQuestion={setInterviewQuestion}
          sceneType={sceneType}
          setSceneType={setSceneType}
          cityStyle={cityStyle}
          setCityStyle={setCityStyle}
          energyLevel={energyLevel}
          setEnergyLevel={setEnergyLevel}
          interviewStyle={interviewStyle}
          setInterviewStyle={setInterviewStyle}
          subwayLine={subwayLine}
          setSubwayLine={setSubwayLine}
        />

        <SubwayEnhancementsStep
          clip={clip}
          subwayLine={subwayLine}
          multiStopJourney={multiStopJourney}
          setMultiStopJourney={setMultiStopJourney}
          crowdReactions={crowdReactions}
          setCrowdReactions={setCrowdReactions}
          soundscape={soundscape}
          setSoundscape={setSoundscape}
          plotTwist={plotTwist}
          setPlotTwist={setPlotTwist}
          platformPoll={platformPoll}
          setPlatformPoll={setPlatformPoll}
          trainArrival={trainArrival}
          setTrainArrival={setTrainArrival}
          seasonalContext={seasonalContext}
          setSeasonalContext={setSeasonalContext}
          transferPoint={transferPoint}
          setTransferPoint={setTransferPoint}
        />

        <GenerateStep
          clip={clip}
          onGenerate={handleGenerate}
          showSpeechScript={true}
          showBatchMode={true}
          summaryCard={<SelectionSummary groups={summaryGroups} onEditStep={clip.goToStep} />}
          scriptContext={{ interviewStyle, energyLevel, sceneType }}
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
