/**
 * provider_test.ts — provider integration for the Studio edge functions.
 *
 * Every provider boundary is stubbed at the fetch layer: the OpenAI Responses
 * API, MuAPI (submit / poll / download) and the Supabase plane (GoTrue,
 * PostgREST, Storage) are all emulated here, so no test performs a live
 * provider or database call. Functions whose Deno.serve is inline (scene-status,
 * muapi-captions) are captured through the Deno.serve stub; the others expose
 * their handler directly.
 */

import { HttpError } from "../_shared/cors.ts";
import { callOpenAIResponses } from "../_shared/openai.ts";
import { DEFAULT_SIGN_TTL_SECONDS, MAX_SIGN_TTL_SECONDS, MEDIA_BUCKETS } from "../_shared/media.ts";
import {
  MUAPI_MIN_OUTPUT_BYTES,
  muapiDownload,
  MuapiError,
  type MuapiFetch,
  muapiPollResult,
} from "../_shared/muapi.ts";

// --- inline-serve functions: capture their handler, never bind a port -------
// The Deno.serve stub is (re)installed before each import during the initial
// module evaluation — top-level dynamic imports are part of the module graph,
// so no read permission is needed (a runtime dynamic import would be).

type EdgeHandler = (req: Request) => Promise<Response>;

let servedHandler: EdgeHandler | null = null;

function stubServe(handler: unknown): Promise<void> {
  servedHandler = handler as EdgeHandler;
  return Promise.resolve();
}

function captureServeHandler(): EdgeHandler {
  const handler = servedHandler;
  if (!handler) throw new Error("no Deno.serve handler captured");
  servedHandler = null;
  return handler;
}

(globalThis.Deno as unknown as { serve: unknown }).serve = stubServe;
await import("../scene-status/index.ts");
const sceneStatusHandler = captureServeHandler();

(globalThis.Deno as unknown as { serve: unknown }).serve = stubServe;
await import("../muapi-captions/index.ts");
const captionsHandler = captureServeHandler();

// The remaining handlers are exported directly and driven as-is.
const {
  BEAT_IDS: PLAN_BEAT_IDS,
  PLAN_SCHEMA,
  handlePlanInterviewRequest,
  parsePlan,
} = await import("../plan-interview/index.ts");
const {
  BEAT_IDS: SCENE_BEAT_IDS,
  SUBMIT_ATTEMPTS,
  handleGenerateSceneRequest,
  parseGenerateSceneRequest,
  submitWithRetries,
} = await import("../generate-scene/index.ts");

function assertEquals(actual: unknown, expected: unknown, message?: string): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) {
    throw new Error(`${message ?? "assertEquals failed"}\n  expected: ${b}\n  actual:   ${a}`);
  }
}

function assertTrue(value: boolean, message?: string): void {
  if (!value) {
    throw new Error(`assertTrue failed: ${message ?? "expected true"}`);
  }
}

function assertIncludes(haystack: string, needle: string): void {
  assertTrue(haystack.includes(needle), `"${needle}" not found in "${haystack}"`);
}

async function expectThrows(
  promise: Promise<unknown>,
  check: (error: unknown) => void,
): Promise<void> {
  let caught: unknown = null;
  try {
    await promise;
  } catch (error) {
    caught = error;
  }
  assertTrue(caught !== null, "expected the call to reject");
  check(caught);
}

// --- environment ------------------------------------------------------------
// Set inside the tests (not at module scope) so `deno test` runs without any
// permission flags beyond the ones `deno task test` already passes.

const SUPABASE_URL = "https://test-project.supabase.co";
const USER_ID = "11111111-2222-3333-4444-555555555555";
const USER_TOKEN = "test-user-jwt";
const OPENAI_URL = "https://api.openai.com/v1/responses";
const MUAPI_BASE = "https://api.muapi.ai/api/v1";
const SCENE_OUTPUT_URL = "https://cdn.muapi.test/scene-output.mp4";
const CAPTIONED_OUTPUT_URL = "https://cdn.muapi.test/captioned-output.mp4";

function setTestEnv(): void {
  Deno.env.set("SUPABASE_URL", SUPABASE_URL);
  Deno.env.set("SUPABASE_ANON_KEY", "test-anon-key");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
  Deno.env.set("MUAPI_API_KEY", "test-muapi-key");
  Deno.env.set("OPENAI_API_KEY", "test-openai-key");
  Deno.env.delete("MUAPI_BASE_URL");
  Deno.env.delete("OPENAI_MODEL");
  Deno.env.delete("ALLOWED_ORIGINS");
}

// --- fetch stubs -------------------------------------------------------------

interface RecordedCall {
  url: string;
  method: string;
  body?: string;
  init?: RequestInit;
}

type FetchHandler = (url: string, init?: RequestInit) => Response | Promise<Response>;
type MaybeHandler = (url: string, init?: RequestInit) => Response | null;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Media-valid provider output: real content-type and a plausible size. */
function mediaBytes(size = 20480): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(size));
  bytes.fill(0x24);
  return bytes;
}

const originalFetch = globalThis.fetch;

function withFetch(handler: FetchHandler): { calls: RecordedCall[]; restore: () => void } {
  const calls: RecordedCall[] = [];
  const stubbed: typeof globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
    calls.push({
      url,
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? init.body : undefined,
      init,
    });
    return handler(url, init);
  };
  globalThis.fetch = stubbed;
  return {
    calls,
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}

/** First non-null handler wins; anything unmatched is a test failure. */
function chain(...handlers: MaybeHandler[]): FetchHandler {
  return (url, init) => {
    for (const handler of handlers) {
      const response = handler(url, init);
      if (response) return response;
    }
    return jsonResponse({ error: `unexpected url ${url}` }, 500);
  };
}

/** Injectable provider fetch for the muapi/openai client helpers. */
function stubMuapi(handler: FetchHandler): { fetchImpl: MuapiFetch; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const fetchImpl: MuapiFetch = async (url, init) => {
    calls.push({
      url,
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? init.body : undefined,
      init,
    });
    return handler(url, init);
  };
  return { fetchImpl, calls };
}

// --- the Supabase plane, emulated -------------------------------------------

function authPlane(): MaybeHandler {
  return (url) =>
    url.includes("/auth/v1/user")
      ? jsonResponse({ id: USER_ID, email: "studio@subwaytakes.test", role: "authenticated" })
      : null;
}

/** studio_projects ownership check, project load and project update. */
function projectsPlane(project: unknown): MaybeHandler {
  return (url, init) => {
    if (!url.includes("/rest/v1/studio_projects")) return null;
    if (url.includes("select=user_id")) return jsonResponse({ user_id: USER_ID });
    if (url.includes("select=project")) return jsonResponse({ project });
    if ((init?.method ?? "GET") === "PATCH") return jsonResponse({});
    return null;
  };
}

/** Storage createSignedUrl: the API answers with a relative signedURL path. */
function signPlane(token: string): MaybeHandler {
  return (url, init) => {
    if (!url.includes("/storage/v1/object/sign/") || (init?.method ?? "GET") !== "POST") return null;
    const objectPath = url.slice(url.indexOf("/object/sign/") + "/object/sign/".length);
    return jsonResponse({ signedURL: `/object/sign/${objectPath}?token=${token}` });
  };
}

/** Storage object upload. */
function uploadPlane(): MaybeHandler {
  return (url, init) => {
    if (!url.includes("/storage/v1/object/videos/") || (init?.method ?? "GET") !== "POST") return null;
    return jsonResponse({ Id: "upload-1", Key: "videos/upload" });
  };
}

/** muapi_caption_jobs insert / load / update. */
function captionJobsPlane(jobRow?: Record<string, unknown>): MaybeHandler {
  return (url, init) => {
    if (!url.includes("/rest/v1/muapi_caption_jobs")) return null;
    const method = init?.method ?? "GET";
    if (method === "POST") return jsonResponse({ id: "job-1" }, 201);
    if (method === "PATCH") return jsonResponse({});
    return jobRow ? jsonResponse(jobRow) : null;
  };
}

/** Provider output download (media-valid by default). */
function downloadPlane(outputUrl: string, options: { bytes?: number; contentType?: string } = {}): MaybeHandler {
  return (url) =>
    url === outputUrl
      ? new Response(mediaBytes(options.bytes ?? 20480), {
        status: 200,
        headers: { "Content-Type": options.contentType ?? "video/mp4" },
      })
      : null;
}

function post(
  handler: (req: Request) => Promise<Response>,
  body: unknown,
): Promise<Response> {
  return handler(
    new Request("https://edge.test/functions/v1/x", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${USER_TOKEN}`,
      },
      body: JSON.stringify(body),
    }),
  );
}

// --- fixtures ---------------------------------------------------------------

function validPlanPayload(): Record<string, unknown> {
  return {
    title: "Is the subway getting worse?",
    hookQuestion: "Is the NYC subway actually getting worse?",
    handle: "@subwaytakes",
    beats: PLAN_BEAT_IDS.map((beatId) => ({
      beatId,
      shotType: "host",
      speaker: "host",
      dialogue: `dialogue for ${beatId}`,
      cameraDirection: `camera for ${beatId}`,
      videoPrompt: `prompt for ${beatId} — documentary, natural lighting, no AI artifacts`,
    })),
  };
}

function openaiPlane(response: () => Response): MaybeHandler {
  return (url) => (url === OPENAI_URL ? response() : null);
}

const sceneProject = {
  tracks: [
    {
      kind: "video",
      clips: [
        { id: "clip-0", beatId: "opening_hook", trim: { start: 0, end: 3 } },
        { id: "clip-1", beatId: "interviewer_intro", trim: { start: 0, end: 4 } },
      ],
    },
  ],
};

const SCENE_REQUEST_ID = "req_7";
const SCENE_BEAT_ID = "interviewer_intro";
const SCENE_STORAGE_PATH = `${USER_ID}/scenes/project-1/scene-${SCENE_BEAT_ID}-${SCENE_REQUEST_ID}.mp4`;
const SCENE_SIGNED_URL = `${SUPABASE_URL}/storage/v1/object/sign/videos/${SCENE_STORAGE_PATH}?token=scene-signature`;

function muapiResultPlane(requestId: string, payload: Record<string, unknown>): MaybeHandler {
  return (url) =>
    url === `${MUAPI_BASE}/predictions/${requestId}/result` ? jsonResponse({ id: requestId, ...payload }) : null;
}

const captionsProject = {
  tracks: [
    {
      kind: "video",
      clips: [
        {
          id: "clip-1",
          beatId: "opening_hook",
          assetRef: {
            bucket: "videos",
            path: `studio-scenes/${USER_ID}/project-1/clip-1.mp4`,
            kind: "video",
          },
        },
      ],
    },
  ],
};

const CAPTION_SOURCE_SIGNED_URL =
  `${SUPABASE_URL}/storage/v1/object/sign/videos/studio-scenes/${USER_ID}/project-1/clip-1.mp4?token=source-signature`;
const CAPTION_OUTPUT_STORAGE_PATH = `${USER_ID}/captioned/job-1.mp4`;
const CAPTION_OUTPUT_SIGNED_URL =
  `${SUPABASE_URL}/storage/v1/object/sign/videos/${CAPTION_OUTPUT_STORAGE_PATH}?token=output-signature`;

const captionJobRow = {
  id: "job-1",
  user_id: USER_ID,
  project_id: "project-1",
  render_job_id: null,
  mode: "styled",
  muapi_request_id: "req_9",
  language: "English",
  theme: "Hormozi_1",
  status: "running",
  output_ref: null,
  output_url: null,
  captions: null,
  error: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

// --- plan-interview ---------------------------------------------------------

Deno.test("plan-interview: strict json_schema request + 7 ordered beats returned", async () => {
  setTestEnv();
  const planPayload = validPlanPayload();
  const { calls, restore } = withFetch(chain(
    authPlane(),
    openaiPlane(() => jsonResponse({ output_text: JSON.stringify(planPayload) })),
  ));
  try {
    const response = await post(handlePlanInterviewRequest, {
      topic: "Is the subway getting worse?",
      hostDescription: "a confident interviewer in a puffer jacket with a card mic",
      guestDescription: "a relatable New Yorker in their 30s",
      environment: "a NYC subway platform as the train pulls in",
      handle: "@subwaytakes",
    });
    assertEquals(response.status, 200);

    const body = await response.json() as {
      plan: { title: string; hookQuestion: string; beats: Array<Record<string, unknown>> };
    };
    assertEquals(body.plan.title, planPayload.title);
    assertEquals(body.plan.hookQuestion, planPayload.hookQuestion);
    assertEquals(body.plan.beats.length, 7);
    assertEquals(
      body.plan.beats.map((beat) => beat.beatId),
      [...PLAN_BEAT_IDS],
    );

    const openaiCall = calls.find((call) => call.url === OPENAI_URL);
    assertTrue(Boolean(openaiCall), "the OpenAI Responses API must be called");
    assertEquals(openaiCall!.method, "POST");
    const payload = JSON.parse(String(openaiCall!.body)) as {
      model: string;
      input: string;
      instructions: string;
      text: {
        format: {
          type: string;
          name: string;
          strict: boolean;
          schema: {
            properties: {
              beats: { minItems: number; maxItems: number; items: { properties: Record<string, unknown> } };
            };
          };
        };
      };
    };
    assertEquals(payload.model, "gpt-4o-mini");
    assertEquals(payload.text.format.type, "json_schema");
    assertEquals(payload.text.format.name, "interview_plan");
    assertEquals(payload.text.format.strict, true);
    assertEquals(payload.text.format.schema, PLAN_SCHEMA);
    assertEquals(payload.text.format.schema.properties.beats.minItems, 7);
    assertEquals(payload.text.format.schema.properties.beats.maxItems, 7);

    // The parse round-trips: a valid payload parses into an ordered plan.
    const parsed = parsePlan(planPayload);
    assertEquals(parsed.beats.map((beat) => beat.beatId), [...PLAN_BEAT_IDS]);
    assertEquals(parsed.beats[0].dialogue, `dialogue for ${PLAN_BEAT_IDS[0]}`);
  } finally {
    restore();
  }
});

Deno.test("plan-interview: 500 (never a fabricated plan) when OPENAI_API_KEY is missing", async () => {
  setTestEnv();
  Deno.env.delete("OPENAI_API_KEY");
  const { calls, restore } = withFetch(chain(authPlane()));
  try {
    const response = await post(handlePlanInterviewRequest, { topic: "subway safety" });
    assertEquals(response.status, 500);
    const body = await response.json() as { error?: string };
    assertIncludes(body.error ?? "", "OPENAI_API_KEY");
    assertEquals(
      calls.some((call) => call.url.includes("api.openai.com")),
      false,
      "no provider call may be attempted without a key",
    );
  } finally {
    Deno.env.set("OPENAI_API_KEY", "test-openai-key");
    restore();
  }
});

Deno.test("plan-interview: 500 when the model returns the wrong number of beats", async () => {
  setTestEnv();
  const planPayload = validPlanPayload();
  planPayload.beats = (planPayload.beats as unknown[]).slice(0, 6);
  const { restore } = withFetch(chain(
    authPlane(),
    openaiPlane(() => jsonResponse({ output_text: JSON.stringify(planPayload) })),
  ));
  try {
    const response = await post(handlePlanInterviewRequest, { topic: "subway safety" });
    assertEquals(response.status, 500);
    const body = await response.json() as { error?: string };
    assertIncludes(body.error ?? "", "expected 7 beats, got 6");
  } finally {
    restore();
  }
});

Deno.test("plan-interview: 500 when the model output is not valid JSON", async () => {
  setTestEnv();
  const { restore } = withFetch(chain(
    authPlane(),
    openaiPlane(() => jsonResponse({ output_text: "not json {" })),
  ));
  try {
    const response = await post(handlePlanInterviewRequest, { topic: "subway safety" });
    assertEquals(response.status, 500);
    const body = await response.json() as { error?: string };
    assertIncludes(body.error ?? "", "not valid JSON");
  } finally {
    restore();
  }
});

Deno.test("plan-interview: surfaces an upstream 429 as 500", async () => {
  setTestEnv();
  const { restore } = withFetch(chain(
    authPlane(),
    openaiPlane(() => jsonResponse({ error: { message: "rate limit exceeded" } }, 429)),
  ));
  try {
    const response = await post(handlePlanInterviewRequest, { topic: "subway safety" });
    assertEquals(response.status, 500);
    const body = await response.json() as { error?: string };
    assertIncludes(body.error ?? "", "OpenAI API error: 429");
    assertIncludes(body.error ?? "", "rate limit exceeded");
  } finally {
    restore();
  }
});

Deno.test("plan-interview: surfaces an upstream 500 as 500", async () => {
  setTestEnv();
  const { restore } = withFetch(chain(
    authPlane(),
    openaiPlane(() => jsonResponse({ error: { message: "model overloaded" } }, 500)),
  ));
  try {
    const response = await post(handlePlanInterviewRequest, { topic: "subway safety" });
    assertEquals(response.status, 500);
    const body = await response.json() as { error?: string };
    assertIncludes(body.error ?? "", "OpenAI API error: 500");
    assertIncludes(body.error ?? "", "model overloaded");
  } finally {
    restore();
  }
});

// --- callOpenAIResponses ----------------------------------------------------

Deno.test("callOpenAIResponses: default model gpt-4o-mini, strict json_schema, auth header", async () => {
  setTestEnv();
  const { fetchImpl, calls } = stubMuapi(() => jsonResponse({ output_text: JSON.stringify({ ok: true, beats: 7 }) }));

  const result = await callOpenAIResponses({
    schemaName: "test_plan",
    schema: { type: "object", properties: { beats: { type: "array" } } },
    input: "write the plan",
    instructions: "system prompt",
    fetchImpl,
  });

  assertEquals(result, { ok: true, beats: 7 });
  assertEquals(calls.length, 1);
  assertEquals(calls[0].url, OPENAI_URL);
  assertEquals(calls[0].method, "POST");
  const headers = calls[0].init?.headers as Record<string, string>;
  assertEquals(headers.Authorization, "Bearer test-openai-key");
  assertEquals(headers["Content-Type"], "application/json");
  assertTrue(calls[0].init?.signal instanceof AbortSignal, "every call carries an abort signal");

  const payload = JSON.parse(String(calls[0].body)) as {
    model: string;
    input: string;
    instructions: string;
    text: { format: Record<string, unknown> };
  };
  assertEquals(payload.model, "gpt-4o-mini");
  assertEquals(payload.input, "write the plan");
  assertEquals(payload.instructions, "system prompt");
  assertEquals(payload.text.format, {
    type: "json_schema",
    name: "test_plan",
    schema: { type: "object", properties: { beats: { type: "array" } } },
    strict: true,
  });
});

Deno.test("callOpenAIResponses: OPENAI_MODEL overrides the default model", async () => {
  setTestEnv();
  Deno.env.set("OPENAI_MODEL", "gpt-4.1-studio-override");
  const { fetchImpl, calls } = stubMuapi(() => jsonResponse({ output_text: '{"ok":true}' }));
  try {
    await callOpenAIResponses({ schemaName: "s", schema: {}, input: "x", fetchImpl });
    assertEquals(JSON.parse(String(calls[0].body)).model, "gpt-4.1-studio-override");
  } finally {
    Deno.env.delete("OPENAI_MODEL");
  }
});

Deno.test("callOpenAIResponses: request.model overrides the environment", async () => {
  setTestEnv();
  Deno.env.set("OPENAI_MODEL", "env-model");
  const { fetchImpl, calls } = stubMuapi(() => jsonResponse({ output_text: '{"ok":true}' }));
  try {
    await callOpenAIResponses({
      schemaName: "s",
      schema: {},
      input: "x",
      model: "request-model",
      fetchImpl,
    });
    assertEquals(JSON.parse(String(calls[0].body)).model, "request-model");
  } finally {
    Deno.env.delete("OPENAI_MODEL");
  }
});

Deno.test("callOpenAIResponses: an aborted request surfaces as a 500 HttpError", async () => {
  setTestEnv();
  const { fetchImpl } = stubMuapi((_url, init) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        const aborted = new Error("The operation was aborted");
        aborted.name = "AbortError";
        reject(aborted);
      });
    })
  );

  await expectThrows(
    callOpenAIResponses({ schemaName: "s", schema: {}, input: "x", timeoutMs: 20, fetchImpl }),
    (error) => {
      assertTrue(error instanceof HttpError, `expected HttpError, got ${String(error)}`);
      if (error instanceof HttpError) {
        assertEquals(error.status, 500);
        assertIncludes(error.message, "OpenAI request failed");
      }
    },
  );
});

Deno.test("callOpenAIResponses: 500 when the response carries no content", async () => {
  setTestEnv();
  const { fetchImpl } = stubMuapi(() => jsonResponse({ id: "resp-empty" }));
  await expectThrows(
    callOpenAIResponses({ schemaName: "s", schema: {}, input: "x", fetchImpl }),
    (error) => {
      assertTrue(error instanceof HttpError);
      if (error instanceof HttpError) {
        assertEquals(error.status, 500);
        assertIncludes(error.message, "contained no content");
      }
    },
  );
});

// --- generate-scene ---------------------------------------------------------

Deno.test("generate-scene: submits to veo3-text-to-video with x-api-key and a 9:16 payload", async () => {
  setTestEnv();
  const { calls, restore } = withFetch(chain(
    authPlane(),
    projectsPlane(sceneProject),
    (url) =>
      url === `${MUAPI_BASE}/veo3-text-to-video` ? jsonResponse({ request_id: "req_42", status: "queued" }) : null,
  ));
  try {
    const response = await post(handleGenerateSceneRequest, {
      project_id: "project-1",
      beat_id: "guest_responds",
      prompt: "guest responds on the subway platform",
      model: "veo3",
    });
    assertEquals(response.status, 200);
    const body = await response.json() as { request_id?: string; beat_id?: string };
    assertEquals(body.request_id, "req_42");
    assertEquals(body.beat_id, "guest_responds");

    const muapiCall = calls.find((call) => call.url === `${MUAPI_BASE}/veo3-text-to-video`);
    assertTrue(Boolean(muapiCall), "MuAPI text-to-video must be called");
    assertEquals(muapiCall!.method, "POST");
    assertEquals(JSON.parse(String(muapiCall!.body)), {
      prompt: "guest responds on the subway platform",
      aspect_ratio: "9:16",
    });
    const headers = muapiCall!.init?.headers as Record<string, string>;
    assertEquals(headers["x-api-key"], "test-muapi-key");
  } finally {
    restore();
  }
});

Deno.test("generate-scene: 400 on an invalid beat id before any provider call", async () => {
  setTestEnv();
  const { calls, restore } = withFetch(chain(authPlane(), projectsPlane(sceneProject)));
  try {
    const response = await post(handleGenerateSceneRequest, {
      project_id: "project-1",
      beat_id: "not_a_beat",
      prompt: "x",
    });
    assertEquals(response.status, 400);
    const body = await response.json() as { error?: string };
    assertEquals(body.error, `beat_id is required and must be one of: ${SCENE_BEAT_IDS.join(", ")}`);
    assertEquals(
      calls.some((call) => call.url.includes("muapi") || call.url.includes("openai")),
      false,
      "validation runs before the provider is called",
    );
    assertEquals(
      parseGenerateSceneRequest({
        project_id: "project-1",
        beat_id: "not_a_beat",
        prompt: "x",
      }).ok,
      false,
    );
  } finally {
    restore();
  }
});

Deno.test("generate-scene: submitWithRetries retries a 5xx once with [1000] backoff", async () => {
  setTestEnv();
  let attempts = 0;
  const slept: number[] = [];
  const requestId = await submitWithRetries(
    "veo3-text-to-video",
    { prompt: "x" },
    {
      submit: async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new MuapiError("MuAPI submit failed (500): upstream boom", 500, 500);
        }
        return "req_retry";
      },
      sleep: async (ms) => {
        slept.push(ms);
      },
    },
  );
  assertEquals(requestId, "req_retry");
  assertEquals(attempts, 2, "one retry, not more");
  assertEquals(slept, [1000]);
});

Deno.test("generate-scene: submitWithRetries does not retry a 4xx", async () => {
  setTestEnv();
  let attempts = 0;
  const slept: number[] = [];
  await expectThrows(
    submitWithRetries(
      "veo3-text-to-video",
      { prompt: "x" },
      {
        submit: async () => {
          attempts += 1;
          throw new MuapiError("MuAPI submit failed (400): invalid prompt", 500, 400);
        },
        sleep: async (ms) => {
          slept.push(ms);
        },
      },
    ),
    (error) => {
      assertTrue(error instanceof MuapiError, `expected MuapiError, got ${String(error)}`);
      assertIncludes((error as Error).message, "invalid prompt");
    },
  );
  assertEquals(attempts, 1, "a 4xx is never retried");
  assertEquals(slept, []);
});

Deno.test("generate-scene: submitWithRetries exhausts 4 attempts with [1000,2000,4000]", async () => {
  setTestEnv();
  let attempts = 0;
  const slept: number[] = [];
  await expectThrows(
    submitWithRetries(
      "veo3-text-to-video",
      { prompt: "x" },
      {
        submit: async () => {
          attempts += 1;
          throw new MuapiError("MuAPI submit failed (503): overloaded", 500, 503);
        },
        sleep: async (ms) => {
          slept.push(ms);
        },
      },
    ),
    (error) => {
      assertTrue(error instanceof MuapiError, `expected MuapiError, got ${String(error)}`);
      const muapiError = error as MuapiError;
      assertIncludes(muapiError.message, "(503)");
      assertEquals(muapiError.upstreamStatus, 503);
    },
  );
  assertEquals(attempts, SUBMIT_ATTEMPTS);
  assertEquals(slept, [1000, 2000, 4000]);
});

// --- muapiDownload content-type / size guard --------------------------------

Deno.test("muapiDownload: a 20KB video/mp4 output is returned", async () => {
  setTestEnv();
  const { fetchImpl, calls } = stubMuapi(() =>
    new Response(mediaBytes(20480), { status: 200, headers: { "Content-Type": "video/mp4" } })
  );
  const bytes = await muapiDownload("https://cdn.muapi.test/out.mp4", { fetchImpl });
  assertEquals(calls[0].url, "https://cdn.muapi.test/out.mp4");
  assertEquals(calls[0].method, "GET");
  assertTrue(bytes instanceof Uint8Array, "download must return a Uint8Array");
  assertEquals(bytes.byteLength, 20480);
  assertTrue(bytes.byteLength >= MUAPI_MIN_OUTPUT_BYTES);
});

Deno.test("muapiDownload: a text/html output is not a media file", async () => {
  setTestEnv();
  const { fetchImpl } = stubMuapi(() =>
    new Response("<html><body>404 not found</body></html>", {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })
  );
  await expectThrows(muapiDownload("https://cdn.muapi.test/out.mp4", { fetchImpl }), (error) => {
    assertTrue(error instanceof MuapiError, `expected MuapiError, got ${String(error)}`);
    assertIncludes((error as Error).message, "not a media file");
  });
});

Deno.test("muapiDownload: an application/json output is rejected", async () => {
  setTestEnv();
  const { fetchImpl } = stubMuapi(() => jsonResponse({ error: "output expired" }, 200));
  await expectThrows(muapiDownload("https://cdn.muapi.test/out.mp4", { fetchImpl }), (error) => {
    assertTrue(error instanceof MuapiError, `expected MuapiError, got ${String(error)}`);
    assertIncludes((error as Error).message, "not a media file");
  });
});

Deno.test("muapiDownload: a 5-byte video/mp4 output is too small", async () => {
  setTestEnv();
  const { fetchImpl } = stubMuapi(() =>
    new Response(mediaBytes(5), { status: 200, headers: { "Content-Type": "video/mp4" } })
  );
  await expectThrows(muapiDownload("https://cdn.muapi.test/out.mp4", { fetchImpl }), (error) => {
    assertTrue(error instanceof MuapiError, `expected MuapiError, got ${String(error)}`);
    assertIncludes((error as Error).message, "too small to be a media file");
  });
});

Deno.test("muapiDownload: acceptContentTypes restricts the accepted prefixes", async () => {
  setTestEnv();
  const audio = await muapiDownload("https://cdn.muapi.test/out.mp3", {
    fetchImpl: stubMuapi(() =>
      new Response(mediaBytes(20480), { status: 200, headers: { "Content-Type": "audio/mpeg" } })
    ).fetchImpl,
  });
  assertEquals(audio.byteLength, 20480);

  const { fetchImpl } = stubMuapi(() =>
    new Response(mediaBytes(20480), { status: 200, headers: { "Content-Type": "video/mp4" } })
  );
  await expectThrows(
    muapiDownload("https://cdn.muapi.test/out.mp4", {
      fetchImpl,
      acceptContentTypes: ["audio/"],
    }),
    (error) => {
      assertTrue(error instanceof MuapiError);
      assertIncludes((error as Error).message, "not a media file");
    },
  );
});

// --- muapiPollResult --------------------------------------------------------

Deno.test("muapiPollResult: processing status with no outputs", async () => {
  setTestEnv();
  const { fetchImpl, calls } = stubMuapi(() => jsonResponse({ id: "req_1", status: "processing" }));
  const result = await muapiPollResult("req_1", { fetchImpl });
  assertEquals(calls[0].url, `${MUAPI_BASE}/predictions/req_1/result`);
  assertEquals(calls[0].method, "GET");
  assertEquals(result.status, "processing");
  assertEquals(result.outputs, []);
  assertEquals(result.error, null);
});

Deno.test("muapiPollResult: failed status surfaces the provider message", async () => {
  setTestEnv();
  const { fetchImpl } = stubMuapi(() =>
    jsonResponse({ id: "req_2", status: "failed", error: { message: "prompt rejected" } })
  );
  const result = await muapiPollResult("req_2", { fetchImpl });
  assertEquals(result.status, "failed");
  assertEquals(result.error, "prompt rejected");
  assertEquals(result.outputs, []);
});

Deno.test("muapiPollResult: cancelled status is reported verbatim", async () => {
  setTestEnv();
  const { fetchImpl } = stubMuapi(() =>
    jsonResponse({ id: "req_3", status: "cancelled", error: "cancelled by the provider" })
  );
  const result = await muapiPollResult("req_3", { fetchImpl });
  assertEquals(result.status, "cancelled");
  assertEquals(result.error, "cancelled by the provider");
});

Deno.test("muapiPollResult: completed status returns the output urls", async () => {
  setTestEnv();
  const { fetchImpl } = stubMuapi(() =>
    jsonResponse({
      id: "req_4",
      status: "completed",
      outputs: ["https://cdn.muapi.test/a.mp4", "https://cdn.muapi.test/b.mp4"],
    })
  );
  const result = await muapiPollResult("req_4", { fetchImpl });
  assertEquals(result.status, "completed");
  assertEquals(result.outputs, ["https://cdn.muapi.test/a.mp4", "https://cdn.muapi.test/b.mp4"]);
  assertEquals(result.error, null);
});

Deno.test("muapiPollResult: completed with no outputs yields an empty array", async () => {
  setTestEnv();
  const { fetchImpl } = stubMuapi(() => jsonResponse({ id: "req_5", status: "completed", outputs: [] }));
  const result = await muapiPollResult("req_5", { fetchImpl });
  assertEquals(result.status, "completed");
  assertEquals(result.outputs, []);
});

// --- scene-status -----------------------------------------------------------

Deno.test("scene-status: a processing job polls /predictions/{id}/result", async () => {
  setTestEnv();
  const { calls, restore } = withFetch(chain(
    authPlane(),
    projectsPlane(sceneProject),
    muapiResultPlane(SCENE_REQUEST_ID, { status: "processing" }),
    signPlane("scene-signature"),
    uploadPlane(),
  ));
  try {
    const response = await post(sceneStatusHandler, {
      project_id: "project-1",
      beat_id: SCENE_BEAT_ID,
      request_id: SCENE_REQUEST_ID,
    });
    assertEquals(response.status, 200);
    const body = await response.json() as { status?: string };
    assertEquals(body.status, "processing");
    assertTrue(
      calls.some((call) => call.url === `${MUAPI_BASE}/predictions/${SCENE_REQUEST_ID}/result`),
      "the poll must hit the provider result endpoint",
    );
    assertEquals(
      calls.some((call) => call.url.includes("/storage/v1/")),
      false,
      "nothing is stored while the job is processing",
    );
  } finally {
    restore();
  }
});

Deno.test("scene-status: a failed job is a 500 with the provider message", async () => {
  setTestEnv();
  const { calls, restore } = withFetch(chain(
    authPlane(),
    projectsPlane(sceneProject),
    muapiResultPlane(SCENE_REQUEST_ID, { status: "failed", error: { message: "provider rejected the prompt" } }),
    signPlane("scene-signature"),
    uploadPlane(),
  ));
  try {
    const response = await post(sceneStatusHandler, {
      project_id: "project-1",
      beat_id: SCENE_BEAT_ID,
      request_id: SCENE_REQUEST_ID,
    });
    assertEquals(response.status, 500);
    const body = await response.json() as { error?: string };
    assertIncludes(body.error ?? "", "provider rejected the prompt");
    assertEquals(
      calls.some((call) => call.url.includes("/storage/v1/")),
      false,
      "a failed job never stores or signs anything",
    );
  } finally {
    restore();
  }
});

Deno.test("scene-status: a completed job downloads, stores under the caller uid and signs", async () => {
  setTestEnv();
  const { calls, restore } = withFetch(chain(
    authPlane(),
    projectsPlane(sceneProject),
    muapiResultPlane(SCENE_REQUEST_ID, {
      status: "completed",
      outputs: [SCENE_OUTPUT_URL],
    }),
    downloadPlane(SCENE_OUTPUT_URL),
    uploadPlane(),
    signPlane("scene-signature"),
  ));
  try {
    const response = await post(sceneStatusHandler, {
      project_id: "project-1",
      beat_id: SCENE_BEAT_ID,
      request_id: SCENE_REQUEST_ID,
    });
    assertEquals(response.status, 200);
    const body = await response.json() as {
      status: string;
      assetUrl: string;
      assetRef: { bucket: string; path: string; kind: string };
      clipId: string;
    };
    assertEquals(body.status, "done");
    assertEquals(body.assetUrl, SCENE_SIGNED_URL);
    assertEquals(body.assetRef, { bucket: "videos", path: SCENE_STORAGE_PATH, kind: "video" });
    assertEquals(body.clipId, "clip-1");

    assertTrue(
      calls.some((call) => call.url === `${MUAPI_BASE}/predictions/${SCENE_REQUEST_ID}/result`),
      "the poll must hit the provider result endpoint",
    );
    const download = calls.find((call) => call.url === SCENE_OUTPUT_URL);
    assertTrue(Boolean(download), "the provider output must be downloaded before storing");

    const upload = calls.find((call) => call.url === `${SUPABASE_URL}/storage/v1/object/videos/${SCENE_STORAGE_PATH}`);
    assertTrue(Boolean(upload), "the clip is stored under the caller's uid-scoped path");

    const sign = calls.find((call) =>
      call.url === `${SUPABASE_URL}/storage/v1/object/sign/videos/${SCENE_STORAGE_PATH}`
    );
    assertTrue(Boolean(sign), "the stored clip is signed for immediate playback");
    assertEquals(JSON.parse(String(sign!.body)), { expiresIn: DEFAULT_SIGN_TTL_SECONDS });

    const patch = calls.find((call) => call.url.includes("/rest/v1/studio_projects") && call.method === "PATCH");
    assertTrue(Boolean(patch), "the clip is wired back into the project");
    const patchedProject = JSON.parse(String(patch!.body)).project as {
      tracks: Array<{ clips: Array<Record<string, unknown>> }>;
    };
    const clip = patchedProject.tracks[0].clips.find((entry) => entry.id === "clip-1");
    assertEquals(clip?.beatId, SCENE_BEAT_ID);
    assertEquals(clip?.assetRef, { bucket: "videos", path: SCENE_STORAGE_PATH, kind: "video" });
  } finally {
    restore();
  }
});

// --- muapi-captions ---------------------------------------------------------

Deno.test("muapi-captions: styled submit signs the source and hands the 1h URL to /ai-captions", async () => {
  setTestEnv();
  const { calls, restore } = withFetch(chain(
    authPlane(),
    projectsPlane(captionsProject),
    captionJobsPlane(),
    (url) => url === `${MUAPI_BASE}/ai-captions` ? jsonResponse({ request_id: "req_9", status: "queued" }) : null,
    signPlane("source-signature"),
  ));
  try {
    const response = await post(captionsHandler, {
      action: "submit",
      project_id: "project-1",
      clip_id: "clip-1",
      mode: "styled",
    });
    assertEquals(response.status, 200);
    const body = await response.json() as { job_id?: string; status?: string };
    assertEquals(body.job_id, "job-1");
    assertEquals(body.status, "running");

    const sign = calls.find((call) => call.url.includes("/storage/v1/object/sign/"));
    assertTrue(Boolean(sign), "the source clip must be signed before it is handed out");
    assertEquals(JSON.parse(String(sign!.body)), { expiresIn: 3600 });

    const insert = calls.find((call) => call.url.includes("/rest/v1/muapi_caption_jobs") && call.method === "POST");
    assertTrue(Boolean(insert), "the caption job row is created first");
    const insertBody = JSON.parse(String(insert!.body)) as Record<string, unknown>;
    assertEquals(insertBody.language, "English");
    assertEquals(insertBody.theme, "Hormozi_1");
    assertEquals(insertBody.status, "running");

    const captionsCall = calls.find((call) => call.url === `${MUAPI_BASE}/ai-captions`);
    assertTrue(Boolean(captionsCall), "the styled endpoint must be called");
    assertEquals(captionsCall!.method, "POST");
    assertEquals(JSON.parse(String(captionsCall!.body)), {
      video_url: CAPTION_SOURCE_SIGNED_URL,
      language: "English",
      theme: "Hormozi_1",
    });
    const headers = captionsCall!.init?.headers as Record<string, string>;
    assertEquals(headers["x-api-key"], "test-muapi-key");
  } finally {
    restore();
  }
});

Deno.test("muapi-captions: an invalid theme is a 400", async () => {
  setTestEnv();
  const { calls, restore } = withFetch(chain(authPlane()));
  try {
    const response = await post(captionsHandler, {
      action: "submit",
      project_id: "project-1",
      video_url: "https://cdn.example.com/video.mp4",
      mode: "styled",
      theme: "NotATheme",
    });
    assertEquals(response.status, 400);
    const body = await response.json() as { error?: string };
    assertIncludes(body.error ?? "", "Invalid theme");
    assertEquals(calls.some((call) => call.url.includes("muapi")), false);
    assertEquals(calls.some((call) => call.url.includes("/rest/v1/")), false);
  } finally {
    restore();
  }
});

Deno.test("muapi-captions: an invalid language is a 400", async () => {
  setTestEnv();
  const { calls, restore } = withFetch(chain(authPlane()));
  try {
    const response = await post(captionsHandler, {
      action: "submit",
      project_id: "project-1",
      video_url: "https://cdn.example.com/video.mp4",
      mode: "styled",
      language: "Klingon",
    });
    assertEquals(response.status, 400);
    const body = await response.json() as { error?: string };
    assertIncludes(body.error ?? "", "Invalid language");
    assertEquals(calls.some((call) => call.url.includes("muapi")), false);
    assertEquals(calls.some((call) => call.url.includes("/rest/v1/")), false);
  } finally {
    restore();
  }
});

Deno.test("muapi-captions: poll done stores under the caller uid with output_ref + output_url", async () => {
  setTestEnv();
  const { calls, restore } = withFetch(chain(
    authPlane(),
    captionJobsPlane(captionJobRow),
    muapiResultPlane("req_9", { status: "completed", outputs: [CAPTIONED_OUTPUT_URL] }),
    downloadPlane(CAPTIONED_OUTPUT_URL),
    uploadPlane(),
    signPlane("output-signature"),
  ));
  try {
    const response = await post(captionsHandler, { action: "poll", job_id: "job-1" });
    assertEquals(response.status, 200);
    const body = await response.json() as {
      status: string;
      output_ref: { bucket: string; path: string; kind: string };
      output_url: string;
    };
    assertEquals(body.status, "done");
    assertEquals(body.output_ref, {
      bucket: "videos",
      path: CAPTION_OUTPUT_STORAGE_PATH,
      kind: "video",
    });
    assertEquals(body.output_url, CAPTION_OUTPUT_SIGNED_URL);

    const upload = calls.find((call) =>
      call.url === `${SUPABASE_URL}/storage/v1/object/videos/${CAPTION_OUTPUT_STORAGE_PATH}`
    );
    assertTrue(Boolean(upload), "the captioned output is stored under the caller's uid");

    const patch = calls.find((call) => call.url.includes("/rest/v1/muapi_caption_jobs") && call.method === "PATCH");
    assertTrue(Boolean(patch), "the job row is updated with the canonical ref");
    const patchBody = JSON.parse(String(patch!.body)) as Record<string, unknown>;
    assertEquals(patchBody.status, "done");
    assertEquals(patchBody.output_ref, {
      bucket: "videos",
      path: CAPTION_OUTPUT_STORAGE_PATH,
      kind: "video",
    });
    assertEquals(patchBody.output_url, CAPTION_OUTPUT_SIGNED_URL);
  } finally {
    restore();
  }
});

// --- TTL constants ----------------------------------------------------------

Deno.test("media TTL: the default sign lifetime is one hour, never seven days", () => {
  assertEquals(DEFAULT_SIGN_TTL_SECONDS, 3600);
  assertEquals(MAX_SIGN_TTL_SECONDS, 3600);
  assertEquals([...MEDIA_BUCKETS], ["videos", "studio-uploads", "studio-exports"]);
});
