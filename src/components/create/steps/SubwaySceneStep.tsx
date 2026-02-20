import type { ClipCreationHook } from '../../../hooks/useClipCreation';
import { QuestionInput } from '../../QuestionInput';
import { SceneTypeSelector } from '../../SceneTypeSelector';
import { CityStyleSelector } from '../../CityStyleSelector';
import { EnergyLevelSelector } from '../../EnergyLevelSelector';
import { InterviewStyleSelector } from '../../InterviewStyleSelector';
import { SubwayLineSelector } from '../../SubwayLineSelector';
import type {
  SubwaySceneType,
  CityStyle,
  EnergyLevel,
  InterviewStyle,
  SubwayLine,
} from '../../../lib/types';

interface SubwaySceneStepProps {
  clip: ClipCreationHook;
  interviewQuestion: string;
  setInterviewQuestion: (v: string) => void;
  sceneType: SubwaySceneType;
  setSceneType: (v: SubwaySceneType) => void;
  cityStyle: CityStyle;
  setCityStyle: (v: CityStyle) => void;
  energyLevel: EnergyLevel;
  setEnergyLevel: (v: EnergyLevel) => void;
  interviewStyle: InterviewStyle;
  setInterviewStyle: (v: InterviewStyle) => void;
  subwayLine: SubwayLine | undefined;
  setSubwayLine: (v: SubwayLine | undefined) => void;
}

export function SubwaySceneStep({
  clip,
  interviewQuestion,
  setInterviewQuestion,
  sceneType,
  setSceneType,
  cityStyle,
  setCityStyle,
  energyLevel,
  setEnergyLevel,
  interviewStyle,
  setInterviewStyle,
  subwayLine,
  setSubwayLine,
}: SubwaySceneStepProps) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 space-y-5">
      <QuestionInput value={interviewQuestion} onChange={setInterviewQuestion} />
      <SceneTypeSelector value={sceneType} onChange={setSceneType} />
      <CityStyleSelector value={cityStyle} onChange={setCityStyle} />
      <EnergyLevelSelector value={energyLevel} onChange={setEnergyLevel} />
      <InterviewStyleSelector value={interviewStyle} onChange={setInterviewStyle} disabled={clip.busy} />
      <SubwayLineSelector value={subwayLine} onChange={setSubwayLine} disabled={clip.busy} />
    </div>
  );
}
