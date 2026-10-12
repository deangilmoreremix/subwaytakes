/**
 * auth_media_test.ts — media-sign request lifecycle.
 *
 * The exported handler is driven directly (Deno.serve is stubbed at import, the
 * same pattern plan-interview / generate-scene / media-sign use) and the whole
 * Supabase plane — GoTrue (getUser), PostgREST (studio_projects) and Storage
 * (createSignedUrl) — is emulated at the fetch boundary. Nothing here performs
 * a live provider or database call.
 */

// Importing media-sign starts its Deno.serve() listener, which would bind (and
// collide on) port 8000 inside the test runner. The serve call is stubbed away
// first; the exported handler is driven directly.
(globalThis.Deno as unknown as { serve: unknown }).serve = () => Promise.resolve();

const { handleMediaSignRequest } = await import("../media-sign/index.ts");
const { DEFAULT_SIGN_TTL_SECONDS, MEDIA_BUCKETS } = await import("../_shared/media.ts");

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
    throw new Error(`assertTrue failed: ${message ?? "expected true"}`);
  }
}

function assertIncludes(haystack: string, needle: string): void {
  assertTrue(haystack.includes(needle), `"${needle}" not found in "${haystack}"`);
}

// --- environment ------------------------------------------------------------
// Set inside the tests (not at module scope) so `deno test` runs without any
// permission flags beyond the ones `deno task test` already passes.

const SUPABASE_URL = "https://test-project.supabase.co";
const USER_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_USER_ID = "99999999-9999-9999-9999-999999999999";
const USER_TOKEN = "test-user-jwt";
const SIGN_TOKEN = "test-signature";

function setTestEnv(): void {
  Deno.env.set("SUPABASE_URL", SUPABASE_URL);
  Deno.env.set("SUPABASE_ANON_KEY", "test-anon-key");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
  Deno.env.delete("ALLOWED_ORIGINS");
}

// --- Supabase plane emulated at the fetch boundary -------------------------

interface RecordedCall {
  url: string;
  method: string;
  body?: string;
}

type FetchHandler = (url: string, init?: RequestInit) => Response;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const originalFetch = globalThis.fetch;

function withBackend(handler: FetchHandler): { calls: RecordedCall[]; restore: () => void } {
  const calls: RecordedCall[] = [];
  const stubbed: typeof globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
    calls.push({
      url,
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? init.body : undefined,
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

function authorizationHeader(init: RequestInit | undefined): string | null {
  const headers = init?.headers;
  if (!headers) return null;
  if (headers instanceof Headers) return headers.get("Authorization");
  if (Array.isArray(headers)) {
    const found = headers.find(([key]) => key.toLowerCase() === "authorization");
    return found ? found[1] : null;
  }
  const record = headers as Record<string, string>;
  const key = Object.keys(record).find((entry) => entry.toLowerCase() === "authorization");
  return key ? record[key] : null;
}

interface MediaSignBackend {
  /** studio_projects rows returned for the ownership lookup. */
  projects?: Array<{ project?: unknown }>;
  /** PostgREST failure (surfaced as a 500, never a 404). */
  restError?: { status: number; message: string };
  /** Storage signing failure. */
  signError?: { status: number; message: string };
}

/**
 * GoTrue accepts exactly one valid session; every other bearer (expired,
 * anon-role, service-role) is rejected with 401 before any data plane call.
 */
function mediaSignHandler(options: MediaSignBackend = {}): FetchHandler {
  return (url, init) => {
    if (url.includes("/auth/v1/user")) {
      if (authorizationHeader(init) === `Bearer ${USER_TOKEN}`) {
        return jsonResponse({
          id: USER_ID,
          email: "studio@subwaytakes.test",
          role: "authenticated",
        });
      }
      return jsonResponse(
        { code: 401, message: "Invalid or expired token", error_description: "invalid claim" },
        401,
      );
    }
    if (url.includes("/rest/v1/studio_projects")) {
      if (options.restError) {
        return jsonResponse(
          { message: options.restError.message, code: String(options.restError.status) },
          options.restError.status,
        );
      }
      return jsonResponse(options.projects ?? []);
    }
    if (url.includes("/storage/v1/object/sign/")) {
      if (options.signError) {
        return jsonResponse({ message: options.signError.message }, options.signError.status);
      }
      const objectPath = url.slice(url.indexOf("/object/sign/") + "/object/sign/".length);
      return jsonResponse({ signedURL: `/object/sign/${objectPath}?token=${SIGN_TOKEN}` });
    }
    return jsonResponse({ error: `unexpected backend url ${url}` }, 500);
  };
}

function stubMediaSign(options: MediaSignBackend = {}): { calls: RecordedCall[]; restore: () => void } {
  return withBackend(mediaSignHandler(options));
}

interface SignRequestOptions {
  token?: string | null;
  rawBody?: string;
}

function signRequest(body: unknown, options: SignRequestOptions = {}): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = options.token === undefined ? USER_TOKEN : options.token;
  if (token !== null) headers.Authorization = `Bearer ${token}`;
  return new Request(`${SUPABASE_URL}/functions/v1/media-sign`, {
    method: "POST",
    headers,
    body: options.rawBody ?? JSON.stringify(body),
  });
}

function dataCalls(calls: RecordedCall[]): RecordedCall[] {
  return calls.filter((call) => call.url.includes("/rest/v1/") || call.url.includes("/storage/v1/"));
}

function signCalls(calls: RecordedCall[]): RecordedCall[] {
  return calls.filter((call) => call.url.includes("/storage/v1/object/sign/"));
}

function restCalls(calls: RecordedCall[]): RecordedCall[] {
  return calls.filter((call) => call.url.includes("/rest/v1/"));
}

// --- protocol + body parsing ------------------------------------------------

Deno.test("media-sign: OPTIONS preflight returns 200", async () => {
  setTestEnv();
  const { calls, restore } = stubMediaSign();
  try {
    const response = await handleMediaSignRequest(
      new Request(`${SUPABASE_URL}/functions/v1/media-sign`, { method: "OPTIONS" }),
    );
    assertEquals(response.status, 200);
    assertEquals(await response.text(), "");
    assertEquals(calls.length, 0, "a preflight never reaches the data plane");
  } finally {
    restore();
  }
});

Deno.test("media-sign: GET (non-POST) is a 405", async () => {
  setTestEnv();
  const { calls, restore } = stubMediaSign();
  try {
    const response = await handleMediaSignRequest(
      new Request(`${SUPABASE_URL}/functions/v1/media-sign`, { method: "GET" }),
    );
    assertEquals(response.status, 405);
    const body = await response.json() as { error?: string };
    assertIncludes(body.error ?? "", "POST is required");
    assertEquals(dataCalls(calls).length, 0);
  } finally {
    restore();
  }
});

Deno.test("media-sign: unparseable JSON body is a 400", async () => {
  setTestEnv();
  const { calls, restore } = stubMediaSign();
  try {
    const response = await handleMediaSignRequest(
      signRequest(null, { rawBody: "{ not json at all" }),
    );
    assertEquals(response.status, 400);
    const body = await response.json() as { error?: string };
    assertIncludes(body.error ?? "", "Invalid JSON body");
    assertEquals(dataCalls(calls).length, 0);
  } finally {
    restore();
  }
});

Deno.test("media-sign: null, array and primitive bodies are 400s", async () => {
  setTestEnv();
  for (const rawBody of ["null", "[1,2,3]", '"just a string"']) {
    const { calls, restore } = stubMediaSign();
    try {
      const response = await handleMediaSignRequest(signRequest(null, { rawBody }));
      assertEquals(response.status, 400, `expected 400 for body ${rawBody}`);
      const body = await response.json() as { error?: string };
      assertIncludes(body.error ?? "", "must be a JSON object");
      assertEquals(dataCalls(calls).length, 0);
    } finally {
      restore();
    }
  }
});

// --- authentication ---------------------------------------------------------

Deno.test("media-sign: 401 without an Authorization header (no backend calls)", async () => {
  setTestEnv();
  const { calls, restore } = stubMediaSign();
  try {
    const response = await handleMediaSignRequest(
      signRequest({ bucket: "videos", path: `${USER_ID}/a.mp4` }, { token: null }),
    );
    assertEquals(response.status, 401);
    assertEquals(calls.length, 0, "a missing token never reaches GoTrue");
  } finally {
    restore();
  }
});

Deno.test("media-sign: 401 for an invalid bearer token", async () => {
  setTestEnv();
  const { calls, restore } = stubMediaSign();
  try {
    const response = await handleMediaSignRequest(
      signRequest({ bucket: "videos", path: `${USER_ID}/a.mp4` }, { token: "expired-user-jwt" }),
    );
    assertEquals(response.status, 401);
    assertEquals(dataCalls(calls).length, 0, "auth must fail before any data plane call");
    assertEquals(calls.filter((call) => call.url.includes("/auth/v1/user")).length, 1);
  } finally {
    restore();
  }
});

Deno.test("media-sign: 401 when the anon key is used as the bearer", async () => {
  setTestEnv();
  const { calls, restore } = stubMediaSign();
  try {
    const response = await handleMediaSignRequest(
      signRequest({ bucket: "videos", path: `${USER_ID}/a.mp4` }, { token: "test-anon-key" }),
    );
    assertEquals(response.status, 401);
    const body = await response.json() as { error?: string };
    assertIncludes(body.error ?? "", "token");
    assertEquals(dataCalls(calls).length, 0);
  } finally {
    restore();
  }
});

Deno.test("media-sign: 401 when the service role key is used as the bearer", async () => {
  setTestEnv();
  const { calls, restore } = stubMediaSign();
  try {
    const response = await handleMediaSignRequest(
      signRequest({ bucket: "videos", path: `${USER_ID}/a.mp4` }, { token: "test-service-role-key" }),
    );
    assertEquals(response.status, 401);
    assertEquals(dataCalls(calls).length, 0);
  } finally {
    restore();
  }
});

// --- bucket + path validation -----------------------------------------------

Deno.test("media-sign: unknown bucket is a 400", async () => {
  setTestEnv();
  const { calls, restore } = stubMediaSign();
  try {
    const response = await handleMediaSignRequest(
      signRequest({ bucket: "avatars", path: `${USER_ID}/a.mp4` }),
    );
    assertEquals(response.status, 400);
    const body = await response.json() as { error?: string };
    assertIncludes(body.error ?? "", "bucket must be one of:");
    assertIncludes(body.error ?? "", MEDIA_BUCKETS.join(", "));
    assertEquals(dataCalls(calls).length, 0);
  } finally {
    restore();
  }
});

Deno.test("media-sign: every allowed bucket can be signed", async () => {
  setTestEnv();
  assertEquals([...MEDIA_BUCKETS], ["videos", "studio-uploads", "studio-exports"]);
  const { calls, restore } = stubMediaSign();
  try {
    for (const bucket of MEDIA_BUCKETS) {
      const response = await handleMediaSignRequest(
        signRequest({ bucket, path: `${USER_ID}/clip.mp4`, kind: "video" }),
      );
      assertEquals(response.status, 200, `bucket ${bucket} must be accepted`);
      const body = await response.json() as { signedUrl: string };
      assertIncludes(body.signedUrl, `/object/sign/${bucket}/${USER_ID}/clip.mp4`);
    }
    assertEquals(signCalls(calls).length, 3);
    // Every Studio write is `<uid>/...`-scoped, so no project lookup is needed.
    assertEquals(restCalls(calls).length, 0);
  } finally {
    restore();
  }
});

Deno.test("media-sign: path guard rejects absolute, traversal, backslash and NUL paths", async () => {
  setTestEnv();
  const badPaths = [
    "",
    "   ",
    "/absolute/clip.mp4",
    "back\\slash.mp4",
    `${USER_ID}/../${OTHER_USER_ID}/clip.mp4`,
    `${USER_ID}/a\u0000b.mp4`,
  ];
  for (const path of badPaths) {
    const { calls, restore } = stubMediaSign();
    try {
      const response = await handleMediaSignRequest(signRequest({ bucket: "videos", path }));
      assertEquals(response.status, 400, `expected 400 for path "${path}"`);
      const body = await response.json() as { error?: string };
      assertTrue(Boolean(body.error), "a rejected path must explain itself");
      assertEquals(signCalls(calls).length, 0, "a rejected path is never signed");
    } finally {
      restore();
    }
  }
});

// --- ownership --------------------------------------------------------------

Deno.test("media-sign: <uid>/... paths need no database query", async () => {
  setTestEnv();
  const { calls, restore } = stubMediaSign();
  try {
    const response = await handleMediaSignRequest(
      signRequest({ bucket: "videos", path: `${USER_ID}/a.mp4`, ttl_seconds: 600 }),
    );
    assertEquals(response.status, 200);
    assertEquals(restCalls(calls).length, 0, "user-scoped paths never query studio_projects");
    assertEquals(signCalls(calls).length, 1);
  } finally {
    restore();
  }
});

Deno.test("media-sign: paths referenced by a project clip are owned", async () => {
  setTestEnv();
  const clipPath = `studio-scenes/${USER_ID}/project-1/scene.mp4`;
  const { calls, restore } = stubMediaSign({
    projects: [
      {
        project: {
          tracks: [
            {
              kind: "video",
              clips: [
                {
                  id: "c1",
                  beatId: "opening_hook",
                  assetRef: { bucket: "videos", path: clipPath, kind: "video" },
                },
              ],
            },
          ],
        },
      },
    ],
  });
  try {
    const response = await handleMediaSignRequest(
      signRequest({ bucket: "videos", path: clipPath, ttl_seconds: 900 }),
    );
    assertEquals(response.status, 200);
    assertEquals(restCalls(calls).length, 1, "ownership is verified against studio_projects");
    assertEquals(
      restCalls(calls)[0].url,
      `${SUPABASE_URL}/rest/v1/studio_projects?select=project&user_id=eq.${USER_ID}`,
    );
    assertEquals(JSON.parse(String(signCalls(calls)[0].body)), { expiresIn: 900 });
  } finally {
    restore();
  }
});

Deno.test("media-sign: paths referenced by branding.logoRef are owned", async () => {
  setTestEnv();
  const logoPath = `studio-scenes/${USER_ID}/project-1/logo.png`;
  const { calls, restore } = stubMediaSign({
    projects: [
      {
        project: {
          branding: { logoRef: { bucket: "studio-uploads", path: logoPath, kind: "image" } },
        },
      },
    ],
  });
  try {
    const response = await handleMediaSignRequest(
      signRequest({ bucket: "studio-uploads", path: logoPath }),
    );
    assertEquals(response.status, 200);
    const body = await response.json() as { signedUrl: string };
    assertIncludes(body.signedUrl, `/object/sign/studio-uploads/${logoPath}`);
    // the ownership proof went through the caller's project lookup (rule b):
    // exactly one PostgREST query, scoped to the caller
    const ownershipQueries = restCalls(calls);
    assertEquals(ownershipQueries.length, 1);
    assertIncludes(ownershipQueries[0]!.url, "studio_projects");
    assertIncludes(ownershipQueries[0]!.url, encodeURIComponent(USER_ID));
  } finally {
    restore();
  }
});

Deno.test("media-sign: unreferenced paths are a 404 with no signing attempt", async () => {
  setTestEnv();
  const { calls, restore } = stubMediaSign({
    projects: [
      {
        project: {
          tracks: [
            {
              kind: "video",
              clips: [
                {
                  id: "c1",
                  assetRef: { bucket: "videos", path: "studio-scenes/other/scene.mp4", kind: "video" },
                },
              ],
            },
          ],
        },
      },
    ],
  });
  try {
    const response = await handleMediaSignRequest(
      signRequest({ bucket: "videos", path: `studio-scenes/${USER_ID}/project-1/never-referenced.mp4` }),
    );
    assertEquals(response.status, 404);
    const body = await response.json() as { error?: string };
    assertEquals(body.error, "Not found");
    assertEquals(signCalls(calls).length, 0, "no existence leak: nothing is signed on a 404");
  } finally {
    restore();
  }
});

Deno.test("media-sign: another user's path 404s with the lookup scoped to the caller", async () => {
  setTestEnv();
  const { calls, restore } = stubMediaSign({
    projects: [{ project: { tracks: [{ clips: [] }] } }],
  });
  try {
    const response = await handleMediaSignRequest(
      signRequest({ bucket: "videos", path: `${OTHER_USER_ID}/project-9/clip.mp4` }),
    );
    assertEquals(response.status, 404);
    const body = await response.json() as { error?: string };
    assertEquals(body.error, "Not found");
    assertEquals(restCalls(calls).length, 1);
    assertEquals(
      restCalls(calls)[0].url,
      `${SUPABASE_URL}/rest/v1/studio_projects?select=project&user_id=eq.${USER_ID}`,
    );
    assertEquals(signCalls(calls).length, 0);
  } finally {
    restore();
  }
});

// --- ttl + signing ----------------------------------------------------------

Deno.test("media-sign: ttl is clamped onto the sign request (604800, 1, junk)", async () => {
  setTestEnv();
  const cases: Array<{ requested: unknown; expected: number }> = [
    { requested: 604800, expected: 3600 },
    { requested: 1, expected: 60 },
    { requested: "soon", expected: DEFAULT_SIGN_TTL_SECONDS },
  ];
  for (const { requested, expected } of cases) {
    const { calls, restore } = stubMediaSign();
    try {
      const before = Date.now();
      const response = await handleMediaSignRequest(
        signRequest({ bucket: "videos", path: `${USER_ID}/a.mp4`, ttl_seconds: requested }),
      );
      const after = Date.now();
      assertEquals(response.status, 200, `ttl ${String(requested)} must still sign`);
      assertEquals(JSON.parse(String(signCalls(calls)[0].body)), { expiresIn: expected });
      const body = await response.json() as { expiresAt: number };
      assertTrue(
        body.expiresAt >= before + expected * 1000 && body.expiresAt <= after + expected * 1000,
        "expiresAt must equal Date.now() + ttl * 1000",
      );
    } finally {
      restore();
    }
  }
});

Deno.test("media-sign: a storage signing failure is a 500", async () => {
  setTestEnv();
  const { calls, restore } = stubMediaSign({
    signError: { status: 503, message: "signing service unavailable" },
  });
  try {
    const response = await handleMediaSignRequest(
      signRequest({ bucket: "videos", path: `${USER_ID}/a.mp4` }),
    );
    assertEquals(response.status, 500);
    const body = await response.json() as { error?: string };
    assertIncludes(body.error ?? "", "Could not sign");
    assertIncludes(body.error ?? "", "signing service unavailable");
    assertEquals(signCalls(calls).length, 1);
  } finally {
    restore();
  }
});

Deno.test("media-sign: an ownership query failure is a 500, not a 404", async () => {
  setTestEnv();
  const { calls, restore } = stubMediaSign({
    restError: { status: 400, message: "permission denied for table studio_projects" },
  });
  try {
    const response = await handleMediaSignRequest(
      signRequest({ bucket: "videos", path: `studio-scenes/${USER_ID}/p/scene.mp4` }),
    );
    assertEquals(response.status, 500);
    const body = await response.json() as { error?: string };
    assertIncludes(body.error ?? "", "Failed to verify media ownership");
    assertIncludes(body.error ?? "", "permission denied for table studio_projects");
    assertEquals(signCalls(calls).length, 0);
  } finally {
    restore();
  }
});

Deno.test("media-sign: response shape is signedUrl + expiresAt + bucket + path", async () => {
  setTestEnv();
  const path = `${USER_ID}/project-1/clip.mp4`;
  const { calls, restore } = stubMediaSign();
  try {
    const before = Date.now();
    const response = await handleMediaSignRequest(
      signRequest({ bucket: "studio-uploads", path, kind: "video", ttl_seconds: 600 }),
    );
    const after = Date.now();
    assertEquals(response.status, 200);
    assertEquals(response.headers.get("content-type"), "application/json");
    assertEquals(response.headers.get("access-control-allow-origin"), "*");

    const body = await response.json() as Record<string, unknown>;
    assertEquals(Object.keys(body).sort(), ["bucket", "expiresAt", "path", "signedUrl"]);
    assertEquals(body.bucket, "studio-uploads");
    assertEquals(body.path, path);
    assertEquals(
      body.signedUrl,
      `${SUPABASE_URL}/storage/v1/object/sign/studio-uploads/${path}?token=${SIGN_TOKEN}`,
    );
    assertTrue(
      (body.expiresAt as number) >= before + 600 * 1000 &&
        (body.expiresAt as number) <= after + 600 * 1000,
      "expiresAt must equal Date.now() + ttl * 1000",
    );
    assertEquals(restCalls(calls).length, 0);
    assertEquals(signCalls(calls).length, 1);
  } finally {
    restore();
  }
});
