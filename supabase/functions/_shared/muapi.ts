import { HttpError } from "./cors.ts";

/**
 * MuAPI client (https://api.muapi.ai/api/v1).
 *
 * All requests hang off an AbortController-based timeout and every fetch goes
 * through an injectable fetch implementation so tests can stub the provider.
 */

export const MUAPI_DEFAULT_BASE_URL = "https://api.muapi.ai/api/v1";

export type MuapiFetch = (url: string, init?: RequestInit) => Promise<Response>;

/** MuAPI failure. `upstreamStatus` is the HTTP status when one was received. */
export class MuapiError extends HttpError {
  readonly upstreamStatus?: number;

  constructor(message: string, status = 500, upstreamStatus?: number) {
    super(status, message);
    this.name = "MuapiError";
    this.upstreamStatus = upstreamStatus;
  }
}

/** True for network/timeout errors and 5xx/408/429 upstream responses. */
export function isRetryableMuapiError(error: unknown): boolean {
  if (error instanceof MuapiError) {
    if (error.upstreamStatus === undefined) return true;
    return (
      error.upstreamStatus >= 500 ||
      error.upstreamStatus === 408 ||
      error.upstreamStatus === 429
    );
  }
  return error instanceof TypeError;
}

export interface MuapiConfig {
  baseUrl: string;
  apiKey: string;
}

export function getMuapiConfig(): MuapiConfig {
  const apiKey = Deno.env.get("MUAPI_API_KEY");
  if (!apiKey) {
    throw new Error("MUAPI_API_KEY is not configured");
  }
  const baseUrl = Deno.env.get("MUAPI_BASE_URL") || MUAPI_DEFAULT_BASE_URL;
  return { apiKey, baseUrl: baseUrl.replace(/\/+$/, "") };
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  fetchImpl: MuapiFetch,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function describeNetworkError(error: unknown): string {
  if (error instanceof Error) {
    return error.name === "AbortError" ? "request timed out" : error.message;
  }
  return String(error);
}

async function readErrorBody(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  if (!text) return `HTTP ${response.status}`;
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed === "string") return parsed;
    if (parsed && typeof parsed === "object") {
      const record = parsed as Record<string, unknown>;
      const detail = record.error ?? record.message ?? record.detail;
      if (typeof detail === "string" && detail.length > 0) return detail;
    }
  } catch {
    /* not JSON — fall through to raw text */
  }
  return text.slice(0, 500);
}

export interface MuapiSubmitOptions {
  timeoutMs?: number;
  fetchImpl?: MuapiFetch;
}

/**
 * POST {base}/{endpoint} and return the MuAPI request_id.
 * Throws MuapiError (with the provider message) on any failure.
 */
export async function muapiSubmit(
  endpoint: string,
  payload: Record<string, unknown>,
  options: MuapiSubmitOptions = {},
): Promise<string> {
  const { baseUrl, apiKey } = getMuapiConfig();
  const fetchImpl = options.fetchImpl ?? (globalThis.fetch as MuapiFetch);
  const url = `${baseUrl}/${endpoint.replace(/^\/+/, "")}`;

  let response: Response;
  try {
    response = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
      options.timeoutMs ?? 30000,
      fetchImpl,
    );
  } catch (error) {
    throw new MuapiError(
      `MuAPI submit to ${endpoint} failed: ${describeNetworkError(error)}`,
    );
  }

  if (!response.ok) {
    const detail = await readErrorBody(response);
    throw new MuapiError(
      `MuAPI submit to ${endpoint} failed (${response.status}): ${detail}`,
      500,
      response.status,
    );
  }

  const data = await response.json().catch(() => null) as
    | { request_id?: unknown }
    | null;
  const requestId = typeof data?.request_id === "string" ? data.request_id : "";
  if (!requestId) {
    throw new MuapiError(
      `MuAPI submit to ${endpoint} returned no request_id`,
      502,
      response.status,
    );
  }
  return requestId;
}

export interface MuapiPollResult {
  id: string | null;
  /** queued | pending | processing | completed | failed | cancelled */
  status: string;
  outputs: string[];
  error: string | null;
  /** Raw provider payload, so callers can inspect inline transcript fields. */
  raw: Record<string, unknown>;
}

/** GET {base}/predictions/{request_id}/result. */
export async function muapiPollResult(
  requestId: string,
  options: MuapiSubmitOptions = {},
): Promise<MuapiPollResult> {
  const { baseUrl, apiKey } = getMuapiConfig();
  const fetchImpl = options.fetchImpl ?? (globalThis.fetch as MuapiFetch);
  const url = `${baseUrl}/predictions/${encodeURIComponent(requestId)}/result`;

  let response: Response;
  try {
    response = await fetchWithTimeout(
      url,
      {
        method: "GET",
        headers: { "x-api-key": apiKey },
      },
      options.timeoutMs ?? 30000,
      fetchImpl,
    );
  } catch (error) {
    throw new MuapiError(`MuAPI poll failed: ${describeNetworkError(error)}`);
  }

  if (!response.ok) {
    const detail = await readErrorBody(response);
    throw new MuapiError(
      `MuAPI poll failed (${response.status}): ${detail}`,
      500,
      response.status,
    );
  }

  const data = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!data || typeof data !== "object") {
    throw new MuapiError("MuAPI poll returned an unreadable response");
  }

  let errorMessage: string | null = null;
  if (typeof data.error === "string") {
    errorMessage = data.error;
  } else if (data.error && typeof data.error === "object") {
    const nested = (data.error as Record<string, unknown>).message;
    if (typeof nested === "string") errorMessage = nested;
  }

  return {
    id: typeof data.id === "string" ? data.id : null,
    status: typeof data.status === "string" ? data.status : "",
    outputs: Array.isArray(data.outputs)
      ? data.outputs.filter((entry): entry is string => typeof entry === "string")
      : [],
    error: errorMessage,
    raw: data,
  };
}

/** Download a provider output URL. Streams with an abort timeout. */
/** Minimum plausible size for a real video/audio asset (bytes). */
export const MUAPI_MIN_OUTPUT_BYTES = 10240;

export interface MuapiDownloadOptions extends MuapiSubmitOptions {
  /**
   * Accepted content-type prefixes. A provider response that is not one of
   * these (an HTML error page, a JSON error body, ...) must never be stored
   * as a media asset.
   */
  acceptContentTypes?: string[];
}

export async function muapiDownload(
  url: string,
  options: MuapiDownloadOptions = {},
): Promise<Uint8Array> {
  const fetchImpl = options.fetchImpl ?? (globalThis.fetch as MuapiFetch);

  let response: Response;
  try {
    response = await fetchWithTimeout(url, { method: "GET" }, options.timeoutMs ?? 120000, fetchImpl);
  } catch (error) {
    throw new MuapiError(
      `Failed to download MuAPI output (${url}): ${describeNetworkError(error)}`,
    );
  }

  if (!response.ok) {
    throw new MuapiError(
      `Failed to download MuAPI output (${url}): HTTP ${response.status}`,
      500,
      response.status,
    );
  }

  // Provider outputs must be real media: reject non-media content types and
  // implausibly small bodies so a JSON/HTML error page can never be uploaded
  // and stored as an MP4/AAC asset.
  const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
  const accepted = options.acceptContentTypes ?? ["video/", "audio/"];
  if (accepted.length > 0 && !accepted.some((prefix) => contentType.startsWith(prefix))) {
    throw new MuapiError(
      `MuAPI output is not a media file (content-type "${contentType || "unknown"}")`,
      500,
    );
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength < MUAPI_MIN_OUTPUT_BYTES) {
    throw new MuapiError(
      `MuAPI output is too small to be a media file (${buffer.byteLength} bytes)`,
      500,
    );
  }
  return new Uint8Array(buffer);
}

// ---------------------------------------------------------------------------
// Video generation endpoints
// ---------------------------------------------------------------------------

export type MuapiVideoModel = "veo3" | "seedance" | "kling";

export const MUAPI_VIDEO_ENDPOINTS: Record<MuapiVideoModel, string> = {
  veo3: "veo3-text-to-video",
  seedance: "seedance-pro-t2v",
  kling: "kling-v2.1-master-t2v",
};

export function muapiVideoRequest(
  model: MuapiVideoModel,
  prompt: string,
  options: { aspectRatio?: string; durationSec?: number } = {},
): { endpoint: string; payload: Record<string, unknown> } {
  const aspectRatio = options.aspectRatio ?? "9:16";
  const durationSec = options.durationSec ?? 5;

  switch (model) {
    case "seedance":
      // Silent, cheap model.
      return {
        endpoint: MUAPI_VIDEO_ENDPOINTS.seedance,
        payload: { prompt, aspect_ratio: aspectRatio, resolution: "1080p", duration: durationSec },
      };
    case "kling":
      return {
        endpoint: MUAPI_VIDEO_ENDPOINTS.kling,
        payload: { prompt, aspect_ratio: aspectRatio, duration: durationSec },
      };
    default:
      // veo3 (native audio).
      return {
        endpoint: MUAPI_VIDEO_ENDPOINTS.veo3,
        payload: { prompt, aspect_ratio: aspectRatio },
      };
  }
}

// ---------------------------------------------------------------------------
// Captions (ai-captions + openai-whisper)
// ---------------------------------------------------------------------------

export const MUAPI_CAPTION_THEMES = [
  "Hormozi_1",
  "Hormozi_2",
  "Hormozi_3",
  "Beast",
  "Ali",
  "Noah",
  "Karl",
  "Luke",
  "Devin",
  "Celine",
  "Maya",
  "Ella",
  "Dan",
  "David",
  "Tracy",
  "Umi",
  "Iman",
  "William",
] as const;

export const MUAPI_CAPTION_LANGUAGES = [
  "English",
  "English (USA)",
  "English (UK)",
  "English (Australia)",
  "English (Canada)",
  "Japanese",
  "Chinese",
  "German",
  "Hindi",
  "French",
  "French (France)",
  "French (Canada)",
  "Korean",
  "Portuguese (Brazil)",
  "Portuguese (Portugal)",
  "Portuguese",
  "Spanish (Spain)",
  "Spanish (Mexico)",
  "Italian",
  "Spanish",
  "Indonesian",
  "Dutch",
  "Turkish",
  "Filipino",
  "Polish",
  "Swedish",
  "Bulgarian",
  "Romanian",
  "Arabic (Saudi Arabia)",
  "Arabic (UAE)",
  "Arabic",
  "Czech",
  "Greek",
  "Finnish",
  "Croatian",
  "Malay",
  "Slovak",
  "Danish",
  "Tamil",
  "Telugu",
  "Ukrainian",
  "Russian",
  "Hungarian",
  "Norwegian",
  "Vietnamese",
] as const;

export type MuapiCaptionTheme = typeof MUAPI_CAPTION_THEMES[number];
export type MuapiCaptionLanguage = typeof MUAPI_CAPTION_LANGUAGES[number];

export function isMuapiCaptionTheme(value: unknown): value is MuapiCaptionTheme {
  return typeof value === "string" &&
    (MUAPI_CAPTION_THEMES as readonly string[]).includes(value);
}

export function isMuapiCaptionLanguage(value: unknown): value is MuapiCaptionLanguage {
  return typeof value === "string" &&
    (MUAPI_CAPTION_LANGUAGES as readonly string[]).includes(value);
}

/** Display language -> ISO-639-1 code for the openai-whisper endpoint. */
const LANGUAGE_ISO_CODES: Record<string, string> = {
  "English": "en",
  "English (USA)": "en",
  "English (UK)": "en",
  "English (Australia)": "en",
  "English (Canada)": "en",
  "Japanese": "ja",
  "Chinese": "zh",
  "German": "de",
  "Hindi": "hi",
  "French": "fr",
  "French (France)": "fr",
  "French (Canada)": "fr",
  "Korean": "ko",
  "Portuguese (Brazil)": "pt",
  "Portuguese (Portugal)": "pt",
  "Portuguese": "pt",
  "Spanish (Spain)": "es",
  "Spanish (Mexico)": "es",
  "Spanish": "es",
  "Italian": "it",
  "Indonesian": "id",
  "Dutch": "nl",
  "Turkish": "tr",
  "Filipino": "fil",
  "Polish": "pl",
  "Swedish": "sv",
  "Bulgarian": "bg",
  "Romanian": "ro",
  "Arabic (Saudi Arabia)": "ar",
  "Arabic (UAE)": "ar",
  "Arabic": "ar",
  "Czech": "cs",
  "Greek": "el",
  "Finnish": "fi",
  "Croatian": "hr",
  "Malay": "ms",
  "Slovak": "sk",
  "Danish": "da",
  "Tamil": "ta",
  "Telugu": "te",
  "Ukrainian": "uk",
  "Russian": "ru",
  "Hungarian": "hu",
  "Norwegian": "no",
  "Vietnamese": "vi",
};

export function toWhisperLanguage(language: string): string {
  return LANGUAGE_ISO_CODES[language] || "en";
}

// ---------------------------------------------------------------------------
// SSRF guard for remote media URLs
// ---------------------------------------------------------------------------

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
  "169.254.169.254",
  "fd00:ec2::254",
  "metadata.google.internal",
  "metadata.goog",
]);

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host.length === 0) return true;
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (host.endsWith(".localhost") || host.endsWith(".internal")) return true;
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^169\.254\./.test(host)) return true;
  const range172 = host.match(/^172\.(\d{1,3})\./);
  if (range172) {
    const second = Number(range172[1]);
    if (second >= 16 && second <= 31) return true;
  }
  if (host.startsWith("fd") && host.includes(":")) return true; // IPv6 ULA
  if (host.startsWith("fe80:")) return true; // IPv6 link-local
  return false;
}

/**
 * True only for absolute https URLs that do not point at localhost, private
 * ranges, or cloud metadata IPs. Used to guard user-supplied media URLs before
 * they are fetched (directly or by a downstream service).
 */
export function isSafeExternalHttpUrl(url: unknown): boolean {
  if (typeof url !== "string" || url.length === 0) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    return !isBlockedHostname(parsed.hostname);
  } catch {
    return false;
  }
}
