import { describe, expect, it, vi } from 'vitest';
vi.mock('../supabase', () => ({ supabase: {} }));
vi.mock('../auth', () => ({ useAuth: () => ({ user: null, isGuest: true }) }));
import { allDone, nextStep, onboardingSteps, type StepInput } from './index';

const fresh: StepInput = { customised: false, tookTake: false, balance: 0, videoClips: 0, captionClips: 0, exported: false };

describe('onboarding steps', () => {
  it('start unticked for a new customer with no credits', () => {
    const s = onboardingSteps(fresh);
    expect(s.every(x => !x.done)).toBe(true); expect(nextStep(s)?.id).toBe('choose'); expect(allDone(s)).toBe(false);
  });
  it('tick only from real state', () => {
    const s = onboardingSteps({ ...fresh, customised: true, tookTake: true, balance: 2000 });
    expect(s.filter(x => x.done).map(x => x.id)).toEqual(['choose', 'take', 'credits']); expect(nextStep(s)?.id).toBe('generate');
  });
  it('a customer who spent every credit still has "credits" and "generate" done once a clip exists', () => {
    const s = onboardingSteps({ ...fresh, balance: 0, videoClips: 1 });
    expect(s.find(x => x.id === 'credits')?.done).toBe(true); expect(s.find(x => x.id === 'generate')?.done).toBe(true);
  });
  it('captions and export are their own steps and everything done finishes the list', () => {
    const all = onboardingSteps({ customised: true, tookTake: true, balance: 10, videoClips: 2, captionClips: 3, exported: true });
    expect(allDone(all)).toBe(true); expect(nextStep(all)).toBeUndefined();
    expect(onboardingSteps({ ...fresh, captionClips: 1 }).find(x => x.id === 'captions')?.done).toBe(true);
    expect(onboardingSteps({ ...fresh, exported: true }).find(x => x.id === 'export')?.done).toBe(true);
  });
  it('is honest that generation needs credits, with no free-credit promise', () => {
    const credits = onboardingSteps(fresh).find(x => x.id === 'credits')!;
    expect(credits.hint).toMatch(/credits/i); expect(credits.hint).not.toMatch(/free credits|free trial/i);
  });
});
