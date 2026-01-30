import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Clock, AlertCircle, CheckCircle2, Layers, MessageCircle } from 'lucide-react';
import { ClipActions } from '../components/ClipActions';
import { getClipById, regenerateClip, updateClipStatus } from '../lib/clips';
import { prettyType, formatDate, clsx } from '../lib/format';
import type { Clip } from '../lib/types';
import { SUBWAY_SCENES, CITY_STYLES, ENERGY_LEVELS } from '../lib/constants';

interface ClipPageProps {
  clipId: string;
  onBack: () => void;
  onNavigateToClip: (clipId: string) => void;
}

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

function getSceneLabel(value: string | null): string {
  if (!value) return '—';
  return SUBWAY_SCENES.find(s => s.value === value)?.label || value;
}

function getCityLabel(value: string | null): string {
  if (!value) return '—';
  return CITY_STYLES.find(c => c.value === value)?.label || value;
}

function getEnergyLabel(value: string | null): string {
  if (!value) return '—';
  return ENERGY_LEVELS.find(e => e.value === value)?.label || value;
}

export function ClipPage({ clipId, onBack, onNavigateToClip }: ClipPageProps) {
  const [clip, setClip] = useState<Clip | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [copied, setCopied] = useState(false);

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

    const interval = setInterval(() => {
      if (clip && (clip.status === 'queued' || clip.status === 'running')) {
        fetchClip();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [fetchClip, clip?.status]);

  async function handleRegenerate(mode: 'regenerate' | 'variation') {
    if (!clip) return;
    setActionBusy(true);

    try {
      const newClip = await regenerateClip(clip.id, mode);
      await updateClipStatus(newClip.id, 'running');
      onNavigateToClip(newClip.id);
    } catch (error) {
      console.error('Failed to regenerate:', error);
    } finally {
      setActionBusy(false);
    }
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
            onClick={onBack}
            className="mt-4 rounded-xl bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  const ready = clip.status === 'done' && !!clip.result_url;
  const isSubway = clip.video_type === 'subway_interview';
  const isBatch = !!clip.batch_id;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <button
        onClick={onBack}
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
                  </div>
                </div>
              ) : (
                <div className="flex h-full w-full items-center justify-center p-6 text-center">
                  <div>
                    <div className="mx-auto w-12 h-12 border-2 border-zinc-700 border-t-amber-400 rounded-full animate-spin" />
                    <p className="mt-4 text-sm font-medium text-zinc-100">Generating your clip...</p>
                    <p className="mt-2 text-xs text-zinc-500">This usually takes a moment. We'll refresh automatically.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4">
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
              {isSubway && (
                <>
                  <DetailRow label="Scene" value={getSceneLabel(clip.scene_type)} />
                  <DetailRow label="City Style" value={getCityLabel(clip.city_style)} />
                  <DetailRow label="Energy" value={getEnergyLabel(clip.energy_level)} />
                </>
              )}
              <DetailRow label="Direction" value={clip.angle_prompt || '—'} />
              <DetailRow label="Created" value={formatDate(clip.created_at)} />
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
            <p className="text-xs text-zinc-500">
              {isSubway
                ? 'SubwayTakes-style viral clips. Try different energy levels or scenes for varied reactions.'
                : 'If a clip doesn\'t look right, try regenerating or creating a variation. Single-clip generation is designed for fast retries.'}
            </p>
          </div>

          <button
            onClick={onBack}
            className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/30 px-4 py-3 text-sm font-semibold text-zinc-100 hover:bg-zinc-900/50 transition"
          >
            Create another clip
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-zinc-500">{label}</span>
      <span className="text-zinc-200 text-right max-w-[60%] break-words">{value}</span>
    </div>
  );
}
