import { describe, expect, it } from 'vitest';
import { DEFAULT_ORIGINS, corsHeadersFor, originAllowed, parseOrigins } from './cors';

const allowed = parseOrigins('https://studio.example.com/, https://b.example.com');
describe('cors', () => {
  it('echoes an allowed origin and never sends a wildcard', () => {
    const h = corsHeadersFor('https://studio.example.com', allowed);
    expect(h['Access-Control-Allow-Origin']).toBe('https://studio.example.com');
    expect(h.Vary).toBe('Origin'); expect(JSON.stringify(h)).not.toContain('"*"');
    expect(h['Access-Control-Allow-Headers']).toMatch(/X-Muapi-Key/);
  });
  it('gives a stranger no CORS headers at all', () => {
    for (const o of ['https://evil.example', 'null', '', undefined, null, 'http://studio.example.com', 'https://studio.example.com.evil.com', 'https://evilsubwaytakes.netlify.app', 'https://subwaytakes.netlify.app.evil.com']) {
      const h = corsHeadersFor(o as string, allowed);
      expect(h['Access-Control-Allow-Origin'], String(o)).toBeUndefined(); expect(h.Vary).toBe('Origin');
    }
  });
  it('allows Netlify deploy previews of this site, local dev, and the default site', () => {
    for (const o of ['https://deploy-preview-2--subwaytakes.netlify.app', 'http://localhost:5173', 'http://127.0.0.1:5174', 'https://subwaytakes.netlify.app']) expect(originAllowed(o, DEFAULT_ORIGINS), o).toBe(true);
    for (const o of ['https://deploy-preview-2--other.netlify.app', 'https://deploy-preview-x--subwaytakes.netlify.app', 'http://localhost:9999', 'https://localhost:5173']) expect(originAllowed(o, DEFAULT_ORIGINS), o).toBe(false);
  });
  it('parses the env list: trims, drops wildcards, http and junk, falls back to the default', () => {
    expect(parseOrigins('https://a.com/ , *, http://b.com, javascript:alert(1), https://c.com:8443')).toEqual(['https://a.com', 'https://c.com:8443']);
    expect(parseOrigins('')).toEqual(DEFAULT_ORIGINS); expect(parseOrigins(undefined)).toEqual(DEFAULT_ORIGINS); expect(parseOrigins('*')).toEqual(DEFAULT_ORIGINS);
  });
});
