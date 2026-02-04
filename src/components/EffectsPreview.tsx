import type { RemotionEffectsConfig } from '../lib/types';

interface EffectsPreviewProps {
  effects: RemotionEffectsConfig;
  clipType: string;
}

const CLIP_TYPE_ICONS: Record<string, string> = {
  wisdom_interview: '🧠',
  motivational: '🔥',
  street_interview: '🏙️',
  subway_interview: '🚇',
  studio_interview: '🎬',
};

const BACKGROUND_GRADIENTS: Record<string, string> = {
  wisdom_interview: 'from-indigo-900 via-purple-900 to-zinc-900',
  motivational: 'from-red-900 via-orange-900 to-zinc-900',
  street_interview: 'from-blue-900 via-cyan-900 to-zinc-900',
  subway_interview: 'from-yellow-900 via-amber-900 to-zinc-900',
  studio_interview: 'from-zinc-800 via-zinc-700 to-zinc-900',
};

export function EffectsPreview({ effects, clipType }: EffectsPreviewProps) {
  const gradient = BACKGROUND_GRADIENTS[clipType] || BACKGROUND_GRADIENTS.wisdom_interview;
  const clipIcon = CLIP_TYPE_ICONS[clipType] || '🎬';

  return (
    <div className="aspect-[9/16] bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-xl overflow-hidden relative border border-zinc-700 shadow-xl">
      {/* Background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-80`} />
      
      {/* Content Placeholder */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">{clipIcon}</div>
          <div className="text-white/50 text-sm">Video Preview</div>
        </div>
      </div>

      {/* Progress Bar */}
      {effects.graphics.progressBar && (
        <div className="absolute top-3 left-3 right-3">
          <div className="h-1.5 bg-zinc-700/50 rounded-full overflow-hidden">
            <div className="w-1/3 h-full bg-gradient-to-r from-blue-500 to-purple-500" />
          </div>
        </div>
      )}

      {/* Caption Preview */}
      {effects.captions.enabled && (
        <div 
          className={`absolute ${
            effects.captions.position === 'top' ? 'top-20' : 
            effects.captions.position === 'center' ? 'top-1/2 -translate-y-1/2' : 
            'bottom-24'
          } left-4 right-4`}
        >
          <div className="bg-black/60 backdrop-blur-sm rounded-lg p-3 text-center">
            {effects.captions.animation === 'word_by_word' && (
              <div className="flex flex-wrap justify-center gap-2">
                <span className="text-white/40">The</span>
                <span className="text-white/40">truth</span>
                <span className="text-white/40">about</span>
                <span className="text-yellow-400 font-bold">success</span>
                <span className="text-white/40">is...</span>
              </div>
            )}
            {effects.captions.animation === 'highlight' && (
              <div className="text-white text-sm">
                The <span className="text-yellow-400 font-bold">KEY</span> to everything
              </div>
            )}
            {effects.captions.animation === 'pop_up' && (
              <div className="text-white text-sm transform scale-110">POW! Here's the answer</div>
            )}
            {effects.captions.animation === 'typewriter' && (
              <div className="text-white text-sm font-mono">
                <span>The answer is...</span>
                <span className="animate-pulse">|</span>
              </div>
            )}
            {(effects.captions.animation === 'static' || effects.captions.animation === 'slide_in') && (
              <div className="text-white text-sm">Static caption preview text here</div>
            )}
            {effects.captions.animation === 'karaoke' && (
              <div className="text-white text-sm">
                <span className="text-blue-400">♪</span> Singing along here
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lower Third Preview */}
      {effects.lowerThird.enabled && effects.lowerThird.style !== 'none' && (
        <div className="absolute bottom-8 left-4 right-4">
          <div className={`flex items-center gap-3 ${
            effects.lowerThird.style === 'minimal' ? 'bg-transparent' : 
            effects.lowerThird.style === 'modern' ? 'bg-white/10 backdrop-blur-md rounded-lg p-2' :
            effects.lowerThird.style === 'classic' ? 'bg-gradient-to-r from-red-600 to-red-700 rounded-lg p-2' :
            effects.lowerThird.style === 'vintage' ? 'bg-amber-900/80 rounded-lg p-2' :
            'bg-white/10 backdrop-blur-md rounded-lg p-2'
          }`}>
            {/* Avatar placeholder */}
            <div className={`w-10 h-10 rounded-full ${
              effects.lowerThird.style === 'classic' ? 'bg-white' : 'bg-zinc-600'
            } flex-shrink-0`} />
            
            <div>
              {effects.lowerThird.showName && (
                <div className={`text-sm font-medium ${
                  effects.lowerThird.style === 'classic' ? 'text-white' : 'text-white'
                }`}>
                  John Doe
                </div>
              )}
              {effects.lowerThird.showTitle && (
                <div className={`text-xs ${
                  effects.lowerThird.style === 'classic' ? 'text-white/80' : 'text-zinc-400'
                }`}>
                  Expert / Speaker
                </div>
              )}
              {effects.lowerThird.showRole && (
                <div className={`text-xs ${
                  effects.lowerThird.style === 'classic' ? 'text-yellow-400' : 'text-amber-400'
                } uppercase tracking-wide`}>
                  GUEST
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Viral Emojis */}
      {effects.graphics.viralEmojis && (
        <div className="absolute top-1/3 right-4 flex flex-col gap-2">
          <span className="text-2xl animate-bounce" style={{ animationDelay: '0ms' }}>😮</span>
          <span className="text-2xl animate-bounce" style={{ animationDelay: '100ms' }}>🔥</span>
          <span className="text-2xl animate-bounce" style={{ animationDelay: '200ms' }}>💯</span>
        </div>
      )}

      {/* Sound Wave */}
      {effects.graphics.soundWave && (
        <div className="absolute bottom-40 left-1/2 -translate-x-1/2 flex items-end gap-1 h-12">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="w-1 bg-gradient-to-t from-purple-500 to-pink-500 rounded-full animate-pulse"
              style={{
                height: `${20 + Math.sin(i * 0.5) * 15 + Math.random() * 20}%`,
                animationDelay: `${i * 50}ms`,
              }}
            />
          ))}
        </div>
      )}

      {/* Chapter Markers */}
      {effects.graphics.chapterMarkers && (
        <div className="absolute top-12 left-4 flex gap-2">
          <div className="px-2 py-1 bg-blue-600/80 rounded text-xs text-white">HOOK</div>
          <div className="px-2 py-1 bg-zinc-600/80 rounded text-xs text-white">BODY</div>
          <div className="px-2 py-1 bg-zinc-600/80 rounded text-xs text-white">PUNCH</div>
        </div>
      )}

      {/* Subscribe Button Preview */}
      {effects.outro.enabled && effects.outro.includeSubscribeButton && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-full font-bold flex items-center gap-2 cursor-pointer transition-colors">
            <span>🔔</span>
            Subscribe
          </div>
        </div>
      )}

      {/* Handle Preview */}
      {effects.outro.enabled && effects.outro.includeHandle && (
        <div className="absolute top-4 right-4 px-3 py-1 bg-black/50 backdrop-blur-sm rounded-full">
          <span className="text-white text-sm">@yourchannel</span>
        </div>
      )}

      {/* Vignette Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/30 pointer-events-none" />
    </div>
  );
}
