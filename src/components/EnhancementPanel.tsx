import { useState, useEffect } from 'react';
import {
  Sparkles,
  Type,
  Music,
  Volume2,
  Palette,
  MessageSquare,
  LayoutTemplate,
  ChevronDown,
  ChevronUp,
  Check,
  BarChart3,
} from 'lucide-react';
import { fetchTemplates, type VideoTemplate } from '../lib/templates';
import { supabase } from '../lib/supabase';
import type { ColorGradePreset, EndcardStyle, EnhancementConfig } from '../lib/types';

interface MusicTrack {
  id: string;
  name: string;
  mood: string;
  duration_seconds: number;
  bpm: number;
}

interface SoundEffect {
  id: string;
  name: string;
  category: string;
  duration_seconds: number;
}

interface EnhancementPanelProps {
  config: EnhancementConfig;
  onChange: (config: EnhancementConfig) => void;
  contentType: 'clip' | 'episode' | 'compilation';
}

const COLOR_GRADES: { value: ColorGradePreset; label: string; preview: string }[] = [
  { value: 'none', label: 'Original', preview: 'bg-zinc-700' },
  { value: 'warm', label: 'Warm', preview: 'bg-gradient-to-r from-amber-700 to-orange-600' },
  { value: 'cool', label: 'Cool', preview: 'bg-gradient-to-r from-blue-700 to-cyan-600' },
  { value: 'cinematic', label: 'Cinematic', preview: 'bg-gradient-to-r from-zinc-800 to-amber-900' },
  { value: 'vintage', label: 'Vintage', preview: 'bg-gradient-to-r from-yellow-800 to-amber-700' },
  { value: 'dramatic', label: 'Dramatic', preview: 'bg-gradient-to-r from-zinc-900 to-red-900' },
];

const ENDCARD_STYLES: { value: EndcardStyle; label: string; desc: string }[] = [
  { value: 'minimal', label: 'Minimal', desc: 'Clean fade with handle' },
  { value: 'branded', label: 'Branded', desc: 'Logo + handle overlay' },
  { value: 'cta', label: 'CTA', desc: 'Call-to-action card' },
  { value: 'subscribe', label: 'Subscribe', desc: 'Follow prompt card' },
];

const CAPTION_ANIMATIONS = [
  { value: 'static', label: 'Static' },
  { value: 'word_by_word', label: 'Word by Word' },
  { value: 'typewriter', label: 'Typewriter' },
  { value: 'karaoke', label: 'Karaoke' },
  { value: 'pop_up', label: 'Pop Up' },
] as const;

const LOWER_THIRD_STYLES = [
  { value: 'none', label: 'None' },
  { value: 'classic', label: 'Classic' },
  { value: 'modern', label: 'Modern' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'vintage', label: 'Vintage' },
] as const;

function SectionToggle({
  label,
  icon: Icon,
  enabled,
  onToggle,
  children,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  enabled: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          if (!enabled) onToggle();
          setExpanded(!expanded);
        }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!enabled) onToggle(); setExpanded(!expanded); } }}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/40 transition cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <Icon className="h-4 w-4 text-zinc-400" />
          <span className="text-sm font-medium text-zinc-200">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className={`relative w-9 h-5 rounded-full transition-colors ${
              enabled ? 'bg-amber-500' : 'bg-zinc-700'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                enabled ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
          {children && (
            expanded ? <ChevronUp className="h-4 w-4 text-zinc-500" /> : <ChevronDown className="h-4 w-4 text-zinc-500" />
          )}
        </div>
      </div>
      {expanded && enabled && children && (
        <div className="px-4 pb-4 pt-1 border-t border-zinc-800/50">
          {children}
        </div>
      )}
    </div>
  );
}

const MOOD_COLORS: Record<string, string> = {
  energetic: 'bg-red-500/20 text-red-300',
  calm: 'bg-cyan-500/20 text-cyan-300',
  dramatic: 'bg-orange-500/20 text-orange-300',
  inspiring: 'bg-amber-500/20 text-amber-300',
  cinematic: 'bg-blue-500/20 text-blue-300',
  playful: 'bg-emerald-500/20 text-emerald-300',
  tense: 'bg-rose-500/20 text-rose-300',
  neutral: 'bg-zinc-500/20 text-zinc-300',
};

const SFX_CATEGORY_COLORS: Record<string, string> = {
  subway: 'bg-blue-500/20 text-blue-300',
  street: 'bg-emerald-500/20 text-emerald-300',
  studio: 'bg-amber-500/20 text-amber-300',
  motivational: 'bg-orange-500/20 text-orange-300',
  wisdom: 'bg-cyan-500/20 text-cyan-300',
  transition: 'bg-zinc-500/20 text-zinc-300',
  stinger: 'bg-rose-500/20 text-rose-300',
};

export function EnhancementPanel({ config, onChange, contentType }: EnhancementPanelProps) {
  const [templates, setTemplates] = useState<VideoTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [musicTracks, setMusicTracks] = useState<MusicTrack[]>([]);
  const [soundEffects, setSoundEffects] = useState<SoundEffect[]>([]);

  useEffect(() => {
    fetchTemplates().then(setTemplates);
    supabase.from('music_tracks').select('id, name, mood, duration_seconds, bpm').order('name').then(({ data }) => {
      if (data) setMusicTracks(data);
    });
    supabase.from('sound_effects').select('id, name, category, duration_seconds').order('name').then(({ data }) => {
      if (data) setSoundEffects(data);
    });
  }, []);

  function update(partial: Partial<EnhancementConfig>) {
    onChange({ ...config, ...partial });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-5 w-5 text-amber-400" />
        <h3 className="text-base font-semibold text-zinc-100">Enhancements</h3>
      </div>

      {templates.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex items-center gap-2 mb-3">
            <LayoutTemplate className="h-4 w-4 text-zinc-400" />
            <span className="text-sm font-medium text-zinc-200">Template</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {templates.slice(0, 4).map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTemplateId(t.id === selectedTemplateId ? null : t.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition ${
                  selectedTemplateId === t.id
                    ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
                    : 'bg-zinc-800/60 border border-zinc-700 text-zinc-300 hover:border-zinc-600'
                }`}
              >
                {selectedTemplateId === t.id && <Check className="h-3 w-3" />}
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <SectionToggle
        label="Watermark"
        icon={Type}
        enabled={config.watermark}
        onToggle={() => update({ watermark: !config.watermark })}
      />

      <SectionToggle
        label="Lower Third"
        icon={MessageSquare}
        enabled={config.lowerThird}
        onToggle={() => update({ lowerThird: !config.lowerThird })}
      >
        <div className="space-y-3">
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Style</label>
            <div className="flex flex-wrap gap-1.5">
              {LOWER_THIRD_STYLES.filter(s => s.value !== 'none').map((style) => (
                <button
                  key={style.value}
                  onClick={() => update({ lowerThirdStyle: style.value as EnhancementConfig['lowerThirdStyle'] })}
                  className={`px-2.5 py-1 rounded-md text-xs transition ${
                    config.lowerThirdStyle === style.value
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600'
                  }`}
                >
                  {style.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Name</label>
              <input
                type="text"
                value={config.lowerThirdName}
                onChange={(e) => update({ lowerThirdName: e.target.value })}
                placeholder={contentType === 'episode' ? 'Host Name' : 'Speaker'}
                className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Title</label>
              <input
                type="text"
                value={config.lowerThirdTitle}
                onChange={(e) => update({ lowerThirdTitle: e.target.value })}
                placeholder="Title or role"
                className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </SectionToggle>

      <SectionToggle
        label="Captions"
        icon={MessageSquare}
        enabled={config.captions}
        onToggle={() => update({ captions: !config.captions })}
      >
        <div>
          <label className="text-xs text-zinc-500 mb-1.5 block">Animation</label>
          <div className="flex flex-wrap gap-1.5">
            {CAPTION_ANIMATIONS.map((anim) => (
              <button
                key={anim.value}
                onClick={() => update({ captionAnimation: anim.value as EnhancementConfig['captionAnimation'] })}
                className={`px-2.5 py-1 rounded-md text-xs transition ${
                  config.captionAnimation === anim.value
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600'
                }`}
              >
                {anim.label}
              </button>
            ))}
          </div>
        </div>
      </SectionToggle>

      <SectionToggle
        label="Background Music"
        icon={Music}
        enabled={!!config.musicTrackId}
        onToggle={() => update({ musicTrackId: config.musicTrackId ? null : (musicTracks[0]?.id || 'default') })}
      >
        <div className="space-y-3">
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {musicTracks.map((track) => (
              <button
                key={track.id}
                onClick={() => update({ musicTrackId: track.id })}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition ${
                  config.musicTrackId === track.id
                    ? 'bg-amber-500/10 border border-amber-500/30'
                    : 'bg-zinc-800/40 border border-zinc-700 hover:border-zinc-600'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Music className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />
                  <div>
                    <span className="text-xs font-medium text-zinc-200 block">{track.name}</span>
                    <span className="text-[10px] text-zinc-500">{track.duration_seconds}s / {track.bpm} BPM</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${MOOD_COLORS[track.mood] || 'bg-zinc-700 text-zinc-400'}`}>
                    {track.mood}
                  </span>
                  {config.musicTrackId === track.id && <Check className="h-3 w-3 text-amber-400 flex-shrink-0" />}
                </div>
              </button>
            ))}
            {musicTracks.length === 0 && (
              <p className="text-xs text-zinc-500 text-center py-3">No music tracks available</p>
            )}
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1.5 block">Volume</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={100}
                value={config.musicVolume * 100}
                onChange={(e) => update({ musicVolume: Number(e.target.value) / 100 })}
                className="flex-1 h-1.5 rounded-full appearance-none bg-zinc-700 accent-amber-500"
              />
              <span className="text-xs text-zinc-400 w-8 text-right">{Math.round(config.musicVolume * 100)}%</span>
            </div>
          </div>
        </div>
      </SectionToggle>

      <SectionToggle
        label="Sound Effects"
        icon={Volume2}
        enabled={config.sfxEnabled}
        onToggle={() => update({ sfxEnabled: !config.sfxEnabled })}
      >
        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {soundEffects.map((sfx) => (
            <div
              key={sfx.id}
              className="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-800/40 border border-zinc-700"
            >
              <div className="flex items-center gap-2.5">
                <Volume2 className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />
                <div>
                  <span className="text-xs font-medium text-zinc-200 block">{sfx.name}</span>
                  <span className="text-[10px] text-zinc-500">{sfx.duration_seconds}s</span>
                </div>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${SFX_CATEGORY_COLORS[sfx.category] || 'bg-zinc-700 text-zinc-400'}`}>
                {sfx.category}
              </span>
            </div>
          ))}
          {soundEffects.length === 0 && (
            <p className="text-xs text-zinc-500 text-center py-3">No sound effects available</p>
          )}
        </div>
      </SectionToggle>

      <SectionToggle
        label="Color Grade"
        icon={Palette}
        enabled={config.colorGrade !== 'none'}
        onToggle={() => update({ colorGrade: config.colorGrade === 'none' ? 'cinematic' : 'none' })}
      >
        <div className="grid grid-cols-3 gap-2">
          {COLOR_GRADES.map((grade) => (
            <button
              key={grade.value}
              onClick={() => update({ colorGrade: grade.value })}
              className={`flex flex-col items-center gap-1.5 p-2 rounded-lg transition ${
                config.colorGrade === grade.value
                  ? 'ring-2 ring-amber-500/50 bg-zinc-800'
                  : 'bg-zinc-800/40 hover:bg-zinc-800'
              }`}
            >
              <div className={`w-full h-6 rounded ${grade.preview}`} />
              <span className="text-[10px] text-zinc-400">{grade.label}</span>
            </button>
          ))}
        </div>
      </SectionToggle>

      <SectionToggle
        label="End Card"
        icon={LayoutTemplate}
        enabled={config.endcard}
        onToggle={() => update({ endcard: !config.endcard })}
      >
        <div className="space-y-2">
          {ENDCARD_STYLES.map((style) => (
            <button
              key={style.value}
              onClick={() => update({ endcardStyle: style.value })}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition ${
                config.endcardStyle === style.value
                  ? 'bg-amber-500/10 border border-amber-500/30'
                  : 'bg-zinc-800/40 border border-zinc-700 hover:border-zinc-600'
              }`}
            >
              <div>
                <span className="text-xs font-medium text-zinc-200">{style.label}</span>
                <span className="text-[10px] text-zinc-500 ml-2">{style.desc}</span>
              </div>
              {config.endcardStyle === style.value && (
                <Check className="h-3 w-3 text-amber-400" />
              )}
            </button>
          ))}
        </div>
      </SectionToggle>

      <SectionToggle
        label="Progress Bar"
        icon={BarChart3}
        enabled={config.progressBar}
        onToggle={() => update({ progressBar: !config.progressBar })}
      />
    </div>
  );
}
