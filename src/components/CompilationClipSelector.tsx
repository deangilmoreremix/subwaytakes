import { useState, useEffect } from 'react';
import { Search, Check, Film, Clock, AlertCircle } from 'lucide-react';
import { listClips } from '../lib/clips';
import type { Clip, ClipType } from '../lib/types';

const TYPE_LABELS: Record<ClipType, string> = {
  subway_interview: 'Subway',
  street_interview: 'Street',
  motivational: 'Motivational',
  wisdom_interview: 'Wisdom',
  studio_interview: 'Studio',
};

const TYPE_COLORS: Record<ClipType, string> = {
  subway_interview: 'bg-amber-500/20 text-amber-300',
  street_interview: 'bg-emerald-500/20 text-emerald-300',
  motivational: 'bg-red-500/20 text-red-300',
  wisdom_interview: 'bg-yellow-500/20 text-yellow-300',
  studio_interview: 'bg-sky-500/20 text-sky-300',
};

interface Props {
  selectedClipIds: string[];
  onSelectionChange: (ids: string[]) => void;
  maxClips?: number;
  initialClipIds?: string[];
}

export default function CompilationClipSelector({
  selectedClipIds,
  onSelectionChange,
  maxClips = 20,
  initialClipIds,
}: Props) {
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<ClipType | 'all'>('all');

  useEffect(() => {
    loadClips();
  }, []);

  useEffect(() => {
    if (initialClipIds && initialClipIds.length > 0 && clips.length > 0) {
      const validIds = initialClipIds.filter(id =>
        clips.some(c => c.id === id && c.status === 'done' && c.result_url)
      );
      if (validIds.length > 0 && selectedClipIds.length === 0) {
        onSelectionChange(validIds);
      }
    }
  }, [initialClipIds, clips]);

  async function loadClips() {
    try {
      const data = await listClips({ limit: 100 });
      setClips(data.filter(c => c.status === 'done' && c.result_url));
    } catch {
      setClips([]);
    } finally {
      setLoading(false);
    }
  }

  function toggleClip(clipId: string) {
    if (selectedClipIds.includes(clipId)) {
      onSelectionChange(selectedClipIds.filter(id => id !== clipId));
    } else if (selectedClipIds.length < maxClips) {
      onSelectionChange([...selectedClipIds, clipId]);
    }
  }

  const filtered = clips.filter(clip => {
    if (typeFilter !== 'all' && clip.video_type !== typeFilter) return false;
    if (search) {
      const term = search.toLowerCase();
      return (
        clip.topic.toLowerCase().includes(term) ||
        (clip.interview_question || '').toLowerCase().includes(term)
      );
    }
    return true;
  });

  const types: (ClipType | 'all')[] = ['all', 'subway_interview', 'street_interview', 'motivational', 'wisdom_interview', 'studio_interview'];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (clips.length === 0) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="w-10 h-10 text-zinc-500 mx-auto mb-3" />
        <p className="text-zinc-400 text-sm">No completed clips available</p>
        <p className="text-zinc-500 text-xs mt-1">Create some clips first, then come back to stitch them together</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search clips..."
            className="w-full pl-10 pr-4 py-2.5 bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-white/20"
          />
        </div>
        <span className="text-xs text-zinc-500 whitespace-nowrap">
          {selectedClipIds.length}/{maxClips} selected
        </span>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {types.map(t => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              typeFilter === t
                ? 'bg-white text-black'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            {t === 'all' ? 'All' : TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[480px] overflow-y-auto pr-1">
        {filtered.map(clip => {
          const isSelected = selectedClipIds.includes(clip.id);
          const selectionIndex = selectedClipIds.indexOf(clip.id);

          return (
            <button
              key={clip.id}
              onClick={() => toggleClip(clip.id)}
              className={`relative group rounded-xl overflow-hidden border-2 transition-all text-left ${
                isSelected
                  ? 'border-white ring-1 ring-white/20 scale-[0.98]'
                  : 'border-zinc-800 hover:border-zinc-600'
              }`}
            >
              <div className="aspect-[9/16] bg-zinc-900 relative">
                {clip.result_url ? (
                  <video
                    src={clip.result_url}
                    className="w-full h-full object-cover"
                    muted
                    preload="metadata"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Film className="w-8 h-8 text-zinc-700" />
                  </div>
                )}

                {isSelected && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
                      <span className="text-black font-bold text-sm">{selectionIndex + 1}</span>
                    </div>
                  </div>
                )}

                {!isSelected && selectedClipIds.length < maxClips && (
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <div className="w-8 h-8 rounded-full border-2 border-white/70 flex items-center justify-center">
                      <Check className="w-4 h-4 text-white/70" />
                    </div>
                  </div>
                )}

                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-6">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${TYPE_COLORS[clip.video_type]}`}>
                    {TYPE_LABELS[clip.video_type]}
                  </span>
                  <p className="text-white text-xs font-medium mt-1 line-clamp-1">
                    {clip.interview_question || clip.topic}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5 text-zinc-400">
                    <Clock className="w-3 h-3" />
                    <span className="text-[10px]">{clip.duration_seconds}s</span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-zinc-500 text-sm py-8">No clips match your filters</p>
      )}
    </div>
  );
}
