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
  type MuapiCaptionLanguage,
  type MuapiCaptionTheme,
} from '../../lib/studioCaptions';
import { captionPoll, captionSubmit, describeError } from '../../lib/studioProjects';
import type { StudioRenderController } from '../../hooks/useStudioProject';

export interface CaptionPanelProps {
  project: StudioProject;
  projectId: string | null;
  dispatch(action: StudioAction): void;
  render: StudioRenderController;
}

const POLL_INTERVAL_MS = 5000;

export function CaptionPanel({ project, projectId, dispatch, render }: CaptionPanelProps) {
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;

  const [language, setLanguage] = useState<MuapiCaptionLanguage>(DEFAULT_MUAPI_LANGUAGE);
  const [theme, setTheme] = useState<MuapiCaptionTheme>(DEFAULT_MUAPI_THEME);
  const [captionJobId, setCaptionJobId] = useState<string | null>(null);
  const [captionStatus, setCaptionStatus] = useState<string | null>(null);
  const [captionedUrl, setCaptionedUrl] = useState<string | null>(null);
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
            kind: caption.kind === 'hook' || caption.kind === 'lower_third' ? caption.kind : 'dialogue',
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
          const state = await captionPoll(activeProjectId, jobId);
          setCaptionStatus(state.status);
          if (state.status === 'completed') {
            stopPolling();
            setBusy(false);
            if (state.outputUrl) setCaptionedUrl(state.outputUrl);
            if (state.captions.length) replaceCaptions(state.captions);
            if (!state.outputUrl && !state.captions.length) {
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
    try {
      const jobId = await captionSubmit({
        projectId: activeProjectId,
        mode: 'editable',
        language,
        theme,
        videoUrl,
      });
      setCaptionJobId(jobId);
      setCaptionStatus('pending');
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
      caption: captionFromText('New caption', lastEnd, lastEnd + 2),
    });
  };

  const renderStatusLabel = render.job
    ? `${render.job.status}${render.job.progress ? ` · ${render.job.progress}%` : ''}`
    : 'no render yet';

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
            {busy && captionStatus !== 'pending' && captionStatus !== 'processing' ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Type className="h-3 w-3" />
            )}
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
          <p className="mt-2 text-[11px] text-zinc-400">
            Caption job {captionJobId.slice(0, 8)} — {captionStatus}
          </p>
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

        {project.captions.map((caption) => (
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
            </div>
          )}
        </div>
      )}
    </div>
  );
}
