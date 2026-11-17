import { describe, expect, it } from 'vitest';
import { LEGAL_DOCS, LEGAL_DRAFT_NOTICE, legalDoc } from './documents';
import { CITIES } from '../places';

describe('legal drafts', () => {
  it('has the four pages with unique slugs, titles, summaries and real sections', () => {
    expect(LEGAL_DOCS.map(d => d.slug).sort()).toEqual(['ai-policy', 'privacy', 'refunds', 'terms']);
    for (const d of LEGAL_DOCS) { expect(d.title.length).toBeGreaterThan(5); expect(d.summary.length).toBeGreaterThan(20); expect(d.sections.length).toBeGreaterThanOrEqual(4); for (const s of d.sections) { expect(s.heading).toBeTruthy(); expect(s.body.join(' ').length).toBeGreaterThan(30); } }
  });
  it('says plainly that it is a draft needing review, and marks every decision that only the operator can make', () => {
    expect(LEGAL_DRAFT_NOTICE).toMatch(/not been reviewed by a lawyer/);
    for (const d of LEGAL_DOCS) expect(JSON.stringify(d.sections), d.slug).toMatch(/\[[^\]]+\]/);
  });
  it('describes the behaviours the product actually has', () => {
    const all = JSON.stringify(LEGAL_DOCS);
    expect(all).toMatch(/returned to your balance automatically/); expect(all).toMatch(/one US cent/); expect(all).toMatch(/AI-generated/); expect(all).toMatch(/Stripe/); expect(all).toMatch(/14 days/); expect(all).toMatch(/referr/i);
  });
  it('makes no promises the product does not keep (no free credits, no guaranteed results)', () => {
    const all = JSON.stringify(LEGAL_DOCS);
    expect(all).not.toMatch(/free credits|free trial|guarantee[sd]? (?:results|quality)/i); expect(all).toMatch(/not guaranteed|cannot promise/i);
  });
  it('looks pages up by slug', () => { expect(legalDoc('terms')?.title).toBe('Terms of Service'); expect(legalDoc('nope')).toBeUndefined(); expect(CITIES.length).toBeGreaterThan(20); });
});
