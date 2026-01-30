import { Play, Clock, AlertCircle, Layers } from 'lucide-react';
import type { Clip } from '../lib/types';
import { clsx, prettyType, formatDate } from '../lib/format';

interface ClipGridProps {
  clips: Clip[];
  onSelectClip: (clipId: string) => void;
}

function StatusBadge({ status }: { status: Clip['status'] }) {
  const config = {
    queued: { text: 'Queued', className: 'border-zinc-700 bg-zinc-900 text-zinc-300' },
    running: { text: 'Generating', className: 'border-amber-500/40 bg-amber-500/10 text-amber-300' },
    done: { text: 'Done', className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' },
    error: { text: 'Error', className: 'border-rose-500/40 bg-rose-500/10 text-rose-300' },
  };

  const { text, className } = config[status];

  return (
    <span className={clsx('rounded-full border px-2 py-0.5 text-xs font-medium', className)}>
      {text}
    </span>
  );
}

export function ClipGrid({ clips, onSelectClip }: ClipGridProps) {
  if (clips.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-8 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
          <Play className="h-5 w-5 text-zinc-500" />
        </div>
        <p className="text-sm text-zinc-400">No clips yet</p>
        <p className="mt-1 text-xs text-zinc-500">Generate your first clip to see it here</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {clips.map((clip) => (
        <button
          key={clip.id}
          onClick={() => onSelectClip(clip.id)}
          className="group rounded-2xl border border-zinc-800 bg-zinc-900/30 p-3 text-left transition hover:bg-zinc-900/50 hover:border-zinc-700"
        >
          <div className="aspect-[9/16] w-full overflow-hidden rounded-xl bg-zinc-950 relative">
            {clip.result_url ? (
              <>
                <video
                  src={clip.result_url}
                  className="h-full w-full object-cover"
                  muted
                  playsInline
                />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Play className="h-5 w-5 text-white ml-0.5" />
                  </div>
                </div>
              </>
            ) : clip.status === 'error' ? (
              <div className="flex h-full w-full items-center justify-center">
                <AlertCircle className="h-8 w-8 text-rose-400/50" />
              </div>
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <div className="text-center">
                  <div className="w-8 h-8 mx-auto border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
                  <p className="mt-3 text-xs text-zinc-500">Generating...</p>
                </div>
              </div>
            )}

            {clip.batch_id && (
              <div className="absolute top-2 left-2 flex items-center gap-1 bg-amber-500/90 text-black text-xs font-medium px-2 py-0.5 rounded-full">
                <Layers className="w-3 h-3" />
                {clip.batch_sequence && `#${clip.batch_sequence}`}
              </div>
            )}
          </div>

          <div className="mt-3 flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-200">
                {clip.interview_question || clip.topic}
              </p>
              <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                <span>{prettyType(clip.video_type)}</span>
                <span className="text-zinc-700">|</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {clip.duration_seconds}s
                </span>
              </div>
            </div>
            <StatusBadge status={clip.status} />
          </div>

          <p className="mt-2 text-xs text-zinc-600">
            {formatDate(clip.created_at)}
          </p>
        </button>
      ))}
    </div>
  );
}
