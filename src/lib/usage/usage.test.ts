import { describe, expect, it, vi } from 'vitest';
vi.mock('../supabase', () => ({ supabase: {} }));
import { featureOf, groupUsage, weekStart, type LedgerRow } from './index';
import { LIPSYNC_MODELS, NATIVE_MODELS, RECAST, STILL_MODELS, TTS_MODELS } from '../muapi/registry';

describe('featureOf', () => {
  it('classifies every model the app can call', () => {
    for (const m of NATIVE_MODELS) expect(featureOf(m.slug), m.slug).toBe('video');
    for (const m of LIPSYNC_MODELS) expect(featureOf(m.slug), m.slug).toBe('lipsync');
    for (const m of TTS_MODELS) expect(featureOf(m.slug), m.slug).toBe('voice');
    for (const m of STILL_MODELS) expect(featureOf(m.slug), m.slug).toBe('image');
    for (const s of [RECAST.depth, RECAST.vision, RECAST.render.full, RECAST.render.lite]) expect(featureOf(s), s).toBe('recast');
    expect(featureOf(RECAST.cleanFrames)).toBe('image'); expect(featureOf(RECAST.characterSheet)).toBe('image');
    for (const s of ['veed-lipsync', 'sync-lipsync', 'creatify-lipsync', 'volcengine-video-to-video-lip-sync']) expect(featureOf(s)).toBe('lipsync');
    expect(featureOf('openai-whisper')).toBe('text'); expect(featureOf('ai-captions')).toBe('text'); expect(featureOf('gemini-2-5-flash')).toBe('text');
    expect(featureOf('')).toBe('other'); expect(featureOf('mystery-model')).toBe('other');
  });
});

describe('groupUsage', () => {
  const now = new Date(2026, 10, 18, 12);   // Wednesday 18 Nov 2026
  const row = (daysAgo: number, delta: number, kind: string, reason: string | null, ref: string | null): LedgerRow => ({ delta, kind, reason, ref, created_at: new Date(2026, 10, 18 - daysAgo, 10).toISOString() });
  it('weeks start on Monday', () => { expect(weekStart(now).getDay()).toBe(1); expect(weekStart(new Date(2026, 10, 15)).getDay()).toBe(1); });
  it('adds up spend per week and per feature', () => {
    const u = groupUsage([row(0, -150, 'spend', 'veo3.1-fast-text-to-video', 'hold:1'), row(1, -100, 'spend', 'omnihuman-2-0', 'hold:2'), row(9, -40, 'spend', 'elevenlabs-tts-turbo-2-5', 'hold:3')], now);
    expect(u.total).toBe(290); expect(u.weeks).toHaveLength(8); expect(u.weeks[7].credits).toBe(250); expect(u.weeks[6].credits).toBe(40);
    expect(u.byFeature).toEqual([{ feature: 'video', credits: 150 }, { feature: 'lipsync', credits: 100 }, { feature: 'voice', credits: 40 }]);
  });
  it('a refund cancels the spend it belongs to, so failed generations cost nothing', () => {
    const u = groupUsage([row(0, -150, 'spend', 'veo3.1-fast-text-to-video', 'hold:1'), row(0, 150, 'refund', 'job failed', 'hold:1'), row(0, -90, 'spend', 'omnihuman-2-0', 'hold:2')], now);
    expect(u.total).toBe(90); expect(u.refunded).toBe(150); expect(u.byFeature).toEqual([{ feature: 'lipsync', credits: 90 }]);
  });
  it('ignores grants, adjustments, opening balances and anything older than eight weeks', () => {
    const u = groupUsage([row(0, 1000, 'grant', 'purchase', 'order:1'), row(0, -5, 'adjust', 'x', null), row(0, 50, 'opening', null, null), row(70, -100, 'spend', 'omnihuman-2-0', 'hold:9')], now);
    expect(u.total).toBe(0); expect(u.byFeature).toEqual([]);
  });
  it('is empty and well-formed with no rows', () => { const u = groupUsage([], now); expect(u.weeks).toHaveLength(8); expect(u.total).toBe(0); expect(u.refunded).toBe(0); });
});
