import { describe, it, expect } from 'vitest';
import { captionsToClips, extractTranscript, transcriptToCaptions } from './captions';
import type { Clip } from '../timeline/types';

const SRT = `1
00:00:00,500 --> 00:00:01,500
Pineapple belongs on pizza

2
00:00:02,000 --> 00:00:03,000
and anyone who disagrees

3
00:00:03,500 --> 00:00:04,500
is scared of joy
`;
const video = (o: Partial<Clip> = {}): Clip => ({ id: 'v', trackId: 'v1', kind: 'video', label: 'v', start: 0, duration: 150, trimStart: 0, sourceFrames: 150, src: 'x', ...o });
let n = 0; const id = () => `c${n++}`;

describe('transcript parsing', () => {
  it('extracts text from several response shapes', () => {
    expect(extractTranscript({ text: 'a' })).toBe('a');
    expect(extractTranscript({ outputs: ['b'] })).toBe('b');
    expect(extractTranscript({ output: 'c' })).toBe('c');
    expect(extractTranscript({ outputs: [{ text: 'd' }] })).toBe('d');
    expect(extractTranscript(null)).toBe('');
    expect(extractTranscript({ status: 'completed' })).toBe('');
  });
  it('parses SRT with real timings', () => {
    const caps = transcriptToCaptions(SRT, 5000);
    expect(caps.map(c => [c.startMs, c.endMs])).toEqual([[500, 1500], [2000, 3000], [3500, 4500]]);
    expect(caps[0].text).toBe('Pineapple belongs on pizza');
  });
  it('spreads plain text evenly when there are no timestamps', () => {
    const caps = transcriptToCaptions('one two three four five six seven eight', 4000, 4);
    expect(caps).toHaveLength(2);
    expect([caps[0].startMs, caps[0].endMs, caps[1].startMs, caps[1].endMs]).toEqual([0, 2000, 2000, 4000]);
  });
  it('returns nothing for empty input', () => { expect(transcriptToCaptions('  ', 1000)).toEqual([]); });
});

describe('captionsToClips', () => {
  const caps = transcriptToCaptions(SRT, 5000);
  it('maps source time to timeline frames at the clip position', () => {
    const out = captionsToClips(caps, video({ start: 90 }), 'c1', 30, id);
    expect(out.map(c => [c.start, c.duration])).toEqual([[90 + 15, 30], [90 + 60, 30], [90 + 105, 30]]);
    expect(out.every(c => c.sourceClipId === 'v' && c.kind === 'caption' && c.trackId === 'c1')).toBe(true);
  });
  it('respects trimStart: captions before the trim are dropped, partially visible ones are clipped', () => {
    // trim 1.0s off the front (30 frames); window is source frames 30..120
    const out = captionsToClips(caps, video({ start: 0, trimStart: 30, duration: 90 }), 'c1', 30, id);
    // caption1 is 15..45 -> clipped to 30..45 (15 frames) at timeline 0; caption2 60..90 -> timeline 30; caption3 105..135 -> clipped to 105..120 at timeline 75
    expect(out.map(c => [c.start, c.duration])).toEqual([[0, 15], [30, 30], [75, 15]]);
  });
  it('drops captions fully outside the window and slivers', () => {
    const out = captionsToClips(caps, video({ trimStart: 0, duration: 20 }), 'c1', 30, id);
    expect(out).toHaveLength(1); // only caption1 (15..20 => 5 frames)
    expect(out[0].duration).toBe(5);
    expect(captionsToClips(caps, video({ trimStart: 0, duration: 16 }), 'c1', 30, id)).toHaveLength(0); // 1-frame sliver dropped
  });
});
