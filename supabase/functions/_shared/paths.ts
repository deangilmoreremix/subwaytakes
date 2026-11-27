// Which muapi paths a customer may reach through the gateway, and what each one means.

export type PathKind =
  | { kind: 'poll'; requestId: string }
  | { kind: 'estimate'; slug: string }
  | { kind: 'meta'; slug: string }
  | { kind: 'submit'; slug: string }
  | { kind: 'denied' };

// Lowercase only, and it must start with a letter or digit: '.', '..', '-x' and case variants are not model names.
const SLUG = '[a-z0-9][a-z0-9._-]*';
const POLL = new RegExp(`^/api/v1/predictions/([\\w-]+)/result$`);
const ESTIMATE = new RegExp(`^/api/v1/models/(${SLUG})/estimate-cost$`);
const META = new RegExp(`^/api/v1/models/(${SLUG})$`);
const SUBMIT = new RegExp(`^/api/v1/(${SLUG})$`);

// Endpoints under /api/v1/<name> that are NOT model submissions and must never be reachable (account data, uploads, key info).
const NOT_MODELS = new Set(['account', 'upload_file', 'get_upload_url', 'models', 'predictions', 'balance', 'keys', 'api_keys', 'webhooks', 'usage']);

export function classify(method: string, path: string): PathKind {
  if (typeof path !== 'string' || !path.startsWith('/') || path.includes('..') || path.includes('//') || path.includes('?') || path.includes('#')) return { kind: 'denied' };
  let m = POLL.exec(path);
  if (m) return method === 'GET' ? { kind: 'poll', requestId: m[1] } : { kind: 'denied' };
  m = ESTIMATE.exec(path);
  if (m) return method === 'POST' ? { kind: 'estimate', slug: m[1] } : { kind: 'denied' };
  m = META.exec(path);
  if (m) return method === 'GET' ? { kind: 'meta', slug: m[1] } : { kind: 'denied' };
  m = SUBMIT.exec(path);
  if (m && method === 'POST' && !NOT_MODELS.has(m[1])) return { kind: 'submit', slug: m[1] };
  return { kind: 'denied' };
}
