import { ArrowLeft, Users, ChevronUp, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { ClipCreationHook } from '../../hooks/useClipCreation';
import { EffectsCustomizeModal } from '../EffectsCustomizeModal';
import { CharacterPresetSelector } from '../CharacterPresetSelector';
import { InterviewerSelector } from '../InterviewerSelector';
import { SubjectSelector } from '../SubjectSelector';

interface PageHeaderProps {
  title: string;
  description: string;
  clip: ClipCreationHook;
}

export function PageHeader({ title, description, clip }: PageHeaderProps) {
  const navigate = useNavigate();
  return (
    <div className="mb-8">
      <button
        onClick={() => navigate('/create')}
        className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        All Creation Tools
      </button>
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">{title}</h1>
      <p className="mt-2 text-sm text-zinc-400">
        {clip.batchMode
          ? `Generate ${clip.batchSize} viral clips at once — same question, different reactions.`
          : description}
      </p>
    </div>
  );
}

interface CharacterSectionProps {
  clip: ClipCreationHook;
}

export function CharacterSection({ clip }: CharacterSectionProps) {
  return (
    <div className="border-t border-zinc-800 pt-6">
      <div className="flex items-center gap-2 mb-4">
        <Users className="h-4 w-4 text-sky-500" />
        <span className="text-sm font-medium text-sky-400">Characters</span>
      </div>
      <div className="space-y-5">
        <CharacterPresetSelector
          value={clip.characterPreset}
          onChange={clip.handlePresetChange}
          disabled={clip.busy}
        />
        <button
          type="button"
          onClick={() => {
            clip.setShowCharacterDetails(!clip.showCharacterDetails);
            if (!clip.showCharacterDetails) clip.setCharacterPreset('custom');
          }}
          disabled={clip.busy}
          className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-300 transition-colors disabled:opacity-50"
        >
          {clip.showCharacterDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {clip.showCharacterDetails ? 'Hide' : 'Customize'} interviewer & subject details
        </button>
        {clip.showCharacterDetails && (
          <div className="space-y-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <div>
              <h4 className="text-sm font-medium text-amber-400 mb-4">Interviewer</h4>
              <InterviewerSelector
                type={clip.interviewerType}
                position={clip.interviewerPosition}
                onTypeChange={clip.setInterviewerType}
                onPositionChange={clip.setInterviewerPosition}
                disabled={clip.busy}
              />
            </div>
            <div className="border-t border-zinc-800 pt-5">
              <h4 className="text-sm font-medium text-emerald-400 mb-4">Subject (Interviewee)</h4>
              <SubjectSelector
                demographic={clip.subjectDemographic}
                gender={clip.subjectGender}
                style={clip.subjectStyle}
                onDemographicChange={clip.setSubjectDemographic}
                onGenderChange={clip.setSubjectGender}
                onStyleChange={clip.setSubjectStyle}
                disabled={clip.busy}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface EffectsModalProps {
  clip: ClipCreationHook;
}

export function EffectsModal({ clip }: EffectsModalProps) {
  return (
    <EffectsCustomizeModal
      isOpen={clip.showEffectsModal}
      onClose={() => clip.setShowEffectsModal(false)}
      clipType={clip.clipType}
      effects={clip.effects}
      onSave={(newEffects) => {
        clip.setEffects(newEffects);
        clip.setShowEffectsModal(false);
      }}
    />
  );
}
