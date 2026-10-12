import { MuapiError } from "../_shared/muapi.ts";

// Importing the function modules starts their Deno.serve() listener, which
// would bind (and collide on) port 8000 inside the test runner. The serve call
// is stubbed away first; every test drives the exported handlers directly.
const originalServe = Deno.serve;
(globalThis.Deno as unknown as { serve: unknown }).serve = () => Promise.resolve();

const {
  BEAT_IDS,
  PLAN_SCHEMA,
  buildUserPrompt,
  handlePlanInterviewRequest,
  parsePlan,
} = await import("../plan-interview/index.ts");

const {
  MUAPI_MODELS,
  SUBMIT_ATTEMPTS,
  buildSceneMuapiRequest,
  handleGenerateSceneRequest,
  parseGenerateSceneRequest,
  submitWithRetries,
} = await import("../generate-scene/index.ts");

void originalServe;

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

// --- environment ------------------------------------------------------------
// Set inside the tests (not at module scope) so `deno test` runs without any
// permission flags: Deno.env.set at module scope requires --allow-env.

function setTestEnv(): void {
  Deno.env.set("SUPABASE_URL", "https://test-project.supabase.co");
  Deno.env.set("SUPABASE_ANON_KEY", "test-anon-key");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
  Deno.env.set("MUAPI_API_KEY", "test-muapi-key");
  Deno.env.set("OPENAI_API_KEY", "test-openai-key");
  Deno.env.delete("MUAPI_BASE_URL");
}

// --- fetch stub -------------------------------------------------------------

interface RecordedCall {
  url: string;
  init?: RequestInit;
}

type FetchHandler = (url: string, init?: RequestInit) => Response;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const originalFetch = globalThis.fetch;

function withFetch(handler: FetchHandler): { calls: RecordedCall[]; restore: () => void } {
  const calls: RecordedCall[] = [];
  const stubbed: typeof globalThis.fetch = async (input, init) => {
    const url = typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : (input as Request).url;
    calls.push({ url, init });
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

/** Supabase auth (getUser) + PostgREST project lookup for an owned project. */
function supabaseBackend(url: string): Response | null {
  if (url.includes("/auth/v1/user")) {
    return jsonResponse({ id: "user-1", email: "user-1@example.com" });
  }
  if (url.includes("/rest/v1/studio_projects")) {
    return jsonResponse([{ user_id: "user-1" }]);
  }
  return null;
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
        Authorization: "Bearer test-user-jwt",
      },
      body: JSON.stringify(body),
    }),
  );
}

function validPlanPayload() {
  return {
    title: "Is the subway getting worse?",
    hookQuestion: "Is the NYC subway actually getting worse?",
    handle: "@subwaytakes",
    beats: BEAT_IDS.map((beatId) => ({
      beatId,
      shotType: "host",
      speaker: "host",
      dialogue: `dialogue for ${beatId}`,
      cameraDirection: `camera for ${beatId}`,
      videoPrompt: `prompt for ${beatId} — documentary, natural lighting, no AI artifacts`,
    })),
  };
}

// --- plan-interview ---------------------------------------------------------

Deno.test("plan-interview: 500 (never a fabricated plan) when OPENAI_API_KEY is missing", async () => {
  setTestEnv();
  Deno.env.delete("OPENAI_API_KEY");
  const { calls, restore } = withFetch((url) => supabaseBackend(url) ?? jsonResponse({}, 500));
  try {
    const response = await post(handlePlanInterviewRequest, { topic: "subway safety" });
    assertEquals(response.status, 500);
    const body = await response.json() as { error?: string };
    assertIncludes(body.error ?? "", "OPENAI_API_KEY");
    assertTrue(
      !calls.some((call) => call.url.includes("api.openai.com")),
      "no provider call may be attempted without a key",
    );
  } finally {
    Deno.env.set("OPENAI_API_KEY", "test-openai-key");
    restore();
  }
});

Deno.test("plan-interview: strict json_schema request + 7 beats returned in order", async () => {
  setTestEnv();
  const { calls, restore } = withFetch((url) => {
    const backend = supabaseBackend(url);
    if (backend) return backend;
    if (url === "https://api.openai.com/v1/responses") {
      return jsonResponse({ output_text: JSON.stringify(validPlanPayload()) });
    }
    return jsonResponse({ error: `unexpected url ${url}` }, 500);
  });
  try {
    const response = await post(handlePlanInterviewRequest, {
      topic: "Is the subway getting worse?",
      hostDescription: "a confident interviewer in a puffer jacket with a card mic",
      guestDescription: "a relatable New Yorker in their 30s",
      environment: "a NYC subway platform as the train pulls in",
    });
    assertEquals(response.status, 200);

    const body = await response.json() as { plan: { beats: Array<{ beatId: string }> } };
    assertEquals(body.plan.beats.length, 7);
    assertEquals(
      body.plan.beats.map((beat) => beat.beatId),
      [...BEAT_IDS],
    );

    const openaiCall = calls.find((call) => call.url === "https://api.openai.com/v1/responses");
    assertTrue(Boolean(openaiCall), "OpenAI Responses API must be called");
    const payload = JSON.parse(String(openaiCall!.init?.body)) as {
      text: { format: { type: string; name: string; strict: boolean; schema: Record<string, unknown> } };
      instructions: string;
      input: string;
    };
    assertEquals(payload.text.format.type, "json_schema");
    assertEquals(payload.text.format.name, "interview_plan");
    assertEquals(payload.text.format.strict, true);
    const beatsSchema = (payload.text.format.schema.properties as {
      beats: { minItems: number; maxItems: number };
    }).beats;
    assertEquals(beatsSchema.minItems, 7);
    assertEquals(beatsSchema.maxItems, 7);
    assertIncludes(payload.instructions, "exact order");
    assertIncludes(payload.input, "HOST (the interviewer)");
    assertIncludes(payload.input, "GUEST (the interviewee)");
    assertIncludes(payload.input, "SUBWAY ENVIRONMENT");
  } finally {
    restore();
  }
});

Deno.test("plan-interview: 500 when the model returns the wrong number of beats", async () => {
  setTestEnv();
  const payload = validPlanPayload();
  payload.beats = payload.beats.slice(0, 6);
  const { restore } = withFetch((url) => {
    const backend = supabaseBackend(url);
    if (backend) return backend;
    return jsonResponse({ output_text: JSON.stringify(payload) });
  });
  try {
    const response = await post(handlePlanInterviewRequest, { topic: "subway safety" });
    assertEquals(response.status, 500);
    const body = await response.json() as { error?: string };
    assertIncludes(body.error ?? "", "expected 7 beats, got 6");
  } finally {
    restore();
  }
});

Deno.test("plan-interview: 500 when the beats come back out of order", async () => {
  setTestEnv();
  const payload = validPlanPayload();
  const first = payload.beats[0];
  payload.beats[0] = payload.beats[1];
  payload.beats[1] = first;
  const { restore } = withFetch((url) => {
    const backend = supabaseBackend(url);
    if (backend) return backend;
    return jsonResponse({ output_text: JSON.stringify(payload) });
  });
  try {
    const response = await post(handlePlanInterviewRequest, { topic: "subway safety" });
    assertEquals(response.status, 500);
    const body = await response.json() as { error?: string };
    assertIncludes(body.error ?? "", "beat 0 must be");
  } finally {
    restore();
  }
});

Deno.test("plan-interview: 500 when title or hookQuestion is missing", async () => {
  setTestEnv();
  const payload = validPlanPayload();
  delete (payload as unknown as Record<string, unknown>).title;
  const { restore } = withFetch((url) => {
    const backend = supabaseBackend(url);
    if (backend) return backend;
    return jsonResponse({ output_text: JSON.stringify(payload) });
  });
  try {
    const response = await post(handlePlanInterviewRequest, { topic: "subway safety" });
    assertEquals(response.status, 500);
    const body = await response.json() as { error?: string };
    assertIncludes(body.error ?? "", "title and hookQuestion are required");
  } finally {
    restore();
  }
});

Deno.test("plan-interview: surfaces the upstream error instead of falling back", async () => {
  setTestEnv();
  const { restore } = withFetch((url) => {
    const backend = supabaseBackend(url);
    if (backend) return backend;
    return jsonResponse({ error: { message: "model overloaded" } }, 503);
  });
  try {
    const response = await post(handlePlanInterviewRequest, { topic: "subway safety" });
    assertEquals(response.status, 500);
    const body = await response.json() as { error?: string };
    assertIncludes(body.error ?? "", "OpenAI API error: 503");
    assertIncludes(body.error ?? "", "model overloaded");
  } finally {
    restore();
  }
});

Deno.test("plan-interview: 400 on an empty or oversized topic", async () => {
  setTestEnv();
  const { restore } = withFetch((url) => supabaseBackend(url) ?? jsonResponse({}, 500));
  try {
    const empty = await post(handlePlanInterviewRequest, { topic: "  " });
    assertEquals(empty.status, 400);

    const tooLong = await post(handlePlanInterviewRequest, { topic: "x".repeat(2001) });
    assertEquals(tooLong.status, 400);
  } finally {
    restore();
  }
});

Deno.test("plan-interview: no fallback script — failures are 500s, never synthetic plans", async () => {
  setTestEnv();
  // The schema is strict JSON Schema with exactly 7 ordered beats.
  assertEquals(PLAN_SCHEMA.type, "object");
  assertEquals((PLAN_SCHEMA.required as string[]).includes("beats"), true);
  const beatsSchema = (PLAN_SCHEMA.properties as {
    beats: { minItems: number; maxItems: number; items: { properties: Record<string, { minLength?: number }> } };
  }).beats;
  assertEquals(beatsSchema.minItems, 7);
  assertEquals(beatsSchema.maxItems, 7);
  assertEquals(beatsSchema.items.properties.dialogue.minLength, 1);
  assertEquals(beatsSchema.items.properties.videoPrompt.minLength, 1);

  const prompt = buildUserPrompt({ topic: "topic", hostDescription: "host", guestDescription: "guest" });
  assertIncludes(prompt, "TOPIC: topic");
  assertIncludes(prompt, "HOST (the interviewer): host");
  assertIncludes(prompt, "GUEST (the interviewee): guest");

  const plan = parsePlan(validPlanPayload() as unknown as Record<string, unknown>);
  assertEquals(plan.beats[0].beatId, BEAT_IDS[0]);

  // No OPENAI_API_KEY -> 500 (no canned script). Upstream error -> 500.
  Deno.env.delete("OPENAI_API_KEY");
  const { calls, restore } = withFetch((url) => supabaseBackend(url) ?? jsonResponse({}, 500));
  try {
    const response = await post(handlePlanInterviewRequest, { topic: "subway safety" });
    assertEquals(response.status, 500);
    assertEquals(calls.some((call) => call.url.includes("api.openai.com")), false);
  } finally {
    Deno.env.set("OPENAI_API_KEY", "test-openai-key");
    restore();
  }
});

// --- generate-scene ---------------------------------------------------------

Deno.test("generate-scene: validation rejects bad beat ids, prompts, models and shot types", () => {
  setTestEnv();
  const base = {
    project_id: "project-1",
    beat_id: "opening_hook",
    prompt: "a documentary subway clip",
  };

  assertEquals(parseGenerateSceneRequest({ ...base, beat_id: "nope" }), {
    ok: false,
    error: `beat_id is required and must be one of: ${BEAT_IDS.join(", ")}`,
  });
  assertTrue(!parseGenerateSceneRequest({ ...base, prompt: "   " }).ok);
  assertTrue(!parseGenerateSceneRequest({ ...base, model: "sora" as never }).ok);
  assertTrue(!parseGenerateSceneRequest({ ...base, shot_type: "drone" }).ok);
  assertTrue(!parseGenerateSceneRequest({ ...base, project_id: "" }).ok);

  const ok = parseGenerateSceneRequest({ ...base, model: "kling", shot_type: "two_shot" });
  assertTrue(ok.ok);
  if (ok.ok) {
    assertEquals(ok.value.model, "kling");
    assertEquals(ok.value.shotType, "two_shot");
    assertEquals(ok.value.prompt, "a documentary subway clip");
  }

  const defaulted = parseGenerateSceneRequest(base);
  assertTrue(defaulted.ok);
  if (defaulted.ok) {
    assertEquals(defaulted.value.model, "veo3");
    assertEquals(defaulted.value.shotType, undefined);
  }
});

Deno.test("generate-scene: MuAPI payload is vertical 9:16 per model", () => {
  setTestEnv();
  assertEquals(MUAPI_MODELS, ["veo3", "seedance", "kling"]);

  const veo3 = buildSceneMuapiRequest("veo3", "host on the platform");
  assertEquals(veo3.endpoint, "veo3-text-to-video");
  assertEquals(veo3.payload, { prompt: "host on the platform", aspect_ratio: "9:16" });

  const seedance = buildSceneMuapiRequest("seedance", "guest responds");
  assertEquals(seedance.endpoint, "seedance-pro-t2v");
  assertEquals(seedance.payload, {
    prompt: "guest responds",
    aspect_ratio: "9:16",
    resolution: "1080p",
    duration: 5,
  });

  const kling = buildSceneMuapiRequest("kling", "reaction shot");
  assertEquals(kling.endpoint, "kling-v2.1-master-t2v");
  assertEquals(kling.payload, {
    prompt: "reaction shot",
    aspect_ratio: "9:16",
    duration: 5,
  });
});

Deno.test("generate-scene: retries retryable failures with backoff, then succeeds", async () => {
  setTestEnv();
  let attempts = 0;
  const slept: number[] = [];
  const requestId = await submitWithRetries(
    "veo3-text-to-video",
    { prompt: "x" },
    {
      submit: async () => {
        attempts += 1;
        if (attempts < 3) {
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
  assertEquals(attempts, 3);
  assertEquals(slept, [1000, 2000]);
});

Deno.test("generate-scene: non-retryable provider errors fail immediately", async () => {
  setTestEnv();
  let attempts = 0;
  let caught: unknown = null;
  try {
    await submitWithRetries(
      "veo3-text-to-video",
      { prompt: "x" },
      {
        submit: async () => {
          attempts += 1;
          throw new MuapiError("MuAPI submit failed (400): invalid prompt", 500, 400);
        },
        sleep: async () => {},
      },
    );
  } catch (error) {
    caught = error;
  }
  assertEquals(attempts, 1);
  assertTrue(caught instanceof MuapiError);
  assertIncludes((caught as Error).message, "invalid prompt");
});

Deno.test("generate-scene: exhausts every attempt before surfacing the failure", async () => {
  setTestEnv();
  let attempts = 0;
  let caught: unknown = null;
  try {
    await submitWithRetries(
      "veo3-text-to-video",
      { prompt: "x" },
      {
        submit: async () => {
          attempts += 1;
          throw new MuapiError("MuAPI submit failed (503): overloaded", 500, 503);
        },
        sleep: async () => {},
      },
    );
  } catch (error) {
    caught = error;
  }
  assertEquals(attempts, SUBMIT_ATTEMPTS);
  assertTrue(caught instanceof MuapiError);
});

Deno.test("generate-scene: handler submits to MuAPI and returns the request id", async () => {
  setTestEnv();
  const { calls, restore } = withFetch((url) => {
    const backend = supabaseBackend(url);
    if (backend) return backend;
    if (url === "https://api.muapi.ai/api/v1/veo3-text-to-video") {
      return jsonResponse({ request_id: "req_42", status: "queued" });
    }
    return jsonResponse({ error: `unexpected url ${url}` }, 500);
  });
  try {
    const response = await post(handleGenerateSceneRequest, {
      project_id: "project-1",
      beat_id: "guest_responds",
      prompt: "guest responds on the subway",
      model: "veo3",
    });
    assertEquals(response.status, 200);
    const body = await response.json() as { request_id?: string; beat_id?: string };
    assertEquals(body.request_id, "req_42");
    assertEquals(body.beat_id, "guest_responds");

    assertTrue(
      calls.some((call) => call.url.includes("/rest/v1/studio_projects")),
      "project ownership must be asserted before submitting",
    );
    const muapiCall = calls.find((call) => call.url.includes("veo3-text-to-video"));
    assertTrue(Boolean(muapiCall), "MuAPI text-to-video must be called");
    const payload = JSON.parse(String(muapiCall!.init?.body)) as Record<string, unknown>;
    assertEquals(payload.aspect_ratio, "9:16");
    assertEquals(payload.prompt, "guest responds on the subway");
    const headers = muapiCall!.init?.headers as Record<string, string>;
    assertEquals(headers["x-api-key"], "test-muapi-key");
  } finally {
    restore();
  }
});

Deno.test("generate-scene: handler surfaces MuAPI failures as 500 with no fake success", async () => {
  setTestEnv();
  const { restore } = withFetch((url) => {
    const backend = supabaseBackend(url);
    if (backend) return backend;
    if (url.includes("veo3-text-to-video")) {
      return jsonResponse({ error: "insufficient credits" }, 402);
    }
    return jsonResponse({ error: `unexpected url ${url}` }, 500);
  });
  try {
    const response = await post(handleGenerateSceneRequest, {
      project_id: "project-1",
      beat_id: "opening_hook",
      prompt: "host opens the interview",
    });
    assertEquals(response.status, 500);
    const body = await response.json() as { error?: string };
    assertIncludes(body.error ?? "", "insufficient credits");
    assertTrue(!body.error?.includes("request_id"), "no request id may be reported on failure");
  } finally {
    restore();
  }
});

Deno.test("generate-scene: 400 on invalid bodies before any provider call", async () => {
  setTestEnv();
  const { calls, restore } = withFetch((url) => supabaseBackend(url) ?? jsonResponse({}, 500));
  try {
    const response = await post(handleGenerateSceneRequest, {
      project_id: "project-1",
      beat_id: "not_a_beat",
      prompt: "x",
    });
    assertEquals(response.status, 400);
    assertEquals(
      calls.some((call) => call.url.includes("muapi") || call.url.includes("openai")),
      false,
    );
  } finally {
    restore();
  }
});
