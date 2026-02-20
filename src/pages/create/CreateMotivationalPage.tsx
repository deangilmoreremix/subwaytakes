import { useState } from 'react';
import { Flame, ChevronDown, ChevronUp } from 'lucide-react';
import { useClipCreation } from '../../hooks/useClipCreation';
import {
  PageHeader,
  KeywordSection,
  TopicDurationRow,
  ModelSection,
  AdvancedOptionsSection,
  GenerateSection,
  EffectsModal,
} from '../../components/create/CommonCreateSections';
import { SpeakerStyleSelector } from '../../components/SpeakerStyleSelector';
import { MotivationalSettingSelector } from '../../components/MotivationalSettingSelector';
import { CameraStyleSelector } from '../../components/CameraStyleSelector';
import { LightingMoodSelector } from '../../components/LightingMoodSelector';
import { TransformationArcBuilder } from '../../components/TransformationArcBuilder';
import { AudienceEnergyPanel } from '../../components/AudienceEnergyPanel';
import { MotivationalSoundscape } from '../../components/MotivationalSoundscape';
import { BreakthroughMomentSelector } from '../../components/BreakthroughMomentSelector';
import { EventEnergyArc } from '../../components/EventEnergyArc';
import { LiveChallengeSelector } from '../../components/LiveChallengeSelector';
import { SpeakerArchetypeSelector } from '../../components/SpeakerArchetypeSelector';
import { PauseForEffect } from '../../components/PauseForEffect';
import { AchievementContextSelector } from '../../components/AchievementContextSelector';
import { CTAPivot } from '../../components/CTAPivot';
import type {
  SpeakerStyle,
  MotivationalSetting,
  CameraStyle,
  LightingMood,
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
} from '../../lib/types';

export function CreateMotivationalPage() {
  const clip = useClipCreation('motivational');

  const [speakerStyle, setSpeakerStyle] = useState<SpeakerStyle>('intense_coach');
  const [motivationalSetting, setMotivationalSetting] = useState<MotivationalSetting>('gym');
  const [cameraStyle, setCameraStyle] = useState<CameraStyle>('dramatic_push');
  const [lightingMood, setLightingMood] = useState<LightingMood>('dramatic_shadows');

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
  const [showEnhancements, setShowEnhancements] = useState(false);

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
      transformationArc, audienceEnergy,
      soundscape: motivationalSoundscape,
      breakthroughMoment, eventEnergyArc, liveChallenge,
      speakerArchetype, pauseForEffect, achievementContext, ctaPivot,
    };
  }

  function handleGenerate() {
    clip.generateClip({
      speakerStyle,
      motivationalSetting,
      cameraStyle,
      lightingMood,
      motivationalEnhancements: buildMotivationalEnhancements(),
    });
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader
        title="Motivational"
        description="One prompt generates a single 2-8 second clip. Cinematic motivational speaker clips with dramatic camera work."
        clip={clip}
      />

      <KeywordSection clip={clip} />

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 space-y-6">
        <TopicDurationRow clip={clip} />

        <div className="border-t border-zinc-800 pt-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
            <span className="text-sm font-medium text-red-400">Motivational Speaker Options</span>
          </div>
          <div className="space-y-5">
            <SpeakerStyleSelector value={speakerStyle} onChange={setSpeakerStyle} disabled={clip.busy} />
            <MotivationalSettingSelector value={motivationalSetting} onChange={setMotivationalSetting} disabled={clip.busy} />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <CameraStyleSelector value={cameraStyle} onChange={setCameraStyle} disabled={clip.busy} />
              <LightingMoodSelector value={lightingMood} onChange={setLightingMood} disabled={clip.busy} />
            </div>
          </div>

          <div className="border-t border-zinc-800 pt-6 mt-6">
            <button
              type="button"
              onClick={() => setShowEnhancements(!showEnhancements)}
              disabled={clip.busy}
              className="flex items-center gap-2 text-sm font-medium text-red-400 hover:text-red-300 transition-colors mb-4"
            >
              <Flame className="h-4 w-4" />
              <span>Motivational Enhancements</span>
              {showEnhancements ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {showEnhancements && (
              <div className="space-y-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
                <TransformationArcBuilder value={transformationArc} onChange={setTransformationArc} disabled={clip.busy} />
                <div className="border-t border-zinc-800 pt-4">
                  <AudienceEnergyPanel value={audienceEnergy} onChange={setAudienceEnergy} disabled={clip.busy} />
                </div>
                <div className="border-t border-zinc-800 pt-4">
                  <MotivationalSoundscape value={motivationalSoundscape} onChange={setMotivationalSoundscape} disabled={clip.busy} />
                </div>
                <div className="border-t border-zinc-800 pt-4">
                  <BreakthroughMomentSelector value={breakthroughMoment} onChange={setBreakthroughMoment} disabled={clip.busy} maxDuration={clip.duration} />
                </div>
                <div className="border-t border-zinc-800 pt-4">
                  <EventEnergyArc value={eventEnergyArc} onChange={setEventEnergyArc} disabled={clip.busy} />
                </div>
                <div className="border-t border-zinc-800 pt-4">
                  <LiveChallengeSelector value={liveChallenge} onChange={setLiveChallenge} disabled={clip.busy} maxDuration={clip.duration} />
                </div>
                <div className="border-t border-zinc-800 pt-4">
                  <SpeakerArchetypeSelector value={speakerArchetype} onChange={setSpeakerArchetype} disabled={clip.busy} />
                </div>
                <div className="border-t border-zinc-800 pt-4">
                  <PauseForEffect value={pauseForEffect} onChange={setPauseForEffect} disabled={clip.busy} maxDuration={clip.duration} />
                </div>
                <div className="border-t border-zinc-800 pt-4">
                  <AchievementContextSelector value={achievementContext} onChange={setAchievementContext} disabled={clip.busy} />
                </div>
                <div className="border-t border-zinc-800 pt-4">
                  <CTAPivot value={ctaPivot} onChange={setCtaPivot} disabled={clip.busy} maxDuration={clip.duration} />
                </div>
              </div>
            )}
          </div>
        </div>

        <ModelSection clip={clip} showSpeechScript={false} />
        <AdvancedOptionsSection clip={clip} />
        <GenerateSection
          clip={clip}
          onGenerate={handleGenerate}
        />
      </div>

      <p className="mt-6 text-xs text-zinc-600">
        Cinematic motivational speaker clips. Choose your speaker style, setting, and camera work for maximum impact.
      </p>

      <EffectsModal clip={clip} />
    </div>
  );
}
