import type { CaptionColors, CaptionStyle, FontKey, MotionEngine, PresetCategory } from './model';

/**
 * Caption presets. The six named in ai-video-captions (Hormozi, MrBeast, Karaoke, Minimal, Bounce, Classic) and the idea of a large library grouped
 * by use (as in Capite) are credited in NOTICE.md; the colours, fonts and motion settings below are this app's own, designed for the
 * in-browser Remotion renderer (not copied from their ASS style definitions).
 */
export interface CaptionPreset {
  id: string; label: string; category: PresetCategory; note: string;
  style: Omit<CaptionStyle, 'presetId' | 'language' | 'positionY' | 'maxWords'> & { positionY?: number; maxWords?: number };
}

const c = (text: string, highlight: string, outline = '#000000', box = highlight): CaptionColors => ({ text, highlight, outline, box });
function preset(id: string, label: string, category: PresetCategory, note: string, engine: MotionEngine, font: FontKey, weight: number, size: number, uppercase: boolean, colors: CaptionColors, outlineWidth: number, extra: { weightTo?: number; maxWords?: number; positionY?: number } = {}): CaptionPreset {
  return { id, label, category, note, style: { engine, font, weight, size, uppercase, colors, outlineWidth, ...extra } };
}

export const CAPTION_PRESETS: CaptionPreset[] = [
  // ---- Trending
  preset('hormozi', 'Hormozi', 'Trending', 'Big bold words, the spoken word in yellow. Business and advice clips.', 'word_highlight', 'anton', 400, 92, true, c('#ffffff', '#ffd21f'), 7, { maxWords: 3 }),
  preset('mrbeast', 'MrBeast', 'Trending', 'Loud yellow with an orange pop. Challenges and big reveals.', 'pop_spring', 'lilita', 400, 94, true, c('#ffe45c', '#ff7a00'), 8, { maxWords: 3 }),
  preset('karaoke', 'Karaoke', 'Trending', 'Colour wipes across each word like a sing-along.', 'karaoke_fill', 'montserrat', 900, 80, true, c('#ffffff', '#35e0ff'), 6, { maxWords: 4 }),
  preset('bounce', 'Bounce', 'Trending', 'The active word bounces. Playful, upbeat clips.', 'elastic_bounce', 'poppins', 800, 82, false, c('#ffffff', '#ff4fa3'), 6, { maxWords: 3 }),
  preset('viral_green', 'Viral Green', 'Trending', 'White text, lime highlight. Tips and how-tos.', 'word_highlight', 'montserrat', 900, 84, true, c('#ffffff', '#9dff1a'), 7, { maxWords: 3 }),
  preset('hot_pink', 'Hot Pink', 'Trending', 'Pink highlight box behind the word.', 'accent_box', 'poppins', 800, 80, true, c('#ffffff', '#ff2d87', '#000000', '#ff2d87'), 0, { maxWords: 3 }),
  preset('cyan_pop', 'Cyan Pop', 'Trending', 'Each word springs in with a cyan accent.', 'pop_spring', 'archivoblack', 400, 84, true, c('#ffffff', '#22d3ee'), 7, { maxWords: 3 }),
  preset('gold_rush', 'Gold Rush', 'Trending', 'Gold wipe on white. Money and success.', 'karaoke_fill', 'bebas', 400, 100, true, c('#ffffff', '#ffc933'), 6, { maxWords: 4 }),
  preset('red_alert', 'Red Alert', 'Trending', 'White on black outline with a red highlight. News and warnings.', 'word_highlight', 'anton', 400, 90, true, c('#ffffff', '#ff3b30'), 7, { maxWords: 3 }),
  preset('big_zoom', 'Big Zoom', 'Trending', 'The active word eases bigger. Punchy statements.', 'smooth_zoom', 'anton', 400, 88, true, c('#ffffff', '#ffd21f'), 7, { maxWords: 3 }),

  // ---- Clean & Tech
  preset('minimal', 'Minimal', 'Clean & Tech', 'Small, calm, white with a soft highlight. Interviews.', 'word_highlight', 'inter', 600, 56, false, c('#ffffff', '#c7d2fe'), 3, { maxWords: 6 }),
  preset('classic', 'Classic', 'Clean & Tech', 'Plain white subtitles with a dark outline. Everything.', 'word_highlight', 'inter', 700, 60, false, c('#ffffff', '#ffffff'), 5, { maxWords: 7 }),
  preset('code_terminal', 'Code Terminal', 'Clean & Tech', 'Matrix-green monospace. Tech tutorials.', 'word_highlight', 'firacode', 700, 58, false, c('#d1fae5', '#22ff88', '#022c22'), 4, { maxWords: 5 }),
  preset('clean_box', 'Clean Box', 'Clean & Tech', 'A white box follows the word with dark text.', 'accent_box', 'inter', 800, 62, false, c('#ffffff', '#0f172a', '#000000', '#ffffff'), 0, { maxWords: 5 }),
  preset('slate_glow', 'Slate Glow', 'Clean & Tech', 'A cool glow on the active word.', 'neon_glow', 'inter', 700, 62, false, c('#e2e8f0', '#60a5fa', '#0b1220'), 3, { maxWords: 5 }),
  preset('tech_zoom', 'Tech Zoom', 'Clean & Tech', 'Subtle zoom on the active word.', 'smooth_zoom', 'poppins', 700, 62, false, c('#ffffff', '#38bdf8'), 4, { maxWords: 5 }),
  preset('paper', 'Paper', 'Clean & Tech', 'Dark text on a light box. Light backgrounds.', 'accent_box', 'montserrat', 800, 58, false, c('#111111', '#facc15', '#ffffff', '#ffffff'), 0, { maxWords: 5 }),
  preset('mono_fill', 'Mono Fill', 'Clean & Tech', 'Understated wipe in grey-blue.', 'karaoke_fill', 'inter', 700, 60, false, c('#cbd5e1', '#ffffff', '#0b1220'), 4, { maxWords: 6 }),

  // ---- Editorial & Film
  preset('film_serif', 'Film Serif', 'Editorial & Film', 'Elegant serif, warm highlight. Stories and documentaries.', 'word_highlight', 'playfair', 700, 62, false, c('#f8f3e8', '#f5c26b', '#1b1308'), 4, { maxWords: 6 }),
  preset('cinema', 'Cinema', 'Editorial & Film', 'Light-to-bold weight on the active word.', 'word_highlight', 'montserrat', 300, 60, false, c('#f1f5f9', '#ffffff', '#000000'), 4, { weightTo: 900, maxWords: 6 }),
  preset('noir', 'Noir', 'Editorial & Film', 'Black and white, serif, quiet.', 'smooth_zoom', 'playfair', 700, 60, false, c('#ffffff', '#d4d4d8', '#000000'), 5, { maxWords: 6 }),
  preset('amber_glow', 'Amber Glow', 'Editorial & Film', 'Warm glow, golden hour feel.', 'neon_glow', 'playfair', 700, 62, false, c('#fff7ed', '#fb923c', '#1c0f05'), 3, { maxWords: 5 }),
  preset('title_card', 'Title Card', 'Editorial & Film', 'Spaced capitals, thin to heavy.', 'word_highlight', 'oswald', 300, 70, true, c('#ffffff', '#ffffff', '#000000'), 4, { weightTo: 700, maxWords: 4 }),
  preset('documentary', 'Documentary', 'Editorial & Film', 'Small, lower, neutral. Interviews and talks.', 'word_highlight', 'inter', 500, 52, false, c('#f8fafc', '#fde68a', '#000000'), 3, { maxWords: 7, positionY: 12 }),
  preset('vintage', 'Vintage', 'Editorial & Film', 'Cream text with a rust wipe.', 'karaoke_fill', 'playfair', 700, 62, false, c('#fff1d6', '#e07a3f', '#2b1408'), 4, { maxWords: 5 }),

  // ---- Pop & Expressive
  preset('neon_pink', 'Neon Pink', 'Pop & Expressive', 'Hot pink glow. Nightlife and music.', 'neon_glow', 'bebas', 400, 98, true, c('#ffffff', '#ff4fd8', '#2a0630'), 5, { maxWords: 3 }),
  preset('neon_blue', 'Neon Blue', 'Pop & Expressive', 'Electric blue glow.', 'neon_glow', 'bebas', 400, 98, true, c('#ffffff', '#4dc3ff', '#04152a'), 5, { maxWords: 3 }),
  preset('comic', 'Comic', 'Pop & Expressive', 'Comic lettering that bounces. Humour.', 'elastic_bounce', 'bangers', 400, 92, true, c('#ffffff', '#ffe600'), 8, { maxWords: 3 }),
  preset('marker', 'Marker', 'Pop & Expressive', 'Hand-drawn marker with a pop-in.', 'pop_spring', 'marker', 400, 78, false, c('#ffffff', '#ff6b6b'), 6, { maxWords: 3 }),
  preset('candy', 'Candy', 'Pop & Expressive', 'Pastel box behind the word.', 'accent_box', 'lilita', 400, 84, false, c('#ffffff', '#ff8fcf', '#5b1241', '#ff8fcf'), 0, { maxWords: 3 }),
  preset('sunset', 'Sunset', 'Pop & Expressive', 'Orange wipe on cream.', 'karaoke_fill', 'poppins', 800, 80, true, c('#fff7ed', '#ff8a3d'), 6, { maxWords: 4 }),
  preset('electric', 'Electric', 'Pop & Expressive', 'Violet highlight with a zoom.', 'smooth_zoom', 'archivoblack', 400, 84, true, c('#ffffff', '#a78bfa'), 7, { maxWords: 3 }),
  preset('confetti', 'Confetti', 'Pop & Expressive', 'Bouncy and bright. Celebrations.', 'elastic_bounce', 'lilita', 400, 90, true, c('#ffffff', '#22d3a6'), 7, { maxWords: 3 }),
];

export const DEFAULT_PRESET_ID = 'hormozi';
export const PRESET_CATEGORIES: PresetCategory[] = ['Trending', 'Clean & Tech', 'Editorial & Film', 'Pop & Expressive'];
export const presetOf = (id: string): CaptionPreset => CAPTION_PRESETS.find(p => p.id === id) ?? CAPTION_PRESETS.find(p => p.id === DEFAULT_PRESET_ID)!;

/** A full style from a preset, with the customer's language and any overrides. */
export function styleFromPreset(id: string, over: Partial<CaptionStyle> = {}): CaptionStyle {
  const p = presetOf(id);
  return { positionY: 18, maxWords: 4, language: 'auto', ...p.style, presetId: p.id, ...over };
}

export const DEFAULT_CAPTION_STYLE: CaptionStyle = styleFromPreset(DEFAULT_PRESET_ID);

/** True when the style still equals its preset (so the UI can show "customised"). */
export function isCustomised(s: CaptionStyle): boolean {
  const base = styleFromPreset(s.presetId, { language: s.language });
  return JSON.stringify({ ...base, positionY: s.positionY }) !== JSON.stringify(s);
}
