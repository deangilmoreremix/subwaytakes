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
