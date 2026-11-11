import type React from 'react';
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import { Audio, Video } from '@remotion/media';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { LightLeak } from '@remotion/light-leaks';
import { buildChains } from '../../lib/timeline/chains';
import { transitionDef } from '../../lib/timeline/transitions';
import type { Project } from '../../lib/timeline/types';
import { useCaptionFont } from '../../lib/captions/fonts';

export type EpisodeProps = { project: Project };

function ClipVideo({ clip }: { clip: Project['clips'][number] }) {
  return <Video src={clip.src!} trimBefore={clip.trimStart} volume={clip.volume ?? 1} objectFit="cover" style={{ width: '100%', height: '100%' }} />;
}

export function EpisodeComposition({ project }: EpisodeProps) {
  const chains = buildChains(project.clips);
  const { width, height } = useVideoConfig();
  const overlays = project.clips.filter(c => c.kind === 'effect' && c.effect);
  const sounds = project.clips.filter(c => c.kind === 'audio' && c.src);
  const captions = project.clips.filter(c => c.kind === 'caption');
  const font = useCaptionFont(project.style?.captionFont);
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {chains.map(ch => ch.clips.length === 1 ? (
        <Sequence key={ch.clips[0].id} from={ch.start} durationInFrames={ch.end - ch.start} layout="absolute-fill">
          <ClipVideo clip={ch.clips[0]} />
        </Sequence>
      ) : (
        <Sequence key={ch.clips[0].id} from={ch.start} durationInFrames={ch.end - ch.start} layout="absolute-fill">
          <TransitionSeries>
            {ch.clips.flatMap((c, i) => {
              const nodes = [] as React.ReactNode[];
              if (i > 0 && c.transitionIn) {
                const def = transitionDef(c.transitionIn.type);
                if (def) nodes.push(<TransitionSeries.Transition key={`t-${c.id}`} presentation={def.make(width, height)} timing={linearTiming({ durationInFrames: c.transitionIn.frames })} />);
              }
              nodes.push(<TransitionSeries.Sequence key={c.id} durationInFrames={c.duration}><ClipVideo clip={c} /></TransitionSeries.Sequence>);
              return nodes;
            })}
          </TransitionSeries>
        </Sequence>
      ))}
      {overlays.map(c => (
        <Sequence key={c.id} from={c.start} durationInFrames={c.duration} layout="absolute-fill">
          <LightLeak seed={c.effect!.seed} hueShift={c.effect!.hueShift} />
        </Sequence>
      ))}
      {sounds.map(c => (
        <Sequence key={c.id} from={c.start} durationInFrames={c.duration} layout="none">
          <Audio src={c.src!} trimBefore={c.trimStart} volume={c.volume ?? 1} />
        </Sequence>
      ))}
      {captions.map(c => (
        <Sequence key={c.id} from={c.start} durationInFrames={c.duration} layout="absolute-fill">
          <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', padding: '0 7% 14%' }}>
            <div style={{
              fontFamily: font.family, fontWeight: font.weight, fontSize: 60, lineHeight: 1.2, textAlign: 'center',
              color: '#fff', background: 'rgba(0,0,0,0.62)', padding: '14px 28px', borderRadius: 24,
            }}>{c.text}</div>
          </AbsoluteFill>
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
