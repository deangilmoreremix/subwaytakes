import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

describe('legal pages when bringing your own key', () => {
  it('say who charges, drop the credits, pack, referral and refund promises, and keep the draft notice', async () => {
    vi.resetModules(); vi.stubEnv('VITE_BILLING_MODE', 'byok');
    const { LEGAL_DOCS, LEGAL_DRAFT_NOTICE } = await import('./documents');
    const text = (slug: string) => JSON.stringify(LEGAL_DOCS.find(d => d.slug === slug));
    expect(text('terms')).toMatch(/your own muapi account/);
    expect(text('terms')).not.toMatch(/"Credits"|Packs and unlocks|Referrals/);
    expect(text('refunds')).toMatch(/muapi/);
    expect(text('refunds')).not.toMatch(/credits reserved/);
    expect(text('privacy')).toMatch(/Your muapi key/);
    expect(LEGAL_DRAFT_NOTICE).toMatch(/DRAFT/);
    expect(LEGAL_DOCS.map(d => d.slug).sort()).toEqual(['ai-policy', 'privacy', 'refunds', 'terms']);
  });
  it('credits mode keeps the original pages', async () => {
    vi.resetModules(); vi.stubEnv('VITE_BILLING_MODE', 'credits');
    const { LEGAL_DOCS } = await import('./documents');
    expect(JSON.stringify(LEGAL_DOCS.find(d => d.slug === 'terms'))).toMatch(/Packs and unlocks/);
  });
});
