// Stripe webhook signature check (Web Crypto only, so it runs in Deno and in tests).
// Header: "t=<unix>,v1=<hex hmac>[,v1=...]". Signed payload is `${t}.${rawBody}` with the endpoint secret.

const enc = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(payload)));
}

export type SigResult = { ok: true } | { ok: false; reason: 'missing' | 'malformed' | 'stale' | 'mismatch' };

/** `now` is unix seconds. The raw body must be exactly what Stripe sent (not re-serialised). */
export async function verifyStripeSignature(rawBody: string, header: string | null, secret: string, now: number, toleranceSeconds = 300): Promise<SigResult> {
  if (!secret || !header) return { ok: false, reason: 'missing' };
  let t = 0; const sigs: string[] = [];
  for (const part of header.split(',')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim(), v = part.slice(i + 1).trim();
    if (k === 't') t = Number(v);
    else if (k === 'v1') sigs.push(v);
  }
  if (!Number.isFinite(t) || t <= 0 || sigs.length === 0) return { ok: false, reason: 'malformed' };
  if (Math.abs(now - t) > toleranceSeconds) return { ok: false, reason: 'stale' };
  const expected = await hmacHex(secret, `${t}.${rawBody}`);
  return sigs.some(s => safeEqual(s, expected)) ? { ok: true } : { ok: false, reason: 'mismatch' };
}
