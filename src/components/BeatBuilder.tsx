import { useState } from 'react';
import type { Beat, BeatType, EmotionalTone, CameraDirection } from '../lib/types';
import { clsx } from '../lib/format';
import { Plus, Trash2, GripVertical, Mic, MessageSquare, Users, Play } from 'lucide-react';

interface BeatBuilderProps {
  beats: Beat[];
  onChange: (beats: Beat[]) => void;
  disabled?: boolean;
}

const BEAT_TYPE_CONFIG: Record<BeatType, { label: string; icon: React.ReactNode; color: string }> = {
  take: { label: 'Take', icon: <Mic className="h-4 w-4" />, color: 'emerald' },
  reaction: { label: 'Reaction', icon: <MessageSquare className="h-4 w-4" />, color: 'amber' },
  discussion: { label: 'Discussion', icon: <Users className="h-4 w-4" />, color: 'blue' },
};

const EMOTIONAL_TONES: EmotionalTone[] = [
  'neutral', 'excited', 'shocked', 'thoughtful', 'defensive',
  'aggressive', 'playful', 'sincere', 'sarcastic', 'passionate'
];

const CAMERA_DIRECTIONS: CameraDirection[] = [
  'two-shot', 'close-up', 'medium', 'wide', 'over-shoulder'
];

export function BeatBuilder({ beats, onChange, disabled }: BeatBuilderProps) {
  const [expandedBeat, setExpandedBeat] = useState<string | null>(null);

  const addBeat = (type: BeatType) => {
    const newBeat: Beat = {
      id: `beat-${Date.now()}`,
      type,
      speaker: type === 'reaction' ? 'host' : 'guest',
      content: '',
      duration: 5,
      emotionalTone: 'neutral',
      cameraDirection: type === 'discussion' ? 'two-shot' : 'close-up',
    };
    onChange([...beats, newBeat]);
    setExpandedBeat(newBeat.id);
  };

  const updateBeat = (id: string, updates: Partial<Beat>) => {
    onChange(beats.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const removeBeat = (id: string) => {
    onChange(beats.filter(b => b.id !== id));
  };

  const moveBeat = (id: string, direction: 'up' | 'down') => {
    const index = beats.findIndex(b => b.id === id);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === beats.length - 1) return;

    const newBeats = [...beats];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    [newBeats[index], newBeats[swapIndex]] = [newBeats[swapIndex], newBeats[index]];
    onChange(newBeats);
  };

  const totalDuration = beats.reduce((sum, b) => sum + b.duration, 0);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
            <Play className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-zinc-300">Conversation Beats</h3>
            <p className="text-xs text-zinc-500">Structure your interview flow</p>
          </div>
        </div>
        <div className="text-sm text-zinc-400">
          Total: <span className="text-blue-400 font-medium">{totalDuration}s</span>
        </div>
      </div>

      {/* Add Beat Buttons */}
      <div className="flex gap-2 mb-4">
        {(Object.keys(BEAT_TYPE_CONFIG) as BeatType[]).map((type) => {
          const config = BEAT_TYPE_CONFIG[type];
          return (
            <button
              key={type}
              type="button"
              disabled={disabled}
              onClick={() => addBeat(type)}
              className={clsx(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all',
                `bg-${config.color}-500/10 text-${config.color}-400 border border-${config.color}-500/30 hover:bg-${config.color}-500/20`,
                disabled && 'opacity-60 cursor-not-allowed'
              )}
            >
              <Plus className="h-3 w-3" />
              {config.icon}
              {config.label}
            </button>
          );
        })}
      </div>

      {/* Beats List */}
      <div className="space-y-2">
        {beats.map((beat, index) => {
          const config = BEAT_TYPE_CONFIG[beat.type];
          const isExpanded = expandedBeat === beat.id;
          const color = config.color;

          return (
            <div
              key={beat.id}
              className={clsx(
                'rounded-xl border transition-all duration-200',
                isExpanded
                  ? `border-${color}-500/50 bg-${color}-500/5`
                  : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'
              )}
            >
              {/* Beat Header */}
              <div
                className="flex items-center gap-3 p-3 cursor-pointer"
                onClick={() => setExpandedBeat(isExpanded ? null : beat.id)}
              >
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={(e) => { e.stopPropagation(); moveBeat(beat.id, 'up'); }}
                    className="p-1 text-zinc-600 hover:text-zinc-400 disabled:opacity-30"
                  >
                    <GripVertical className="h-4 w-4 rotate-90" />
                  </button>
                  <button
                    type="button"
                    disabled={index === beats.length - 1}
                    onClick={(e) => { e.stopPropagation(); moveBeat(beat.id, 'down'); }}
                    className="p-1 text-zinc-600 hover:text-zinc-400 disabled:opacity-30"
                  >
                    <GripVertical className="h-4 w-4 -rotate-90" />
                  </button>
                </div>

                <div className={clsx(
                  'h-8 w-8 rounded-lg flex items-center justify-center',
                  `bg-${color}-500/10 text-${color}-400`
                )}>
                  {config.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={clsx('text-sm font-medium', `text-${color}-400`)}>
                      {config.label}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {beat.speaker === 'host' ? 'Host' : 'Guest'} • {beat.duration}s
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500 truncate">
                    {beat.content || 'Click to add content...'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeBeat(beat.id); }}
                  className="p-2 text-zinc-600 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="px-3 pb-3 space-y-3">
                  <textarea
                    value={beat.content}
                    onChange={(e) => updateBeat(beat.id, { content: e.target.value })}
                    placeholder="Enter the line or script for this beat..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-300 placeholder-zinc-600 focus:border-blue-500/50 focus:outline-none resize-none"
                    rows={3}
                    disabled={disabled}
                  />

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Speaker</label>
                      <select
                        value={beat.speaker}
                        onChange={(e) => updateBeat(beat.id, { speaker: e.target.value as 'host' | 'guest' })}
                        disabled={disabled}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-sm text-zinc-300 focus:border-blue-500/50 focus:outline-none"
                      >
                        <option value="host">Host</option>
                        <option value="guest">Guest</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Duration (s)</label>
                      <input
                        type="number"
                        value={beat.duration}
                        onChange={(e) => updateBeat(beat.id, { duration: parseInt(e.target.value) || 5 })}
                        min={1}
                        max={30}
                        disabled={disabled}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-sm text-zinc-300 focus:border-blue-500/50 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Tone</label>
                      <select
                        value={beat.emotionalTone}
                        onChange={(e) => updateBeat(beat.id, { emotionalTone: e.target.value as EmotionalTone })}
                        disabled={disabled}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-sm text-zinc-300 focus:border-blue-500/50 focus:outline-none"
                      >
                        {EMOTIONAL_TONES.map(tone => (
                          <option key={tone} value={tone}>{tone}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Camera Direction</label>
                    <div className="flex flex-wrap gap-2">
                      {CAMERA_DIRECTIONS.map((direction) => (
                        <button
                          key={direction}
                          type="button"
                          onClick={() => updateBeat(beat.id, { cameraDirection: direction })}
                          className={clsx(
                            'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                            beat.cameraDirection === direction
                              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                              : 'bg-zinc-800 text-zinc-500 border border-zinc-700 hover:border-zinc-600'
                          )}
                        >
                          {direction}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {beats.length === 0 && (
        <div className="text-center py-8 text-zinc-500">
          <p className="text-sm">No beats yet</p>
          <p className="text-xs mt-1">Add beats to structure your interview</p>
        </div>
      )}
    </div>
  );
}
