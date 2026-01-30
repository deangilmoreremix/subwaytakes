import { useState } from 'react';
import { ChevronDown, Play, Clock, AlertCircle, Layers } from 'lucide-react';
import type { Clip } from '../lib/types';
import { clsx, prettyType, formatDate } from '../lib/format';

interface SeriesGroupProps {
  batchId: string;
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

function getSeriesStatus(clips: Clip[]): { done: number; total: number; hasErrors: boolean } {
  const done = clips.filter(c => c.status === 'done').length;
  const hasErrors = clips.some(c => c.status === 'error');
  return { done, total: clips.length, hasErrors };
}

export function SeriesGroup({ batchId, clips, onSelectClip }: SeriesGroupProps) {
  const [expanded, setExpanded] = useState(true);

  if (clips.length === 0) return null;

  const firstClip = clips[0];
  const { done, total, hasErrors } = getSeriesStatus(clips);
  const allDone = done === total;
  const previewClips = clips.slice(0, 4);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-zinc-800/30 transition"
      >
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="grid grid-cols-2 gap-0.5 w-16 h-16 rounded-lg overflow-hidden bg-zinc-800">
              {previewClips.map((clip, i) => (
                <div key={clip.id} className="relative bg-zinc-900">
                  {clip.result_url ? (
                    <video
                      src={clip.result_url}
                      className="w-full h-full object-cover"
                      muted
                      playsInline
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      {clip.status === 'error' ? (
                        <AlertCircle className="w-3 h-3 text-rose-400/50" />
                      ) : (
                        <div className="w-3 h-3 border border-zinc-600 border-t-zinc-400 rounded-full animate-spin" />
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="absolute -bottom-1 -right-1 flex items-center gap-1 bg-amber-500 text-black text-xs font-medium px-1.5 py-0.5 rounded-full">
              <Layers className="w-3 h-3" />
              {total}
            </div>
          </div>

          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-zinc-200">
                {firstClip.interview_question || firstClip.topic}
              </span>
              {hasErrors ? (
                <span className="text-xs text-rose-400">Has errors</span>
              ) : allDone ? (
                <span className="text-xs text-emerald-400">Complete</span>
              ) : (
                <span className="text-xs text-amber-400">{done}/{total} done</span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
              <span>{prettyType(firstClip.video_type)}</span>
              <span className="text-zinc-700">|</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {firstClip.duration_seconds}s each
              </span>
              <span className="text-zinc-700">|</span>
              <span>{formatDate(firstClip.created_at)}</span>
            </div>
          </div>
        </div>

        <ChevronDown className={clsx(
          'w-5 h-5 text-zinc-500 transition-transform',
          expanded && 'rotate-180'
        )} />
      </button>

      {expanded && (
        <div className="border-t border-zinc-800 p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {clips.map((clip) => (
              <button
                key={clip.id}
                onClick={() => onSelectClip(clip.id)}
                className="group rounded-xl border border-zinc-800 bg-zinc-900/30 p-2 text-left transition hover:bg-zinc-900/50 hover:border-zinc-700"
              >
                <div className="aspect-[9/16] w-full overflow-hidden rounded-lg bg-zinc-950 relative">
                  {clip.result_url ? (
                    <>
                      <video
                        src={clip.result_url}
                        className="h-full w-full object-cover"
                        muted
                        playsInline
                      />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                          <Play className="h-3 w-3 text-white ml-0.5" />
                        </div>
                      </div>
                    </>
                  ) : clip.status === 'error' ? (
                    <div className="flex h-full w-full items-center justify-center">
                      <AlertCircle className="h-6 w-6 text-rose-400/50" />
                    </div>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <div className="w-5 h-5 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
                    </div>
                  )}

                  <div className="absolute top-1.5 left-1.5 bg-black/60 text-white text-xs font-medium px-1.5 py-0.5 rounded">
                    #{clip.batch_sequence}
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <StatusBadge status={clip.status} />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
