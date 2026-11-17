import { describe, expect, it } from 'vitest';
import { checkBody, checkText, collectText, normalize } from './safety';

const blocked = (t: string, cat?: string, extra: string[] = []) => { const r = checkText(t, extra); expect(r.ok, t).toBe(false); if (cat && !r.ok) expect(r.category, t).toBe(cat); };
const fine = (t: string) => expect(checkText(t).ok, t).toBe(true);

describe('safety: what is refused', () => {
  it('sexual content', () => { for (const t of ['a nude woman on a train', 'NSFW scene', 'explicit sex scene', 'topless guest']) blocked(t, 'sexual'); });
  it('graphic violence and self-harm and hate', () => {
    blocked('a gory beheading', 'violence'); blocked('how to kill myself', 'self_harm'); blocked('they shout heil hitler', 'hate');
  });
  it('children, with the unambiguous words and age statements', () => {
    for (const t of ['a toddler on the subway', 'a teenager rapping', 'a 12 year old boy', 'girl aged 9', 'my 8yo cousin', 'high school student']) blocked(t, 'minors');
  });
  it('a young-person word next to a sexual or violent word is always refused', () => { blocked('a kid and a nude statue', 'minors'); blocked('teen gore', 'minors'); });
  it('real and named people and look-alikes', () => {
    blocked('Taylor Swift singing on the train', 'likeness'); blocked('make it look like a deepfake of the president', 'likeness'); blocked('a celebrity lookalike', 'likeness');
    blocked('an actor who looks like the president', 'likeness'); blocked('face swap with my boss', 'likeness');
  });
  it('medical claims', () => { blocked('this miracle cure cures cancer', 'medical'); blocked('stop taking your medication', 'medical'); });
  it('operator-added terms', () => { blocked('a video of Jane Roe', 'likeness', ['jane roe']); fine('a video of someone else'); });
});

describe('safety: lazy obfuscation does not work', () => {
  it.each(['n.u.d.e', 'n u d e', 'nvde'.replace('v', 'u'), 'p0rn', 'N@KED', 'nu​de', 'ｎａｋｅｄ', 'gøre'.replace('ø', 'o'), 'T4YL0R SW1FT', 'taylor   swift', 'Taylor-Swift'])('catches %s', t => blocked(`a scene with ${t}`));
  it('normalises accents, case, zero-width characters and punctuation', () => { expect(normalize('  Café—NUDE!! ')).toBe('cafe nude'); });
});

describe('safety: ordinary takes and prompts are not blocked', () => {
  it.each([
    'Pineapple belongs on pizza and anyone who disagrees is scared of joy.', 'Kids should not have phones before high school.', 'Monday mornings are torture.', 'My baby learned to wave today and it made my day.',
    'Cereal is a soup.', 'The subway in Essex is cleaner than people think.', 'A class of students on a field trip is the loudest thing on the train.', 'I think the new Taylor Swift album is overrated.'.replace('Taylor Swift ', ''),
    'Both hold a flat yellow plastic card held up to the mouth like a microphone. There is no real microphone, no lavalier, no boom.', 'A local commuter in their 30s in a winter jacket, handheld vertical documentary two-shot.',
    'The best advice I ever got: drink water and call your mom.', 'Rate my commute out of ten: a solid seven.', 'This pizza place is 5 years old and still great.', 'My grandmother is 90 years old and runs marathons.',
  ])('allows %s', t => fine(t));
  it('does not match inside longer words', () => { fine('assassin classics'); fine('Essex'); fine('scunthorpe'); });
});

describe('safety: whole request bodies', () => {
  it('reads prompts and nested text but not URLs or settings', () => {
    expect(collectText({ prompt: 'hello there', image_url: 'https://x/a.png', aspect_ratio: '9:16', nested: { script: 'a b c' }, list: ['xyz'] }).sort()).toEqual(['a b c', 'hello there', 'xyz']);
  });
  it('refuses a body whose prompt is blocked and passes a clean one', () => {
    expect(checkBody({ prompt: 'a nude person', duration: 8 }).ok).toBe(false); expect(checkBody({ prompt: 'two friends on a train', duration: 8 }).ok).toBe(true);
    expect(checkBody({ prompt: 'fine', images_list: ['https://x/nude.png'] }).ok).toBe(true);   // URLs are not text the customer wrote
  });
  it('is bounded: huge or deeply nested bodies cannot hang it', () => {
    let deep: unknown = 'nude'; for (let i = 0; i < 50; i++) deep = { a: deep };
    expect(() => checkBody(deep)).not.toThrow(); expect(() => checkText('x'.repeat(1_000_000))).not.toThrow();
  });
  it('returns a friendly message, never the matched word', () => {
    const r = checkText('a naked woman'); expect(r.ok).toBe(false); if (!r.ok) { expect(r.message).not.toMatch(/naked/i); expect(r.message.length).toBeGreaterThan(20); }
  });
});
