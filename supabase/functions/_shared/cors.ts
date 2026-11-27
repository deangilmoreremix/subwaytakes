// CORS for the browser-facing functions. Pure (no Deno APIs) so it is unit tested.
// A request's Origin is echoed back ONLY when it is on the allow list; the wildcard is never sent. Anything else gets no CORS headers at all,
// so a stranger's web page cannot read an answer even if it somehow holds a token.

export const DEFAULT_ORIGINS = ["https://subwaytakes.netlify.app"];
const PREVIEW = /^https:\/\/deploy-preview-\d{1,6}--subwaytakes\.netlify\.app$/;
const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1):(5173|5174)$/;

/** Split an ALLOWED_ORIGINS value ("https://a.com, https://b.com"), dropping blanks, wildcards and anything that is not a plain https origin. */
export function parseOrigins(raw: string | undefined | null): string[] {
  const list = (raw ?? "").split(",").map(s => s.trim().replace(/\/+$/, "")).filter(s => /^https:\/\/[a-z0-9.-]+(:\d{1,5})?$/i.test(s));
  return list.length ? list : DEFAULT_ORIGINS;
}

export function originAllowed(origin: string | null | undefined, allowed: readonly string[]): boolean {
  if (!origin || origin === "null") return false;
  return allowed.includes(origin) || PREVIEW.test(origin) || LOCAL.test(origin);
}

const BASE = {
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Muapi-Key",
  "Access-Control-Max-Age": "600",
  Vary: "Origin",
};

/** Headers for a response to a request from `origin`. Without an allowed origin only Vary is sent (no Access-Control-Allow-Origin). */
export function corsHeadersFor(origin: string | null | undefined, allowed: readonly string[]): Record<string, string> {
  return originAllowed(origin, allowed) ? { ...BASE, "Access-Control-Allow-Origin": origin as string } : { Vary: "Origin" };
}
