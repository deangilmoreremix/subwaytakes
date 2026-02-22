import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Layers, ChevronDown, ChevronUp, Users, Sparkles, MapPin, Flame, Heart, Wand2, Globe, Hash, Film, Tag, ShoppingBag, Languages } from 'lucide-react';
import { ClipTypeSelector } from '../components/ClipTypeSelector';
import { TopicSelect } from '../components/TopicSelect';
import { DurationChips } from '../components/DurationChips';
import { AngleInput } from '../components/AngleInput';
import { StatusCard } from '../components/StatusCard';
import { QuestionInput } from '../components/QuestionInput';
import { SceneTypeSelector } from '../components/SceneTypeSelector';
import { CityStyleSelector } from '../components/CityStyleSelector';
import { EnergyLevelSelector } from '../components/EnergyLevelSelector';
import { ModelTierSelector } from '../components/ModelTierSelector';
import { SpeakerStyleSelector } from '../components/SpeakerStyleSelector';
import { MotivationalSettingSelector } from '../components/MotivationalSettingSelector';
import { CameraStyleSelector } from '../components/CameraStyleSelector';
import { LightingMoodSelector } from '../components/LightingMoodSelector';
import { StreetSceneSelector } from '../components/StreetSceneSelector';
import { InterviewStyleSelector } from '../components/InterviewStyleSelector';
import { TimeOfDaySelector } from '../components/TimeOfDaySelector';
import { InterviewerSelector } from '../components/InterviewerSelector';
import { SubjectSelector } from '../components/SubjectSelector';
import { CharacterPresetSelector } from '../components/CharacterPresetSelector';
import { AgeGroupSelector } from '../components/AgeGroupSelector';
import { WisdomToneSelector } from '../components/WisdomToneSelector';
import { WisdomFormatSelector } from '../components/WisdomFormatSelector';
import { WisdomDemographicSelector } from '../components/WisdomDemographicSelector';
import { WisdomSettingSelector } from '../components/WisdomSettingSelector';
import { StudioSetupSelector } from '../components/StudioSetupSelector';
import { StudioLightingSelector } from '../components/StudioLightingSelector';
import { KeywordInput } from '../components/KeywordInput';
// NEW FEATURES
import { InterviewFormatSelector } from '../components/InterviewFormatSelector';
import { DurationSelector } from '../components/DurationSelector';
import { ProductPlacementPanel } from '../components/ProductPlacementConfig';
import { LanguageSelector } from '../components/LanguageSelector';
import { CaptionStyleSelector } from '../components/CaptionStyleSelector';
import { PlatformExportSelector } from '../components/PlatformExportSelector';
import { NicheSelector } from '../components/NicheSelector';
import { KeywordGenerator } from '../components/KeywordGenerator';
// Remotion Effects Components
import { CompactEffectsBar } from '../components/CompactEffectsBar';
import { EffectsCustomizeModal } from '../components/EffectsCustomizeModal';
// Subway Enhancement Components
import { JourneyBuilder } from '../components/JourneyBuilder';
import { CrowdReactionPanel } from '../components/CrowdReactionPanel';
import { SoundscapeSelector } from '../components/SoundscapeSelector';
import { PlotTwistSelector } from '../components/PlotTwistSelector';
import { PlatformPoll as PlatformPollComponent } from '../components/PlatformPoll';
import { SubwayLineSelector } from '../components/SubwayLineSelector';
import { TrainArrivalTimer } from '../components/TrainArrivalTimer';
import { SeasonalContextSelector } from '../components/SeasonalContextSelector';
import { TransferPointBuilder } from '../components/TransferPointBuilder';
// Street Interview Enhancement Components
import { StreetJourneyBuilder } from '../components/StreetJourneyBuilder';
import { StreetCrowdPanel } from '../components/StreetCrowdPanel';
import { UrbanSoundscapeSelector } from '../components/UrbanSoundscapeSelector';
import { StreetPlotTwistSelector } from '../components/StreetPlotTwistSelector';
import { StreetPoll } from '../components/StreetPoll';
import { NeighborhoodSelector } from '../components/NeighborhoodSelector';
import { StreetDramaticMoment } from '../components/StreetDramaticMoment';
import { StreetSeasonalSelector } from '../components/StreetSeasonalSelector';
import { CrossStreetPivot } from '../components/CrossStreetPivot';
// Motivational Enhancement Components
import { TransformationArcBuilder } from '../components/TransformationArcBuilder';
import { AudienceEnergyPanel } from '../components/AudienceEnergyPanel';
import { MotivationalSoundscape } from '../components/MotivationalSoundscape';
import { BreakthroughMomentSelector } from '../components/BreakthroughMomentSelector';
import { EventEnergyArc } from '../components/EventEnergyArc';
import { LiveChallengeSelector } from '../components/LiveChallengeSelector';
import { SpeakerArchetypeSelector } from '../components/SpeakerArchetypeSelector';
import { PauseForEffect } from '../components/PauseForEffect';
import { AchievementContextSelector } from '../components/AchievementContextSelector';
import { CTAPivot } from '../components/CTAPivot';
import {
  TOPICS,
  DURATION_OPTIONS,
  BATCH_SIZE_OPTIONS,
  getPlaceholderText,
  getDefaultDuration,
  CHARACTER_PRESETS,
  AGE_APPROPRIATE_TOPICS,
  INTERVIEW_MODES,
} from '../lib/constants';
import { createClip, createClipBatch } from '../lib/clips';
import { filterTopicsByAge, filterModesByAge } from '../lib/contentFilter';
import { analyzeKeyword, type KeywordAnalysis } from '../lib/keywordEngine';
import { getDefaultEffects } from '../lib/types';
import type {
  ClipType,
  SubwaySceneType,
  CityStyle,
  EnergyLevel,
  ModelTier,
  SpeakerStyle,
  MotivationalSetting,
  CameraStyle,
  LightingMood,
  StreetScene,
  InterviewStyle,
  InterviewFormat,
  DurationPreset,
  DurationConfig,
  ProductPlacementConfig,
  SupportedLanguage,
  CaptionStyleConfig,
  ExportPlatform,
  ExportConfig,
  NicheCategory,
  KeywordConfig,
  TimeOfDay,
  InterviewerType,
  InterviewerPosition,
  SubjectDemographic,
  SubjectGender,
  SubjectStyle,
  CharacterPreset,
  // Subway enhancement types
  MultiStopJourney,
  CrowdReactionConfig,
  SoundscapeConfig,
  PlotTwist,
  PlatformPoll,
  SubwayLine,
  TrainArrivalMoment,
  SeasonalContext,
  TransferPoint,
  SubwayEnhancementConfig,
  // Street enhancement types
  StreetMultiLocationJourney,
  StreetCrowdConfig,
  UrbanSoundscapeConfig,
  StreetPlotTwist,
  StreetPoll as StreetPollType,
  Neighborhood,
  StreetDramaticMoment as StreetDramaticMomentType,
  StreetSeasonalContext,
  CrossStreetPivot as CrossStreetPivotType,
  StreetEnhancementConfig,
  // Motivational enhancement types
  TransformationArc,
  AudienceEnergyConfig,
  MotivationalSoundscapeConfig,
  BreakthroughMoment,
  EventEnergyArcConfig,
  LiveChallenge,
  SpeakerArchetypeConfig,
  PauseForEffectConfig,
  AchievementContext,
  CTAPivotConfig,
  MotivationalEnhancementConfig,
  AgeGroup,
  WisdomTone,
  WisdomFormat,
  WisdomDemographic,
  WisdomSetting,
  StudioSetup,
  StudioLighting,
  RemotionEffectsConfig,
} from '../lib/types';

// Alias for component to avoid naming conflict with type
const PlatformPoll = PlatformPollComponent;

type GenerationStatus = 'idle' | 'planning' | 'generating' | 'done' | 'error';

export function CreatePage() {
  const navigate = useNavigate();
  const [clipType, setClipType] = useState<ClipType>('wisdom_interview');
  const [topic, setTopic] = useState<string>(TOPICS.wisdom_interview[0]);
  const [duration, setDuration] = useState<number>(6);
  const [angle, setAngle] = useState<string>('');
  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const [interviewQuestion, setInterviewQuestion] = useState<string>('');
  const [sceneType, setSceneType] = useState<SubwaySceneType>('platform_waiting');
  const [cityStyle, setCityStyle] = useState<CityStyle>('nyc');
  const [energyLevel, setEnergyLevel] = useState<EnergyLevel>('conversational');

  const [speakerStyle, setSpeakerStyle] = useState<SpeakerStyle>('intense_coach');
  const [motivationalSetting, setMotivationalSetting] = useState<MotivationalSetting>('gym');
  const [cameraStyle, setCameraStyle] = useState<CameraStyle>('dramatic_push');
  const [lightingMood, setLightingMood] = useState<LightingMood>('dramatic_shadows');

  const [streetScene, setStreetScene] = useState<StreetScene>('busy_sidewalk');
  const [interviewStyle, setInterviewStyle] = useState<InterviewStyle>('man_on_street');
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('midday');

  const [batchMode, setBatchMode] = useState(false);
  const [batchSize, setBatchSize] = useState<number>(3);

  const [modelTier, setModelTier] = useState<ModelTier>('standard');
  const [speechScript, setSpeechScript] = useState<string>('');

  const [characterPreset, setCharacterPreset] = useState<CharacterPreset>('street_vox');
  const [interviewerType, setInterviewerType] = useState<InterviewerType>('casual_creator');
  const [interviewerPosition, setInterviewerPosition] = useState<InterviewerPosition>('holding_mic');
  const [subjectDemographic, setSubjectDemographic] = useState<SubjectDemographic>('any');
  const [subjectGender, setSubjectGender] = useState<SubjectGender>('any');
  const [subjectStyle, setSubjectStyle] = useState<SubjectStyle>('casual');
  const [showCharacterDetails, setShowCharacterDetails] = useState(false);

  // Subway Enhancement States
  const [subwayLine, setSubwayLine] = useState<SubwayLine | undefined>('any');
  const [multiStopJourney, setMultiStopJourney] = useState<MultiStopJourney | undefined>();
  const [crowdReactions, setCrowdReactions] = useState<CrowdReactionConfig | undefined>();
  const [soundscape, setSoundscape] = useState<SoundscapeConfig | undefined>();
  const [plotTwist, setPlotTwist] = useState<PlotTwist | undefined>();
  const [platformPoll, setPlatformPoll] = useState<PlatformPoll | undefined>();
  const [trainArrival, setTrainArrival] = useState<TrainArrivalMoment | undefined>();
  const [seasonalContext, setSeasonalContext] = useState<SeasonalContext | undefined>();
  const [transferPoint, setTransferPoint] = useState<TransferPoint | undefined>();
  const [showEnhancements, setShowEnhancements] = useState(false);

  // Street Interview Enhancement States
  const [neighborhood, setNeighborhood] = useState<Neighborhood | undefined>('soho');
  const [streetMultiLocationJourney, setStreetMultiLocationJourney] = useState<StreetMultiLocationJourney | undefined>();
  const [streetCrowdConfig, setStreetCrowdConfig] = useState<StreetCrowdConfig | undefined>();
  const [urbanSoundscape, setUrbanSoundscape] = useState<UrbanSoundscapeConfig | undefined>();
  const [streetPlotTwist, setStreetPlotTwist] = useState<StreetPlotTwist | undefined>();
  const [streetPoll, setStreetPoll] = useState<StreetPollType | undefined>();
  const [streetDramaticMoment, setStreetDramaticMoment] = useState<StreetDramaticMomentType | undefined>();
  const [streetSeasonalContext, setStreetSeasonalContext] = useState<StreetSeasonalContext | undefined>();
  const [crossStreetPivot, setCrossStreetPivot] = useState<CrossStreetPivotType | undefined>();
  const [showStreetEnhancements, setShowStreetEnhancements] = useState(false);

  // Motivational Enhancement States
  const [transformationArc, setTransformationArc] = useState<TransformationArc | undefined>();
  const [audienceEnergy, setAudienceEnergy] = useState<AudienceEnergyConfig | undefined>();
  const [motivationalSoundscape, setMotivationalSoundscape] = useState<MotivationalSoundscapeConfig | undefined>();
  const [breakthroughMoment, setBreakthroughMoment] = useState<BreakthroughMoment | undefined>();
  const [eventEnergyArc, setEventEnergyArc] = useState<EventEnergyArcConfig | undefined>();
  const [liveChallenge, setLiveChallenge] = useState<LiveChallenge | undefined>();
  const [speakerArchetype, setSpeakerArchetype] = useState<SpeakerArchetypeConfig | undefined>();
  const [pauseForEffect, setPauseForEffect] = useState<PauseForEffectConfig | undefined>();
  const [achievementContext, setAchievementContext] = useState<AchievementContext | undefined>();
  const [ctaPivot, setCtaPivot] = useState<CTAPivotConfig | undefined>();

  // NEW FEATURES - Interview Format & Duration
  const [interviewFormat, setInterviewFormat] = useState<InterviewFormat>('solo');
  const [durationPreset, setDurationPreset] = useState<DurationPreset>('hook');
  
  // NEW FEATURES - Product & Language
  const [productPlacement, setProductPlacement] = useState<ProductPlacementConfig>({
    enabled: false,
    productName: '',
    productDescription: '',
    callToAction: '',
    placementStyle: 'subtle',
    integrationType: 'natural_mention',
  });
  const [language, setLanguage] = useState<SupportedLanguage>('en');
  
  // NEW FEATURES - Captions & Export
  const [captionStyle, setCaptionStyle] = useState<string>('standard');
  const [exportPlatforms, setExportPlatforms] = useState<ExportPlatform[]>(['tiktok', 'instagram_reel']);
  
  // NEW FEATURES - Niche & Keywords
  const [niche, setNiche] = useState<NicheCategory>('motivation');
  const [keyword, setKeyword] = useState<string>('');
  const [isGeneratingKeywords, setIsGeneratingKeywords] = useState(false);
  const [showMotivationalEnhancements, setShowMotivationalEnhancements] = useState(false);

  // Age Group State
  const [targetAgeGroup, setTargetAgeGroup] = useState<AgeGroup>('all_ages');

  // Wisdom Mode State
  const [wisdomTone, setWisdomTone] = useState<WisdomTone>('gentle');
  const [wisdomFormat, setWisdomFormat] = useState<WisdomFormat>('street_conversation');
  const [wisdomDemographic, setWisdomDemographic] = useState<WisdomDemographic>('retirees');
  const [wisdomSetting, setWisdomSetting] = useState<WisdomSetting>('park_bench');

  // Studio Interview State
  const [studioSetup, setStudioSetup] = useState<StudioSetup>('podcast_desk');
  const [studioLighting, setStudioLighting] = useState<StudioLighting>('three_point');

  // Keyword Mode State
  const [keywordMode, setKeywordMode] = useState(false);
  const [keywordAnalysis, setKeywordAnalysis] = useState<KeywordAnalysis | null>(null);

  // Remotion Effects State
  const [showEffectsModal, setShowEffectsModal] = useState(false);
  const [effects, setEffects] = useState<RemotionEffectsConfig>(() => getDefaultEffects('wisdom_interview'));

  // Update effects when clip type changes
  useEffect(() => {
    setEffects(getDefaultEffects(clipType));
  }, [clipType]);

  // Handle keyword analysis result
  function handleKeywordAnalyzed(analysis: KeywordAnalysis) {
    setKeywordAnalysis(analysis);
    // Auto-select clip type and settings based on keyword
    setClipType(analysis.clipType);
    setTopic(analysis.topic);
    setCharacterPreset(analysis.characterPreset);
    
    // Apply other settings based on analysis
    if (analysis.interviewStyle) setInterviewStyle(analysis.interviewStyle);
    if (analysis.energyLevel) setEnergyLevel(analysis.energyLevel);
    if (analysis.sceneType) setSceneType(analysis.sceneType);
    if (analysis.cityStyle) setCityStyle(analysis.cityStyle);
    if (analysis.subwayLine) setSubwayLine(analysis.subwayLine);
    if (analysis.timeOfDay) setTimeOfDay(analysis.timeOfDay);
    if (analysis.motivationalSetting) setMotivationalSetting(analysis.motivationalSetting);
    if (analysis.speakerStyle) setSpeakerStyle(analysis.speakerStyle);
    if (analysis.cameraStyle) setCameraStyle(analysis.cameraStyle);
    if (analysis.lightingMood) setLightingMood(analysis.lightingMood);
    if (analysis.wisdomTone) setWisdomTone(analysis.wisdomTone);
    if (analysis.streetScene) setStreetScene(analysis.streetScene);
    if (analysis.subjectDemographic) setSubjectDemographic(analysis.subjectDemographic);
    if (analysis.subjectStyle) setSubjectStyle(analysis.subjectStyle);
  }

  // Reset keyword mode when manually changing clip type
  function handleClipTypeChange(newType: ClipType) {
    setClipType(newType);
    setKeywordMode(false);
    setKeywordAnalysis(null);
  }

  // Build subway enhancements config from individual states
  function buildSubwayEnhancements(): SubwayEnhancementConfig | undefined {
    const hasEnhancements = multiStopJourney?.enabled || 
      crowdReactions?.enabled || 
      soundscape?.enabled || 
      plotTwist || 
      platformPoll?.enabled || 
      trainArrival?.enabled || 
      seasonalContext?.enabled || 
      transferPoint?.enabled;
    
    if (!hasEnhancements) return undefined;

    return {
      multiStopJourney,
      crowdReactions,
      soundscape,
      plotTwist,
      platformPoll,
      subwayLine,
      trainArrival,
      seasonalContext,
      transferPoint,
    };
  }

  // Build street enhancements config from individual states
  function buildStreetEnhancements(): StreetEnhancementConfig | undefined {
    const hasEnhancements = streetMultiLocationJourney?.enabled || 
      streetCrowdConfig?.enabled || 
      urbanSoundscape?.enabled || 
      streetPlotTwist || 
      streetPoll?.enabled || 
      streetDramaticMoment?.enabled || 
      streetSeasonalContext?.enabled || 
      crossStreetPivot?.enabled;
    
    if (!hasEnhancements) return undefined;

    return {
      multiLocationJourney: streetMultiLocationJourney,
      crowdDynamics: streetCrowdConfig,
      urbanSoundscape,
      plotTwist: streetPlotTwist,
      streetPoll,
      neighborhood,
      dramaticMoment: streetDramaticMoment,
      seasonalContext: streetSeasonalContext,
      crossStreetPivot,
    };
  }

  // Build motivational enhancements config from individual states
  function buildMotivationalEnhancements(): MotivationalEnhancementConfig | undefined {
    const hasEnhancements = transformationArc?.enabled || 
      audienceEnergy?.enabled || 
      motivationalSoundscape?.enabled || 
      breakthroughMoment?.enabled || 
      eventEnergyArc?.enabled || 
      liveChallenge?.enabled || 
      speakerArchetype?.enabled || 
      pauseForEffect?.enabled || 
      achievementContext?.enabled || 
      ctaPivot?.enabled;
    
    if (!hasEnhancements) return undefined;

    return {
      transformationArc,
      audienceEnergy,
      soundscape: motivationalSoundscape,
      breakthroughMoment,
      eventEnergyArc,
      liveChallenge,
      speakerArchetype,
      pauseForEffect,
      achievementContext,
      ctaPivot,
    };
  }

  const topics = useMemo(() => {
    const baseTopics = TOPICS[clipType];
    // Filter topics based on age group if not all_ages
    if (targetAgeGroup === 'all_ages') {
      return baseTopics;
    }
    // Combine clip-type topics with age-appropriate topics
    const ageAppropriate = AGE_APPROPRIATE_TOPICS[targetAgeGroup] || [];
    const combined = [...new Set([...baseTopics, ...ageAppropriate])];
    return combined;
  }, [clipType, targetAgeGroup]);
  
  const filteredModes = useMemo(() => {
    return filterModesByAge(targetAgeGroup);
  }, [targetAgeGroup]);

  const isSubway = clipType === 'subway_interview';
  const isStreet = clipType === 'street_interview';
  const isMotivational = clipType === 'motivational';
  const isWisdom = clipType === 'wisdom_interview';
  const isStudio = clipType === 'studio_interview';
  const isInterview = isSubway || isStreet || isStudio || isWisdom;

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

  useEffect(() => {
    setTopic(TOPICS[clipType][0]);
    setDuration(getDefaultDuration(clipType));
    setAngle('');
    if (clipType !== 'subway_interview') {
      setInterviewQuestion('');
      setBatchMode(false);
    }
  }, [clipType]);

  async function handleGenerate() {
    setStatus('planning');
    setErrorMessage('');

    try {
      const options = {
        videoType: clipType,
        topic,
        durationSeconds: duration,
        anglePrompt: angle || undefined,
        interviewQuestion: isSubway ? interviewQuestion || undefined : undefined,
        sceneType: isSubway ? sceneType : undefined,
        cityStyle: isSubway ? cityStyle : undefined,
        energyLevel: isSubway || isStreet ? energyLevel : undefined,
        speakerStyle: isMotivational ? speakerStyle : undefined,
        motivationalSetting: isMotivational ? motivationalSetting : undefined,
        cameraStyle: isMotivational ? cameraStyle : undefined,
        lightingMood: isMotivational ? lightingMood : undefined,
        streetScene: isStreet ? streetScene : undefined,
        interviewStyle: isInterview ? interviewStyle : undefined,
        timeOfDay: isStreet ? timeOfDay : undefined,
        modelTier,
        speechScript: isInterview && speechScript ? speechScript : undefined,
        interviewerType: isInterview ? interviewerType : undefined,
        interviewerPosition: isInterview ? interviewerPosition : undefined,
        subjectDemographic: isInterview ? subjectDemographic : undefined,
        subjectGender: isInterview ? subjectGender : undefined,
        subjectStyle: isInterview ? subjectStyle : undefined,
        // Subway enhancements
        subwayLine: isSubway ? subwayLine : undefined,
        subwayEnhancements: isSubway ? buildSubwayEnhancements() : undefined,
        // Street enhancements
        neighborhood: isStreet ? neighborhood : undefined,
        streetEnhancements: isStreet ? buildStreetEnhancements() : undefined,
        // Motivational enhancements
        motivationalEnhancements: isMotivational ? buildMotivationalEnhancements() : undefined,
        // Age-appropriate content
        targetAgeGroup,
        // Wisdom mode
        wisdomTone: isWisdom ? wisdomTone : undefined,
        wisdomFormat: isWisdom ? wisdomFormat : undefined,
        wisdomDemographic: isWisdom ? wisdomDemographic : undefined,
        wisdomSetting: isWisdom ? wisdomSetting : undefined,
        // Studio interview
        studioSetup: isStudio ? studioSetup : undefined,
        studioLighting: isStudio ? studioLighting : undefined,
        // Remotion effects
        effects,
        // New feature fields
        language,
        niche,
        interview_format: interviewFormat,
        duration_preset: durationPreset,
        caption_style: captionStyle,
        export_platforms: exportPlatforms,
        product_placement: productPlacement.enabled ? productPlacement : undefined,
      };

      if (batchMode && isSubway) {
        const clips = await createClipBatch(options, batchSize);
        setStatus('generating');
        setTimeout(() => {
          navigate('/clips/' + clips[0].id);
        }, 500);
      } else {
        const clip = await createClip(options);
        setStatus('generating');
        setTimeout(() => {
          navigate('/clips/' + clip.id);
        }, 500);
      }
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to create clip');
    }
  }

  const busy = status === 'planning' || status === 'generating';

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">
          Create Clip
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          {batchMode
            ? `Generate ${batchSize} viral clips at once — same question, different reactions.`
            : 'One prompt generates a single 2-8 second clip. No editing required.'}
        </p>
      </div>

      {/* Keyword Input Section - NEW FEATURE */}
      <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Wand2 className="h-5 w-5 text-amber-500" />
          <h2 className="text-lg font-semibold text-amber-400">AI Keyword Generator</h2>
        </div>
        <p className="text-sm text-zinc-400 mb-4">
          Enter a single keyword and let AI automatically select the best settings for viral content.
        </p>
        <KeywordInput 
          onKeywordAnalyzed={handleKeywordAnalyzed}
          disabled={busy}
          forceClipType={clipType}
        />
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 space-y-6">
        <ClipTypeSelector
          value={clipType}
          onChange={handleClipTypeChange}
          disabled={busy}
        />

        <AgeGroupSelector
          value={targetAgeGroup}
          onChange={setTargetAgeGroup}
          showSuggestions={true}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TopicSelect
            value={topic}
            topics={topics}
            onChange={setTopic}
            disabled={busy}
            allowCustom={isSubway}
          />
          <DurationChips
            value={duration}
            options={DURATION_OPTIONS}
            onChange={setDuration}
            disabled={busy}
          />
        </div>

        {/* Remotion Effects Bar */}
        <div className="mt-4">
          <CompactEffectsBar
            clipType={clipType}
            effects={effects}
            onCustomize={() => setShowEffectsModal(true)}
          />
        </div>

        {isWisdom && (
          <div className="border-t border-zinc-800 pt-6">
            <div className="flex items-center gap-2 mb-4">
              <Heart className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium text-amber-400">Wisdom Mode Options</span>
            </div>

            <div className="space-y-4">
              <WisdomFormatSelector
                value={wisdomFormat}
                onChange={setWisdomFormat}
                disabled={busy}
              />
              <WisdomToneSelector
                value={wisdomTone}
                onChange={setWisdomTone}
                disabled={busy}
              />
              <WisdomDemographicSelector
                value={wisdomDemographic}
                onChange={setWisdomDemographic}
                disabled={busy}
              />
              <WisdomSettingSelector
                value={wisdomSetting}
                onChange={setWisdomSetting}
                disabled={busy}
              />
            </div>
          </div>
        )}

        {isStudio && (
          <div className="border-t border-zinc-800 pt-6">
            <div className="flex items-center gap-2 mb-4">
              <Film className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium text-amber-400">Studio Setup</span>
            </div>

            <div className="space-y-4">
              <StudioSetupSelector
                value={studioSetup}
                onChange={setStudioSetup}
                disabled={busy}
              />
              <StudioLightingSelector
                value={studioLighting}
                onChange={setStudioLighting}
                disabled={busy}
              />
            </div>
          </div>
        )}

        {isSubway && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setBatchMode(!batchMode)}
                disabled={busy}
                aria-label="Toggle batch mode for generating multiple clips"
                aria-pressed={batchMode}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  batchMode ? 'bg-amber-500' : 'bg-zinc-700'
                } ${busy ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                    batchMode ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <div>
                <span className="text-sm font-medium text-zinc-200">Generate Series</span>
                <p className="text-xs text-zinc-500">Create multiple clips at once</p>
              </div>
            </div>

            {batchMode && (
              <div className="flex gap-2">
                {BATCH_SIZE_OPTIONS.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setBatchSize(size)}
                    disabled={busy}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition-all ${
                      batchSize === size
                        ? 'bg-amber-500/15 border-amber-500/50 text-amber-400'
                        : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                    } ${busy ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {size} clips
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {isMotivational && (
          <div className="border-t border-zinc-800 pt-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
              <span className="text-sm font-medium text-red-400">Motivational Speaker Options</span>
            </div>

            <div className="space-y-5">
              <SpeakerStyleSelector
                value={speakerStyle}
                onChange={setSpeakerStyle}
                disabled={busy}
              />

              <MotivationalSettingSelector
                value={motivationalSetting}
                onChange={setMotivationalSetting}
                disabled={busy}
              />

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <CameraStyleSelector
                  value={cameraStyle}
                  onChange={setCameraStyle}
                  disabled={busy}
                />
                <LightingMoodSelector
                  value={lightingMood}
                  onChange={setLightingMood}
                  disabled={busy}
                />
              </div>
            </div>

            {/* Motivational Enhancements Section */}
            <div className="border-t border-zinc-800 pt-6 mt-6">
              <button
                type="button"
                onClick={() => setShowMotivationalEnhancements(!showMotivationalEnhancements)}
                disabled={busy}
                className="flex items-center gap-2 text-sm font-medium text-red-400 hover:text-red-300 transition-colors mb-4"
              >
                <Flame className="h-4 w-4" />
                <span>Motivational Enhancements</span>
                {showMotivationalEnhancements ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>

              {showMotivationalEnhancements && (
                <div className="space-y-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
                  {/* 1. Transformation Arc */}
                  <TransformationArcBuilder
                    value={transformationArc}
                    onChange={setTransformationArc}
                    disabled={busy}
                  />

                  {/* 2. Audience Energy */}
                  <div className="border-t border-zinc-800 pt-4">
                    <AudienceEnergyPanel
                      value={audienceEnergy}
                      onChange={setAudienceEnergy}
                      disabled={busy}
                    />
                  </div>

                  {/* 3. Motivational Soundscape */}
                  <div className="border-t border-zinc-800 pt-4">
                    <MotivationalSoundscape
                      value={motivationalSoundscape}
                      onChange={setMotivationalSoundscape}
                      disabled={busy}
                    />
                  </div>

                  {/* 4. Breakthrough Moment */}
                  <div className="border-t border-zinc-800 pt-4">
                    <BreakthroughMomentSelector
                      value={breakthroughMoment}
                      onChange={setBreakthroughMoment}
                      disabled={busy}
                      maxDuration={duration}
                    />
                  </div>

                  {/* 5. Event Energy Arc */}
                  <div className="border-t border-zinc-800 pt-4">
                    <EventEnergyArc
                      value={eventEnergyArc}
                      onChange={setEventEnergyArc}
                      disabled={busy}
                    />
                  </div>

                  {/* 6. Live Challenge */}
                  <div className="border-t border-zinc-800 pt-4">
                    <LiveChallengeSelector
                      value={liveChallenge}
                      onChange={setLiveChallenge}
                      disabled={busy}
                      maxDuration={duration}
                    />
                  </div>

                  {/* 7. Speaker Archetype */}
                  <div className="border-t border-zinc-800 pt-4">
                    <SpeakerArchetypeSelector
                      value={speakerArchetype}
                      onChange={setSpeakerArchetype}
                      disabled={busy}
                    />
                  </div>

                  {/* 8. Pause for Effect */}
                  <div className="border-t border-zinc-800 pt-4">
                    <PauseForEffect
                      value={pauseForEffect}
                      onChange={setPauseForEffect}
                      disabled={busy}
                      maxDuration={duration}
                    />
                  </div>

                  {/* 9. Achievement Context */}
                  <div className="border-t border-zinc-800 pt-4">
                    <AchievementContextSelector
                      value={achievementContext}
                      onChange={setAchievementContext}
                      disabled={busy}
                    />
                  </div>

                  {/* 10. CTA Pivot */}
                  <div className="border-t border-zinc-800 pt-4">
                    <CTAPivot
                      value={ctaPivot}
                      onChange={setCtaPivot}
                      disabled={busy}
                      maxDuration={duration}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {isStreet && (
          <div className="border-t border-zinc-800 pt-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-sm font-medium text-emerald-400">Street Interview Options</span>
            </div>

            <div className="space-y-5">
              <StreetSceneSelector
                value={streetScene}
                onChange={setStreetScene}
                disabled={busy}
              />

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <InterviewStyleSelector
                  value={interviewStyle}
                  onChange={setInterviewStyle}
                  disabled={busy}
                />
                <TimeOfDaySelector
                  value={timeOfDay}
                  onChange={setTimeOfDay}
                  disabled={busy}
                />
              </div>

              <EnergyLevelSelector
                value={energyLevel}
                onChange={setEnergyLevel}
              />
            </div>

            {/* Street Interview Enhancements Section */}
            <div className="border-t border-zinc-800 pt-6 mt-6">
              <button
                type="button"
                onClick={() => setShowStreetEnhancements(!showStreetEnhancements)}
                disabled={busy}
                className="flex items-center gap-2 text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors mb-4"
              >
                <MapPin className="h-4 w-4" />
                <span>Street Interview Enhancements</span>
                {showStreetEnhancements ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>

              {showStreetEnhancements && (
                <div className="space-y-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
                  {/* 7. Neighborhood Selector */}
                  <NeighborhoodSelector
                    value={neighborhood}
                    onChange={setNeighborhood}
                    disabled={busy}
                  />

                  {/* 1. Multi-Location Journey */}
                  <div className="border-t border-zinc-800 pt-4">
                    <StreetJourneyBuilder
                      value={streetMultiLocationJourney}
                      onChange={setStreetMultiLocationJourney}
                      disabled={busy}
                    />
                  </div>

                  {/* 2. Street Crowd Dynamics */}
                  <div className="border-t border-zinc-800 pt-4">
                    <StreetCrowdPanel
                      value={streetCrowdConfig}
                      onChange={setStreetCrowdConfig}
                      disabled={busy}
                    />
                  </div>

                  {/* 3. Urban Soundscape */}
                  <div className="border-t border-zinc-800 pt-4">
                    <UrbanSoundscapeSelector
                      value={urbanSoundscape}
                      onChange={setUrbanSoundscape}
                      disabled={busy}
                    />
                  </div>

                  {/* 4. Street Plot Twist */}
                  <div className="border-t border-zinc-800 pt-4">
                    <StreetPlotTwistSelector
                      value={streetPlotTwist}
                      onChange={setStreetPlotTwist}
                      disabled={busy}
                      maxDuration={duration}
                    />
                  </div>

                  {/* 6. Street Poll */}
                  <div className="border-t border-zinc-800 pt-4">
                    <StreetPoll
                      value={streetPoll}
                      onChange={setStreetPoll}
                      disabled={busy}
                    />
                  </div>

                  {/* 8. Street Dramatic Moment */}
                  <div className="border-t border-zinc-800 pt-4">
                    <StreetDramaticMoment
                      value={streetDramaticMoment}
                      onChange={setStreetDramaticMoment}
                      disabled={busy}
                      maxDuration={duration}
                    />
                  </div>

                  {/* 9. Street Seasonal Context */}
                  <div className="border-t border-zinc-800 pt-4">
                    <StreetSeasonalSelector
                      value={streetSeasonalContext}
                      onChange={setStreetSeasonalContext}
                      disabled={busy}
                    />
                  </div>

                  {/* 10. Cross-Street Pivot */}
                  <div className="border-t border-zinc-800 pt-4">
                    <CrossStreetPivot
                      value={crossStreetPivot}
                      onChange={setCrossStreetPivot}
                      disabled={busy}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {isInterview && (
          <div className="border-t border-zinc-800 pt-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-4 w-4 text-sky-500" />
              <span className="text-sm font-medium text-sky-400">Characters</span>
            </div>

            <div className="space-y-5">
              <CharacterPresetSelector
                value={characterPreset}
                onChange={handlePresetChange}
                disabled={busy}
              />

              <button
                type="button"
                onClick={() => {
                  setShowCharacterDetails(!showCharacterDetails);
                  if (!showCharacterDetails) {
                    setCharacterPreset('custom');
                  }
                }}
                disabled={busy}
                className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-300 transition-colors disabled:opacity-50"
              >
                {showCharacterDetails ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                {showCharacterDetails ? 'Hide' : 'Customize'} interviewer & subject details
              </button>

              {showCharacterDetails && (
                <div className="space-y-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
                  <div>
                    <h4 className="text-sm font-medium text-amber-400 mb-4">Interviewer</h4>
                    <InterviewerSelector
                      type={interviewerType}
                      position={interviewerPosition}
                      onTypeChange={setInterviewerType}
                      onPositionChange={setInterviewerPosition}
                      disabled={busy}
                    />
                  </div>

                  <div className="border-t border-zinc-800 pt-5">
                    <h4 className="text-sm font-medium text-emerald-400 mb-4">Subject (Interviewee)</h4>
                    <SubjectSelector
                      demographic={subjectDemographic}
                      gender={subjectGender}
                      style={subjectStyle}
                      onDemographicChange={setSubjectDemographic}
                      onGenderChange={setSubjectGender}
                      onStyleChange={setSubjectStyle}
                      disabled={busy}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {isSubway && (
          <>
            <div className="border-t border-zinc-800 pt-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                <span className="text-sm font-medium text-amber-400">Subway Interview Options</span>
              </div>

              <div className="space-y-5">
                <QuestionInput
                  value={interviewQuestion}
                  onChange={setInterviewQuestion}
                />

                <SceneTypeSelector
                  value={sceneType}
                  onChange={setSceneType}
                />

                <CityStyleSelector
                  value={cityStyle}
                  onChange={setCityStyle}
                />

                <EnergyLevelSelector
                  value={energyLevel}
                  onChange={setEnergyLevel}
                />

                <InterviewStyleSelector
                  value={interviewStyle}
                  onChange={setInterviewStyle}
                  disabled={busy}
                />

                {/* Subway Line Selector */}
                <SubwayLineSelector
                  value={subwayLine}
                  onChange={setSubwayLine}
                  disabled={busy}
                />
              </div>
            </div>

            {/* Subway Enhancements Section */}
            <div className="border-t border-zinc-800 pt-6">
              <button
                type="button"
                onClick={() => setShowEnhancements(!showEnhancements)}
                disabled={busy}
                className="flex items-center gap-2 text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors mb-4"
              >
                <Sparkles className="h-4 w-4" />
                <span>Subway Enhancements</span>
                {showEnhancements ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>

              {showEnhancements && (
                <div className="space-y-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
                  {/* 1. Multi-Stop Journey */}
                  <JourneyBuilder
                    value={multiStopJourney}
                    onChange={setMultiStopJourney}
                    disabled={busy}
                  />

                  {/* 2. Crowd Reactions */}
                  <div className="border-t border-zinc-800 pt-4">
                    <CrowdReactionPanel
                      value={crowdReactions}
                      onChange={setCrowdReactions}
                      disabled={busy}
                    />
                  </div>

                  {/* 3. Soundscape */}
                  <div className="border-t border-zinc-800 pt-4">
                    <SoundscapeSelector
                      value={soundscape}
                      onChange={setSoundscape}
                      disabled={busy}
                    />
                  </div>

                  {/* 4. Plot Twist */}
                  <div className="border-t border-zinc-800 pt-4">
                    <PlotTwistSelector
                      value={plotTwist}
                      onChange={setPlotTwist}
                      disabled={busy}
                      maxDuration={duration}
                    />
                  </div>

                  {/* 6. Platform Poll */}
                  <div className="border-t border-zinc-800 pt-4">
                    <PlatformPoll
                      value={platformPoll}
                      onChange={setPlatformPoll}
                      disabled={busy}
                    />
                  </div>

                  {/* 8. Train Arrival Timer */}
                  <div className="border-t border-zinc-800 pt-4">
                    <TrainArrivalTimer
                      value={trainArrival}
                      onChange={setTrainArrival}
                      disabled={busy}
                      selectedLine={subwayLine}
                    />
                  </div>

                  {/* 9. Seasonal Context */}
                  <div className="border-t border-zinc-800 pt-4">
                    <SeasonalContextSelector
                      value={seasonalContext}
                      onChange={setSeasonalContext}
                      disabled={busy}
                    />
                  </div>

                  {/* 10. Transfer Point */}
                  <div className="border-t border-zinc-800 pt-4">
                    <TransferPointBuilder
                      value={transferPoint}
                      onChange={setTransferPoint}
                      disabled={busy}
                      currentLine={subwayLine}
                    />
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        <div className="border-t border-zinc-800 pt-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
            <span className="text-sm font-medium text-cyan-400">AI Model Settings</span>
          </div>

          <div className="space-y-5">
            <ModelTierSelector
              value={modelTier}
              onChange={setModelTier}
              disabled={busy}
            />

            {isInterview && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-zinc-300">
                  Speech Script (optional)
                </label>
                <textarea
                  value={speechScript}
                  onChange={(e) => setSpeechScript(e.target.value)}
                  disabled={busy}
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

        {/* NEW FEATURES - Advanced Options Section */}
        <div className="border-t border-zinc-800 pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-medium text-purple-400">Advanced Options</span>
          </div>

          <div className="space-y-6">
            {/* Interview Format & Duration */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InterviewFormatSelector
                value={interviewFormat}
                onChange={setInterviewFormat}
                disabled={busy}
              />
              <DurationSelector
                value={durationPreset}
                onChange={setDurationPreset}
                disabled={busy}
              />
            </div>

            {/* Language & Niche */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <LanguageSelector
                value={language}
                onChange={setLanguage}
                disabled={busy}
              />
              <NicheSelector
                value={niche}
                onChange={setNiche}
                disabled={busy}
              />
            </div>

            {/* Captions & Export */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <CaptionStyleSelector
                value={captionStyle}
                onChange={setCaptionStyle}
                disabled={busy}
              />
              <PlatformExportSelector
                value={exportPlatforms}
                onChange={setExportPlatforms}
                disabled={busy}
              />
            </div>

            {/* Product Placement */}
            <ProductPlacementPanel
              config={productPlacement}
              onChange={setProductPlacement}
              disabled={busy}
            />

            {/* Keyword Generator */}
            <KeywordGenerator
              keyword={keyword}
              onKeywordChange={setKeyword}
              niche={niche}
              onNicheChange={setNiche}
              onGenerate={() => {
                setIsGeneratingKeywords(true);
                // Reset after a brief delay since generation is synchronous
                setTimeout(() => setIsGeneratingKeywords(false), 0);
              }}
              isGenerating={isGeneratingKeywords}
              disabled={busy}
            />
          </div>
        </div>

        <AngleInput
          value={angle}
          placeholder={getPlaceholderText(clipType)}
          onChange={setAngle}
          disabled={busy}
          label="Additional Direction (optional)"
        />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-2">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={busy}
            className="flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-6 py-3.5 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {batchMode ? (
              <>
                <Layers className="h-4 w-4" />
                {busy ? 'Working...' : `Generate ${batchSize} Clips`}
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                {busy ? 'Working...' : 'Generate Clip'}
              </>
            )}
          </button>

          <p className="text-sm text-zinc-500">
            Vertical 9:16 | {batchMode ? `${batchSize} clip series` : 'Single clip'}
          </p>
        </div>

        {status !== 'idle' && (
          <StatusCard
            status={status === 'planning' ? 'planning' : status === 'generating' ? 'generating' : status === 'error' ? 'error' : 'done'}
            message={errorMessage || undefined}
          />
        )}
      </div>

      <p className="mt-6 text-xs text-zinc-600">
        {isMotivational
          ? 'Cinematic motivational speaker clips. Choose your speaker style, setting, and camera work for maximum impact.'
          : isStreet
          ? 'Street interview clips. Pick your scene, style, and time of day for authentic vox pop content.'
          : isWisdom
          ? 'Wisdom interview clips for 55+ audience. Life lessons, retirement advice, and heartfelt conversations.'
          : isStudio
          ? 'Professional studio interview clips. Configure your set, lighting, and guest setup for polished content.'
          : 'SubwayTakes-style viral clips. Pick a trending question and scene for maximum engagement.'}
      </p>
      {/* Effects Customization Modal */}
      <EffectsCustomizeModal
        isOpen={showEffectsModal}
        onClose={() => setShowEffectsModal(false)}
        clipType={clipType}
        effects={effects}
        onSave={(newEffects) => {
          setEffects(newEffects);
          setShowEffectsModal(false);
        }}
      />
    </div>
  );
}
