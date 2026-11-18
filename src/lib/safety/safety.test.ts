import { describe, expect, it, vi } from 'vitest';
vi.mock('../supabase', () => ({ supabase: {} }));
import { checkBody, checkText } from './index';
import { CITIES, SCENES } from '../places';
import { SHOWS, SAMPLE_ANSWERS_FOR_TEST } from './fixtures';
import { DEFAULT_TAKE, buildNativePrompt, buildStillPrompt, buildTwoShotStillPrompt } from '../interview';
import { buildGuestStillPrompt } from '../muapi/prompt';
import { PLAN_PROMPT, buildFallbackPrompt } from '../recast/pipeline';
import { PLATE_PROMPT, WRITER_SYSTEM, buildSheetPrompt, buildWriterPrompt } from '../recast/prompts';
import { buildTranslatePrompt } from '../dubbing/prompts';
import { DUB_LANGUAGES } from '../dubbing/languages';
import { applyShow } from '../shows';
import { TEMPLATES } from '../templates';
import { DEFAULT_HOST, buildPortraitPrompt } from '../characters';

/** The screen must never block the studio's OWN prompts: every show, city, scene, template, recast and dubbing prompt has to pass. */
describe('the studio\'s own prompts pass the content screen', () => {
  it('native, still and two-shot prompts for every show in every city and scene', () => {
    for (const show of SHOWS) for (const city of CITIES) for (const scene of SCENES.slice(0, 4)) {
      const spec = { ...applyShow(DEFAULT_TAKE, show.id), place: { ...DEFAULT_TAKE.place, city: city.id, scene: scene.id } };
      for (const p of [buildNativePrompt(spec), buildStillPrompt(spec, 'host'), buildStillPrompt(spec, 'guest'), buildTwoShotStillPrompt(spec), buildGuestStillPrompt(spec)]) {
        const r = checkText(p); expect(r.ok, `${show.id}/${city.id}/${scene.id}: ${r.ok ? '' : r.category}`).toBe(true);
      }
    }
  });
  it('every show\'s sample answers and ideas pass', () => {
    for (const t of SAMPLE_ANSWERS_FOR_TEST) expect(checkText(t).ok, t).toBe(true);
    for (const s of SHOWS) for (const idea of s.ideas) expect(checkText(idea).ok, idea).toBe(true);
  });
  it('every template applies to a prompt that passes', () => {
    for (const t of TEMPLATES) { const { spec } = (() => ({ spec: applyShow(DEFAULT_TAKE, t.show) }))(); expect(checkText(buildNativePrompt(spec)).ok, t.id).toBe(true); }
  });
  it('recast prompts pass', () => {
    for (const p of [PLAN_PROMPT, PLATE_PROMPT, WRITER_SYSTEM, buildSheetPrompt('a bright red wool coat over a cream sweater'),
      buildWriterPrompt({ model: 'wan', mode: 'motion_transfer', sheets: 1, plates: 3, seconds: 8, brief: 'keep it funny', outfit: 'a red coat', sceneSummary: 'two people on a train' }),
      buildFallbackPrompt({ model: 'wan', sheets: 1, plates: 3, seconds: 8, brief: 'keep it funny', outfit: 'a red coat', sceneSummary: 'two people on a train' })]) expect(checkText(p).ok, p.slice(0, 60)).toBe(true);
  });
  it('dubbing prompts pass for every language', () => {
    for (const l of DUB_LANGUAGES) expect(checkText(buildTranslatePrompt('Pineapple belongs on pizza.', l.id, 8)).ok, l.id).toBe(true);
  });
  it('the default host and a portrait prompt pass', () => {
    expect(checkText(buildPortraitPrompt({ ...DEFAULT_HOST, name: 'Host' } as never)).ok).toBe(true);
  });
  it('a blocked prompt is refused even when it is nested in a gateway-shaped body', () => {
    expect(checkBody({ prompt: 'Taylor Swift on a train', duration: 8, aspect_ratio: '9:16' }).ok).toBe(false);
    expect(checkBody({ prompt: 'two friends on a train', duration: 8, aspect_ratio: '9:16' }).ok).toBe(true);
  });
});

describe('faith content (Scripture and Motivation packs)', () => {
  const blocked: Array<[string, string]> = [
    ['a video of Jesus walking through the train car', 'religious'], ['show God sitting on the bench next to the host', 'religious'], ['an actor playing Jesus gives the answer', 'religious'],
    ['the voice of Allah speaks to the guest', 'religious'], ['depict the prophet Muhammad in the carriage', 'religious'], ['dressed as an angel with a halo', 'religious'],
    ['mock the Bible and the people who read it', 'religious'], ['make fun of christians on the subway', 'religious'], ['ridicule religious people', 'religious'],
    ['God guarantees you will be rich if you give', 'guarantee'], ['I guarantee healing if you believe', 'guarantee'], ['pray and your cancer will disappear', 'guarantee'],
    ['faith will make you rich', 'guarantee'], ['send a seed offering and receive a miracle', 'guarantee'], ['God will heal you if you tithe', 'guarantee'],
  ];
  it.each(blocked)('blocks: %s', (text, category) => { const r = checkText(text); expect(r.ok).toBe(false); if (!r.ok) expect(r.category).toBe(category); });
  it('blocks the same requests with spacing and look-alike letters', () => {
    expect(checkText('v i d e o  of  J e s u s').ok).toBe(false);
    expect(checkText('mоck the bible').ok).toBe(false);   // Cyrillic o
  });
  const allowed = ['my faith got me through a hard year', 'I read Psalm 23 every morning on the train', 'God is my strength when I am tired', 'This verse reminds me that I am not alone',
    'Philippians 4:13 says I can do all things through Christ who strengthens me', 'We pray for peace and hope for better days', 'My grandmother read the Bible to me every Sunday',
    'The host listens quietly and gives a warm nod', 'Pray about it and take it one day at a time', 'Thank God it is Friday', 'I believe things will get better if I keep showing up'];
  it.each(allowed)('allows ordinary faith talk: %s', text => { expect(checkText(text).ok, text).toBe(true); });
});

describe('faith content: review follow-ups', () => {
  const blocked = ['make a video where Jesus rides the train', 'Jesus rides the train', 'Jesus on the subway', 'jesus talking to the guest', 'parody of Jesus', 'God appears in the car', 'the video features God as a character',
    'a scene with Allah next to the host', 'Muhammad sitting on the bench', 'a skit about Buddha', 'mock Islam', 'mock the pope', 'make fun of mormons', 'J3sus rides the train'];
  it.each(blocked)('blocks: %s', t => { expect(checkText(t).ok, t).toBe(false); });
  const allowed = ['God will heal your heart', 'guarantee money back', 'we offer a money back guarantee', 'Jesus loved the poor, and that moves me', 'I pray to Allah every day and it keeps me steady', 'Muhammad Ali was a champion', 'Moses led his people, I read that story to my kids',
    'the pope visited our city last year', 'my pastor says faith is a journey', 'Buddha taught me to breathe', 'Christ is the reason I get up in the morning'];
  it.each(allowed)('allows: %s', t => { expect(checkText(t).ok, t).toBe(true); });
});
