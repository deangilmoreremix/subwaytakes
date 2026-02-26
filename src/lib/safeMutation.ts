const inflight = new Map<string, Promise<unknown>>();
const settled = new Map<string, { value: unknown; ts: number }>();

const SETTLED_TTL_MS = 10_000;

function pruneSettled() {
  const now = Date.now();
  for (const [k, v] of settled) {
    if (now - v.ts > SETTLED_TTL_MS) settled.delete(k);
  }
}

function isRetryableError(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  if (err instanceof DOMException && err.name === 'AbortError') return false;
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('timeout')) return true;
    if (msg.includes('rate limit') || msg.includes('too many requests')) return true;
    if (msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('504')) return true;
  }
  return false;
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export interface SafeMutationOptions<T> {
  key: string;
  fn: () => Promise<T>;
  maxRetries?: number;
  baseDelayMs?: number;
  shouldRetry?: (error: unknown) => boolean;
}

export async function safeMutate<T>(opts: SafeMutationOptions<T>): Promise<T> {
  pruneSettled();

  const cached = settled.get(opts.key);
  if (cached) return cached.value as T;

  const existing = inflight.get(opts.key);
  if (existing) return existing as Promise<T>;

  const maxRetries = opts.maxRetries ?? 2;
  const baseDelay = opts.baseDelayMs ?? 600;
  const shouldRetry = opts.shouldRetry ?? isRetryableError;

  const work = (async (): Promise<T> => {
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await opts.fn();
        settled.set(opts.key, { value: result, ts: Date.now() });
        return result;
      } catch (err) {
        lastError = err;
        if (attempt < maxRetries && shouldRetry(err)) {
          const jitter = Math.random() * 200;
          await sleep(baseDelay * 2 ** attempt + jitter);
          continue;
        }
        throw err;
      }
    }

    throw lastError;
  })();

  inflight.set(opts.key, work);

  try {
    return await work;
  } finally {
    inflight.delete(opts.key);
  }
}

let counter = 0;
export function mutationKey(prefix: string): string {
  return `${prefix}_${Date.now()}_${++counter}`;
}

export function clearSettledCache(keyPrefix?: string): void {
  if (!keyPrefix) {
    settled.clear();
    return;
  }
  for (const k of settled.keys()) {
    if (k.startsWith(keyPrefix)) settled.delete(k);
  }
}
