import type { TransitionPresentation } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { wipe } from '@remotion/transitions/wipe';
import { iris } from '@remotion/transitions/iris';
import { clockWipe } from '@remotion/transitions/clock-wipe';
import { pushCut } from '@remotion/transitions/push-cut';
import type { TransitionType } from './types';

type AnyPresentation = TransitionPresentation<Record<string, unknown>>;
const as = (p: unknown) => p as AnyPresentation;

export interface TransitionDef { id: TransitionType; label: string; make: (width: number, height: number) => AnyPresentation }

/**
 * Presentations from @remotion/transitions. Only ones verified to export correctly through the web renderer are listed.
 * Excluded after testing: flip/cube (3D CSS: black mid-frames, ~30x slower) and the shader-based ones (need HTML-in-canvas).
 */
export const TRANSITIONS: TransitionDef[] = [
  { id: 'fade', label: 'Fade', make: () => as(fade()) },
  { id: 'slide', label: 'Slide', make: () => as(slide({ direction: 'from-right' })) },
  { id: 'wipe', label: 'Wipe', make: () => as(wipe({ direction: 'from-left' })) },
  { id: 'iris', label: 'Iris', make: (w, h) => as(iris({ width: w, height: h })) },
  { id: 'clock-wipe', label: 'Clock', make: (w, h) => as(clockWipe({ width: w, height: h })) },
  { id: 'push-cut', label: 'Push', make: () => as(pushCut({})) },
];

export const transitionDef = (id: TransitionType) => TRANSITIONS.find(t => t.id === id);
