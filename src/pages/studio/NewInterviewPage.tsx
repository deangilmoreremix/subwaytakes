import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Sparkles } from 'lucide-react';

import type { ShotType, StudioCaption, StudioScenePlanEntry } from '../../studio/types';
import { createEmptyProject, sanitizeProject } from '../../studio/types';
import { INTERVIEW_BEATS, buildHookCaption, buildPresetTracks } from '../../studio/interviewPreset';
import {
  createProject,
  describeError,
  isAccessDenied,
  planInterview,
  type InterviewPlanBeat,
} from '../../lib/studioProjects';

type Status = 'idle' | 'planning' | 'creating' | 'error';

const ENVIRONMENTS: Array<[string, string]> = [
  ['subway_platform', 'Subway platform'],
  ['inside_train', 'Inside the train'],
  ['train_arriving', 'Train arriving'],
];

const SPEAKERS: Array<'host' | 'guest' | 'none'> = ['host', 'guest', 'none'];

export function NewInterviewPage() {
  const navigate = useNavigate();
  const [topic, setTopic] = useState('');
  const [hostDescription, setHostDescription] = useState('');
  const [guestDescription, setGuestDescription] = useState('');
  const [environment, setEnvironment] = useState(ENVIRONMENTS[0][0]);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const environmentLabel = useMemo(
    () => ENVIRONMENTS.find(([value]) => value === environment)?.[1] ?? environment,
    [environment],
  );

  const canSubmit = topic.trim().length >= 3 && status !== 'planning' && status !== 'creating';

  async function buildProject(options: {
    beats: InterviewPlanBeat[] | null;
    hookQuestion: string | null;
    title: string | null;
    handle: string | null;
  }): Promise<string> {
    const { beats: plan, hookQuestion, title, handle } = options;
    const id = crypto.randomUUID();
    const planByBeat = new Map<string, InterviewPlanBeat>(
      (plan ?? []).map((beat, index) => [
        typeof beat.beatId === 'string' && beat.beatId ? beat.beatId : INTERVIEW_BEATS[index]?.beatId ?? '',
        beat,
      ]),
    );

    let cursor = 0;
    const scenePlan: StudioScenePlanEntry[] = [];
    const dialogueCaptions: StudioCaption[] = [];
    const durationsByBeat = new Map<string, number>();

    INTERVIEW_BEATS.forEach((beat) => {
      const planned = planByBeat.get(beat.beatId);
      const duration = planned?.targetDuration && planned.targetDuration > 0
        ? planned.targetDuration
        : beat.targetDuration;
      const dialogue = planned?.dialogue?.trim() ?? '';
      const speaker: 'host' | 'guest' | 'none' = SPEAKERS.includes(planned?.speaker as never)
        ? (planned?.speaker as 'host' | 'guest' | 'none')
        : beat.shotType === 'guest'
          ? 'guest'
          : beat.shotType === 'host'
            ? 'host'
            : 'none';

      scenePlan.push({
        beatId: beat.beatId,
        shotType: ((planned?.shotType as ShotType | undefined) ?? beat.shotType) as ShotType,
        dialogue,
        speaker,
        cameraDirection: planned?.cameraDirection?.trim() || beat.defaultCamera,
        prompt: planned?.videoPrompt?.trim() || planned?.prompt?.trim() || '',
      });

      if (dialogue) {
        dialogueCaptions.push({
          id: `${id}-beat-${beat.beatId}-caption`,
          text: dialogue,
          start: cursor,
          end: cursor + duration,
          kind: 'dialogue',
          speaker: speaker === 'none' ? undefined : speaker,
        });
      }
      durationsByBeat.set(beat.beatId, duration);
      cursor += duration;
    });

    const base = createEmptyProject(id, title?.trim() || topic.trim() || 'Subway Interview');
    const project = sanitizeProject({
      ...base,
      tracks: buildPresetTracks(
        id,
        scenePlan.map((entry) => durationsByBeat.get(entry.beatId) ?? 0),
      ),
      captions: [buildHookCaption(id, hookQuestion ?? topic.trim(), handle ?? '@subwaytakes'), ...dialogueCaptions],
      branding: handle ? { ...base.branding, handle, watermarkText: handle } : base.branding,
      scenePlan,
    });

    return createProject(project);
  }

  async function handleCreate(withPlan: boolean) {
    setError(null);
    setNote(null);
    if (!canSubmit) return;

    setStatus(withPlan ? 'planning' : 'creating');
    try {
      let planBeats: InterviewPlanBeat[] | null = null;
      let hookQuestion: string | null = null;
      let planTitle: string | null = null;
      let planHandle: string | null = null;

      if (withPlan) {
        const plan = await planInterview({
          topic: topic.trim(),
          hostDescription: hostDescription.trim(),
          guestDescription: guestDescription.trim(),
          environment: environmentLabel,
        });
        planBeats = Array.isArray(plan.beats) ? plan.beats : null;
        hookQuestion = plan.hookQuestion ?? null;
        planTitle = plan.title ?? null;
        planHandle = plan.handle ?? null;
        if (!planBeats) {
          setNote('The planner did not return any beats — created the 7-beat preset instead.');
        } else if (planBeats.length < INTERVIEW_BEATS.length) {
          setNote(
            `The planner returned ${planBeats.length} of ${INTERVIEW_BEATS.length} beats — the remaining beats use the preset.`,
          );
        }
      }

      setStatus('creating');
      const rowId = await buildProject({
        beats: planBeats,
        hookQuestion,
        title: planTitle,
        handle: planHandle,
      });
      navigate(`/studio/subway-editor/${rowId}`);
    } catch (err) {
      setStatus('error');
      setError(
        isAccessDenied(err) ? 'Project not found or access denied' : describeError(err, 'Could not create the project'),
      );
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <button
        onClick={() => navigate('/create')}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-zinc-200"
      >
        <ArrowLeft className="h-4 w-4" />
        All Creation Tools
      </button>

      <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">New Subway Interview</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Describe the take and the planner writes the seven-beat SubwayTakes script, then drops you
        straight into the timeline editor.
      </p>

      <div className="mt-8 space-y-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-zinc-400">Topic *</span>
          <input
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="e.g. Is the NYC subway getting worse?"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
          />
          <span className="mt-1 block text-[11px] text-zinc-500">
            At least 3 characters — this becomes the opening hook title.
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-zinc-400">Host description</span>
            <input
              value={hostDescription}
              onChange={(event) => setHostDescription(event.target.value)}
              placeholder="a confident interviewer in a puffer jacket with a card mic"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-zinc-400">Guest description</span>
            <input
              value={guestDescription}
              onChange={(event) => setGuestDescription(event.target.value)}
              placeholder="a relatable New Yorker in their 30s"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-zinc-400">Environment</span>
          <select
            value={environment}
            onChange={(event) => setEnvironment(event.target.value)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-3 py-2.5 text-sm text-zinc-100 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
          >
            {ENVIRONMENTS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void handleCreate(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-300 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {status === 'planning' || status === 'creating' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {status === 'planning'
              ? 'Planning the interview…'
              : status === 'creating'
                ? 'Creating the project…'
                : 'Plan & create project'}
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void handleCreate(false)}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/60 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Skip planning — empty project
          </button>
        </div>

        {status === 'planning' && (
          <p className="text-xs text-sky-300">
            Asking the planner for the seven-beat script… this can take a few seconds.
          </p>
        )}
        {note && <p className="text-xs text-amber-300">{note}</p>}
        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3">
            <p className="text-sm text-rose-300">{error}</p>
            <p className="mt-1 text-[11px] text-rose-400/80">
              You can retry, or create an empty project and fill the beats in manually.
            </p>
          </div>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
        <h2 className="text-sm font-semibold text-zinc-300">Interview preset (7 beats)</h2>
        <ul className="mt-3 space-y-2">
          {INTERVIEW_BEATS.map((beat) => (
            <li key={beat.beatId} className="flex items-start gap-3 text-xs text-zinc-400">
              <span className="mt-0.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                {beat.targetDuration}s
              </span>
              <span>
                <span className="font-medium text-zinc-200">{beat.label}</span> — {beat.shotType.replace('_', ' ')}
                <span className="block text-zinc-500">{beat.defaultCamera}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
