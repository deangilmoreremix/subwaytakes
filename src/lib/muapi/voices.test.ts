import { describe, it, expect } from 'vitest';
import { MINIMAX_VOICES, buildTtsInput, clampSpeed, parseElevenVoices } from './voices';

describe('parseElevenVoices', () => {
  const meta = { input_schema: { schemas: { input_data: { properties: { voice_id: { enum: [{ label: 'Mark - Casual', value: 'abc' }, { label: 'bad' }, { value: 'x' }, { label: 'James', value: 'def' }] } } } } } };
  it('reads label/value pairs and skips malformed entries', () => {
    expect(parseElevenVoices(meta)).toEqual([{ id: 'abc', label: 'Mark - Casual', provider: 'elevenlabs' }, { id: 'def', label: 'James', provider: 'elevenlabs' }]);
  });
  it('returns [] for unexpected shapes', () => {
    expect(parseElevenVoices(null)).toEqual([]);
    expect(parseElevenVoices({})).toEqual([]);
    expect(parseElevenVoices({ input_schema: { schemas: { input_data: { properties: { voice_id: { enum: 'nope' } } } } } })).toEqual([]);
  });
});

describe('buildTtsInput', () => {
  it('builds ElevenLabs input with the speed clamped to 0.7-1.2', () => {
    expect(buildTtsInput('elevenlabs', ' hi ', 'v1', 3)).toEqual({ prompt: 'hi', voice_id: 'v1', speed: 1.2 });
    expect(clampSpeed('elevenlabs', 0.1)).toBe(0.7);
  });
  it('builds MiniMax input with explicit quality settings (muapi defaults are 8kHz)', () => {
    expect(buildTtsInput('minimax', 'hi', 'Casual_Guy', 1.5)).toMatchObject({ voice_id: 'Casual_Guy', speed: 1.5, format: 'mp3', sample_rate: 32000, emotion: 'neutral' });
  });
  it('refuses empty text or a missing voice instead of sending a doomed request', () => {
    expect(() => buildTtsInput('elevenlabs', '   ', 'v')).toThrow(/nothing to say/);
    expect(() => buildTtsInput('elevenlabs', 'hi', '')).toThrow(/voice/);
  });
  it('defaults a missing/NaN speed to 1', () => {
    expect(clampSpeed('minimax', undefined)).toBe(1);
    expect(clampSpeed('minimax', NaN)).toBe(1);
  });
});

describe('MINIMAX_VOICES', () => {
  it('has unique ids', () => { expect(new Set(MINIMAX_VOICES.map(v => v.id)).size).toBe(MINIMAX_VOICES.length); });
});
