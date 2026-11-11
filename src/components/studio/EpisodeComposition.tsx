import { AbsoluteFill, Sequence } from 'remotion';
import { Video } from '@remotion/media';
import type { Project } from '../../lib/timeline/types';

export type EpisodeProps = { project: Project };

export function EpisodeComposition({ project }: EpisodeProps) {
  const videos = project.clips.filter(c => c.kind === 'video' && c.src);
  const captions = project.clips.filter(c => c.kind === 'caption');
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {videos.map(c => (
        <Sequence key={c.id} from={c.start} durationInFrames={c.duration} layout="absolute-fill">
          <Video src={c.src!} trimBefore={c.trimStart} volume={c.volume ?? 1} objectFit="cover" style={{ width: '100%', height: '100%' }} />
        </Sequence>
      ))}
      {captions.map(c => (
        <Sequence key={c.id} from={c.start} durationInFrames={c.duration} layout="absolute-fill">
          <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', padding: '0 7% 14%' }}>
            <div style={{
              fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 800, fontSize: 60, lineHeight: 1.2, textAlign: 'center',
              color: '#fff', background: 'rgba(0,0,0,0.62)', padding: '14px 28px', borderRadius: 24,
            }}>{c.text}</div>
          </AbsoluteFill>
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
