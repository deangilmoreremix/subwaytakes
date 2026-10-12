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
import type { StudioProject, StudioClip, StudioCaption, StudioTrack } from './types';
import { clipLength } from './types';
import {
  readCaptionStyle,
  type CaptionStyle,
} from './captionStyles';
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

function VideoClipView({ clip, effectiveVolume }: { clip: StudioClip; effectiveVolume: number }) {
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
      volume={effectiveVolume}
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
    />
  );
}

function AudioClipView({ clip }: { clip: StudioClip }) {
  if (!clip.assetUrl) return null;
  return <Audio src={clip.assetUrl} volume={clip.volume} />;
}

/**
 * Single volume rule used by BOTH the preview and the render: a clip's volume
 * multiplied by its track's volume, and zero when the track is muted. Applied
 * to the video track's embedded audio too (the track slider/mute must affect
 * the clip's own audio, not only narration/music/ambient layers).
 */
export function effectiveClipVolume(clip: StudioClip, track: StudioTrack): number {
  if (track.muted) return 0;
  return Math.max(0, Math.min(1, clip.volume * track.volume));
}

type CaptionPlacementBox = 'top' | 'center' | 'bottom';

/**
 * Visual variant for one caption style. The caption style rides on the caption
 * object through `withStyle()`/`readCaptionStyle()` (src/studio/captionStyles.ts)
 * because `StudioCaption` in types.ts cannot be extended here; anything unset or
 * unknown falls back to the bold-stroke default.
 */
interface CaptionTextVariant {
  color: string;
  fontWeight: number;
  textShadow: string;
  webkitTextStroke?: string;
  textTransform?: 'lowercase';
  /** Set for 'boxed': the text sits inside a solid chip. */
  chip?: React.CSSProperties;
  /** Plate background for card-style captions (hook / lower_third). */
  plate: string;
  plateRadius: number;
  platePaddingV: number;
  platePaddingH: number;
  plateBorder: string;
}

function captionTextVariant(style: CaptionStyle, scale: number): CaptionTextVariant {
  const px = (value: number) => `${Math.max(1, Math.round(value * scale))}px`;
  switch (style) {
    case 'boxed':
      return {
        color: '#ffffff',
        fontWeight: 800,
        textShadow: '0 2px 8px rgba(0,0,0,0.55)',
        chip: {
          background: 'rgba(0,0,0,0.82)',
          borderRadius: Math.round(14 * scale),
          padding: `${px(10)} ${px(20)}`,
        },
        plate: 'rgba(0,0,0,0.88)',
        plateRadius: Math.round(16 * scale),
        platePaddingV: Math.round(14 * scale),
        platePaddingH: Math.round(26 * scale),
        plateBorder: '1px solid rgba(255,255,255,0.18)',
      };
    case 'minimal':
      return {
        color: 'rgba(255,255,255,0.92)',
        fontWeight: 500,
        textShadow: '0 1px 6px rgba(0,0,0,0.5)',
        textTransform: 'lowercase',
        plate: 'transparent',
        plateRadius: Math.round(10 * scale),
        platePaddingV: Math.round(8 * scale),
        platePaddingH: Math.round(12 * scale),
        plateBorder: '1px solid rgba(255,255,255,0.12)',
      };
    case 'yellow':
      // Hormozi-ish: saturated yellow with a heavy dark outline.
      return {
        color: '#FDE047',
        fontWeight: 900,
        textShadow: '0 3px 10px rgba(0,0,0,0.95), 0 0 3px rgba(0,0,0,1)',
        webkitTextStroke: `${px(2)} rgba(0,0,0,0.9)`,
        plate: 'rgba(0,0,0,0.78)',
        plateRadius: Math.round(16 * scale),
        platePaddingV: Math.round(12 * scale),
        platePaddingH: Math.round(24 * scale),
        plateBorder: '1px solid rgba(253,224,71,0.45)',
      };
    case 'bold':
    default:
      return {
        color: '#ffffff',
        fontWeight: 800,
        textShadow: '0 4px 12px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,1)',
        webkitTextStroke: `${px(1.5)} rgba(0,0,0,0.85)`,
        plate: 'rgba(0,0,0,0.72)',
        plateRadius: Math.round(24 * scale),
        platePaddingV: Math.round(20 * scale),
        platePaddingH: Math.round(36 * scale),
        plateBorder: '1px solid rgba(255,255,255,0.06)',
      };
  }
}

const PLACEMENT_BOX: Record<StudioCaption['kind'], CaptionPlacementBox> = {
  hook: 'top',
  lower_third: 'center',
  dialogue: 'bottom',
};

function placementStyle(box: CaptionPlacementBox, height: number): React.CSSProperties {
  if (box === 'top') {
    return { justifyContent: 'flex-start', alignItems: 'center', paddingTop: height * 0.16 };
  }
  if (box === 'center') {
    return { justifyContent: 'center', alignItems: 'center' };
  }
  return { justifyContent: 'flex-end', alignItems: 'center', paddingBottom: height * 0.12 };
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
  const style = readCaptionStyle(caption);
  const variant = captionTextVariant(style, baseFont / 32);
  const box = PLACEMENT_BOX[caption.kind] ?? 'bottom';
  const containerStyle: React.CSSProperties = {
    ...placementStyle(box, height),
    opacity,
  };

  const textStyle: React.CSSProperties = {
    color: variant.color,
    fontSize: baseFont,
    fontWeight: variant.fontWeight,
    fontFamily: 'Inter, Arial, Helvetica, sans-serif',
    textAlign: 'center',
    textShadow: variant.textShadow,
    ...(variant.webkitTextStroke ? { WebkitTextStroke: variant.webkitTextStroke } : {}),
    ...(variant.textTransform ? { textTransform: variant.textTransform } : {}),
    lineHeight: 1.25,
    maxWidth: '90%',
  };

  if (caption.kind === 'hook') {
    return (
      <AbsoluteFill style={containerStyle}>
        <div
          style={{
            background: variant.plate,
            borderRadius: variant.plateRadius,
            padding: `${variant.platePaddingV}px ${variant.platePaddingH}px`,
            maxWidth: '86%',
            textAlign: 'center',
            border: variant.plateBorder,
          }}
        >
          <div style={{ color: accent, fontSize: baseFont * 0.62, fontFamily: 'Inter, Arial, sans-serif', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>
            {caption.speaker || '@subwaytakes'}
          </div>
          <div style={{ ...textStyle, fontSize: baseFont * 1.05, marginTop: 10 }}>
            {caption.text}
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  if (caption.kind === 'lower_third') {
    return (
      <AbsoluteFill style={containerStyle}>
        <div
          style={{
            background: variant.plate,
            borderRadius: variant.plateRadius,
            padding: `${variant.platePaddingV}px ${variant.platePaddingH}px`,
            border: variant.plateBorder,
            textAlign: 'center',
          }}
        >
          <div style={{ ...textStyle, fontSize: baseFont * 0.85 }}>
            {caption.text}
          </div>
          {caption.speaker ? (
            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: baseFont * 0.55, fontFamily: 'Inter, Arial, sans-serif', marginTop: 4, textAlign: 'center' }}>
              {caption.speaker}
            </div>
          ) : null}
        </div>
      </AbsoluteFill>
    );
  }

  // dialogue caption — placement + style variant (bottom-center by default)
  return (
    <AbsoluteFill style={containerStyle}>
      <div
        style={{
          ...textStyle,
          padding: variant.chip ? 0 : '0 48px',
        }}
      >
        {variant.chip ? (
          <span style={{ ...variant.chip, display: 'inline-block' }}>{caption.text}</span>
        ) : (
          caption.text
        )}
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
              <VideoClipView clip={clip} effectiveVolume={effectiveClipVolume(clip, videoTrack)} />
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

      {/* ---- captions (editable mode) ----
          No <Sequence> wrapper: CaptionView windows itself from the ABSOLUTE
          frame. Wrapping it in a Sequence from `startFrame` would hand it a
          sequence-LOCAL frame while its visibility check compares against
          start/end in seconds — which shifted every caption later by its own
          start time (a 0.5s caption actually appeared at 1.0s). */}
      {project.captions.map((caption) => (
        <CaptionView key={caption.id} caption={caption} height={height} />
      ))}

      {/* ---- branding ---- */}
      {project.branding.showProgressBar && (
        <ProgressBar frame={frame} color={project.branding.accentColor} />
      )}
      <BrandWatermark
        frame={frame}
        fps={fps}
        text={project.branding.watermarkText}
        position={project.branding.watermarkPosition}
        logoUrl={project.branding.logoUrl ?? null}
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
