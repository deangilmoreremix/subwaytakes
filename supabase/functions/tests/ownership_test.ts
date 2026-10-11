import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { assertClipOwnership, assertProjectOwnership, NotFoundError } from "../_shared/ownership.ts";
import { HttpError } from "../_shared/cors.ts";

interface OwnerRow {
  user_id: string;
}

interface RecordedQuery {
  table: string;
  column: string;
  value: string;
}

/**
 * Fake supabase client: rows are keyed by id and returned for either table,
 * recording every eq() call so tests can assert the table that was queried.
 */
function fakeClient(
  rows: Record<string, OwnerRow | null>,
  queryError: { message: string } | null = null,
): { client: SupabaseClient; queries: RecordedQuery[] } {
  const queries: RecordedQuery[] = [];

  const client = {
    from(table: string) {
      let lastValue = "";
      return {
        select() {
          return this;
        },
        eq(column: string, value: string) {
          queries.push({ table, column, value });
          lastValue = value;
          return this;
        },
        async maybeSingle() {
          if (queryError) {
            return { data: null, error: queryError };
          }
          return { data: rows[lastValue] ?? null, error: null };
        },
      };
    },
  };

  return { client: client as unknown as SupabaseClient, queries };
}

async function expectNotFound(promise: Promise<unknown>): Promise<void> {
  let threw = false;
  try {
    await promise;
  } catch (error) {
    threw = true;
    if (!(error instanceof NotFoundError)) {
      throw new Error(`expected NotFoundError, got ${String(error)}`);
    }
    assertEquals(error.status, 404, "NotFoundError must carry HTTP 404");
    assertEquals(error.message, "Not found");
  }
  assertTrue(threw, "expected the ownership assertion to reject");
}

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

Deno.test("assertProjectOwnership: passes when the user owns the project", async () => {
  const { client, queries } = fakeClient({ "project-1": { user_id: "user-1" } });

  const owner = await assertProjectOwnership(client, "project-1", "user-1");

  assertEquals(owner, { user_id: "user-1" });
  assertEquals(queries.length, 1);
  assertEquals(queries[0].table, "studio_projects");
  assertEquals(queries[0].column, "id");
  assertEquals(queries[0].value, "project-1");
});

Deno.test("assertProjectOwnership: 404 when the owner does not match", async () => {
  const { client } = fakeClient({ "project-1": { user_id: "user-2" } });

  await expectNotFound(assertProjectOwnership(client, "project-1", "user-1"));
});

Deno.test("assertProjectOwnership: 404 when the project row is missing", async () => {
  const { client } = fakeClient({});

  await expectNotFound(assertProjectOwnership(client, "missing-project", "user-1"));
});

Deno.test("assertClipOwnership: passes when the user owns the clip", async () => {
  const { client, queries } = fakeClient({ "clip-1": { user_id: "user-1" } });

  const owner = await assertClipOwnership(client, "clip-1", "user-1");

  assertEquals(owner, { user_id: "user-1" });
  assertEquals(queries[0].table, "clips");
  assertEquals(queries[0].value, "clip-1");
});

Deno.test("assertClipOwnership: 404 when the owner does not match", async () => {
  const { client } = fakeClient({ "clip-1": { user_id: "user-9" } });

  await expectNotFound(assertClipOwnership(client, "clip-1", "user-1"));
});

Deno.test("assertClipOwnership: 404 when the clip row is missing", async () => {
  const { client } = fakeClient({ "clip-1": null });

  await expectNotFound(assertClipOwnership(client, "clip-1", "user-1"));
});

Deno.test("assertProjectOwnership: query failures surface as a 500 HttpError, not 404", async () => {
  const { client } = fakeClient({}, { message: "connection reset" });

  let caught: unknown = null;
  try {
    await assertProjectOwnership(client, "project-1", "user-1");
  } catch (error) {
    caught = error;
  }

  assertTrue(caught instanceof HttpError, "expected an HttpError");
  if (caught instanceof HttpError) {
    assertEquals(caught.status, 500);
    assertIncludes(caught.message, "connection reset");
  }
});

function assertIncludes(haystack: string, needle: string): void {
  assertTrue(haystack.includes(needle), `"${needle}" not found in "${haystack}"`);
}
