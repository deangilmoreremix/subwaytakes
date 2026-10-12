import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  DEFAULT_SIGN_TTL_SECONDS,
  MAX_SIGN_TTL_SECONDS,
  MEDIA_BUCKETS,
  MIN_SIGN_TTL_SECONDS,
  assertMediaBucket,
  assertMediaPath,
  assertRefOwnedOrThrow,
  clampSignTtl,
  findUnownedClipRefs,
  isMediaBucket,
  isOwnedPath,
  isMediaRef,
  projectContainsRef,
  refFromUrl,
  signRef,
  type MediaRef,
} from "../_shared/media.ts";
import { HttpError } from "../_shared/cors.ts";
import { NotFoundError } from "../_shared/ownership.ts";

const USER_ID = "11111111-2222-3333-4444-555555555555";
const OTHER_USER_ID = "99999999-8888-7777-6666-555555555555";

// ---------------------------------------------------------------------------
// tiny assertion helpers (the suite stays hermetic: no jsr/@std dependency)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// fakes
// ---------------------------------------------------------------------------

interface SignedUrlCall {
  bucket: string;
  path: string;
  ttl: number;
}

/** Fake service client recording createSignedUrl() arguments. */
function fakeStorageClient(
  signedUrl: string | null,
  error: { message: string } | null = null,
): { client: SupabaseClient; calls: SignedUrlCall[] } {
  const calls: SignedUrlCall[] = [];
  const client = {
    storage: {
      from(bucket: string) {
        return {
          async createSignedUrl(path: string, ttl: number) {
            calls.push({ bucket, path, ttl });
            if (error) return { data: null, error };
            return { data: { signedUrl }, error: null };
          },
        };
      },
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

interface ProjectRow {
  project?: unknown;
}

/** Fake service client for the studio_projects ownership lookup. */
function fakeProjectsClient(
  rows: ProjectRow[],
  error: { message: string } | null = null,
): { client: SupabaseClient; queried: string[] } {
  const queried: string[] = [];
  const client = {
    from(table: string) {
      queried.push(table);
      return {
        select() {
          return this;
        },
        eq(column: string, value: string) {
          queried.push(`${table}.${column}=${value}`);
          return this;
        },
        async then(resolve: (value: unknown) => unknown) {
          if (error) return resolve({ data: null, error });
          return resolve({ data: rows, error: null });
        },
      };
    },
  };
  return { client: client as unknown as SupabaseClient, queried };
}

const uploadRef: MediaRef = {
  bucket: "studio-uploads",
  path: `${USER_ID}/project-1/clip.mp4`,
  kind: "video",
};

const sceneRef: MediaRef = {
  bucket: "videos",
  path: `studio-scenes/${USER_ID}/project-1/scene.mp4`,
  kind: "video",
};

// ---------------------------------------------------------------------------
// bucket allowlist
// ---------------------------------------------------------------------------

Deno.test("bucket allowlist: only the studio buckets are accepted", () => {
  assertEquals([...MEDIA_BUCKETS], ["videos", "studio-uploads", "studio-exports"]);
  assertTrue(isMediaBucket("videos"));
  assertTrue(isMediaBucket("studio-uploads"));
  assertTrue(isMediaBucket("studio-exports"));
  assertTrue(!isMediaBucket("avatars"));
  assertTrue(!isMediaBucket(""));
  assertTrue(!isMediaBucket(undefined));
  assertTrue(!isMediaBucket(null));
  assertTrue(!isMediaBucket(42));

  assertEquals(assertMediaBucket("videos"), "videos");

  let caught: unknown = null;
  try {
    assertMediaBucket("some-other-bucket");
  } catch (error) {
    caught = error;
  }
  assertTrue(caught instanceof HttpError, "expected an HttpError");
  if (caught instanceof HttpError) {
    assertEquals(caught.status, 400);
    assertIncludes(caught.message, "studio-exports");
  }
});

Deno.test("ttl clamp: 60..3600 seconds, junk falls back to one hour", () => {
  assertEquals(clampSignTtl(undefined), DEFAULT_SIGN_TTL_SECONDS);
  assertEquals(clampSignTtl("600"), DEFAULT_SIGN_TTL_SECONDS);
  assertEquals(clampSignTtl(Number.NaN), DEFAULT_SIGN_TTL_SECONDS);
  assertEquals(clampSignTtl(1), MIN_SIGN_TTL_SECONDS);
  assertEquals(clampSignTtl(-50), MIN_SIGN_TTL_SECONDS);
  assertEquals(clampSignTtl(90), 90);
  assertEquals(clampSignTtl(3600), 3600);
  assertEquals(clampSignTtl(60), MIN_SIGN_TTL_SECONDS);
  // The whole point: nothing longer than an hour is ever minted.
  assertEquals(clampSignTtl(604800), MAX_SIGN_TTL_SECONDS);
  assertEquals(clampSignTtl(315360000), MAX_SIGN_TTL_SECONDS);
});

Deno.test("path guard: traversal and absolute paths are rejected", () => {
  let caught: unknown = null;
  try {
    assertMediaPath("../someone-else/clip.mp4");
  } catch (error) {
    caught = error;
  }
  assertTrue(caught instanceof HttpError);
  if (caught instanceof HttpError) assertEquals(caught.status, 400);

  for (const bad of ["", "   ", "/abs/path.mp4", "a//b.mp4", "a/./b.mp4", "back\\slash.mp4"]) {
    let thrown = false;
    try {
      assertMediaPath(bad);
    } catch (error) {
      thrown = error instanceof HttpError;
    }
    assertTrue(thrown, `expected "${bad}" to be rejected`);
  }
  assertEquals(assertMediaPath(`${USER_ID}/p/clip.mp4`), `${USER_ID}/p/clip.mp4`);
});

// ---------------------------------------------------------------------------
// signRef
// ---------------------------------------------------------------------------

Deno.test("signRef: signs with (path, ttl) and computes expiry from the ttl", async () => {
  const { client, calls } = fakeStorageClient("https://signed.example.com/clip.mp4?sig=1");

  const before = Date.now();
  const signed = await signRef(client, uploadRef, 600);
  const after = Date.now();

  assertEquals(calls.length, 1);
  assertEquals(calls[0].bucket, "studio-uploads");
  assertEquals(calls[0].path, uploadRef.path);
  assertEquals(calls[0].ttl, 600);

  assertIncludes(signed.url, "https://signed.example.com/clip.mp4");
  assertTrue(
    signed.expiresAt >= before + 600 * 1000 && signed.expiresAt <= after + 600 * 1000,
    "expiresAt must equal Date.now() + ttl * 1000",
  );
});

Deno.test("signRef: default ttl is one hour and unknown buckets are rejected", async () => {
  const { client, calls } = fakeStorageClient("https://signed.example.com/clip.mp4");
  const signed = await signRef(client, uploadRef);
  assertEquals(calls[0].ttl, DEFAULT_SIGN_TTL_SECONDS);
  assertTrue(signed.expiresAt > Date.now() + 3500 * 1000);

  let caught: unknown = null;
  try {
    await signRef(client, { ...uploadRef, bucket: "avatars" });
  } catch (error) {
    caught = error;
  }
  assertTrue(caught instanceof HttpError);
  assertEquals(calls.length, 1, "no signing attempt for a disallowed bucket");
});

Deno.test("signRef: storage failures become a 500 HttpError", async () => {
  const { client } = fakeStorageClient(null, { message: "object not found" });
  await expectThrows(signRef(client, uploadRef), (error) => {
    assertTrue(error instanceof HttpError, `expected HttpError, got ${String(error)}`);
    if (error instanceof HttpError) {
      assertEquals(error.status, 500);
      assertIncludes(error.message, "object not found");
    }
  });

  const noUrl = fakeStorageClient(null);
  await expectThrows(signRef(noUrl.client, uploadRef), (error) => {
    assertTrue(error instanceof HttpError);
  });

  const malformed = fakeStorageClient("not-a-url");
  await expectThrows(signRef(malformed.client, uploadRef), (error) => {
    assertTrue(error instanceof HttpError);
  });
});

Deno.test("signRef: malformed refs are rejected before any signing", async () => {
  const { client, calls } = fakeStorageClient("https://signed.example.com/clip.mp4");
  await expectThrows(signRef(client, { bucket: "videos" } as unknown as MediaRef), (error) => {
    assertTrue(error instanceof HttpError);
    if (error instanceof HttpError) assertEquals(error.status, 400);
  });
  assertEquals(calls.length, 0);
});

// ---------------------------------------------------------------------------
// assertRefOwnedOrThrow
// ---------------------------------------------------------------------------

Deno.test("assertRefOwnedOrThrow: allows <uid>/... without touching the database", async () => {
  const { client, queried } = fakeProjectsClient([]);
  await assertRefOwnedOrThrow(uploadRef, USER_ID, client);
  assertEquals(queried.length, 0, "user-scoped paths never query studio_projects");
});

Deno.test("assertRefOwnedOrThrow: allows refs referenced by the caller's projects", async () => {
  const { client, queried } = fakeProjectsClient([
    { project: { tracks: [{ kind: "video", clips: [{ id: "c1", assetRef: sceneRef }] }] } },
    { project: { tracks: [{ kind: "video", clips: [{ id: "c2", assetUrl: "https://cdn/x.mp4" }] }] } },
    { project: { branding: { logoRef: { bucket: "videos", path: "studio-scenes/x/logo.png", kind: "image" } } } },
  ]);

  await assertRefOwnedOrThrow(sceneRef, USER_ID, client);
  assertEquals(queried, ["studio_projects", `studio_projects.user_id=${USER_ID}`]);

  // The logo ref of the third project is reachable too.
  await assertRefOwnedOrThrow(
    { bucket: "videos", path: "studio-scenes/x/logo.png", kind: "image" },
    USER_ID,
    client,
  );
});

Deno.test("assertRefOwnedOrThrow: another user's path is a 404, not a leak", async () => {
  const foreignRef: MediaRef = {
    bucket: "studio-uploads",
    path: `${OTHER_USER_ID}/project-9/clip.mp4`,
    kind: "video",
  };
  const { client, queried } = fakeProjectsClient([
    { project: { tracks: [{ kind: "video", clips: [{ id: "c1", assetRef: uploadRef }] }] } },
  ]);

  await expectThrows(assertRefOwnedOrThrow(foreignRef, USER_ID, client), (error) => {
    assertTrue(error instanceof NotFoundError, `expected NotFoundError, got ${String(error)}`);
    assertEquals((error as NotFoundError).status, 404);
    assertEquals((error as Error).message, "Not found");
  });
  assertEquals(queried, ["studio_projects", `studio_projects.user_id=${USER_ID}`]);
});

Deno.test("assertRefOwnedOrThrow: query failures surface as 500, foreign refs as 404", async () => {
  const { client } = fakeProjectsClient([], { message: "connection reset" });
  await expectThrows(assertRefOwnedOrThrow(sceneRef, USER_ID, client), (error) => {
    assertTrue(error instanceof HttpError);
    if (error instanceof HttpError) {
      assertEquals(error.status, 500);
      assertIncludes(error.message, "connection reset");
    }
  });
});

Deno.test("isOwnedPath / projectContainsRef mirror the browser contract", () => {
  assertTrue(isOwnedPath(`${USER_ID}/a/b.mp4`, USER_ID));
  assertTrue(!isOwnedPath(`other/a/b.mp4`, USER_ID));
  assertTrue(!isOwnedPath(`studio-scenes/${USER_ID}/a/b.mp4`, USER_ID));

  assertTrue(projectContainsRef({ tracks: [{ clips: [{ assetRef: sceneRef }] }] }, sceneRef));
  assertTrue(projectContainsRef({ branding: { logoRef: sceneRef } }, sceneRef));
  assertTrue(!projectContainsRef({ tracks: [{ clips: [{ assetRef: uploadRef }] }] }, sceneRef));
  assertTrue(!projectContainsRef(null, sceneRef));
  assertTrue(!projectContainsRef({}, sceneRef));
});

// ---------------------------------------------------------------------------
// refFromUrl (deno twin of mediaRefFromStorageUrl)
// ---------------------------------------------------------------------------

Deno.test("refFromUrl: signed / authenticated / public storage URLs", () => {
  assertEquals(
    refFromUrl("https://p.supabase.co/storage/v1/object/sign/videos/studio-scenes/u/p/s.mp4?token=t"),
    { bucket: "videos", path: "studio-scenes/u/p/s.mp4", kind: "video" },
  );
  assertEquals(
    refFromUrl("https://p.supabase.co/storage/v1/object/authenticated/studio-uploads/u/p/c.mp4", "audio"),
    { bucket: "studio-uploads", path: "u/p/c.mp4", kind: "audio" },
  );
  assertEquals(
    refFromUrl("https://p.supabase.co/storage/v1/object/public/studio-exports/u/p/logo.png", "image"),
    { bucket: "studio-exports", path: "u/p/logo.png", kind: "image" },
  );
  assertEquals(refFromUrl("https://cdn.example.com/clip.mp4"), null);
  assertEquals(refFromUrl("garbage"), null);
  assertEquals(refFromUrl(""), null);
});

// ---------------------------------------------------------------------------
// findUnownedClipRefs (render-project snapshot validation)
// ---------------------------------------------------------------------------

Deno.test("findUnownedClipRefs: only foreign refs are reported", () => {
  const project = {
    tracks: [
      {
        kind: "video",
        clips: [
          { id: "own", assetRef: { bucket: "studio-uploads", path: `${USER_ID}/p/a.mp4`, kind: "video" } },
          { id: "foreign", beatId: "opening_hook", assetRef: { bucket: "studio-uploads", path: `${OTHER_USER_ID}/p/b.mp4`, kind: "video" } },
          { id: "external", assetUrl: "https://cdn.example.com/c.mp4" },
          { id: "no-media", assetUrl: "" },
        ],
      },
    ],
  };

  const offenders = findUnownedClipRefs(project, USER_ID);
  assertEquals(offenders.length, 1);
  assertIncludes(offenders[0], "opening_hook");
  assertIncludes(offenders[0], `${OTHER_USER_ID}/p/b.mp4`);
  assertIncludes(offenders[0], "tracks[0].clips[1]");

  assertEquals(findUnownedClipRefs({ tracks: [] }, USER_ID), []);
  assertEquals(
    findUnownedClipRefs(
      { tracks: [{ clips: [{ assetRef: { bucket: "studio-uploads", kind: "video" } }] }] },
      USER_ID,
    ).length,
    1,
    "a malformed ref is reported too",
  );
});

Deno.test("isMediaRef matches the browser validator", () => {
  assertTrue(isMediaRef(uploadRef));
  assertTrue(!isMediaRef({ bucket: "videos", path: "a", kind: "movie" }));
  assertTrue(!isMediaRef({ bucket: "videos", kind: "video" }));
  assertTrue(!isMediaRef(null));
});
