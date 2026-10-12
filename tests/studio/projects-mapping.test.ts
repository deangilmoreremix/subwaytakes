import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn() },
    from: vi.fn(),
    storage: { from: vi.fn() },
  },
}));

vi.mock('../../src/lib/auth', () => ({
  getUserId: vi.fn(() => 'user-1'),
}));

import {
  diffEditorData,
  projectToEditorData,
  type EditorEdit,
  type StudioEditorMapping,
} from '../../src/lib/studioProjects';
import { studioReducer } from '../../src/lib/studioReducer';
import { createEmptyProject, type StudioProject } from '../../src/studio/types';
import type { TimelineRow } from '@xzdarcy/timeline-engine';

function projectWithTwoClipsAndCaption(): StudioProject {
  const project = createEmptyProject('proj-map', 'Mapping Project');
  const videoTrack = project.tracks.find((t) => t.kind === 'video')!;
  videoTrack.clips.push(
    {
      id: 'clip-a',
      assetUrl: 'https://cdn.example.com/a.mp4',
      assetKind: 'uploaded',
      start: 0,
      trimStart: 0,
      trimEnd: 3,
      volume: 1,
      fadeIn: 0,
      fadeOut: 0,
    },
    {
      id: 'clip-b',
      assetUrl: 'https://cdn.example.com/b.mp4',
      assetKind: 'uploaded',
      start: 3,
      trimStart: 1,
      trimEnd: 3,
      volume: 1,
      fadeIn: 0,
      fadeOut: 0,
    },
  );
  return {
    ...project,
    captions: [{ id: 'cap-1', text: 'hello', start: 1, end: 2.5, kind: 'dialogue' }],
  };
}

/** Apply a diffEditorData edit to a project the way the editor does. */
function applyEdit(project: StudioProject, edit: EditorEdit): StudioProject {
  if (edit.item === 'caption') {
    return studioReducer(project, {
      type: 'UPDATE_CAPTION',
      captionId: edit.actionId,
      updates: { start: edit.start, end: edit.end },
    });
  }
  if (Math.abs(edit.start - edit.previous.start) > 1e-9) {
    return studioReducer(project, {
      type: 'MOVE_CLIP',
      clipId: edit.actionId,
      newStart: edit.start,
    });
  }
  const previous = edit.previous;
  return studioReducer(project, {
    type: 'TRIM_CLIP',
    clipId: edit.actionId,
    trimStart: previous.trimStart,
    trimEnd: previous.trimStart + (edit.end - edit.start),
  });
}

function rowsOf(mapping: StudioEditorMapping, rowId: string): TimelineRow {
  const row = mapping.rows.find((r) => r.id === rowId);
  if (!row) throw new Error(`row ${rowId} missing`);
  return row;
}

function videoTrackId(project: StudioProject): string {
  return project.tracks.find((t) => t.kind === 'video')!.id;
}

function subtitleTrackId(project: StudioProject): string {
  return project.tracks.find((t) => t.kind === 'subtitle')!.id;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('projectToEditorData', () => {
  it('maps clips to timeline rows with correct start/end/effectId', () => {
    const project = projectWithTwoClipsAndCaption();
    const { rows, items } = projectToEditorData(project, null);

    expect(rows).toHaveLength(5);
    const videoRow = rowsOf({ rows, items }, videoTrackId(project));
    expect(videoRow.actions).toHaveLength(2);

    const [actionA, actionB] = videoRow.actions;
    expect(actionA.id).toBe('clip-a');
    expect(actionA.start).toBe(0);
    expect(actionA.end).toBe(3);
    expect(actionA.effectId).toBe('video');
    expect(actionA.selected).toBe(false);

    expect(actionB.id).toBe('clip-b');
    expect(actionB.start).toBe(3);
    expect(actionB.end).toBe(5); // start 3 + trim length 2
    expect(actionB.effectId).toBe('video');
  });

  it('maps the caption onto the subtitle row', () => {
    const project = projectWithTwoClipsAndCaption();
    const { rows } = projectToEditorData(project, null);

    const subtitleRow = rowsOf({ rows, items: [] }, subtitleTrackId(project));
    expect(subtitleRow.actions).toHaveLength(1);
    expect(subtitleRow.actions[0].id).toBe('cap-1');
    expect(subtitleRow.actions[0].start).toBe(1);
    expect(subtitleRow.actions[0].end).toBe(2.5);
    expect(subtitleRow.actions[0].effectId).toBe('subtitle');
  });

  it('snapshots clip trim windows for later diffs', () => {
    const project = projectWithTwoClipsAndCaption();
    const { items } = projectToEditorData(project, null);

    expect(items).toHaveLength(3);
    const clipA = items.find((i) => i.actionId === 'clip-a')!;
    expect(clipA).toMatchObject({
      item: 'clip',
      trackKind: 'video',
      start: 0,
      end: 3,
      trimStart: 0,
      trimEnd: 3,
    });
    const clipB = items.find((i) => i.actionId === 'clip-b')!;
    expect(clipB).toMatchObject({ start: 3, end: 5, trimStart: 1, trimEnd: 3 });
    const caption = items.find((i) => i.actionId === 'cap-1')!;
    expect(caption).toMatchObject({ item: 'caption', trackKind: 'subtitle', start: 1, end: 2.5, trimStart: 0, trimEnd: 1.5 });
  });

  it('marks the selected action', () => {
    const project = projectWithTwoClipsAndCaption();
    const { rows } = projectToEditorData(project, 'clip-b');

    const videoRow = rowsOf({ rows, items: [] }, videoTrackId(project));
    expect(videoRow.actions.map((a) => a.selected)).toEqual([false, true]);
  });
});

describe('diffEditorData', () => {
  it('reports no edits when nothing moved', () => {
    const project = projectWithTwoClipsAndCaption();
    const mapping = projectToEditorData(project, null);

    expect(diffEditorData(mapping, mapping.rows)).toEqual([]);
  });

  it('turns a simulated drag of clip-b into a MOVE_CLIP edit', () => {
    const project = projectWithTwoClipsAndCaption();
    const mapping = projectToEditorData(project, null);
    const videoRow = rowsOf(mapping, videoTrackId(project));

    // simulate the user dragging clip-b from 3..5 to 4..6
    const dragged: TimelineRow = {
      ...videoRow,
      actions: videoRow.actions.map((action) =>
        action.id === 'clip-b' ? { ...action, start: 4, end: 6 } : action,
      ),
    };

    const edits = diffEditorData(mapping, [...mapping.rows.map((r) => (r.id === videoRow.id ? dragged : r))]);
    expect(edits).toHaveLength(1);
    expect(edits[0]).toMatchObject({
      actionId: 'clip-b',
      item: 'clip',
      trackKind: 'video',
      start: 4,
      end: 6,
    });
    expect(edits[0].previous.start).toBe(3);

    // the edit maps onto a MOVE_CLIP reducer action
    const moved = applyEdit(project, edits[0]);
    const clipB = moved.tracks.find((t) => t.kind === 'video')!.clips.find((c) => c.id === 'clip-b')!;
    expect(clipB.start).toBe(4);
    expect(clipB.trimStart).toBe(1);
    expect(clipB.trimEnd).toBe(3);
  });

  it('turns a simulated resize of clip-a into a TRIM_CLIP edit', () => {
    const project = projectWithTwoClipsAndCaption();
    const mapping = projectToEditorData(project, null);
    const videoRow = rowsOf(mapping, videoTrackId(project));

    // simulate the user extending clip-a's out point from 3 to 4.5
    const resized: TimelineRow = {
      ...videoRow,
      actions: videoRow.actions.map((action) =>
        action.id === 'clip-a' ? { ...action, start: 0, end: 4.5 } : action,
      ),
    };

    const edits = diffEditorData(mapping, [...mapping.rows.map((r) => (r.id === videoRow.id ? resized : r))]);
    expect(edits).toHaveLength(1);
    expect(edits[0].actionId).toBe('clip-a');
    expect(edits[0].start).toBe(0);
    expect(edits[0].end).toBeCloseTo(4.5, 5);

    // the edit maps onto a TRIM_CLIP reducer action (trim window grows by the delta)
    const trimmed = applyEdit(project, edits[0]);
    const clipA = trimmed.tracks.find((t) => t.kind === 'video')!.clips.find((c) => c.id === 'clip-a')!;
    expect(clipA.trimStart).toBe(0);
    expect(clipA.trimEnd).toBeCloseTo(4.5, 5);
    expect(clipA.start).toBe(0);
  });

  it('turns a caption move into an UPDATE_CAPTION edit', () => {
    const project = projectWithTwoClipsAndCaption();
    const mapping = projectToEditorData(project, null);
    const subtitleRow = rowsOf(mapping, subtitleTrackId(project));

    const moved: TimelineRow = {
      ...subtitleRow,
      actions: subtitleRow.actions.map((action) => ({ ...action, start: 2, end: 3.5 })),
    };

    const edits = diffEditorData(mapping, [...mapping.rows.map((r) => (r.id === subtitleRow.id ? moved : r))]);
    expect(edits).toHaveLength(1);
    expect(edits[0]).toMatchObject({ actionId: 'cap-1', item: 'caption', start: 2, end: 3.5 });

    const updated = applyEdit(project, edits[0]);
    expect(updated.captions[0]).toMatchObject({ id: 'cap-1', start: 2, end: 3.5 });
  });

  it('round-trips: mapping a muted project yields no spurious edits after apply', () => {
    const project = projectWithTwoClipsAndCaption();
    const mapping = projectToEditorData(project, null);

    // apply the drag to the project, re-map, and confirm the diff is now clean
    const videoRow = rowsOf(mapping, videoTrackId(project));
    const dragged: TimelineRow = {
      ...videoRow,
      actions: videoRow.actions.map((action) =>
        action.id === 'clip-b' ? { ...action, start: 4, end: 6 } : action,
      ),
    };
    const edits = diffEditorData(mapping, [...mapping.rows.map((r) => (r.id === videoRow.id ? dragged : r))]);
    const moved = edits.reduce((state, edit) => applyEdit(state, edit), project);

    const remapped = projectToEditorData(moved, null);
    expect(diffEditorData(remapped, remapped.rows)).toEqual([]);

    const clipB = moved.tracks.find((t) => t.kind === 'video')!.clips.find((c) => c.id === 'clip-b')!;
    expect(clipB.start).toBe(4);
  });

  it('ignores unknown actions that were not part of the snapshot', () => {
    const project = projectWithTwoClipsAndCaption();
    const mapping = projectToEditorData(project, null);
    const videoRow = rowsOf(mapping, videoTrackId(project));

    const injected: TimelineRow = {
      ...videoRow,
      actions: [...videoRow.actions, { id: 'ghost', start: 9, end: 10, effectId: 'video' }],
    };

    const edits = diffEditorData(mapping, [...mapping.rows.map((r) => (r.id === videoRow.id ? injected : r))]);
    expect(edits.map((e) => e.actionId)).not.toContain('ghost');
  });
});
