import type { ClipCreationHook } from '../../../hooks/useClipCreation';
import { QuestionInput } from '../../QuestionInput';
import { SceneTypeSelector } from '../../SceneTypeSelector';
import { LocationSelector } from '../../LocationSelector';
import { EnergyLevelSelector } from '../../EnergyLevelSelector';
import { InterviewStyleSelector } from '../../InterviewStyleSelector';
import { SubwayLineSelector } from '../../SubwayLineSelector';
import { ScenarioInput } from '../../ScenarioInput';
import { SocialDynamicsPanel } from '../../SocialDynamicsPanel';
import type {
  SubwaySceneType,
  CityStyle,
  EnergyLevel,
  InterviewStyle,
  SubwayLine,
  SocialDynamicsConfig,
} from '../../../lib/types';

interface SubwaySceneStepProps {
  clip: ClipCreationHook;
  interviewQuestion: string;
  setInterviewQuestion: (v: string) => void;
  sceneType: SubwaySceneType;
  setSceneType: (v: SubwaySceneType) => void;
  cityStyle: CityStyle;
  setCityStyle: (v: CityStyle) => void;
  customLocation: string;
  setCustomLocation: (v: string) => void;
  energyLevel: EnergyLevel;
  setEnergyLevel: (v: EnergyLevel) => void;
  interviewStyle: InterviewStyle;
  setInterviewStyle: (v: InterviewStyle) => void;
  subwayLine: SubwayLine | undefined;
  setSubwayLine: (v: SubwayLine | undefined) => void;
  scenarioDescription: string;
  setScenarioDescription: (v: string) => void;
  socialDynamics: SocialDynamicsConfig;
  setSocialDynamics: (v: SocialDynamicsConfig) => void;
}

export function SubwaySceneStep({
  clip,
  interviewQuestion,
  setInterviewQuestion,
  sceneType,
  setSceneType,
  cityStyle,
  setCityStyle,
  customLocation,
  setCustomLocation,
  energyLevel,
  setEnergyLevel,
  interviewStyle,
  setInterviewStyle,
  subwayLine,
  setSubwayLine,
  scenarioDescription,
  setScenarioDescription,
  socialDynamics,
  setSocialDynamics,
}: SubwaySceneStepProps) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 space-y-5">
      <QuestionInput value={interviewQuestion} onChange={setInterviewQuestion} />
      <SceneTypeSelector value={sceneType} onChange={setSceneType} />
      <LocationSelector
        cityStyle={cityStyle}
        onCityStyleChange={setCityStyle}
        customLocation={customLocation}
        onCustomLocationChange={setCustomLocation}
        variant="subway"
        disabled={clip.busy}
      />
      <EnergyLevelSelector value={energyLevel} onChange={setEnergyLevel} />
      <InterviewStyleSelector value={interviewStyle} onChange={setInterviewStyle} disabled={clip.busy} />
      <SubwayLineSelector value={subwayLine} onChange={setSubwayLine} disabled={clip.busy} />
      <ScenarioInput
        value={scenarioDescription}
        onChange={setScenarioDescription}
        variant="subway"
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
