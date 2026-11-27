import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

/**
 * The city name at the start of each stop of a world tour: a dark band across the upper third with the city in big letters,
 * sliding in and fading out. Plain CSS only (the web exporter has no backdrop-filter or 3D). It leaves the lower two thirds of the shot clear.
 */
export function CityTagCard({ city, fontFamily, fontWeight }: { city: string; fontFamily: string; fontWeight: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const inn = interpolate(frame, [0, 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const out = interpolate(frame, [durationInFrames - 10, durationInFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const o = Math.min(inn, out);
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: '14%', padding: '4% 7%', background: 'linear-gradient(90deg, rgba(10,10,12,0.88), rgba(10,10,12,0.55))', transform: `translateX(${(1 - inn) * -60}px)` }}>
        <div style={{ fontFamily, fontWeight, color: '#ffb000', fontSize: 34, letterSpacing: 6, textTransform: 'uppercase' }}>Now in</div>
        <div data-testid="city-tag" style={{ fontFamily, fontWeight, color: '#fff', fontSize: 110, lineHeight: 1.05, textTransform: 'uppercase' }}>{city}</div>
      </div>
    </AbsoluteFill>
  );
}
