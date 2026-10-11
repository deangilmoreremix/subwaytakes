import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Sequence,
  Video,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from 'remotion';
import type { StudioProject, StudioClip, StudioCaption } from './types';
import { clipLength } from './types';
import { BrandWatermark } from '../../remotion/src/overlays/BrandWatermark';
import { ProgressBar } from '../../remotion/src/overlays/ProgressBar';

export interface SubwayEditorCompositionProps {
  project: StudioProject;
}

const BLACK: React.CSSProperties = { backgroundColor: '#000' };

function ClipFade({
  clip,
  children,
}: {
  clip: StudioClip;
  children: React.ReactNode;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lengthFrames = Math.max(1, Math.round(clipLength(clip) * fps));
  const fadeInFrames = clip.fadeIn > 0 ? Math.min(Math.round(clip.fadeIn * fps), lengthFrames / 2) : 0;
  const fadeOutFrames = clip.fadeOut > 0 ? Math.min(Math.round(clip.fadeOut * fps), lengthFrames / 2) : 0;

  let opacity = 1;
  if (fadeInFrames > 0) {
    opacity = interpolate(frame, [0, fadeInFrames], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  }
  if (fadeOutFrames > 0) {
    const fadeOut = interpolate(
      frame,
      [lengthFrames - fadeOutFrames, lengthFrames],
      [1, 0],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
    );
    opacity = Math.min(opacity, fadeOut);
  }

  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
}

function VideoClipView({ clip }: { clip: StudioClip }) {
  const { fps, height } = useVideoConfig();

  if (!clip.assetUrl) {
    return (
      <AbsoluteFill style={{ ...BLACK, justifyContent: 'center', alignItems: 'center' }}>
        <div
          style={{
            color: '#3f3f46',
            fontSize: Math.round(height * 0.03),
            fontFamily: 'Inter, Arial, sans-serif',
            textAlign: 'center',
            padding: 40,
          }}
        >
          {clip.label || 'Empty beat'}
          {'\n'}
          <span style={{ fontSize: Math.round(height * 0.018), color: '#52525b' }}>
            Add a generated clip or upload footage
          </span>
        </div>
      </AbsoluteFill>
    );
  }

  return (
    <Video
      src={clip.assetUrl}
      startFrom={Math.round(clip.trimStart * fps)}
      endAt={Math.round(clip.trimEnd * fps)}
      volume={clip.volume}
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
    />
  );
}

function AudioClipView({ clip }: { clip: StudioClip }) {
  if (!clip.assetUrl) return null;
  return <Audio src={clip.assetUrl} volume={clip.volume} />;
}

function CaptionView({ caption, height }: { caption: StudioCaption; height: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const startFrame = Math.round(caption.start * fps);
  const endFrame = Math.round(caption.end * fps);
  const visible = frame >= startFrame && frame < endFrame;
  if (!visible || !caption.text.trim()) return null;

  const localFrame = frame - startFrame;
  const totalFrames = Math.max(1, endFrame - startFrame);
  const opacity = interpolate(
    localFrame,
    [0, Math.min(8, totalFrames / 3), Math.max(0, totalFrames - 8), totalFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const baseFont = Math.round(height * 0.032);
  const accent = '#F59E0B';

  if (caption.kind === 'hook') {
    return (
      <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'center', paddingTop: height * 0.16, opacity }}>
        <div
          style={{
            background: 'rgba(0,0,0,0.72)',
            borderRadius: 24,
            padding: '28px 40px',
            maxWidth: '86%',
            textAlign: 'center',
          }}
        >
          <div style={{ color: accent, fontSize: baseFont * 0.62, fontFamily: 'Inter, Arial, sans-serif', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>
            {caption.speaker || '@subwaytakes'}
          </div>
          <div style={{ color: '#fff', fontSize: baseFont * 1.05, fontWeight: 800, fontFamily: 'Inter, Arial, sans-serif', lineHeight: 1.2, marginTop: 10 }}>
            {caption.text}
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  if (caption.kind === 'lower_third') {
    return (
      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'flex-start', padding: height * 0.05, opacity }}>
        <div
          style={{
            background: `linear-gradient(90deg, ${accent} 0%, rgba(0,0,0,0.85) 60%)`,
            borderRadius: 12,
            padding: '18px 32px',
          }}
        >
          <div style={{ color: '#fff', fontSize: baseFont * 0.85, fontWeight: 800, fontFamily: 'Inter, Arial, sans-serif' }}>
            {caption.text}
          </div>
          {caption.speaker ? (
            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: baseFont * 0.55, fontFamily: 'Inter, Arial, sans-serif', marginTop: 4 }}>
              {caption.speaker}
            </div>
          ) : null}
        </div>
      </AbsoluteFill>
    );
  }

  // dialogue caption — bottom centered, bold, black stroke
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: height * 0.12, opacity }}>
      <div
        style={{
          color: '#fff',
          fontSize: baseFont,
          fontWeight: 800,
          fontFamily: 'Inter, Arial, Helvetica, sans-serif',
          textAlign: 'center',
          textShadow: '0 4px 12px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,1)',
          WebkitTextStroke: '1.5px rgba(0,0,0,0.85)',
          padding: '0 48px',
          lineHeight: 1.25,
          maxWidth: '90%',
        }}
      >
        {caption.text}
      </div>
    </AbsoluteFill>
  );
}

/**
 * Renders a StudioProject to 1080x1920 (or project dimensions):
 * - video track clips are placed at absolute timeline positions with trims,
 *   volumes and fades (timeline edits therefore appear in the rendered MP4)
 * - narration / music / ambient tracks render as <Audio> layers
 * - captions render as text layers (editable caption mode)
 * - branding watermark + progress bar render on top
 */
export const SubwayEditorComposition: React.FC<SubwayEditorCompositionProps> = ({ project }) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();

  const videoTrack = project.tracks.find((t) => t.kind === 'video');
  const audioTracks = project.tracks.filter((t) => t.kind === 'narration' || t.kind === 'music' || t.kind === 'ambient');

  return (
    <AbsoluteFill style={BLACK}>
      {/* ---- video track ---- */}
      {videoTrack?.clips.map((clip) => {
        const lengthFrames = Math.max(1, Math.round(clipLength(clip) * fps));
        return (
          <Sequence
            key={clip.id}
            from={Math.round(clip.start * fps)}
            durationInFrames={lengthFrames}
            layout="none"
          >
            <ClipFade clip={clip}>
              <VideoClipView clip={clip} />
            </ClipFade>
          </Sequence>
        );
      })}

      {/* ---- audio tracks (narration / music / ambient) ---- */}
      {audioTracks.map((track) =>
        track.muted
          ? null
          : track.clips.map((clip) => (
              <Sequence
                key={`${track.id}-${clip.id}`}
                from={Math.round(clip.start * fps)}
                durationInFrames={Math.max(1, Math.round(clipLength(clip) * fps))}
                layout="none"
              >
                <AudioClipView clip={{ ...clip, volume: clip.volume * track.volume }} />
              </Sequence>
            )),
      )}

      {/* ---- captions (editable mode) ---- */}
      {project.captions.map((caption) => {
        const startFrame = Math.round(caption.start * fps);
        const endFrame = Math.round(caption.end * fps);
        return (
          <Sequence
            key={caption.id}
            from={startFrame}
            durationInFrames={Math.max(1, endFrame - startFrame)}
            layout="none"
          >
            <CaptionView caption={caption} height={height} />
          </Sequence>
        );
      })}

      {/* ---- branding ---- */}
      {project.branding.showProgressBar && (
        <ProgressBar frame={frame} color={project.branding.accentColor} />
      )}
      <BrandWatermark
        frame={frame}
        fps={fps}
        text={project.branding.watermarkText}
        position={project.branding.watermarkPosition}
        showLogo={Boolean(project.branding.logoUrl)}
      />
    </AbsoluteFill>
  );
};

/** Duration of the composition in frames for a project. */
export function projectDurationInFrames(project: StudioProject): number {
  let end = 0;
  for (const track of project.tracks) {
    for (const clip of track.clips) {
      end = Math.max(end, clip.start + clipLength(clip));
    }
  }
  for (const caption of project.captions) {
    end = Math.max(end, caption.end);
  }
  return Math.max(30, Math.ceil(Math.max(end, project.duration) * project.fps));
}
