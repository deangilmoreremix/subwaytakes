import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Player } from '@remotion/player';
import type { PlayerRef } from '@remotion/player';
import { Loader2, Redo2, Save, Undo2, Video } from 'lucide-react';

import { SubwayEditorComposition, projectDurationInFrames } from '../../studio/SubwayEditorComposition';
import { useStudioProject, useStudioRender } from '../../hooks/useStudioProject';
import { useMediaUrls } from '../../hooks/useMediaUrls';
import {
  StudioTimeline,
  type StudioSelection,
} from '../../components/studio/StudioTimeline';
import { ClipInspector } from '../../components/studio/ClipInspector';
import { SceneGeneratePanel } from '../../components/studio/SceneGeneratePanel';
import { UploadFootagePanel } from '../../components/studio/UploadFootagePanel';
import { CaptionPanel } from '../../components/studio/CaptionPanel';
import { BrandingPanel } from '../../components/studio/BrandingPanel';
import { ExportPanel } from '../../components/studio/ExportPanel';
import { projectDurationSeconds } from '../../lib/studioProjects';

type StudioTab = 'scenes' | 'upload' | 'captions' | 'branding' | 'export';

const TABS: Array<{ id: StudioTab; label: string }> = [
  { id: 'scenes', label: 'Scenes' },
  { id: 'upload', label: 'Upload' },
  { id: 'captions', label: 'Captions' },
  { id: 'branding', label: 'Branding' },
  { id: 'export', label: 'Export' },
];

const SAVE_CHIP: Record<string, string> = {
  saved: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  saving: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  unsaved: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  error: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
};

const SAVE_LABEL: Record<string, string> = {
  saved: 'Saved',
  saving: 'Saving…',
  unsaved: 'Unsaved changes',
  error: 'Save failed',
};

/** Minimum gap between two media refresh passes (ms) — avoids re-sign storms. */
const MEDIA_REFRESH_MIN_INTERVAL_MS = 30_000;

/** True when the keystroke came from a text field (never hijack those). */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  );
}

export function SubwayEditorPage() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const {
    project,
    dispatch,
    undo,
    redo,
    canUndo,
    canRedo,
    status,
    error,
    saveStatus,
    saveError,
    saveNow,
    projectId: resolvedProjectId,
  } = useStudioProject(projectId);
  const render = useStudioRender(resolvedProjectId, project);

  // -------------------------------------------------------------------------
  // Media: clips store canonical refs + derived URLs. The resolver keeps the
  // derived URLs fresh (media-sign edge function, ownership verified server
  // side); the player always renders from `playerProject` below.
  // -------------------------------------------------------------------------
  const { resolvedUrls, refreshing: mediaRefreshing, refresh: refreshMedia, lastError: mediaError } =
    useMediaUrls(project);

  const lastMediaRefreshRef = useRef(0);
  useEffect(() => {
    const wake = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      if (Date.now() - lastMediaRefreshRef.current < MEDIA_REFRESH_MIN_INTERVAL_MS) return;
      lastMediaRefreshRef.current = Date.now();
      void refreshMedia();
    };
    // Warm the cache on mount ...
    wake();
    // ... and again whenever the tab regains focus/visibility, so a project
    // left open across a tab switch never shows expired previews.
    window.addEventListener('focus', wake);
    document.addEventListener('visibilitychange', wake);
    return () => {
      window.removeEventListener('focus', wake);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [refreshMedia]);

  const playerRef = useRef<PlayerRef>(null);
  const [playhead, setPlayhead] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selection, setSelection] = useState<StudioSelection | null>(null);
  const [activeTab, setActiveTab] = useState<StudioTab>('scenes');
  const [titleDraft, setTitleDraft] = useState(project.title);

  /**
   * The title commits on a short debounce as well as on blur/Enter: a typed
   * title that is never blurred used to be lost (nothing dispatched, nothing
   * autosaved).
   */
  useEffect(() => {
    if (titleDraft === project.title) return;
    const timer = setTimeout(() => dispatch({ type: 'SET_TITLE', title: titleDraft }), 400);
    return () => clearTimeout(timer);
  }, [titleDraft, project.title, dispatch]);

  const fps = project.fps;
  const durationInFrames = useMemo(() => projectDurationInFrames(project), [project]);
  const totalSeconds = useMemo(() => projectDurationSeconds(project), [project]);

  /**
   * The project handed to the player: every clip's derived `assetUrl`
   * (and the branding logo URL) is replaced by the freshly resolved session
   * URL, falling back to the stored value. Memoised so the 10fps playhead
   * ticks and unrelated re-renders never rebuild the player subtree.
   */
  const playerProject = useMemo(() => {
    const logoUrl = resolvedUrls.get('branding.logo');
    return {
      ...project,
      tracks: project.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => {
          if (!clip.assetUrl && !clip.assetRef) return clip;
          const key = clip.assetUrl || clip.assetRef!.path;
          const resolved = resolvedUrls.get(key);
          return resolved && resolved !== clip.assetUrl ? { ...clip, assetUrl: resolved } : clip;
        }),
      })),
      branding:
        logoUrl && logoUrl !== project.branding.logoUrl
          ? { ...project.branding, logoUrl }
          : project.branding,
    };
  }, [project, resolvedUrls]);

  // The player subtree is memoised so playhead ticks (10fps) do not re-render it.
  const player = useMemo(
    () => (
      <Player
        ref={playerRef}
        component={SubwayEditorComposition}
        inputProps={{ project: playerProject }}
        durationInFrames={durationInFrames}
        compositionWidth={project.width}
        compositionHeight={project.height}
        fps={fps}
        controls
        loop
        initiallyMuted
        acknowledgeRemotionLicense
        style={{ width: '100%', height: '100%' }}
      />
    ),
    [playerProject, durationInFrames, fps, project.width, project.height],
  );

  useEffect(() => {
    setTitleDraft(project.title);
  }, [project.title]);

  const lastFrameUpdateRef = useRef(0);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const onFrame = (event: { detail: { frame: number } }) => {
      const now = performance.now();
      if (now - lastFrameUpdateRef.current < 100) return;
      lastFrameUpdateRef.current = now;
      setPlayhead(event.detail.frame / fps);
    };
    const onSeeked = (event: { detail: { frame: number } }) => {
      setPlayhead(event.detail.frame / fps);
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    player.addEventListener('frameupdate', onFrame);
    player.addEventListener('seeked', onSeeked);
    player.addEventListener('play', onPlay);
    player.addEventListener('pause', onPause);
    player.addEventListener('ended', onPause);
    return () => {
      player.removeEventListener('frameupdate', onFrame);
      player.removeEventListener('seeked', onSeeked);
      player.removeEventListener('play', onPlay);
      player.removeEventListener('pause', onPause);
      player.removeEventListener('ended', onPause);
    };
  }, [fps, status]);

  const seekTo = useCallback(
    (seconds: number) => {
      const clamped = Math.max(0, Math.min(seconds, totalSeconds));
      setPlayhead(clamped);
      playerRef.current?.seekTo(Math.round(clamped * fps));
    },
    [fps, totalSeconds],
  );

  useEffect(() => {
    if (playhead > totalSeconds) setPlayhead(totalSeconds);
  }, [playhead, totalSeconds]);

  // Replace the `/new` route with the created project id so a refresh keeps it.
  useEffect(() => {
    if (projectId === 'new' && resolvedProjectId) {
      navigate(`/studio/subway-editor/${resolvedProjectId}`, { replace: true });
    }
  }, [projectId, navigate, resolvedProjectId]);

  // Editor-wide shortcuts: undo/redo (also the undo path for every delete,
  // split, duplicate and trim), split at the playhead and save now.
  const playheadRef = useRef(playhead);
  playheadRef.current = playhead;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (mod && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && key === 'y') {
        event.preventDefault();
        redo();
        return;
      }
      if (mod && key === 's') {
        event.preventDefault();
        void saveNow();
        return;
      }
      if (key === 's' && selection?.kind === 'clip') {
        event.preventDefault();
        dispatch({ type: 'SPLIT_CLIP', clipId: selection.id, atSeconds: playheadRef.current });
        return;
      }
      if ((key === 'delete' || key === 'backspace') && selection) {
        event.preventDefault();
        if (selection.kind === 'caption') {
          dispatch({ type: 'REMOVE_CAPTION', captionId: selection.id });
        } else {
          dispatch({ type: 'REMOVE_CLIP', clipId: selection.id });
        }
        setSelection(null);
        return;
      }
      if (key === 'd' && selection?.kind === 'clip') {
        event.preventDefault();
        dispatch({ type: 'DUPLICATE_CLIP', clipId: selection.id });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dispatch, redo, saveNow, selection, setSelection, undo]);

  const startRender = render.startRender;
  const handleExport = useCallback(async () => {
    setActiveTab('export');
    // Same contract as the Export panel: re-sign media before the snapshot is
    // taken, then enqueue. A failed refresh must not block the render — the
    // worker re-signs server-side anyway.
    try {
      await refreshMedia();
    } catch {
      /* ignore: the worker resolves media itself */
    }
    await startRender();
  }, [refreshMedia, startRender]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6">
          <h2 className="text-lg font-semibold text-rose-200">Could not open this project</h2>
          <p className="mt-2 text-sm text-rose-300">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg border border-rose-500/40 px-3 py-1.5 text-xs font-medium text-rose-200 transition hover:bg-rose-500/20"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const renderStatus = render.job?.status ?? (render.busy ? 'queued' : 'idle');

  return (
    <div className="mx-auto max-w-[1700px] px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
        <input
          value={titleDraft}
          onChange={(event) => setTitleDraft(event.target.value)}
          onBlur={() => dispatch({ type: 'SET_TITLE', title: titleDraft })}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
          className="min-w-0 flex-1 rounded-xl border border-transparent bg-transparent px-2 py-1 text-lg font-semibold text-zinc-100 hover:border-zinc-700 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
        />

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${SAVE_CHIP[saveStatus]}`}
            title={saveError ?? undefined}
          >
            {SAVE_LABEL[saveStatus]}
          </span>
          <span className="rounded-full border border-zinc-700 bg-zinc-800/40 px-2.5 py-1 text-[11px] font-medium text-zinc-300">
            render: {renderStatus}
            {render.job ? ` · ${render.job.progress}%` : ''}
          </span>
          <span
            className="rounded-full border border-zinc-700 bg-zinc-800/40 px-2.5 py-1 text-[11px] font-medium text-zinc-400"
            title={
              mediaError ??
              (mediaRefreshing
                ? 'Re-signing media URLs for this session'
                : 'Clip URLs are derived per session from canonical refs')
            }
          >
            {mediaRefreshing ? 'media: signing…' : mediaError ? 'media: stale' : 'media: fresh'}
          </span>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            title="Undo (⌘Z)"
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/60 px-2.5 py-1.5 text-[11px] font-medium text-zinc-200 transition hover:border-amber-500/60 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Undo2 className="h-3.5 w-3.5" /> Undo
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            title="Redo (⌘⇧Z)"
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/60 px-2.5 py-1.5 text-[11px] font-medium text-zinc-200 transition hover:border-amber-500/60 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Redo2 className="h-3.5 w-3.5" /> Redo
          </button>
          <button
            type="button"
            onClick={() => void saveNow()}
            title="Save now (⌘S)"
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/60 px-2.5 py-1.5 text-[11px] font-medium text-zinc-200 transition hover:border-zinc-500"
          >
            <Save className="h-3.5 w-3.5" /> Save
          </button>
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={!resolvedProjectId || render.busy}
            title="Enqueue an MP4 render in the worker (media is re-signed first)"
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold text-amber-300 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Video className="h-3.5 w-3.5" /> Export MP4
          </button>
        </div>
      </header>

      {(saveError || mediaError) && (
        <div className="mt-4 space-y-2">
          {saveError && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3">
              <p className="text-sm text-rose-300">{saveError}</p>
            </div>
          )}
          {mediaError && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
              <p className="text-sm text-amber-300">
                Media URLs could not be refreshed ({mediaError}) — previews may be stale; the render
                still re-signs server-side.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-300">Preview</h3>
              <span className="text-xs tabular-nums text-zinc-400">
                {playhead.toFixed(2)}s / {totalSeconds.toFixed(2)}s · {isPlaying ? 'playing' : 'paused'}
              </span>
            </div>

            <div className="mx-auto mt-3 w-full max-w-[320px]">
              <div className="aspect-[9/16] w-full overflow-hidden rounded-xl border border-zinc-800 bg-black">
                {player}
              </div>
            </div>

            <input
              type="range"
              min={0}
              max={Math.max(totalSeconds, 0.1)}
              step={1 / fps}
              value={Math.min(playhead, totalSeconds)}
              onChange={(event) => seekTo(Number(event.target.value))}
              className="mt-3 w-full cursor-pointer accent-amber-500"
              aria-label="Playhead"
            />
            <p className="mt-1 text-center text-[11px] text-zinc-500">
              {project.width}×{project.height} · {fps}fps · {durationInFrames} frames
            </p>
          </div>

          <StudioTimeline
            project={project}
            selection={selection}
            dispatch={dispatch}
            playheadSeconds={playhead}
            onSeek={seekTo}
            onSelect={setSelection}
          />

          <ClipInspector
            project={project}
            selection={selection}
            dispatch={dispatch}
            playheadSeconds={playhead}
          />
        </div>

        <aside className="space-y-4">
          <div className="flex flex-wrap gap-1.5 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-1.5">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 rounded-xl px-3 py-1.5 text-[11px] font-semibold transition ${
                  activeTab === tab.id
                    ? 'bg-amber-500/15 text-amber-300'
                    : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'scenes' && (
            <SceneGeneratePanel
              project={project}
              projectId={resolvedProjectId}
              dispatch={dispatch}
            />
          )}
          {activeTab === 'upload' && (
            <UploadFootagePanel
              project={project}
              projectId={resolvedProjectId}
              dispatch={dispatch}
            />
          )}
          {activeTab === 'captions' && (
            <CaptionPanel
              project={project}
              projectId={resolvedProjectId}
              dispatch={dispatch}
              render={render}
            />
          )}
          {activeTab === 'branding' && <BrandingPanel project={project} dispatch={dispatch} />}
          {activeTab === 'export' && (
            <ExportPanel
              project={project}
              projectId={resolvedProjectId}
              render={render}
              onRefreshMedia={refreshMedia}
              mediaRefreshing={mediaRefreshing}
              mediaError={mediaError}
            />
          )}
        </aside>
      </div>
    </div>
  );
}
