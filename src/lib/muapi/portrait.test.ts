import { describe, it, expect, vi } from 'vitest';
vi.mock('../supabase', () => ({ supabase: {} }));
import { portraitProblem } from './portrait';

describe('portraitProblem', () => {
  it('accepts the real generated portrait (768x1360, ratio 0.56)', () => { expect(portraitProblem(768, 1360, 1_466_262, 'image/png')).toBeNull(); });
  it('accepts a square selfie and a landscape photo within 0.4-2.5', () => {
    expect(portraitProblem(1000, 1000, 500_000, 'image/jpeg')).toBeNull();
    expect(portraitProblem(2400, 1000, 500_000, 'image/jpeg')).toBeNull();
  });
  it('rejects ratios outside OmniHuman limits with a helpful message', () => {
    expect(portraitProblem(300, 1000, 1, 'image/png')).toMatch(/tall and narrow/);
    expect(portraitProblem(3000, 1000, 1, 'image/png')).toMatch(/wide/);
  });
  it('rejects non-images, huge files and unreadable sizes', () => {
    expect(portraitProblem(100, 100, 1, 'application/pdf')).toMatch(/image file/);
    expect(portraitProblem(100, 100, 11 * 1024 * 1024, 'image/png')).toMatch(/under 10 MB/);
    expect(portraitProblem(0, 0, 1, 'image/png')).toMatch(/read the image/);
  });
});
