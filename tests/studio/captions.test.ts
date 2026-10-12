import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MUAPI_LANGUAGE,
  DEFAULT_MUAPI_THEME,
  MUAPI_CAPTION_LANGUAGES,
  MUAPI_CAPTION_THEMES,
  SUBTITLE_ROW_ID,
  captionFromText,
  cueListForEditor,
  findActiveCaption,
  mergeOverlaps,
  shiftCaptions,
  sortByTime,
} from '../../src/lib/studioCaptions';
import {
  CAPTION_PLACEMENT_KINDS,
  CAPTION_PLACEMENT_LABELS,
  CAPTION_PLACEMENTS,
  CAPTION_STYLES,
  CAPTION_STYLE_LABELS,
  DEFAULT_CAPTION_STYLE,
  isCaptionStyle,
  kindForPlacement,
  placementForKind,
  readCaptionStyle,
  withStyle,
  type CaptionPlacement,
  type CaptionStyle,
} from '../../src/studio/captionStyles';
import type { StudioCaption } from '../../src/studio/types';

function cue(id: string, start: number, end: number, speaker?: string): StudioCaption {
  return { id, text: id.toUpperCase(), start, end, kind: 'dialogue', speaker };
}

describe('findActiveCaption', () => {
  const captions = [cue('a', 0, 2), cue('b', 3, 5)];

  it('treats the start as inclusive and the end as exclusive', () => {
    expect(findActiveCaption(captions, 0)?.id).toBe('a');
    expect(findActiveCaption(captions, 1.99)?.id).toBe('a');
    expect(findActiveCaption(captions, 2)).toBeUndefined();
    expect(findActiveCaption(captions, 2.5)).toBeUndefined();
    expect(findActiveCaption(captions, 3)?.id).toBe('b');
    expect(findActiveCaption(captions, 4.99)?.id).toBe('b');
    expect(findActiveCaption(captions, 5)).toBeUndefined();
  });

  it('works on unsorted input and returns undefined for no cue', () => {
    const unsorted = [cue('late', 5, 6), cue('early', 0, 1)];
    expect(findActiveCaption(unsorted, 5.5)?.id).toBe('late');
    expect(findActiveCaption(unsorted, 3)).toBeUndefined();
  });
});

describe('mergeOverlaps', () => {
  it('merges overlapping cues with the same speaker', () => {
    const merged = mergeOverlaps([cue('a', 0, 3, 'host'), cue('b', 2, 5, 'host')]);

    expect(merged).toHaveLength(1);
    expect(merged[0].start).toBe(0);
    expect(merged[0].end).toBe(5);
    expect(merged[0].text).toBe('A B');
    expect(merged[0].speaker).toBe('host');
  });

  it('keeps the first text but extends the end across speakers', () => {
    const merged = mergeOverlaps([cue('a', 0, 3, 'host'), cue('b', 1, 4, 'guest')]);

    expect(merged).toHaveLength(1);
    expect(merged[0].text).toBe('A');
    expect(merged[0].end).toBe(4);
  });

  it('does not merge adjacent cues (end inclusive boundary)', () => {
    const merged = mergeOverlaps([cue('a', 0, 2), cue('b', 2, 4)]);

    expect(merged).toHaveLength(2);
    expect(merged.map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('does not mutate its input', () => {
    const input = [cue('late', 5, 7), cue('early', 0, 6)];
    const snapshot = JSON.parse(JSON.stringify(input)) as StudioCaption[];
    mergeOverlaps(input);
    expect(input).toEqual(snapshot);
  });
});

describe('shiftCaptions', () => {
  it('shifts every cue by the offset', () => {
    const shifted = shiftCaptions([cue('a', 1, 3), cue('b', 4, 6)], 2.5);

    expect(shifted[0].start).toBeCloseTo(3.5, 5);
    expect(shifted[0].end).toBeCloseTo(5.5, 5);
    expect(shifted[1].start).toBeCloseTo(6.5, 5);
  });

  it('clamps negative shifts at zero', () => {
    const shifted = shiftCaptions([cue('a', 1, 3)], -10);
    expect(shifted[0].start).toBe(0);
    expect(shifted[0].end).toBeCloseTo(0.1, 5);
  });

  it('returns clones (new ids/objects preserved, same values) for a zero offset', () => {
    const input = [cue('a', 1, 3)];
    const shifted = shiftCaptions(input, 0);
    expect(shifted).toEqual(input);
    expect(shifted[0]).not.toBe(input[0]);
  });
});

describe('cueListForEditor', () => {
  const captions = [cue('b', 3, 5), cue('a', 0, 2)];

  it('produces one subtitle row with one action per cue', () => {
    const rows = cueListForEditor(captions);

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(SUBTITLE_ROW_ID);
    expect(rows[0].actions).toHaveLength(2);

    const [first, second] = rows[0].actions;
    expect(first.id).toBe('a');
    expect(first.start).toBe(0);
    expect(first.end).toBe(2);
    expect(second.id).toBe('b');
    expect(second.start).toBe(3);
    expect(second.end).toBe(5);
    for (const action of rows[0].actions) {
      expect(action.effectId).toBe('subtitle');
      expect(action.flexible).toBe(true);
      expect(action.movable).toBe(true);
    }
  });

  it('round-trips: cues survive the editor row mapping', () => {
    const rows = cueListForEditor(captions);
    const roundTripped = rows[0].actions.map((action) =>
      captionFromText(action.id, action.start, action.end),
    );

    expect(roundTripped.map((c) => [c.start, c.end])).toEqual(
      sortByTime(captions).map((c) => [c.start, c.end]),
    );
  });
});

describe('captionFromText', () => {
  it('trims text and enforces a minimum duration', () => {
    const caption = captionFromText('  hello world  ', 2, 2);
    expect(caption.text).toBe('hello world');
    expect(caption.start).toBe(2);
    expect(caption.end).toBeGreaterThan(2);
    expect(caption.kind).toBe('dialogue');
    expect(caption.id).toBeTruthy();
  });

  it('clamps non-finite times', () => {
    const caption = captionFromText('x', Number.NaN, Number.POSITIVE_INFINITY);
    expect(caption.start).toBe(0);
    expect(caption.end).toBeCloseTo(2, 5);
  });
});

describe('MuAPI enum constants', () => {
  it('exposes exactly 18 caption themes including Hormozi_1', () => {
    expect(MUAPI_CAPTION_THEMES).toHaveLength(18);
    expect(MUAPI_CAPTION_THEMES).toContain('Hormozi_1');
    expect(new Set(MUAPI_CAPTION_THEMES).size).toBe(18);
    expect(DEFAULT_MUAPI_THEME).toBe('Hormozi_1');
  });

  it('exposes exactly 45 languages including English, Spanish and Japanese', () => {
    expect(MUAPI_CAPTION_LANGUAGES).toHaveLength(45);
    expect(MUAPI_CAPTION_LANGUAGES).toContain('English');
    expect(MUAPI_CAPTION_LANGUAGES).toContain('Spanish');
    expect(MUAPI_CAPTION_LANGUAGES).toContain('Japanese');
    expect(new Set(MUAPI_CAPTION_LANGUAGES).size).toBe(45);
    expect(DEFAULT_MUAPI_LANGUAGE).toBe('English');
  });
});

describe('caption style helpers', () => {
  it('carries a style through withStyle and reads it back', () => {
    const base = captionFromText('styled cue', 1, 3);
    const styled = withStyle(base, 'yellow');

    expect(readCaptionStyle(styled)).toBe('yellow');
    expect(styled.style).toBe('yellow');
    expect(styled.text).toBe(base.text);
    expect(styled.start).toBe(base.start);
    expect(styled.end).toBe(base.end);
    expect(styled.id).toBe(base.id);
  });

  it('never mutates the caption it copies', () => {
    const base = captionFromText('immutable', 0, 2);
    const snapshot = JSON.parse(JSON.stringify(base)) as StudioCaption;
    withStyle(base, 'boxed');
    expect(base).toEqual(snapshot);
  });

  it('falls back to the default style for missing, unknown or malformed values', () => {
    const plain = captionFromText('no style', 0, 2);
    expect(readCaptionStyle(plain)).toBe('bold');
    expect(DEFAULT_CAPTION_STYLE).toBe('bold');

    const unknown = { ...plain, style: 'neon' } as unknown as StudioCaption;
    expect(readCaptionStyle(unknown)).toBe('bold');

    expect(readCaptionStyle(null)).toBe('bold');
    expect(readCaptionStyle(undefined)).toBe('bold');
    expect(readCaptionStyle({} as StudioCaption)).toBe('bold');
  });

  it('round-trips every style through JSON (the persisted project shape)', () => {
    for (const style of CAPTION_STYLES) {
      const styled = withStyle(captionFromText(style, 0, 1), style);
      const revived = JSON.parse(JSON.stringify(styled)) as StudioCaption;
      expect(readCaptionStyle(revived)).toBe(style);
    }
  });

  it('exposes the four styles with labels and a working type guard', () => {
    expect([...CAPTION_STYLES]).toEqual(['bold', 'boxed', 'minimal', 'yellow']);
    expect(DEFAULT_CAPTION_STYLE).toBe('bold');
    for (const style of CAPTION_STYLES) {
      expect(CAPTION_STYLE_LABELS[style]).toBeTruthy();
      expect(isCaptionStyle(style)).toBe(true);
    }
    expect(isCaptionStyle('neon')).toBe(false);
    expect(isCaptionStyle(undefined)).toBe(false);
  });
});

describe('caption placement mapping', () => {
  it('maps every placement to a caption kind and back', () => {
    expect([...CAPTION_PLACEMENTS]).toEqual(['bottom-center', 'top-center', 'center']);
    expect(CAPTION_PLACEMENT_KINDS['bottom-center']).toBe('dialogue');
    expect(CAPTION_PLACEMENT_KINDS['top-center']).toBe('hook');
    expect(CAPTION_PLACEMENT_KINDS.center).toBe('lower_third');

    expect(kindForPlacement('bottom-center')).toBe('dialogue');
    expect(kindForPlacement('top-center')).toBe('hook');
    expect(kindForPlacement('center')).toBe('lower_third');

    expect(placementForKind('dialogue')).toBe('bottom-center');
    expect(placementForKind('hook')).toBe('top-center');
    expect(placementForKind('lower_third')).toBe('center');
  });

  it('is a lossless round trip for all three placements', () => {
    for (const placement of CAPTION_PLACEMENTS as readonly CaptionPlacement[]) {
      expect(placementForKind(kindForPlacement(placement))).toBe(placement);
    }
  });

  it('labels every placement for the UI', () => {
    for (const placement of CAPTION_PLACEMENTS as readonly CaptionPlacement[]) {
      expect(CAPTION_PLACEMENT_LABELS[placement]).toBeTruthy();
    }
  });

  it('styles are carried independently of the placement kind', () => {
    const caption: StudioCaption = {
      ...withStyle(captionFromText('placed', 0, 2), 'minimal'),
      kind: kindForPlacement('center'),
    };
    expect(placementForKind(caption.kind)).toBe('center');
    expect(readCaptionStyle(caption)).toBe('minimal');
  });
});

describe('studioCaptions defaults', () => {
  it('builds dialogue captions in the default style', () => {
    const caption = withStyle(captionFromText('hello', 0, 2), DEFAULT_CAPTION_STYLE as CaptionStyle);
    expect(caption.kind).toBe('dialogue');
    expect(readCaptionStyle(caption)).toBe(DEFAULT_CAPTION_STYLE);
  });
});
