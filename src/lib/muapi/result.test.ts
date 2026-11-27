import { describe, it, expect } from 'vitest';
import { extractError, extractMediaUrl, extractText, isSafeMediaUrl, normalizeStatus } from './result';
import vision from './__fixtures__/real-vision-result.json';
import tts from './__fixtures__/real-tts-result.json';
import image from './__fixtures__/real-image-result.json';

describe('real muapi responses (captured from live calls)', () => {
  it('reads the audio URL from a real ElevenLabs result', () => {
    expect(extractMediaUrl(tts)).toMatch(/^https:\/\/cdn\.muapi\.ai\/outputs\/generated\/.+\.mp3$/);
    expect(normalizeStatus(tts)).toBe('completed');
    expect(extractError(tts)).toBe('');
  });
  it('reads the image URL from a real GPT Image result', () => {
    expect(extractMediaUrl(image)).toMatch(/\.png$/);
  });
});

describe('tolerant shapes', () => {
  const u = 'https://cdn.example.com/a.mp4';
  it.each([
    [{ outputs: [u] }], [{ output: u }], [{ output: { video: u } }], [{ output: { video_url: u } }], [{ output: { audio_url: u } }],
    [{ data: { result: { url: u } } }], [{ video_url: u }], [{ outputs: [{ url: u }] }], [{ output_data: { image: u } }],
  ])('finds the URL in %j', p => { expect(extractMediaUrl(p)).toBe(u); });

  it('ignores unsafe or missing URLs', () => {
    expect(extractMediaUrl({ outputs: ['http://insecure.test/a.mp4'] })).toBeUndefined();
    expect(extractMediaUrl({ outputs: ['https://user:pw@evil.test/a.mp4'] })).toBeUndefined();
    expect(extractMediaUrl({ outputs: ['not a url'] })).toBeUndefined();
    expect(extractMediaUrl(null)).toBeUndefined();
    expect(extractMediaUrl({ status: 'completed' })).toBeUndefined();
    expect(isSafeMediaUrl('javascript:alert(1)')).toBe(false);
  });

  it('does not loop forever on cyclic or very deep input', () => {
    const a: Record<string, unknown> = {}; a.output = a;
    expect(extractMediaUrl(a)).toBeUndefined();
  });
});

describe('status and error normalisation', () => {
  it.each([['completed', 'completed'], ['SUCCEEDED', 'completed'], ['done', 'completed'], ['failed', 'failed'], ['error', 'failed'], ['canceled', 'cancelled'], ['queued', 'queued'], ['pending', 'queued'], ['running', 'processing']])('%s -> %s', (s, want) => {
    expect(normalizeStatus({ status: s })).toBe(want);
  });
  it('looks in nested places and defaults to processing', () => {
    expect(normalizeStatus({ data: { status: 'success' } })).toBe('completed');
    expect(normalizeStatus({ task_status: 'failed' })).toBe('failed');
    expect(normalizeStatus({})).toBe('processing');
    expect(normalizeStatus(null)).toBe('processing');
  });
  it('extracts errors from several shapes', () => {
    expect(extractError({ error: 'Insufficient credits' })).toBe('Insufficient credits');
    expect(extractError({ output: { error: 'bad audio' } })).toBe('bad audio');
    expect(extractError({ detail: { message: 'nope' } })).toBe('nope');
  });
});

describe('extractText', () => {
  it('reads the real gemini-video-vision response (text lives in outputs[0], not a URL)', () => {
    const t = extractText(vision);
    expect(t).toContain('"timestamps"');
    expect(extractMediaUrl(vision)).toBeUndefined(); // must not mistake text for media
    expect(normalizeStatus(vision)).toBe('completed');
  });
  it('accepts other shapes and returns empty for none', () => {
    expect(extractText({ text: 'a' })).toBe('a');
    expect(extractText({ output: 'b' })).toBe('b');
    expect(extractText({ output: { text: 'c' } })).toBe('c');
    expect(extractText({ outputs: [{ text: 'd' }] })).toBe('d');
    expect(extractText({ outputs: [] })).toBe('');
    expect(extractText(null)).toBe('');
  });
});
