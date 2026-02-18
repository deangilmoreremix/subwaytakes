import { useState, useEffect } from 'react';
import { ArrowLeft, Download, Share2, Clock, DollarSign, Film, CheckCircle, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { getEpisodeById } from '../lib/episodes';
import { triggerComposeOverlay } from '../lib/templates';
import type { Episode, EpisodeShot } from '../lib/types';

interface EpisodePageProps {
  episodeId: string;
  onBack: () => void;
}

export function EpisodePage({ episodeId, onBack }: EpisodePageProps) {
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);

  useEffect(() => {
    loadEpisode();
    const interval = setInterval(loadEpisode, 5000);
    return () => clearInterval(interval);
  }, [episodeId]);

  async function loadEpisode() {
    try {
      const data = await getEpisodeById(episodeId);
      setEpisode(data);
      if (data?.status === 'done' || data?.status === 'error') {
        setLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load episode');
      setLoading(false);
    }
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center">
          <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-3" />
          <p className="text-red-400">{error}</p>
          <button
            onClick={onBack}
            className="mt-4 text-sm text-zinc-400 hover:text-zinc-200"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!episode) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
        </div>
      </div>
    );
  }

  const completedShots = episode.shots?.filter(s => s.status === 'done').length || 0;
  const totalShots = episode.shots?.length || 6;
  const progress = (completedShots / totalShots) * 100;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Library
      </button>

      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-semibold text-zinc-100">
              {episode.script?.topic ? `${episode.script.topic.charAt(0).toUpperCase()}${episode.script.topic.slice(1)} Episode` : 'Episode'}
            </h1>
            <StatusBadge status={episode.status} />
          </div>
          <p className="text-sm text-zinc-400">
            {episode.script?.hook_question || 'SubwayTakes Episode'}
          </p>
        </div>

        {episode.status === 'done' && episode.final_video_url && (
          <div className="flex gap-2">
            <a
              href={episode.composed_video_url || episode.final_video_url}
              download
              className="flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-600 transition"
            >
              <Download className="h-4 w-4" />
              Download
            </a>
            <button className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-black hover:bg-amber-400 transition">
              <Share2 className="h-4 w-4" />
              Share
            </button>
          </div>
        )}
      </div>

      {(episode.status === 'generating' || episode.status === 'stitching' || episode.status === 'queued') && (
        <div className="rounded-xl border border-zinc-700 bg-zinc-800/30 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Film className="h-5 w-5 text-amber-500 animate-pulse" />
              </div>
              <div>
                <div className="font-medium text-zinc-200">
                  {episode.status === 'stitching' ? 'Stitching Videos' : 'Generating Shots'}
                </div>
                <div className="text-sm text-zinc-500">
                  {episode.status === 'stitching'
                    ? 'Combining all shots into final video...'
                    : `${completedShots} of ${totalShots} shots complete`}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-semibold text-amber-500">{Math.round(progress)}%</div>
            </div>
          </div>

          <div className="w-full h-2 bg-zinc-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all duration-500"
              style={{ width: `${episode.status === 'stitching' ? 90 : progress}%` }}
            />
          </div>
        </div>
      )}

      {episode.status === 'done' && episode.final_video_url && (
        <div className="mb-6 space-y-3">
          {!episode.composed_video_url && episode.template_id && (
            <div className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
              <span className="text-sm text-amber-400">Branding overlay has not been applied yet.</span>
              <button
                onClick={async () => {
                  setComposing(true);
                  await triggerComposeOverlay(episodeId);
                  setComposing(false);
                }}
                disabled={composing}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-50 transition-colors"
              >
                {composing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {composing ? 'Applying...' : 'Apply Branding'}
              </button>
            </div>
          )}

          <div className="rounded-xl border border-zinc-700 bg-zinc-900 overflow-hidden">
            <video
              src={episode.composed_video_url || episode.final_video_url}
              controls
              className="w-full aspect-[9/16] max-h-[600px] mx-auto bg-black"
              poster={episode.thumbnail_url || undefined}
            />
          </div>
        </div>
      )}

      {episode.status === 'error' && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 mb-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-6 w-6 text-red-400" />
            <div>
              <div className="font-medium text-red-400">Generation Failed</div>
              <div className="text-sm text-red-400/70">{episode.error || 'An error occurred during generation'}</div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 mb-6">
        <div className="rounded-xl border border-zinc-700 bg-zinc-800/30 p-4">
          <div className="flex items-center gap-2 text-zinc-400 mb-2">
            <Clock className="h-4 w-4" />
            <span className="text-sm">Duration</span>
          </div>
          <div className="text-xl font-semibold text-zinc-100">{episode.total_duration_seconds}s</div>
        </div>

        <div className="rounded-xl border border-zinc-700 bg-zinc-800/30 p-4">
          <div className="flex items-center gap-2 text-zinc-400 mb-2">
            <Film className="h-4 w-4" />
            <span className="text-sm">Shots</span>
          </div>
          <div className="text-xl font-semibold text-zinc-100">{totalShots} shots</div>
        </div>

        <div className="rounded-xl border border-zinc-700 bg-zinc-800/30 p-4">
          <div className="flex items-center gap-2 text-zinc-400 mb-2">
            <DollarSign className="h-4 w-4" />
            <span className="text-sm">City Style</span>
          </div>
          <div className="text-xl font-semibold text-zinc-100 uppercase">{episode.city_style}</div>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-700 bg-zinc-800/30 p-6">
        <h3 className="font-medium text-zinc-200 mb-4">Shot Breakdown</h3>
        <div className="space-y-3">
          {episode.shots?.map((shot) => (
            <ShotRow key={shot.id} shot={shot} />
          ))}
        </div>
      </div>

      {episode.caption_file_url && (
        <div className="mt-6">
          <a
            href={episode.caption_file_url}
            download
            className="flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 transition"
          >
            <Download className="h-4 w-4" />
            Download Captions (SRT)
          </a>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    queued: { bg: 'bg-zinc-500/20', text: 'text-zinc-400', label: 'Queued' },
    generating: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Generating' },
    stitching: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Stitching' },
    done: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Complete' },
    error: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Error' },
  }[status] || { bg: 'bg-zinc-500/20', text: 'text-zinc-400', label: status };

  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}

function ShotRow({ shot }: { shot: EpisodeShot }) {
  const shotLabels: Record<string, string> = {
    cold_open: 'Cold Open',
    guest_answer: 'Guest Answer',
    follow_up: 'Follow Up',
    reaction: 'Reaction',
    b_roll: 'B-Roll',
    close: 'Close',
  };

  return (
    <div className="flex items-center gap-4 p-3 rounded-lg bg-zinc-800/50">
      <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-sm text-zinc-400">
        {shot.sequence}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-zinc-200">{shotLabels[shot.shot_type] || shot.shot_type}</span>
          <span className="text-xs text-zinc-500">{shot.duration_seconds}s</span>
          {shot.speaker && (
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              shot.speaker === 'host' ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'
            }`}>
              {shot.speaker}
            </span>
          )}
        </div>
        {shot.dialogue && (
          <p className="text-sm text-zinc-500 truncate mt-0.5">{shot.dialogue}</p>
        )}
      </div>

      <div className="shrink-0">
        {shot.status === 'done' && <CheckCircle className="h-5 w-5 text-emerald-500" />}
        {shot.status === 'running' && <Loader2 className="h-5 w-5 text-amber-500 animate-spin" />}
        {shot.status === 'queued' && <Clock className="h-5 w-5 text-zinc-500" />}
        {shot.status === 'error' && <AlertCircle className="h-5 w-5 text-red-500" />}
      </div>

      {shot.status === 'done' && shot.result_url && (
        <video
          src={shot.result_url}
          className="w-16 h-28 rounded object-cover bg-zinc-900"
          muted
        />
      )}
    </div>
  );
}
