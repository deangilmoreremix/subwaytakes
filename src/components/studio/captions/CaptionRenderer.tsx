import { useMemo } from 'react';
import { AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Clip } from '../../../lib/timeline/types';
import type { CaptionStyle } from '../../../lib/captions/model';
import { FONT_META } from '../../../lib/captions/fontData';
import { FALLBACK_STACK, fontRequests, useFontFamilies } from '../../../lib/captions/fontLoaders';
import { styleForText } from '../../../lib/captions/scripts';
import { activeWordIndex, clipText, ensureWords } from '../../../lib/captions/words';
import { wordCss } from '../../../lib/captions/motion';

/** One caption (a line of words) with the style's motion. Rendered inside a Sequence, so `useCurrentFrame()` is relative to the caption's start. */
export function CaptionLine({ clip, style, families }: { clip: Clip; style: CaptionStyle; families: Record<string, string> }) {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const words = useMemo(() => ensureWords(clip), [clip]);
  const text = clipText(clip);
  const { font, rtl, upper, script } = styleForText(style, text);
  const k = width / 1080;
  const idx = activeWordIndex(words, frame);
  const family = families[font] ?? `"${FONT_META[font].family}", ${FALLBACK_STACK}`;
  const spaceless = script === 'japanese' || script === 'chinese' || script === 'thai';

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', left: '5%', right: '5%', bottom: `${style.positionY}%`, display: 'flex', justifyContent: 'center' }}>
        <div dir={rtl ? 'rtl' : 'ltr'} style={{ fontFamily: family, textAlign: 'center', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'baseline', rowGap: 4 * k, columnGap: spaceless ? 0 : style.size * k * 0.16 }}>
          {words.map((w, i) => {
            const spoken = frame >= w.s;
            const dur = Math.max(1, w.e - w.s);
            const state = {
              spoken, active: i === idx,
              progress: Math.min(1, Math.max(0, (frame - w.s) / dur)),
              pop: spoken ? spring({ frame: frame - w.s, fps, config: { damping: style.engine === 'elastic_bounce' ? 6 : 13, stiffness: style.engine === 'elastic_bounce' ? 220 : 190, mass: 0.6 } }) : 0,
              ease: interpolate(frame - w.s, [0, 6], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
            };
            const { style: css, fill } = wordCss({ ...style, font }, k, state, upper);
            const label = w.t;
            return (
              <span key={i} style={css}>
                {label}
                {fill && fill.percent > 0 && (
                  // the highlight layer sits on top and shows only the filled part of the word (plain overflow clipping: no background-clip on text)
                  <span aria-hidden style={{ position: 'absolute', top: 0, bottom: 0, insetInlineStart: 0, width: `${fill.percent}%`, overflow: 'hidden', whiteSpace: 'pre', color: fill.color, padding: css.padding, boxSizing: 'border-box', textShadow: css.textShadow, textTransform: css.textTransform, fontWeight: css.fontWeight }}>
                    <span style={{ display: 'inline-block' }}>{label}</span>
                  </span>
                )}
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** All caption clips of a project, in the chosen style. Loads only the fonts the captions need and waits for them. */
export function CaptionsLayer({ clips, style }: { clips: Clip[]; style: CaptionStyle }) {
  const requests = useMemo(() => fontRequests([
    { key: style.font, weight: style.weight, weightTo: style.weightTo },
    ...clips.map(c => ({ key: styleForText(style, clipText(c)).font, weight: style.weight, weightTo: style.weightTo })),
  ]), [clips, style]);
  const families = useFontFamilies(requests);
  return (
    <>
      {clips.map(c => (
        <Sequence key={c.id} from={c.start} durationInFrames={c.duration} layout="absolute-fill">
          <CaptionLine clip={c} style={style} families={families} />
        </Sequence>
      ))}
    </>
  );
}
