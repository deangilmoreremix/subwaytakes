import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Timeline as TimelineEditor, type TimelineState } from '@xzdarcy/react-timeline-editor';
import type { TimelineRow } from '@xzdarcy/timeline-engine';
import '@xzdarcy/react-timeline-editor/dist/react-timeline-editor.css';

import type { StudioProject, StudioTrackKind } from '../../studio/types';
import { clipLength } from '../../studio/types';
import { snapSeconds, type StudioAction } from '../../lib/studioReducer';
import {
  STUDIO_TRACK_STYLE,
  diffEditorData,
  projectToEditorData,
  type EditorItemSnapshot,
} from '../../lib/studioProjects';

/**
 * Timeline editor mapping (see src/lib/studioProjects.ts → "Timeline editor
 * mapping"):
 *   row.id         = StudioTrack.id
 *   action.id      = StudioClip.id  (subtitle row: StudioCaption.id)
 *   action.start   = clip.start      (caption: caption.start)
 *   action.end     = clip.start + clipLength(clip)  (caption: caption.end)
 *   action.effectId = StudioTrack.kind → row colour
 *   scale = 1 → action.start/end are seconds; scaleWidth = 110px per second.
 * A drag reports the new start/end through `onChange`, which is translated back
 * into MOVE_CLIP / TRIM_CLIP (clips) or UPDATE_CAPTION (captions) and snapped
 * to the 0.25s grid when within 0.15s.
 */

const SCALE = 1;
const SCALE_WIDTH = 110;
const SCALE_SPLIT_COUNT = 4;
const EDIT_EPSILON = 0.006;

export interface StudioSelection {
  kind: 'clip' | 'caption';
  id: string;
  trackId: string;
  label: string;
}

export interface StudioTimelineProps {
  project: StudioProject;
  selection: StudioSelection | null;
  dispatch(action: StudioAction): void;
  playheadSeconds: number;
  onSeek(seconds: number): void;
  onSelect(selection: StudioSelection | null): void;
}

interface ActionLookup {
  label: string;
  meta: string;
  kind: 'clip' | 'caption';
}

function lookupAction(project: StudioProject, rowId: string, actionId: string): ActionLookup | null {
  for (const track of project.tracks) {
    if (track.id !== rowId) continue;
    if (track.kind === 'subtitle') {
      const caption = project.captions.find((c) => c.id === actionId);
      if (!caption) return null;
      return {
        label: caption.text || 'Caption',
        meta: caption.kind === 'hook' ? 'Hook title' : caption.kind === 'lower_third' ? 'Lower third' : 'Dialogue',
        kind: 'caption',
      };
    }
    const clip = track.clips.find((c) => c.id === actionId);
    if (!clip) return null;
    return {
      label: clip.label || track.name,
      meta: clip.assetUrl ? `${clip.assetKind} asset` : 'placeholder',
      kind: 'clip',
    };
  }
  return null;
}

export function StudioTimeline({
  project,
  selection,
  dispatch,
  playheadSeconds,
  onSeek,
  onSelect,
}: StudioTimelineProps) {
  const timelineRef = useRef<TimelineState>(null);
  const selectedId = selection?.id ?? null;
  const mapping = useMemo(() => projectToEditorData(project, selectedId), [project, selectedId]);
  const mappingRef = useRef(mapping);
  mappingRef.current = mapping;

  useEffect(() => {
    timelineRef.current?.setTime(Math.max(0, playheadSeconds));
  }, [playheadSeconds]);

  const resolveSelection = useCallback(
    (rowId: string, actionId: string): StudioSelection | null => {
      const item: EditorItemSnapshot | undefined = mappingRef.current.items.find(
        (entry) => entry.actionId === actionId,
      );
      if (!item) return null;
      const info = lookupAction(project, rowId, actionId);
      return {
        kind: item.item,
        id: actionId,
        trackId: rowId,
        label: info?.label ?? actionId,
      };
    },
    [project],
  );

  const handleChange = useCallback(
    (rows: TimelineRow[]) => {
      const edits = diffEditorData(mappingRef.current, rows);
      for (const edit of edits) {
        if (edit.item === 'caption') {
          const start = Math.max(0, snapSeconds(edit.start));
          dispatch({
            type: 'UPDATE_CAPTION',
            captionId: edit.actionId,
            updates: { start, end: Math.max(start + 0.1, edit.end) },
          });
          continue;
        }

        const nextStart = Math.max(0, snapSeconds(edit.start));
        const nextLength = edit.end - edit.start;
        const previousLength = edit.previous.trimEnd - edit.previous.trimStart;
        const startChanged = Math.abs(nextStart - edit.previous.start) > EDIT_EPSILON;
        const lengthChanged = Math.abs(nextLength - previousLength) > EDIT_EPSILON;
        if (!startChanged && !lengthChanged) continue;

        if (lengthChanged) {
          const trimStart = Math.max(
            0,
            edit.previous.trimStart + (nextStart - edit.previous.start),
          );
          dispatch({
            type: 'TRIM_CLIP',
            clipId: edit.actionId,
            trimStart,
            trimEnd: trimStart + nextLength,
          });
        }
        dispatch({ type: 'MOVE_CLIP', clipId: edit.actionId, newStart: nextStart });
      }
    },
    [dispatch],
  );

  const handleClickAction = useCallback(
    (actionId: string, rowId: string) => {
      onSelect(resolveSelection(rowId, actionId));
    },
    [onSelect, resolveSelection],
  );

  const splitAtPlayhead = useCallback(() => {
    if (!selection || selection.kind !== 'clip') return;
    dispatch({ type: 'SPLIT_CLIP', clipId: selection.id, atSeconds: playheadSeconds });
  }, [dispatch, playheadSeconds, selection]);

  const totalSeconds = useMemo(
    () =>
      Math.max(
        project.duration,
        ...project.tracks.map((track) =>
          track.clips.reduce((max, clip) => Math.max(max, clip.start + clipLength(clip)), 0),
        ),
        1,
      ),
    [project],
  );

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-zinc-300">Timeline</h3>
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(STUDIO_TRACK_STYLE) as StudioTrackKind[]).map((kind) => (
            <span
              key={kind}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${STUDIO_TRACK_STYLE[kind].chip}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${STUDIO_TRACK_STYLE[kind].dot}`} />
              {STUDIO_TRACK_STYLE[kind].label}
            </span>
          ))}
          <span className="text-[11px] tabular-nums text-zinc-500">
            {playheadSeconds.toFixed(2)}s / {totalSeconds.toFixed(2)}s
          </span>
          <button
            type="button"
            onClick={splitAtPlayhead}
            disabled={!selection || selection.kind !== 'clip'}
            className="rounded-lg border border-zinc-700 bg-zinc-800/60 px-2.5 py-1 text-[11px] font-medium text-zinc-200 transition hover:border-amber-500/60 hover:text-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Split at playhead
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-800">
        <TimelineEditor
          ref={timelineRef}
          editorData={mapping.rows}
          effects={{}}
          scale={SCALE}
          scaleWidth={SCALE_WIDTH}
          scaleSplitCount={SCALE_SPLIT_COUNT}
          startLeft={12}
          rowHeight={42}
          minScaleCount={20}
          maxScaleCount={400}
          dragLine
          autoScroll
          style={{ height: 300, width: '100%' }}
          onChange={handleChange}
          onClickAction={(_e, { action, row }) => handleClickAction(action.id, row.id)}
          onDoubleClickAction={(_e, { action }) => onSeek(action.start)}
          onCursorDrag={(time) => onSeek(time)}
          onCursorDragEnd={(time) => onSeek(time)}
          onClickTimeArea={(time) => {
            onSeek(time);
            return undefined;
          }}
          getActionRender={(action, row) => {
            const track = project.tracks.find((t) => t.id === row.id);
            const kind = track?.kind ?? 'video';
            const style = STUDIO_TRACK_STYLE[kind];
            const info = lookupAction(project, row.id, action.id);
            const selected = selectedId === action.id;
            return (
              <div
                className={`flex h-full w-full items-center gap-1.5 overflow-hidden rounded-md border px-2 ${style.bar} ${style.text} ${
                  selected ? 'ring-2 ring-amber-400/80' : ''
                }`}
              >
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`} />
                <span className="truncate text-[11px] font-medium">{info?.label ?? 'Clip'}</span>
                <span className="ml-auto shrink-0 text-[9px] uppercase tracking-wide opacity-70">
                  {(action.end - action.start).toFixed(1)}s
                </span>
              </div>
            );
          }}
        />
      </div>

      <p className="mt-2 text-[11px] text-zinc-500">
        Drag clips to move them (snaps to a 0.25s grid), drag their edges to trim, drag the blue
        cursor to scrub the preview. Click a clip to inspect it.
      </p>
    </div>
  );
}
