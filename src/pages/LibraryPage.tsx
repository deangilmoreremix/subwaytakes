import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Search, RefreshCw, Layers, Grid, Film, Clapperboard, Scissors, Clock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { FilterTabs } from '../components/FilterTabs';
import { ClipGrid } from '../components/ClipGrid';
import { SeriesGroup } from '../components/SeriesGroup';
import { EpisodeCard } from '../components/EpisodeCard';
import { listClips, listClipsGroupedByBatch } from '../lib/clips';
import { listEpisodes } from '../lib/episodes';
import { listCompilations } from '../lib/compilations';
import type { Clip, ClipType, Episode, Compilation } from '../lib/types';
import { clsx } from '../lib/format';

type FilterValue = 'all' | ClipType;
type ViewMode = 'all' | 'grouped';
type ContentMode = 'clips' | 'episodes' | 'compilations';

export function LibraryPage() {
  const navigate = useNavigate();
  const [clips, setClips] = useState<Clip[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [compilations, setCompilations] = useState<Compilation[]>([]);
  const [batches, setBatches] = useState<Map<string, Clip[]>>(new Map());
  const [singles, setSingles] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<FilterValue>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [contentMode, setContentMode] = useState<ContentMode>('clips');

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const fetchContent = useCallback(async () => {
    setLoading(true);
    try {
      if (contentMode === 'compilations') {
        const compData = await listCompilations({ limit: 20 });
        setCompilations(compData);
        setClips([]);
        setBatches(new Map());
        setSingles([]);
        setEpisodes([]);
      } else if (contentMode === 'episodes') {
        const episodeData = await listEpisodes({ limit: 20 });
        setEpisodes(episodeData);
        setClips([]);
        setBatches(new Map());
        setSingles([]);
        setCompilations([]);
      } else if (viewMode === 'grouped') {
        const { batches: batchData, singles: singlesData } = await listClipsGroupedByBatch({
          type: typeFilter,
          search: debouncedSearchQuery || undefined,
        });
        setBatches(batchData);
        setSingles(singlesData);
        setClips([]);
        setEpisodes([]);
        setCompilations([]);
      } else {
        const data = await listClips({
          type: typeFilter,
          search: debouncedSearchQuery || undefined,
          limit: 50,
        });
        setClips(data);
        setBatches(new Map());
        setSingles([]);
        setEpisodes([]);
        setCompilations([]);
      }
    } catch (error) {
      console.error('Failed to fetch content:', error);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, debouncedSearchQuery, viewMode, contentMode]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  useEffect(() => {
    if (contentMode === 'compilations') {
      const hasProcessing = compilations.some(
        (c) => c.status === 'queued' || c.status === 'stitching'
      );
      if (!hasProcessing) return;
      const interval = setInterval(fetchContent, 5000);
      return () => clearInterval(interval);
    } else if (contentMode === 'episodes') {
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
  }, [clips, batches, singles, episodes, compilations, viewMode, contentMode, fetchContent]);

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
            <button
              onClick={() => setContentMode('compilations')}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition',
                contentMode === 'compilations'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              )}
            >
              <Scissors className="h-4 w-4" />
              Compilations
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

            {contentMode === 'compilations' && (
              <div className="flex items-center gap-3">
                <div className="text-sm text-zinc-500">
                  {compilations.length} compilation{compilations.length !== 1 ? 's' : ''}
                </div>
                <Link
                  to="/compilations/new"
                  className="px-3 py-1.5 bg-white text-black rounded-lg text-xs font-medium hover:bg-zinc-200 transition-colors"
                >
                  + New
                </Link>
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

        {contentMode === 'compilations' ? (
          loading && compilations.length === 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
                  <div className="flex gap-4">
                    <div className="w-20 h-20 rounded-lg bg-zinc-800" />
                    <div className="flex-1">
                      <div className="h-4 w-32 rounded bg-zinc-800 mb-2" />
                      <div className="h-3 w-24 rounded bg-zinc-800" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : compilations.length === 0 ? (
            <div className="text-center py-12">
              <Scissors className="h-12 w-12 text-zinc-700 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-zinc-300 mb-2">No compilations yet</h3>
              <p className="text-sm text-zinc-500 mb-4">
                Stitch multiple clips together into composite videos
              </p>
              <Link
                to="/compilations/new"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-black rounded-lg text-sm font-medium hover:bg-zinc-200 transition-colors"
              >
                <Scissors className="w-4 h-4" />
                Create Compilation
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {compilations.map((comp) => {
                const statusMap: Record<string, { label: string; color: string; Icon: typeof Film }> = {
                  queued: { label: 'Queued', color: 'text-zinc-400 bg-zinc-500/20', Icon: Clock },
                  stitching: { label: 'Stitching', color: 'text-amber-400 bg-amber-500/20', Icon: Loader2 },
                  done: { label: 'Complete', color: 'text-emerald-400 bg-emerald-500/20', Icon: CheckCircle2 },
                  error: { label: 'Error', color: 'text-red-400 bg-red-500/20', Icon: AlertCircle },
                };
                const status = statusMap[comp.status] || statusMap.queued;
                const StatusIcon = status.Icon;

                return (
                  <button
                    key={comp.id}
                    onClick={() => navigate(`/compilations/${comp.id}`)}
                    className="flex items-center gap-4 p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 transition-all text-left w-full group"
                  >
                    <div className="w-14 h-14 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                      <Scissors className="w-6 h-6 text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate group-hover:text-amber-300 transition-colors">
                        {comp.name || 'Untitled Compilation'}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {comp.total_duration_seconds}s
                        </span>
                        <span>{new Date(comp.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                      <StatusIcon className={`w-3 h-3 ${comp.status === 'stitching' ? 'animate-spin' : ''}`} />
                      {status.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )
        ) : contentMode === 'episodes' ? (
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
                  onClick={() => navigate('/episodes/' + episode.id)}
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
                    onSelectClip={(clipId: string) => navigate('/clips/' + clipId)}
                  />
                ))}
              </div>
            )}

            {singles.length > 0 && (
              <div>
                {batches.size > 0 && (
                  <h3 className="text-sm font-medium text-zinc-400 mb-4">Single Clips</h3>
                )}
                <ClipGrid clips={singles} onSelectClip={(clipId: string) => navigate('/clips/' + clipId)} />
              </div>
            )}

            {batches.size === 0 && singles.length === 0 && (
              <ClipGrid clips={[]} onSelectClip={(clipId: string) => navigate('/clips/' + clipId)} />
            )}
          </div>
        ) : (
          <ClipGrid clips={clips} onSelectClip={(clipId: string) => navigate('/clips/' + clipId)} />
        )}
      </div>
    </div>
  );
}
