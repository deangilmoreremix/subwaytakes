import { describe, expect, it, vi } from 'vitest';
vi.mock('../supabase', () => ({ supabase: {} }));
import { DEFAULT_TAKE, buildTwoShotStillPrompt, describeCharacter, effectiveHostDescription, twoShotRoute, type TakeSpec } from './index';
import { DEFAULT_PLACE } from '../places';
import { buildAnimateInput, buildStillInput, runTwoShotImageJob, validateTwoShot, type TwoShotDeps } from './twoshot';

const host = { id: 'h1', name: 'Rae', gender: 'female', ethnicity: 'latina', age_range: 'late-20s', hair_description: 'big curls', clothing_style: 'a yellow bomber jacket', distinguishing_features: 'round sunglasses', portrait_url: 'https://cdn.example/rae.png' };
const spec = (p: Partial<TakeSpec> = {}): TakeSpec => ({ ...DEFAULT_TAKE, ...p });
const SLUG = 'veo3.1-fast-image-to-video';

describe('route selection', () => {
  it('uses text with no Cast host', () => expect(twoShotRoute(spec())).toEqual({ route: 'text' }));
  it('uses the image route for a Cast host with a portrait', () => expect(twoShotRoute(spec(), host).route).toBe('image'));
  it('falls back to text with a hint when the host has no portrait', () => {
    const r = twoShotRoute(spec(), { ...host, portrait_url: null });
    expect(r.route).toBe('text'); expect(r.hint).toMatch(/Add a portrait in Cast/);
  });
  it('rejects non-https portraits', () => expect(twoShotRoute(spec(), { ...host, portrait_url: 'http://x/y.png' }).route).toBe('text'));
  it('only applies to the two-shot format', () => expect(twoShotRoute(spec({ format: 'solo' }), host).route).toBe('text'));
});

describe('host description', () => {
  it('describes a Cast character in one line', () => expect(describeCharacter(host)).toBe('a female latina person, late-20s, big curls, wearing a yellow bomber jacket, round sunglasses'));
  it('prefers the Cast character, else the typed text', () => {
    expect(effectiveHostDescription(spec(), host)).toContain('big curls');
    expect(effectiveHostDescription(spec())).toBe(DEFAULT_TAKE.hostDescription);
  });
});

describe('still prompt', () => {
  const p = buildTwoShotStillPrompt(spec({ place: { ...DEFAULT_PLACE, city: 'london' } }), { guestHasReference: true });
  it('keeps both references and puts both people in the shot', () => {
    expect(p).toMatch(/first reference image/); expect(p).toMatch(/second reference image/); expect(p).toMatch(/shoulder to shoulder/);
  });
  it('uses the city card as the only microphone', () => {
    expect(p).toContain('Oyster'); expect(p).toMatch(/only microphone/); expect(p).not.toContain('MetroCard');
  });
  it('describes the guest in text when there is no guest portrait', () => expect(buildTwoShotStillPrompt(spec())).toContain(DEFAULT_TAKE.guestDescription));
});

describe('inputs', () => {
  it('still takes the host (and guest) portraits as references', () => {
    expect(buildStillInput(spec(), 'https://a/h.png').images_list).toEqual(['https://a/h.png']);
    expect(buildStillInput(spec(), 'https://a/h.png', 'https://a/g.png')).toMatchObject({ images_list: ['https://a/h.png', 'https://a/g.png'], aspect_ratio: '9:16', resolution: '1K' });
  });
  it('animate sends the still and the dialogue prompt with the Cast host description', () => {
    const i = buildAnimateInput(spec(), SLUG, 'https://s/still.png', host);
    expect(i).toMatchObject({ image_url: 'https://s/still.png', aspect_ratio: '9:16', duration: 8 });
    expect(String(i.prompt)).toContain('big curls'); expect(String(i.prompt)).toContain("So what's ur take?");
  });
  it('validates the model and portrait', () => {
    expect(validateTwoShot({ spec: spec(), host, modelSlug: 'veo3.1-fast-text-to-video' })).toMatch(/image-to-video/);
    expect(validateTwoShot({ spec: spec(), host: { ...host, portrait_url: 'http://x' }, modelSlug: SLUG })).toMatch(/https/);
    expect(validateTwoShot({ spec: spec(), host, modelSlug: SLUG })).toBeNull();
  });
});

function deps(fail?: (slug: string) => string | null) {
  const calls: Array<{ slug: string; input: Record<string, unknown> }> = []; const patches: Array<Record<string, unknown>> = [];
  const d: TwoShotDeps = {
    createJob: vi.fn(async (_p, model, input) => ({ id: 'j1', pipeline: 'native', model, request_id: null, stage: 'queued', status: 'processing', input, output_url: null, error: null, created_at: '' })) as never,
    patchJob: vi.fn(async (_id, p) => { patches.push(p as never); }) as never,
    runModel: vi.fn(async (slug: string, input: Record<string, unknown>) => { calls.push({ slug, input }); const f = fail?.(slug); if (f) throw new Error(f); return { requestId: `r-${slug}`, url: `https://cdn.example/${slug}.out`, prediction: {} } as never; }) as never,
    hostStill: vi.fn(async (u: string) => u.replace('cdn.example', 'storage.example')),
  };
  return { d, calls, patches };
}

describe('runTwoShotImageJob', () => {
  it('makes the still, stores it, then animates it', async () => {
    const { d, calls } = deps(); const stages: string[] = [];
    const job = await runTwoShotImageJob({ spec: spec(), host, modelSlug: SLUG, onStage: s => stages.push(s) }, d);
    expect(calls.map(c => c.slug)).toEqual(['gpt-image-2-image-to-image', SLUG]);
    expect(calls[1].input.image_url).toBe('https://storage.example/gpt-image-2-image-to-image.out');
    expect(stages).toEqual(['still', 'animate']);
    expect(job.status).toBe('completed'); expect(job.output_url).toContain(SLUG);
  });
  it('reuses a saved still without paying for the image again', async () => {
    const { d, calls } = deps();
    await runTwoShotImageJob({ spec: spec(), host, modelSlug: SLUG, stillUrl: 'https://storage.example/old.png' }, d);
    expect(calls.map(c => c.slug)).toEqual([SLUG]); expect(calls[0].input.image_url).toBe('https://storage.example/old.png');
  });
  it.each([['gpt-image-2-image-to-image', 'still'], [SLUG, 'animate']])('a failing %s marks the job failed at %s with the real message', async (slug, stage) => {
    const { d, patches } = deps(s => (s === slug ? 'Insufficient credits' : null));
    await expect(runTwoShotImageJob({ spec: spec(), host, modelSlug: SLUG }, d)).rejects.toThrow('Insufficient credits');
    expect(patches[patches.length - 1]).toMatchObject({ status: 'failed', stage: `failed:${stage}`, error: 'Insufficient credits' });
  });
  it('does nothing and spends nothing when the inputs are invalid', async () => {
    const { d } = deps();
    await expect(runTwoShotImageJob({ spec: spec(), host, modelSlug: 'veo3.1-fast-text-to-video' }, d)).rejects.toThrow(/image-to-video/);
    expect(d.createJob).not.toHaveBeenCalled(); expect(d.runModel).not.toHaveBeenCalled();
  });
});
