import { describe, it, expect, vi } from 'vitest';
vi.mock('../supabase', () => ({ supabase: {} }));
import { buildRenderInput, runLipsyncJob, sumCost, validateLipsync, type LipsyncDeps, type LipsyncStage } from './lipsync';

const speaker = { portrait_url: 'https://cdn.example/p.png', voice_provider: 'elevenlabs' as const, voice_id: 'v1', voice_speed: 1 };
const baseJob = { id: 'job1', pipeline: 'lipsync', model: 'omnihuman-2-0', request_id: null, stage: 'queued', status: 'processing', input: {}, output_url: null, error: null, created_at: '' };

function deps(over: Partial<LipsyncDeps> = {}) {
  const calls: string[] = [];
  const patches: Array<Record<string, unknown>> = [];
  const d: LipsyncDeps = {
    createJob: vi.fn(async () => baseJob) as unknown as LipsyncDeps['createJob'],
    patchJob: vi.fn(async (_id: string, p: Record<string, unknown>) => { patches.push(p); }) as unknown as LipsyncDeps['patchJob'],
    runModel: vi.fn(async (slug: string, input: Record<string, unknown>) => { calls.push(slug); return { requestId: `r-${slug}`, url: slug.includes('tts') ? 'https://cdn.example/tts.mp3' : 'https://cdn.example/out.mp4', prediction: { status: 'completed' } as never, input }; }) as unknown as LipsyncDeps['runModel'],
    prepareAudio: vi.fn(async () => ({ blob: new Blob(['x']), durationSec: 4.4, padded: true, sourceSec: 3.79 })) as unknown as LipsyncDeps['prepareAudio'],
    uploadMedia: vi.fn(async () => 'https://storage.example/voice.wav') as unknown as LipsyncDeps['uploadMedia'],
    ...over,
  };
  return { d, calls, patches };
}

describe('validateLipsync', () => {
  const ok = { speaker, script: 'hi', model: 'omnihuman-2-0' as const };
  it('accepts a complete setup', () => { expect(validateLipsync(ok)).toBeNull(); });
  it.each([
    [{ ...ok, speaker: { ...speaker, portrait_url: null } }, /portrait/],
    [{ ...ok, speaker: { ...speaker, portrait_url: 'http://insecure/p.png' } }, /https/],
    [{ ...ok, speaker: { ...speaker, voice_id: null } }, /voice/],
    [{ ...ok, script: '   ' }, /empty/],
    [{ ...ok, script: 'x'.repeat(601) }, /too long/],
    [{ ...ok, model: 'nope' as never }, /Unknown/],
  ])('rejects %#', (o, re) => { expect(validateLipsync(o)).toMatch(re); });
});

describe('runLipsyncJob', () => {
  it('runs voice -> prepare -> render in order and uses the padded upload for the render step', async () => {
    const { d, calls, patches } = deps();
    const stages: LipsyncStage[] = [];
    const out = await runLipsyncJob({ speaker, script: 'Pineapple on pizza', model: 'omnihuman-2-0', scene: 'subway', onStage: s => stages.push(s) }, d);
    expect(stages).toEqual(['voice', 'prepare', 'render']);
    expect(calls).toEqual(['elevenlabs-tts-turbo-2-5', 'omnihuman-2-0']);
    const renderInput = (d.runModel as ReturnType<typeof vi.fn>).mock.calls[1][1];
    expect(renderInput).toMatchObject({ image_url: speaker.portrait_url, audio_url: 'https://storage.example/voice.wav', prompt: 'subway' });
    expect(out.status).toBe('completed');
    expect(out.output_url).toBe('https://cdn.example/out.mp4');
    expect(out.audioSeconds).toBe(4.4);
    expect(patches[patches.length - 1]).toMatchObject({ status: 'completed', output_url: 'https://cdn.example/out.mp4' });
  });

  it('skips the upload and uses the original voice URL when no padding was needed', async () => {
    const { d } = deps({ prepareAudio: vi.fn(async () => ({ blob: new Blob(['x']), durationSec: 6, padded: false, sourceSec: 6 })) as never });
    await runLipsyncJob({ speaker, script: 'long enough line', model: 'omnihuman-2-0' }, d);
    expect(d.uploadMedia).not.toHaveBeenCalled();
    expect((d.runModel as ReturnType<typeof vi.fn>).mock.calls[1][1]).toMatchObject({ audio_url: 'https://cdn.example/tts.mp3' });
  });

  it.each([
    ['voice'], ['prepare'], ['render'],
  ])('a failure in the %s stage marks the job failed with the real message and does not continue', async (stage) => {
    let call = 0;
    const { d, patches } = deps({
      runModel: vi.fn(async () => { if (call++ === 0 && stage === 'voice') throw new Error('Insufficient credits'); if (stage === 'render' && call === 2) throw new Error('audio too short'); return { requestId: 'r', url: 'https://cdn.example/x', prediction: {} as never }; }) as never,
      prepareAudio: vi.fn(async () => { if (stage === 'prepare') throw new Error('Could not download the voice audio (403).'); return { blob: new Blob(['x']), durationSec: 4.4, padded: true, sourceSec: 3 }; }) as never,
    });
    await expect(runLipsyncJob({ speaker, script: 'hi', model: 'omnihuman-2-0' }, d)).rejects.toThrow(/credits|download|short/);
    const last = patches[patches.length - 1];
    expect(last.status).toBe('failed');
    expect(String(last.stage)).toBe(`failed:${stage}`);
    expect(String(last.error)).toMatch(/credits|download|short/);
  });

  it('refuses to start (and creates no job) when validation fails', async () => {
    const { d } = deps();
    await expect(runLipsyncJob({ speaker: { ...speaker, voice_id: null }, script: 'hi', model: 'omnihuman-2-0' }, d)).rejects.toThrow(/voice/);
    expect(d.createJob).not.toHaveBeenCalled();
    expect(d.runModel).not.toHaveBeenCalled();
  });
});

describe('helpers', () => {
  it('buildRenderInput trims the prompt to the model limit and omits it when empty', () => {
    expect((buildRenderInput('omnihuman-2-0', 'i', 'a', 'x'.repeat(500)).prompt as string).length).toBe(300);
    expect('prompt' in buildRenderInput('omnihuman-2-0', 'i', 'a', '  ')).toBe(false);
  });
  it('sumCost adds up and reports unknown if any part is missing', () => {
    expect(sumCost([0.0035, 0.5])).toBe(0.5035);
    expect(sumCost([0.1, null])).toBeNull();
    expect(sumCost([0.1, NaN])).toBeNull();
  });
});
