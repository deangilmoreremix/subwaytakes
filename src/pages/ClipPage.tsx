import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, AlertCircle, CheckCircle2, Layers, MessageCircle, Sparkles, RefreshCw } from 'lucide-react';
import { ClipActions } from '../components/ClipActions';
import { VideoProcessingToolbar } from '../components/VideoProcessingToolbar';
import { ViralScoreCard } from '../components/ViralScoreCard';
import { RerollPanel } from '../components/RerollPanel';
import { getClipById, regenerateClip, updateClipStatus, retryClip } from '../lib/clips';
import { useAuth } from '../lib/auth';
import type { RerollOptions } from '../lib/types';
import { prettyType, formatDate, clsx } from '../lib/format';
import { useRealtimeStatus } from '../hooks/useRealtimeStatus';
import type { Clip } from '../lib/types';
import {
  SUBWAY_SCENES,
  CITY_STYLES,
  ENERGY_LEVELS,
  STREET_SCENES,
  SPEAKER_STYLES,
  MOTIVATIONAL_SETTINGS,
  CAMERA_STYLES,
  LIGHTING_MOODS,
  STUDIO_SETUPS,
  STUDIO_LIGHTING,
} from '../lib/constants';

function StatusBadge({ status }: { status: Clip['status'] }) {
  const config = {
    queued: { text: 'Queued', className: 'border-zinc-700 bg-zinc-900 text-zinc-300', Icon: Clock },
    running: { text: 'Generating', className: 'border-amber-500/40 bg-amber-500/10 text-amber-300', Icon: Clock },
    done: { text: 'Done', className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300', Icon: CheckCircle2 },
    error: { text: 'Error', className: 'border-rose-500/40 bg-rose-500/10 text-rose-300', Icon: AlertCircle },
  };

  const { text, className, Icon } = config[status];

  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium', className)}>
      <Icon className="h-3 w-3" />
      {text}
    </span>
  );
}

function findLabel(list: { value: string; label: string }[], value: string | null): string {
  if (!value) return '—';
  return list.find(item => item.value === value)?.label || prettyType(value);
}

export function ClipPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const clipId = id ?? '';
  const [clip, setClip] = useState<Clip | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [retrying, setRetrying] = useState(false);
  const [rerolling, setRerolling] = useState(false);

  const fetchClip = useCallback(async () => {
    try {
      const data = await getClipById(clipId);
      setClip(data);
    } catch (error) {
      console.error('Failed to fetch clip:', error);
    } finally {
      setLoading(false);
    }
  }, [clipId]);

  useEffect(() => {
    fetchClip();
  }, [fetchClip]);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  useRealtimeStatus({
    table: 'clips',
    id: clipId,
    enabled: !!clip && (clip.status === 'queued' || clip.status === 'running'),
    onUpdate: (payload) => {
      setClip(prev => prev ? { ...prev, ...payload } as Clip : null);
    },
  });

  async function handleRegenerate(mode: 'regenerate' | 'variation') {
    if (!clip) return;
    setActionBusy(true);

    try {
      const newClip = await regenerateClip(clip.id, mode);
      await updateClipStatus(newClip.id, 'running');
      navigate('/clips/' + newClip.id);
    } catch (error) {
      console.error('Failed to regenerate:', error);
    } finally {
      setActionBusy(false);
    }
  }

  async function handleRetry() {
    if (!clip) return;
    setRetrying(true);
    try {
      const updated = await retryClip(clip.id);
      setClip(updated);
    } catch (error) {
      console.error('Retry failed:', error);
    } finally {
      setRetrying(false);
    }
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
  }

  async function handleReroll(_options: RerollOptions) {
    if (!clip) return;
    setRerolling(true);
    try {
      const newClip = await regenerateClip(clip.id, 'variation');
      await updateClipStatus(newClip.id, 'running');
      navigate('/clips/' + newClip.id);
    } catch (error) {
      console.error('Reroll failed:', error);
    } finally {
      setRerolling(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-zinc-800 rounded" />
          <div className="h-96 bg-zinc-800 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!clip) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-8 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-rose-400" />
          <h2 className="mt-4 text-lg font-semibold text-zinc-100">Clip not found</h2>
          <p className="mt-2 text-sm text-zinc-400">This clip may have been deleted or doesn't exist.</p>
          <button
            onClick={() => navigate('/create')}
            className="mt-4 rounded-xl bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  const ready = clip.status === 'done' && !!clip.result_url;
  const isBatch = !!clip.batch_id;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <button
        onClick={() => navigate('/create')}
        className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Create
      </button>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
            Clip Preview
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={clip.status} />
            {isBatch && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
                <Layers className="h-3 w-3" />
                Series #{clip.batch_sequence}
              </span>
            )}
            <span className="text-xs text-zinc-600">ID: {clip.id.slice(0, 8)}...</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
            <div className="aspect-[9/16] max-h-[600px] w-full mx-auto overflow-hidden rounded-xl bg-zinc-950">
              {ready ? (
                <video
                  src={clip.result_url!}
                  controls
                  autoPlay
                  playsInline
                  className="h-full w-full object-contain"
                />
              ) : clip.status === 'error' ? (
                <div className="flex h-full w-full items-center justify-center p-6 text-center">
                  <div>
                    <AlertCircle className="mx-auto h-12 w-12 text-rose-400/50" />
                    <p className="mt-4 text-sm font-medium text-zinc-100">Generation failed</p>
                    <p className="mt-2 text-xs text-zinc-500 max-w-xs">
                      {clip.error || 'An error occurred during generation. Try regenerating.'}
                    </p>
                    <button
                      onClick={handleRetry}
                      disabled={retrying}
                      className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-amber-400 disabled:opacity-50 transition"
                    >
                      <RefreshCw className={clsx("h-4 w-4", retrying && "animate-spin")} />
                      {retrying ? 'Retrying...' : 'Retry Generation'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex h-full w-full items-center justify-center p-6 text-center">
                  <div>
                    <div className="mx-auto w-12 h-12 border-2 border-zinc-700 border-t-amber-400 rounded-full animate-spin" />
                    <p className="mt-4 text-sm font-medium text-zinc-100">Generating your clip...</p>
                    <p className="mt-2 text-xs text-zinc-500">This usually takes a moment. Updates appear in real time.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 space-y-3">
              <ClipActions
                busy={actionBusy}
                canDownload={ready}
                downloadUrl={clip.result_url || undefined}
                onRegenerate={() => handleRegenerate('regenerate')}
                onVariation={() => handleRegenerate('variation')}
                onCopyLink={handleCopyLink}
              />
              {copied && (
                <p className="mt-2 text-xs text-emerald-400">Link copied to clipboard!</p>
              )}
              {ready && clip.result_url && (
                <VideoProcessingToolbar videoUrl={clip.result_url} />
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-1 space-y-4">
          {clip.interview_question && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
              <div className="flex items-start gap-3">
                <MessageCircle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-amber-400 mb-1">Interview Question</p>
                  <p className="text-sm text-zinc-200">{clip.interview_question}</p>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
            <h3 className="text-sm font-semibold text-zinc-100 mb-4">Details</h3>
            <div className="space-y-3 text-sm">
              <DetailRow label="Status" value={clip.status} />
              <DetailRow label="Type" value={prettyType(clip.video_type)} />
              <DetailRow label="Topic" value={clip.topic} />
              <DetailRow label="Duration" value={`${clip.duration_seconds}s`} />

              <TypeSpecificDetails clip={clip} />

              {clip.interview_style && (
                <DetailRow label="Style" value={prettyType(clip.interview_style)} />
              )}
              <DetailRow label="Direction" value={clip.angle_prompt || '—'} />
              <DetailRow label="Created" value={formatDate(clip.created_at)} />
            </div>
          </div>

          <ViralScoreCard score={clip.viral_score || null} isLoading={loading} />

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
            <p className="text-xs text-zinc-500">
              <TypeHelpText videoType={clip.video_type} />
            </p>
          </div>

          {ready && (
            <button
              onClick={() => navigate('/clips/' + clip.id + '/enhance')}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-amber-400 transition"
            >
              <Sparkles className="h-4 w-4" />
              Enhance Video
            </button>
          )}

          {ready && (
            <RerollPanel
              onReroll={handleReroll}
              isLoading={rerolling}
              currentTokens={profile?.credits_balance ?? 0}
            />
          )}

          <button
            onClick={() => navigate('/create')}
            className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/30 px-4 py-3 text-sm font-semibold text-zinc-100 hover:bg-zinc-900/50 transition"
          >
            Create another clip
          </button>
        </div>
      </div>
    </div>
  );
}

function TypeSpecificDetails({ clip }: { clip: Clip }) {
  switch (clip.video_type) {
    case 'subway_interview':
      return (
        <>
          {clip.scene_type && <DetailRow label="Scene" value={findLabel(SUBWAY_SCENES, clip.scene_type)} />}
          {clip.city_style && <DetailRow label="City Style" value={findLabel(CITY_STYLES, clip.city_style)} />}
          {clip.energy_level && <DetailRow label="Energy" value={findLabel(ENERGY_LEVELS, clip.energy_level)} />}
          {clip.subway_line && clip.subway_line !== 'any' && <DetailRow label="Line" value={clip.subway_line} />}
        </>
      );
    case 'street_interview':
      return (
        <>
          {clip.street_scene && <DetailRow label="Scene" value={findLabel(STREET_SCENES, clip.street_scene)} />}
          {clip.time_of_day && <DetailRow label="Time" value={prettyType(clip.time_of_day)} />}
          {clip.energy_level && <DetailRow label="Energy" value={findLabel(ENERGY_LEVELS, clip.energy_level)} />}
          {clip.neighborhood && <DetailRow label="Neighborhood" value={prettyType(clip.neighborhood)} />}
        </>
      );
    case 'motivational':
      return (
        <>
          {clip.speaker_style && <DetailRow label="Speaker" value={findLabel(SPEAKER_STYLES, clip.speaker_style)} />}
          {clip.motivational_setting && <DetailRow label="Setting" value={findLabel(MOTIVATIONAL_SETTINGS, clip.motivational_setting)} />}
          {clip.camera_style && <DetailRow label="Camera" value={findLabel(CAMERA_STYLES, clip.camera_style)} />}
          {clip.lighting_mood && <DetailRow label="Lighting" value={findLabel(LIGHTING_MOODS, clip.lighting_mood)} />}
        </>
      );
    case 'studio_interview':
      return (
        <>
          {clip.studio_setup && <DetailRow label="Setup" value={findLabel(STUDIO_SETUPS, clip.studio_setup)} />}
          {clip.studio_lighting && <DetailRow label="Lighting" value={findLabel(STUDIO_LIGHTING, clip.studio_lighting)} />}
          {clip.guest_count != null && clip.guest_count > 0 && <DetailRow label="Guests" value={String(clip.guest_count)} />}
        </>
      );
    case 'wisdom_interview':
      return (
        <>
          {clip.subject_demographic && <DetailRow label="Demographic" value={prettyType(clip.subject_demographic)} />}
          {clip.time_of_day && <DetailRow label="Time" value={prettyType(clip.time_of_day)} />}
        </>
      );
    default:
      return null;
  }
}

function TypeHelpText({ videoType }: { videoType: string }) {
  switch (videoType) {
    case 'subway_interview':
      return <>SubwayTakes-style viral clips. Try different energy levels or scenes for varied reactions.</>;
    case 'street_interview':
      return <>Street interview clips. Experiment with neighborhoods and time of day for authentic vox pop content.</>;
    case 'motivational':
      return <>Cinematic motivational clips. Adjust speaker style and camera work for maximum impact.</>;
    case 'studio_interview':
      return <>Professional studio interviews. Try different setups and lighting for a polished look.</>;
    case 'wisdom_interview':
      return <>Wisdom interview clips for 55+ audiences. Heartfelt life lessons and authentic conversations.</>;
    default:
      return <>If a clip doesn't look right, try regenerating or creating a variation.</>;
  }
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-zinc-500">{label}</span>
      <span className="text-zinc-200 text-right max-w-[60%] break-words">{value}</span>
    </div>
  );
}
