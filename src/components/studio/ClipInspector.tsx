import {
  ArrowDown,
  ArrowUp,
  Copy,
  Scissors,
  Trash2,
  Undo2,
  Volume2,
  VolumeX,
} from 'lucide-react';

import type { StudioProject, StudioTrack } from '../../studio/types';
import { clipLength } from '../../studio/types';
import type { StudioAction } from '../../lib/studioReducer';
import { beatTimings } from '../../lib/studioProjects';
import type { StudioSelection } from './StudioTimeline';

export interface ClipInspectorProps {
  project: StudioProject;
  selection: StudioSelection | null;
  dispatch(action: StudioAction): void;
  playheadSeconds: number;
}

/** Fade presets offered in the inspector (0 = hard cut, i.e. "None"). */
const FADE_PRESETS: Array<{ label: string; seconds: number }> = [
  { label: 'None', seconds: 0 },
  { label: '0.3s', seconds: 0.3 },
  { label: '0.8s', seconds: 0.8 },
];

function findTrack(project: StudioProject, trackId: string): StudioTrack | undefined {
  return project.tracks.find((track) => track.id === trackId);
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange(value: number): void;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between text-[11px] font-medium text-zinc-400">
        {label}
        <span className="tabular-nums text-zinc-300">
          {value.toFixed(2)}
          {suffix ?? ''}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-zinc-700 accent-amber-500"
      />
    </label>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-0.5 truncate text-xs text-zinc-200">{value}</p>
    </div>
  );
}

export function ClipInspector({ project, selection, dispatch, playheadSeconds }: ClipInspectorProps) {
  if (!selection) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
        <h3 className="text-sm font-semibold text-zinc-300">Clip Inspector</h3>
        <p className="mt-2 text-xs text-zinc-500">
          Select a clip or caption on the timeline to edit its trim, volume, fades and asset.
        </p>
      </div>
    );
  }

  if (selection.kind === 'caption') {
    const caption = project.captions.find((c) => c.id === selection.id);
    if (!caption) {
      return (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
          <h3 className="text-sm font-semibold text-zinc-300">Clip Inspector</h3>
          <p className="mt-2 text-xs text-rose-300">This caption no longer exists.</p>
        </div>
      );
    }
    return (
      <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-300">Caption</h3>
          <button
            type="button"
            onClick={() => dispatch({ type: 'REMOVE_CAPTION', captionId: caption.id })}
            title="Delete this caption — press ⌘Z / Ctrl+Z to undo"
            className="inline-flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-[11px] font-medium text-rose-300 transition hover:bg-rose-500/20"
          >
            <Trash2 className="h-3 w-3" /> Delete
            <Undo2 className="h-3 w-3 text-rose-300/70" />
            <span className="hidden text-rose-300/70 sm:inline">(undo with ⌘Z)</span>
          </button>
        </div>
        <Field label="Kind" value={caption.kind.replace('_', ' ')} />
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-zinc-400">Text</span>
          <textarea
            rows={3}
            value={caption.text}
            onChange={(event) =>
              dispatch({
                type: 'UPDATE_CAPTION',
                captionId: caption.id,
                updates: { text: event.target.value },
              })
            }
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <Slider
            label="Start"
            value={caption.start}
            min={0}
            max={Math.max(1, project.duration)}
            step={0.05}
            suffix="s"
            onChange={(start) =>
              dispatch({
                type: 'UPDATE_CAPTION',
                captionId: caption.id,
                updates: { start: Math.max(0, start) },
              })
            }
          />
          <Slider
            label="End"
            value={caption.end}
            min={0}
            max={Math.max(1, project.duration)}
            step={0.05}
            suffix="s"
            onChange={(end) =>
              dispatch({
                type: 'UPDATE_CAPTION',
                captionId: caption.id,
                updates: { end: Math.max(caption.start + 0.1, end) },
              })
            }
          />
        </div>
        <p className="text-[11px] text-zinc-500">
          Visible for {(caption.end - caption.start).toFixed(2)}s. Caption text also renders in the
          preview player and in the server render.
        </p>
      </div>
    );
  }

  const track = findTrack(project, selection.trackId);
  const clip = track?.clips.find((c) => c.id === selection.id);

  if (!track || !clip) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
        <h3 className="text-sm font-semibold text-zinc-300">Clip Inspector</h3>
        <p className="mt-2 text-xs text-rose-300">This clip no longer exists.</p>
      </div>
    );
  }

  const trimMax = Math.max(clip.trimEnd, clip.sourceDuration ?? clip.trimEnd) + 5;
  const clipIndex = [...track.clips]
    .sort((a, b) => a.start - b.start)
    .findIndex((c) => c.id === clip.id);
  const beats = beatTimings(project);

  return (
    <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-zinc-100">
            {clip.label || track.name}
          </h3>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            {track.name} · {clip.assetKind} · {(clipLength(clip)).toFixed(2)}s at {clip.start.toFixed(2)}s
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => dispatch({ type: 'DUPLICATE_CLIP', clipId: clip.id })}
            title="Copy this clip right after the original (trim, volume and fades are preserved)"
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800/60 px-2 py-1 text-[11px] font-medium text-zinc-200 transition hover:border-amber-500/60 hover:text-amber-300"
          >
            <Copy className="h-3 w-3" /> Duplicate
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'REMOVE_CLIP', clipId: clip.id })}
            title="Delete this clip — press ⌘Z / Ctrl+Z to undo"
            className="inline-flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-[11px] font-medium text-rose-300 transition hover:bg-rose-500/20"
          >
            <Trash2 className="h-3 w-3" /> Delete
            <Undo2 className="h-3 w-3 text-rose-300/70" />
            <span className="hidden text-rose-300/70 sm:inline">(undo with ⌘Z)</span>
          </button>
        </div>
      </div>

      {clip.assetUrl ? (
        <div className="space-y-2">
          {track.kind === 'video' ? (
            <video
              key={clip.assetUrl}
              src={clip.assetUrl}
              muted
              preload="metadata"
              className="max-h-32 w-full rounded-xl border border-zinc-800 bg-black object-contain"
            />
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2">
              <Volume2 className="h-3.5 w-3.5 text-zinc-500" />
              <span className="truncate text-[11px] text-zinc-400">Audio asset attached</span>
            </div>
          )}
          <a
            href={clip.assetUrl}
            target="_blank"
            rel="noreferrer"
            className="block truncate text-[11px] text-sky-400 underline underline-offset-2 hover:text-sky-300"
          >
            {clip.assetUrl}
          </a>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-zinc-700 px-3 py-3 text-[11px] text-zinc-500">
          No asset yet — generate this beat in the Scenes panel or upload footage.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Slider
          label="Trim start"
          value={clip.trimStart}
          min={0}
          max={trimMax}
          step={0.05}
          suffix="s"
          onChange={(trimStart) =>
            dispatch({
              type: 'TRIM_CLIP',
              clipId: clip.id,
              trimStart,
              trimEnd: Math.max(trimStart + 0.1, clip.trimEnd),
            })
          }
        />
        <Slider
          label="Trim end"
          value={clip.trimEnd}
          min={clip.trimStart + 0.1}
          max={trimMax}
          step={0.05}
          suffix="s"
          onChange={(trimEnd) =>
            dispatch({ type: 'TRIM_CLIP', clipId: clip.id, trimStart: clip.trimStart, trimEnd })
          }
        />
        <Slider
          label="Clip volume"
          value={clip.volume}
          min={0}
          max={1}
          step={0.01}
          onChange={(volume) => dispatch({ type: 'SET_CLIP_VOLUME', clipId: clip.id, volume })}
        />
        <Slider
          label="Track volume"
          value={track.volume}
          min={0}
          max={1}
          step={0.01}
          onChange={(volume) => dispatch({ type: 'SET_TRACK_VOLUME', trackId: track.id, volume })}
        />
        <Slider
          label="Fade in"
          value={clip.fadeIn}
          min={0}
          max={Math.max(1, clipLength(clip) / 2)}
          step={0.05}
          suffix="s"
          onChange={(fadeIn) => dispatch({ type: 'SET_CLIP_FADE', clipId: clip.id, fadeIn })}
        />
        <Slider
          label="Fade out"
          value={clip.fadeOut}
          min={0}
          max={Math.max(1, clipLength(clip) / 2)}
          step={0.05}
          suffix="s"
          onChange={(fadeOut) => dispatch({ type: 'SET_CLIP_FADE', clipId: clip.id, fadeOut })}
        />
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
        <p className="text-[11px] font-medium text-zinc-400">
          Transitions <span className="text-zinc-500">(fade presets apply to in and out)</span>
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {FADE_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() =>
                dispatch({
                  type: 'SET_CLIP_FADE',
                  clipId: clip.id,
                  fadeIn: preset.seconds,
                  fadeOut: preset.seconds,
                })
              }
              className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
                Math.abs(clip.fadeIn - preset.seconds) < 1e-6 &&
                Math.abs(clip.fadeOut - preset.seconds) < 1e-6
                  ? 'border-amber-500/60 bg-amber-500/15 text-amber-300'
                  : 'border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:border-zinc-500'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-zinc-500">
          {clip.fadeIn > 0 || clip.fadeOut > 0
            ? `Fades: in ${clip.fadeIn.toFixed(2)}s · out ${clip.fadeOut.toFixed(2)}s — rendered by the preview and the server render.`
            : 'No fades — this clip cuts hard.'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-zinc-400">Move to beat</span>
          <select
            value={clip.beatId ?? ''}
            onChange={(event) => {
              const value = event.target.value;
              // Record the beat association AND move the clip to the beat's
              // timeline position — the association used to be dropped, so the
              // select snapped back and the link never existed.
              if (value === '') {
                dispatch({ type: 'SET_CLIP_BEAT', clipId: clip.id, beatId: null });
                return;
              }
              const beatId = value as (typeof beats)[number]['beatId'];
              const beat = beats.find((entry) => entry.beatId === beatId);
              if (!beat) return;
              dispatch({ type: 'SET_CLIP_BEAT', clipId: clip.id, beatId });
              dispatch({ type: 'MOVE_CLIP', clipId: clip.id, newStart: beat.start });
            }}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
          >
            <option value="">Not on a beat</option>
            {beats.map((beat) => (
              <option key={beat.beatId} value={beat.beatId}>
                {beat.label} — {beat.start.toFixed(2)}s
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button
            type="button"
            disabled={clipIndex <= 0}
            onClick={() =>
              dispatch({
                type: 'REORDER_TRACK',
                trackId: track.id,
                fromIndex: clipIndex,
                toIndex: clipIndex - 1,
              })
            }
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800/60 px-2 py-2 text-[11px] font-medium text-zinc-200 transition hover:border-amber-500/60 disabled:opacity-40"
          >
            <ArrowUp className="h-3 w-3" /> Earlier
          </button>
          <button
            type="button"
            disabled={clipIndex < 0 || clipIndex >= track.clips.length - 1}
            onClick={() =>
              dispatch({
                type: 'REORDER_TRACK',
                trackId: track.id,
                fromIndex: clipIndex,
                toIndex: clipIndex + 1,
              })
            }
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800/60 px-2 py-2 text-[11px] font-medium text-zinc-200 transition hover:border-amber-500/60 disabled:opacity-40"
          >
            <ArrowDown className="h-3 w-3" /> Later
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() =>
            dispatch({ type: 'SPLIT_CLIP', clipId: clip.id, atSeconds: playheadSeconds })
          }
          className="inline-flex items-center gap-1 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold text-amber-300 transition hover:bg-amber-500/20"
        >
          <Scissors className="h-3 w-3" /> Split at {playheadSeconds.toFixed(2)}s
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: 'TOGGLE_TRACK_MUTE', trackId: track.id })}
          className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-1.5 text-[11px] font-medium text-zinc-200 transition hover:border-zinc-500"
        >
          {track.muted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
          {track.muted ? 'Unmute track' : 'Mute track'}
        </button>
      </div>
    </div>
  );
}
