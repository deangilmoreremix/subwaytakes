import type { Clip } from './types';
import { clipEnd } from './ops';

export interface VideoChain { clips: Clip[]; start: number; end: number }

/**
 * Group a track's video clips into render chains. Clips joined by a valid transition (overlap === transitionIn.frames)
 * go in one chain, which maps 1:1 onto a Remotion <TransitionSeries>; everything else is a chain of one.
 * chain duration == end - start == sum(durations) - sum(transition frames), exactly what TransitionSeries lasts.
 */
export function buildChains(clips: Clip[]): VideoChain[] {
  const byTrack = new Map<string, Clip[]>();
  for (const c of clips) if (c.kind === 'video' && c.src) byTrack.set(c.trackId, [...(byTrack.get(c.trackId) ?? []), c]);
  const chains: VideoChain[] = [];
  for (const list of byTrack.values()) {
    const sorted = [...list].sort((a, b) => a.start - b.start);
    let cur: Clip[] = [];
    for (const c of sorted) {
      const prev = cur[cur.length - 1];
      const joined = prev && c.transitionIn && clipEnd(prev) - c.start === c.transitionIn.frames;
      if (!joined && cur.length) { chains.push(toChain(cur)); cur = []; }
      cur.push(c);
    }
    if (cur.length) chains.push(toChain(cur));
  }
  return chains;
}

function toChain(cs: Clip[]): VideoChain {
  return { clips: cs, start: cs[0].start, end: clipEnd(cs[cs.length - 1]) };
}
