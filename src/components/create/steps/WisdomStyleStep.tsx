import type { ClipCreationHook } from '../../../hooks/useClipCreation';
import { CharacterSection } from '../CommonCreateSections';
import { WisdomFormatSelector } from '../../WisdomFormatSelector';
import { WisdomToneSelector } from '../../WisdomToneSelector';
import { WisdomDemographicSelector } from '../../WisdomDemographicSelector';
import { WisdomSettingSelector } from '../../WisdomSettingSelector';
import type {
  WisdomFormat,
  WisdomTone,
  WisdomDemographic,
  WisdomSetting,
} from '../../../lib/types';

interface WisdomStyleStepProps {
  clip: ClipCreationHook;
  wisdomFormat: WisdomFormat;
  setWisdomFormat: (v: WisdomFormat) => void;
  wisdomTone: WisdomTone;
  setWisdomTone: (v: WisdomTone) => void;
  wisdomDemographic: WisdomDemographic;
  setWisdomDemographic: (v: WisdomDemographic) => void;
  wisdomSetting: WisdomSetting;
  setWisdomSetting: (v: WisdomSetting) => void;
}

export function WisdomStyleStep({
  clip,
  wisdomFormat,
  setWisdomFormat,
  wisdomTone,
  setWisdomTone,
  wisdomDemographic,
  setWisdomDemographic,
  wisdomSetting,
  setWisdomSetting,
}: WisdomStyleStepProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 space-y-4">
        <WisdomFormatSelector value={wisdomFormat} onChange={setWisdomFormat} disabled={clip.busy} />
        <WisdomToneSelector value={wisdomTone} onChange={setWisdomTone} disabled={clip.busy} />
        <WisdomDemographicSelector value={wisdomDemographic} onChange={setWisdomDemographic} disabled={clip.busy} />
        <WisdomSettingSelector value={wisdomSetting} onChange={setWisdomSetting} disabled={clip.busy} />
      </div>

      <CharacterSection clip={clip} />
    </div>
  );
}
