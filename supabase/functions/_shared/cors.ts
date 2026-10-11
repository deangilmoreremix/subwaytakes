
/**
 * Shared CORS + JSON response helpers for all edge functions.
 */

/** Error carrying an HTTP status so handlers can fail with the right code. */
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

const ALLOWED_METHODS = "POST, GET, OPTIONS";
const ALLOWED_HEADERS = "Content-Type, Authorization, X-Client-Info, Apikey";

/**
 * Build CORS headers for a request origin.
 *
 * ALLOWED_ORIGINS (comma-separated) is an explicit allowlist. When it is unset
 * we default to "*" for dev parity; when it is set we only reflect origins that
 * are on the list.
 */
export function buildCorsHeaders(origin: string | null): Record<string, string> {
  const configured = (Deno.env.get("ALLOWED_ORIGINS") || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const allowOrigin =
    configured.length === 0
      ? "*"
      : origin !== null && configured.includes(origin)
        ? origin
        : "";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": ALLOWED_METHODS,
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function corsHeadersForRequest(req: Request): Record<string, string> {
  return buildCorsHeaders(req.headers.get("Origin"));
}

export function jsonResponse(
  body: unknown,
  status = 200,
  cors?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...(cors ?? buildCorsHeaders(null)), "Content-Type": "application/json" },
  });
}

/**
 * Structured error response. HttpError instances keep their status and message
 * (upstream provider messages are surfaced through them intentionally); every
 * other error becomes a 500.
 */
export function errorResponse(error: unknown, cors?: Record<string, string>): Response {
  if (error instanceof HttpError) {
    return jsonResponse({ error: error.message }, error.status, cors);
  }
  const message = error instanceof Error && error.message
    ? error.message
    : "Internal server error";
  console.error("Unhandled error:", error);
  return jsonResponse({ error: message }, 500, cors);
}

export function handleOptions(req: Request): Response {
  return new Response(null, { status: 200, headers: corsHeadersForRequest(req) });
}
