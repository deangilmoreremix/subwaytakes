import { buildCorsHeaders, handleOptions, HttpError, jsonResponse } from "../_shared/cors.ts";
import { requireUser, serviceClient } from "../_shared/auth.ts";
import { assertProjectOwnership } from "../_shared/ownership.ts";
import { findUnownedClipRefs } from "../_shared/media.ts";
import { validateProjectForRender } from "../_shared/project.ts";

/**
 * render-project — enqueue a server-side render of a studio project.
 *
 * POST /functions/v1/render-project
 * Body: { project_id, settings?: { width?, height?, fps?, codec?, pixelFormat? } }
 * 200: { job_id, status: "queued" }   (client watches studio_render_jobs via RLS)
 * 400: project_id missing, project fails structural validation (details
 *      included), or a clip references media owned by another account
 * 404: project not found or not owned by caller
 * 409: a queued/running job already exists for this project
 * 500: unexpected failures
 *
 * The snapshot stored in studio_render_jobs.project_snapshot keeps BOTH the
 * canonical refs and the session URLs — the worker resolves refs (or re-signs
 * the URLs) with the service role at render time.
 */

interface RenderSettings {
  width: number;
  height: number;
  codec: string;
  fps: number;
  pixelFormat: string;
}

const DEFAULT_SETTINGS: RenderSettings = {
  width: 1080,
  height: 1920,
  codec: "h264",
  fps: 30,
  pixelFormat: "yuv420p",
};

function mergeRenderSettings(
  rawSettings: unknown,
  projectFps: unknown,
): RenderSettings {
  const settings: Record<string, unknown> =
    rawSettings && typeof rawSettings === "object" ? rawSettings as Record<string, unknown> : {};

  const fpsFromProject = typeof projectFps === "number" && Number.isFinite(projectFps) && projectFps > 0
    ? projectFps
    : DEFAULT_SETTINGS.fps;

  const numberOr = (value: unknown, fallback: number): number =>
    typeof value === "number" && Number.isFinite(value) ? value : fallback;

  const stringOr = (value: unknown, fallback: string): string =>
    typeof value === "string" && value.length > 0 ? value : fallback;

  return {
    width: numberOr(settings.width, DEFAULT_SETTINGS.width),
    height: numberOr(settings.height, DEFAULT_SETTINGS.height),
    codec: stringOr(settings.codec, DEFAULT_SETTINGS.codec),
    fps: numberOr(settings.fps, fpsFromProject),
    pixelFormat: stringOr(settings.pixelFormat, DEFAULT_SETTINGS.pixelFormat),
  };
}

Deno.serve(async (req: Request) => {
  const cors = buildCorsHeaders(req.headers.get("Origin"));

  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  try {
    const { userId } = await requireUser(req);

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400, cors);
    }

    const projectId = body.project_id;
    if (!projectId || typeof projectId !== "string") {
      return jsonResponse({ error: "project_id is required" }, 400, cors);
    }

    const supabase = serviceClient();
    const { user_id: ownerUserId } = await assertProjectOwnership(supabase, projectId, userId);

    const { data: projectRow, error: projectLoadError } = await supabase
      .from("studio_projects")
      .select("project")
      .eq("id", projectId)
      .maybeSingle();

    if (projectLoadError) {
      return jsonResponse({ error: `Failed to load project: ${projectLoadError.message}` }, 500, cors);
    }
    if (!projectRow) {
      return jsonResponse({ error: "Not found" }, 404, cors);
    }

    const project = projectRow.project;

    // Media ownership: every clip ref must belong to the project owner.
    // External http(s) asset URLs stay allowed (they are their own identity).
    const unownedRefs = findUnownedClipRefs(project, ownerUserId);
    if (unownedRefs.length > 0) {
      return jsonResponse(
        {
          error: "Project references media owned by another account",
          details: unownedRefs,
        },
        400,
        cors,
      );
    }

    const validation = validateProjectForRender(project);
    if (!validation.ok || !validation.project) {
      return jsonResponse(
        { error: "Project validation failed", details: validation.errors },
        400,
        cors,
      );
    }

    const { data: activeJobs, error: activeError } = await supabase
      .from("studio_render_jobs")
      .select("id")
      .eq("project_id", projectId)
      .in("status", ["queued", "running"])
      .limit(1);

    if (activeError) {
      return jsonResponse({ error: `Failed to check active renders: ${activeError.message}` }, 500, cors);
    }
    if (activeJobs && activeJobs.length > 0) {
      return jsonResponse(
        { error: "A render is already queued or running for this project" },
        409,
        cors,
      );
    }

    const renderSettings = mergeRenderSettings(body.settings, validation.project.fps);

    const { data: inserted, error: insertError } = await supabase
      .from("studio_render_jobs")
      .insert({
        user_id: userId,
        project_id: projectId,
        status: "queued",
        project_snapshot: validation.project,
        render_settings: renderSettings,
      })
      .select("id")
      .single();

    if (insertError) {
      // The partial unique index (one active job per project) rejects races.
      if (insertError.code === "23505") {
        return jsonResponse(
          { error: "A render is already queued or running for this project" },
          409,
          cors,
        );
      }
      return jsonResponse({ error: `Failed to enqueue render: ${insertError.message}` }, 500, cors);
    }

    const jobId = (inserted as { id?: string } | null)?.id;
    if (!jobId) {
      return jsonResponse({ error: "Render job was created but no id was returned" }, 500, cors);
    }

    return jsonResponse({ job_id: jobId, status: "queued" }, 200, cors);
  } catch (error) {
    console.error("Render project error:", error);
    if (error instanceof HttpError) {
      return jsonResponse({ error: error.message }, error.status, cors);
    }
    const message = error instanceof Error && error.message ? error.message : "Failed to enqueue render";
    return jsonResponse({ error: message }, 500, cors);
  }
});
