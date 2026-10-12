import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, RefreshCw, Sparkles } from 'lucide-react';

import type { BeatId, StudioProject, StudioScenePlanEntry } from '../../studio/types';
import { INTERVIEW_BEATS, buildBeatVideoPrompt } from '../../studio/interviewPreset';
import { isMediaRef, type MediaRef } from '../../studio/mediaRefs';
import type { StudioAction } from '../../lib/studioReducer';
import {
  SCENE_MODELS,
  clipForBeat,
  describeError,
  generateScene,
  type SceneGenerationModel,
} from '../../lib/studioProjects';
import { callEdgeFunction } from '../../lib/edgeFunctions';

const ENVIRONMENTS = [
  'NYC subway platform with a train arriving',
  'Inside a moving subway train',
  'Subway platform, rush hour crowd',
  'Empty late-night platform',
];

const POLL_INTERVAL_MS = 5000;

export interface SceneGeneratePanelProps {
  project: StudioProject;
  projectId: string | null;
  dispatch(action: StudioAction): void;
}

type SceneJobStatus = 'idle' | 'queued' | 'pending' | 'processing' | 'completed' | 'failed';

interface BeatJob {
  requestId: string;
  status: SceneJobStatus;
  clipId?: string | null;
  /** True when the server stored the clip durably (assetRef present). */
  stored?: boolean;
  message?: string;
}

interface SceneBrief {
  topic: string;
  hostDescription: string;
  guestDescription: string;
  environment: string;
}

type PromptSource = 'planner' | 'preset';

/**
 * Defensive reader for a `scene-status` payload. The function stores the clip
 * under a canonical ref (`assetRef`) and returns a derived signed URL; the two
 * upgrades land independently, so every field is optional and nothing may be
 * assumed to exist.
 */
interface SceneStatusPayload {
  status?: string | null;
  assetRef?: unknown;
  asset_url?: string | null;
  assetUrl?: string | null;
  output_url?: string | null;
  clip_id?: string | null;
  clipId?: string | null;
  error?: string | null;
}

interface SceneStatusState {
  status: Exclude<SceneJobStatus, 'idle'>;
  outputUrl: string | null;
  assetRef: MediaRef | null;
  clipId: string | null;
  error: string | null;
}

const STATUS_STYLE: Record<SceneJobStatus, string> = {
  idle: 'border-zinc-700/60 bg-zinc-800/40 text-zinc-400',
  queued: 'border-zinc-600/50 bg-zinc-700/30 text-zinc-300',
  pending: 'border-zinc-600/50 bg-zinc-700/30 text-zinc-300',
  processing: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  completed: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  failed: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
};

function normalizeSceneStatus(raw: string | null | undefined): Exclude<SceneJobStatus, 'idle'> {
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

async function fetchSceneStatus(
  projectId: string,
  beatId: BeatId,
  requestId: string,
): Promise<SceneStatusState> {
  const response = await callEdgeFunction<SceneStatusPayload>('scene-status', {
    project_id: projectId,
    beat_id: beatId,
    request_id: requestId,
  });
  const rawRef = response?.assetRef;
  const clipId = firstString(response?.clipId, response?.clip_id);
  return {
    status: normalizeSceneStatus(response?.status),
    outputUrl: firstString(
      response?.asset_url,
      response?.assetUrl,
      response?.output_url,
      typeof rawRef === 'string' ? rawRef : null,
    ),
    assetRef: isMediaRef(rawRef) ? rawRef : null,
    clipId,
    error: typeof response?.error === 'string' && response.error ? response.error : null,
  };
}

export function SceneGeneratePanel({ project, projectId, dispatch }: SceneGeneratePanelProps) {
  const projectRef = useRef(project);
  projectRef.current = project;

  const [brief, setBrief] = useState<SceneBrief>({
    topic: project.title,
    hostDescription: '',
    guestDescription: '',
    environment: ENVIRONMENTS[0],
  });
  const [prompts, setPrompts] = useState<Partial<Record<BeatId, string>>>({});
  const [model, setModel] = useState<SceneGenerationModel>('veo3');
  const [jobs, setJobs] = useState<Partial<Record<BeatId, BeatJob>>>({});
  const [errors, setErrors] = useState<Partial<Record<BeatId, string>>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);

  const timersRef = useRef<Partial<Record<BeatId, number>>>({});

  useEffect(
    () => () => {
      Object.values(timersRef.current).forEach((timer) => {
        if (timer) window.clearInterval(timer);
      });
    },
    [],
  );

  const planByBeat = useMemo(
    () => new Map<BeatId, StudioScenePlanEntry>(project.scenePlan.map((entry) => [entry.beatId, entry])),
    [project.scenePlan],
  );

  /**
   * Prefill every beat prompt exactly once. The planner's own prompt (which
   * already carries the host/guest descriptions collected at creation time) wins
   * over anything this panel could build, so the same host/guest presentation
   * persists across beats; the preset builder is only the fallback.
   */
  useEffect(() => {
    setPrompts((previous) => {
      const next: Partial<Record<BeatId, string>> = { ...previous };
      let changed = false;
      for (const beat of INTERVIEW_BEATS) {
        if (next[beat.beatId] !== undefined) continue;
        const planned = planByBeat.get(beat.beatId)?.prompt?.trim();
        next[beat.beatId] = planned
          ? planned
          : buildBeatVideoPrompt(
              beat,
              brief.topic,
              brief.hostDescription,
              brief.guestDescription,
              brief.environment,
            );
        changed = true;
      }
      return changed ? next : previous;
    });
  }, [brief, planByBeat]);

  const rebuildPromptsFromBrief = useCallback(() => {
    const next: Partial<Record<BeatId, string>> = {};
    for (const beat of INTERVIEW_BEATS) {
      next[beat.beatId] = buildBeatVideoPrompt(
        beat,
        brief.topic,
        brief.hostDescription,
        brief.guestDescription,
        brief.environment,
      );
    }
    setPrompts(next);
  }, [brief]);

  const promptSourceFor = useCallback(
    (beatId: BeatId): PromptSource | null => {
      const current = prompts[beatId];
      if (current === undefined) return null;
      const planned = planByBeat.get(beatId)?.prompt?.trim();
      return planned && current === planned ? 'planner' : 'preset';
    },
    [planByBeat, prompts],
  );

  const stopPolling = useCallback((beatId: BeatId) => {
    const timer = timersRef.current[beatId];
    if (timer) {
      window.clearInterval(timer);
      delete timersRef.current[beatId];
    }
  }, []);

  const startPolling = useCallback(
    (beatId: BeatId, requestId: string, presetClipId: string | null) => {
      stopPolling(beatId);
      const activeProjectId = projectRef.current.id;

      const tick = async () => {
        try {
          const state = await fetchSceneStatus(activeProjectId, beatId, requestId);
          setJobs((previous) => ({
            ...previous,
            [beatId]: {
              requestId,
              status: state.status,
              clipId: state.clipId ?? presetClipId,
              stored: Boolean(state.assetRef),
              message: state.error ?? undefined,
            },
          }));

          if (state.status === 'completed') {
            stopPolling(beatId);

            if (!state.outputUrl) {
              if (state.assetRef) {
                // The clip is stored durably even without a playable URL: the
                // project row was wired server-side and the editor resolves the
                // preview from the ref itself, so this is a success state.
                setErrors((previous) => ({ ...previous, [beatId]: '' }));
                return;
              }
              setErrors((previous) => ({
                ...previous,
                [beatId]: 'Generation finished without an output URL',
              }));
              return;
            }

            const current = projectRef.current;
            const targetClipId =
              state.clipId ?? presetClipId ?? clipForBeat(current, beatId)?.id ?? null;
            const assetRef = state.assetRef ?? undefined;

            if (targetClipId) {
              dispatch({
                type: 'SET_CLIP_ASSET',
                clipId: targetClipId,
                assetUrl: state.outputUrl,
                assetKind: 'generated',
                assetRef,
              });
              setErrors((previous) => ({ ...previous, [beatId]: '' }));
              return;
            }
            const videoTrack = current.tracks.find((track) => track.kind === 'video');
            const beat = INTERVIEW_BEATS.find((entry) => entry.beatId === beatId);
            if (videoTrack && beat) {
              dispatch({
                type: 'ADD_CLIP',
                trackId: videoTrack.id,
                clip: {
                  id: crypto.randomUUID(),
                  assetUrl: state.outputUrl,
                  assetKind: 'generated',
                  ...(assetRef ? { assetRef } : {}),
                  beatId,
                  shotType: beat.shotType,
                  start: 0,
                  trimStart: 0,
                  trimEnd: beat.targetDuration,
                  volume: 1,
                  fadeIn: 0.3,
                  fadeOut: 0.3,
                  label: beat.label,
                },
              });
              return;
            }
            setErrors((previous) => ({
              ...previous,
              [beatId]: 'Generation finished but this project has no video track to attach the clip to',
            }));
          }

          if (state.status === 'failed') {
            stopPolling(beatId);
            setErrors((previous) => ({
              ...previous,
              [beatId]: state.error ?? 'Video generation failed',
            }));
          }
        } catch (err) {
          stopPolling(beatId);
          const message = describeError(err);
          setJobs((previous) => ({
            ...previous,
            [beatId]: { requestId, status: 'failed', message },
          }));
          setErrors((previous) => ({ ...previous, [beatId]: message }));
        }
      };

      void tick();
      timersRef.current[beatId] = window.setInterval(() => {
        void tick();
      }, POLL_INTERVAL_MS);
    },
    [dispatch, stopPolling],
  );

  const handleGenerate = useCallback(
    async (beatId: BeatId) => {
      const prompt = (prompts[beatId] ?? '').trim();
      if (!projectId) {
        setGlobalError('Project is still saving — wait for the first autosave, then retry.');
        return;
      }
      if (!prompt) {
        setErrors((previous) => ({ ...previous, [beatId]: 'Prompt is empty' }));
        return;
      }
      setGlobalError(null);
      setErrors((previous) => ({ ...previous, [beatId]: '' }));
      setJobs((previous) => ({ ...previous, [beatId]: { requestId: '', status: 'pending' } }));
      try {
        const requestId = await generateScene(projectId, beatId, prompt, model);
        const clipId = clipForBeat(projectRef.current, beatId)?.id ?? null;
        setJobs((previous) => ({ ...previous, [beatId]: { requestId, status: 'pending', clipId } }));
        startPolling(beatId, requestId, clipId);
      } catch (err) {
        const message = describeError(err, 'Could not start generation');
        setJobs((previous) => ({ ...previous, [beatId]: { requestId: '', status: 'failed', message } }));
        setErrors((previous) => ({ ...previous, [beatId]: message }));
      }
    },
    [model, prompts, projectId, startPolling],
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
        <h3 className="text-sm font-semibold text-zinc-300">
          Scene generation <span className="text-zinc-500">· Mode A — generate clips</span>
        </h3>
        <p className="mt-1 text-xs text-zinc-500">
          One generated clip per beat. Prompts come from the interview planner when one exists (the
          same host/guest presentation across all beats); otherwise they are built from this brief.
          Edit them freely, then submit to the video model. Mode B (Upload tab) attaches your own
          footage instead.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-zinc-400">Topic</span>
            <input
              value={brief.topic}
              onChange={(event) => setBrief((prev) => ({ ...prev, topic: event.target.value }))}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-zinc-400">Environment</span>
            <select
              value={brief.environment}
              onChange={(event) => setBrief((prev) => ({ ...prev, environment: event.target.value }))}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
            >
              {ENVIRONMENTS.map((environment) => (
                <option key={environment} value={environment}>
                  {environment}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-zinc-400">Host description</span>
            <input
              value={brief.hostDescription}
              onChange={(event) =>
                setBrief((prev) => ({ ...prev, hostDescription: event.target.value }))
              }
              placeholder="a confident interviewer in a puffer jacket with a card mic"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-zinc-400">Guest description</span>
            <input
              value={brief.guestDescription}
              onChange={(event) =>
                setBrief((prev) => ({ ...prev, guestDescription: event.target.value }))
              }
              placeholder="a relatable New Yorker in their 30s"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium text-zinc-400">Video model</span>
          {SCENE_MODELS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setModel(entry.id)}
              className={`rounded-lg border px-3 py-1.5 text-[11px] font-medium transition ${
                model === entry.id
                  ? 'border-amber-500/60 bg-amber-500/10 text-amber-300'
                  : 'border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:border-zinc-500'
              }`}
            >
              {entry.label}
            </button>
          ))}
          <button
            type="button"
            onClick={rebuildPromptsFromBrief}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-1.5 text-[11px] font-medium text-zinc-300 transition hover:border-zinc-500"
          >
            <RefreshCw className="h-3 w-3" /> Rebuild all prompts from this brief
          </button>
        </div>

        {globalError && (
          <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2">
            <p className="text-xs text-rose-300">{globalError}</p>
          </div>
        )}
      </div>

      {INTERVIEW_BEATS.map((beat) => {
        const entry = planByBeat.get(beat.beatId);
        const job = jobs[beat.beatId];
        const error = errors[beat.beatId];
        const clip = clipForBeat(project, beat.beatId);
        const busy =
          job?.status === 'pending' || job?.status === 'processing' || job?.status === 'queued';
        const source = promptSourceFor(beat.beatId);
        return (
          <div key={beat.beatId} className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-zinc-100">{beat.label}</h4>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                  STATUS_STYLE[job?.status ?? 'idle']
                }`}
              >
                {job ? (job.stored && job.status === 'completed' ? 'stored' : job.status) : 'idle'}
              </span>
            </div>

            <p className="mt-1 text-[11px] uppercase tracking-wide text-zinc-500">
              {beat.shotType.replace('_', ' ')} · {beat.defaultCamera}
            </p>
            <p className="mt-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-300">
              {entry?.dialogue?.trim() ? entry.dialogue : 'No dialogue for this beat yet.'}
            </p>

            <label className="mt-3 block">
              <span className="mb-1 flex items-center justify-between text-[11px] font-medium text-zinc-400">
                Prompt
                <span className="font-normal text-zinc-500">
                  {source === 'planner'
                    ? 'from the interview planner'
                    : source === 'preset'
                      ? 'built from this brief'
                      : ''}
                </span>
              </span>
              <textarea
                rows={4}
                value={prompts[beat.beatId] ?? ''}
                onChange={(event) =>
                  setPrompts((previous) => ({ ...previous, [beat.beatId]: event.target.value }))
                }
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-xs text-zinc-100 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
              />
            </label>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={busy || !projectId}
                onClick={() => void handleGenerate(beat.beatId)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold text-amber-300 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                {busy ? 'Generating…' : 'Generate clip'}
              </button>
              <span className="text-[11px] text-zinc-500">
                {clip?.assetUrl
                  ? `Asset attached (${clip.assetKind})`
                  : clip
                    ? 'Placeholder clip — no asset attached yet'
                    : 'No clip on the timeline yet'}
              </span>
            </div>

            {job?.stored && job.status === 'completed' && (
              <p className="mt-2 text-[11px] text-emerald-300">
                Clip stored durably{job.requestId ? ` (request ${job.requestId.slice(0, 8)})` : ''} —
                the editor resolves the preview from the stored asset; the signed URL expires but the
                asset does not.
              </p>
            )}
            {job?.message && job.status !== 'failed' && (
              <p className="mt-2 text-[11px] text-zinc-400">{job.message}</p>
            )}
            {error ? <p className="mt-2 text-[11px] text-rose-300">{error}</p> : null}
          </div>
        );
      })}
    </div>
  );
}
