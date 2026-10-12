import { useRef, useState } from 'react';
import { AudioLines, Film, Loader2 } from 'lucide-react';

import type { BeatId, StudioProject, StudioTrackKind } from '../../studio/types';
import type { StudioAction } from '../../lib/studioReducer';
import {
  AUDIO_TRACK_KINDS,
  STUDIO_TRACK_STYLE,
  beatTimings,
  clipForBeat,
  describeError,
  uploadFootageRef,
} from '../../lib/studioProjects';

export interface UploadFootagePanelProps {
  project: StudioProject;
  projectId: string | null;
  dispatch(action: StudioAction): void;
}

type UploadTarget = 'video' | StudioTrackKind;

/** Storage kind of an upload target (drives the persisted media ref). */
function refKindFor(target: UploadTarget): 'video' | 'audio' {
  return target === 'video' ? 'video' : 'audio';
}

export function UploadFootagePanel({ project, projectId, dispatch }: UploadFootagePanelProps) {
  const projectRef = useRef(project);
  projectRef.current = project;

  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, string>>({});

  const beats = beatTimings(project);

  async function handleUpload(beatId: BeatId, target: UploadTarget, file: File) {
    const key = `${beatId}:${target}`;
    if (!projectId) {
      setError('Project is still saving — wait for the first autosave, then retry.');
      return;
    }
    setBusyKey(key);
    setError(null);
    setStatus((previous) => ({ ...previous, [key]: `Uploading ${file.name}…` }));

    try {
      // The ref is the identity of the asset (it never expires); the URL is
      // only this session's derived, playable form.
      const uploaded = await uploadFootageRef(projectId, file, beatId);
      const assetRef = { ...uploaded.ref, kind: refKindFor(target) };
      const current = projectRef.current;

      if (target === 'video') {
        const clip = clipForBeat(current, beatId);
        if (clip) {
          dispatch({
            type: 'SET_CLIP_ASSET',
            clipId: clip.id,
            assetUrl: uploaded.url,
            assetKind: 'uploaded',
            assetRef,
          });
        } else {
          const videoTrack = current.tracks.find((track) => track.kind === 'video');
          const beat = beats.find((entry) => entry.beatId === beatId);
          if (!videoTrack || !beat) {
            throw new Error('This project has no video track to attach footage to');
          }
          dispatch({
            type: 'ADD_CLIP',
            trackId: videoTrack.id,
            clip: {
              id: crypto.randomUUID(),
              assetUrl: uploaded.url,
              assetRef,
              assetKind: 'uploaded',
              beatId,
              start: beat.start,
              trimStart: 0,
              trimEnd: beat.duration,
              volume: 1,
              fadeIn: 0.3,
              fadeOut: 0.3,
              label: `${beat.label} (upload)`,
            },
          });
        }
      } else {
        const track = current.tracks.find((entry) => entry.kind === target);
        if (!track) throw new Error(`This project has no ${target} track`);
        const existing = track.clips.find((clip) => clip.beatId === beatId);
        const beat = beats.find((entry) => entry.beatId === beatId);
        if (existing) {
          dispatch({
            type: 'SET_CLIP_ASSET',
            clipId: existing.id,
            assetUrl: uploaded.url,
            assetKind: 'audio',
            assetRef,
          });
        } else {
          dispatch({
            type: 'ADD_CLIP',
            trackId: track.id,
            clip: {
              id: crypto.randomUUID(),
              assetUrl: uploaded.url,
              assetRef,
              assetKind: 'audio',
              beatId,
              start: beat?.start ?? 0,
              trimStart: 0,
              trimEnd: beat?.duration ?? 5,
              volume: 1,
              fadeIn: 0.2,
              fadeOut: 0.4,
              label: `${track.name} — ${beat?.label ?? beatId}`,
            },
          });
        }
      }

      setStatus((previous) => ({
        ...previous,
        [key]: `Attached at ${(beats.find((entry) => entry.beatId === beatId)?.start ?? 0).toFixed(2)}s on the timeline`,
      }));
    } catch (err) {
      const message = describeError(err, 'Upload failed');
      setError(message);
      setStatus((previous) => ({ ...previous, [key]: '' }));
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
        <h3 className="text-sm font-semibold text-zinc-300">Upload footage</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Uploads go to the private <code className="text-zinc-400">studio-uploads</code> bucket and
          are attached at the beat&apos;s position on the timeline — as a session URL for preview and
          a canonical ref the project keeps.
        </p>
        {error && (
          <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2">
            <p className="text-xs text-rose-300">{error}</p>
          </div>
        )}
      </div>

      {beats.map((beat) => (
        <div key={beat.beatId} className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-zinc-100">{beat.label}</h4>
            <span className="text-[11px] tabular-nums text-zinc-500">
              {beat.start.toFixed(2)}s – {beat.end.toFixed(2)}s
            </span>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <FileSlot
              label="Video clip"
              accept="video/*"
              icon={<Film className="h-3.5 w-3.5" />}
              busy={busyKey === `${beat.beatId}:video`}
              status={status[`${beat.beatId}:video`]}
              disabled={!projectId}
              onFile={(file) => void handleUpload(beat.beatId, 'video', file)}
            />
            {AUDIO_TRACK_KINDS.map((kind) => (
              <FileSlot
                key={kind}
                label={`${STUDIO_TRACK_STYLE[kind].label} audio`}
                accept="audio/*"
                icon={<AudioLines className="h-3.5 w-3.5" />}
                busy={busyKey === `${beat.beatId}:${kind}`}
                status={status[`${beat.beatId}:${kind}`]}
                disabled={!projectId}
                onFile={(file) => void handleUpload(beat.beatId, kind, file)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function FileSlot({
  label,
  accept,
  icon,
  busy,
  status,
  disabled,
  onFile,
}: {
  label: string;
  accept: string;
  icon: React.ReactNode;
  busy: boolean;
  status?: string;
  disabled: boolean;
  onFile(file: File): void;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-zinc-400">
        {icon}
        {label}
      </span>
      <input
        type="file"
        accept={accept}
        disabled={disabled || busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) onFile(file);
        }}
        className="block w-full cursor-pointer rounded-xl border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-[11px] text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-700 file:px-2.5 file:py-1 file:text-[11px] file:font-medium file:text-zinc-200 hover:file:bg-zinc-600 disabled:opacity-50"
      />
      <span className="mt-1 flex items-center gap-1 text-[10px] text-zinc-500">
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
        {status || 'No asset attached'}
      </span>
    </label>
  );
}
