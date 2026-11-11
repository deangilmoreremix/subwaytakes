import { AbsoluteFill, Sequence, Html5Video } from 'remotion';
import type { Project } from '../../lib/timeline/types';

export interface EpisodeProps { project: Project }

export function EpisodeComposition({ project }: EpisodeProps) {
  const videos = project.clips.filter(c => c.kind === 'video' && c.src);
  const captions = project.clips.filter(c => c.kind === 'caption');
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {videos.map(c => (
        <Sequence key={c.id} from={c.start} durationInFrames={c.duration} layout="absolute-fill">
          <Html5Video src={c.src!} trimBefore={c.trimStart} volume={c.volume ?? 1} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </Sequence>
      ))}
      {captions.map(c => (
        <Sequence key={c.id} from={c.start} durationInFrames={c.duration} layout="absolute-fill">
          <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', padding: '0 7% 14%' }}>
            <div style={{
              fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 800, fontSize: 64, lineHeight: 1.15, textAlign: 'center',
              color: '#fff', textShadow: '0 4px 24px rgba(0,0,0,.85)', WebkitTextStroke: '2px rgba(0,0,0,.6)', letterSpacing: -1,
            }}>{c.text}</div>
          </AbsoluteFill>
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
