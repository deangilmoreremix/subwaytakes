import { useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
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
import { QuestionInput } from '../../components/QuestionInput';
import { SceneTypeSelector } from '../../components/SceneTypeSelector';
import { CityStyleSelector } from '../../components/CityStyleSelector';
import { EnergyLevelSelector } from '../../components/EnergyLevelSelector';
import { InterviewStyleSelector } from '../../components/InterviewStyleSelector';
import { SubwayLineSelector } from '../../components/SubwayLineSelector';
import { JourneyBuilder } from '../../components/JourneyBuilder';
import { CrowdReactionPanel } from '../../components/CrowdReactionPanel';
import { SoundscapeSelector } from '../../components/SoundscapeSelector';
import { PlotTwistSelector } from '../../components/PlotTwistSelector';
import { PlatformPoll as PlatformPollComponent } from '../../components/PlatformPoll';
import { TrainArrivalTimer } from '../../components/TrainArrivalTimer';
import { SeasonalContextSelector } from '../../components/SeasonalContextSelector';
import { TransferPointBuilder } from '../../components/TransferPointBuilder';
import { BATCH_SIZE_OPTIONS } from '../../lib/constants';
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

export function CreateSubwayPage() {
  const clip = useClipCreation('subway_interview');

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
  const [showEnhancements, setShowEnhancements] = useState(false);

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

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader
        title="Subway Interview"
        description="One prompt generates a single 2-8 second clip. SubwayTakes-style viral clips with trending questions and subway scenes."
        clip={clip}
      />

      <KeywordSection clip={clip} />

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 space-y-6">
        <TopicDurationRow clip={clip} />

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
              {BATCH_SIZE_OPTIONS.map((size) => (
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

        <div className="border-t border-zinc-800 pt-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span className="text-sm font-medium text-amber-400">Subway Interview Options</span>
          </div>
          <div className="space-y-5">
            <QuestionInput value={interviewQuestion} onChange={setInterviewQuestion} />
            <SceneTypeSelector value={sceneType} onChange={setSceneType} />
            <CityStyleSelector value={cityStyle} onChange={setCityStyle} />
            <EnergyLevelSelector value={energyLevel} onChange={setEnergyLevel} />
            <InterviewStyleSelector value={interviewStyle} onChange={setInterviewStyle} disabled={clip.busy} />
            <SubwayLineSelector value={subwayLine} onChange={setSubwayLine} disabled={clip.busy} />
          </div>
        </div>

        <div className="border-t border-zinc-800 pt-6">
          <button
            type="button"
            onClick={() => setShowEnhancements(!showEnhancements)}
            disabled={clip.busy}
            className="flex items-center gap-2 text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors mb-4"
          >
            <Sparkles className="h-4 w-4" />
            <span>Subway Enhancements</span>
            {showEnhancements ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showEnhancements && (
            <div className="space-y-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <JourneyBuilder value={multiStopJourney} onChange={setMultiStopJourney} disabled={clip.busy} />
              <div className="border-t border-zinc-800 pt-4">
                <CrowdReactionPanel value={crowdReactions} onChange={setCrowdReactions} disabled={clip.busy} />
              </div>
              <div className="border-t border-zinc-800 pt-4">
                <SoundscapeSelector value={soundscape} onChange={setSoundscape} disabled={clip.busy} />
              </div>
              <div className="border-t border-zinc-800 pt-4">
                <PlotTwistSelector value={plotTwist} onChange={setPlotTwist} disabled={clip.busy} maxDuration={clip.duration} />
              </div>
              <div className="border-t border-zinc-800 pt-4">
                <PlatformPollComponent value={platformPoll} onChange={setPlatformPoll} disabled={clip.busy} />
              </div>
              <div className="border-t border-zinc-800 pt-4">
                <TrainArrivalTimer value={trainArrival} onChange={setTrainArrival} disabled={clip.busy} selectedLine={subwayLine} />
              </div>
              <div className="border-t border-zinc-800 pt-4">
                <SeasonalContextSelector value={seasonalContext} onChange={setSeasonalContext} disabled={clip.busy} />
              </div>
              <div className="border-t border-zinc-800 pt-4">
                <TransferPointBuilder value={transferPoint} onChange={setTransferPoint} disabled={clip.busy} currentLine={subwayLine} />
              </div>
            </div>
          )}
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
        SubwayTakes-style viral clips. Pick a trending question and scene for maximum engagement.
      </p>

      <EffectsModal clip={clip} />
    </div>
  );
}
