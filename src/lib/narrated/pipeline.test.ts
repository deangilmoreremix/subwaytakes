import { describe, expect, it, vi } from 'vitest';
vi.mock('../supabase', () => ({ supabase: {} }));
import { IMAGE_SLUG, narratedProblem, runNarrated, type NarratedDeps, type NarratedOptions } from './pipeline';

const STORY = 'The train was late again. Maya checked her phone and sighed. Then a stranger offered her a seat, and the whole morning changed. It taught her to look up more often.';
const base: NarratedOptions = { input: { kind: 'story', text: STORY }, style: 'cinematic', aspect: '9:16', fps: 30, voice: { provider: 'elevenlabs', voiceId: 'v1' } };

function fake(over: { failImages?: number[]; failVoice?: boolean; seconds?: number } = {}) {
  const calls: Array<{ slug: string; input: Record<string, unknown> }> = []; let img = 0;
  const runModel = vi.fn(async (slug: string, input: Record<string, unknown>) => {
    calls.push({ slug, input });
    if (slug === IMAGE_SLUG) { const k = img++; if (over.failImages?.includes(k)) throw new Error(`image ${k} refused`); return { requestId: `r${calls.length}`, url: `https://cdn.example/img${k}.png`, prediction: {} as never }; }
    if (over.failVoice) throw new Error('voice refused');
    return { requestId: `r${calls.length}`, url: 'https://cdn.example/voice.mp3', prediction: {} as never };
  });
  const deps: NarratedDeps = { runModel: runModel as unknown as NarratedDeps['runModel'], audioSeconds: async () => over.seconds ?? 12 };
  return { deps, calls };
}

describe('narrated pipeline', () => {
  it('makes the voice first, then one picture per scene, and times the scenes to the voice', async () => {
    const f = fake();
    const r = await runNarrated(base, f.deps);
    expect(f.calls[0].slug).toBe('elevenlabs-tts-turbo-2-5');
    expect(String(f.calls[0].input.prompt)).toBe(STORY);                          // the whole script, word for word
    expect(f.calls.slice(1).every(c => c.slug === IMAGE_SLUG)).toBe(true);
    expect(f.calls.length - 1).toBe(r.scenes.length);
    expect(r.audioFrames).toBe(360);
    expect(r.scenes.reduce((n, s) => n + s.frames, 0)).toBe(360);
    expect(r.made).toBe(r.scenes.length); expect(r.warnings).toEqual([]);
    expect(String(f.calls[1].input.prompt)).toMatch(/No close-up faces/);
  });
  it('a failed voice stops before ANY picture is paid for', async () => {
    const f = fake({ failVoice: true });
    await expect(runNarrated(base, f.deps)).rejects.toThrow('voice refused');
    expect(f.calls.every(c => c.slug !== IMAGE_SLUG)).toBe(true);
  });
  it('a failed picture borrows a neighbour, warns, and the rest still run', async () => {
    const f = fake({ failImages: [1] });
    const r = await runNarrated(base, f.deps);
    expect(r.scenes[1].imageUrl).toBe(r.scenes[0].imageUrl);
    expect(r.made).toBe(r.scenes.length - 1);
    expect(r.warnings[0]).toMatch(/Scene 2 reuses/); expect(r.warnings[0]).toMatch(/image 1 refused/);
  });
  it('a failed FIRST picture borrows the next one', async () => {
    const r = await runNarrated(base, fake({ failImages: [0] }).deps);
    expect(r.scenes[0].imageUrl).toBe(r.scenes[1].imageUrl);
  });
  it('if no picture can be made, the paid voice is still returned (nothing is invented)', async () => {
    const r = await runNarrated(base, fake({ failImages: [0, 1, 2, 3, 4, 5] }).deps);
    expect(r.scenes).toEqual([]); expect(r.made).toBe(0); expect(r.audioUrl).toBe('https://cdn.example/voice.mp3');
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it('the customer\'s own recording skips the paid voice step', async () => {
    const f = fake();
    const r = await runNarrated({ ...base, voice: undefined, recordedAudioUrl: 'https://cdn.example/mine.wav' }, f.deps);
    expect(f.calls.every(c => c.slug === IMAGE_SLUG)).toBe(true); expect(r.audioUrl).toBe('https://cdn.example/mine.wav');
  });
  it('refuses bad input before spending anything', async () => {
    const f = fake();
    for (const o of [{ ...base, input: { kind: 'story' as const, text: 'short' } }, { ...base, voice: undefined }, { ...base, voice: undefined, recordedAudioUrl: 'http://x/a.wav' }, { ...base, input: { kind: 'story' as const, text: 'She said she would kill myself if the train never came, again and again on the train.' } }]) {
      expect(narratedProblem(o)).toBeTruthy();
      await expect(runNarrated(o, f.deps)).rejects.toThrow();
    }
    expect(f.calls).toHaveLength(0);
  });
  it('can be cancelled between steps', async () => {
    const f = fake(); const ac = new AbortController();
    const deps = { ...f.deps, audioSeconds: async () => { ac.abort(); return 10; } };
    await expect(runNarrated({ ...base, signal: ac.signal }, deps)).rejects.toThrow('Cancelled');
    expect(f.calls.filter(c => c.slug === IMAGE_SLUG)).toHaveLength(0);
  });
  it('reports progress', async () => {
    const stages: string[] = [];
    await runNarrated({ ...base, onStage: l => stages.push(l) }, fake().deps);
    expect(stages[0]).toBe('Writing the voice'); expect(stages[1]).toMatch(/Picture 1 of/);
  });
});
