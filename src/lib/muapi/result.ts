/**
 * Tolerant reading of muapi prediction results.
 * Confirmed real shape (live test): `{ status: 'completed', outputs: ['https://cdn.muapi.ai/...'], error: '' }`.
 * Other models/gateways nest output differently, so this follows open-genjutsu's lookup order as a safety net.
 */

export type NormalizedStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

const OK = new Set(['completed', 'succeeded', 'success', 'done']);
const FAIL = new Set(['failed', 'error']);
const CANCEL = new Set(['cancelled', 'canceled']);
const QUEUED = new Set(['queued', 'pending', 'created', 'submitted']);

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

export function normalizeStatus(p: unknown): NormalizedStatus {
  if (!isObj(p)) return 'processing';
  const candidates = [p.status, p.task_status, isObj(p.prediction) ? p.prediction.status : undefined, isObj(p.data) ? p.data.status : undefined, isObj(p.output) ? p.output.status : undefined, isObj(p.output_data) ? p.output_data.status : undefined];
  for (const c of candidates) {
    if (typeof c !== 'string' || !c.trim()) continue;
    const s = c.trim().toLowerCase();
    if (OK.has(s)) return 'completed';
    if (FAIL.has(s)) return 'failed';
    if (CANCEL.has(s)) return 'cancelled';
    if (QUEUED.has(s)) return 'queued';
    return 'processing';
  }
  return 'processing';
}

/** https only, with a host and no embedded credentials. */
export function isSafeMediaUrl(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  try {
    const u = new URL(s);
    return u.protocol === 'https:' && !!u.hostname && !u.username && !u.password;
  } catch { return false; }
}

const DIRECT_KEYS = ['video_url', 'video', 'image_url', 'image', 'audio_url', 'audio', 'output_url', 'url', 'outputs'] as const;
const NESTED_KEYS = ['output_data', 'output', 'result', 'data'] as const;

function find(v: unknown, depth = 0): string | undefined {
  if (depth > 5) return undefined;
  if (isSafeMediaUrl(v)) return v;
  if (Array.isArray(v)) { for (const x of v) { const f = find(x, depth + 1); if (f) return f; } return undefined; }
  if (!isObj(v)) return undefined;
  for (const k of DIRECT_KEYS) if (k in v) { const f = find(v[k], depth + 1); if (f) return f; }
  for (const k of NESTED_KEYS) if (k in v) { const f = find(v[k], depth + 1); if (f) return f; }
  return undefined;
}

/** First safe media URL in a prediction, or undefined. */
export function extractMediaUrl(prediction: unknown): string | undefined {
  return find(prediction);
}

/** Error text from a failed prediction, whatever shape it came in. */
export function extractError(p: unknown): string {
  if (!isObj(p)) return '';
  for (const c of [p.error, isObj(p.output) ? p.output.error : undefined, isObj(p.data) ? p.data.error : undefined, p.message, p.detail]) {
    if (typeof c === 'string' && c.trim()) return c.trim();
    if (isObj(c) && typeof c.message === 'string') return c.message;
  }
  return '';
}
