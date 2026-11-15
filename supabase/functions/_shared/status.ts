// Server copy of the status reading in src/lib/muapi/result.ts (functions cannot import from src/).
// A parity test (gateway.test.ts) runs both against the same cases so they cannot drift.

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

/** muapi reports a failed prediction as an HTTP error whose body is {detail:{status:'failed', ...}}. */
export function isFailedBody(json: unknown): boolean {
  if (!isObj(json)) return false;
  const d = json.detail;
  return normalizeStatus(isObj(d) ? d : json) === 'failed' || normalizeStatus(json) === 'failed';
}

/** muapi's request id from a submit answer. */
export function readRequestId(json: unknown): string | null {
  if (!isObj(json)) return null;
  for (const k of ['request_id', 'id']) { const v = json[k]; if (typeof v === 'string' && /^[\w-]{3,200}$/.test(v)) return v; }
  return null;
}
