import { useState, useMemo, useEffect } from 'react';
import { Zap, Layers, ChevronDown, ChevronUp, Users } from 'lucide-react';
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
import {
  TOPICS,
  DURATION_OPTIONS,
  BATCH_SIZE_OPTIONS,
  getPlaceholderText,
  getDefaultDuration,
  CHARACTER_PRESETS,
} from '../lib/constants';
import { createClip, createClipBatch } from '../lib/clips';
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
  TimeOfDay,
  InterviewerType,
  InterviewerPosition,
  SubjectDemographic,
  SubjectGender,
  SubjectStyle,
  CharacterPreset,
} from '../lib/types';

interface CreatePageProps {
  onClipCreated: (clipId: string) => void;
}

type GenerationStatus = 'idle' | 'planning' | 'generating' | 'done' | 'error';

export function CreatePage({ onClipCreated }: CreatePageProps) {
  const [clipType, setClipType] = useState<ClipType>('subway_interview');
  const [topic, setTopic] = useState<string>(TOPICS.subway_interview[0]);
  const [duration, setDuration] = useState<number>(4);
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

  const topics = useMemo(() => TOPICS[clipType], [clipType]);
  const isSubway = clipType === 'subway_interview';
  const isStreet = clipType === 'street_interview';
  const isMotivational = clipType === 'motivational';
  const isInterview = isSubway || isStreet;

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
      };

      if (batchMode && isSubway) {
        const clips = await createClipBatch(options, batchSize);
        setStatus('generating');
        setTimeout(() => {
          onClipCreated(clips[0].id);
        }, 500);
      } else {
        const clip = await createClip(options);
        setStatus('generating');
        setTimeout(() => {
          onClipCreated(clip.id);
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

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 space-y-6">
        <ClipTypeSelector
          value={clipType}
          onChange={setClipType}
          disabled={busy}
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

        {isSubway && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setBatchMode(!batchMode)}
                disabled={busy}
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
              </div>
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

            {(isStreet || isSubway) && (
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
          : 'SubwayTakes-style viral clips. Pick a trending question and scene for maximum engagement.'}
      </p>
    </div>
  );
}
