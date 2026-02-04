import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Wand2, Sparkles, RefreshCw, Check, ChevronRight } from 'lucide-react';
import type { 
  RemotionEffectsConfig, 
  CaptionAnimation, 
  LowerThirdStyle, 
  IntroType, 
  OutroType,
  TransitionEffect,
  BackgroundType,
  ThumbnailStyle,
  ClipType,
} from '../lib/types';
import { getDefaultEffects } from '../lib/types';
import { EffectsPreview } from './EffectsPreview';

// Type-safe preset names
export type PresetName = 'Minimal' | 'Viral' | 'Professional' | 'Fun';

interface QuickPreset {
  name: PresetName;
  emoji: string;
  description: string;
}

const QUICK_PRESETS: QuickPreset[] = [
  { name: 'Minimal', emoji: '◻️', description: 'Clean & simple' },
  { name: 'Viral', emoji: '🔥', description: 'Maximum engagement' },
  { name: 'Professional', emoji: '🎬', description: 'Polished & serious' },
  { name: 'Fun', emoji: '😄', description: 'Playful & entertaining' },
];

const CAPTION_STYLES: { value: CaptionAnimation; label: string; icon: string; desc: string }[] = [
  { value: 'static', label: 'Static', icon: '📝', desc: 'Simple subtitles' },
  { value: 'word_by_word', label: 'Word Flow', icon: '✨', desc: 'Words appear one by one' },
  { value: 'typewriter', label: 'Typewriter', icon: '⌨️', desc: 'Typewriter effect' },
  { value: 'highlight', label: 'Highlight', icon: '💡', desc: 'Emphasize key words' },
  { value: 'karaoke', label: 'Karaoke', icon: '🎤', desc: 'Lyric style reveal' },
  { value: 'pop_up', label: 'Pop Up', icon: '💥', desc: 'Bouncy text' },
  { value: 'slide_in', label: 'Slide In', icon: '➡️', desc: 'Text slides in' },
];

const LOWER_THIRD_STYLES: { value: LowerThirdStyle; label: string; icon: string; desc: string }[] = [
  { value: 'none', label: 'None', icon: '🚫', desc: 'No overlay' },
  { value: 'classic', label: 'Classic', icon: '📺', desc: 'News style' },
  { value: 'modern', label: 'Modern', icon: '✨', desc: 'Clean & simple' },
  { value: 'minimal', label: 'Minimal', icon: '◻️', desc: 'Just the name' },
  { value: 'vintage', label: 'Vintage', icon: '📼', desc: 'Retro feel' },
];

const INTRO_TYPES: { value: IntroType; label: string; icon: string }[] = [
  { value: 'none', label: 'None', icon: '🚫' },
  { value: 'hook', label: 'Hook', icon: '🪝' },
  { value: 'title', label: 'Title', icon: '📛' },
  { value: 'branding', label: 'Branding', icon: '🏷️' },
  { value: 'countdown', label: 'Countdown', icon: '⏱️' },
];

const OUTRO_TYPES: { value: OutroType; label: string; icon: string }[] = [
  { value: 'none', label: 'None', icon: '🚫' },
  { value: 'cta', label: 'Call to Action', icon: '📣' },
  { value: 'subscribe', label: 'Subscribe', icon: '🔔' },
  { value: 'next_video', label: 'Next Video', icon: '▶️' },
  { value: 'branding', label: 'Branding', icon: '🏷️' },
];

const TRANSITIONS: { value: TransitionEffect; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'fade', label: 'Fade' },
  { value: 'slide', label: 'Slide' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'blur', label: 'Blur' },
  { value: 'dissolve', label: 'Dissolve' },
];

const BACKGROUND_TYPES: { value: BackgroundType; label: string; icon: string }[] = [
  { value: 'solid', label: 'Solid', icon: '🎨' },
  { value: 'gradient', label: 'Gradient', icon: '🌈' },
  { value: 'blur', label: 'Blur', icon: '💫' },
  { value: 'video_overlay', label: 'Video Overlay', icon: '🎬' },
];

const THUMBNAIL_STYLES: { value: ThumbnailStyle; label: string; icon: string; desc: string }[] = [
  { value: 'viral', label: 'Viral', icon: '🔥', desc: 'Attention-grabbing' },
  { value: 'quote', label: 'Quote', icon: '💬', desc: 'Text-focused' },
  { value: 'reaction', label: 'Reaction', icon: '😮', desc: 'Expression shot' },
  { value: 'title', label: 'Title', icon: '📛', desc: 'Clean title card' },
];

const GRADIENT_PRESETS = [
  { name: 'Sunset', colors: ['#FF6B6B', '#FFE66D'] },
  { name: 'Ocean', colors: ['#4FACFE', '#00F2FE'] },
  { name: 'Purple', colors: ['#667EEA', '#764BA2'] },
  { name: 'Forest', colors: ['#11998E', '#38EF7D'] },
  { name: 'Dark', colors: ['#232526', '#414345'] },
  { name: 'Neon', colors: ['#F093FB', '#F5576C'] },
];

interface EffectsCustomizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  clipType: ClipType;
  effects: RemotionEffectsConfig;
  onSave: (settings: RemotionEffectsConfig) => void;
}

export function EffectsCustomizeModal({ isOpen, onClose, clipType, effects, onSave }: EffectsCustomizeModalProps) {
  const [activeSection, setActiveSection] = useState<'captions' | 'lowerthird' | 'intros' | 'extras' | 'transitions' | 'background' | 'thumbnail'>('captions');
  const [localEffects, setLocalEffects] = useState<RemotionEffectsConfig>(effects);
  const [isDirty, setIsDirty] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Track if settings have been modified
  useEffect(() => {
    setLocalEffects(effects);
    setIsDirty(false);
  }, [effects]);

  // Update dirty state when localEffects changes
  useEffect(() => {
    const hasChanges = JSON.stringify(localEffects) !== JSON.stringify(effects);
    setIsDirty(hasChanges);
  }, [localEffects, effects]);

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      modalRef.current?.focus();
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  const handleTabKey = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const focusableElements = modalRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusableElements || focusableElements.length === 0) return;
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const handleApplyPreset = (presetName: PresetName) => {
    const baseEffects = getDefaultEffects(clipType);
    switch (presetName) {
      case 'Minimal':
        setLocalEffects({
          ...baseEffects,
          captions: { ...baseEffects.captions, enabled: true, animation: 'static' },
          lowerThird: { ...baseEffects.lowerThird, enabled: false },
          intro: { ...baseEffects.intro, enabled: false },
          outro: { ...baseEffects.outro, enabled: false },
          graphics: { enabled: false, progressBar: false, chapterMarkers: false, viralEmojis: false, soundWave: false },
        });
        break;
      case 'Viral':
        setLocalEffects({
          ...baseEffects,
          captions: { ...baseEffects.captions, animation: 'word_by_word' },
          lowerThird: { ...baseEffects.lowerThird, enabled: true, style: 'modern' },
          intro: { ...baseEffects.intro, enabled: true },
          graphics: { enabled: true, progressBar: true, chapterMarkers: true, viralEmojis: true, soundWave: false },
        });
        break;
      case 'Professional':
        setLocalEffects({
          ...baseEffects,
          captions: { ...baseEffects.captions, animation: 'static', fontSize: 28 },
          lowerThird: { ...baseEffects.lowerThird, enabled: true, style: 'classic', showName: true, showTitle: true, showRole: true },
          intro: { ...baseEffects.intro, enabled: true, type: 'title' },
          outro: { ...baseEffects.outro, enabled: true, type: 'subscribe' },
          graphics: { enabled: true, progressBar: false, chapterMarkers: false, viralEmojis: false, soundWave: false },
        });
        break;
      case 'Fun':
        setLocalEffects({
          ...baseEffects,
          captions: { ...baseEffects.captions, animation: 'pop_up' },
          lowerThird: { ...baseEffects.lowerThird, enabled: true, style: 'modern' },
          graphics: { enabled: true, progressBar: true, chapterMarkers: false, viralEmojis: true, soundWave: true },
        });
        break;
    }
  };

  const handleReset = () => {
    setLocalEffects(getDefaultEffects(clipType));
  };

  const handleFontSizeChange = (value: number) => {
    const clampedValue = Math.min(Math.max(value, 16), 72);
    setLocalEffects({
      ...localEffects,
      captions: { ...localEffects.captions, fontSize: clampedValue }
    });
  };

  const handleEmphasizeWordsChange = (value: string) => {
    const words = value.split(',').map(w => w.trim()).filter(Boolean);
    setLocalEffects({
      ...localEffects,
      captions: { ...localEffects.captions, emphasizeWords: words }
    });
  };

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div 
        ref={modalRef}
        className="bg-zinc-900 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden border border-zinc-700 focus:outline-none"
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === 'Tab') handleTabKey(e as unknown as KeyboardEvent);
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="effects-modal-title"
      >
        <div className="flex items-center justify-between p-4 border-b border-zinc-700">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h2 id="effects-modal-title" className="text-xl font-semibold text-white">Customize Effects</h2>
            {isDirty && (
              <span className="px-2 py-0.5 bg-blue-600/20 text-blue-400 text-xs font-medium rounded-full animate-pulse">
                Modified
              </span>
            )}
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        <div className="p-4 border-b border-zinc-700">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-purple-400" />
              <div className="text-sm font-medium text-purple-400">Quick Presets</div>
            </div>
            <button 
              onClick={handleReset}
              className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Reset to Default
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {QUICK_PRESETS.map((preset) => (
              <button
                key={preset.name}
                onClick={() => handleApplyPreset(preset.name)}
                className="p-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-center transition-all hover:scale-[1.02]"
              >
                <div className="text-2xl mb-1">{preset.emoji}</div>
                <div className="text-sm font-medium text-white">{preset.name}</div>
                <div className="text-xs text-zinc-400">{preset.description}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex h-[500px]">
          <div className="w-48 border-r border-zinc-700 overflow-y-auto">
            <nav className="p-2">
              {[
                { id: 'captions', icon: '💬', label: 'Captions' },
                { id: 'lowerthird', icon: '🏷️', label: 'Lower Third' },
                { id: 'intros', icon: '🎬', label: 'Intros/Outros' },
                { id: 'extras', icon: '✨', label: 'Extras' },
                { id: 'transitions', icon: '🔀', label: 'Transitions' },
                { id: 'background', icon: '🎨', label: 'Background' },
                { id: 'thumbnail', icon: '🖼️', label: 'Thumbnail' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveSection(tab.id as typeof activeSection)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm whitespace-nowrap transition-colors rounded-lg mb-1 ${
                    activeSection === tab.id
                      ? 'text-blue-400 bg-blue-400/10'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                  }`}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                  {activeSection === tab.id && <ChevronRight className="w-4 h-4 ml-auto" />}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {activeSection === 'captions' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">💬</span>
                    <span className="text-sm font-medium text-white">Enable Captions</span>
                  </div>
                  <button
                    onClick={() => setLocalEffects({
                      ...localEffects,
                      captions: { ...localEffects.captions, enabled: !localEffects.captions.enabled }
                    })}
                    className={`w-12 h-6 rounded-full transition-colors relative ${
                      localEffects.captions.enabled ? 'bg-blue-600' : 'bg-zinc-600'
                    }`}
                    role="switch"
                    aria-checked={localEffects.captions.enabled}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      localEffects.captions.enabled ? 'left-7' : 'left-1'
                    }`} />
                  </button>
                </div>

                {localEffects.captions.enabled && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-2">Animation Style</label>
                      <div className="grid grid-cols-4 gap-2">
                        {CAPTION_STYLES.map((style) => (
                          <button
                            key={style.value}
                            onClick={() => setLocalEffects({
                              ...localEffects,
                              captions: { ...localEffects.captions, animation: style.value }
                            })}
                            className={`p-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-center transition-all ${
                              localEffects.captions.animation === style.value
                                ? 'ring-2 ring-blue-500 bg-blue-500/20'
                                : ''
                            }`}
                          >
                            <div className="text-2xl mb-1">{style.icon}</div>
                            <div className="text-xs font-medium text-white">{style.label}</div>
                            <div className="text-xs text-zinc-400 mt-1">{style.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-2">
                        Font Size: {localEffects.captions.fontSize}px (16-72)
                      </label>
                      <input
                        type="range"
                        min="16"
                        max="72"
                        value={localEffects.captions.fontSize}
                        onChange={(e) => handleFontSizeChange(parseInt(e.target.value))}
                        className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-2">Position</label>
                      <div className="flex gap-2">
                        {['top', 'bottom', 'center'].map((pos) => (
                          <button
                            key={pos}
                            onClick={() => setLocalEffects({
                              ...localEffects,
                              captions: { ...localEffects.captions, position: pos as 'top' | 'bottom' | 'center' }
                            })}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                              localEffects.captions.position === pos
                                ? 'bg-blue-600 text-white'
                                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                            }`}
                          >
                            {pos}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-2">
                        Emphasize Words (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={localEffects.captions.emphasizeWords.join(', ')}
                        onChange={(e) => handleEmphasizeWordsChange(e.target.value)}
                        placeholder="actually, secret, finally, trust"
                        className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {activeSection === 'lowerthird' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🏷️</span>
                    <span className="text-sm font-medium text-white">Show Lower Third</span>
                  </div>
                  <button
                    onClick={() => setLocalEffects({
                      ...localEffects,
                      lowerThird: { ...localEffects.lowerThird, enabled: !localEffects.lowerThird.enabled }
                    })}
                    className={`w-12 h-6 rounded-full transition-colors relative ${
                      localEffects.lowerThird.enabled ? 'bg-blue-600' : 'bg-zinc-600'
                    }`}
                    role="switch"
                    aria-checked={localEffects.lowerThird.enabled}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      localEffects.lowerThird.enabled ? 'left-7' : 'left-1'
                    }`} />
                  </button>
                </div>

                {localEffects.lowerThird.enabled && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-2">Style</label>
                      <div className="grid grid-cols-5 gap-2">
                        {LOWER_THIRD_STYLES.map((style) => (
                          <button
                            key={style.value}
                            onClick={() => setLocalEffects({
                              ...localEffects,
                              lowerThird: { ...localEffects.lowerThird, style: style.value }
                            })}
                            className={`p-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-center transition-all ${
                              localEffects.lowerThird.style === style.value
                                ? 'ring-2 ring-blue-500 bg-blue-500/20'
                                : ''
                            }`}
                          >
                            <div className="text-2xl mb-1">{style.icon}</div>
                            <div className="text-xs font-medium text-white">{style.label}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { key: 'showName', label: 'Show Name' },
                        { key: 'showTitle', label: 'Show Title' },
                        { key: 'showRole', label: 'Show Role' },
                      ].map((item) => (
                        <button
                          key={item.key}
                          onClick={() => setLocalEffects({
                            ...localEffects,
                            lowerThird: { 
                              ...localEffects.lowerThird, 
                              [item.key]: !localEffects.lowerThird[item.key as 'showName' | 'showTitle' | 'showRole']
                            }
                          })}
                          className={`p-3 rounded-lg text-sm font-medium transition-colors ${
                            localEffects.lowerThird[item.key as 'showName' | 'showTitle' | 'showRole']
                              ? 'bg-blue-600 text-white'
                              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {activeSection === 'intros' && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🎬</span>
                      <span className="text-sm font-medium text-white">Intro Sequence</span>
                    </div>
                    <button
                      onClick={() => setLocalEffects({
                        ...localEffects,
                        intro: { ...localEffects.intro, enabled: !localEffects.intro.enabled }
                      })}
                      className={`w-10 h-5 rounded-full transition-colors relative ${
                        localEffects.intro.enabled ? 'bg-blue-600' : 'bg-zinc-600'
                      }`}
                      role="switch"
                      aria-checked={localEffects.intro.enabled}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                        localEffects.intro.enabled ? 'left-5' : 'left-0.5'
                      }`} />
                    </button>
                  </div>
                  
                  {localEffects.intro.enabled && (
                    <div className="grid grid-cols-5 gap-2">
                      {INTRO_TYPES.map((type) => (
                        <button
                          key={type.value}
                          onClick={() => setLocalEffects({
                            ...localEffects,
                            intro: { ...localEffects.intro, type: type.value }
                          })}
                          className={`p-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-center transition-all ${
                            localEffects.intro.type === type.value
                              ? 'ring-2 ring-blue-500 bg-blue-500/20'
                              : ''
                          }`}
                        >
                          <div className="text-2xl mb-1">{type.icon}</div>
                          <div className="text-xs font-medium text-white">{type.label}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3 pt-4 border-t border-zinc-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🔚</span>
                      <span className="text-sm font-medium text-white">Outro Sequence</span>
                    </div>
                    <button
                      onClick={() => setLocalEffects({
                        ...localEffects,
                        outro: { ...localEffects.outro, enabled: !localEffects.outro.enabled }
                      })}
                      className={`w-10 h-5 rounded-full transition-colors relative ${
                        localEffects.outro.enabled ? 'bg-blue-600' : 'bg-zinc-600'
                      }`}
                      role="switch"
                      aria-checked={localEffects.outro.enabled}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                        localEffects.outro.enabled ? 'left-5' : 'left-0.5'
                      }`} />
                    </button>
                  </div>
                  
                  {localEffects.outro.enabled && (
                    <>
                      <div className="grid grid-cols-5 gap-2">
                        {OUTRO_TYPES.map((type) => (
                          <button
                            key={type.value}
                            onClick={() => setLocalEffects({
                              ...localEffects,
                              outro: { ...localEffects.outro, type: type.value }
                            })}
                            className={`p-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-center transition-all ${
                              localEffects.outro.type === type.value
                                ? 'ring-2 ring-blue-500 bg-blue-500/20'
                                : ''
                            }`}
                          >
                            <div className="text-2xl mb-1">{type.icon}</div>
                            <div className="text-xs font-medium text-white">{type.label}</div>
                          </button>
                        ))}
                      </div>

                      <div className="flex gap-3">
                        <button
                          onClick={() => setLocalEffects({
                            ...localEffects,
                            outro: { ...localEffects.outro, includeSubscribeButton: !localEffects.outro.includeSubscribeButton }
                          })}
                          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                            localEffects.outro.includeSubscribeButton
                              ? 'bg-red-600 text-white'
                              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                          }`}
                        >
                          🔔 Subscribe Button
                        </button>
                        <button
                          onClick={() => setLocalEffects({
                            ...localEffects,
                            outro: { ...localEffects.outro, includeHandle: !localEffects.outro.includeHandle }
                          })}
                          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                            localEffects.outro.includeHandle
                              ? 'bg-blue-600 text-white'
                              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                          }`}
                        >
                          🏷️ Show Handle
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {activeSection === 'extras' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">✨</span>
                    <span className="text-sm font-medium text-white">Enable Graphics</span>
                  </div>
                  <button
                    onClick={() => setLocalEffects({
                      ...localEffects,
                      graphics: { ...localEffects.graphics, enabled: !localEffects.graphics.enabled }
                    })}
                    className={`w-12 h-6 rounded-full transition-colors relative ${
                      localEffects.graphics.enabled ? 'bg-blue-600' : 'bg-zinc-600'
                    }`}
                    role="switch"
                    aria-checked={localEffects.graphics.enabled}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      localEffects.graphics.enabled ? 'left-7' : 'left-1'
                    }`} />
                  </button>
                </div>

                {localEffects.graphics.enabled && (
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: 'progressBar', label: 'Progress Bar', icon: '📊', desc: 'Video progress indicator' },
                      { key: 'chapterMarkers', label: 'Chapter Markers', icon: '🏷️', desc: 'Section markers' },
                      { key: 'viralEmojis', label: 'Viral Emojis', icon: '😀', desc: 'Reaction emojis' },
                      { key: 'soundWave', label: 'Sound Wave', icon: '🎵', desc: 'Audio visualization' },
                    ].map((item) => (
                      <button
                        key={item.key}
                        onClick={() => setLocalEffects({
                          ...localEffects,
                          graphics: {
                            ...localEffects.graphics,
                            [item.key]: !localEffects.graphics[item.key as keyof typeof localEffects.graphics]
                          }
                        })}
                        className={`p-4 rounded-xl text-left transition-all ${
                          localEffects.graphics[item.key as keyof typeof localEffects.graphics]
                            ? 'bg-blue-500/20 border-2 border-blue-500'
                            : 'bg-zinc-800 border-2 border-transparent hover:bg-zinc-700'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{item.icon}</span>
                            <div>
                              <div className="text-sm font-medium text-white">{item.label}</div>
                              <div className="text-xs text-zinc-400">{item.desc}</div>
                            </div>
                          </div>
                          {localEffects.graphics[item.key as keyof typeof localEffects.graphics] && (
                            <Check className="w-5 h-5 text-blue-400" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeSection === 'transitions' && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">Intro Transition</label>
                    <select
                      value={localEffects.transitions.introTransition}
                      onChange={(e) => setLocalEffects({
                        ...localEffects,
                        transitions: { ...localEffects.transitions, introTransition: e.target.value as TransitionEffect }
                      })}
                      className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {TRANSITIONS.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">Clip Transition</label>
                    <select
                      value={localEffects.transitions.clipTransition}
                      onChange={(e) => setLocalEffects({
                        ...localEffects,
                        transitions: { ...localEffects.transitions, clipTransition: e.target.value as TransitionEffect }
                      })}
                      className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {TRANSITIONS.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">Outro Transition</label>
                    <select
                      value={localEffects.transitions.outroTransition}
                      onChange={(e) => setLocalEffects({
                        ...localEffects,
                        transitions: { ...localEffects.transitions, outroTransition: e.target.value as TransitionEffect }
                      })}
                      className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {TRANSITIONS.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'background' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Background Type</label>
                  <div className="grid grid-cols-4 gap-2">
                    {BACKGROUND_TYPES.map((type) => (
                      <button
                        key={type.value}
                        onClick={() => setLocalEffects({
                          ...localEffects,
                          background: { ...localEffects.background, type: type.value }
                        })}
                        className={`p-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-center transition-all ${
                          localEffects.background.type === type.value
                            ? 'ring-2 ring-blue-500 bg-blue-500/20'
                            : ''
                        }`}
                      >
                        <div className="text-2xl mb-1">{type.icon}</div>
                        <div className="text-xs font-medium text-white">{type.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {localEffects.background.type === 'gradient' && (
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">Gradient Preset</label>
                    <div className="grid grid-cols-3 gap-2">
                      {GRADIENT_PRESETS.map((preset) => (
                        <button
                          key={preset.name}
                          onClick={() => setLocalEffects({
                            ...localEffects,
                            background: { ...localEffects.background, gradientColors: preset.colors }
                          })}
                          className="p-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-center transition-all"
                        >
                          <div className="flex gap-1 mb-2 justify-center">
                            {preset.colors.map((color, i) => (
                              <div
                                key={i}
                                className="w-6 h-6 rounded-full"
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                          <div className="text-xs text-white">{preset.name}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {localEffects.background.type === 'blur' && (
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      Blur Amount: {localEffects.background.blurAmount}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="20"
                      value={localEffects.background.blurAmount}
                      onChange={(e) => setLocalEffects({
                        ...localEffects,
                        background: { ...localEffects.background, blurAmount: parseInt(e.target.value) }
                      })}
                      className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                )}
              </div>
            )}

            {activeSection === 'thumbnail' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🖼️</span>
                    <span className="text-sm font-medium text-white">Enable Thumbnail</span>
                  </div>
                  <button
                    onClick={() => setLocalEffects({
                      ...localEffects,
                      thumbnail: { ...localEffects.thumbnail, enabled: !localEffects.thumbnail.enabled }
                    })}
                    className={`w-12 h-6 rounded-full transition-colors relative ${
                      localEffects.thumbnail.enabled ? 'bg-blue-600' : 'bg-zinc-600'
                    }`}
                    role="switch"
                    aria-checked={localEffects.thumbnail.enabled}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      localEffects.thumbnail.enabled ? 'left-7' : 'left-1'
                    }`} />
                  </button>
                </div>

                {localEffects.thumbnail.enabled && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-2">Style</label>
                      <div className="grid grid-cols-4 gap-2">
                        {THUMBNAIL_STYLES.map((style) => (
                          <button
                            key={style.value}
                            onClick={() => setLocalEffects({
                              ...localEffects,
                              thumbnail: { ...localEffects.thumbnail, style: style.value }
                            })}
                            className={`p-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-center transition-all ${
                              localEffects.thumbnail.style === style.value
                                ? 'ring-2 ring-blue-500 bg-blue-500/20'
                                : ''
                            }`}
                          >
                            <div className="text-2xl mb-1">{style.icon}</div>
                            <div className="text-xs font-medium text-white">{style.label}</div>
                            <div className="text-xs text-zinc-400 mt-1">{style.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-2">Thumbnail Emoji</label>
                      <input
                        type="text"
                        value={localEffects.thumbnail.emoji}
                        onChange={(e) => setLocalEffects({
                          ...localEffects,
                          thumbnail: { ...localEffects.thumbnail, emoji: e.target.value.slice(0, 2) }
                        })}
                        maxLength={2}
                        placeholder="🔥"
                        className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-2">Overlay Text (optional)</label>
                      <input
                        type="text"
                        value={localEffects.thumbnail.overlayText || ''}
                        onChange={(e) => setLocalEffects({
                          ...localEffects,
                          thumbnail: { ...localEffects.thumbnail, overlayText: e.target.value }
                        })}
                        placeholder="Add text to thumbnail..."
                        className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="w-64 border-l border-zinc-700 p-4 bg-zinc-800/30">
            <div className="text-xs font-medium text-zinc-400 mb-3 uppercase tracking-wider">Live Preview</div>
            <EffectsPreview effects={localEffects} clipType={clipType} />
          </div>
        </div>

        <div className="flex items-center justify-between p-4 border-t border-zinc-700 bg-zinc-900">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Reset All
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-white hover:bg-zinc-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave(localEffects)}
              className={`px-6 py-2 text-sm rounded-lg font-medium transition-colors ${
                isDirty 
                  ? 'bg-blue-600 hover:bg-blue-500 text-white' 
                  : 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
              }`}
              disabled={!isDirty}
            >
              {isDirty ? 'Apply Changes' : 'No Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
