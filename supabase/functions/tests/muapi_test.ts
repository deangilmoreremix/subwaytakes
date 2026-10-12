import {
  isMuapiCaptionLanguage,
  isMuapiCaptionTheme,
  MUAPI_CAPTION_LANGUAGES,
  MUAPI_CAPTION_THEMES,
  muapiDownload,
  muapiPollResult,
  muapiSubmit,
  MuapiError,
  muapiVideoRequest,
  type MuapiFetch,
} from "../_shared/muapi.ts";

// Set inside tests (not module scope) so `deno test` needs no permission flags.
function setTestEnv(): void {
  Deno.env.set("MUAPI_API_KEY", "test-api-key");
  Deno.env.delete("MUAPI_BASE_URL");
}

// --- local assertion helpers (dependency-free) -----------------------------

function assertEquals(actual: unknown, expected: unknown, message?: string): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) {
    throw new Error(`${message ?? "assertEquals failed"}\n  expected: ${b}\n  actual:   ${a}`);
  }
}

function assertTrue(value: boolean, message?: string): void {
  if (!value) {
    throw new Error(`assertTrue failed: ${message}`);
  }
}

function assertIncludes(haystack: string, needle: string, message?: string): void {
  if (!haystack.includes(needle)) {
    throw new Error(`${message ?? "assertIncludes failed"}: "${needle}" not found in "${haystack}"`);
  }
}

// --- fetch stub -------------------------------------------------------------

interface RecordedCall {
  url: string;
  init?: RequestInit;
}

function recordingFetch(
  handler: (url: string, init?: RequestInit) => Response,
): { fetchImpl: MuapiFetch; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const fetchImpl: MuapiFetch = async (url, init) => {
    calls.push({ url, init });
    return handler(url, init);
  };
  return { fetchImpl, calls };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// --- tests ------------------------------------------------------------------

Deno.test("muapiSubmit: builds URL, headers and body; returns request_id", async () => {
  setTestEnv();
  const { fetchImpl, calls } = recordingFetch(() =>
    jsonResponse({ request_id: "req_123", status: "queued", cost: 0.1 }),
  );

  const requestId = await muapiSubmit(
    "ai-captions",
    { video_url: "https://cdn.example.com/video.mp4", language: "English", theme: "Hormozi_1" },
    { fetchImpl },
  );

  assertEquals(requestId, "req_123");
  assertEquals(calls.length, 1);
  assertEquals(calls[0].url, "https://api.muapi.ai/api/v1/ai-captions");

  const init = calls[0].init;
  if (!init) throw new Error("no init recorded");
  assertEquals(init.method, "POST");
  const headers = init.headers as Record<string, string>;
  assertEquals(headers["x-api-key"], "test-api-key");
  assertEquals(headers["Content-Type"], "application/json");
  assertEquals(
    JSON.parse(String(init.body)),
    { video_url: "https://cdn.example.com/video.mp4", language: "English", theme: "Hormozi_1" },
  );
  assertTrue(init.signal instanceof AbortSignal, "submit must use an abort signal");
});

Deno.test("muapiSubmit: honours MUAPI_BASE_URL override without double slashes", async () => {
  setTestEnv();
  Deno.env.set("MUAPI_BASE_URL", "https://muapi.example.test/api/v1/");
  try {
    const { fetchImpl, calls } = recordingFetch(() => jsonResponse({ request_id: "req_1" }));

    await muapiSubmit("openai-whisper", { audio_url: "https://x.example/a.mp3" }, { fetchImpl });

    assertEquals(calls[0].url, "https://muapi.example.test/api/v1/openai-whisper");
  } finally {
    Deno.env.delete("MUAPI_BASE_URL");
  }
});

Deno.test("muapiSubmit: throws MuapiError with the provider message on non-ok", async () => {
  setTestEnv();
  const { fetchImpl } = recordingFetch(() => jsonResponse({ error: "Invalid theme" }, 400));

  let caught: unknown = null;
  try {
    await muapiSubmit("ai-captions", { video_url: "https://x.example/a.mp4" }, { fetchImpl });
  } catch (error) {
    caught = error;
  }

  assertTrue(caught instanceof MuapiError, "expected MuapiError");
  const muapiError = caught as MuapiError;
  assertIncludes(muapiError.message, "Invalid theme");
  assertIncludes(muapiError.message, "(400)");
  assertEquals(muapiError.status, 500);
  assertEquals(muapiError.upstreamStatus, 400);
});

Deno.test("muapiPollResult: parses status and outputs", async () => {
  setTestEnv();
  const { fetchImpl, calls } = recordingFetch(() =>
    jsonResponse({ id: "req_9", status: "completed", outputs: ["https://cdn.example.com/out.mp4"] }),
  );

  const result = await muapiPollResult("req_9", { fetchImpl });

  assertEquals(calls[0].url, "https://api.muapi.ai/api/v1/predictions/req_9/result");
  const init = calls[0].init;
  if (!init) throw new Error("no init recorded");
  assertEquals(init.method, "GET");
  assertEquals((init.headers as Record<string, string>)["x-api-key"], "test-api-key");

  assertEquals(result.status, "completed");
  assertEquals(result.outputs, ["https://cdn.example.com/out.mp4"]);
  assertEquals(result.error, null);
  assertEquals(result.raw.id, "req_9");
});

Deno.test("muapiPollResult: surfaces provider error and keeps only string outputs", async () => {
  setTestEnv();
  const { fetchImpl } = recordingFetch(() =>
    jsonResponse({
      status: "failed",
      outputs: [null, 7, "https://cdn.example.com/never.mp4"],
      error: { message: "prompt rejected" },
    }),
  );

  const result = await muapiPollResult("req_10", { fetchImpl });

  assertEquals(result.status, "failed");
  assertEquals(result.error, "prompt rejected");
  assertEquals(result.outputs, ["https://cdn.example.com/never.mp4"]);
});

Deno.test("muapiDownload: streams bytes from an output URL", async () => {
  setTestEnv();
  // Media-valid fixture: a plausible size and a media content-type, as the
  // content-type / minimum-size guard now requires of a real provider output.
  const payload = new Uint8Array(16384).fill(7);
  const { fetchImpl, calls } = recordingFetch(() =>
    new Response(payload, { status: 200, headers: { "Content-Type": "video/mp4" } }),
  );

  const bytes = await muapiDownload("https://cdn.example.com/out.mp4", { fetchImpl });

  assertEquals(calls[0].url, "https://cdn.example.com/out.mp4");
  assertEquals(bytes.byteLength, 16384);
  assertEquals(bytes[0], 7);
  assertTrue(bytes instanceof Uint8Array, "download must return a Uint8Array");
});

Deno.test("caption constants: 18 themes and 45 languages, all unique", () => {
  setTestEnv();
  assertEquals(MUAPI_CAPTION_THEMES.length, 18);
  assertTrue(MUAPI_CAPTION_THEMES.includes("Hormozi_1"));
  assertTrue(MUAPI_CAPTION_THEMES.includes("William"));
  assertEquals(new Set<string>(MUAPI_CAPTION_THEMES).size, 18);

  assertEquals(MUAPI_CAPTION_LANGUAGES.length, 45);
  assertTrue(MUAPI_CAPTION_LANGUAGES.includes("English"));
  assertTrue(MUAPI_CAPTION_LANGUAGES.includes("Vietnamese"));
  assertEquals(new Set<string>(MUAPI_CAPTION_LANGUAGES).size, 45);

  assertTrue(isMuapiCaptionTheme("Beast"));
  assertTrue(!isMuapiCaptionTheme("NotATheme"));
  assertTrue(isMuapiCaptionLanguage("Arabic (Saudi Arabia)"));
  assertTrue(!isMuapiCaptionLanguage("Klingon"));
});

Deno.test("muapiVideoRequest: endpoint and payload per model", () => {
  setTestEnv();
  const veo3 = muapiVideoRequest("veo3", "a subway interview", { aspectRatio: "9:16", durationSec: 5 });
  assertEquals(veo3.endpoint, "veo3-text-to-video");
  assertEquals(veo3.payload, { prompt: "a subway interview", aspect_ratio: "9:16" });

  const seedance = muapiVideoRequest("seedance", "b-roll", { aspectRatio: "9:16", durationSec: 8 });
  assertEquals(seedance.endpoint, "seedance-pro-t2v");
  assertEquals(seedance.payload, {
    prompt: "b-roll",
    aspect_ratio: "9:16",
    resolution: "1080p",
    duration: 8,
  });

  const kling = muapiVideoRequest("kling", "reaction shot", { aspectRatio: "9:16", durationSec: 10 });
  assertEquals(kling.endpoint, "kling-v2.1-master-t2v");
  assertEquals(kling.payload, {
    prompt: "reaction shot",
    aspect_ratio: "9:16",
    duration: 10,
  });
});
