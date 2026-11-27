import type { StoredTitle } from '../shows/stored';

/** A customer's look: logo, colours, channel handle, sponsor line. Saved to their account; a snapshot is copied into each project so exports are self-contained. */
export interface BrandKit { handle: string; primaryColor: string; accentColor: string; logoUrl: string | null; sponsorText: string; showWatermark: boolean }
/** What a project carries (and what the renderer reads). */
export interface BrandSnapshot { handle: string; primary: string; accent: string; logoUrl: string | null; sponsor: string; watermark: boolean }

export const DEFAULT_BRAND_KIT: BrandKit = { handle: '', primaryColor: '#ffb000', accentColor: '#ffffff', logoUrl: null, sponsorText: '', showWatermark: true };
export const WATERMARK_TEXT = 'Made with SubwayTakes Studio';
/** Drawn small in the corner of exports unless the customer turns it off: the video is made with AI, and many platforms ask for that to be said. */
export const AI_LABEL_TEXT = 'AI-generated';
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

const HEX = /^#[0-9a-fA-F]{6}$/;
const HANDLE = /^@?[A-Za-z0-9._]{0,30}$/;

/** Same rules as the database, so people see the problem before saving. */
export function validateBrand(k: BrandKit): string[] {
  const e: string[] = [];
  if (!HANDLE.test(k.handle)) e.push('The handle can use letters, numbers, dots and underscores (30 characters).');
  if (!HEX.test(k.primaryColor) || !HEX.test(k.accentColor)) e.push('Colours must look like #ffb000.');
  if (k.sponsorText.length > 80) e.push('The sponsor line is 80 characters at most.');
  if (k.logoUrl !== null && !/^https:\/\//.test(k.logoUrl)) e.push('The logo must be hosted over https.');
  return e;
}

/** Logos are PNG, JPEG or WebP under 2 MB. SVG is refused: the exporter draws pictures, not documents. */
export function logoProblem(f: { type: string; size: number }): string | null {
  if (!LOGO_TYPES.includes(f.type)) return 'Use a PNG, JPEG or WebP image.';
  if (f.size > LOGO_MAX_BYTES) return 'The logo must be under 2 MB.';
  return null;
}

export const displayHandle = (h: string): string => { const t = h.trim(); return t ? (t.startsWith('@') ? t : `@${t}`) : ''; };

/** Black or white, whichever reads better on this colour. */
export function readableText(hex: string): '#111111' | '#ffffff' {
  if (!HEX.test(hex)) return '#111111';
  const n = parseInt(hex.slice(1), 16); const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 140 ? '#111111' : '#ffffff';
}

/**
 * The brand a project should carry. Without the licence (or without a kit) nothing is applied and exports keep the small studio mark.
 * This is a display rule: exports are made in the browser, so it cannot be a hard paywall.
 */
export function snapshotBrand(kit: BrandKit | null, entitled: boolean): BrandSnapshot | undefined {
  if (!kit || !entitled) return undefined;
  return { handle: displayHandle(kit.handle), primary: kit.primaryColor, accent: kit.accentColor, logoUrl: kit.logoUrl, sponsor: kit.sponsorText.trim(), watermark: kit.showWatermark };
}

/** The badge and number graphics take the brand's main colour. */
export function applyBrandToTitle(title: StoredTitle, b?: BrandSnapshot): StoredTitle {
  if (!b || !HEX.test(b.primary)) return title;
  return { ...title, data: { ...title.data, badgeBg: b.primary, badgeFg: readableText(b.primary) } };
}

export function sameBrand(a: BrandSnapshot | undefined, b: BrandSnapshot | undefined): boolean { return JSON.stringify(a ?? null) === JSON.stringify(b ?? null); }

