/**
 * SubwayTakes Studio — pure caption helpers.
 *
 * Captions live on the project as `StudioCaption[]` (seconds on the master
 * timeline) and are also exposed to the timeline editor as clips on the
 * `subtitle` track (start = caption.start, duration = caption.end - start).
 *
 * The MuAPI caption enums below mirror the official `ai-captions` model
 * contract: 18 caption themes and 45 languages.
 */

import type { StudioCaption } from '../studio/types';
import type { TimelineRow } from '@xzdarcy/timeline-engine';

// ---------------------------------------------------------------------------
// MuAPI AI Captions enums (official model contract)
// ---------------------------------------------------------------------------

/** The 18 MuAPI caption themes (default `Hormozi_1`). */
export const MUAPI_CAPTION_THEMES = [
  'Hormozi_1',
  'Hormozi_2',
  'Hormozi_3',
  'Beast',
  'Ali',
  'Noah',
  'Karl',
  'Luke',
  'Devin',
  'Celine',
  'Maya',
  'Ella',
  'Dan',
  'David',
  'Tracy',
  'Umi',
  'Iman',
  'William',
] as const;

/** The 45 MuAPI caption languages (default `English`). */
export const MUAPI_CAPTION_LANGUAGES = [
  'English',
  'English (USA)',
  'English (UK)',
  'English (Australia)',
  'English (Canada)',
  'Japanese',
  'Chinese',
  'German',
  'Hindi',
  'French',
  'French (France)',
  'French (Canada)',
  'Korean',
  'Portuguese (Brazil)',
  'Portuguese (Portugal)',
  'Portuguese',
  'Spanish (Spain)',
  'Spanish (Mexico)',
  'Italian',
  'Spanish',
  'Indonesian',
  'Dutch',
  'Turkish',
  'Filipino',
  'Polish',
  'Swedish',
  'Bulgarian',
  'Romanian',
  'Arabic (Saudi Arabia)',
  'Arabic (UAE)',
  'Arabic',
  'Czech',
  'Greek',
  'Finnish',
  'Croatian',
  'Malay',
  'Slovak',
  'Danish',
  'Tamil',
  'Telugu',
  'Ukrainian',
  'Russian',
  'Hungarian',
  'Norwegian',
  'Vietnamese',
] as const;

export type MuapiCaptionTheme = (typeof MUAPI_CAPTION_THEMES)[number];
export type MuapiCaptionLanguage = (typeof MUAPI_CAPTION_LANGUAGES)[number];

export const DEFAULT_MUAPI_THEME: MuapiCaptionTheme = 'Hormozi_1';
export const DEFAULT_MUAPI_LANGUAGE: MuapiCaptionLanguage = 'English';

/** Row id used for the caption (subtitle) row of the timeline editor. */
export const SUBTITLE_ROW_ID = 'subtitle-cues';

function clone(caption: StudioCaption): StudioCaption {
  return { ...caption };
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** Sort captions chronologically without mutating the input. */
export function sortByTime(captions: StudioCaption[]): StudioCaption[] {
  return [...captions].sort((a, b) => a.start - b.start || a.end - b.end);
}

/** Caption visible at time `t` (undefined when nothing is on screen). */
export function findActiveCaption(
  captions: StudioCaption[],
  t: number,
): StudioCaption | undefined {
  return sortByTime(captions).find((caption) => t >= caption.start && t < caption.end);
}

/** Merge overlapping cues (text joined with a space, longest end kept). */
export function mergeOverlaps(captions: StudioCaption[]): StudioCaption[] {
  const sorted = sortByTime(captions);
  const merged: StudioCaption[] = [];
  for (const caption of sorted) {
    const last = merged[merged.length - 1];
    if (!last || caption.start >= last.end) {
      merged.push(clone(caption));
      continue;
    }
    const sameSpeaker = last.speaker === caption.speaker;
    merged[merged.length - 1] = {
      ...last,
      text: sameSpeaker ? `${last.text} ${caption.text}`.trim() : last.text,
      end: Math.max(last.end, caption.end),
    };
  }
  return merged;
}

/** Build a caption from raw text (single source of truth for new cues). */
export function captionFromText(
  text: string,
  start: number,
  end: number,
  kind: StudioCaption['kind'] = 'dialogue',
  speaker?: string,
): StudioCaption {
  const safeStart = Math.max(0, Number.isFinite(start) ? start : 0);
  const safeEnd = Math.max(safeStart + 0.1, Number.isFinite(end) ? end : safeStart + 2);
  return {
    id: crypto.randomUUID(),
    text: text.trim(),
    start: safeStart,
    end: safeEnd,
    kind,
    speaker,
  };
}

/** Shift every cue by a fixed offset (used when beats are re-timed). */
export function shiftCaptions(
  captions: StudioCaption[],
  offsetSec: number,
): StudioCaption[] {
  if (!offsetSec) return captions.map(clone);
  return captions.map((caption) => ({
    ...caption,
    start: Math.max(0, caption.start + offsetSec),
    end: Math.max(0.1, caption.end + offsetSec),
  }));
}

/**
 * Timeline-editor rows for the subtitle track: one row per project, one action
 * per caption (start = caption.start, end = caption.end).
 */
export function cueListForEditor(captions: StudioCaption[]): TimelineRow[] {
  const actions = sortByTime(captions).map((caption) => ({
    id: caption.id,
    start: caption.start,
    end: caption.end,
    effectId: 'subtitle',
    flexible: true,
    movable: true,
  }));
  return [{ id: SUBTITLE_ROW_ID, actions }];
}
