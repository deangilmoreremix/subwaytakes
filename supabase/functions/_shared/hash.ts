// A stable fingerprint of one request (model + body), so an idempotency key can only ever mean one request.

function stable(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return '{' + Object.keys(o).sort().map(k => JSON.stringify(k) + ':' + stable(o[k])).join(',') + '}';
  }
  return JSON.stringify(v ?? null);
}

export async function requestHash(slug: string, body: unknown): Promise<string> {
  const data = new TextEncoder().encode(slug + '\n' + stable(body));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}
