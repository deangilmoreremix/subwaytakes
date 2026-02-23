import type { ClipCreationHook } from '../../../hooks/useClipCreation';
import { StreetSceneSelector } from '../../StreetSceneSelector';
import { InterviewStyleSelector } from '../../InterviewStyleSelector';
import { TimeOfDaySelector } from '../../TimeOfDaySelector';
import { EnergyLevelSelector } from '../../EnergyLevelSelector';
import { ScenarioInput } from '../../ScenarioInput';
import { SocialDynamicsPanel } from '../../SocialDynamicsPanel';
import type {
  StreetScene,
  InterviewStyle,
  TimeOfDay,
  EnergyLevel,
  SocialDynamicsConfig,
} from '../../../lib/types';

interface StreetSceneStepProps {
  clip: ClipCreationHook;
  streetScene: StreetScene;
  setStreetScene: (v: StreetScene) => void;
  interviewStyle: InterviewStyle;
  setInterviewStyle: (v: InterviewStyle) => void;
  timeOfDay: TimeOfDay;
  setTimeOfDay: (v: TimeOfDay) => void;
  energyLevel: EnergyLevel;
  setEnergyLevel: (v: EnergyLevel) => void;
  scenarioDescription: string;
  setScenarioDescription: (v: string) => void;
  socialDynamics: SocialDynamicsConfig;
  setSocialDynamics: (v: SocialDynamicsConfig) => void;
}

export function StreetSceneStep({
  clip,
  streetScene,
  setStreetScene,
  interviewStyle,
  setInterviewStyle,
  timeOfDay,
  setTimeOfDay,
  energyLevel,
  setEnergyLevel,
  scenarioDescription,
  setScenarioDescription,
  socialDynamics,
  setSocialDynamics,
}: StreetSceneStepProps) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 space-y-5">
      <StreetSceneSelector value={streetScene} onChange={setStreetScene} disabled={clip.busy} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <InterviewStyleSelector value={interviewStyle} onChange={setInterviewStyle} disabled={clip.busy} />
        <TimeOfDaySelector value={timeOfDay} onChange={setTimeOfDay} disabled={clip.busy} />
      </div>
      <EnergyLevelSelector value={energyLevel} onChange={setEnergyLevel} />
      <ScenarioInput
        value={scenarioDescription}
        onChange={setScenarioDescription}
        variant="street"
        disabled={clip.busy}
      />
      <SocialDynamicsPanel
        value={socialDynamics}
        onChange={setSocialDynamics}
        disabled={clip.busy}
      />
    </div>
  );
}
