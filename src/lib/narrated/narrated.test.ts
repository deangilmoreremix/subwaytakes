import { describe, expect, it } from 'vitest';
import { DEFAULT_STYLE, MAX_SCENES, MAX_SCRIPT_CHARS, MIN_SCENES, MIN_SCENE_FRAMES, NARRATED_STYLES, addNarratedClips, estimateSeconds, planNarrated, sceneFrames, scenePrompt } from './index';
import { DEFAULT_PROJECT } from '../timeline/types';
import { checkText } from '../safety';
import { allQuotes } from '../quotes';
import { allVerses } from '../bible';

const STORY = 'The train was late again. Maya checked her phone and sighed. Then a stranger offered her a seat, and the whole morning changed. She still thinks about that small kindness. It taught her to look up more often.';

describe('planning a narrated script', () => {
  it('splits a story into 3 to 6 scenes without reordering or losing a word', () => {
    const r = planNarrated({ kind: 'story', text: STORY });
    expect(r.problem).toBeNull();
    expect(r.beats.length).toBeGreaterThanOrEqual(MIN_SCENES); expect(r.beats.length).toBeLessThanOrEqual(MAX_SCENES);
    expect(r.beats.join(' ')).toBe(STORY);
    expect(r.script).toBe(STORY);
  });
  it('makes enough scenes from one long sentence', () => {
    const r = planNarrated({ kind: 'story', text: 'When the doors finally opened, everybody rushed in at once, and somehow Maya found the one empty seat by the window.' });
    expect(r.problem).toBeNull(); expect(r.beats.length).toBeGreaterThanOrEqual(MIN_SCENES);
  });
  it('caps long stories at six scenes', () => {
    const long = Array.from({ length: 14 }, (_, i) => `This is sentence number ${i + 1} of a rather long story.`).join(' ');
    const r = planNarrated({ kind: 'story', text: long });
    expect(r.beats).toHaveLength(MAX_SCENES); expect(r.beats.join(' ')).toBe(long);
  });
  it('refuses too short, too long and empty input with a reason', () => {
    expect(planNarrated({ kind: 'story', text: 'Hi there' }).problem).toMatch(/at least/);
    expect(planNarrated({ kind: 'story', text: 'word '.repeat(400) }).problem).toMatch(/too long/);
    expect(planNarrated({ kind: 'quote', text: '  ' }).problem).toMatch(/quote/);
    expect(planNarrated({ kind: 'verse', text: '' }).problem).toMatch(/verse/);
  });
  it('a list gets a title scene and one scene per item, numbered', () => {
    const r = planNarrated({ kind: 'listicle', title: 'Three things I learned', items: ['Show up early', 'Say thank you', 'Keep going'] });
    expect(r.problem).toBeNull();
    expect(r.beats).toEqual(['Three things I learned.', 'Number 1. Show up early.', 'Number 2. Say thank you.', 'Number 3. Keep going.']);
    expect(planNarrated({ kind: 'listicle', title: 'x', items: ['only one'] }).problem).toMatch(/two items/);
    expect(planNarrated({ kind: 'listicle', title: '', items: ['a', 'b'] }).problem).toMatch(/title/);
    expect(planNarrated({ kind: 'listicle', title: 't', items: ['a', 'b', 'c', 'd', 'e', 'f'] }).problem).toMatch(/at most/);
  });
  it('a quote or verse is spoken exactly as given, with its attribution as the last scene, and is never trimmed or reworded', () => {
    for (const q of allQuotes().slice(0, 40)) {
      const r = planNarrated({ kind: 'quote', text: q.text, attribution: `${q.author}, ${q.work}` });
      expect(r.problem, q.id).toBeNull();
      const attr = r.beats[r.beats.length - 1];
      expect(attr).toContain(q.author);
      expect(r.beats.slice(0, -1).join(' ').replace(/\s+/g, ' ')).toBe(q.text.replace(/\s+/g, ' ').trim());
    }
    for (const v of allVerses().slice(0, 60)) {
      const r = planNarrated({ kind: 'verse', text: v.kjv, attribution: `${v.ref} (KJV)` });
      expect(r.problem, v.ref).toBeNull();
      expect(r.beats.slice(0, -1).join(' ')).toBe(v.kjv.replace(/\s+/g, ' ').trim());
    }
  });
});

describe('scene timing', () => {
  it('adds up to exactly the voice length and respects the minimum', () => {
    const beats = ['one two three four five six', 'seven eight', 'nine ten eleven twelve thirteen fourteen fifteen sixteen'];
    for (const total of [150, 301, 899, 2000]) {
      const f = sceneFrames(beats, total);
      expect(f.reduce((a, b) => a + b, 0)).toBe(Math.max(total, MIN_SCENE_FRAMES * 3));
      expect(Math.min(...f)).toBeGreaterThanOrEqual(MIN_SCENE_FRAMES);
    }
    const f = sceneFrames(beats, 900);
    expect(f[2]).toBeGreaterThan(f[1]);                  // more words, more time
    expect(sceneFrames([], 100)).toEqual([]);
  });
  it('a very short voice is stretched to the minimums rather than made impossible', () => {
    expect(sceneFrames(['a b c', 'd e f', 'g h i'], 30).reduce((a, b) => a + b, 0)).toBe(MIN_SCENE_FRAMES * 3);
  });
  it('estimates seconds', () => { expect(estimateSeconds(STORY)).toBeGreaterThan(5); expect(estimateSeconds('a')).toBe(2); });
});

describe('scene pictures', () => {
  it('are faceless, textless and pass the content screen for every style, kind and aspect', () => {
    for (const s of NARRATED_STYLES) for (const kind of ['story', 'listicle', 'quote', 'verse'] as const) for (const a of ['9:16', '16:9', '1:1'] as const) {
      const p = scenePrompt('Maya checked her phone and sighed.', s.id, a, kind);
      expect(p).toMatch(/No close-up faces/); expect(p).toMatch(/no text/); expect(p).toContain(a);
      expect(checkText(p).ok, `${s.id} ${kind}`).toBe(true);
    }
  });
  it('verses never show holy figures and the default style is used for an unknown one', () => {
    expect(scenePrompt('The Lord is my shepherd.', 'x', '9:16', 'verse')).toMatch(/no people or figures at all/);
    expect(scenePrompt('hello', 'nonsense', '9:16', 'story')).toContain(NARRATED_STYLES[0].phrase);
    expect(DEFAULT_STYLE).toBe('cinematic');
  });
  it('a long beat is cut in the PICTURE prompt only (the spoken text is untouched)', () => {
    expect(scenePrompt('word '.repeat(200), 'cinematic', '9:16', 'story').length).toBeLessThan(700);
  });
});

describe('placing the result on the timeline', () => {
  const scenes = [{ text: 'One.', imageUrl: 'https://cdn.example/1.png', frames: 60 }, { text: 'Two.', imageUrl: 'https://cdn.example/2.png', frames: 90 }, { text: 'Three.', imageUrl: 'https://cdn.example/3.png', frames: 75 }];
  const out = addNarratedClips(DEFAULT_PROJECT, { scenes, audioUrl: 'https://cdn.example/v.mp3', audioFrames: 225, label: 'Voice' });
  it('puts the pictures back to back, the voice underneath, and the words as captions', () => {
    const v = out.clips.filter(c => c.still); const a = out.clips.filter(c => c.kind === 'audio'); const c = out.clips.filter(c => c.kind === 'caption');
    expect(v.map(x => [x.start, x.duration])).toEqual([[0, 60], [60, 90], [150, 75]]);
    expect(v.every(x => x.volume === 0 && x.kind === 'video')).toBe(true);
    expect(new Set(v.map(x => x.still!.motion)).size).toBeGreaterThan(1);
    expect(a).toHaveLength(1); expect(a[0]).toMatchObject({ start: 0, duration: 225, src: 'https://cdn.example/v.mp3', volume: 1 });
    expect(c.map(x => x.text)).toEqual(['One.', 'Two.', 'Three.']);
  });
  it('starts after what is already on the timeline and leaves earlier clips alone', () => {
    const again = addNarratedClips(out, { scenes: scenes.slice(0, 1), audioUrl: 'https://cdn.example/w.mp3', audioFrames: 60, label: 'Voice 2' });
    expect(again.clips.length).toBe(out.clips.length + 3);
    expect(again.clips.find(c => c.src === 'https://cdn.example/w.mp3')!.start).toBe(225);
    expect(addNarratedClips(DEFAULT_PROJECT, { scenes: [], audioUrl: 'x', audioFrames: 1, label: 'x' })).toBe(DEFAULT_PROJECT);
  });
  it('the planned script fits one voice call', () => { expect(MAX_SCRIPT_CHARS).toBeLessThanOrEqual(1000); });
});
