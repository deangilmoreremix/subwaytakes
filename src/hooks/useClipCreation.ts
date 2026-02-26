import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  ClipType,
  ModelTier,
  AgeGroup,
  CharacterPreset,
  InterviewerType,
  InterviewerPosition,
  SubjectDemographic,
  SubjectGender,
  SubjectStyle,
  InterviewFormat,
  DurationPreset,
  ProductPlacementConfig,
  SupportedLanguage,
  ExportPlatform,
  NicheCategory,
  RemotionEffectsConfig,
} from '../lib/types';
import { getDefaultEffects } from '../lib/types';
import {
  TOPICS,
  DURATION_OPTIONS,
  BATCH_SIZE_OPTIONS,
  getPlaceholderText,
  getDefaultDuration,
  CHARACTER_PRESETS,
  AGE_APPROPRIATE_TOPICS,
} from '../lib/constants';
import { createClip, createClipBatch, type CreateClipOptions } from '../lib/clips';
import { safeMutate, mutationKey } from '../lib/safeMutation';
import { filterModesByAge } from '../lib/contentFilter';
import type { KeywordAnalysis } from '../lib/keywordEngine';

export type GenerationStatus = 'idle' | 'planning' | 'generating' | 'done' | 'error';

export interface WizardStepDef {
  label: string;
  optional?: boolean;
}

export function useClipCreation(clipType: ClipType, stepDefs?: WizardStepDef[]) {
  const navigate = useNavigate();
  const navTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => {
      if (navTimerRef.current) clearTimeout(navTimerRef.current);
    };
  }, []);

  const totalSteps = stepDefs?.length ?? 1;
  const [currentStep, setCurrentStep] = useState(0);

  function goToStep(n: number) {
    if (n >= 0 && n < totalSteps) setCurrentStep(n);
  }
  function nextStep() {
    if (currentStep < totalSteps - 1) setCurrentStep(currentStep + 1);
  }
  function prevStep() {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  }

  const [topic, setTopic] = useState<string>(TOPICS[clipType][0]);
  const [duration, setDuration] = useState<number>(getDefaultDuration(clipType));
  const [angle, setAngle] = useState('');
  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const [modelTier, setModelTier] = useState<ModelTier>('standard');
  const [speechScript, setSpeechScript] = useState('');

  const [targetAgeGroup, setTargetAgeGroup] = useState<AgeGroup>('all_ages');

  const [effects, setEffects] = useState<RemotionEffectsConfig>(() => getDefaultEffects(clipType));
  const [showEffectsModal, setShowEffectsModal] = useState(false);

  const [interviewFormat, setInterviewFormat] = useState<InterviewFormat>('solo');
  const [durationPreset, setDurationPreset] = useState<DurationPreset>('hook');
  const [productPlacement, setProductPlacement] = useState<ProductPlacementConfig>({
    enabled: false,
    productName: '',
    productDescription: '',
    callToAction: '',
    placementStyle: 'subtle',
    integrationType: 'natural_mention',
  });
  const [language, setLanguage] = useState<SupportedLanguage>('en');
  const [captionStyle, setCaptionStyle] = useState('standard');
  const [exportPlatforms, setExportPlatforms] = useState<ExportPlatform[]>(['tiktok', 'instagram_reel']);
  const [niche, setNiche] = useState<NicheCategory>('motivation');
  const [keyword, setKeyword] = useState('');
  const [isGeneratingKeywords, setIsGeneratingKeywords] = useState(false);

  const [keywordMode, setKeywordMode] = useState(false);
  const [keywordAnalysis, setKeywordAnalysis] = useState<KeywordAnalysis | null>(null);

  const [characterPreset, setCharacterPreset] = useState<CharacterPreset>('street_vox');
  const [interviewerType, setInterviewerType] = useState<InterviewerType>('casual_creator');
  const [interviewerPosition, setInterviewerPosition] = useState<InterviewerPosition>('holding_mic');
  const [subjectDemographic, setSubjectDemographic] = useState<SubjectDemographic>('any');
  const [subjectGender, setSubjectGender] = useState<SubjectGender>('any');
  const [subjectStyle, setSubjectStyle] = useState<SubjectStyle>('casual');
  const [showCharacterDetails, setShowCharacterDetails] = useState(false);

  const [batchMode, setBatchMode] = useState(false);
  const [batchSize, setBatchSize] = useState<number>(3);

  const topics = useMemo(() => {
    const baseTopics = TOPICS[clipType];
    if (targetAgeGroup === 'all_ages') return baseTopics;
    const ageAppropriate = AGE_APPROPRIATE_TOPICS[targetAgeGroup] || [];
    return [...new Set([...baseTopics, ...ageAppropriate])];
  }, [clipType, targetAgeGroup]);

  const filteredModes = useMemo(() => {
    return filterModesByAge(targetAgeGroup);
  }, [targetAgeGroup]);

  const busy = status === 'planning' || status === 'generating';

  function handlePresetChange(preset: CharacterPreset) {
    setCharacterPreset(preset);
    const config = CHARACTER_PRESETS.find(p => p.value === preset);
    if (config && preset !== 'custom') {
      setInterviewerType(config.interviewer.type);
      setInterviewerPosition(config.interviewer.position);
      setSubjectDemographic(config.subject.demographic);
      setSubjectStyle(config.subject.style);
      setShowCharacterDetails(false);
    } else {
      setShowCharacterDetails(true);
    }
  }

  function handleKeywordAnalyzed(analysis: KeywordAnalysis) {
    setKeywordAnalysis(analysis);
    setKeywordMode(true);
    setTopic(analysis.topic);
    setCharacterPreset(analysis.characterPreset);
    if (analysis.subjectDemographic) setSubjectDemographic(analysis.subjectDemographic);
    if (analysis.subjectStyle) setSubjectStyle(analysis.subjectStyle);

    if (analysis.clipType !== clipType) {
      const routeMap: Record<ClipType, string> = {
        subway_interview: '/create/subway',
        street_interview: '/create/street',
        motivational: '/create/motivational',
        wisdom_interview: '/create/wisdom',
        studio_interview: '/create/studio',
      };
      navigate(routeMap[analysis.clipType]);
    }
  }

  const mutationKeyRef = useRef<string>('');

  async function generateClip(modeSpecificOptions: Partial<CreateClipOptions>) {
    if (busy) return;
    setStatus('planning');
    setErrorMessage('');

    mutationKeyRef.current = mutationKey('clip');

    try {
      const isInterview = ['subway_interview', 'street_interview', 'studio_interview', 'wisdom_interview'].includes(clipType);

      const options: CreateClipOptions = {
        videoType: clipType,
        topic,
        durationSeconds: duration,
        anglePrompt: angle || undefined,
        modelTier,
        speechScript: isInterview && speechScript ? speechScript : undefined,
        interviewerType: isInterview ? interviewerType : undefined,
        interviewerPosition: isInterview ? interviewerPosition : undefined,
        subjectDemographic: isInterview ? subjectDemographic : undefined,
        subjectGender: isInterview ? subjectGender : undefined,
        subjectStyle: isInterview ? subjectStyle : undefined,
        language,
        niche,
        interview_format: interviewFormat,
        duration_preset: durationPreset,
        caption_style: captionStyle,
        export_platforms: exportPlatforms,
        product_placement: productPlacement.enabled ? productPlacement : undefined,
        targetAgeGroup: targetAgeGroup !== 'all_ages' ? targetAgeGroup : undefined,
        effects,
        ...modeSpecificOptions,
      };

      if (batchMode && clipType === 'subway_interview') {
        const clips = await safeMutate({
          key: mutationKeyRef.current,
          fn: () => createClipBatch(options, batchSize),
        });
        setStatus('generating');
        navTimerRef.current = setTimeout(() => navigate('/clips/' + clips[0].id), 500);
      } else {
        const clip = await safeMutate({
          key: mutationKeyRef.current,
          fn: () => createClip(options),
        });
        setStatus('generating');
        navTimerRef.current = setTimeout(() => navigate('/clips/' + clip.id), 500);
      }
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to create clip');
    }
  }

  const [showAdvanced, setShowAdvanced] = useState(false);

  return {
    currentStep, totalSteps, goToStep, nextStep, prevStep,
    showAdvanced, setShowAdvanced,
    topic, setTopic,
    duration, setDuration, durationSeconds: duration,
    angle, setAngle,
    status, errorMessage,
    modelTier, setModelTier,
    speechScript, setSpeechScript,
    targetAgeGroup, setTargetAgeGroup,
    effects, setEffects,
    showEffectsModal, setShowEffectsModal,
    interviewFormat, setInterviewFormat,
    durationPreset, setDurationPreset,
    productPlacement, setProductPlacement,
    language, setLanguage,
    captionStyle, setCaptionStyle,
    exportPlatforms, setExportPlatforms,
    niche, setNiche,
    keyword, setKeyword,
    isGeneratingKeywords, setIsGeneratingKeywords,
    keywordMode, keywordAnalysis,
    handleKeywordAnalyzed,
    characterPreset, setCharacterPreset,
    handlePresetChange,
    interviewerType, setInterviewerType,
    interviewerPosition, setInterviewerPosition,
    subjectDemographic, setSubjectDemographic,
    subjectGender, setSubjectGender,
    subjectStyle, setSubjectStyle,
    showCharacterDetails, setShowCharacterDetails,
    batchMode, setBatchMode,
    batchSize, setBatchSize,
    topics, filteredModes, busy,
    clipType,
    generateClip,
    navigate,
    DURATION_OPTIONS,
    BATCH_SIZE_OPTIONS,
    getPlaceholderText: () => getPlaceholderText(clipType),
  };
}

export type ClipCreationHook = ReturnType<typeof useClipCreation>;
