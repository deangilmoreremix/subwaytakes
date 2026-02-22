import { useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Scissors,
  ArrowLeft,
  ArrowRight,
  GripVertical,
  X,
  Film,
  Clock,
  Zap,
  Loader2,
  ChevronDown,
  Layers,
} from 'lucide-react';
import CompilationClipSelector from '../components/CompilationClipSelector';
import { createCompilation } from '../lib/compilations';
import { listClips } from '../lib/clips';
import type { Clip, TransitionType } from '../lib/types';

type Step = 'select' | 'arrange' | 'review' | 'generating';

const TRANSITION_OPTIONS: { value: TransitionType; label: string; desc: string }[] = [
  { value: 'crossfade', label: 'Crossfade', desc: 'Smooth blend between clips' },
  { value: 'cut', label: 'Hard Cut', desc: 'Instant switch, no overlap' },
  { value: 'dissolve', label: 'Dissolve', desc: 'Gradual dissolve transition' },
];

const TYPE_LABELS: Record<string, string> = {
  subway_interview: 'Subway',
  street_interview: 'Street',
  motivational: 'Motivational',
  wisdom_interview: 'Wisdom',
  studio_interview: 'Studio',
};

export default function CompilationBuilderPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialClipIds = searchParams.get('clips')?.split(',').filter(Boolean) || [];

  const [step, setStep] = useState<Step>('select');
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>(initialClipIds);
  const [orderedClips, setOrderedClips] = useState<Clip[]>([]);
  const [name, setName] = useState('');
  const [transitionType, setTransitionType] = useState<TransitionType>('crossfade');
  const [transitionDuration, setTransitionDuration] = useState(0.3);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const totalDuration = orderedClips.reduce((sum, c) => sum + c.duration_seconds, 0) -
    (transitionType !== 'cut' ? transitionDuration * Math.max(0, orderedClips.length - 1) : 0);

  const handleSelectionChange = useCallback((ids: string[]) => {
    setSelectedClipIds(ids);
  }, []);

  async function proceedToArrange() {
    if (selectedClipIds.length < 2) return;
    try {
      const allClips = await listClips({ limit: 100 });
      const selected = selectedClipIds
        .map(id => allClips.find(c => c.id === id))
        .filter(Boolean) as Clip[];
      setOrderedClips(selected);
      setName(selected.map(c => c.topic).slice(0, 3).join(' + '));
      setStep('arrange');
    } catch {
      setError('Failed to load clip details');
    }
  }

  function handleDragStart(index: number) {
    setDragIndex(index);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const updated = [...orderedClips];
    const [moved] = updated.splice(dragIndex, 1);
    updated.splice(index, 0, moved);
    setOrderedClips(updated);
    setDragIndex(index);
  }

  function handleDragEnd() {
    setDragIndex(null);
  }

  function removeClip(index: number) {
    const updated = [...orderedClips];
    updated.splice(index, 1);
    setOrderedClips(updated);
    setSelectedClipIds(updated.map(c => c.id));
  }

  async function handleGenerate() {
    if (orderedClips.length < 2) return;
    setGenerating(true);
    setError(null);
    setStep('generating');

    try {
      const compilation = await createCompilation({
        name: name || undefined,
        clipIds: orderedClips.map(c => c.id),
        transitionType,
        transitionDuration,
      });
      navigate(`/compilations/${compilation.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create compilation');
      setStep('review');
      setGenerating(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => {
              if (step === 'select') navigate('/library');
              else if (step === 'arrange') setStep('select');
              else if (step === 'review') setStep('arrange');
            }}
            className="p-2 rounded-lg bg-zinc-800/60 hover:bg-zinc-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Scissors className="w-6 h-6 text-amber-400" />
              Stitch Clips
            </h1>
            <p className="text-zinc-400 text-sm mt-0.5">Combine multiple clips into one composite video</p>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 mb-8">
          {['select', 'arrange', 'review'].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                step === s ? 'bg-white text-black' :
                ['select', 'arrange', 'review'].indexOf(step) > i ? 'bg-emerald-500/20 text-emerald-400' :
                'bg-zinc-800 text-zinc-500'
              }`}>
                {i + 1}
              </div>
              <span className={`text-sm font-medium ${step === s ? 'text-white' : 'text-zinc-500'}`}>
                {s === 'select' ? 'Select' : s === 'arrange' ? 'Arrange' : 'Review'}
              </span>
              {i < 2 && <div className="w-8 h-px bg-zinc-800 mx-1" />}
            </div>
          ))}
        </div>

        {/* Step: Select Clips */}
        {step === 'select' && (
          <div>
            <CompilationClipSelector
              selectedClipIds={selectedClipIds}
              onSelectionChange={handleSelectionChange}
              initialClipIds={initialClipIds}
            />

            {selectedClipIds.length > 0 && (
              <div className="fixed bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur-md border-t border-zinc-800 p-4 z-50">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Layers className="w-5 h-5 text-amber-400" />
                    <span className="text-sm font-medium">
                      {selectedClipIds.length} clips selected
                    </span>
                    {selectedClipIds.length < 2 && (
                      <span className="text-xs text-zinc-500">Select at least 2</span>
                    )}
                  </div>
                  <button
                    onClick={proceedToArrange}
                    disabled={selectedClipIds.length < 2}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white text-black rounded-lg font-medium text-sm hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    Next: Arrange
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step: Arrange */}
        {step === 'arrange' && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Compilation Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="My Compilation"
                className="w-full px-4 py-3 bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-white/20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-3">Clip Order</label>
              <p className="text-xs text-zinc-500 mb-3">Drag to reorder. Clips will play in this sequence.</p>
              <div className="space-y-2">
                {orderedClips.map((clip, index) => (
                  <div
                    key={clip.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={e => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      dragIndex === index
                        ? 'border-white/30 bg-zinc-800/80 scale-[0.98]'
                        : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700'
                    }`}
                  >
                    <GripVertical className="w-4 h-4 text-zinc-600 cursor-grab shrink-0" />
                    <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-sm font-bold text-zinc-300 shrink-0">
                      {index + 1}
                    </div>
                    <div className="w-12 h-12 rounded-lg bg-zinc-800 overflow-hidden shrink-0">
                      {clip.result_url ? (
                        <video src={clip.result_url} className="w-full h-full object-cover" muted preload="metadata" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Film className="w-5 h-5 text-zinc-700" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {clip.interview_question || clip.topic}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-zinc-500">{TYPE_LABELS[clip.video_type] || clip.video_type}</span>
                        <span className="text-zinc-700">|</span>
                        <span className="text-xs text-zinc-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {clip.duration_seconds}s
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => removeClip(index)}
                      className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-500 hover:text-white transition-colors shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-3">Transition Style</label>
              <div className="grid grid-cols-3 gap-3">
                {TRANSITION_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setTransitionType(opt.value)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      transitionType === opt.value
                        ? 'border-white bg-zinc-800'
                        : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700'
                    }`}
                  >
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {transitionType !== 'cut' && (
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Transition Duration: {transitionDuration.toFixed(1)}s
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.1"
                  value={transitionDuration}
                  onChange={e => setTransitionDuration(parseFloat(e.target.value))}
                  className="w-full accent-white"
                />
                <div className="flex justify-between text-xs text-zinc-600 mt-1">
                  <span>0.1s</span>
                  <span>1.0s</span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
              <div className="text-sm text-zinc-400">
                {orderedClips.length} clips | ~{Math.round(totalDuration)}s total
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep('select')}
                  className="px-4 py-2.5 bg-zinc-800 rounded-lg text-sm font-medium hover:bg-zinc-700 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => {
                    if (orderedClips.length >= 2) setStep('review');
                  }}
                  disabled={orderedClips.length < 2}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white text-black rounded-lg font-medium text-sm hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  Next: Review
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step: Review */}
        {step === 'review' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
              <h3 className="text-lg font-semibold mb-1">{name || 'Untitled Compilation'}</h3>
              <div className="flex items-center gap-4 text-sm text-zinc-400">
                <span className="flex items-center gap-1">
                  <Layers className="w-4 h-4" />
                  {orderedClips.length} clips
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  ~{Math.round(totalDuration)}s
                </span>
                <span className="capitalize">{transitionType} transition</span>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-zinc-300 mb-3">Clip Sequence</h4>
              <div className="space-y-1.5">
                {orderedClips.map((clip, i) => (
                  <div key={clip.id} className="flex items-center gap-3 py-2">
                    <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{clip.interview_question || clip.topic}</p>
                    </div>
                    <span className="text-xs text-zinc-500">{TYPE_LABELS[clip.video_type]}</span>
                    <span className="text-xs text-zinc-500">{clip.duration_seconds}s</span>
                    {i < orderedClips.length - 1 && transitionType !== 'cut' && (
                      <ChevronDown className="w-3 h-3 text-zinc-700" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
              <button
                onClick={() => setStep('arrange')}
                className="px-4 py-2.5 bg-zinc-800 rounded-lg text-sm font-medium hover:bg-zinc-700 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex items-center gap-2 px-6 py-2.5 bg-white text-black rounded-lg font-medium text-sm hover:bg-zinc-200 disabled:opacity-50 transition-all"
              >
                {generating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                {generating ? 'Creating...' : 'Stitch Clips'}
              </button>
            </div>
          </div>
        )}

        {/* Step: Generating */}
        {step === 'generating' && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-6 animate-pulse">
              <Film className="w-8 h-8 text-amber-400" />
            </div>
            <h2 className="text-xl font-bold mb-2">Stitching Your Clips</h2>
            <p className="text-zinc-400 text-sm max-w-md">
              Combining {orderedClips.length} clips into a single composite video with {transitionType} transitions.
              This typically takes 1-3 minutes.
            </p>
            <div className="flex gap-1 mt-6">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full bg-white/50 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
