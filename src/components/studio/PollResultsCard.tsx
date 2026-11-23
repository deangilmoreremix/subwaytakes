import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { pollBars, type PollResults } from '../../lib/poll';

/** The results card at the end of a poll: the question, two bars that grow, the percentages, the winner highlighted. Plain CSS only (web exporter). */
export function PollResultsCard({ data, fontFamily, fontWeight }: { data: PollResults; fontFamily: string; fontWeight: number }) {
  const frame = useCurrentFrame();
  const bars = pollBars(data.labels, data.counts);
  const total = data.counts[0] + data.counts[1];
  const fade = interpolate(frame, [0, 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const base = { fontFamily, fontWeight } as const;
  return (
    <AbsoluteFill style={{ background: 'linear-gradient(180deg, #14110a 0%, #0b0b0f 100%)', opacity: fade, padding: '9% 7%' }}>
      <div style={{ ...base, color: '#ffb000', fontSize: 40, letterSpacing: 3, textTransform: 'uppercase' }}>The results</div>
      <div style={{ ...base, color: '#fff', fontSize: 62, lineHeight: 1.1, marginTop: 18 }}>{data.question}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 38, marginTop: 80 }}>
        {bars.map((b, i) => {
          const grow = interpolate(frame, [12 + i * 6, 42 + i * 6], [0, b.percent], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          return (
            <div key={i} data-testid={`poll-bar-${i}`}>
              <div style={{ ...base, display: 'flex', justifyContent: 'space-between', color: b.winner ? '#ffb000' : '#fff', fontSize: 54 }}>
                <span>{b.label}{b.winner ? ' ★' : ''}</span><span>{b.percent}%</span>
              </div>
              <div style={{ height: 46, borderRadius: 23, background: 'rgba(255,255,255,0.12)', marginTop: 10, overflow: 'hidden' }}>
                <div style={{ width: `${grow}%`, height: '100%', borderRadius: 23, background: b.winner ? '#ffb000' : '#6b7280' }} />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ ...base, color: '#a1a1aa', fontSize: 38, marginTop: 70 }}>{total} guest{total === 1 ? '' : 's'} on the train</div>
    </AbsoluteFill>
  );
}
