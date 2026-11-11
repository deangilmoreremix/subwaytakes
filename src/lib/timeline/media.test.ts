import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { BufferSource } from 'mediabunny';
import { readMediaInfo } from './media';

const tiny = () => new Uint8Array(readFileSync(new URL('./__fixtures__/tiny.mp4', import.meta.url)));

describe('readMediaInfo (Mediabunny)', () => {
  it('reads the real duration, dimensions and audio presence of an MP4', async () => {
    const info = await readMediaInfo(new BufferSource(tiny()));
    expect(info.durationSec).toBeGreaterThan(1.4);
    expect(info.durationSec).toBeLessThan(1.7);
    expect(info.hasAudio).toBe(true);
    expect([info.width, info.height]).toEqual([64, 112]);
  });
  it('rejects garbage input instead of returning a fake duration', async () => {
    await expect(readMediaInfo(new BufferSource(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])))).rejects.toBeDefined();
  });
});
