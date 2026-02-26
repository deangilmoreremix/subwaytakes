import { Route, Users2, Volume2, Shuffle, BarChart3, Flame, Snowflake, ArrowRightLeft } from 'lucide-react';
import type { ClipCreationHook } from '../../../hooks/useClipCreation';
import { EnhancementToggleCard, useAccordion } from '../EnhancementToggleCard';
import { CharacterSection } from '../CommonCreateSections';
import { NeighborhoodSelector } from '../../NeighborhoodSelector';
import { StreetJourneyBuilder } from '../../StreetJourneyBuilder';
import { StreetCrowdPanel } from '../../StreetCrowdPanel';
import { UrbanSoundscapeSelector } from '../../UrbanSoundscapeSelector';
import { StreetPlotTwistSelector } from '../../StreetPlotTwistSelector';
import { StreetPoll } from '../../StreetPoll';
import { StreetDramaticMoment } from '../../StreetDramaticMoment';
import { StreetSeasonalSelector } from '../../StreetSeasonalSelector';
import { CrossStreetPivot } from '../../CrossStreetPivot';
import type {
  Neighborhood,
  StreetMultiLocationJourney,
  StreetCrowdConfig,
  UrbanSoundscapeConfig,
  StreetPlotTwist,
  StreetPoll as StreetPollType,
  StreetDramaticMoment as StreetDramaticMomentType,
  StreetSeasonalContext,
  CrossStreetPivot as CrossStreetPivotType,
} from '../../../lib/types';

interface StreetEnhancementsStepProps {
  clip: ClipCreationHook;
  neighborhood: Neighborhood | undefined;
  setNeighborhood: (v: Neighborhood | undefined) => void;
  streetMultiLocationJourney: StreetMultiLocationJourney | undefined;
  setStreetMultiLocationJourney: (v: StreetMultiLocationJourney | undefined) => void;
  streetCrowdConfig: StreetCrowdConfig | undefined;
  setStreetCrowdConfig: (v: StreetCrowdConfig | undefined) => void;
  urbanSoundscape: UrbanSoundscapeConfig | undefined;
  setUrbanSoundscape: (v: UrbanSoundscapeConfig | undefined) => void;
  streetPlotTwist: StreetPlotTwist | undefined;
  setStreetPlotTwist: (v: StreetPlotTwist | undefined) => void;
  streetPoll: StreetPollType | undefined;
  setStreetPoll: (v: StreetPollType | undefined) => void;
  streetDramaticMoment: StreetDramaticMomentType | undefined;
  setStreetDramaticMoment: (v: StreetDramaticMomentType | undefined) => void;
  streetSeasonalContext: StreetSeasonalContext | undefined;
  setStreetSeasonalContext: (v: StreetSeasonalContext | undefined) => void;
  crossStreetPivot: CrossStreetPivotType | undefined;
  setCrossStreetPivot: (v: CrossStreetPivotType | undefined) => void;
}

export function StreetEnhancementsStep({
  clip,
  neighborhood,
  setNeighborhood,
  streetMultiLocationJourney,
  setStreetMultiLocationJourney,
  streetCrowdConfig,
  setStreetCrowdConfig,
  urbanSoundscape,
  setUrbanSoundscape,
  streetPlotTwist,
  setStreetPlotTwist,
  streetPoll,
  setStreetPoll,
  streetDramaticMoment,
  setStreetDramaticMoment,
  streetSeasonalContext,
  setStreetSeasonalContext,
  crossStreetPivot,
  setCrossStreetPivot,
}: StreetEnhancementsStepProps) {
  const accordion = useAccordion();

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4 mb-4">
        <NeighborhoodSelector value={neighborhood} onChange={setNeighborhood} disabled={clip.busy} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <EnhancementToggleCard
          icon={Route}
          title="Multi-Location Journey"
          enabled={!!streetMultiLocationJourney?.enabled}
          onToggle={(on) => setStreetMultiLocationJourney(on ? { enabled: true, locations: [], stops: [], totalDuration: 0, narrativeArc: 'discovery' } as StreetMultiLocationJourney : undefined)}
          disabled={clip.busy}
          accentColor="emerald"
          isOpen={accordion.isOpen('journey')}
          onOpenChange={accordion.onOpenChange('journey')}
        >
          <StreetJourneyBuilder value={streetMultiLocationJourney} onChange={setStreetMultiLocationJourney} disabled={clip.busy} />
        </EnhancementToggleCard>

        <EnhancementToggleCard
          icon={Users2}
          title="Crowd Dynamics"
          enabled={!!streetCrowdConfig?.enabled}
          onToggle={(on) => setStreetCrowdConfig(on ? { enabled: true, reactions: [], density: 'moderate', engagement: 'reactive' } as StreetCrowdConfig : undefined)}
          disabled={clip.busy}
          accentColor="emerald"
          isOpen={accordion.isOpen('crowd')}
          onOpenChange={accordion.onOpenChange('crowd')}
        >
          <StreetCrowdPanel value={streetCrowdConfig} onChange={setStreetCrowdConfig} disabled={clip.busy} />
        </EnhancementToggleCard>

        <EnhancementToggleCard
          icon={Volume2}
          title="Urban Soundscape"
          enabled={!!urbanSoundscape?.enabled}
          onToggle={(on) => setUrbanSoundscape(on ? { enabled: true, layers: [] } as UrbanSoundscapeConfig : undefined)}
          disabled={clip.busy}
          accentColor="emerald"
          isOpen={accordion.isOpen('sound')}
          onOpenChange={accordion.onOpenChange('sound')}
        >
          <UrbanSoundscapeSelector value={urbanSoundscape} onChange={setUrbanSoundscape} disabled={clip.busy} />
        </EnhancementToggleCard>

        <EnhancementToggleCard
          icon={Shuffle}
          title="Plot Twist"
          enabled={!!streetPlotTwist}
          onToggle={(on) => setStreetPlotTwist(on ? { type: 'friend_recognition', timing: 50, description: '', impact: 'dramatic' } as StreetPlotTwist : undefined)}
          disabled={clip.busy}
          accentColor="emerald"
          isOpen={accordion.isOpen('twist')}
          onOpenChange={accordion.onOpenChange('twist')}
        >
          <StreetPlotTwistSelector value={streetPlotTwist} onChange={setStreetPlotTwist} disabled={clip.busy} maxDuration={clip.duration} />
        </EnhancementToggleCard>

        <EnhancementToggleCard
          icon={BarChart3}
          title="Street Poll"
          enabled={!!streetPoll?.enabled}
          onToggle={(on) => setStreetPoll(on ? { enabled: true, question: '', options: [], pollType: 'agree_disagree', responses: [], showResults: false, visualStyle: 'bar_chart' } as StreetPollType : undefined)}
          disabled={clip.busy}
          accentColor="emerald"
          isOpen={accordion.isOpen('poll')}
          onOpenChange={accordion.onOpenChange('poll')}
        >
          <StreetPoll value={streetPoll} onChange={setStreetPoll} disabled={clip.busy} />
        </EnhancementToggleCard>

        <EnhancementToggleCard
          icon={Flame}
          title="Dramatic Moment"
          enabled={!!streetDramaticMoment?.enabled}
          onToggle={(on) => setStreetDramaticMoment(on ? { enabled: true } as StreetDramaticMomentType : undefined)}
          disabled={clip.busy}
          accentColor="emerald"
          isOpen={accordion.isOpen('dramatic')}
          onOpenChange={accordion.onOpenChange('dramatic')}
        >
          <StreetDramaticMoment value={streetDramaticMoment} onChange={setStreetDramaticMoment} disabled={clip.busy} maxDuration={clip.duration} />
        </EnhancementToggleCard>

        <EnhancementToggleCard
          icon={Snowflake}
          title="Seasonal Context"
          enabled={!!streetSeasonalContext?.enabled}
          onToggle={(on) => setStreetSeasonalContext(on ? { enabled: true } as StreetSeasonalContext : undefined)}
          disabled={clip.busy}
          accentColor="emerald"
          isOpen={accordion.isOpen('season')}
          onOpenChange={accordion.onOpenChange('season')}
        >
          <StreetSeasonalSelector value={streetSeasonalContext} onChange={setStreetSeasonalContext} disabled={clip.busy} />
        </EnhancementToggleCard>

        <EnhancementToggleCard
          icon={ArrowRightLeft}
          title="Cross-Street Pivot"
          enabled={!!crossStreetPivot?.enabled}
          onToggle={(on) => setCrossStreetPivot(on ? { enabled: true } as CrossStreetPivotType : undefined)}
          disabled={clip.busy}
          accentColor="emerald"
          isOpen={accordion.isOpen('pivot')}
          onOpenChange={accordion.onOpenChange('pivot')}
        >
          <CrossStreetPivot value={crossStreetPivot} onChange={setCrossStreetPivot} disabled={clip.busy} />
        </EnhancementToggleCard>
      </div>

      <CharacterSection clip={clip} />
    </div>
  );
}
