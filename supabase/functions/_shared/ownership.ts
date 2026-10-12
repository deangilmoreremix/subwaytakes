import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { HttpError } from "./cors.ts";

/**
 * Ownership helpers. All lookups run through the service-role client, so a
 * missing row and a row owned by somebody else must both fail closed with a
 * 404 ("Not found") instead of passing silently.
 */

export class NotFoundError extends HttpError {
  constructor(message = "Not found") {
    super(404, message);
    this.name = "NotFoundError";
  }
}

/**
 * Minimal structural view of the query chain used for ownership checks. Both
 * the real service-role client and test doubles satisfy it.
 */
interface OwnerQueryClient {
  from(
    table: string,
  ): {
    select(
      columns: string,
    ): {
      eq(
        column: string,
        value: string,
      ): {
        maybeSingle(): Promise<{
          data: { user_id?: string } | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
}

async function assertOwner(
  client: SupabaseClient,
  table: string,
  id: string,
  userId: string,
): Promise<{ user_id: string }> {
  const query = client as unknown as OwnerQueryClient;
  const { data, error } = await query.from(table).select("user_id").eq("id", id).maybeSingle();

  if (error) {
    throw new HttpError(500, `Failed to verify ownership: ${error.message ?? "unknown error"}`);
  }

  const ownerId = data?.user_id;
  if (typeof ownerId !== "string" || ownerId.length === 0 || ownerId !== userId) {
    throw new NotFoundError("Not found");
  }

  return { user_id: ownerId };
}

/** Load a studio_projects row and assert it belongs to userId (404 otherwise). */
export function assertProjectOwnership(
  client: SupabaseClient,
  projectId: string,
  userId: string,
): Promise<{ user_id: string }> {
  return assertOwner(client, "studio_projects", projectId, userId);
}

/** Load a clips row and assert it belongs to userId (404 otherwise). */
export function assertClipOwnership(
  client: SupabaseClient,
  clipId: string,
  userId: string,
): Promise<{ user_id: string }> {
  return assertOwner(client, "clips", clipId, userId);
}
