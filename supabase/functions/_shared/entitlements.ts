// Which paid models need which purchase. The gateway enforces this server-side, so it cannot be bypassed from the browser.
// A user needs ANY ONE of the listed keys. Models not listed are open to everyone with credits.
// Cities and shows are prompt text, not metered models, so they are gated in the UI only (cosmetic: they cost us nothing).

export const ENTITLEMENT_NAMES: Record<string, string> = {
  pro_pack: 'Pro Pack',
  recast: 'Recast',
  happiness: 'Happiness show',
  commercial: 'Commercial licence',
};

const RULES: Array<{ match: (slug: string) => boolean; needs: string[] }> = [
  // talking-head lip-sync (Cuts, Cast voices): Pro Pack. sync-lipsync also serves the Recast voice stage.
  { match: s => s === 'omnihuman-2-0' || s.startsWith('kling-v2-avatar'), needs: ['pro_pack'] },
  { match: s => s === 'sync-lipsync', needs: ['pro_pack', 'recast'] },
  { match: s => s.startsWith('elevenlabs-tts') || s.startsWith('minimax-speech') || s.startsWith('minimax-voice'), needs: ['pro_pack', 'recast'] },
  // Recast pipeline
  { match: s => ['depth-anything', 'gemini-video-vision', 'nano-banana-2-edit', 'seedance-2.5-omni-reference', 'wan3.0-reference-to-video'].includes(s), needs: ['recast'] },
  { match: s => ['veed-lipsync', 'creatify-lipsync', 'volcengine-video-to-video-lip-sync'].includes(s), needs: ['recast'] },
];

export function requiredEntitlements(slug: string): string[] | null {
  for (const r of RULES) if (r.match(slug)) return r.needs;
  return null;
}

export function hasAccess(slug: string, owned: readonly string[]): { ok: true } | { ok: false; needs: string[] } {
  const needs = requiredEntitlements(slug);
  if (!needs || needs.some(k => owned.includes(k))) return { ok: true };
  return { ok: false, needs };
}
