import { Film, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import type { Episode } from '../lib/types';

interface EpisodeCardProps {
  episode: Episode;
  onClick: () => void;
}

export function EpisodeCard({ episode, onClick }: EpisodeCardProps) {
  const statusConfig = {
    queued: { icon: Clock, color: 'text-zinc-400', bg: 'bg-zinc-500/20', label: 'Queued' },
    generating: { icon: Loader2, color: 'text-amber-400', bg: 'bg-amber-500/20', label: 'Generating', animate: true },
    stitching: { icon: Loader2, color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Stitching', animate: true },
    done: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/20', label: 'Complete' },
    error: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/20', label: 'Error' },
  }[episode.status] || { icon: Clock, color: 'text-zinc-400', bg: 'bg-zinc-500/20', label: episode.status };

  const StatusIcon = statusConfig.icon;
  const topic = episode.script?.topic || 'Episode';
  const question = episode.script?.hook_question || 'SubwayTakes Episode';

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl border border-zinc-700 bg-zinc-800/30 p-4 hover:border-zinc-600 hover:bg-zinc-800/50 transition-all group"
    >
      <div className="flex items-start gap-4">
        <div className="relative shrink-0">
          {episode.thumbnail_url || episode.final_video_url ? (
            <div className="w-20 h-36 rounded-lg overflow-hidden bg-zinc-900">
              {episode.final_video_url ? (
                <video
                  src={episode.final_video_url}
                  className="w-full h-full object-cover"
                  muted
                />
              ) : (
                <img
                  src={episode.thumbnail_url!}
                  alt=""
                  className="w-full h-full object-cover"
                />
              )}
            </div>
          ) : (
            <div className="w-20 h-36 rounded-lg bg-zinc-800 flex items-center justify-center">
              <Film className="h-8 w-8 text-zinc-600" />
            </div>
          )}

          <div className={`absolute -bottom-1 -right-1 p-1.5 rounded-full ${statusConfig.bg}`}>
            <StatusIcon className={`h-3.5 w-3.5 ${statusConfig.color} ${statusConfig.animate ? 'animate-spin' : ''}`} />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-amber-400 uppercase tracking-wider">
              {topic}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${statusConfig.bg} ${statusConfig.color}`}>
              {statusConfig.label}
            </span>
          </div>

          <h3 className="font-medium text-zinc-200 mb-2 line-clamp-2 group-hover:text-zinc-100 transition">
            {question}
          </h3>

          <div className="flex items-center gap-4 text-xs text-zinc-500">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {episode.total_duration_seconds}s
            </span>
            <span className="flex items-center gap-1">
              <Film className="h-3.5 w-3.5" />
              6 shots
            </span>
            <span className="uppercase">
              {episode.city_style}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
