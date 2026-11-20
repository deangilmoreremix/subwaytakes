import { describe, expect, it } from 'vitest';
import { MAX_RECORD_SEC, activeWord, clock, micErrorText, peakOf, pickRecorderMime, recordingProblem, teleprompterPlan } from './record';

describe('teleprompter', () => {
  it('splits the script and times each word from the speed', () => {
    const p = teleprompterPlan('Pineapple belongs on pizza', 150);
    expect(p.words).toEqual(['Pineapple', 'belongs', 'on', 'pizza']);
    expect(p.msPerWord).toBe(400);
    expect(p.totalMs).toBe(1600);
  });
  it('keeps the speed in a sensible range and survives an empty script', () => {
    expect(teleprompterPlan('a b', 5).msPerWord).toBe(Math.round(60000 / 90));
    expect(teleprompterPlan('a b', 9999).msPerWord).toBe(Math.round(60000 / 220));
    expect(teleprompterPlan('a b', Number.NaN).msPerWord).toBe(400);
    expect(teleprompterPlan('   ').words).toEqual([]);
  });
  it('highlights the word being read', () => {
    const p = teleprompterPlan('one two three', 150);
    expect(activeWord(p, -1)).toBe(-1);
    expect(activeWord(p, 0)).toBe(0);
    expect(activeWord(p, 399)).toBe(0);
    expect(activeWord(p, 400)).toBe(1);
    expect(activeWord(p, 99999)).toBe(2);
    expect(activeWord(teleprompterPlan(''), 100)).toBe(-1);
  });
});

describe('recording checks', () => {
  it('refuses too short, too long and silent takes', () => {
    expect(recordingProblem(0.3, 0.5)).toMatch(/too short/);
    expect(recordingProblem(MAX_RECORD_SEC + 1, 0.5)).toMatch(/longer than/);
    expect(recordingProblem(5, 0.001)).toMatch(/silent/);
    expect(recordingProblem(5, 0.4)).toBeNull();
    expect(recordingProblem(Number.NaN, 0.4)).toMatch(/too short/);
  });
  it('finds the loudest sample', () => { expect(peakOf(new Float32Array([0.1, -0.7, 0.3]))).toBeCloseTo(0.7); expect(peakOf(new Float32Array())).toBe(0); });
  it('formats the clock', () => { expect(clock(7)).toBe('0:07'); expect(clock(75.9)).toBe('1:15'); expect(clock(-3)).toBe('0:00'); });
  it('picks the first container the browser supports', () => {
    expect(pickRecorderMime(t => t === 'audio/mp4')).toBe('audio/mp4');
    expect(pickRecorderMime(t => t.startsWith('audio/webm'))).toBe('audio/webm;codecs=opus');
    expect(pickRecorderMime(() => false)).toBeNull();
  });
  it('turns microphone failures into plain advice', () => {
    expect(micErrorText(new DOMException('x', 'NotAllowedError'))).toMatch(/blocked/);
    expect(micErrorText(new DOMException('x', 'NotFoundError'))).toMatch(/No microphone/);
    expect(micErrorText(new DOMException('x', 'NotReadableError'))).toMatch(/another app/);
    expect(micErrorText(new Error('weird'))).toBe('weird');
  });
});
