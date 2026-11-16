import { describe, expect, it, vi } from 'vitest';
vi.mock('../supabase', () => ({ supabase: {} }));
import { dubProblem, estimateDub, newDubState, runDub, type DubDeps, type DubOptions } from './pipeline';
import { buildTranslatePrompt, cleanTranslation, speechBudget, trimToBudget } from './prompts';
import { DUB_LANGUAGES, MAX_DUB_LANGUAGES } from './languages';
import { requiredEntitlements } from '../../../supabase/functions/_shared/entitlements';
import { TTS_SLUG } from '../muapi/voices';

const SRC = 'https://media.test/clip.mp4';
const base: DubOptions = { sourceUrl: SRC, seconds: 8, voice: { provider: 'elevenlabs', voiceId: 'v1' }, lipsync: 'sync-lipsync', languages: ['es', 'fr'] };

/** A fake muapi: whisper returns a line, text models translate, TTS and lipsync return urls. `fail` makes chosen calls throw. */
function world(fail: (slug: string, input: Record<string, unknown>) => string | null = () => null) {
  const calls: Array<{ slug: string; input: Record<string, unknown> }> = [];
  const patches: Array<Record<string, unknown>> = [];
  let n = 0;
  const deps: DubDeps = {
    runModel: (async (slug: string, input: Record<string, unknown>, opts?: { onSubmitted?: (id: string) => void }) => {
      calls.push({ slug, input });
      const err = fail(slug, input); if (err) throw new Error(err);
      const id = `req-${++n}`; opts?.onSubmitted?.(id);
      if (slug === 'openai-whisper') return { requestId: id, url: '', prediction: { output: 'Pineapple belongs on pizza and anyone who disagrees is scared of joy.' } };
      if (slug.startsWith('gemini')) { const lang = /into ([A-Za-z ]+) for/.exec(String(input.prompt))?.[1] ?? 'x'; return { requestId: id, url: '', prediction: { output: `"[${lang}] la piña va en la pizza"` } }; }
      if (slug.includes('tts')) return { requestId: id, url: `https://media.test/voice-${n}.mp3`, prediction: {} };
      return { requestId: id, url: `https://media.test/dub-${n}.mp4`, prediction: {} };
    }) as unknown as DubDeps['runModel'],
    createJob: (async (pipeline: string, model: string, input: Record<string, unknown>) => ({ id: 'job1', pipeline, model, input, request_id: null, stage: 'generating', status: 'processing', output_url: null, error: null, created_at: '' })) as unknown as DubDeps['createJob'],
    patchJob: (async (_id: string, patch: Record<string, unknown>) => { patches.push(patch); }) as unknown as DubDeps['patchJob'],
  };
  return { deps, calls, patches };
}
const slugs = (c: Array<{ slug: string }>) => c.map(x => x.slug);

describe('dubProblem', () => {
  it('accepts a normal request', () => { expect(dubProblem(base)).toBeNull(); });
  it('refuses what cannot work, before anything is paid', () => {
    expect(dubProblem({ ...base, sourceUrl: 'http://x/y.mp4' })).toMatch(/hosted/);
    expect(dubProblem({ ...base, sourceUrl: 'blob:abc' })).toMatch(/hosted/);
    expect(dubProblem({ ...base, seconds: 1 })).toMatch(/too short/);
    expect(dubProblem({ ...base, seconds: 31 })).toMatch(/too long/);
    expect(dubProblem({ ...base, languages: [] })).toMatch(/at least one/);
    expect(dubProblem({ ...base, languages: DUB_LANGUAGES.slice(0, MAX_DUB_LANGUAGES + 1).map(l => l.id) })).toMatch(/up to/);
    expect(dubProblem({ ...base, languages: ['es', 'es'] })).toMatch(/once/);
    expect(dubProblem({ ...base, languages: ['xx'] })).toMatch(/Unknown/);
  });
});

describe('runDub', () => {
  it('transcribes once, then translates, voices and lip-syncs each language in order', async () => {
    const { deps, calls } = world();
    const r = await runDub(base, deps);
    expect(slugs(calls)).toEqual(['openai-whisper', 'gemini-3-6-flash', TTS_SLUG.elevenlabs, 'sync-lipsync', 'gemini-3-6-flash', TTS_SLUG.elevenlabs, 'sync-lipsync']);
    expect(r.results.map(x => x.language)).toEqual(['es', 'fr']); expect(r.results.every(x => x.url && !x.error)).toBe(true);
    expect(r.job.status).toBe('completed'); expect(r.job.pipeline).toBe('dub');
  });
  it('sends the clip to whisper and the clip plus the new speech to lip-sync', async () => {
    const { deps, calls } = world();
    await runDub({ ...base, languages: ['es'] }, deps);
    expect(calls[0].input).toMatchObject({ audio_url: SRC });
    const lip = calls.find(c => c.slug === 'sync-lipsync')!; expect(lip.input).toMatchObject({ video_url: SRC }); expect(String(lip.input.audio_url)).toMatch(/voice-/);
  });
  it('treats the transcript as content: the prompt fences it and says it is not instructions', async () => {
    const { deps, calls } = world();
    await runDub({ ...base, languages: ['es'] }, deps);
    const p = String(calls.find(c => c.slug.startsWith('gemini'))!.input.prompt);
    expect(p).toContain('<<<LINE'); expect(p).toMatch(/not instructions/i); expect(p).toContain('Pineapple belongs on pizza');
  });
  it('cleans the model answer before it is spoken (quotes removed)', async () => {
    const { deps, calls } = world();
    await runDub({ ...base, languages: ['es'] }, deps);
    const tts = calls.find(c => c.slug === TTS_SLUG.elevenlabs)!; expect(String(tts.input.prompt)).not.toMatch(/^"/);
  });
  it('a failing language does not stop the others and keeps what was paid for', async () => {
    const { deps } = world((slug, input) => (slug.includes('tts') && String(input.prompt).includes('French') ? 'voice down' : null));
    const r = await runDub(base, deps);
    expect(r.results[0].url).toBeTruthy(); expect(r.results[1].url).toBeUndefined(); expect(r.results[1].error).toMatch(/voice down/);
    expect(r.job.status).toBe('completed'); expect(r.state.warnings.join(' ')).toMatch(/French could not be finished/);
    expect(r.state.perLang.fr.text).toBeTruthy();   // the paid translation is kept for a retry
  });
  it('if every language fails the job is failed with the reasons, and nothing is invented', async () => {
    const { deps } = world(slug => (slug === 'sync-lipsync' ? 'lipsync down' : null));
    const r = await runDub(base, deps);
    expect(r.results.every(x => !x.url)).toBe(true); expect(r.job.status).toBe('failed'); expect(r.job.error).toMatch(/lipsync down/);
  });
  it('stops before spending more when there is no speech to dub', async () => {
    const { deps, calls, patches } = world();
    const quiet: DubDeps = { ...deps, runModel: (async (slug: string, input: Record<string, unknown>) => { calls.push({ slug, input }); return { requestId: 'r', url: '', prediction: { output: '   ' } }; }) as unknown as DubDeps['runModel'] };
    await expect(runDub(base, quiet)).rejects.toThrow(/No speech/);
    expect(slugs(calls)).toEqual(['openai-whisper']); expect(patches[patches.length - 1]).toMatchObject({ status: 'failed' });
  });
  it('falls back to the next text model when one is retired', async () => {
    const { deps, calls } = world((slug) => (slug === 'gemini-3-6-flash' ? 'model deprecated' : null));
    const r = await runDub({ ...base, languages: ['es'] }, deps);
    expect(r.results[0].url).toBeTruthy(); expect(slugs(calls).filter(s => s.startsWith('gemini'))).toEqual(['gemini-3-6-flash', 'gemini-3-8-flash']);
  });
  it('resumes: finished work is not paid for again', async () => {
    const first = world((slug, input) => (slug.includes('tts') && String(input.prompt).includes('French') ? 'voice down' : null));
    const r1 = await runDub(base, first.deps);
    const second = world();
    const r2 = await runDub({ ...base, resume: { job: r1.job, state: r1.state } }, second.deps);
    expect(slugs(second.calls)).toEqual([TTS_SLUG.elevenlabs, 'sync-lipsync']);   // no whisper, no Spanish, no repeat translation
    expect(r2.results.every(x => x.url)).toBe(true);
  });
  it('can be cancelled, leaving the job resumable rather than failed', async () => {
    const ctl = new AbortController();
    const { deps, patches } = world();
    const aborting: DubDeps = { ...deps, runModel: (async (slug: string, input: Record<string, unknown>, opts?: { onSubmitted?: (id: string) => void }) => { if (slug.includes('tts')) ctl.abort(); return (deps.runModel as unknown as (...a: unknown[]) => unknown)(slug, input, opts); }) as unknown as DubDeps['runModel'] };
    await expect(runDub({ ...base, signal: ctl.signal }, aborting)).rejects.toThrow('Cancelled');
    expect(patches[patches.length - 1]).toMatchObject({ stage: 'paused' }); expect(patches[patches.length - 1]).not.toHaveProperty('status');
  });
  it('shortens a line that cannot fit the clip and says so', async () => {
    const { deps, calls } = world();
    const long: DubDeps = { ...deps, runModel: (async (slug: string, input: Record<string, unknown>, opts?: unknown) => (slug.startsWith('gemini')
      ? { requestId: 'r', url: '', prediction: { output: Array.from({ length: 80 }, (_, i) => `palabra${i}`).join(' ') } }
      : (deps.runModel as unknown as (...a: unknown[]) => unknown)(slug, input, opts))) as unknown as DubDeps['runModel'] };
    const r = await runDub({ ...base, seconds: 4, languages: ['es'] }, long);
    expect(r.state.warnings.join(' ')).toMatch(/shortened/); void calls;
  });
  it('persists the clip hosting and state so a reload can resume', async () => {
    const { deps, patches } = world();
    await runDub({ ...base, languages: ['es'] }, deps);
    expect(patches.some(p => (p.input as { dub?: unknown })?.dub)).toBe(true);
  });
});

describe('translation prompts', () => {
  it('budgets words for spaced languages and characters for the others', () => {
    expect(speechBudget('es', 8)).toEqual({ unit: 'words', max: 20 }); expect(speechBudget('ja', 8)).toEqual({ unit: 'chars', max: 40 }); expect(speechBudget('zh', 8).unit).toBe('chars');
  });
  it('asks for only the translation, in the right language and length', () => {
    const p = buildTranslatePrompt('Hello there', 'de', 6);
    expect(p).toMatch(/German/); expect(p).toMatch(/at most 15 words/); expect(p).toMatch(/ONLY the translated line/);
  });
  it('cleans quotes, labels, fences and line breaks', () => {
    expect(cleanTranslation('"Hola mundo"')).toBe('Hola mundo'); expect(cleanTranslation('Translation: «Bonjour»')).toBe('Bonjour');
    expect(cleanTranslation('```\nHallo\nWelt\n```')).toBe('Hallo Welt'); expect(cleanTranslation('   ')).toBe('');
  });
  it('trims by words or characters', () => {
    expect(trimToBudget('a b c d e f g h', 'es', 1)).toEqual({ text: 'a b c', trimmed: true });
    expect(trimToBudget('短い', 'ja', 8)).toEqual({ text: '短い', trimmed: false }); expect(trimToBudget('あ'.repeat(50), 'ja', 4).trimmed).toBe(true);
  });
});

describe('cost and gating', () => {
  it('estimates in credits, scaling with languages', () => {
    const one = estimateDub(1, 'sync-lipsync'), three = estimateDub(3, 'sync-lipsync');
    expect(one.total).toBeGreaterThan(0); expect(three.total).toBeGreaterThan(one.total); expect(three.total).toBeLessThan(one.total * 3 + 1);
    expect(one.lines.every(l => Number.isInteger(l.credits))).toBe(true);
  });
  it('every paid model dubbing uses is gated on the server by an unlock', () => {
    for (const slug of [TTS_SLUG.elevenlabs, TTS_SLUG.minimax, 'sync-lipsync', 'veed-lipsync']) expect(requiredEntitlements(slug), slug).not.toBeNull();
  });
  it('new state starts empty', () => { const s = newDubState(base); expect(s.perLang).toEqual({}); expect(s.warnings).toEqual([]); });
});
