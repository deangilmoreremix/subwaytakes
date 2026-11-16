import { describe, expect, it } from 'vitest';
import { DEFAULT_BRAND_KIT, applyBrandToTitle, displayHandle, logoProblem, readableText, sameBrand, snapshotBrand, validateBrand, WATERMARK_TEXT } from './model';
import type { StoredTitle } from '../shows/stored';

const title: StoredTitle = { data: { variant: 'take', badge: 'HOT TAKE', badgeBg: '#ffd21f', badgeFg: '#111', headline: 'x' } };

describe('brand kit validation', () => {
  it('accepts the defaults and a typical kit', () => {
    expect(validateBrand(DEFAULT_BRAND_KIT)).toEqual([]);
    expect(validateBrand({ ...DEFAULT_BRAND_KIT, handle: '@subway.takes_1', sponsorText: 'Brought to you by Acme', logoUrl: 'https://x.example/l.png' })).toEqual([]);
  });
  it('rejects what the database would reject, with a reason', () => {
    expect(validateBrand({ ...DEFAULT_BRAND_KIT, handle: '<script>' })[0]).toMatch(/handle/);
    expect(validateBrand({ ...DEFAULT_BRAND_KIT, handle: 'a'.repeat(32) })[0]).toMatch(/handle/);
    expect(validateBrand({ ...DEFAULT_BRAND_KIT, primaryColor: 'red' })[0]).toMatch(/Colours/);
    expect(validateBrand({ ...DEFAULT_BRAND_KIT, accentColor: '#fff' })[0]).toMatch(/Colours/);
    expect(validateBrand({ ...DEFAULT_BRAND_KIT, sponsorText: 's'.repeat(81) })[0]).toMatch(/80/);
    expect(validateBrand({ ...DEFAULT_BRAND_KIT, logoUrl: 'http://x.example/l.png' })[0]).toMatch(/https/);
  });
});

describe('logo rules', () => {
  it('allows png, jpeg and webp under 2 MB and refuses everything else (SVG included)', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp']) expect(logoProblem({ type, size: 1000 })).toBeNull();
    for (const type of ['image/svg+xml', 'image/gif', 'text/html', 'application/pdf', '']) expect(logoProblem({ type, size: 1000 }), type).not.toBeNull();
    expect(logoProblem({ type: 'image/png', size: 2 * 1024 * 1024 + 1 })).toMatch(/2 MB/);
  });
});

describe('snapshot and rendering helpers', () => {
  const kit = { ...DEFAULT_BRAND_KIT, handle: 'subwaytakes', primaryColor: '#112233', sponsorText: ' Acme ', showWatermark: false };
  it('applies a brand only with the licence and a saved kit (a display rule)', () => {
    expect(snapshotBrand(null, true)).toBeUndefined();
    expect(snapshotBrand(kit, false)).toBeUndefined();
    expect(snapshotBrand(kit, true)).toEqual({ handle: '@subwaytakes', primary: '#112233', accent: '#ffffff', logoUrl: null, sponsor: 'Acme', watermark: false });
  });
  it('shows the handle with exactly one @', () => { expect(displayHandle('  me ')).toBe('@me'); expect(displayHandle('@me')).toBe('@me'); expect(displayHandle('')).toBe(''); });
  it('picks readable badge text for any colour', () => {
    expect(readableText('#ffffff')).toBe('#111111'); expect(readableText('#ffd21f')).toBe('#111111'); expect(readableText('#101828')).toBe('#ffffff'); expect(readableText('nonsense')).toBe('#111111');
  });
  it('recolours the badge but leaves the headline alone, and does nothing without a brand', () => {
    const b = snapshotBrand(kit, true);
    const out = applyBrandToTitle(title, b);
    expect(out.data.badgeBg).toBe('#112233'); expect(out.data.badgeFg).toBe('#ffffff'); expect(out.data.headline).toBe('x');
    expect(applyBrandToTitle(title, undefined)).toBe(title);
  });
  it('compares snapshots by value', () => {
    expect(sameBrand(undefined, undefined)).toBe(true); expect(sameBrand(snapshotBrand(kit, true), snapshotBrand({ ...kit }, true))).toBe(true);
    expect(sameBrand(snapshotBrand(kit, true), undefined)).toBe(false);
  });
  it('the studio mark text is fixed', () => { expect(WATERMARK_TEXT).toBe('Made with SubwayTakes Studio'); });
});
