import type { ClipCreationHook } from '../../../hooks/useClipCreation';
import { CharacterSection } from '../CommonCreateSections';
import { StudioSetupSelector } from '../../StudioSetupSelector';
import { StudioLightingSelector } from '../../StudioLightingSelector';
import type { StudioSetup, StudioLighting } from '../../../lib/types';

interface StudioSetupStepProps {
  clip: ClipCreationHook;
  studioSetup: StudioSetup;
  setStudioSetup: (v: StudioSetup) => void;
  studioLighting: StudioLighting;
  setStudioLighting: (v: StudioLighting) => void;
}

export function StudioSetupStep({
  clip,
  studioSetup,
  setStudioSetup,
  studioLighting,
  setStudioLighting,
}: StudioSetupStepProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 space-y-4">
        <StudioSetupSelector value={studioSetup} onChange={setStudioSetup} disabled={clip.busy} />
        <StudioLightingSelector value={studioLighting} onChange={setStudioLighting} disabled={clip.busy} />
      </div>

      <CharacterSection clip={clip} />
    </div>
  );
}
