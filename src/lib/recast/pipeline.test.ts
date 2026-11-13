import { describe, it, expect, vi } from 'vitest';
vi.mock('../supabase', () => ({ supabase: {} }));
import { buildFallbackPrompt, buildRenderInput, runRecastJob, type RecastDeps, type RecastState, type StageEvent } from './pipeline';

const SRC = 'https://cdn.example/source.mp4';
const REFS = ['https://cdn.example/ref1.png'];
const baseJob = { id: 'job1', pipeline: 'recast', model: 'wan3.0-reference-to-video', request_id: null, stage: 'queued', status: 'processing', input: { take: 'Recast' }, output_url: null, error: null, created_at: '' };

type Call = { slug: string; input: Record<string, unknown> };
function makeDeps(over: Partial<RecastDeps> & { fail?: (slug: string, n: number) => string | null } = {}) {
  const failFn = over.fail;
  const calls: Call[] = []; const patches: Array<Record<string, unknown>> = []; const counts: Record<string, number> = {};
  const deps: RecastDeps = {
    createJob: vi.fn(async () => ({ ...baseJob })) as unknown as RecastDeps['createJob'],
    patchJob: vi.fn(async (_id: string, p: Record<string, unknown>) => { patches.push(p); }) as unknown as RecastDeps['patchJob'],
    runModel: vi.fn(async (slug: string, input: Record<string, unknown>, opts?: { onSubmitted?: (id: string) => void; resumeId?: string }) => {
      calls.push({ slug, input });
      counts[slug] = (counts[slug] ?? 0) + 1;
      const f = failFn?.(slug, counts[slug]); if (f) throw new Error(f);
      const id = opts?.resumeId ?? `req-${slug}-${counts[slug]}`;
      if (!opts?.resumeId) opts?.onSubmitted?.(id);
      const text = slug === 'gemini-video-vision' ? '```json\n{"summary":"subway talk","timestamps":[0.8,1.5,2.5,3.2]}\n```' : slug.startsWith('gemini-') && slug !== 'gemini-video-vision' ? 'WRITER PROMPT using Image1' : '';
      const prediction = text ? { status: 'completed', outputs: [text] } : { status: 'completed', outputs: [`https://cdn.example/${slug}-${counts[slug]}.out`] };
      return { requestId: id, url: text ? '' : `https://cdn.example/${slug}-${counts[slug]}.out`, prediction } as never;
    }) as unknown as RecastDeps['runModel'],
    uploadMedia: vi.fn(async (_b: Blob, name: string) => `https://storage.example/${name}`),
    extractFrames: vi.fn(async (_u: string, secs: number[]) => secs.map(() => new Blob(['jpg']))),
    buildContactSheet: vi.fn(async () => new Blob(['sheet'])),
    ...Object.fromEntries(Object.entries(over).filter(([k]) => k !== 'fail')),
  };
  return { deps, calls, patches };
}
const run = (deps: RecastDeps, o: Partial<Parameters<typeof runRecastJob>[0]> = {}) =>
  runRecastJob({ sourceUrl: SRC, sourceSeconds: 5, refs: REFS, mode: 'motion_transfer', model: 'wan', ...o }, deps);

describe('runRecastJob happy path', () => {
  it('runs all seven stages in order and sends the right bodies', async () => {
    const { deps, calls } = makeDeps();
    const events: StageEvent[] = [];
    const r = await run(deps, { onStage: e => events.push(e) });
    const order = events.filter(e => e.status === 'done').map(e => e.stage);
    expect(order[0]).toBe('depth'); expect(order[1]).toBe('plan'); expect(order[2]).toBe('frames');
    expect(order.slice(-2)).toEqual(['prompt', 'render']);
    expect(new Set(order)).toEqual(new Set(['depth', 'plan', 'frames', 'plates', 'sheets', 'prompt', 'render']));

    const by = (s: string) => calls.filter(c => c.slug === s);
    expect(by('depth-anything')[0].input).toEqual({ video_url: SRC });
    expect(by('gemini-video-vision')[0].input).toMatchObject({ model: 'gemini-2.5-flash', video_url: SRC });
    expect(by('nano-banana-2-edit')).toHaveLength(4);                       // 4 timestamps -> 4 plates (Wan budget: 10 - 1 sheet)
    expect(by('nano-banana-2-edit')[0].input).toMatchObject({ aspect_ratio: 'Auto', resolution: '1k', output_format: 'jpg' });
    expect(by('gpt-image-2-image-to-image')).toHaveLength(1);               // one character sheet
    expect(by('gemini-3-6-flash')[0].input.image_url).toBe('https://storage.example/contact-sheet.jpg');

    const render = by('wan3.0-reference-to-video')[0].input;
    expect(render).toMatchObject({ aspect_ratio: 'adaptive', duration: 5, resolution: '720p', thinking_mode: false, enable_audio: false });
    expect((render.images_list as string[])).toHaveLength(5);              // 1 sheet + 4 plates, sheets first
    expect((render.images_list as string[])[0]).toContain('gpt-image-2-image-to-image');
    expect(render.videos_list).toEqual(['https://cdn.example/depth-anything-1.out']);
    expect(String(render.prompt)).toContain('WRITER PROMPT');
    expect(r.url).toMatch(/wan3\.0/); expect(r.seconds).toBe(5); expect(r.job.status).toBe('completed');
  });

  it('Seedance sends no Wan-only fields and gets an @-label reference key', async () => {
    const { deps, calls } = makeDeps();
    await run(deps, { model: 'seedance' });
    const render = calls.find(c => c.slug === 'seedance-2.5-omni-reference')!.input;
    expect('thinking_mode' in render).toBe(false); expect('enable_audio' in render).toBe(false);
    expect(String(render.prompt)).toMatch(/^REFERENCE KEY: @video1/);
  });
});

describe('before any spend', () => {
  it.each([
    [{ refs: [] }, /at least one/], [{ refs: Array(9).fill('https://x/y.png') }, /at most 8/], [{ sourceSeconds: 15.5 }, /30s/], [{ sourceUrl: 'http://insecure/a.mp4' }, /https/],
  ])('rejects %j without creating a job or calling muapi', async (o, re) => {
    const { deps } = makeDeps();
    await expect(run(deps, o as never)).rejects.toThrow(re);
    expect(deps.createJob).not.toHaveBeenCalled(); expect(deps.runModel).not.toHaveBeenCalled();
  });
});

describe('fallbacks and warnings', () => {
  it('a failed plate retries with the second model; if both fail the plate is skipped with a warning', async () => {
    const { deps, calls } = makeDeps({ fail: (slug, n) => (slug === 'nano-banana-2-edit' && n <= 2 ? 'nano down' : slug === 'gpt-image-2-image-to-image' && n === 2 ? 'gpt busy' : null) });
    const warnings: string[] = [];
    const r = await run(deps, { onWarning: w => warnings.push(w) });
    expect(calls.filter(c => c.slug === 'nano-banana-2-edit')).toHaveLength(4);
    expect(r.state.stages.plates!.urls.length).toBeGreaterThanOrEqual(2);       // some plates survived
    expect(warnings.some(w => /Background \d could not be cleaned/.test(w))).toBe(true);
  });
  it('a failed character sheet falls back to the raw photo and WARNS (never silent)', async () => {
    const { deps } = makeDeps({ fail: slug => (slug === 'gpt-image-2-image-to-image' ? 'sheet failed' : null) });
    const r = await run(deps);
    expect(r.state.stages.sheets!.urls).toEqual(REFS);
    expect(r.warnings.some(w => /Character sheet 1 failed.*original photo/.test(w))).toBe(true);
  });
  it('a failed or unclear scene analysis falls back to evenly spaced frames and the run continues', async () => {
    const { deps } = makeDeps({ fail: slug => (slug === 'gemini-video-vision' ? 'vision 500' : null) });
    const r = await run(deps);
    expect(r.state.stages.plan!.timestamps).toEqual([0.75, 2.5, 4.25]);        // 15% / 50% / 85% of 5s
    expect(r.warnings.some(w => /Scene analysis failed/.test(w))).toBe(true);
    expect(r.job.status).toBe('completed');
  });
  it('a failed prompt writer uses the deterministic prompt', async () => {
    const { deps, calls } = makeDeps({ fail: slug => (slug.startsWith('gemini-') && slug !== 'gemini-video-vision' ? 'writer 503' : null) });
    const r = await run(deps);
    expect(r.warnings.some(w => /prompt writer failed.*gemini-3-6-flash.*gemini-2-5-flash/.test(w))).toBe(true);   // every model was tried
    expect(String(calls.find(c => c.slug === 'wan3.0-reference-to-video')!.input.prompt)).toContain('PRIORITY ORDER');
  });
});

describe('writer model chain', () => {
  it('moves to the next model when one is deprecated and does not warn if a later one answers', async () => {
    const { deps, calls } = makeDeps({ fail: slug => (slug === 'gemini-3-6-flash' ? 'Gemini 3.6 Flash has been deprecated' : null) });
    const r = await run(deps);
    const writers = calls.filter(c => c.slug.startsWith('gemini-') && c.slug !== 'gemini-video-vision').map(c => c.slug);
    expect(writers).toEqual(['gemini-3-6-flash', 'gemini-3-8-flash']);
    expect(r.warnings.some(w => /prompt writer/.test(w))).toBe(false);
    expect(String(calls.find(c => c.slug === 'wan3.0-reference-to-video')!.input.prompt)).toContain('WRITER PROMPT');
  });
});

describe('failures that stop the run', () => {
  it.each([['depth-anything', 'depth'], ['wan3.0-reference-to-video', 'render']])('a failing %s marks the job failed at the %s stage with the real message', async (slug, stage) => {
    const { deps, patches } = makeDeps({ fail: s => (s === slug ? 'Insufficient credits' : null) });
    const events: StageEvent[] = [];
    await expect(run(deps, { onStage: e => events.push(e) })).rejects.toThrow('Insufficient credits');
    const last = patches[patches.length - 1];
    expect(last).toMatchObject({ status: 'failed', stage: `failed:${stage}`, error: 'Insufficient credits' });
    expect(events[events.length - 1]).toMatchObject({ stage, status: 'failed' });
  });
  it('a user cancel keeps the job resumable (processing, paused) instead of failed', async () => {
    const ac = new AbortController();
    const { deps, patches } = makeDeps();
    const p = run(deps, { signal: ac.signal, onStage: e => { if (e.stage === 'depth' && e.status === 'done') ac.abort(); } });
    await expect(p).rejects.toThrow('Cancelled');
    const last = patches[patches.length - 1];
    expect(last.status).toBeUndefined(); expect(String(last.stage)).toMatch(/^paused:/);
  });
});

describe('resume', () => {
  it('skips finished stages and re-polls a render that was already submitted', async () => {
    const first = makeDeps();
    const full = await run(first.deps);
    // simulate a reload right after the render was submitted but before it finished
    const state: RecastState = JSON.parse(JSON.stringify(full.state));
    state.stages.render = { requestId: 'render-req-9' };
    const second = makeDeps();
    const events: StageEvent[] = [];
    const r = await run(second.deps, { resume: { job: { ...baseJob } as never, state }, onStage: e => events.push(e) });
    expect(second.deps.createJob).not.toHaveBeenCalled();
    expect(events.filter(e => e.status === 'skipped').map(e => e.stage)).toEqual(expect.arrayContaining(['depth', 'plan', 'frames', 'plates', 'sheets', 'prompt']));
    expect(second.calls).toHaveLength(1);                                       // only the render poll, nothing re-submitted
    const opts = (second.deps.runModel as ReturnType<typeof vi.fn>).mock.calls[0][2];
    expect(opts.resumeId).toBe('render-req-9');
    expect(r.job.status).toBe('completed');
  });
  it('a fully finished state returns immediately without any muapi call', async () => {
    const full = await run(makeDeps().deps);
    const again = makeDeps();
    await run(again.deps, { resume: { job: { ...baseJob } as never, state: JSON.parse(JSON.stringify(full.state)) } });
    expect(again.calls).toHaveLength(0);
  });
});

describe('pure builders', () => {
  it('buildRenderInput is model specific and clips the prompt', () => {
    expect(buildRenderInput('wan', 'x'.repeat(5000), ['a'], 'd', 6).prompt).toHaveLength(4000);
    expect(buildRenderInput('wan', 'p', ['a'], 'd', 6)).toMatchObject({ thinking_mode: false, enable_audio: false });
    expect('thinking_mode' in buildRenderInput('seedance', 'p', ['a'], 'd', 6)).toBe(false);
  });
  it('fallback prompt maps references and has every section', () => {
    const p = buildFallbackPrompt({ model: 'wan', sheets: 2, plates: 1, seconds: 5 });
    for (const s of ['REFERENCE KEY', 'SCENE AND CAST', 'MOTION REFERENCE', 'CAMERA', 'CONSISTENCY AND PHYSICS', 'PRIORITY ORDER']) expect(p).toContain(s);
    expect(p).toContain('Image1, Image2'); expect(p).toContain('Image3'); expect(p).toContain('Video1');
  });
});
