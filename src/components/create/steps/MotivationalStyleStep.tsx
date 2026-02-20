import { Sparkles, Users2, Volume2, Target, Activity, Swords, UserCheck, Pause, Award, Megaphone } from 'lucide-react';
import type { ClipCreationHook } from '../../../hooks/useClipCreation';
import { EnhancementToggleCard, useAccordion } from '../EnhancementToggleCard';
import { SpeakerStyleSelector } from '../../SpeakerStyleSelector';
import { MotivationalSettingSelector } from '../../MotivationalSettingSelector';
import { CameraStyleSelector } from '../../CameraStyleSelector';
import { LightingMoodSelector } from '../../LightingMoodSelector';
import { TransformationArcBuilder } from '../../TransformationArcBuilder';
import { AudienceEnergyPanel } from '../../AudienceEnergyPanel';
import { MotivationalSoundscape } from '../../MotivationalSoundscape';
import { BreakthroughMomentSelector } from '../../BreakthroughMomentSelector';
import { EventEnergyArc } from '../../EventEnergyArc';
import { LiveChallengeSelector } from '../../LiveChallengeSelector';
import { SpeakerArchetypeSelector } from '../../SpeakerArchetypeSelector';
import { PauseForEffect } from '../../PauseForEffect';
import { AchievementContextSelector } from '../../AchievementContextSelector';
import { CTAPivot } from '../../CTAPivot';
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
} from '../../../lib/types';

interface MotivationalStyleStepProps {
  clip: ClipCreationHook;
  speakerStyle: SpeakerStyle;
  setSpeakerStyle: (v: SpeakerStyle) => void;
  motivationalSetting: MotivationalSetting;
  setMotivationalSetting: (v: MotivationalSetting) => void;
  cameraStyle: CameraStyle;
  setCameraStyle: (v: CameraStyle) => void;
  lightingMood: LightingMood;
  setLightingMood: (v: LightingMood) => void;
  transformationArc: TransformationArc | undefined;
  setTransformationArc: (v: TransformationArc | undefined) => void;
  audienceEnergy: AudienceEnergyConfig | undefined;
  setAudienceEnergy: (v: AudienceEnergyConfig | undefined) => void;
  motivationalSoundscape: MotivationalSoundscapeConfig | undefined;
  setMotivationalSoundscape: (v: MotivationalSoundscapeConfig | undefined) => void;
  breakthroughMoment: BreakthroughMoment | undefined;
  setBreakthroughMoment: (v: BreakthroughMoment | undefined) => void;
  eventEnergyArc: EventEnergyArcConfig | undefined;
  setEventEnergyArc: (v: EventEnergyArcConfig | undefined) => void;
  liveChallenge: LiveChallenge | undefined;
  setLiveChallenge: (v: LiveChallenge | undefined) => void;
  speakerArchetype: SpeakerArchetypeConfig | undefined;
  setSpeakerArchetype: (v: SpeakerArchetypeConfig | undefined) => void;
  pauseForEffect: PauseForEffectConfig | undefined;
  setPauseForEffect: (v: PauseForEffectConfig | undefined) => void;
  achievementContext: AchievementContext | undefined;
  setAchievementContext: (v: AchievementContext | undefined) => void;
  ctaPivot: CTAPivotConfig | undefined;
  setCtaPivot: (v: CTAPivotConfig | undefined) => void;
}

export function MotivationalStyleStep({
  clip,
  speakerStyle,
  setSpeakerStyle,
  motivationalSetting,
  setMotivationalSetting,
  cameraStyle,
  setCameraStyle,
  lightingMood,
  setLightingMood,
  transformationArc,
  setTransformationArc,
  audienceEnergy,
  setAudienceEnergy,
  motivationalSoundscape,
  setMotivationalSoundscape,
  breakthroughMoment,
  setBreakthroughMoment,
  eventEnergyArc,
  setEventEnergyArc,
  liveChallenge,
  setLiveChallenge,
  speakerArchetype,
  setSpeakerArchetype,
  pauseForEffect,
  setPauseForEffect,
  achievementContext,
  setAchievementContext,
  ctaPivot,
  setCtaPivot,
}: MotivationalStyleStepProps) {
  const accordion = useAccordion();

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 space-y-5">
        <SpeakerStyleSelector value={speakerStyle} onChange={setSpeakerStyle} disabled={clip.busy} />
        <MotivationalSettingSelector value={motivationalSetting} onChange={setMotivationalSetting} disabled={clip.busy} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <CameraStyleSelector value={cameraStyle} onChange={setCameraStyle} disabled={clip.busy} />
          <LightingMoodSelector value={lightingMood} onChange={setLightingMood} disabled={clip.busy} />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-zinc-400 mb-3">Enhancements</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <EnhancementToggleCard
            icon={Sparkles}
            title="Transformation Arc"
            enabled={!!transformationArc?.enabled}
            onToggle={(on) => setTransformationArc(on ? { enabled: true } as TransformationArc : undefined)}
            disabled={clip.busy}
            accentColor="red"
            isOpen={accordion.isOpen('arc')}
            onOpenChange={accordion.onOpenChange('arc')}
          >
            <TransformationArcBuilder value={transformationArc} onChange={setTransformationArc} disabled={clip.busy} />
          </EnhancementToggleCard>

          <EnhancementToggleCard
            icon={Users2}
            title="Audience Energy"
            enabled={!!audienceEnergy?.enabled}
            onToggle={(on) => setAudienceEnergy(on ? { enabled: true } as AudienceEnergyConfig : undefined)}
            disabled={clip.busy}
            accentColor="red"
            isOpen={accordion.isOpen('audience')}
            onOpenChange={accordion.onOpenChange('audience')}
          >
            <AudienceEnergyPanel value={audienceEnergy} onChange={setAudienceEnergy} disabled={clip.busy} />
          </EnhancementToggleCard>

          <EnhancementToggleCard
            icon={Volume2}
            title="Soundscape"
            enabled={!!motivationalSoundscape?.enabled}
            onToggle={(on) => setMotivationalSoundscape(on ? { enabled: true } as MotivationalSoundscapeConfig : undefined)}
            disabled={clip.busy}
            accentColor="red"
            isOpen={accordion.isOpen('sound')}
            onOpenChange={accordion.onOpenChange('sound')}
          >
            <MotivationalSoundscape value={motivationalSoundscape} onChange={setMotivationalSoundscape} disabled={clip.busy} />
          </EnhancementToggleCard>

          <EnhancementToggleCard
            icon={Target}
            title="Breakthrough Moment"
            enabled={!!breakthroughMoment?.enabled}
            onToggle={(on) => setBreakthroughMoment(on ? { enabled: true } as BreakthroughMoment : undefined)}
            disabled={clip.busy}
            accentColor="red"
            isOpen={accordion.isOpen('breakthrough')}
            onOpenChange={accordion.onOpenChange('breakthrough')}
          >
            <BreakthroughMomentSelector value={breakthroughMoment} onChange={setBreakthroughMoment} disabled={clip.busy} maxDuration={clip.duration} />
          </EnhancementToggleCard>

          <EnhancementToggleCard
            icon={Activity}
            title="Energy Arc"
            enabled={!!eventEnergyArc?.enabled}
            onToggle={(on) => setEventEnergyArc(on ? { enabled: true } as EventEnergyArcConfig : undefined)}
            disabled={clip.busy}
            accentColor="red"
            isOpen={accordion.isOpen('energy')}
            onOpenChange={accordion.onOpenChange('energy')}
          >
            <EventEnergyArc value={eventEnergyArc} onChange={setEventEnergyArc} disabled={clip.busy} />
          </EnhancementToggleCard>

          <EnhancementToggleCard
            icon={Swords}
            title="Live Challenge"
            enabled={!!liveChallenge?.enabled}
            onToggle={(on) => setLiveChallenge(on ? { enabled: true } as LiveChallenge : undefined)}
            disabled={clip.busy}
            accentColor="red"
            isOpen={accordion.isOpen('challenge')}
            onOpenChange={accordion.onOpenChange('challenge')}
          >
            <LiveChallengeSelector value={liveChallenge} onChange={setLiveChallenge} disabled={clip.busy} maxDuration={clip.duration} />
          </EnhancementToggleCard>

          <EnhancementToggleCard
            icon={UserCheck}
            title="Speaker Archetype"
            enabled={!!speakerArchetype?.enabled}
            onToggle={(on) => setSpeakerArchetype(on ? { enabled: true } as SpeakerArchetypeConfig : undefined)}
            disabled={clip.busy}
            accentColor="red"
            isOpen={accordion.isOpen('archetype')}
            onOpenChange={accordion.onOpenChange('archetype')}
          >
            <SpeakerArchetypeSelector value={speakerArchetype} onChange={setSpeakerArchetype} disabled={clip.busy} />
          </EnhancementToggleCard>

          <EnhancementToggleCard
            icon={Pause}
            title="Pause for Effect"
            enabled={!!pauseForEffect?.enabled}
            onToggle={(on) => setPauseForEffect(on ? { enabled: true } as PauseForEffectConfig : undefined)}
            disabled={clip.busy}
            accentColor="red"
            isOpen={accordion.isOpen('pause')}
            onOpenChange={accordion.onOpenChange('pause')}
          >
            <PauseForEffect value={pauseForEffect} onChange={setPauseForEffect} disabled={clip.busy} maxDuration={clip.duration} />
          </EnhancementToggleCard>

          <EnhancementToggleCard
            icon={Award}
            title="Achievement Context"
            enabled={!!achievementContext?.enabled}
            onToggle={(on) => setAchievementContext(on ? { enabled: true } as AchievementContext : undefined)}
            disabled={clip.busy}
            accentColor="red"
            isOpen={accordion.isOpen('achievement')}
            onOpenChange={accordion.onOpenChange('achievement')}
          >
            <AchievementContextSelector value={achievementContext} onChange={setAchievementContext} disabled={clip.busy} />
          </EnhancementToggleCard>

          <EnhancementToggleCard
            icon={Megaphone}
            title="CTA Pivot"
            enabled={!!ctaPivot?.enabled}
            onToggle={(on) => setCtaPivot(on ? { enabled: true } as CTAPivotConfig : undefined)}
            disabled={clip.busy}
            accentColor="red"
            isOpen={accordion.isOpen('cta')}
            onOpenChange={accordion.onOpenChange('cta')}
          >
            <CTAPivot value={ctaPivot} onChange={setCtaPivot} disabled={clip.busy} maxDuration={clip.duration} />
          </EnhancementToggleCard>
        </div>
      </div>
    </div>
  );
}
