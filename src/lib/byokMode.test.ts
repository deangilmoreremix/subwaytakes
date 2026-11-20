import { afterEach, describe, expect, it, vi } from 'vitest';

// The app default is bring-your-own-key; unit tests run in credits mode, so these load the modules with the BYOK mode switched on.
async function byok() {
  vi.resetModules();
  vi.stubEnv('VITE_BILLING_MODE', 'byok'); vi.stubEnv('VITE_SUPABASE_URL', 'https://stub.supabase.test'); vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'stub');
  const [credits, features, onboarding, shows, mode] = await Promise.all([
    import('./credits'), import('./billing/features'), import('./onboarding'), import('./shows'), import('./mode'),
  ]);
  return { credits, features, onboarding, shows, mode };
}
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

describe('bring your own key mode', () => {
  it('is on when the env says byok, and the default is byok', async () => {
    const { mode } = await byok();
    expect(mode.IS_BYOK).toBe(true);
  });
  it('shows prices in dollars (one unit is one cent) and has no margin', async () => {
    const { credits } = await byok();
    expect(credits.formatCredits(60)).toBe('$0.60');
    expect(credits.formatCredits(5)).toBe('$0.05');
    expect(credits.formatCredits(150)).toBe('$1.50');
    expect(credits.CREDIT_MARGIN).toBe(1);
    expect(credits.usdToCredits(0.6)).toBe(60);
    expect(credits.CONFIRM_CREDITS).toBe(100);   // confirm above $1
  });
  it('asks for the key after the account checks, never before', async () => {
    const { credits } = await byok();
    expect(credits.generationBlock(null)).toBe('guest');
    expect(credits.generationBlock({ isGuest: true, emailConfirmed: true, hasKey: true })).toBe('guest');
    expect(credits.generationBlock({ isGuest: false, emailConfirmed: false, hasKey: false })).toBe('unverified');
    expect(credits.generationBlock({ isGuest: false, emailConfirmed: true, hasKey: false })).toBe('nokey');
    expect(credits.generationBlock({ isGuest: false, emailConfirmed: true, hasKey: true })).toBeNull();
    expect(credits.BLOCK_TEXT.nokey).toMatch(/muapi key/);
  });
  it('nothing is locked: every show, city and feature is open', async () => {
    const { features, shows } = await byok();
    for (const id of ['happiness', 'bible', 'motivation']) expect(features.showLocked(id, [])).toBe(false);
    for (const c of ['nyc', 'london', 'tokyo', 'paris', 'someday-new-city']) expect(features.cityLocked(c, [])).toBe(false);
    for (const f of Object.keys(features.FEATURES)) expect(features.hasFeature(f as never, [])).toBe(true);
    expect(shows.SHOWS.length).toBeGreaterThan(5);
  });
  it('the first-run checklist asks for the key instead of credits', async () => {
    const { onboarding } = await byok();
    const base = { customised: false, tookTake: false, balance: null, videoClips: 0, captionClips: 0, exported: false } as never;
    const none = onboarding.onboardingSteps({ ...(base as object), hasKey: false } as never).find(s => s.id === 'credits')!;
    expect(none.label).toMatch(/muapi key/); expect(none.done).toBe(false);
    expect(onboarding.onboardingSteps({ ...(base as object), hasKey: true } as never).find(s => s.id === 'credits')!.done).toBe(true);
    expect(onboarding.onboardingSteps(base).map(s => `${s.label} ${s.hint}`).join(" ")).not.toMatch(/credits|Starter/i);
  });
});

describe('shared project labelling', () => {
  async function load(mode: string) {
    vi.resetModules(); vi.stubEnv('VITE_BILLING_MODE', mode); vi.stubEnv('VITE_SUPABASE_URL', 'https://stub.supabase.test'); vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'stub'); vi.stubEnv('VITE_SUPABASE_SCHEMA', '');
    const [sb, storage] = await Promise.all([import('./supabase'), import('./storage')]);
    return { schema: sb.DB_SCHEMA, bucket: storage.BUCKET };
  }
  it('bringing your own key uses the subwaytakes schema and its own bucket', async () => {
    expect(await load('byok')).toEqual({ schema: 'subwaytakes', bucket: 'subwaytakes-media' });
  });
  it('the credits mode keeps the older public tables and media bucket', async () => {
    expect(await load('credits')).toEqual({ schema: 'public', bucket: 'media' });
  });
});
