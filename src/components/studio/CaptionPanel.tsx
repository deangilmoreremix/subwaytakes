import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Loader2, Subtitles, Type } from 'lucide-react';

import type { StudioCaption, StudioProject } from '../../studio/types';
import type { StudioAction } from '../../lib/studioReducer';
import {
  DEFAULT_MUAPI_LANGUAGE,
  DEFAULT_MUAPI_THEME,
  MUAPI_CAPTION_LANGUAGES,
  MUAPI_CAPTION_THEMES,
  captionFromText,
  sortByTime,
  type MuapiCaptionLanguage,
  type MuapiCaptionTheme,
} from '../../lib/studioCaptions';
import {
  CAPTION_PLACEMENT_LABELS,
  CAPTION_PLACEMENTS,
  CAPTION_STYLES,
  CAPTION_STYLE_LABELS,
  DEFAULT_CAPTION_STYLE,
  kindForPlacement,
  placementForKind,
  readCaptionStyle,
  withStyle,
  type CaptionPlacement,
  type CaptionStyle,
} from '../../studio/captionStyles';
import { isMediaRef, type MediaRef } from '../../studio/mediaRefs';
import { callEdgeFunction } from '../../lib/edgeFunctions';
import { captionSubmit, describeError } from '../../lib/studioProjects';
import type { StudioRenderController } from '../../hooks/useStudioProject';

export interface CaptionPanelProps {
  project: StudioProject;
  projectId: string | null;
  dispatch(action: StudioAction): void;
  render: StudioRenderController;
}

const POLL_INTERVAL_MS = 5000;

type CaptionJobStatus = 'queued' | 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Defensive reader for a `muapi-captions` poll payload. The function stores
 * canonical refs (`output_ref`) alongside the derived 1-hour signed URL, and
 * every field is optional server-side — nothing here may assume a field exists.
 */
interface CaptionJobPayload {
  status?: string | null;
  output_url?: string | null;
  output_ref?: unknown;
  captions?: unknown;
  error?: string | null;
}

interface CaptionJobPoll {
  status: CaptionJobStatus;
  outputUrl: string | null;
  outputRef: MediaRef | null;
  captions: StudioCaption[];
  error: string | null;
}

function normalizeCaptionJobStatus(raw: string | null | undefined): CaptionJobStatus {
  const value = (raw ?? '').toLowerCase();
  if (value === 'done' || value === 'completed' || value === 'succeeded' || value === 'success') {
    return 'completed';
  }
  if (value === 'failed' || value === 'error' || value === 'cancelled') return 'failed';
  if (value === 'queued') return 'queued';
  if (value === 'pending' || value === 'submitted') return 'pending';
  return 'processing';
}

function firstString(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return null;
}

/** Build a safe StudioCaption from untrusted provider JSON (never throws). */
function sanitizeProviderCaption(raw: unknown, index: number, fallbackId: string): StudioCaption | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const text = typeof r.text === 'string' ? r.text.trim() : '';
  if (!text) return null;
  const start = typeof r.start === 'number' && Number.isFinite(r.start) ? Math.max(0, r.start) : 0;
  const end =
    typeof r.end === 'number' && Number.isFinite(r.end) ? Math.max(start + 0.1, r.end) : start + 2;
  const kind = r.kind === 'hook' || r.kind === 'lower_third' ? r.kind : 'dialogue';
  return {
    id: typeof r.id === 'string' && r.id ? r.id : `${fallbackId}-${index}`,
    text,
    start,
    end,
    kind,
    speaker: typeof r.speaker === 'string' && r.speaker ? r.speaker : undefined,
  };
}

/** Poll a MuAPI caption job through the edge function with defensive reads. */
async function pollCaptionJob(projectId: string, jobId: string): Promise<CaptionJobPoll> {
  const response = await callEdgeFunction<CaptionJobPayload>('muapi-captions', {
    action: 'status',
    project_id: projectId,
    job_id: jobId,
  });
  const rawRef = response?.output_ref;
  const outputRef = isMediaRef(rawRef) ? rawRef : null;
  const rawCaptions = Array.isArray(response?.captions) ? (response.captions as unknown[]) : [];
  const captions = rawCaptions
    .map((entry, index) => sanitizeProviderCaption(entry, index, `cap-${jobId}`))
    .filter((caption): caption is StudioCaption => caption !== null);
  return {
    status: normalizeCaptionJobStatus(response?.status),
    outputUrl: firstString(response?.output_url, typeof rawRef === 'string' ? rawRef : null),
    outputRef,
    captions,
    error: typeof response?.error === 'string' && response.error ? response.error : null,
  };
}

const STATUS_STYLE: Record<CaptionJobStatus, string> = {
  queued: 'border-zinc-600/50 bg-zinc-700/30 text-zinc-300',
  pending: 'border-zinc-600/50 bg-zinc-700/30 text-zinc-300',
  processing: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  completed: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  failed: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
};

export function CaptionPanel({ project, projectId, dispatch, render }: CaptionPanelProps) {
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;

  const [language, setLanguage] = useState<MuapiCaptionLanguage>(DEFAULT_MUAPI_LANGUAGE);
  const [theme, setTheme] = useState<MuapiCaptionTheme>(DEFAULT_MUAPI_THEME);
  const [captionJobId, setCaptionJobId] = useState<string | null>(null);
  const [captionStatus, setCaptionStatus] = useState<CaptionJobStatus | null>(null);
  const [captionedUrl, setCaptionedUrl] = useState<string | null>(null);
  const [captionedRef, setCaptionedRef] = useState<MediaRef | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingStyled, setPendingStyled] = useState(false);

  const pollTimerRef = useRef<number | null>(null);
  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);
  useEffect(() => () => stopPolling(), [stopPolling]);

  const transcribeSource = useCallback((): string | null => {
    if (render.job?.output_url) return render.job.output_url;
    for (const kind of ['narration', 'ambient', 'music'] as const) {
      const track = project.tracks.find((entry) => entry.kind === kind);
      const clip = track?.clips.find((entry) => Boolean(entry.assetUrl));
      if (clip?.assetUrl) return clip.assetUrl;
    }
    const videoClip = project.tracks.find((track) => track.kind === 'video')?.clips.find((clip) =>
      Boolean(clip.assetUrl),
    );
    return videoClip?.assetUrl ?? null;
  }, [project, render.job]);

  const replaceCaptions = useCallback(
    (captions: StudioCaption[]) => {
      for (const caption of project.captions) {
        dispatch({ type: 'REMOVE_CAPTION', captionId: caption.id });
      }
      for (const caption of captions) {
        dispatch({
          type: 'ADD_CAPTION',
          caption: {
            id: crypto.randomUUID(),
            text: caption.text,
            start: Math.max(0, caption.start),
            end: Math.max(0.1, caption.end),
            kind: caption.kind,
            speaker: caption.speaker,
          },
        });
      }
    },
    [dispatch, project.captions],
  );

  const startCaptionPolling = useCallback(
    (jobId: string) => {
      stopPolling();
      const activeProjectId = projectIdRef.current;
      if (!activeProjectId) return;

      const tick = async () => {
        try {
          const state = await pollCaptionJob(activeProjectId, jobId);
          setCaptionStatus(state.status);
          if (state.status === 'completed') {
            stopPolling();
            setBusy(false);
            setCaptionedUrl(state.outputUrl);
            setCaptionedRef(state.outputRef);
            if (state.captions.length) replaceCaptions(state.captions);
            if (!state.outputUrl && !state.outputRef && !state.captions.length) {
              setError('Caption job finished without a result');
            }
            return;
          }
          if (state.status === 'failed') {
            stopPolling();
            setBusy(false);
            setError(state.error ?? 'Caption job failed');
          }
        } catch (err) {
          stopPolling();
          setBusy(false);
          setError(describeError(err, 'Could not poll the caption job'));
        }
      };

      void tick();
      pollTimerRef.current = window.setInterval(() => {
        void tick();
      }, POLL_INTERVAL_MS);
    },
    [replaceCaptions, stopPolling],
  );

  const submitStyled = useCallback(
    async (videoUrl: string, renderJobId: string) => {
      const activeProjectId = projectIdRef.current;
      if (!activeProjectId) return;
      setBusy(true);
      setError(null);
      setCaptionedUrl(null);
      setCaptionedRef(null);
      try {
        const jobId = await captionSubmit({
          projectId: activeProjectId,
          mode: 'styled',
          language,
          theme,
          videoUrl,
          renderJobId,
        });
        setCaptionJobId(jobId);
        setCaptionStatus('pending');
        startCaptionPolling(jobId);
      } catch (err) {
        setBusy(false);
        setError(describeError(err, 'Could not submit the captioned render'));
      }
    },
    [language, startCaptionPolling, theme],
  );

  const handleTranscribe = useCallback(async () => {
    const activeProjectId = projectIdRef.current;
    if (!activeProjectId) {
      setError('Project is still saving — wait for the first autosave, then retry.');
      return;
    }
    const videoUrl = transcribeSource();
    if (!videoUrl) {
      setError(
        'No media available to transcribe — render the project or upload narration audio first.',
      );
      return;
    }
    setBusy(true);
    setError(null);
    setCaptionStatus('pending');
    try {
      const jobId = await captionSubmit({
        projectId: activeProjectId,
        mode: 'editable',
        language,
        theme,
        videoUrl,
      });
      setCaptionJobId(jobId);
      startCaptionPolling(jobId);
    } catch (err) {
      setBusy(false);
      setError(describeError(err, 'Could not submit the transcription job'));
    }
  }, [language, startCaptionPolling, theme, transcribeSource]);

  const handleApplyStyled = useCallback(async () => {
    if (!projectIdRef.current) {
      setError('Project is still saving — wait for the first autosave, then retry.');
      return;
    }
    const existing = render.job;
    if (existing && existing.status === 'done' && existing.output_url) {
      await submitStyled(existing.output_url, existing.id);
      return;
    }
    setBusy(true);
    setError(null);
    setPendingStyled(true);
    await render.startRender();
  }, [render, submitStyled]);

  useEffect(() => {
    if (!pendingStyled) return;
    if (render.error) {
      setError(render.error);
      setPendingStyled(false);
      setBusy(false);
      return;
    }
    const row = render.job;
    if (!row) return;
    if (row.status === 'error') {
      setError(row.error ?? 'Render failed');
      setPendingStyled(false);
      setBusy(false);
      return;
    }
    if (row.status === 'done' && row.output_url) {
      setPendingStyled(false);
      void submitStyled(row.output_url, row.id);
    }
  }, [pendingStyled, render.error, render.job, submitStyled]);

  const addCaption = () => {
    const lastEnd = project.captions.reduce((max, caption) => Math.max(max, caption.end), 0);
    dispatch({
      type: 'ADD_CAPTION',
      caption: withStyle(captionFromText('New caption', lastEnd, lastEnd + 2), DEFAULT_CAPTION_STYLE),
    });
  };

  /**
   * UPDATE_CAPTION treats a style-only change as a no-op (its equality check
   * covers text/kind/speaker/times, not the style field), so a restyle is
   * applied as remove + re-add with the SAME caption id: every field and the
   * id survive, the timeline action stays stable, and only undo gains a step.
   */
  const applyCaptionStyle = (caption: StudioCaption, style: CaptionStyle) => {
    if (readCaptionStyle(caption) === style) return;
    dispatch({ type: 'REMOVE_CAPTION', captionId: caption.id });
    dispatch({ type: 'ADD_CAPTION', caption: withStyle(caption, style) });
  };

  const setCaptionPlacement = (caption: StudioCaption, placement: CaptionPlacement) => {
    const kind = kindForPlacement(placement);
    if (caption.kind === kind) return;
    dispatch({
      type: 'UPDATE_CAPTION',
      captionId: caption.id,
      updates: { ...withStyle(caption, readCaptionStyle(caption)), kind },
    });
  };

  const renderStatusLabel = render.job
    ? `${render.job.status}${render.job.progress ? ` · ${render.job.progress}%` : ''}`
    : 'no render yet';

  const orderedCaptions = sortByTime(project.captions);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-300">
            <Subtitles className="h-4 w-4 text-rose-400" /> Captions
          </h3>
          <button
            type="button"
            onClick={addCaption}
            className="rounded-lg border border-zinc-700 bg-zinc-800/60 px-2.5 py-1 text-[11px] font-medium text-zinc-200 transition hover:border-rose-500/50 hover:text-rose-300"
          >
            Add caption
          </button>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-zinc-400">Language</span>
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value as MuapiCaptionLanguage)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 focus:border-rose-500/50 focus:outline-none focus:ring-1 focus:ring-rose-500/50"
            >
              {MUAPI_CAPTION_LANGUAGES.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-zinc-400">Theme (burned-in style)</span>
            <select
              value={theme}
              onChange={(event) => setTheme(event.target.value as MuapiCaptionTheme)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 focus:border-rose-500/50 focus:outline-none focus:ring-1 focus:ring-rose-500/50"
            >
              {MUAPI_CAPTION_THEMES.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleTranscribe()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/50 bg-rose-500/10 px-3 py-1.5 text-[11px] font-semibold text-rose-300 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Type className="h-3 w-3" />}
            Transcribe audio
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleApplyStyled()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold text-amber-300 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Subtitles className="h-3 w-3" />}
            Apply MuAPI captions to rendered video
          </button>
        </div>

        <p className="mt-2 text-[11px] text-zinc-500">
          Render status: {renderStatusLabel}. Styled captions are burned into the rendered MP4; the
          transcribed captions fill the editable caption list below.
        </p>

        {render.error && (
          <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2">
            <p className="text-xs text-rose-300">{render.error}</p>
          </div>
        )}
        {render.note && <p className="mt-2 text-[11px] text-sky-300">{render.note}</p>}
        {error && (
          <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2">
            <p className="text-xs text-rose-300">{error}</p>
          </div>
        )}
        {captionJobId && captionStatus && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${STATUS_STYLE[captionStatus]}`}
            >
              {captionStatus}
            </span>
            <span className="text-[11px] text-zinc-400">
              Caption job {captionJobId.slice(0, 8)}
              {captionStatus === 'completed' || captionStatus === 'failed'
                ? ' — finished'
                : ` — polling every ${POLL_INTERVAL_MS / 1000}s`}
            </span>
          </div>
        )}
        {pendingStyled && (
          <p className="mt-2 text-[11px] text-amber-300">
            Waiting for the render to finish before submitting styled captions…
          </p>
        )}
      </div>

      <div className="space-y-2">
        {project.captions.length === 0 && (
          <p className="rounded-2xl border border-dashed border-zinc-700 px-4 py-6 text-center text-xs text-zinc-500">
            No captions yet. Transcribe the audio or add one manually.
          </p>
        )}

        {orderedCaptions.map((caption) => (
          <div
            key={caption.id}
            className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-rose-300">
                {caption.kind.replace('_', ' ')}
              </span>
              <button
                type="button"
                onClick={() => dispatch({ type: 'REMOVE_CAPTION', captionId: caption.id })}
                className="text-[11px] text-rose-400 hover:text-rose-300"
              >
                Remove
              </button>
            </div>
            <textarea
              rows={2}
              value={caption.text}
              onChange={(event) =>
                dispatch({
                  type: 'UPDATE_CAPTION',
                  captionId: caption.id,
                  updates: { text: event.target.value },
                })
              }
              className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 focus:border-rose-500/50 focus:outline-none focus:ring-1 focus:ring-rose-500/50"
            />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-[10px] uppercase tracking-wide text-zinc-500">
                  Start (s)
                </span>
                <input
                  type="number"
                  step={0.1}
                  min={0}
                  value={caption.start}
                  onChange={(event) =>
                    dispatch({
                      type: 'UPDATE_CAPTION',
                      captionId: caption.id,
                      updates: { start: Math.max(0, Number(event.target.value)) },
                    })
                  }
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-2 py-1 text-xs text-zinc-100 focus:border-rose-500/50 focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] uppercase tracking-wide text-zinc-500">
                  End (s)
                </span>
                <input
                  type="number"
                  step={0.1}
                  min={0}
                  value={caption.end}
                  onChange={(event) =>
                    dispatch({
                      type: 'UPDATE_CAPTION',
                      captionId: caption.id,
                      updates: { end: Math.max(caption.start + 0.1, Number(event.target.value)) },
                    })
                  }
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-2 py-1 text-xs text-zinc-100 focus:border-rose-500/50 focus:outline-none"
                />
              </label>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-[10px] uppercase tracking-wide text-zinc-500">
                  Placement
                </span>
                <select
                  value={placementForKind(caption.kind)}
                  onChange={(event) =>
                    setCaptionPlacement(caption, event.target.value as CaptionPlacement)
                  }
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-2 py-1 text-xs text-zinc-100 focus:border-rose-500/50 focus:outline-none"
                >
                  {CAPTION_PLACEMENTS.map((placement) => (
                    <option key={placement} value={placement}>
                      {CAPTION_PLACEMENT_LABELS[placement]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] uppercase tracking-wide text-zinc-500">
                  Style
                </span>
                <select
                  value={readCaptionStyle(caption)}
                  onChange={(event) =>
                    applyCaptionStyle(caption, event.target.value as CaptionStyle)
                  }
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-2 py-1 text-xs text-zinc-100 focus:border-rose-500/50 focus:outline-none"
                >
                  {CAPTION_STYLES.map((style) => (
                    <option key={style} value={style}>
                      {CAPTION_STYLE_LABELS[style]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        ))}
      </div>

      {(render.job?.output_url || captionedUrl) && (
        <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
          <h3 className="text-sm font-semibold text-zinc-300">Rendered output</h3>
          {render.job?.output_url && (
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">Original render</p>
              <video
                src={render.job.output_url}
                controls
                className="max-h-64 w-full rounded-xl border border-zinc-800 bg-black"
              />
              <a
                href={render.job.output_url}
                download
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-1.5 text-[11px] font-medium text-zinc-200 transition hover:border-amber-500/50 hover:text-amber-300"
              >
                <Download className="h-3 w-3" /> Download original
              </a>
            </div>
          )}
          {captionedUrl && (
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-wide text-amber-400">
                Captioned with {theme} · {language}
              </p>
              <video
                src={captionedUrl}
                controls
                className="max-h-64 w-full rounded-xl border border-amber-500/40 bg-black"
              />
              <a
                href={captionedUrl}
                download
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold text-amber-300 transition hover:bg-amber-500/20"
              >
                <Download className="h-3 w-3" /> Download captioned version
              </a>
              {captionedRef && (
                <p className="text-[11px] text-emerald-300">
                  Stored durably ({captionedRef.bucket}/{captionedRef.path}) — the link above is a
                  fresh 1-hour signed URL and can be re-signed at any time.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
