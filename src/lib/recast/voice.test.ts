import { describe, expect, it } from 'vitest';
import { buildVoiceLipsyncInput, estimateVoice, fitSpeech, plainSpeech } from './voice';

describe('plainSpeech', () => {
  it('keeps plain text', () => expect(plainSpeech('  hello   world ')).toBe('hello world'));
  it('reduces SRT to words', () => expect(plainSpeech('1\n00:00:00,000 --> 00:00:02,000\nHello there\n\n2\n00:00:02,000 --> 00:00:04,000\nfriend')).toBe('Hello there friend'));
});

describe('fitSpeech', () => {
  it('leaves a short line alone', () => expect(fitSpeech('elevenlabs', 'a short take here', 6)).toMatchObject({ speed: 1, trimmed: false, sped: false }));
  it('speeds up within the provider range before trimming', () => {
    const text = Array.from({ length: 15 }, (_, i) => `w${i}`).join(' '); // 6s at 2.5 w/s, clip is 5s
    const f = fitSpeech('elevenlabs', text, 5);
    expect(f.sped).toBe(true); expect(f.speed).toBeGreaterThan(1); expect(f.speed).toBeLessThanOrEqual(1.2); expect(f.trimmed).toBe(false);
  });
  it('trims words when even the fastest speed overruns', () => {
    const text = Array.from({ length: 40 }, (_, i) => `w${i}`).join(' ');
    const f = fitSpeech('elevenlabs', text, 5);
    expect(f.speed).toBe(1.2); expect(f.trimmed).toBe(true);
    expect(f.text.split(' ').length).toBeLessThanOrEqual(15);
  });
  it('minimax can go faster than elevenlabs', () => expect(fitSpeech('minimax', Array.from({ length: 30 }, (_, i) => `w${i}`).join(' '), 8).speed).toBeGreaterThan(1.2));
});

describe('lipsync input', () => {
  it('standard models take video and audio', () => expect(buildVoiceLipsyncInput('veed-lipsync', 'v', 'a')).toEqual({ video_url: 'v', audio_url: 'a' }));
  it('volcengine adds lite mode', () => expect(buildVoiceLipsyncInput('volcengine-video-to-video-lip-sync', 'v', 'a')).toEqual({ video_url: 'v', audio_url: 'a', mode: 'lite' }));
  it('estimates three lines', () => expect(estimateVoice('veed-lipsync').map(l => l[1])).toEqual([0.012, 0.05, 0.04]));
});
