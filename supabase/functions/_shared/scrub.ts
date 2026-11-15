// What a customer may see of anything muapi says. The operator's muapi account state, prices in USD and our margin must never leak.

const SECRET_KEYS = /(cost|price|pricing|balance|credit|usd|billing|amount|invoice|api[_-]?key|token|secret)/i;
const MAX_STRING = 2000;

/** Recursively drops money-, account- and key-like fields and caps string length. Never throws. */
export function scrub(value: unknown, depth = 0): unknown {
  if (depth > 8) return undefined;
  if (typeof value === 'string') return value.length > MAX_STRING ? value.slice(0, MAX_STRING) : value;
  if (Array.isArray(value)) return value.slice(0, 200).map(v => scrub(v, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === 'raw' || SECRET_KEYS.test(k)) continue;
      out[k] = scrub(v, depth + 1);
    }
    return out;
  }
  return value;
}

/** Fields of a prediction the app uses. Everything else is dropped. */
const PREDICTION_KEYS = ['id', 'request_id', 'status', 'outputs', 'output', 'text', 'error', 'message', 'detail'];
export function predictionView(json: unknown): unknown {
  const s = scrub(json);
  if (!s || typeof s !== 'object' || Array.isArray(s)) return {};
  const out: Record<string, unknown> = {};
  for (const k of PREDICTION_KEYS) if (k in (s as Record<string, unknown>)) out[k] = (s as Record<string, unknown>)[k];
  return out;
}

/** Upstream statuses that reveal OUR muapi account (bad key, no funds, forbidden) are reported as a generic outage. */
export const isOurAccountProblem = (status: number) => status === 401 || status === 402 || status === 403;
