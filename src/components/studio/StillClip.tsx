import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Clip } from '../../lib/timeline/types';

/**
 * A still picture that drifts slowly (zoom in or out, or a gentle pan), for narrated videos. Plain 2D CSS only (scale and translate on a clipped
 * frame), which the web exporter renders. The picture is scaled up a little so a pan never shows an empty edge.
 */
export function StillClip({ clip }: { clip: Clip }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = interpolate(frame, [0, Math.max(1, durationInFrames - 1)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const m = clip.still?.motion ?? 'in';
  const scale = m === 'in' ? 1.04 + 0.12 * t : m === 'out' ? 1.16 - 0.12 * t : 1.14;
  const shift = m === 'left' ? 3 - 6 * t : m === 'right' ? -3 + 6 * t : 0;
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: '#000' }}>
      <Img src={clip.src!} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `translateX(${shift}%) scale(${scale})`, transformOrigin: '50% 50%' }} />
    </AbsoluteFill>
  );
}
