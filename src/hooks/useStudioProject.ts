import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import type { StudioProject, StudioRenderJobRow } from '../studio/types';
import { createEmptyProject, sanitizeProject } from '../studio/types';
import { buildHookCaption, buildPresetTracks } from '../studio/interviewPreset';
import {
  ACCESS_DENIED_MESSAGE,
  createProject,
  describeError,
  enqueueRender,
  isAccessDenied,
  loadLatestRenderJob,
  loadProject,
  saveProject,
  watchRenderJob,
} from '../lib/studioProjects';
import { createStudioHistory, type StudioAction, type StudioHistory } from '../lib/studioReducer';

export type StudioLoadStatus = 'loading' | 'ready' | 'error';
export type StudioSaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

export interface UseStudioProjectOptions {
  /** Title used when a project is created from scratch. */
  title?: string;
  /** Topic used for the opening hook caption. */
  topic?: string;
  /** Handle used for the opening hook caption. */
  handle?: string;
  autosaveDelayMs?: number;
}

export interface UseStudioProjectResult {
  projectId: string | null;
  project: StudioProject;
  dispatch(action: StudioAction): void;
  undo(): void;
  redo(): void;
  canUndo: boolean;
  canRedo: boolean;
  status: StudioLoadStatus;
  error: string | null;
  saveStatus: StudioSaveStatus;
  saveError: string | null;
  saveNow(): Promise<void>;
}

function projectSignature(project: StudioProject): string {
  return JSON.stringify(project);
}

/**
 * Load a studio project (creating one when the route id is `new`), expose the
 * undo/redo reducer and autosave changes to Supabase after a 2s debounce.
 */
export function useStudioProject(
  projectId: string,
  options: UseStudioProjectOptions = {},
): UseStudioProjectResult {
  const {
    title = 'Untitled Subway Interview',
    topic = '',
    handle = '@subwaytakes',
    autosaveDelayMs = 2000,
  } = options;

  const [history] = useState<StudioHistory>(() =>
    createStudioHistory(createEmptyProject(crypto.randomUUID())),
  );
  const [status, setStatus] = useState<StudioLoadStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<StudioSaveStatus>('saved');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [resolvedId, setResolvedId] = useState<string | null>(null);

  const project = useSyncExternalStore(history.subscribe, () => history.state);

  const projectRef = useRef(project);
  projectRef.current = project;

  const resolvedIdRef = useRef<string | null>(null);
  resolvedIdRef.current = resolvedId;

  const savedSignatureRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Boots exactly once per hook instance (the route id may change from `new`
   * to the created row id right after the project is inserted). */
  const bootedRef = useRef(false);

  const persist = useCallback(async (signature: string) => {
    const id = resolvedIdRef.current;
    if (!id) return;
    setSaveStatus('saving');
    setSaveError(null);
    try {
      await saveProject(id, projectRef.current);
      savedSignatureRef.current = signature;
      setSaveStatus('saved');
    } catch (err) {
      setSaveStatus('error');
      setSaveError(
        isAccessDenied(err) ? ACCESS_DENIED_MESSAGE : describeError(err, 'Could not save project'),
      );
    }
  }, []);

  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    let cancelled = false;

    async function boot() {
      setStatus('loading');
      setError(null);
      try {
        if (projectId === 'new') {
          const id = crypto.randomUUID();
          const base = createEmptyProject(id, title);
          const captions = topic.trim()
            ? [buildHookCaption(id, topic.trim(), handle)]
            : [];
          const project = sanitizeProject({ ...base, tracks: buildPresetTracks(id), captions });
          const rowId = await createProject(project);
          if (cancelled) return;
          setResolvedId(rowId);
          savedSignatureRef.current = projectSignature(project);
          history.dispatch({ type: 'LOAD_PROJECT', project });
          setStatus('ready');
          return;
        }

        const project = await loadProject(projectId);
        if (cancelled) return;
        setResolvedId(projectId);
        savedSignatureRef.current = projectSignature(project);
        history.dispatch({ type: 'LOAD_PROJECT', project });
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setError(
          isAccessDenied(err) ? ACCESS_DENIED_MESSAGE : describeError(err, 'Could not load project'),
        );
        setStatus('error');
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [projectId, title, topic, handle, history]);

  useEffect(() => {
    if (status !== 'ready' || !resolvedId) return;
    const signature = projectSignature(project);
    if (savedSignatureRef.current === signature) return;

    setSaveStatus('unsaved');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void persist(signature);
    }, autosaveDelayMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [project, status, resolvedId, autosaveDelayMs, persist]);

  const saveNow = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!resolvedIdRef.current) return;
    await persist(projectSignature(projectRef.current));
  }, [persist]);

  return {
    projectId: resolvedId,
    project,
    dispatch: history.dispatch,
    undo: history.undo,
    redo: history.redo,
    canUndo: history.canUndo(),
    canRedo: history.canRedo(),
    status,
    error,
    saveStatus,
    saveError,
    saveNow,
  };
}

// ---------------------------------------------------------------------------
// Render jobs (shared by the export panel and the captioned-output workflow)
// ---------------------------------------------------------------------------

export interface StudioRenderController {
  jobId: string | null;
  job: StudioRenderJobRow | null;
  busy: boolean;
  error: string | null;
  note: string | null;
  startRender(): Promise<void>;
  clearError(): void;
}

/**
 * Own the project's render job: persist the project, enqueue a render through
 * the `render-project` edge function and watch the job row until it finishes.
 */
export function useStudioRender(projectId: string | null, project: StudioProject): StudioRenderController {
  const projectRef = useRef(project);
  projectRef.current = project;

  const [job, setJob] = useState<StudioRenderJobRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  const stopWatching = useCallback(() => {
    unsubRef.current?.();
    unsubRef.current = null;
  }, []);

  const watch = useCallback(
    (jobId: string) => {
      stopWatching();
      unsubRef.current = watchRenderJob(jobId, (row) => {
        setJob(row);
        if (row.status === 'done' || row.status === 'error') {
          setBusy(false);
          unsubRef.current?.();
          unsubRef.current = null;
        }
      });
    },
    [stopWatching],
  );

  useEffect(() => () => stopWatching(), [stopWatching]);

  const startRender = useCallback(async () => {
    if (!projectId) {
      setError('Project is still saving — wait for the first autosave, then retry.');
      return;
    }
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      await saveProject(projectId, projectRef.current);
      const jobId = await enqueueRender(projectId);
      setJob(null);
      setNote('Render queued — the worker will pick it up shortly.');
      watch(jobId);
    } catch (err) {
      setError(describeError(err, 'Could not enqueue render'));
      try {
        const latest = await loadLatestRenderJob(projectId);
        if (latest && (latest.status === 'queued' || latest.status === 'running')) {
          setJob(latest);
          setNote('Re-attached to the render job that is already in flight.');
          watch(latest.id);
          return;
        }
      } catch (secondary) {
        setNote(`Could not check for an existing render job: ${describeError(secondary)}`);
      }
      setBusy(false);
    }
  }, [projectId, watch]);

  const clearError = useCallback(() => setError(null), []);

  return {
    jobId: job?.id ?? null,
    job,
    busy,
    error,
    note,
    startRender,
    clearError,
  };
}
