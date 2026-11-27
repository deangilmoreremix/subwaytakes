import { useEffect, useRef, type RefObject } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import { AbsoluteFill } from 'remotion';
import { EpisodeComposition } from '../EpisodeComposition';
import { CaptionsLayer } from './CaptionRenderer';
import { COMP_SIZE } from '../compSize';
import { projectDuration } from '../../../lib/timeline/ops';
import { DEFAULT_CAPTION_STYLE } from '../../../lib/captions/presets';
import { clampPosition } from '../../../lib/captions/model';
import type { Project } from '../../../lib/timeline/types';
import type { Aspect } from '../../../lib/muapi/registry';

export type PreviewBg = 'video' | 'black' | 'gradient' | 'light';
// eslint-disable-next-line react-refresh/only-export-components
export const PREVIEW_BGS: Array<{ id: PreviewBg; label: string }> = [{ id: 'video', label: 'Video' }, { id: 'black', label: 'Black' }, { id: 'gradient', label: 'Gradient' }, { id: 'light', label: 'Light' }];
const BG_CSS: Record<Exclude<PreviewBg, 'video'>, string> = { black: '#000', gradient: 'linear-gradient(160deg,#1e3a8a 0%,#7c3aed 55%,#db2777 100%)', light: '#e5e7eb' };

/** Captions only, on a plain background: used when the video is hidden (and in the Generate modal, which has no timeline yet). */
export function CaptionOnlyComposition({ project, bg }: { project: Project; bg: Exclude<PreviewBg, 'video'> }) {
  return (
    <AbsoluteFill style={{ background: BG_CSS[bg] }}>
      <CaptionsLayer clips={project.clips.filter(c => c.kind === 'caption')} style={project.style?.captions ?? DEFAULT_CAPTION_STYLE} />
    </AbsoluteFill>
  );
}

/** A phone-shaped player with a draggable caption position, background choice and speed. */
export function PhonePreview({ project, aspect, bg, speed = 1, playerRef, onFrame, onPosition, autoPlay = false, heightClass = 'h-full' }: {
  project: Project; aspect: Aspect; bg: PreviewBg; speed?: number; playerRef: RefObject<PlayerRef>; onFrame?: (f: number) => void; onPosition: (positionY: number) => void; autoPlay?: boolean; heightClass?: string;
}) {
  const [w, h] = COMP_SIZE[aspect];
  const duration = Math.max(1, projectDuration(project));
  const positionY = project.style?.captions?.positionY ?? DEFAULT_CAPTION_STYLE.positionY;
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef(false);

  useEffect(() => {
    const p = playerRef.current; if (!p || !onFrame) return;
    const fn = (e: { detail: { frame: number } }) => onFrame(e.detail.frame);
    p.addEventListener('frameupdate', fn); return () => p.removeEventListener('frameupdate', fn);
  }, [playerRef, onFrame, bg]);

  const move = (clientY: number) => {
    const r = box.current?.getBoundingClientRect(); if (!r) return;
    onPosition(clampPosition((1 - (clientY - r.top) / r.height) * 100));
  };

  return (
    <div className={`relative mx-auto ${heightClass} aspect-[9/16] max-h-full overflow-hidden rounded-[26px] border-[5px] border-zinc-800 bg-black shadow-2xl ring-1 ring-black`} ref={box} data-testid="phone-preview">
      {bg === 'video'
        ? <Player ref={playerRef} component={EpisodeComposition} inputProps={{ project }} durationInFrames={duration} fps={project.fps} compositionWidth={w} compositionHeight={h} style={{ width: '100%', height: '100%' }} acknowledgeRemotionLicense loop autoPlay={autoPlay} playbackRate={speed} clickToPlay />
        : <Player key={bg} ref={playerRef} component={CaptionOnlyComposition} inputProps={{ project, bg }} durationInFrames={duration} fps={project.fps} compositionWidth={w} compositionHeight={h} style={{ width: '100%', height: '100%' }} acknowledgeRemotionLicense loop autoPlay={autoPlay} playbackRate={speed} clickToPlay />}
      {/* drag handle: grab the guide to move the captions up or down */}
      <div className="absolute inset-x-0 z-10 cursor-ns-resize touch-none" style={{ bottom: `${positionY}%`, height: 28, transform: 'translateY(50%)' }} data-testid="caption-drag" role="slider" aria-label="Caption position" aria-valuemin={5} aria-valuemax={90} aria-valuenow={positionY} tabIndex={0}
        onPointerDown={e => { drag.current = true; (e.target as HTMLElement).setPointerCapture(e.pointerId); move(e.clientY); }}
        onPointerMove={e => { if (drag.current) move(e.clientY); }}
        onPointerUp={() => { drag.current = false; }}
        onKeyDown={e => { if (e.key === 'ArrowUp') { e.preventDefault(); onPosition(clampPosition(positionY + 1)); } if (e.key === 'ArrowDown') { e.preventDefault(); onPosition(clampPosition(positionY - 1)); } }}>
        <div className="pointer-events-none absolute inset-x-3 top-1/2 border-t border-dashed border-white/50" />
        <div className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 rounded bg-black/70 px-1 text-[9px] text-white tnum">{positionY}%</div>
      </div>
    </div>
  );
}
