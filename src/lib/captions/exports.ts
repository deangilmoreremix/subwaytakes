import type { Clip } from '../timeline/types';
import type { CaptionStyle } from './model';
import { FONT_META, nearestWeight } from './fontData';
import { styleForText } from './scripts';
import { clipText } from './words';
import { transcriptText } from './edit';
import { ensureWords } from './words';

// Caption file writers. Pure: caption clips in, text out. Times are timeline times (so they line up with the exported video).

const captions = (clips: Clip[]): Clip[] => clips.filter(c => c.kind === 'caption' && clipText(c)).sort((a, b) => a.start - b.start);
const secs = (frames: number, fps: number) => frames / fps;
const pad = (n: number, w = 2) => String(Math.floor(n)).padStart(w, '0');

function stamp(sec: number, sep: ',' | '.'): string {
  const ms = Math.round(sec * 1000);
  return `${pad(ms / 3_600_000)}:${pad((ms % 3_600_000) / 60_000)}:${pad((ms % 60_000) / 1000)}${sep}${pad(ms % 1000, 3)}`;
}

/** SubRip. One cue per caption, numbered from 1. */
export function toSrt(clips: Clip[], fps: number): string {
  return captions(clips).map((c, i) => `${i + 1}\n${stamp(secs(c.start, fps), ',')} --> ${stamp(secs(c.start + c.duration, fps), ',')}\n${clipText(c)}\n`).join('\n');
}

/** WebVTT. Same cues with a header and dots in the times. */
export function toVtt(clips: Clip[], fps: number): string {
  return `WEBVTT\n\n${captions(clips).map(c => `${stamp(secs(c.start, fps), '.')} --> ${stamp(secs(c.start + c.duration, fps), '.')}\n${clipText(c).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}\n`).join('\n')}`;
}

/** Plain text, one caption per line. */
export const toTxt = (clips: Clip[]): string => transcriptText(captions(clips)) + '\n';

/** JSON with word timings in seconds (for other tools). */
export function toJson(clips: Clip[], fps: number, style?: CaptionStyle): string {
  return JSON.stringify({
    fps, style: style ?? null,
    captions: captions(clips).map(c => ({ start: secs(c.start, fps), end: secs(c.start + c.duration, fps), text: clipText(c), words: ensureWords(c).map(w => ({ text: w.t, start: secs(c.start + w.s, fps), end: secs(c.start + w.e, fps) })) })),
  }, null, 2);
}

// ---- ASS (Advanced SubStation Alpha) ----
const assColor = (hex: string): string => { const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex); return m ? `&H00${m[3]}${m[2]}${m[1]}`.toUpperCase().replace('&H', '&H') : '&H00FFFFFF'; };
const assStamp = (sec: number): string => { const cs = Math.round(sec * 100); return `${Math.floor(cs / 360000)}:${pad((cs % 360000) / 6000)}:${pad((cs % 6000) / 100)}.${pad(cs % 100)}`; };
const assText = (s: string): string => s.replace(/[{}\\]/g, '').replace(/\n/g, '\\N');

export const ASS_PLAY = { x: 1080, y: 1920 } as const;

/**
 * ASS subtitles with per-word karaoke timing, in the chosen style, for players and editors that read ASS. It approximates the on-screen motion
 * (colour change or wipe per word); the burned-in MP4 is the exact look.
 */
export function toAss(clips: Clip[], fps: number, style: CaptionStyle): string {
  const list = captions(clips);
  const sample = list.map(clipText).join(' ');
  const { font, upper } = styleForText(style, sample);
  const meta = FONT_META[font];
  const bold = nearestWeight(font, style.weight) >= 700 ? -1 : 0;
  const marginV = Math.round((ASS_PLAY.y * style.positionY) / 100);
  const wipe = style.engine === 'karaoke_fill';
  const head = [
    '[Script Info]', 'ScriptType: v4.00+', `PlayResX: ${ASS_PLAY.x}`, `PlayResY: ${ASS_PLAY.y}`, 'WrapStyle: 0', 'ScaledBorderAndShadow: yes', '',
    '[V4+ Styles]', 'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    // In ASS the "primary" colour is the colour a karaoke word becomes once it is spoken; the secondary colour is how it looks before.
    `Style: Caption,${meta.family},${style.size},${assColor(style.colors.highlight)},${assColor(style.colors.text)},${assColor(style.colors.outline)},&H80000000,${bold},0,0,0,100,100,0,0,1,${style.outlineWidth},0,2,60,60,${marginV},1`, '',
    '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];
  const lines = list.map(c => {
    const words = ensureWords(c);
    const body = words.map((w, i) => {
      const next = words[i + 1];
      const cs = Math.max(1, Math.round(((next ? next.s : c.duration) - w.s) / fps * 100));
      const t = upper ? w.t.toUpperCase() : w.t;
      return `{\\${wipe ? 'kf' : 'k'}${cs}}${assText(t)}`;
    }).join(' ');
    const lead = words[0]?.s > 0 ? `{\\k${Math.max(1, Math.round(words[0].s / fps * 100))}}` : '';   // silence before the first word, so the highlight is not early
    return `Dialogue: 0,${assStamp(secs(c.start, fps))},${assStamp(secs(c.start + c.duration, fps))},Caption,,0,0,0,,${lead}${body}`;
  });
  return `${head.join('\n')}\n${lines.join('\n')}\n`;
}

export const EXPORT_FORMATS = [
  { id: 'srt', label: 'SRT', ext: 'srt', mime: 'application/x-subrip', note: 'Subtitles for any player or platform' },
  { id: 'vtt', label: 'VTT', ext: 'vtt', mime: 'text/vtt', note: 'Subtitles for the web' },
  { id: 'txt', label: 'TXT', ext: 'txt', mime: 'text/plain', note: 'Plain transcript' },
  { id: 'ass', label: 'ASS', ext: 'ass', mime: 'text/x-ssa', note: 'Styled karaoke subtitles' },
  { id: 'json', label: 'JSON', ext: 'json', mime: 'application/json', note: 'Words and times for other tools' },
] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number]['id'];

export function exportCaptions(format: ExportFormat, clips: Clip[], fps: number, style: CaptionStyle): string {
  switch (format) {
    case 'srt': return toSrt(clips, fps);
    case 'vtt': return toVtt(clips, fps);
    case 'txt': return toTxt(clips);
    case 'ass': return toAss(clips, fps, style);
    case 'json': return toJson(clips, fps, style);
  }
}
