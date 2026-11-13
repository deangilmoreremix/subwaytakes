import { AbsoluteFill } from 'remotion';
import { titleLines } from '../../lib/interview';

export interface TitleStyle { take: string; guest?: string; badge?: boolean }

/**
 * On-screen take: bold white text top-left, our own "HOT TAKE" badge bottom-left and an
 * optional guest name sticker bottom-right. Uses only CSS the web renderer supports
 * (no backdrop-filter, no 3D); the text shadow is a layered offset so it needs no outline support.
 */
export function TitleOverlay({ title, fontFamily, fontWeight }: { title: TitleStyle; fontFamily: string; fontWeight: number }) {
  const lines = titleLines(title.take, 16);
  if (!lines.length && !title.guest) return null;
  const shadow = '0 4px 0 rgba(0,0,0,0.85), 0 0 18px rgba(0,0,0,0.6)';
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', top: '6%', left: '6%', right: '14%', fontFamily, fontWeight, fontSize: 86, lineHeight: 1.05, color: '#fff', textShadow: shadow, textTransform: 'uppercase' }}>
        {lines.map((l, i) => <div key={i}>{l}</div>)}
      </div>
      {title.badge !== false && (
        <div style={{ position: 'absolute', left: '5%', bottom: '5%', fontFamily, fontWeight, fontSize: 34, color: '#111', background: '#ffd21f', padding: '8px 22px', borderRadius: 12, letterSpacing: 2 }}>HOT TAKE</div>
      )}
      {title.guest && (
        <div style={{ position: 'absolute', right: '5%', bottom: '5%', fontFamily, fontWeight, fontSize: 40, color: '#111', background: '#fff', padding: '8px 24px', borderRadius: 12, transform: 'rotate(-3deg)' }}>{title.guest}</div>
      )}
    </AbsoluteFill>
  );
}
