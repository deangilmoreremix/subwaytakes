import { ArrowLeft, Wand2, Sparkles, Users, ChevronUp, ChevronDown, Zap, Layers } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { ClipCreationHook } from '../../hooks/useClipCreation';
import { TopicSelect } from '../TopicSelect';
import { DurationChips } from '../DurationChips';
import { AgeGroupSelector } from '../AgeGroupSelector';
import { CompactEffectsBar } from '../CompactEffectsBar';
import { EffectsCustomizeModal } from '../EffectsCustomizeModal';
import { ModelTierSelector } from '../ModelTierSelector';
import { KeywordInput } from '../KeywordInput';
import { AngleInput } from '../AngleInput';
import { StatusCard } from '../StatusCard';
import { CharacterPresetSelector } from '../CharacterPresetSelector';
import { InterviewerSelector } from '../InterviewerSelector';
import { SubjectSelector } from '../SubjectSelector';
import { InterviewFormatSelector } from '../InterviewFormatSelector';
import { DurationSelector } from '../DurationSelector';
import { LanguageSelector } from '../LanguageSelector';
import { NicheSelector } from '../NicheSelector';
import { CaptionStyleSelector } from '../CaptionStyleSelector';
import { PlatformExportSelector } from '../PlatformExportSelector';
import { ProductPlacementPanel } from '../ProductPlacementConfig';
import { KeywordGenerator } from '../KeywordGenerator';

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

interface KeywordSectionProps {
  clip: ClipCreationHook;
}

export function KeywordSection({ clip }: KeywordSectionProps) {
  return (
    <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Wand2 className="h-5 w-5 text-amber-500" />
        <h2 className="text-lg font-semibold text-amber-400">AI Keyword Generator</h2>
      </div>
      <p className="text-sm text-zinc-400 mb-4">
        Enter a single keyword and let AI automatically select the best settings for viral content.
      </p>
      <KeywordInput
        onKeywordAnalyzed={clip.handleKeywordAnalyzed}
        disabled={clip.busy}
        forceClipType={clip.clipType}
      />
    </div>
  );
}

interface TopicDurationRowProps {
  clip: ClipCreationHook;
}

export function TopicDurationRow({ clip }: TopicDurationRowProps) {
  return (
    <>
      <AgeGroupSelector
        value={clip.targetAgeGroup}
        onChange={clip.setTargetAgeGroup}
        showSuggestions={true}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TopicSelect
          value={clip.topic}
          topics={clip.topics}
          onChange={clip.setTopic}
          disabled={clip.busy}
          allowCustom={clip.clipType === 'subway_interview'}
        />
        <DurationChips
          value={clip.duration}
          options={clip.DURATION_OPTIONS}
          onChange={clip.setDuration}
          disabled={clip.busy}
        />
      </div>
      <div className="mt-4">
        <CompactEffectsBar
          clipType={clip.clipType}
          effects={clip.effects}
          onCustomize={() => clip.setShowEffectsModal(true)}
        />
      </div>
    </>
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

interface ModelSectionProps {
  clip: ClipCreationHook;
  showSpeechScript: boolean;
}

export function ModelSection({ clip, showSpeechScript }: ModelSectionProps) {
  return (
    <div className="border-t border-zinc-800 pt-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
        <span className="text-sm font-medium text-cyan-400">AI Model Settings</span>
      </div>
      <div className="space-y-5">
        <ModelTierSelector
          value={clip.modelTier}
          onChange={clip.setModelTier}
          disabled={clip.busy}
        />
        {showSpeechScript && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-300">
              Speech Script (optional)
            </label>
            <textarea
              value={clip.speechScript}
              onChange={(e) => clip.setSpeechScript(e.target.value)}
              disabled={clip.busy}
              placeholder="What should the person say? Leave blank for AI-generated contextual response..."
              rows={2}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50 disabled:opacity-50 disabled:cursor-not-allowed resize-none"
            />
            <p className="text-xs text-zinc-600">
              The AI will generate a video of the person speaking this dialogue naturally
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

interface AdvancedOptionsSectionProps {
  clip: ClipCreationHook;
}

export function AdvancedOptionsSection({ clip }: AdvancedOptionsSectionProps) {
  return (
    <div className="border-t border-zinc-800 pt-6">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-4 w-4 text-teal-500" />
        <span className="text-sm font-medium text-teal-400">Advanced Options</span>
      </div>
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <InterviewFormatSelector
            value={clip.interviewFormat}
            onChange={clip.setInterviewFormat}
            disabled={clip.busy}
          />
          <DurationSelector
            value={clip.durationPreset}
            onChange={clip.setDurationPreset}
            disabled={clip.busy}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <LanguageSelector
            value={clip.language}
            onChange={clip.setLanguage}
            disabled={clip.busy}
          />
          <NicheSelector
            value={clip.niche}
            onChange={clip.setNiche}
            disabled={clip.busy}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CaptionStyleSelector
            value={clip.captionStyle}
            onChange={clip.setCaptionStyle}
            disabled={clip.busy}
          />
          <PlatformExportSelector
            value={clip.exportPlatforms}
            onChange={clip.setExportPlatforms}
            disabled={clip.busy}
          />
        </div>
        <ProductPlacementPanel
          config={clip.productPlacement}
          onChange={clip.setProductPlacement}
          disabled={clip.busy}
        />
        <KeywordGenerator
          keyword={clip.keyword}
          onKeywordChange={clip.setKeyword}
          niche={clip.niche}
          onNicheChange={clip.setNiche}
          onGenerate={() => clip.setIsGeneratingKeywords(true)}
          isGenerating={clip.isGeneratingKeywords}
          disabled={clip.busy}
        />
      </div>
    </div>
  );
}

interface GenerateSectionProps {
  clip: ClipCreationHook;
  onGenerate: () => void;
}

export function GenerateSection({ clip, onGenerate }: GenerateSectionProps) {
  return (
    <>
      <AngleInput
        value={clip.angle}
        placeholder={clip.getPlaceholderText()}
        onChange={clip.setAngle}
        disabled={clip.busy}
        label="Additional Direction (optional)"
      />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-2">
        <button
          type="button"
          onClick={onGenerate}
          disabled={clip.busy}
          className="flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-6 py-3.5 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {clip.batchMode ? (
            <>
              <Layers className="h-4 w-4" />
              {clip.busy ? 'Working...' : `Generate ${clip.batchSize} Clips`}
            </>
          ) : (
            <>
              <Zap className="h-4 w-4" />
              {clip.busy ? 'Working...' : 'Generate Clip'}
            </>
          )}
        </button>
        <p className="text-sm text-zinc-500">
          Vertical 9:16 | {clip.batchMode ? `${clip.batchSize} clip series` : 'Single clip'}
        </p>
      </div>
      {clip.status !== 'idle' && (
        <StatusCard
          status={clip.status === 'planning' ? 'planning' : clip.status === 'generating' ? 'generating' : clip.status === 'error' ? 'error' : 'done'}
          message={clip.errorMessage || undefined}
        />
      )}
    </>
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
