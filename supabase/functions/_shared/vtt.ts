/**
 * WebVTT / SRT parsing helpers for the Subway Interview Studio.
 *
 * Pure functions, no dependencies: the parse* helpers turn subtitle text into
 * flat timed segments and `segmentsToCaptions` adapts them to the editor's
 * StudioCaption shape ({id, text, start, end, kind}).
 */

export interface CaptionSegment {
  /** Seconds from the start of the media. */
  startSec: number;
  endSec: number;
  /** Cue text; multi-line cues are joined with a single space. */
  text: string;
}

export interface StudioCaption {
  id: string;
  text: string;
  start: number;
  end: number;
  kind: "dialogue";
}

/** Matches "HH:MM:SS.mmm --> HH:MM:SS.mmm" (also MM:SS.mmm), with optional cue settings after. */
const TIMING_LINE =
  /^\s*(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})\s*-->\s*(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})/;

const SKIPPED_BLOCK_PREFIXES = ["WEBVTT", "NOTE", "STYLE", "REGION"];

function toSeconds(
  hours: string | undefined,
  minutes: string,
  seconds: string,
  fraction: string,
): number {
  const h = hours ? Number(hours) : 0;
  const ms = Number(fraction.padEnd(3, "0"));
  return h * 3600 + Number(minutes) * 60 + Number(seconds) + ms / 1000;
}

function normalizeText(lines: string[]): string {
  return lines
    .map((line) => line.trim().replace(/\s+/g, " "))
    .filter((line) => line.length > 0)
    .join(" ");
}

/**
 * Parse a cue-timestamped subtitle document (WebVTT or SRT share the block
 * layout: optional index/identifier line, timing line, text lines).
 *
 * Malformed blocks (no usable timing line, unreadable timestamps, or end <=
 * start) are skipped; overlapping cues and gaps between cues are preserved
 * exactly as authored.
 */
export function parseSubtitleBlocks(input: string): CaptionSegment[] {
  if (typeof input !== "string" || input.trim().length === 0) return [];

  const normalized = input.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const blocks = normalized.split(/\n{2,}/);

  const segments: CaptionSegment[] = [];
  for (const block of blocks) {
    const lines = block.split("\n").filter((line) => line.trim().length > 0);
    if (lines.length === 0) continue;

    const first = lines[0].trim();
    if (SKIPPED_BLOCK_PREFIXES.some((prefix) => first.startsWith(prefix))) {
      continue;
    }

    const timingIndex = lines.findIndex((line) => TIMING_LINE.test(line));
    if (timingIndex === -1) continue;

    const match = lines[timingIndex].match(TIMING_LINE);
    if (!match) continue;

    const startSec = toSeconds(match[1], match[2], match[3], match[4]);
    const endSec = toSeconds(match[5], match[6], match[7], match[8]);
    if (!Number.isFinite(startSec) || !Number.isFinite(endSec)) continue;
    if (endSec <= startSec) continue;

    const text = normalizeText(lines.slice(timingIndex + 1));
    if (text.length === 0) continue;

    segments.push({ startSec, endSec, text });
  }

  return segments;
}

/** Parse WebVTT text (HH:MM:SS.mmm cue timestamps). */
export function parseVttToSegments(vtt: string): CaptionSegment[] {
  return parseSubtitleBlocks(vtt);
}

/** Parse SRT text (HH:MM:SS,mmm cue timestamps with numeric index lines). */
export function parseSrtToSegments(srt: string): CaptionSegment[] {
  return parseSubtitleBlocks(srt);
}

/** Convert timed segments into editor captions. Empty-text segments are dropped. */
export function segmentsToCaptions(
  segments: CaptionSegment[],
  idPrefix = "cap",
): StudioCaption[] {
  const captions: StudioCaption[] = [];
  segments.forEach((segment, index) => {
    const text = typeof segment.text === "string" ? segment.text.trim() : "";
    if (text.length === 0) return;
    captions.push({
      id: `${idPrefix}-${index + 1}`,
      text,
      start: segment.startSec,
      end: segment.endSec,
      kind: "dialogue",
    });
  });
  return captions;
}
