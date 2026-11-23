import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { takeCardLayout, titleLines } from '../../lib/interview';
import { verseFontSize } from '../../lib/shows';
import type { StoredTitle } from '../../lib/shows/stored';

const SHADOW = '0 4px 0 rgba(0,0,0,0.85), 0 0 18px rgba(0,0,0,0.6)';

/**
 * On-screen graphic for the show: bold take or question top-left, a show badge bottom-left, an optional guest name sticker
 * bottom-right, and a variant graphic (number reveal, score, A/B cards, VS). Only CSS the web renderer supports
 * (no backdrop-filter, no 3D, no inset shadows); the text shadow is a layered offset so it needs no outline support.
 */
export function TitleOverlay({ title, fontFamily, fontWeight }: { title: StoredTitle; fontFamily: string; fontWeight: number }) {
  const frame = useCurrentFrame();
  const vc = useVideoConfig();
  // In a wide frame the verse or quote card sits in the left part so faces in the middle and right stay visible.
  const wide = vc.width > vc.height * 1.2;
  const d = title.data;
  const pop = interpolate(frame, [0, 10], [0.6, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const fade = interpolate(frame, [0, 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const base = { fontFamily, fontWeight } as const;
  const card = d.variant === 'take' ? takeCardLayout(d.headline) : { size: 56, maxChars: 22, maxLines: 5 };
  const headSize = card.size;
  const lines = titleLines(d.headline, card.maxChars, card.maxLines);

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {d.variant !== 'ab' && d.variant !== 'verse' && d.variant !== 'quote' && d.variant !== 'quiz' && d.variant !== 'truths' && lines.length > 0 && (
        <div style={{ ...base, position: 'absolute', top: '6%', left: '6%', right: '14%', fontSize: headSize, lineHeight: 1.05, color: '#fff', textShadow: SHADOW, textTransform: 'uppercase' }}>
          {lines.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}

      {(d.variant === 'verse' || d.variant === 'quote') && d.headline && (
        <div style={{ position: 'absolute', top: wide ? '8%' : '7%', left: wide ? '4%' : '6%', right: wide ? '46%' : '6%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 22 }}>
          <div style={{ ...base, background: 'rgba(14,10,4,0.78)', border: `4px solid ${d.badgeBg}`, borderRadius: 28, padding: wide ? '20px 26px' : '34px 38px', color: '#fff7e0', fontSize: Math.round(verseFontSize(d.headline) * (wide ? 0.62 : 1)), lineHeight: 1.18, textShadow: '0 2px 0 rgba(0,0,0,0.6)' }}>
            {'\u201C'}{d.headline}{'\u201D'}
          </div>
          {d.value && <div style={{ ...base, fontSize: 40, letterSpacing: 1, color: d.badgeFg, background: d.badgeBg, padding: '8px 26px', borderRadius: 999 }}>{d.value}</div>}
        </div>
      )}

      {d.variant === 'number' && d.value && (
        <div style={{ ...base, position: 'absolute', left: 0, right: 0, top: '52%', textAlign: 'center', fontSize: 230, lineHeight: 1, color: d.badgeBg, textShadow: SHADOW, opacity: fade, transform: `scale(${pop})` }}>{d.value}</div>
      )}

      {d.variant === 'score' && d.value && (
        <div style={{ ...base, position: 'absolute', right: '6%', top: '30%', width: 330, height: 330, borderRadius: 165, background: d.badgeBg, color: d.badgeFg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 130, transform: `rotate(-6deg) scale(${pop})`, opacity: fade }}>{d.value}</div>
      )}

      {d.variant === 'ab' && (
        <div style={{ position: 'absolute', top: '5%', left: '5%', right: '5%', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ ...base, fontSize: 44, color: '#fff', textShadow: SHADOW, textTransform: 'uppercase', letterSpacing: 2 }}>{d.headline}</div>
          {[['A', d.left], ['B', d.right]].map(([k, text]) => text ? (
            <div key={k} style={{ ...base, display: 'flex', alignItems: 'center', gap: 22, background: 'rgba(0,0,0,0.62)', borderRadius: 24, padding: '16px 26px' }}>
              <div style={{ width: 84, height: 84, borderRadius: 42, background: d.badgeBg, color: d.badgeFg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 54, flexShrink: 0 }}>{k}</div>
              <div style={{ fontSize: 52, lineHeight: 1.1, color: '#fff', textTransform: 'uppercase' }}>{text}</div>
            </div>
          ) : null)}
        </div>
      )}

      {d.variant === 'quiz' && (
        <div style={{ position: 'absolute', top: '6%', left: '5%', right: '5%', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ ...base, display: 'flex', alignItems: 'center', gap: 22, background: 'rgba(0,0,0,0.66)', borderRadius: 26, padding: '20px 28px' }}>
            <div style={{ width: 92, height: 92, borderRadius: 46, background: d.badgeBg, color: d.badgeFg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 62, flexShrink: 0 }}>?</div>
            <div style={{ fontSize: 50, lineHeight: 1.1, color: '#fff' }}>{d.headline}</div>
          </div>
          {d.value && <div style={{ ...base, alignSelf: 'flex-start', background: d.badgeBg, color: d.badgeFg, fontSize: 56, padding: '8px 34px', borderRadius: 999, opacity: interpolate(frame, [60, 72], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }), transform: `scale(${interpolate(frame, [60, 72], [0.6, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })})` }}>{d.value}</div>}
        </div>
      )}

      {d.variant === 'truths' && (
        <div style={{ position: 'absolute', top: '5%', left: '5%', right: '5%', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ ...base, fontSize: 44, color: '#fff', textShadow: SHADOW, textTransform: 'uppercase', letterSpacing: 2 }}>{d.headline}</div>
          {(d.items ?? []).map((text, i) => (
            <div key={i} style={{ ...base, display: 'flex', alignItems: 'center', gap: 22, background: 'rgba(0,0,0,0.62)', borderRadius: 24, padding: '14px 24px' }}>
              <div style={{ width: 76, height: 76, borderRadius: 38, background: d.badgeBg, color: d.badgeFg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 50, flexShrink: 0 }}>{i + 1}</div>
              <div style={{ fontSize: 42, lineHeight: 1.1, color: '#fff' }}>{text}</div>
            </div>
          ))}
        </div>
      )}

      {d.variant === 'vs' && (d.left || d.right) && (
        <div style={{ position: 'absolute', left: '5%', right: '5%', top: '30%', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ ...base, flex: 1, background: 'rgba(0,0,0,0.62)', borderRadius: 24, padding: '18px 22px', color: '#fff', fontSize: 44, lineHeight: 1.1, textAlign: 'center' }}>{d.left}</div>
          <div style={{ ...base, width: 110, height: 110, borderRadius: 55, background: d.badgeBg, color: d.badgeFg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 56, flexShrink: 0, transform: `scale(${pop})` }}>VS</div>
          <div style={{ ...base, flex: 1, background: 'rgba(0,0,0,0.62)', borderRadius: 24, padding: '18px 22px', color: '#fff', fontSize: 44, lineHeight: 1.1, textAlign: 'center' }}>{d.right}</div>
        </div>
      )}

      {title.series?.name.trim() && (
        <div style={{ ...base, position: 'absolute', top: '2.2%', right: '4%', fontSize: 30, letterSpacing: 2, color: '#fff', background: 'rgba(0,0,0,0.62)', padding: '6px 16px', borderRadius: 10, textTransform: 'uppercase' }}>{title.series.name.trim()} · EP {title.series.episode}</div>
      )}
      {title.showBadge !== false && (
        <div style={{ ...base, position: 'absolute', left: '5%', bottom: '5%', fontSize: 34, color: d.badgeFg, background: d.badgeBg, padding: '8px 22px', borderRadius: 12, letterSpacing: 2 }}>{d.badge}</div>
      )}
      {title.guest && (
        <div style={{ ...base, position: 'absolute', right: '5%', bottom: '5%', fontSize: 40, color: '#111', background: '#fff', padding: '8px 24px', borderRadius: 12, transform: 'rotate(-3deg)' }}>{title.guest}</div>
      )}
    </AbsoluteFill>
  );
}
