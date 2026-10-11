import { buildCorsHeaders, handleOptions, HttpError, jsonResponse } from "../_shared/cors.ts";
import { requireUser, serviceClient } from "../_shared/auth.ts";
import { assertProjectOwnership, NotFoundError } from "../_shared/ownership.ts";
import { muapiDownload, muapiPollResult } from "../_shared/muapi.ts";

/**
 * scene-status — poll a MuAPI scene job and store the finished clip.
 *
 * POST /functions/v1/scene-status
 * Body: { project_id, beat_id, request_id }
 * 200: { status: "done", assetUrl }   (clip stored in the public videos bucket
 *      and wired into the project's video track)
 * 200: { status: "processing" }       (client polls again, ~every 5s)
 * 400: validation errors, 404: project not found / not owned by caller,
 * 500: MuAPI job failed, or the output could not be downloaded/stored
 */

const BEAT_IDS = [
  "opening_hook",
  "interviewer_intro",
  "guest_responds",
  "interviewer_challenges",
  "guest_expands",
  "reaction_moment",
  "closing_statement",
] as const;

function isHttpUrl(value: string): boolean {
  return value.startsWith("https://") || value.startsWith("http://");
}

function findTargetClip(
  project: Record<string, unknown>,
  beatId: string,
): Record<string, unknown> | null {
  const tracks = Array.isArray(project.tracks) ? project.tracks : [];
  const videoTrack = tracks.find(
    (t) => t && typeof t === "object" && (t as Record<string, unknown>).kind === "video",
  ) as Record<string, unknown> | undefined;
  const anyTrack = tracks[0] as Record<string, unknown> | undefined;
  const track = videoTrack ?? anyTrack;
  if (!track || !Array.isArray(track.clips)) return null;

  const clips = track.clips as Array<Record<string, unknown>>;
  const byBeat = clips.find((clip) => clip && clip.beatId === beatId);
  if (byBeat) return byBeat;

  const beatIndex = BEAT_IDS.indexOf(beatId as typeof BEAT_IDS[number]);
  const positional = beatIndex >= 0 ? clips[beatIndex] : undefined;
  if (positional && !positional.beatId) return positional;

  return null;
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
    const beatId = body.beat_id;
    const requestId = body.request_id;

    if (!projectId || typeof projectId !== "string") {
      return jsonResponse({ error: "project_id is required" }, 400, cors);
    }
    if (!beatId || typeof beatId !== "string" || !BEAT_IDS.includes(beatId as typeof BEAT_IDS[number])) {
      return jsonResponse(
        { error: `beat_id is required and must be one of: ${BEAT_IDS.join(", ")}` },
        400,
        cors,
      );
    }
    if (!requestId || typeof requestId !== "string") {
      return jsonResponse({ error: "request_id is required" }, 400, cors);
    }

    const supabase = serviceClient();
    await assertProjectOwnership(supabase, projectId, userId);

    const result = await muapiPollResult(requestId);

    if (result.status === "failed" || result.status === "cancelled") {
      return jsonResponse(
        { error: result.error || `MuAPI job ${result.status}` },
        500,
        cors,
      );
    }

    if (result.status !== "completed") {
      return jsonResponse({ status: "processing" }, 200, cors);
    }

    const outputUrl = result.outputs[0];
    if (!outputUrl || !isHttpUrl(outputUrl)) {
      return jsonResponse(
        { error: "MuAPI job completed but returned no usable video URL" },
        500,
        cors,
      );
    }

    const bytes = await muapiDownload(outputUrl, { timeoutMs: 120000 });

    const storagePath = `studio-scenes/${userId}/${projectId}/scene-${beatId}-${requestId}.mp4`;
    const { error: uploadError } = await supabase.storage
      .from("videos")
      .upload(storagePath, bytes, {
        contentType: "video/mp4",
        upsert: true,
      });

    if (uploadError) {
      return jsonResponse(
        { error: `Failed to store generated scene: ${uploadError.message}` },
        500,
        cors,
      );
    }

    const { data: publicUrlData } = supabase.storage.from("videos").getPublicUrl(storagePath);
    const assetUrl = publicUrlData.publicUrl;
    if (!isHttpUrl(assetUrl)) {
      return jsonResponse({ error: "Storage did not return a public URL" }, 500, cors);
    }

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

    const project = projectRow.project as Record<string, unknown>;
    const targetClip = findTargetClip(project, beatId);
    if (!targetClip) {
      throw new NotFoundError(`No clip found for beat "${beatId}"`);
    }

    // Wire the generated asset into the clip: keep trim points, mark it
    // generated, and drop the unknown source duration.
    targetClip.assetUrl = assetUrl;
    targetClip.assetKind = "generated";
    targetClip.beatId = beatId;
    targetClip.portrait = true;
    delete targetClip.sourceDuration;
    project.updatedAt = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("studio_projects")
      .update({ project })
      .eq("id", projectId);

    if (updateError) {
      return jsonResponse({ error: `Failed to update project: ${updateError.message}` }, 500, cors);
    }

    return jsonResponse({ status: "done", assetUrl }, 200, cors);
  } catch (error) {
    console.error("Scene status error:", error);
    if (error instanceof HttpError) {
      return jsonResponse({ error: error.message }, error.status, cors);
    }
    const message = error instanceof Error && error.message ? error.message : "Scene status check failed";
    return jsonResponse({ error: message }, 500, cors);
  }
});
