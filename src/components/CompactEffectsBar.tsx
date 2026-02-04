import { useState } from 'react';
import { Sliders, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import type { RemotionEffectsConfig, ClipType } from '../lib/types';

interface CompactEffectsBarProps {
  clipType: ClipType;
  effects: RemotionEffectsConfig;
  onCustomize: () => void;
}

interface PresetInfo {
  name: string;
  emoji: string;
  caption: string;
  lowerThird: string;
  vibe: string;
  intro: string;
  outro: string;
  graphics: string[];
}

const PRESETS: Record<string, PresetInfo> = {
  wisdom_interview: {
    name: 'Thoughtful',
    emoji: '🧠',
    caption: 'Word-by-word',
    lowerThird: 'Modern',
    vibe: 'Calm & reflective',
    intro: 'Title card',
    outro: 'Follow CTA',
    graphics: ['Progress bar', 'Chapters'],
  },
  motivational: {
    name: 'High Energy',
    emoji: '🔥',
    caption: 'Highlight words',
    lowerThird: 'None',
    vibe: 'Pumping & inspiring',
    intro: 'Viral hook',
    outro: 'Subscribe CTA',
    graphics: ['Progress bar', 'Emojis'],
  },
  street_interview: {
    name: 'Street Vibes',
    emoji: '🏙️',
    caption: 'Quick captions',
    lowerThird: 'Classic',
    vibe: 'Raw & authentic',
    intro: 'Branding',
    outro: 'Call to action',
    graphics: ['Sound wave'],
  },
  subway_interview: {
    name: 'Transit Talk',
    emoji: '🚇',
    caption: 'Top position',
    lowerThird: 'Minimal',
    vibe: 'Casual & fun',
    intro: 'Quick intro',
    outro: 'CTA',
    graphics: ['Progress bar'],
  },
  studio_interview: {
    name: 'Professional',
    emoji: '🎬',
    caption: 'Clean static',
    lowerThird: 'Full detail',
    vibe: 'Polished & serious',
    intro: 'Title card',
    outro: 'Subscribe',
    graphics: [],
  },
};

const getCaptionLabel = (animation: string): string => {
  const labels: Record<string, string> = {
    static: 'Static',
    word_by_word: 'Word-by-word',
    typewriter: 'Typewriter',
    karaoke: 'Karaoke',
    pop_up: 'Pop up',
    slide_in: 'Slide in',
    highlight: 'Highlight',
  };
  return labels[animation] || animation;
};

const getLowerThirdLabel = (style: string): string => {
  const labels: Record<string, string> = {
    none: 'None',
    classic: 'Classic',
    modern: 'Modern',
    minimal: 'Minimal',
    vintage: 'Vintage',
  };
  return labels[style] || style;
};

export function CompactEffectsBar({ clipType, effects, onCustomize }: CompactEffectsBarProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  const preset = PRESETS[clipType] || PRESETS.wisdom_interview;
  
  const activeCaption = getCaptionLabel(effects.captions.animation);
  const activeLowerThird = effects.lowerThird.enabled ? getLowerThirdLabel(effects.lowerThird.style) : 'None';
  const activeIntro = effects.intro.enabled ? (effects.intro.type === 'title' ? 'Title' : effects.intro.type) : 'None';
  const activeOutro = effects.outro.enabled ? (effects.outro.type === 'cta' ? 'CTA' : effects.outro.type) : 'None';
  
  const activeGraphics: string[] = [];
  if (effects.graphics.progressBar) activeGraphics.push('Progress');
  if (effects.graphics.chapterMarkers) activeGraphics.push('Chapters');
  if (effects.graphics.viralEmojis) activeGraphics.push('Emojis');
  if (effects.graphics.soundWave) activeGraphics.push('Wave');

  return (
    <div className="relative">
      {/* Main Bar - Minimal */}
      <div 
        className="flex items-center gap-4 p-4 bg-gradient-to-r from-zinc-800 to-zinc-900 rounded-xl border border-zinc-700 hover:border-zinc-600 transition-colors"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Active Preset Display */}
        <div className="flex items-center gap-3">
          <span className="text-2xl">{preset.emoji}</span>
          <div>
            <div className="text-white font-semibold">{preset.name}</div>
            <div className="text-xs text-zinc-400">{preset.vibe}</div>
          </div>
        </div>

        {/* Applied Effects Pills - Visual Only */}
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          <span className="px-2 py-1 bg-zinc-700/80 rounded text-xs text-zinc-300 flex items-center gap-1">
            💬 {activeCaption}
          </span>
          <span className="px-2 py-1 bg-zinc-700/80 rounded text-xs text-zinc-300 flex items-center gap-1">
            🏷️ {activeLowerThird}
          </span>
          {activeGraphics.length > 0 && (
            <span className="px-2 py-1 bg-zinc-700/80 rounded text-xs text-zinc-300 flex items-center gap-1">
              ✨ {activeGraphics.join(', ')}
            </span>
          )}
        </div>

        {/* Customize Button */}
        <button
          onClick={onCustomize}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium text-white transition-colors"
        >
          <Sliders className="w-4 h-4" />
          Customize
          {isHovered ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Hover Preview - Shows what's applied */}
      {isHovered && (
        <div className="absolute top-full left-0 right-0 mt-2 p-4 bg-zinc-800/95 backdrop-blur-sm rounded-xl shadow-xl border border-zinc-700 z-50">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <div className="text-xs text-amber-400 uppercase tracking-wider font-medium">Applied Effects</div>
          </div>
          
          <div className="grid grid-cols-4 gap-3">
            {/* Captions */}
            <div className="text-center p-3 bg-zinc-700/50 rounded-lg">
              <div className="text-2xl mb-1">💬</div>
              <div className="text-xs text-white font-medium">Captions</div>
              <div className="text-xs text-zinc-400">{activeCaption}</div>
            </div>
            
            {/* Lower Third */}
            <div className="text-center p-3 bg-zinc-700/50 rounded-lg">
              <div className="text-2xl mb-1">🏷️</div>
              <div className="text-xs text-white font-medium">Lower Third</div>
              <div className="text-xs text-zinc-400">{activeLowerThird}</div>
            </div>
            
            {/* Intro */}
            <div className="text-center p-3 bg-zinc-700/50 rounded-lg">
              <div className="text-2xl mb-1">🎬</div>
              <div className="text-xs text-white font-medium">Intro</div>
              <div className="text-xs text-zinc-400">{activeIntro}</div>
            </div>
            
            {/* Outro */}
            <div className="text-center p-3 bg-zinc-700/50 rounded-lg">
              <div className="text-2xl mb-1">🔚</div>
              <div className="text-xs text-white font-medium">Outro</div>
              <div className="text-xs text-zinc-400">{activeOutro}</div>
            </div>
          </div>
          
          {/* Additional Graphics */}
          {activeGraphics.length > 0 && (
            <div className="mt-3 pt-3 border-t border-zinc-700">
              <div className="text-xs text-zinc-400 mb-2">Additional Graphics</div>
              <div className="flex gap-2 flex-wrap">
                {activeGraphics.map((graphic) => (
                  <span key={graphic} className="px-2 py-1 bg-zinc-600/50 rounded text-xs text-zinc-300">
                    {graphic}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
