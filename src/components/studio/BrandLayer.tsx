import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { AI_LABEL_TEXT, WATERMARK_TEXT, type BrandSnapshot } from '../../lib/brand/model';

const SHADOW = '0 3px 0 rgba(0,0,0,0.85), 0 0 14px rgba(0,0,0,0.6)';

/**
 * The customer's brand on every frame: logo top-right (inside the margin the headline already leaves free), the handle and the studio mark
 * bottom-centre, and a sponsor line for the last two seconds. Only CSS the web renderer supports (no backdrop-filter, 3D or inset shadows).
 * With no brand the small studio mark is still drawn (free exports), unless the kit says otherwise.
 */
export function BrandLayer({ brand, aiLabel = true, fontFamily, fontWeight }: { brand?: BrandSnapshot; aiLabel?: boolean; fontFamily: string; fontWeight: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const watermark = brand ? brand.watermark : true;
  const bottom = [brand?.handle, watermark ? WATERMARK_TEXT : ''].filter(Boolean).join('  ·  ');
  const sponsorFrom = Math.max(0, durationInFrames - 2 * fps);
  const sponsorIn = interpolate(frame, [sponsorFrom, sponsorFrom + 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const base = { fontFamily, fontWeight } as const;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {aiLabel && (
        <div style={{ ...base, position: 'absolute', left: '4%', top: '1.6%', fontSize: 24, letterSpacing: 1, color: '#ffffff', background: 'rgba(0,0,0,0.55)', padding: '4px 12px', borderRadius: 8 }}>{AI_LABEL_TEXT}</div>
      )}
      {brand?.logoUrl && (
        <div style={{ position: 'absolute', right: '3.5%', top: '8%', width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Img src={brand.logoUrl} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        </div>
      )}
      {bottom && (
        <div style={{ ...base, position: 'absolute', left: 0, right: 0, bottom: '1.4%', textAlign: 'center', fontSize: 26, letterSpacing: 1, color: brand?.accent ?? '#ffffff', textShadow: SHADOW, opacity: 0.92 }}>{bottom}</div>
      )}
      {brand?.sponsor && frame >= sponsorFrom && (
        <div style={{ ...base, position: 'absolute', left: '6%', right: '6%', bottom: '30%', textAlign: 'center', fontSize: 44, lineHeight: 1.15, color: '#ffffff', background: 'rgba(0,0,0,0.7)', borderLeft: `10px solid ${brand.primary}`, borderRadius: 16, padding: '16px 24px', opacity: sponsorIn }}>{brand.sponsor}</div>
      )}
    </AbsoluteFill>
  );
}
