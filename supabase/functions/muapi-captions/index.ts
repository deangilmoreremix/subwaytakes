import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, handleOptions, HttpError, jsonResponse } from "../_shared/cors.ts";
import { requireUser, serviceClient } from "../_shared/auth.ts";
import { assertProjectOwnership } from "../_shared/ownership.ts";
import {
  DEFAULT_SIGN_TTL_SECONDS,
  isMediaRef,
  refFromUrl,
  signRef,
  type MediaRef,
} from "../_shared/media.ts";
import {
  isMuapiCaptionLanguage,
  isMuapiCaptionTheme,
  isSafeExternalHttpUrl,
  muapiDownload,
  muapiPollResult,
  muapiSubmit,
  toWhisperLanguage,
  type MuapiPollResult,
} from "../_shared/muapi.ts";
import { parseVttToSegments, segmentsToCaptions } from "../_shared/vtt.ts";

/**
 * muapi-captions — styled (ai-captions) and editable (whisper vtt) captions.
 *
 * POST /functions/v1/muapi-captions
 * action "submit": { project_id, video_url, mode: "styled"|"editable",
 *                    language?, theme?, render_job_id?, clip_id? }
 *   200: { job_id, status: "running" }
 *   400: invalid mode / language / theme / video_url / clip_id
 *   404: project/clip not found or not owned by caller
 *   500: MuAPI submission failed (upstream message surfaced)
 *
 * `clip_id` (optional) makes the server resolve the source itself: the clip is
 * loaded from the caller's project and its canonical ref is signed for 1 hour
 * so MuAPI can fetch a private object without the bucket becoming public.
 * Without it the caller-supplied `video_url` is used, as before.
 *
 * action "poll": { job_id }
 *   200: the muapi_caption_jobs row (status 'running' | 'done' | 'error');
 *        'done' carries output_ref (canonical) + output_url (1-hour signed
 *        URL) for styled mode, or captions for editable mode
 *   404: job not found or not owned by caller, 500: MuAPI poll failed
 */

type CaptionMode = "styled" | "editable";
type CaptionAction = "submit" | "poll";

interface CaptionsRequestBody {
  action: CaptionAction;
  project_id?: string;
  video_url?: string;
  /**
   * Optional: sign the source clip server-side instead of trusting a
   * client-supplied URL. The clip is looked up in the caller's project and,
   * when it carries a canonical assetRef, MuAPI receives a fresh 1-hour
   * signed URL (the buckets stay private).
   */
  clip_id?: string;
  mode?: CaptionMode;
  language?: string;
  theme?: string;
  render_job_id?: string;
  job_id?: string;
}

interface CaptionJobRow {
  id: string;
  user_id: string;
  project_id: string;
  render_job_id: string | null;
  mode: CaptionMode;
  muapi_request_id: string | null;
  language: string;
  theme: string;
  status: string;
  /** Canonical identity of the captioned output (never expires). */
  output_ref: MediaRef | null;
  /** Last derived 1-hour signed URL for that output (session state). */
  output_url: string | null;
  captions: unknown;
  error: string | null;
  created_at: string;
  updated_at: string;
}

/** Reuse the shared SSRF guard: https-only, no private/metadata hosts. */
function isHttpUrl(value: string): boolean {
  return isSafeExternalHttpUrl(value);
}

function decodeDataUrl(dataUrl: string): string | null {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex === -1) return null;
  const meta = dataUrl.slice(0, commaIndex);
  const payload = dataUrl.slice(commaIndex + 1);
  try {
    if (meta.includes(";base64")) {
      const binaryStr = atob(payload);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      return new TextDecoder().decode(bytes);
    }
    return decodeURIComponent(payload);
  } catch {
    return null;
  }
}

interface StoredVideoOutput {
  ref: MediaRef;
  /** 1-hour signed URL (session state, not the asset identity). */
  url: string;
}

/** Persist a provider output (http(s) URL or data URL) into a storage bucket. */
async function storeVideoOutput(
  supabase: SupabaseClient,
  output: string,
  storagePath: string,
): Promise<StoredVideoOutput> {
  let bytes: Uint8Array;

  if (output.startsWith("data:")) {
    const decoded = decodeDataUrl(output);
    if (!decoded) {
      throw new HttpError(500, "MuAPI returned an empty data URL");
    }
    const binaryStr = decoded;
    bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
  } else if (isHttpUrl(output)) {
    bytes = await muapiDownload(output, { timeoutMs: 300000 });
  } else {
    throw new HttpError(500, "MuAPI returned an unusable video output");
  }

  const { error: uploadError } = await supabase.storage
    .from("videos")
    .upload(storagePath, bytes, { contentType: "video/mp4", upsert: true });

  if (uploadError) {
    throw new HttpError(500, `Failed to store captioned video: ${uploadError.message}`);
  }

  const ref: MediaRef = { bucket: "videos", path: storagePath, kind: "video" };
  try {
    // 1 hour: enough for immediate playback/download, never an identity.
    const signed = await signRef(supabase, ref, DEFAULT_SIGN_TTL_SECONDS);
    return { ref, url: signed.url };
  } catch (error) {
    console.error("Captioned output signing error:", error);
    throw new HttpError(500, "Could not sign private captioned video for playback");
  }
}

/**
 * Pull the VTT/SRT transcript out of a MuAPI result. The payload may carry the
 * text inline, or reference it via outputs[0] (a URL to a text file).
 */
async function extractTranscriptText(result: MuapiPollResult): Promise<string | null> {
  const raw = result.raw;
  const inlineKeys = ["vtt", "text", "transcript", "srt", "output", "response", "captions", "caption"];

  for (const key of inlineKeys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
    if (value && typeof value === "object") {
      const nested = value as Record<string, unknown>;
      const inner = nested.vtt ?? nested.text ?? nested.transcript;
      if (typeof inner === "string" && inner.trim().length > 0) {
        return inner;
      }
    }
  }

  for (const output of result.outputs) {
    if (output.startsWith("data:")) {
      const decoded = decodeDataUrl(output);
      if (decoded) return decoded;
      continue;
    }
    if (output.includes("-->")) {
      return output;
    }
    if (isSafeExternalHttpUrl(output)) {
      try {
        const bytes = await muapiDownload(output, { timeoutMs: 60000 });
        return new TextDecoder().decode(bytes);
      } catch (error) {
        console.error("Failed to download transcript output:", error);
      }
    }
  }

  return null;
}

type HandlerResult = { status: number; body: unknown };

/**
 * Resolve the media URL MuAPI must fetch. Prefers the caller-supplied
 * `clip_id`: the clip is loaded from the caller's own project and, when it
 * carries a canonical ref, a fresh 1-hour signed URL is minted here so the
 * private bucket never has to become public. Falls back to the client-supplied
 * `video_url` (external CDN or a freshly minted session URL) for callers that
 * do not send a clip id.
 */
async function resolveSourceUrl(
  supabase: SupabaseClient,
  projectId: string,
  userId: string,
  clipId: string | undefined,
  fallbackUrl: string | undefined,
): Promise<string> {
  if (!clipId) {
    if (!fallbackUrl || !isSafeExternalHttpUrl(fallbackUrl)) {
      throw new HttpError(400, "video_url is required and must be an https URL");
    }
    // The caller already holds a URL for this object, so recovering its ref and
    // re-signing it here grants nothing new — it just guarantees MuAPI receives
    // a freshly valid 1-hour URL instead of one that may be about to expire.
    const recovered = refFromUrl(fallbackUrl, "video");
    if (recovered) {
      try {
        const signed = await signRef(supabase, recovered, DEFAULT_SIGN_TTL_SECONDS);
        return signed.url;
      } catch (error) {
        console.error("Caption source re-signing failed, using the supplied URL:", error);
      }
    }
    return fallbackUrl;
  }

  const { data: projectRow, error: projectError } = await supabase
    .from("studio_projects")
    .select("project")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (projectError) {
    throw new HttpError(500, `Failed to load project: ${projectError.message}`);
  }
  if (!projectRow?.project) {
    throw new HttpError(404, "Not found");
  }

  const project = projectRow.project as { tracks?: Array<{ clips?: Array<Record<string, unknown>> }> };
  const clip = (project.tracks ?? [])
    .flatMap((track) => (Array.isArray(track.clips) ? track.clips : []))
    .find((candidate) => candidate && candidate.id === clipId);

  if (!clip) {
    throw new HttpError(404, "Not found");
  }

  const assetRef = clip.assetRef;
  if (isMediaRef(assetRef)) {
    try {
      // 1 hour: MuAPI only needs to fetch the source once.
      const signed = await signRef(supabase, assetRef, DEFAULT_SIGN_TTL_SECONDS);
      return signed.url;
    } catch (error) {
      console.error("Caption source signing error:", error);
      throw new HttpError(500, "Could not sign the source clip for the caption provider");
    }
  }

  const assetUrl = typeof clip.assetUrl === "string" ? clip.assetUrl : "";
  if (isSafeExternalHttpUrl(assetUrl)) return assetUrl;
  throw new HttpError(400, `Clip "${clipId}" has no media to caption`);
}

async function handleSubmit(
  supabase: SupabaseClient,
  userId: string,
  body: CaptionsRequestBody,
): Promise<HandlerResult> {
  const renderJobId = body.render_job_id;
  if (renderJobId !== undefined && (typeof renderJobId !== "string" || renderJobId.length === 0)) {
    return {
      status: 400,
      body: { error: "render_job_id must be a non-empty string when provided" },
    };
  }

  const clipId = body.clip_id;
  if (clipId !== undefined && (typeof clipId !== "string" || clipId.length === 0)) {
    return { status: 400, body: { error: "clip_id must be a non-empty string when provided" } };
  }

  const { project_id: projectId, mode } = body;
  if (!projectId || typeof projectId !== "string") {
    return { status: 400, body: { error: "project_id is required" } };
  }
  if (mode !== "styled" && mode !== "editable") {
    return { status: 400, body: { error: "mode is required and must be one of: styled, editable" } };
  }

  // video_url is still required as a field for backwards compatibility, but
  // when clip_id is present the clip's ref decides the URL MuAPI receives.
  if (!body.video_url || typeof body.video_url !== "string") {
    if (!clipId) {
      return {
        status: 400,
        body: { error: "video_url is required and must be an https URL" },
      };
    }
  }

  const language = body.language ?? "English";
  if (!isMuapiCaptionLanguage(language)) {
    return {
      status: 400,
      body: { error: "Invalid language. Must be one of the supported MuAPI languages" },
    };
  }

  const theme = body.theme ?? "Hormozi_1";
  if (!isMuapiCaptionTheme(theme)) {
    return {
      status: 400,
      body: { error: "Invalid theme. Must be one of the supported MuAPI themes" },
    };
  }

  await assertProjectOwnership(supabase, projectId, userId);

  let sourceUrl: string;
  try {
    sourceUrl = await resolveSourceUrl(
      supabase,
      projectId,
      userId,
      clipId,
      typeof body.video_url === "string" ? body.video_url : undefined,
    );
  } catch (error) {
    if (error instanceof HttpError) {
      return { status: error.status, body: { error: error.message } };
    }
    throw error;
  }

  const { data: inserted, error: insertError } = await supabase
    .from("muapi_caption_jobs")
    .insert({
      user_id: userId,
      project_id: projectId,
      mode,
      language,
      theme,
      status: "running",
      ...(renderJobId ? { render_job_id: renderJobId } : {}),
    })
    .select("id")
    .single();

  const jobId = (inserted as { id?: string } | null)?.id;
  if (insertError || !jobId) {
    const message = insertError?.message ?? "unknown error";
    return { status: 500, body: { error: `Failed to create caption job: ${message}` } };
  }

  try {
    const requestId = mode === "styled"
      ? await muapiSubmit("ai-captions", { video_url: sourceUrl, language, theme })
      : await muapiSubmit("openai-whisper", {
          audio_url: sourceUrl,
          language: toWhisperLanguage(language),
          response_format: "vtt",
        });

    const { error: updateError } = await supabase
      .from("muapi_caption_jobs")
      .update({ muapi_request_id: requestId })
      .eq("id", jobId);

    if (updateError) {
      console.error("Failed to store muapi_request_id:", updateError);
    }
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : "MuAPI submission failed";
    await supabase
      .from("muapi_caption_jobs")
      .update({ status: "error", error: message })
      .eq("id", jobId);
    return { status: 500, body: { error: message } };
  }

  return { status: 200, body: { job_id: jobId, status: "running" } };
}

async function handlePoll(
  supabase: SupabaseClient,
  userId: string,
  body: CaptionsRequestBody,
): Promise<HandlerResult> {
  const { job_id: jobId } = body;

  if (!jobId || typeof jobId !== "string") {
    return { status: 400, body: { error: "job_id is required" } };
  }

  const { data: jobRow, error: jobError } = await supabase
    .from("muapi_caption_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (jobError) {
    return { status: 500, body: { error: `Failed to load caption job: ${jobError.message}` } };
  }
  if (!jobRow) {
    return { status: 404, body: { error: "Not found" } };
  }

  const job = jobRow as CaptionJobRow;
  if (job.user_id !== userId) {
    return { status: 404, body: { error: "Not found" } };
  }

  if (!job.muapi_request_id) {
    return { status: 500, body: { error: "Caption job has no MuAPI request id" } };
  }

  const result = await muapiPollResult(job.muapi_request_id);

  if (result.status === "failed" || result.status === "cancelled") {
    const message = result.error || `MuAPI job ${result.status}`;
    await supabase
      .from("muapi_caption_jobs")
      .update({ status: "error", error: message })
      .eq("id", jobId);
    return { status: 200, body: { ...job, status: "error", error: message } };
  }

  if (result.status !== "completed") {
    return { status: 200, body: job };
  }

  if (job.mode === "styled") {
    const output = result.outputs[0];
    if (!output) {
      return { status: 500, body: { error: "MuAPI captions job returned no video output" } };
    }

    const { ref: outputRef, url: outputUrl } = await storeVideoOutput(
      supabase,
      output,
      // uid-scoped path: media-sign's path-prefix ownership rule can re-sign
      // this ref forever, so captioned outputs never expire permanently.
      `${userId}/captioned/${jobId}.mp4`,
    );

    await supabase
      .from("muapi_caption_jobs")
      .update({ status: "done", output_ref: outputRef, output_url: outputUrl, error: null })
      .eq("id", jobId);

    return {
      status: 200,
      body: { ...job, status: "done", output_ref: outputRef, output_url: outputUrl, error: null },
    };
  }

  const transcript = await extractTranscriptText(result);
  if (!transcript) {
    return {
      status: 500,
      body: { error: "MuAPI transcription completed but returned no transcript text" },
    };
  }

  const captions = segmentsToCaptions(parseVttToSegments(transcript), `cap-${jobId}`);

  await supabase
    .from("muapi_caption_jobs")
    .update({ status: "done", captions, error: null })
    .eq("id", jobId);

  return { status: 200, body: { ...job, status: "done", captions, error: null } };
}

Deno.serve(async (req: Request) => {
  const cors = buildCorsHeaders(req.headers.get("Origin"));

  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  try {
    const { userId } = await requireUser(req);

    let body: CaptionsRequestBody;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400, cors);
    }

    if (body.action !== "submit" && body.action !== "poll") {
      return jsonResponse({ error: "action is required and must be one of: submit, poll" }, 400, cors);
    }

    const supabase = serviceClient();

    const { status, body: responseBody } = body.action === "submit"
      ? await handleSubmit(supabase, userId, body)
      : await handlePoll(supabase, userId, body);

    return jsonResponse(responseBody, status, cors);
  } catch (error) {
    console.error("Muapi captions error:", error);
    if (error instanceof HttpError) {
      return jsonResponse({ error: error.message }, error.status, cors);
    }
    const message = error instanceof Error && error.message ? error.message : "MuAPI captions failed";
    return jsonResponse({ error: message }, 500, cors);
  }
});
