import { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, Layers, Grid, Film, Clapperboard } from 'lucide-react';
import { FilterTabs } from '../components/FilterTabs';
import { ClipGrid } from '../components/ClipGrid';
import { SeriesGroup } from '../components/SeriesGroup';
import { EpisodeCard } from '../components/EpisodeCard';
import { listClips, listClipsGroupedByBatch } from '../lib/clips';
import { listEpisodes } from '../lib/episodes';
import type { Clip, ClipType, Episode } from '../lib/types';
import { clsx } from '../lib/format';

interface LibraryPageProps {
  onSelectClip: (clipId: string) => void;
  onSelectEpisode?: (episodeId: string) => void;
}

type FilterValue = 'all' | ClipType;
type ViewMode = 'all' | 'grouped';
type ContentMode = 'clips' | 'episodes';

export function LibraryPage({ onSelectClip, onSelectEpisode }: LibraryPageProps) {
  const [clips, setClips] = useState<Clip[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [batches, setBatches] = useState<Map<string, Clip[]>>(new Map());
  const [singles, setSingles] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<FilterValue>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [contentMode, setContentMode] = useState<ContentMode>('clips');

  const fetchContent = useCallback(async () => {
    setLoading(true);
    try {
      if (contentMode === 'episodes') {
        const episodeData = await listEpisodes({ limit: 20 });
        setEpisodes(episodeData);
        setClips([]);
        setBatches(new Map());
        setSingles([]);
      } else if (viewMode === 'grouped') {
        const { batches: batchData, singles: singlesData } = await listClipsGroupedByBatch({
          type: typeFilter,
          search: searchQuery || undefined,
        });
        setBatches(batchData);
        setSingles(singlesData);
        setClips([]);
        setEpisodes([]);
      } else {
        const data = await listClips({
          type: typeFilter,
          search: searchQuery || undefined,
          limit: 50,
        });
        setClips(data);
        setBatches(new Map());
        setSingles([]);
        setEpisodes([]);
      }
    } catch (error) {
      console.error('Failed to fetch content:', error);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, searchQuery, viewMode, contentMode]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  useEffect(() => {
    if (contentMode === 'episodes') {
      const hasGenerating = episodes.some(
        (e) => e.status === 'queued' || e.status === 'generating' || e.status === 'stitching'
      );
      if (!hasGenerating) return;
      const interval = setInterval(fetchContent, 5000);
      return () => clearInterval(interval);
    } else {
      const allClips = viewMode === 'grouped'
        ? [...Array.from(batches.values()).flat(), ...singles]
        : clips;

      const hasGenerating = allClips.some(
        (c) => c.status === 'queued' || c.status === 'running'
      );

      if (!hasGenerating) return;

      const interval = setInterval(fetchContent, 5000);
      return () => clearInterval(interval);
    }
  }, [clips, batches, singles, episodes, viewMode, contentMode, fetchContent]);

  const totalClips = viewMode === 'grouped'
    ? Array.from(batches.values()).reduce((acc, b) => acc + b.length, 0) + singles.length
    : clips.length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">
          Library
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          All your generated clips and episodes in one place.
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-center gap-2 border-b border-zinc-800 pb-4">
            <button
              onClick={() => setContentMode('clips')}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition',
                contentMode === 'clips'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              )}
            >
              <Clapperboard className="h-4 w-4" />
              Clips
            </button>
            <button
              onClick={() => setContentMode('episodes')}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition',
                contentMode === 'episodes'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              )}
            >
              <Film className="h-4 w-4" />
              Episodes
            </button>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {contentMode === 'clips' && (
              <div className="flex items-center gap-4">
                <FilterTabs
                  value={typeFilter}
                  onChange={setTypeFilter}
                  disabled={loading}
                />

                <div className="flex items-center border border-zinc-800 rounded-lg p-0.5">
                  <button
                    onClick={() => setViewMode('all')}
                    className={clsx(
                      'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition',
                      viewMode === 'all'
                        ? 'bg-zinc-700 text-white'
                        : 'text-zinc-400 hover:text-zinc-200'
                    )}
                  >
                    <Grid className="h-3.5 w-3.5" />
                    All
                  </button>
                  <button
                    onClick={() => setViewMode('grouped')}
                    className={clsx(
                      'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition',
                      viewMode === 'grouped'
                        ? 'bg-zinc-700 text-white'
                        : 'text-zinc-400 hover:text-zinc-200'
                    )}
                  >
                    <Layers className="h-3.5 w-3.5" />
                    Series
                  </button>
                </div>
              </div>
            )}

            {contentMode === 'episodes' && (
              <div className="text-sm text-zinc-500">
                {episodes.length} episode{episodes.length !== 1 ? 's' : ''}
              </div>
            )}

            <div className="flex items-center gap-3">
              {contentMode === 'clips' && (
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Search topic or question..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 pl-9 pr-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600"
                  />
                </div>
              )}
              <button
                onClick={fetchContent}
                disabled={loading}
                className={clsx(
                  'rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100 transition',
                  loading && 'opacity-60 cursor-not-allowed'
                )}
              >
                <RefreshCw className={clsx('h-4 w-4', loading && 'animate-spin')} />
              </button>
            </div>
          </div>
        </div>

        {contentMode === 'episodes' ? (
          loading && episodes.length === 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
                  <div className="flex gap-4">
                    <div className="w-20 h-36 rounded-lg bg-zinc-800" />
                    <div className="flex-1">
                      <div className="h-4 w-24 rounded bg-zinc-800 mb-2" />
                      <div className="h-5 w-48 rounded bg-zinc-800 mb-3" />
                      <div className="h-3 w-32 rounded bg-zinc-800" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : episodes.length === 0 ? (
            <div className="text-center py-12">
              <Film className="h-12 w-12 text-zinc-700 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-zinc-300 mb-2">No episodes yet</h3>
              <p className="text-sm text-zinc-500">
                Create your first 6-shot SubwayTakes episode
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {episodes.map((episode) => (
                <EpisodeCard
                  key={episode.id}
                  episode={episode}
                  onClick={() => onSelectEpisode?.(episode.id)}
                />
              ))}
            </div>
          )
        ) : loading && totalClips === 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/30 p-3">
                <div className="aspect-[9/16] rounded-xl bg-zinc-800" />
                <div className="mt-3 h-4 w-24 rounded bg-zinc-800" />
                <div className="mt-2 h-3 w-32 rounded bg-zinc-800" />
              </div>
            ))}
          </div>
        ) : viewMode === 'grouped' ? (
          <div className="space-y-8">
            {batches.size > 0 && (
              <div className="space-y-6">
                {Array.from(batches.entries()).map(([batchId, batchClips]) => (
                  <SeriesGroup
                    key={batchId}
                    batchId={batchId}
                    clips={batchClips}
                    onSelectClip={onSelectClip}
                  />
                ))}
              </div>
            )}

            {singles.length > 0 && (
              <div>
                {batches.size > 0 && (
                  <h3 className="text-sm font-medium text-zinc-400 mb-4">Single Clips</h3>
                )}
                <ClipGrid clips={singles} onSelectClip={onSelectClip} />
              </div>
            )}

            {batches.size === 0 && singles.length === 0 && (
              <ClipGrid clips={[]} onSelectClip={onSelectClip} />
            )}
          </div>
        ) : (
          <ClipGrid clips={clips} onSelectClip={onSelectClip} />
        )}
      </div>
    </div>
  );
}
