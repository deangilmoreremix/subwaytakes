/** Models, limits and cost maths for Recast. All pure. */

export type RecastModel = 'wan' | 'seedance';
export type RecastMode = 'motion_transfer' | 'object_swap';

export interface RecastModelDef {
  id: RecastModel; slug: string; label: string; tag: 'Lite' | 'Best';
  maxImages: number;
  /** Wan: depth video + output must be <= this many seconds */
  maxTotalSeconds?: number; minOutputSeconds: number; maxOutputSeconds: number;
  /** render price per output second (USD). Measured live for Wan (6s = $1.10); Seedance from muapi's default (5s = $1.70). Real numbers come from estimate-cost. */
  approxRenderPerSec: number;
}

export const RECAST_MODELS: Record<RecastModel, RecastModelDef> = {
  wan: { id: 'wan', slug: 'wan3.0-reference-to-video', label: 'Wan 3.0', tag: 'Lite', maxImages: 10, maxTotalSeconds: 30, minOutputSeconds: 2, maxOutputSeconds: 30, approxRenderPerSec: 1.1 / 6 },
  seedance: { id: 'seedance', slug: 'seedance-2.5-omni-reference', label: 'Seedance 2.5', tag: 'Best', maxImages: 30, minOutputSeconds: 4, maxOutputSeconds: 30, approxRenderPerSec: 1.7 / 5 },
};

export const SOURCE_LIMITS = { minSeconds: 4, maxSeconds: 15, maxBytes: 50 * 1024 * 1024 } as const;
export const REF_LIMITS = { min: 1, max: 8, maxBytes: 10 * 1024 * 1024, types: ['image/jpeg', 'image/png', 'image/webp'] } as const;
export const MAX_PLATES = 4;

/** Pure: why a source clip can't be used, or null. */
export function validateSource(durationSec: number, bytes: number, type: string): string | null {
  if (!/^video\/(mp4|quicktime)$/.test(type) && type !== 'application/octet-stream') return 'Use an MP4 or MOV video.';
  if (bytes > SOURCE_LIMITS.maxBytes) return `That video is ${(bytes / 1048576).toFixed(0)} MB. The limit is 50 MB.`;
  if (!Number.isFinite(durationSec) || durationSec <= 0) return 'Could not read the video length.';
  if (durationSec < SOURCE_LIMITS.minSeconds) return `The clip is ${durationSec.toFixed(1)}s. It must be at least ${SOURCE_LIMITS.minSeconds}s.`;
  if (durationSec > SOURCE_LIMITS.maxSeconds) return `The clip is ${durationSec.toFixed(1)}s. It must be ${SOURCE_LIMITS.maxSeconds}s or shorter. Trim it in the timeline first.`;
  return null;
}

/** Pure: reference images check. `files` are the user's uploads; Cast portraits are already hosted so only count. */
export function validateRefs(count: number, files: Array<{ size: number; type: string }> = []): string | null {
  if (count < REF_LIMITS.min) return 'Add at least one performer reference (a Cast portrait or an uploaded photo).';
  if (count > REF_LIMITS.max) return `Use at most ${REF_LIMITS.max} references (you have ${count}).`;
  for (const f of files) {
    if (!(REF_LIMITS.types as readonly string[]).includes(f.type)) return 'References must be JPEG, PNG or WebP images.';
    if (f.size > REF_LIMITS.maxBytes) return `A reference is ${(f.size / 1048576).toFixed(1)} MB. The limit is 10 MB each.`;
  }
  return null;
}

/** How many environment plates fit next to the character sheets. Returns plates and an error if even the sheets don't fit. */
export function imageBudget(model: RecastModel, sheets: number, wantedPlates: number): { plates: number; error: string | null } {
  const limit = RECAST_MODELS[model].maxImages;
  if (sheets > limit) return { plates: 0, error: `${RECAST_MODELS[model].label} accepts at most ${limit} images but there are ${sheets} references.` };
  return { plates: Math.max(0, Math.min(MAX_PLATES, wantedPlates, limit - sheets)), error: null };
}

/**
 * Output length in whole seconds: the source length, allowing up to 0.25s of the tail to be cut (a 5.02s clip renders 5s,
 * not 6s, which would cost 20% more). Clamped to the model's range; Wan also needs depth + output <= 30s.
 */
export function outputSeconds(model: RecastModel, sourceSec: number): { seconds: number; error: string | null } {
  const def = RECAST_MODELS[model];
  const seconds = Math.min(def.maxOutputSeconds, Math.max(def.minOutputSeconds, Math.ceil(sourceSec - 0.25)));
  if (def.maxTotalSeconds && sourceSec + seconds > def.maxTotalSeconds) return { seconds, error: `${def.label} needs the source plus the output to fit in ${def.maxTotalSeconds}s (${sourceSec.toFixed(1)}s + ${seconds}s is too long). Use a shorter clip.` };
  return { seconds, error: null };
}

export interface CostParts { depth: number; vision: number; plate: number; sheet: number; writer: number; render: number }
export const APPROX_COSTS: Omit<CostParts, 'render'> = { depth: 0.2, vision: 0.004, plate: 0.06, sheet: 0.09, writer: 0.0001 };

/** Pure: total USD for a plan. `parts` may be overridden with live estimates. */
export function estimateRecast(model: RecastModel, refs: number, plates: number, parts: Partial<CostParts> = {}, seconds = 5): { total: number; lines: Array<[string, number]> } {
  const c = { ...APPROX_COSTS, render: RECAST_MODELS[model].approxRenderPerSec * seconds, ...parts };
  const lines: Array<[string, number]> = [
    ['Depth map', c.depth], ['Scene analysis', c.vision], [`Clean backgrounds ×${plates}`, c.plate * plates],
    [`Character sheets ×${refs}`, c.sheet * refs], ['Prompt writer', c.writer], [`Render (${RECAST_MODELS[model].label})`, c.render],
  ];
  return { total: Math.round(lines.reduce((n, [, v]) => n + v, 0) * 10000) / 10000, lines };
}
