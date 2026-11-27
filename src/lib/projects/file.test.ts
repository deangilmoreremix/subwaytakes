import { describe, expect, it } from 'vitest';
import { FILE_VERSION, MAX_FILE_BYTES, parseProjectFile, serializeProjectFile, suggestedFileName } from './file';
import { DEFAULT_PROJECT, type Project } from '../timeline/types';

const proj = (over: Partial<Project> = {}): Project => ({ ...DEFAULT_PROJECT, clips: [{ id: 'a', trackId: 'v1', kind: 'video', label: 'shot', start: 0, duration: 90, trimStart: 0, sourceFrames: 240, src: 'https://cdn.example/a.mp4', volume: 1 } as never], ...over });

describe('project files', () => {
  it('round-trips a project with its name', () => {
    const text = serializeProjectFile(proj(), 'My Pineapple Take', new Date('2026-11-20T10:00:00Z'));
    const back = parseProjectFile(text);
    expect(back.ok).toBe(true);
    if (back.ok) { expect(back.name).toBe('My Pineapple Take'); expect(back.project.clips).toHaveLength(1); expect(back.project.clips[0].src).toBe('https://cdn.example/a.mp4'); }
    expect(JSON.parse(text)).toMatchObject({ app: 'subwaytakes', fileVersion: FILE_VERSION, savedAt: '2026-11-20T10:00:00.000Z' });
  });
  it('makes a safe file name', () => {
    expect(suggestedFileName('My Take: "Pineapple" / pizza?!')).toBe('My-Take-Pineapple-pizza.subwaytakes.json');
    expect(suggestedFileName('')).toBe('episode.subwaytakes.json');
    expect(suggestedFileName('../../etc/passwd')).not.toContain('/');
    expect(suggestedFileName('x'.repeat(200)).length).toBeLessThan(80);
  });
  it('refuses things that are not projects, with a reason', () => {
    for (const bad of ['', '   ', 'not json', '[]', 'null', '{}', JSON.stringify({ app: 'other', fileVersion: 1, project: proj() }), JSON.stringify({ app: 'subwaytakes', fileVersion: 1 }), JSON.stringify({ app: 'subwaytakes', fileVersion: 1, project: { clips: 'x', tracks: [], fps: 30 } }), JSON.stringify({ app: 'subwaytakes', fileVersion: 1, project: { clips: [], tracks: [], fps: 0 } })]) {
      const r = parseProjectFile(bad);
      expect(r.ok, bad.slice(0, 30)).toBe(false);
      if (!r.ok) expect(r.reason.length).toBeGreaterThan(5);
    }
  });
  it('refuses a newer file version and an oversize file', () => {
    expect(parseProjectFile(JSON.stringify({ app: 'subwaytakes', fileVersion: FILE_VERSION + 1, project: proj() }))).toMatchObject({ ok: false, reason: expect.stringMatching(/newer version/) });
    expect(parseProjectFile('x'.repeat(MAX_FILE_BYTES + 1))).toMatchObject({ ok: false, reason: expect.stringMatching(/too big/) });
  });
  it('only lets https media in (no javascript:, file:, data:, blob: or http:)', () => {
    for (const src of ['javascript:alert(1)', 'file:///etc/passwd', 'data:text/html,hi', 'blob:http://x/1', 'http://insecure/a.mp4']) {
      const r = parseProjectFile(serializeProjectFile(proj({ clips: [{ ...proj().clips[0], src } as never] }), 'x'));
      expect(r.ok, src).toBe(false);
    }
    expect(parseProjectFile(serializeProjectFile(proj({ clips: [{ ...proj().clips[0], src: undefined } as never] }), 'x')).ok).toBe(true);   // a caption or text clip has no media
  });
  it('never carries a muapi key (the key is not part of a project)', () => {
    expect(serializeProjectFile(proj(), 'x')).not.toMatch(/x-muapi-key|subwaytakes\.muapi\.key|mk_live/);
  });
  it('fills in missing tracks like any opened project', () => {
    const r = parseProjectFile(JSON.stringify({ app: 'subwaytakes', fileVersion: 1, name: 'n', project: { fps: 30, clips: [], tracks: [] } }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.project.tracks.length).toBeGreaterThan(0);
  });
});

describe('reframed clips in files', () => {
  it('a crop is kept when valid, clamped when wild, and dropped when junk', () => {
    const mk = (crop: unknown) => parseProjectFile(serializeProjectFile(proj({ clips: [{ ...proj().clips[0], crop } as never] }), 'x'));
    const ok = mk({ zoom: 2, x: 0.6, y: 0.4 }); expect(ok.ok && ok.project.clips[0].crop).toEqual({ zoom: 2, x: 0.6, y: 0.4 });
    const wild = mk({ zoom: 50, x: 9, y: -9 }); expect(wild.ok && wild.project.clips[0].crop?.zoom).toBe(3);
    const junk = mk('nope'); expect(junk.ok && junk.project.clips[0].crop).toBeUndefined();
  });
});

describe('poll results cards in files', () => {
  const card = (effect: unknown) => ({ id: 'p', trackId: 'e1', kind: 'effect', label: 'Poll results', start: 60, duration: 90, trimStart: 0, effect });
  const open = (effect: unknown) => parseProjectFile(serializeProjectFile(proj({ clips: [proj().clips[0], card(effect) as never] }), 'x'));
  it('keeps a valid card (re-validated) and drops one made of junk', () => {
    const ok = open({ type: 'poll-results', question: 'Q?', labels: ['Yes', 'No'], counts: [3, 2] });
    expect(ok.ok && ok.project.clips.filter(c => c.kind === 'effect')).toHaveLength(1);
    const wild = open({ type: 'poll-results', question: 'Q?', labels: ['Yes', 'No'], counts: [500, -2] });
    expect(wild.ok && wild.project.clips[1].effect).toMatchObject({ counts: [99, 0] });
    const junk = open({ type: 'poll-results', question: 5, labels: 'x', counts: 'y' });
    expect(junk.ok && junk.project.clips.filter(c => c.kind === 'effect')).toHaveLength(0);
  });
  it('leaves other effects alone', () => {
    const leak = open({ type: 'light-leak', seed: 3, hueShift: 20 });
    expect(leak.ok && leak.project.clips.filter(c => c.kind === 'effect')).toHaveLength(1);
  });
});

describe('city tags in files', () => {
  const tag = (effect: unknown) => ({ id: 't', trackId: 'e1', kind: 'effect', label: 'London', start: 0, duration: 60, trimStart: 0, effect });
  const open = (effect: unknown) => parseProjectFile(serializeProjectFile(proj({ clips: [proj().clips[0], tag(effect) as never] }), 'x'));
  it('keeps a valid city tag (trimmed) and drops junk', () => {
    const ok = open({ type: 'city-card', city: '  London ' });
    expect(ok.ok && ok.project.clips[1].effect).toEqual({ type: 'city-card', city: 'London' });
    const junk = open({ type: 'city-card', city: 5 });
    expect(junk.ok && junk.project.clips.filter(c => c.kind === 'effect')).toHaveLength(0);
  });
});

describe('still picture clips in files', () => {
  const still = (s: unknown) => ({ ...proj().clips[0], src: 'https://cdn.example/a.png', still: s });
  const open = (s: unknown) => parseProjectFile(serializeProjectFile(proj({ clips: [still(s) as never] }), 'x'));
  it('keeps a known drift, and turns anything else back into a plain clip', () => {
    const ok = open({ motion: 'left', extra: 'x' }); expect(ok.ok && ok.project.clips[0].still).toEqual({ motion: 'left' });
    for (const bad of [{ motion: 'spin' }, 'nope', null, {}]) { const r = open(bad); expect(r.ok && 'still' in r.project.clips[0], JSON.stringify(bad)).toBe(false); }
  });
});

describe('malformed clips in files', () => {
  const base = proj().clips[0];
  const open = (c: unknown) => parseProjectFile(serializeProjectFile(proj({ clips: [base, c as never] }), 'x'));
  it('drops clips with a bad kind, track, start, length or trim, and keeps the good one', () => {
    for (const bad of [{ ...base, id: 'k', kind: 'banana' }, { ...base, id: 't', trackId: 'ghost' }, { ...base, id: 's', start: -5 }, { ...base, id: 'd', duration: 0 }, { ...base, id: 'n', duration: -10 }, { ...base, id: 'h', start: 1e12 }, { ...base, id: 'x', trimStart: -1 }, { ...base, id: 'y', trimStart: 1e12 }, { ...base, id: 'f', duration: 'long' }, null, 5]) {
      const r = open(bad); expect(r.ok && r.project.clips.map(c => c.id), JSON.stringify(bad)).toEqual(['a']);
    }
    const good = open({ ...base, id: 'g', start: 90 }); expect(good.ok && good.project.clips).toHaveLength(2);
  });
});
