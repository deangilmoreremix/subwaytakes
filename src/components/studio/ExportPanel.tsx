import { useCallback, useEffect, useState } from 'react';
import { Download, Film, Loader2, RefreshCw } from 'lucide-react';

import type { StudioProject } from '../../studio/types';
import type { StudioRenderController } from '../../hooks/useStudioProject';
import { resolveRenderJobMedia } from '../../lib/studioProjects';

export interface ExportPanelProps {
  project: StudioProject;
  projectId: string | null;
  render: StudioRenderController;
  /**
   * Re-signs every media URL of the project. Called right before a render is
   * enqueued so the snapshot the worker renders resolves fresh, and never
   * blocks the UI (the button shows its own spinner while it runs).
   */
  onRefreshMedia?: () => Promise<void>;
  /** True while a media refresh pass is in flight. */
  mediaRefreshing?: boolean;
  /** Message of the last failed media refresh pass. */
  mediaError?: string | null;
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

export function ExportPanel({
  project,
  projectId,
  render,
  onRefreshMedia,
  mediaRefreshing = false,
  mediaError,
}: ExportPanelProps) {
  const job = render.job;
  const busy = render.busy || job?.status === 'queued' || job?.status === 'running';

  /**
   * Fresh download URL for a finished job. The job row keeps the canonical
   * `output_ref` plus the last signed URL; we re-sign the ref here so the
   * download link never 404s on an expired URL. A job is only "finished" once
   * its row says `done` — nothing below claims success otherwise.
   */
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!job || job.status !== 'done') {
      setDownloadUrl(null);
      return;
    }
    let active = true;
    void resolveRenderJobMedia(job)
      .then((resolved) => {
        if (!active) return;
        setDownloadUrl(resolved.outputUrl ?? job.output_url ?? null);
      })
      .catch(() => {
        if (active) setDownloadUrl(job.output_url ?? null);
      });
    return () => {
      active = false;
    };
  }, [job]);

  const handleRender = useCallback(async () => {
    if (onRefreshMedia) {
      try {
        await onRefreshMedia();
      } catch {
        /* a refresh failure must not block the render: the worker re-signs too */
      }
    }
    await render.startRender();
  }, [onRefreshMedia, render]);

  return (
    <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
      <div>
        <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-300">
          <Film className="h-4 w-4 text-amber-400" /> Export MP4
        </h3>
        <p className="mt-1 text-xs text-zinc-500">
          The render worker snapshots this project and renders it at {project.width}×
          {project.height}, {project.fps}fps (H.264, AAC 48kHz, +faststart). Media URLs are
          re-signed right before the job is enqueued.
        </p>
      </div>

      <button
        type="button"
        disabled={busy || !projectId}
        onClick={() => void handleRender()}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-300 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
        {busy ? 'Rendering…' : 'Render MP4'}
      </button>

      {mediaRefreshing && (
        <p className="inline-flex items-center gap-1.5 text-[11px] text-sky-300">
          <RefreshCw className="h-3 w-3 animate-spin" /> Re-signing media URLs…
        </p>
      )}
      {mediaError && <p className="text-[11px] text-amber-300">{mediaError}</p>}

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
            {job.status === 'queued' ? ' · waiting for a worker' : ''}
            {job.status === 'running' ? ' · rendering' : ''}
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

      {job?.status === 'done' && downloadUrl && (
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-wide text-emerald-400">Render finished</p>
          <video
            src={downloadUrl}
            controls
            className="max-h-72 w-full rounded-xl border border-zinc-800 bg-black"
          />
          <a
            href={downloadUrl}
            download
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
          >
            <Download className="h-3 w-3" /> Download MP4
          </a>
          <p className="text-[10px] text-zinc-500">
            Freshly signed download URL (the stored render is a private object identified by its
            ref, not by this URL).
          </p>
        </div>
      )}

      {job?.status === 'done' && !downloadUrl && (
        <p className="text-[11px] text-amber-300">
          The render finished but no output URL could be resolved — reload the project to refresh
          the signed URL.
        </p>
      )}

      {!projectId && (
        <p className="text-[11px] text-zinc-500">
          The project is still being created — exporting unlocks after the first autosave.
        </p>
      )}
    </div>
  );
}
