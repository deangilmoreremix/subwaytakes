import { useState } from 'react';
import { MapPin, ChevronDown, ChevronUp } from 'lucide-react';
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
import { StreetSceneSelector } from '../../components/StreetSceneSelector';
import { InterviewStyleSelector } from '../../components/InterviewStyleSelector';
import { TimeOfDaySelector } from '../../components/TimeOfDaySelector';
import { EnergyLevelSelector } from '../../components/EnergyLevelSelector';
import { StreetJourneyBuilder } from '../../components/StreetJourneyBuilder';
import { StreetCrowdPanel } from '../../components/StreetCrowdPanel';
import { UrbanSoundscapeSelector } from '../../components/UrbanSoundscapeSelector';
import { StreetPlotTwistSelector } from '../../components/StreetPlotTwistSelector';
import { StreetPoll } from '../../components/StreetPoll';
import { NeighborhoodSelector } from '../../components/NeighborhoodSelector';
import { StreetDramaticMoment } from '../../components/StreetDramaticMoment';
import { StreetSeasonalSelector } from '../../components/StreetSeasonalSelector';
import { CrossStreetPivot } from '../../components/CrossStreetPivot';
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
} from '../../lib/types';

export function CreateStreetPage() {
  const clip = useClipCreation('street_interview');

  const [streetScene, setStreetScene] = useState<StreetScene>('busy_sidewalk');
  const [interviewStyle, setInterviewStyle] = useState<InterviewStyle>('man_on_street');
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('midday');
  const [energyLevel, setEnergyLevel] = useState<EnergyLevel>('conversational');

  const [neighborhood, setNeighborhood] = useState<Neighborhood | undefined>('soho');
  const [streetMultiLocationJourney, setStreetMultiLocationJourney] = useState<StreetMultiLocationJourney | undefined>();
  const [streetCrowdConfig, setStreetCrowdConfig] = useState<StreetCrowdConfig | undefined>();
  const [urbanSoundscape, setUrbanSoundscape] = useState<UrbanSoundscapeConfig | undefined>();
  const [streetPlotTwist, setStreetPlotTwist] = useState<StreetPlotTwist | undefined>();
  const [streetPoll, setStreetPoll] = useState<StreetPollType | undefined>();
  const [streetDramaticMoment, setStreetDramaticMoment] = useState<StreetDramaticMomentType | undefined>();
  const [streetSeasonalContext, setStreetSeasonalContext] = useState<StreetSeasonalContext | undefined>();
  const [crossStreetPivot, setCrossStreetPivot] = useState<CrossStreetPivotType | undefined>();
  const [showStreetEnhancements, setShowStreetEnhancements] = useState(false);

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
      streetEnhancements: buildStreetEnhancements(),
    });
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader
        title="Street Interview"
        description="One prompt generates a single 2-8 second clip. Sidewalk documentary style with authentic vox pop content."
        clip={clip}
      />

      <KeywordSection clip={clip} />

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 space-y-6">
        <TopicDurationRow clip={clip} />

        <div className="border-t border-zinc-800 pt-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="text-sm font-medium text-emerald-400">Street Interview Options</span>
          </div>
          <div className="space-y-5">
            <StreetSceneSelector value={streetScene} onChange={setStreetScene} disabled={clip.busy} />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <InterviewStyleSelector value={interviewStyle} onChange={setInterviewStyle} disabled={clip.busy} />
              <TimeOfDaySelector value={timeOfDay} onChange={setTimeOfDay} disabled={clip.busy} />
            </div>
            <EnergyLevelSelector value={energyLevel} onChange={setEnergyLevel} />
          </div>

          <div className="border-t border-zinc-800 pt-6 mt-6">
            <button
              type="button"
              onClick={() => setShowStreetEnhancements(!showStreetEnhancements)}
              disabled={clip.busy}
              className="flex items-center gap-2 text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors mb-4"
            >
              <MapPin className="h-4 w-4" />
              <span>Street Interview Enhancements</span>
              {showStreetEnhancements ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {showStreetEnhancements && (
              <div className="space-y-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
                <NeighborhoodSelector value={neighborhood} onChange={setNeighborhood} disabled={clip.busy} />
                <div className="border-t border-zinc-800 pt-4">
                  <StreetJourneyBuilder value={streetMultiLocationJourney} onChange={setStreetMultiLocationJourney} disabled={clip.busy} />
                </div>
                <div className="border-t border-zinc-800 pt-4">
                  <StreetCrowdPanel value={streetCrowdConfig} onChange={setStreetCrowdConfig} disabled={clip.busy} />
                </div>
                <div className="border-t border-zinc-800 pt-4">
                  <UrbanSoundscapeSelector value={urbanSoundscape} onChange={setUrbanSoundscape} disabled={clip.busy} />
                </div>
                <div className="border-t border-zinc-800 pt-4">
                  <StreetPlotTwistSelector value={streetPlotTwist} onChange={setStreetPlotTwist} disabled={clip.busy} maxDuration={clip.duration} />
                </div>
                <div className="border-t border-zinc-800 pt-4">
                  <StreetPoll value={streetPoll} onChange={setStreetPoll} disabled={clip.busy} />
                </div>
                <div className="border-t border-zinc-800 pt-4">
                  <StreetDramaticMoment value={streetDramaticMoment} onChange={setStreetDramaticMoment} disabled={clip.busy} maxDuration={clip.duration} />
                </div>
                <div className="border-t border-zinc-800 pt-4">
                  <StreetSeasonalSelector value={streetSeasonalContext} onChange={setStreetSeasonalContext} disabled={clip.busy} />
                </div>
                <div className="border-t border-zinc-800 pt-4">
                  <CrossStreetPivot value={crossStreetPivot} onChange={setCrossStreetPivot} disabled={clip.busy} />
                </div>
              </div>
            )}
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
        Street interview clips. Pick your scene, style, and time of day for authentic vox pop content.
      </p>

      <EffectsModal clip={clip} />
    </div>
  );
}
