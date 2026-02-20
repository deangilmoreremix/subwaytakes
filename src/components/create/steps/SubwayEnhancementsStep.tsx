import { Route, Users2, Volume2, Shuffle, BarChart3, Clock, Snowflake, GitBranch } from 'lucide-react';
import type { ClipCreationHook } from '../../../hooks/useClipCreation';
import { EnhancementToggleCard, useAccordion } from '../EnhancementToggleCard';
import { CharacterSection } from '../CommonCreateSections';
import { JourneyBuilder } from '../../JourneyBuilder';
import { CrowdReactionPanel } from '../../CrowdReactionPanel';
import { SoundscapeSelector } from '../../SoundscapeSelector';
import { PlotTwistSelector } from '../../PlotTwistSelector';
import { PlatformPoll as PlatformPollComponent } from '../../PlatformPoll';
import { TrainArrivalTimer } from '../../TrainArrivalTimer';
import { SeasonalContextSelector } from '../../SeasonalContextSelector';
import { TransferPointBuilder } from '../../TransferPointBuilder';
import type {
  MultiStopJourney,
  CrowdReactionConfig,
  SoundscapeConfig,
  PlotTwist,
  PlatformPoll,
  TrainArrivalMoment,
  SeasonalContext,
  TransferPoint,
  SubwayLine,
} from '../../../lib/types';

interface SubwayEnhancementsStepProps {
  clip: ClipCreationHook;
  subwayLine: SubwayLine | undefined;
  multiStopJourney: MultiStopJourney | undefined;
  setMultiStopJourney: (v: MultiStopJourney | undefined) => void;
  crowdReactions: CrowdReactionConfig | undefined;
  setCrowdReactions: (v: CrowdReactionConfig | undefined) => void;
  soundscape: SoundscapeConfig | undefined;
  setSoundscape: (v: SoundscapeConfig | undefined) => void;
  plotTwist: PlotTwist | undefined;
  setPlotTwist: (v: PlotTwist | undefined) => void;
  platformPoll: PlatformPoll | undefined;
  setPlatformPoll: (v: PlatformPoll | undefined) => void;
  trainArrival: TrainArrivalMoment | undefined;
  setTrainArrival: (v: TrainArrivalMoment | undefined) => void;
  seasonalContext: SeasonalContext | undefined;
  setSeasonalContext: (v: SeasonalContext | undefined) => void;
  transferPoint: TransferPoint | undefined;
  setTransferPoint: (v: TransferPoint | undefined) => void;
}

export function SubwayEnhancementsStep({
  clip,
  subwayLine,
  multiStopJourney,
  setMultiStopJourney,
  crowdReactions,
  setCrowdReactions,
  soundscape,
  setSoundscape,
  plotTwist,
  setPlotTwist,
  platformPoll,
  setPlatformPoll,
  trainArrival,
  setTrainArrival,
  seasonalContext,
  setSeasonalContext,
  transferPoint,
  setTransferPoint,
}: SubwayEnhancementsStepProps) {
  const accordion = useAccordion();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <EnhancementToggleCard
          icon={Route}
          title="Multi-Stop Journey"
          enabled={!!multiStopJourney?.enabled}
          onToggle={(on) => setMultiStopJourney(on ? { enabled: true, stops: [] } as MultiStopJourney : undefined)}
          disabled={clip.busy}
          accentColor="amber"
          isOpen={accordion.isOpen('journey')}
          onOpenChange={accordion.onOpenChange('journey')}
        >
          <JourneyBuilder value={multiStopJourney} onChange={setMultiStopJourney} disabled={clip.busy} />
        </EnhancementToggleCard>

        <EnhancementToggleCard
          icon={Users2}
          title="Crowd Reactions"
          enabled={!!crowdReactions?.enabled}
          onToggle={(on) => setCrowdReactions(on ? { enabled: true, reactions: [] } as CrowdReactionConfig : undefined)}
          disabled={clip.busy}
          accentColor="amber"
          isOpen={accordion.isOpen('crowd')}
          onOpenChange={accordion.onOpenChange('crowd')}
        >
          <CrowdReactionPanel value={crowdReactions} onChange={setCrowdReactions} disabled={clip.busy} />
        </EnhancementToggleCard>

        <EnhancementToggleCard
          icon={Volume2}
          title="Soundscape"
          enabled={!!soundscape?.enabled}
          onToggle={(on) => setSoundscape(on ? { enabled: true, sounds: [] } as SoundscapeConfig : undefined)}
          disabled={clip.busy}
          accentColor="amber"
          isOpen={accordion.isOpen('sound')}
          onOpenChange={accordion.onOpenChange('sound')}
        >
          <SoundscapeSelector value={soundscape} onChange={setSoundscape} disabled={clip.busy} />
        </EnhancementToggleCard>

        <EnhancementToggleCard
          icon={Shuffle}
          title="Plot Twist"
          enabled={!!plotTwist}
          onToggle={(on) => setPlotTwist(on ? { type: 'train_arrival', timing: 50 } as PlotTwist : undefined)}
          disabled={clip.busy}
          accentColor="amber"
          isOpen={accordion.isOpen('twist')}
          onOpenChange={accordion.onOpenChange('twist')}
        >
          <PlotTwistSelector value={plotTwist} onChange={setPlotTwist} disabled={clip.busy} maxDuration={clip.duration} />
        </EnhancementToggleCard>

        <EnhancementToggleCard
          icon={BarChart3}
          title="Platform Poll"
          enabled={!!platformPoll?.enabled}
          onToggle={(on) => setPlatformPoll(on ? { enabled: true, question: '', options: [] } as PlatformPoll : undefined)}
          disabled={clip.busy}
          accentColor="amber"
          isOpen={accordion.isOpen('poll')}
          onOpenChange={accordion.onOpenChange('poll')}
        >
          <PlatformPollComponent value={platformPoll} onChange={setPlatformPoll} disabled={clip.busy} />
        </EnhancementToggleCard>

        <EnhancementToggleCard
          icon={Clock}
          title="Train Arrival Timer"
          enabled={!!trainArrival?.enabled}
          onToggle={(on) => setTrainArrival(on ? { enabled: true } as TrainArrivalMoment : undefined)}
          disabled={clip.busy}
          accentColor="amber"
          isOpen={accordion.isOpen('train')}
          onOpenChange={accordion.onOpenChange('train')}
        >
          <TrainArrivalTimer value={trainArrival} onChange={setTrainArrival} disabled={clip.busy} selectedLine={subwayLine} />
        </EnhancementToggleCard>

        <EnhancementToggleCard
          icon={Snowflake}
          title="Seasonal Context"
          enabled={!!seasonalContext?.enabled}
          onToggle={(on) => setSeasonalContext(on ? { enabled: true } as SeasonalContext : undefined)}
          disabled={clip.busy}
          accentColor="amber"
          isOpen={accordion.isOpen('season')}
          onOpenChange={accordion.onOpenChange('season')}
        >
          <SeasonalContextSelector value={seasonalContext} onChange={setSeasonalContext} disabled={clip.busy} />
        </EnhancementToggleCard>

        <EnhancementToggleCard
          icon={GitBranch}
          title="Transfer Point"
          enabled={!!transferPoint?.enabled}
          onToggle={(on) => setTransferPoint(on ? { enabled: true } as TransferPoint : undefined)}
          disabled={clip.busy}
          accentColor="amber"
          isOpen={accordion.isOpen('transfer')}
          onOpenChange={accordion.onOpenChange('transfer')}
        >
          <TransferPointBuilder value={transferPoint} onChange={setTransferPoint} disabled={clip.busy} currentLine={subwayLine} />
        </EnhancementToggleCard>
      </div>

      <CharacterSection clip={clip} />
    </div>
  );
}
