import { Download, Film, Loader2 } from 'lucide-react';

import type { StudioProject } from '../../studio/types';
import type { StudioRenderController } from '../../hooks/useStudioProject';

export interface ExportPanelProps {
  project: StudioProject;
  projectId: string | null;
  render: StudioRenderController;
}

function statusClass(status: string): string {
  switch (status) {
    case 'done':
      return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300';
    case 'error':
      return 'border-rose-500/40 bg-rose-500/10 text-rose-300';
    case 'running':
      return 'border-sky-500/40 bg-sky-500/10 text-sky-300';
    default:
      return 'border-zinc-600/50 bg-zinc-700/30 text-zinc-300';
  }
}

export function ExportPanel({ project, projectId, render }: ExportPanelProps) {
  const job = render.job;
  const busy = render.busy || job?.status === 'queued' || job?.status === 'running';

  return (
    <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
      <div>
        <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-300">
          <Film className="h-4 w-4 text-amber-400" /> Export MP4
        </h3>
        <p className="mt-1 text-xs text-zinc-500">
          The render worker snapshots this project and renders it at {project.width}×
          {project.height}, {project.fps}fps.
        </p>
      </div>

      <button
        type="button"
        disabled={busy || !projectId}
        onClick={() => void render.startRender()}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-300 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
        {busy ? 'Rendering…' : 'Render MP4'}
      </button>

      {job && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] text-zinc-400">
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${statusClass(job.status)}`}
            >
              {job.status}
            </span>
            <span className="tabular-nums">{job.progress}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-amber-500 transition-all"
              style={{ width: `${Math.min(100, Math.max(0, job.progress))}%` }}
            />
          </div>
          <p className="text-[11px] text-zinc-500">
            Job {job.id.slice(0, 8)}
            {job.worker_id ? ` · worker ${job.worker_id}` : ''}
          </p>
        </div>
      )}

      {render.note && <p className="text-[11px] text-sky-300">{render.note}</p>}

      {render.error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2">
          <p className="text-xs text-rose-300">{render.error}</p>
        </div>
      )}

      {job?.status === 'error' && job.error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2">
          <p className="text-xs text-rose-300">Render worker: {job.error}</p>
        </div>
      )}

      {job?.status === 'done' && job.output_url && (
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-wide text-emerald-400">Render finished</p>
          <video
            src={job.output_url}
            controls
            className="max-h-72 w-full rounded-xl border border-zinc-800 bg-black"
          />
          <a
            href={job.output_url}
            download
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
          >
            <Download className="h-3 w-3" /> Download MP4
          </a>
        </div>
      )}

      {!projectId && (
        <p className="text-[11px] text-zinc-500">
          The project is still being created — exporting unlocks after the first autosave.
        </p>
      )}
    </div>
  );
}
