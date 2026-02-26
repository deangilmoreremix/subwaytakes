import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Film,
  Clock,
  Layers,
  Download,
  Sparkles,
  RefreshCw,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  FileText,
} from 'lucide-react';
import {
  getCompilationById,
  retryCompilation,
  deleteCompilation,
  triggerCompilationCompose,
} from '../lib/compilations';
import type { Compilation, CompilationClipEntry } from '../lib/types';

const TYPE_LABELS: Record<string, string> = {
  subway_interview: 'Subway',
  street_interview: 'Street',
  motivational: 'Motivational',
  wisdom_interview: 'Wisdom',
  studio_interview: 'Studio',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Film }> = {
  queued: { label: 'Queued', color: 'bg-zinc-500/20 text-zinc-400', icon: Clock },
  stitching: { label: 'Stitching', color: 'bg-amber-500/20 text-amber-400', icon: Loader2 },
  done: { label: 'Complete', color: 'bg-emerald-500/20 text-emerald-400', icon: CheckCircle2 },
  error: { label: 'Error', color: 'bg-red-500/20 text-red-400', icon: AlertCircle },
};

export default function CompilationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [compilation, setCompilation] = useState<Compilation | null>(null);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);

  useEffect(() => {
    if (id) loadCompilation();
  }, [id]);

  useEffect(() => {
    if (!compilation) return;
    if (compilation.status === 'queued' || compilation.status === 'stitching') {
      const interval = setInterval(() => {
        if (id) loadCompilation();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [compilation?.status, id]);

  async function loadCompilation() {
    if (!id) return;
    try {
      const data = await getCompilationById(id);
      setCompilation(data);
    } catch {
      setCompilation(null);
    } finally {
      setLoading(false);
    }
  }

  const [actionError, setActionError] = useState<string | null>(null);

  async function handleRetry() {
    if (!id) return;
    setActionError(null);
    try {
      await retryCompilation(id);
      loadCompilation();
    } catch {
      setActionError('Failed to retry. Please try again.');
    }
  }

  async function handleDelete() {
    if (!id) return;
    if (!window.confirm('Delete this compilation?')) return;
    setActionError(null);
    try {
      await deleteCompilation(id);
      navigate('/library');
    } catch {
      setActionError('Failed to delete. Please try again.');
    }
  }

  async function handleCompose() {
    if (!id) return;
    setComposing(true);
    setActionError(null);
    try {
      await triggerCompilationCompose(id);
      setTimeout(() => loadCompilation(), 3000);
    } catch {
      setActionError('Failed to start composition. Please try again.');
    } finally {
      setComposing(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!compilation) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center">
        <AlertCircle className="w-12 h-12 text-zinc-600 mb-4" />
        <p className="text-zinc-400">Compilation not found</p>
        <Link to="/library" className="text-sm text-amber-400 hover:underline mt-2">Back to Library</Link>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[compilation.status] || STATUS_CONFIG.queued;
  const StatusIcon = statusConfig.icon;
  const videoUrl = compilation.composed_video_url || compilation.final_video_url;
  const isProcessing = compilation.status === 'queued' || compilation.status === 'stitching';

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {actionError && (
          <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {actionError}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/library')} className="p-2 rounded-lg bg-zinc-800/60 hover:bg-zinc-700 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold">{compilation.name || 'Compilation'}</h1>
              <div className="flex items-center gap-3 mt-1">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
                  <StatusIcon className={`w-3 h-3 ${isProcessing ? 'animate-spin' : ''}`} />
                  {statusConfig.label}
                </span>
                <span className="text-xs text-zinc-600">{compilation.id.slice(0, 8)}</span>
              </div>
            </div>
          </div>

          {compilation.status === 'error' && (
            <button onClick={handleRetry} className="flex items-center gap-2 px-4 py-2 bg-zinc-800 rounded-lg text-sm hover:bg-zinc-700 transition-colors">
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Video Player */}
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900">
              {isProcessing ? (
                <div className="aspect-[9/16] max-h-[600px] flex flex-col items-center justify-center bg-zinc-900">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4 animate-pulse">
                    <Film className="w-7 h-7 text-amber-400" />
                  </div>
                  <p className="text-zinc-300 font-medium">Stitching your clips...</p>
                  <p className="text-zinc-500 text-sm mt-1">This typically takes 1-3 minutes</p>
                  <div className="w-48 h-1.5 rounded-full bg-zinc-800 mt-6 overflow-hidden">
                    <div className="h-full rounded-full bg-amber-500/50 animate-pulse" style={{ width: '60%' }} />
                  </div>
                </div>
              ) : compilation.status === 'error' ? (
                <div className="aspect-[9/16] max-h-[600px] flex flex-col items-center justify-center bg-zinc-900">
                  <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
                  <p className="text-red-400 font-medium">Stitching Failed</p>
                  <p className="text-zinc-500 text-sm mt-1 max-w-xs text-center">{compilation.error}</p>
                </div>
              ) : videoUrl ? (
                <video
                  src={videoUrl}
                  controls
                  className="w-full max-h-[600px] mx-auto"
                  style={{ aspectRatio: '9/16' }}
                />
              ) : (
                <div className="aspect-[9/16] max-h-[600px] flex items-center justify-center bg-zinc-900">
                  <Film className="w-12 h-12 text-zinc-700" />
                </div>
              )}
            </div>

            {/* Actions */}
            {compilation.status === 'done' && (
              <div className="flex flex-wrap gap-3">
                {videoUrl && (
                  <a
                    href={videoUrl}
                    download
                    className="flex items-center gap-2 px-4 py-2.5 bg-white text-black rounded-lg text-sm font-medium hover:bg-zinc-200 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </a>
                )}
                <Link
                  to={`/compilations/${compilation.id}/enhance`}
                  className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 text-white rounded-lg text-sm font-medium hover:bg-zinc-700 transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  Enhance
                </Link>
                {!compilation.composed_video_url && (
                  <button
                    onClick={handleCompose}
                    disabled={composing}
                    className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
                  >
                    {composing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Apply Branding
                  </button>
                )}
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 text-red-400 rounded-lg text-sm font-medium hover:bg-zinc-700 transition-colors ml-auto"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            )}
          </div>

          {/* Right: Details */}
          <div className="space-y-5">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 text-center">
                <Layers className="w-5 h-5 text-amber-400 mx-auto mb-1" />
                <p className="text-lg font-bold">{compilation.clips?.length || 0}</p>
                <p className="text-xs text-zinc-500">Clips</p>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 text-center">
                <Clock className="w-5 h-5 text-sky-400 mx-auto mb-1" />
                <p className="text-lg font-bold">{compilation.total_duration_seconds}s</p>
                <p className="text-xs text-zinc-500">Duration</p>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 text-center">
                <Film className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                <p className="text-lg font-bold capitalize">{compilation.transition_type}</p>
                <p className="text-xs text-zinc-500">Transition</p>
              </div>
            </div>

            {/* Caption Download */}
            {compilation.caption_file_url && (
              <a
                href={compilation.caption_file_url}
                download
                className="flex items-center gap-2 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 transition-colors text-sm text-zinc-300"
              >
                <FileText className="w-4 h-4 text-zinc-500" />
                Download Captions (SRT)
              </a>
            )}

            {/* Clip Breakdown */}
            <div>
              <h3 className="text-sm font-medium text-zinc-300 mb-3">Clip Breakdown</h3>
              <div className="space-y-2">
                {(compilation.clips || []).map((entry: CompilationClipEntry) => (
                  <Link
                    key={entry.id}
                    to={entry.clip ? `/clips/${entry.clip.id}` : '#'}
                    className="flex items-center gap-3 p-2.5 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 transition-colors"
                  >
                    <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400 shrink-0">
                      {entry.sequence}
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-zinc-800 overflow-hidden shrink-0">
                      {entry.clip?.result_url ? (
                        <video src={entry.clip.result_url} className="w-full h-full object-cover" muted preload="metadata" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Film className="w-4 h-4 text-zinc-700" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">
                        {entry.clip?.interview_question || entry.clip?.topic || 'Clip'}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <span>{entry.clip ? TYPE_LABELS[entry.clip.video_type] || entry.clip.video_type : ''}</span>
                        <span>{entry.clip?.duration_seconds}s</span>
                      </div>
                    </div>
                    {entry.clip?.status === 'done' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    )}
                  </Link>
                ))}
              </div>
            </div>

            {/* Metadata */}
            <div className="text-xs text-zinc-600 space-y-1">
              <p>Created: {new Date(compilation.created_at).toLocaleString()}</p>
              {compilation.completed_at && (
                <p>Completed: {new Date(compilation.completed_at).toLocaleString()}</p>
              )}
              <p>Transition Duration: {compilation.transition_duration}s</p>
            </div>

            {/* Create Another */}
            <Link
              to="/compilations/new"
              className="flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors text-sm"
            >
              <Layers className="w-4 h-4" />
              Create Another Compilation
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
