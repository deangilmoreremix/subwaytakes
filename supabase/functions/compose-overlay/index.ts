import { type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, errorResponse, handleOptions, HttpError, jsonResponse } from "../_shared/cors.ts";
import { internalCall, requireUser, serviceClient } from "../_shared/auth.ts";

interface ComposeRequest {
  episode_id?: string;
  clip_id?: string;
  compilation_id?: string;
}

interface VideoTemplate {
  watermark_text: string;
  watermark_position: string;
  watermark_font_size: number;
  watermark_color: string;
  watermark_opacity: number;
  episode_prefix_format: string;
  caption_font: string;
  caption_font_size: number;
  caption_color: string;
  caption_bg_opacity: number;
  caption_position: string;
  reaction_text_enabled: boolean;
  reaction_text_position: string;
  reaction_text_font_size: number;
  progress_bar_enabled: boolean;
  progress_bar_color: string;
  lower_third_enabled?: boolean;
  lower_third_style?: string;
  endcard_enabled?: boolean;
  endcard_style?: string;
  color_grade_preset?: string;
  caption_animation_style?: string;
}

const DEFAULT_TEMPLATE: VideoTemplate = {
  watermark_text: "@subwaytakes",
  watermark_position: "top-left",
  watermark_font_size: 18,
  watermark_color: "#FFFFFF",
  watermark_opacity: 0.85,
  episode_prefix_format: "Episode {number}:",
  caption_font: "Inter",
  caption_font_size: 40,
  caption_color: "#FFFFFF",
  caption_bg_opacity: 0.6,
  caption_position: "bottom",
  reaction_text_enabled: true,
  reaction_text_position: "bottom-right",
  reaction_text_font_size: 28,
  progress_bar_enabled: true,
  progress_bar_color: "#F59E0B",
};

function getServiceConfig(): { serviceUrl: string | undefined; serviceKey: string | undefined } {
  const serviceUrl = Deno.env.get("THUMBNAIL_SERVICE_URL") || Deno.env.get("FFMPEG_SERVICE_URL");
  const serviceKey = Deno.env.get("THUMBNAIL_SERVICE_KEY") || Deno.env.get("FFMPEG_SERVICE_KEY");
  return { serviceUrl, serviceKey };
}

function requireServiceConfig(): { serviceUrl: string; serviceKey: string | undefined } {
  const { serviceUrl, serviceKey } = getServiceConfig();
  if (!serviceUrl) {
    throw new HttpError(
      500,
      "FFmpeg service is not configured (set THUMBNAIL_SERVICE_URL or FFMPEG_SERVICE_URL)",
    );
  }
  return { serviceUrl, serviceKey };
}

/** Overlay entry sent to the thumbnail-service /compose-overlays endpoint. */
interface OverlaySpec {
  text: string;
  position:
    | "top-left"
    | "top-center"
    | "top-right"
    | "bottom-left"
    | "bottom-center"
    | "bottom-right"
    | "center";
  fontSize: number;
  color: string;
  opacity: number;
  startTime: number;
  endTime: number;
  boxEnabled: boolean;
  boxColor?: string;
}

const OVERLAY_POSITIONS: OverlaySpec["position"][] = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
  "center",
];

function safePosition(value: string | undefined, fallback: OverlaySpec["position"]): OverlaySpec["position"] {
  if (value && (OVERLAY_POSITIONS as string[]).includes(value)) {
    return value as OverlaySpec["position"];
  }
  return fallback;
}

/** Template caption positions are top/center/bottom; map onto named corners. */
function captionPosition(value: string | undefined): OverlaySpec["position"] {
  switch (value) {
    case "top":
      return "top-center";
    case "center":
      return "center";
    default:
      return "bottom-center";
  }
}

function watermarkOverlay(template: VideoTemplate, totalDuration: number): OverlaySpec {
  return {
    text: template.watermark_text,
    position: safePosition(template.watermark_position, "top-left"),
    fontSize: template.watermark_font_size,
    color: template.watermark_color,
    opacity: template.watermark_opacity,
    startTime: 0,
    endTime: totalDuration,
    boxEnabled: false,
  };
}

function endcardText(template: VideoTemplate): string {
  if (template.endcard_style === "subscribe") return `Follow ${template.watermark_text}`;
  if (template.endcard_style === "cta") return `More at ${template.watermark_text}`;
  return template.watermark_text;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.substring(0, max - 3)}...` : text;
}

function buildEpisodeOverlayEntries(
  template: VideoTemplate,
  episodeNumber: number | null,
  hookQuestion: string,
  reactionLine: string | null,
  shots: Array<{
    dialogue: string | null;
    speaker: string | null;
    duration_seconds: number;
    sequence: number;
    shot_type: string | null;
  }>
): OverlaySpec[] {
  const entries: OverlaySpec[] = [];
  const sortedShots = [...shots].sort((a, b) => a.sequence - b.sequence);

  const shotTimestamps: Array<{ start: number; end: number }> = [];
  let cumulative = 0;
  for (const shot of sortedShots) {
    shotTimestamps.push({ start: cumulative, end: cumulative + shot.duration_seconds });
    cumulative += shot.duration_seconds;
  }
  const totalDuration = cumulative;

  entries.push(watermarkOverlay(template, totalDuration));

  const prefix = episodeNumber
    ? template.episode_prefix_format.replace("{number}", String(episodeNumber))
    : "";
  const titleText = prefix
    ? `${template.watermark_text} ${prefix} ${hookQuestion}`
    : `${template.watermark_text} ${hookQuestion}`;
  const titleEnd = Math.min(14, totalDuration);
  entries.push({
    text: titleText,
    position: captionPosition(template.caption_position),
    fontSize: template.caption_font_size,
    color: template.caption_color,
    opacity: 1,
    startTime: 0,
    endTime: titleEnd,
    boxEnabled: true,
    boxColor: `black@${template.caption_bg_opacity}`,
  });

  if (template.reaction_text_enabled) {
    for (let i = 0; i < sortedShots.length; i++) {
      const shot = sortedShots[i];
      const ts = shotTimestamps[i];
      if (shot.shot_type === "reaction" && reactionLine) {
        entries.push({
          text: reactionLine,
          position: safePosition(template.reaction_text_position, "bottom-right"),
          fontSize: template.reaction_text_font_size,
          color: template.caption_color,
          opacity: 1,
          startTime: ts.start + 0.5,
          endTime: ts.end - 0.3,
          boxEnabled: false,
        });
      } else if (shot.dialogue) {
        entries.push({
          text: truncate(shot.dialogue, 160),
          position: "bottom-center",
          fontSize: template.reaction_text_font_size,
          color: template.caption_color,
          opacity: 1,
          startTime: ts.start + 1,
          endTime: ts.end - 0.5,
          boxEnabled: true,
          boxColor: `black@${template.caption_bg_opacity}`,
        });
      }
    }
  }

  if (template.endcard_enabled) {
    entries.push({
      text: endcardText(template),
      position: "center",
      fontSize: template.caption_font_size + 8,
      color: template.watermark_color,
      opacity: 1,
      startTime: Math.max(0, totalDuration - 3),
      endTime: totalDuration,
      boxEnabled: true,
      boxColor: "black@0.7",
    });
  }

  return entries;
}

function buildClipOverlayEntries(
  template: VideoTemplate,
  clip: {
    topic: string;
    interview_question: string | null;
    speech_script: string | null;
    duration_seconds: number;
    video_type: string;
    subject_demographic: string | null;
  }
): OverlaySpec[] {
  const entries: OverlaySpec[] = [];
  const totalDuration = clip.duration_seconds;

  entries.push(watermarkOverlay(template, totalDuration));

  const titleText = clip.interview_question
    ? `${template.watermark_text} ${clip.interview_question}`
    : `${template.watermark_text} ${clip.topic}`;
  const titleEnd = Math.min(10, totalDuration);
  entries.push({
    text: titleText,
    position: captionPosition(template.caption_position),
    fontSize: template.caption_font_size,
    color: template.caption_color,
    opacity: 1,
    startTime: 0,
    endTime: titleEnd,
    boxEnabled: true,
    boxColor: `black@${template.caption_bg_opacity}`,
  });

  if (template.lower_third_enabled && clip.subject_demographic) {
    entries.push({
      text: clip.subject_demographic.replace(/_/g, " "),
      position: "bottom-left",
      fontSize: 22,
      color: template.caption_color,
      opacity: 1,
      startTime: 1,
      endTime: Math.min(8, totalDuration - 1),
      boxEnabled: true,
      boxColor: "black@0.5",
    });
  }

  if (clip.speech_script && template.reaction_text_enabled) {
    const captionStart = titleEnd > 2 ? titleEnd - 1 : 1;
    entries.push({
      text: truncate(clip.speech_script, 80),
      position: "bottom-center",
      fontSize: template.reaction_text_font_size,
      color: template.caption_color,
      opacity: 1,
      startTime: captionStart,
      endTime: totalDuration - 1,
      boxEnabled: true,
      boxColor: `black@${template.caption_bg_opacity}`,
    });
  }

  if (template.endcard_enabled) {
    entries.push({
      text: endcardText(template),
      position: "center",
      fontSize: template.caption_font_size + 8,
      color: template.watermark_color,
      opacity: 1,
      startTime: Math.max(0, totalDuration - 3),
      endTime: totalDuration,
      boxEnabled: true,
      boxColor: "black@0.7",
    });
  }

  return entries;
}

function buildCompilationOverlayEntries(
  template: VideoTemplate,
  compilation: { name: string; total_duration_seconds: number },
  clips: Array<{
    topic: string;
    speech_script: string | null;
    duration_seconds: number;
    sequence: number;
  }>
): OverlaySpec[] {
  const entries: OverlaySpec[] = [];
  const totalDuration = compilation.total_duration_seconds;

  entries.push(watermarkOverlay(template, totalDuration));

  const titleEnd = Math.min(10, totalDuration);
  entries.push({
    text: `${template.watermark_text} ${compilation.name}`,
    position: captionPosition(template.caption_position),
    fontSize: template.caption_font_size,
    color: template.caption_color,
    opacity: 1,
    startTime: 0,
    endTime: titleEnd,
    boxEnabled: true,
    boxColor: `black@${template.caption_bg_opacity}`,
  });

  if (template.reaction_text_enabled) {
    let currentTime = 0;
    for (const clip of [...clips].sort((a, b) => a.sequence - b.sequence)) {
      if (clip.speech_script) {
        entries.push({
          text: truncate(clip.speech_script, 80),
          position: "bottom-center",
          fontSize: template.reaction_text_font_size,
          color: template.caption_color,
          opacity: 1,
          startTime: currentTime + 0.5,
          endTime: currentTime + clip.duration_seconds - 0.5,
          boxEnabled: true,
          boxColor: `black@${template.caption_bg_opacity}`,
        });
      }
      currentTime += clip.duration_seconds;
    }
  }

  if (template.endcard_enabled) {
    entries.push({
      text: endcardText(template),
      position: "center",
      fontSize: template.caption_font_size + 8,
      color: template.watermark_color,
      opacity: 1,
      startTime: Math.max(0, totalDuration - 3),
      endTime: totalDuration,
      boxEnabled: true,
      boxColor: "black@0.7",
    });
  }

  return entries;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = 90000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function isHttpUrl(value: string): boolean {
  return value.startsWith("https://") || value.startsWith("http://");
}

/**
 * Call the FFmpeg compose service and return the composed media URL.
 * Throws on a non-ok response, a missing video field, or an unusable URL —
 * there is no raw-video fallback.
 */
async function composeWithFFmpegService(
  supabase: SupabaseClient,
  videoUrl: string,
  overlays: OverlaySpec[],
  entityId: string,
  serviceUrl: string,
  serviceKey: string | undefined
): Promise<string> {
  if (overlays.length === 0) {
    throw new HttpError(500, "No overlay entries to compose");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (serviceKey) {
    headers["Authorization"] = `Bearer ${serviceKey}`;
  }

  const response = await fetchWithTimeout(
    `${serviceUrl}/compose-overlays`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        videoUrl,
        overlays,
      }),
    },
    300000
  );

  if (!response.ok) {
    throw new HttpError(500, `FFmpeg compose service error: ${response.status}`);
  }

  const data = await response.json() as Record<string, unknown>;
  const composed = data.video;
  if (typeof composed !== "string" || composed.length === 0) {
    throw new HttpError(500, "FFmpeg compose service returned no video");
  }

  let finalUrl = composed;
  if (composed.startsWith("data:")) {
    const base64Data = composed.split(",")[1];
    if (!base64Data) {
      throw new HttpError(500, "FFmpeg compose service returned an empty data URL");
    }

    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const fileName = `composed_${entityId}_${Date.now()}.mp4`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("videos")
      .upload(fileName, bytes, {
        contentType: "video/mp4",
        upsert: true,
      });

    if (uploadError || !uploadData) {
      throw new HttpError(500, `Failed to store composed video: ${uploadError?.message ?? "unknown error"}`);
    }

    const { data: publicUrlData } = supabase.storage.from("videos").getPublicUrl(uploadData.path);
    finalUrl = publicUrlData.publicUrl;
  }

  if (!isHttpUrl(finalUrl)) {
    throw new HttpError(500, "Composed video URL is not a usable http(s) URL");
  }

  return finalUrl;
}

async function getTemplate(
  supabase: SupabaseClient,
  templateData: VideoTemplate | null,
  templateId: string | null
): Promise<VideoTemplate> {
  if (templateData) return templateData;

  if (templateId) {
    const { data } = await supabase
      .from("video_templates")
      .select("*")
      .eq("id", templateId)
      .maybeSingle();
    if (data) return data as VideoTemplate;
  }

  const { data: defaultTemplate } = await supabase
    .from("video_templates")
    .select("*")
    .eq("is_default", true)
    .eq("is_system", true)
    .maybeSingle();

  if (defaultTemplate) return defaultTemplate as VideoTemplate;

  return DEFAULT_TEMPLATE;
}

async function verifyOwnership(
  supabase: SupabaseClient,
  table: string,
  id: string,
  userId: string | null
): Promise<boolean> {
  if (!userId) return true;
  const { data } = await supabase
    .from(table as "clips")
    .select("user_id")
    .eq("id", id)
    .maybeSingle();
  if (!data) return false;
  const ownerId = (data as { user_id?: string }).user_id;
  if (typeof ownerId !== "string" || ownerId.length === 0) return false;
  return ownerId === userId;
}

async function handleEpisodeCompose(
  supabase: SupabaseClient,
  episodeId: string
) {
  const { data: episode, error: episodeError } = await supabase
    .from("episodes")
    .select("*, video_templates(*)")
    .eq("id", episodeId)
    .maybeSingle();

  if (episodeError || !episode) {
    throw new HttpError(404, episodeError?.message || "Episode not found");
  }

  if (!episode.final_video_url) {
    throw new HttpError(400, "Episode has no stitched video yet");
  }

  await supabase
    .from("episodes")
    .update({ overlay_status: "composing" })
    .eq("id", episodeId);

  const template = await getTemplate(supabase, episode.video_templates, episode.template_id);
  const { serviceUrl, serviceKey } = requireServiceConfig();

  const [{ data: shots }, { data: scriptRow }] = await Promise.all([
    supabase
      .from("episode_shots")
      .select("dialogue, speaker, duration_seconds, sequence, shot_type")
      .eq("episode_id", episodeId),
    supabase
      .from("episode_scripts")
      .select("hook_question, reaction_line")
      .eq("episode_id", episodeId)
      .maybeSingle(),
  ]);
  const script = scriptRow as { hook_question?: string; reaction_line?: string | null } | null;
  const overlays = buildEpisodeOverlayEntries(
    template,
    episode.episode_number ?? null,
    script?.hook_question || "Subway interview",
    script?.reaction_line ?? null,
    (shots ?? []) as Array<{
      dialogue: string | null;
      speaker: string | null;
      duration_seconds: number;
      sequence: number;
      shot_type: string | null;
    }>,
  );

  try {
    const finalUrl = await composeWithFFmpegService(
      supabase,
      episode.final_video_url,
      overlays,
      episodeId,
      serviceUrl,
      serviceKey,
    );

    await supabase
      .from("episodes")
      .update({ overlay_status: "done", composed_video_url: finalUrl })
      .eq("id", episodeId);

    return { success: true, composed_video_url: finalUrl };
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : "Overlay composition failed";
    await supabase
      .from("episodes")
      .update({ overlay_status: "error", error: message })
      .eq("id", episodeId);
    throw error;
  }
}

async function handleClipCompose(
  supabase: SupabaseClient,
  clipId: string
) {
  const { data: clip, error: clipError } = await supabase
    .from("clips")
    .select("*, video_templates(*)")
    .eq("id", clipId)
    .maybeSingle();

  if (clipError || !clip) {
    throw new HttpError(404, clipError?.message || "Clip not found");
  }

  if (!clip.result_url) {
    throw new HttpError(400, "Clip has no generated video yet");
  }

  await supabase
    .from("clips")
    .update({ overlay_status: "composing" })
    .eq("id", clipId);

  const template = await getTemplate(supabase, clip.video_templates, clip.template_id);
  const { serviceUrl, serviceKey } = requireServiceConfig();

  const overlays = buildClipOverlayEntries(template, {
    topic: clip.topic,
    interview_question: clip.interview_question ?? null,
    speech_script: clip.speech_script ?? null,
    duration_seconds: clip.duration_seconds ?? 10,
    video_type: clip.video_type ?? "subway_interview",
    subject_demographic: clip.subject_demographic ?? null,
  });

  try {
    const finalUrl = await composeWithFFmpegService(
      supabase,
      clip.result_url,
      overlays,
      clipId,
      serviceUrl,
      serviceKey,
    );

    await supabase
      .from("clips")
      .update({ overlay_status: "done", composed_video_url: finalUrl })
      .eq("id", clipId);

    return { success: true, composed_video_url: finalUrl };
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : "Overlay composition failed";
    await supabase
      .from("clips")
      .update({ overlay_status: "error", error: message })
      .eq("id", clipId);
    throw error;
  }
}

async function handleCompilationCompose(
  supabase: SupabaseClient,
  compilationId: string
) {
  const { data: compilation, error: compError } = await supabase
    .from("compilations")
    .select("*, video_templates(*)")
    .eq("id", compilationId)
    .maybeSingle();

  if (compError || !compilation) {
    throw new HttpError(404, compError?.message || "Compilation not found");
  }

  if (!compilation.final_video_url) {
    throw new HttpError(400, "Compilation has no stitched video yet");
  }

  await supabase
    .from("compilations")
    .update({ overlay_status: "composing" })
    .eq("id", compilationId);

  const template = await getTemplate(supabase, compilation.video_templates, compilation.template_id);
  const { serviceUrl, serviceKey } = requireServiceConfig();

  const { data: compilationClips } = await supabase
    .from("compilation_clips")
    .select("sequence, clips(topic, speech_script, duration_seconds)")
    .eq("compilation_id", compilationId);
  const clipRows = (compilationClips ?? []).map((row: Record<string, unknown>) => {
    const c = row.clips as Record<string, unknown> | null;
    return {
      topic: String(c?.topic ?? ""),
      speech_script: (c?.speech_script as string | null) ?? null,
      duration_seconds: Number(c?.duration_seconds ?? 5),
      sequence: Number(row.sequence ?? 0),
    };
  });
  const overlays = buildCompilationOverlayEntries(
    template,
    {
      name: compilation.name ?? "Compilation",
      total_duration_seconds: compilation.total_duration_seconds ?? 30,
    },
    clipRows,
  );

  try {
    const finalUrl = await composeWithFFmpegService(
      supabase,
      compilation.final_video_url,
      overlays,
      compilationId,
      serviceUrl,
      serviceKey,
    );

    await supabase
      .from("compilations")
      .update({ overlay_status: "done", composed_video_url: finalUrl })
      .eq("id", compilationId);

    return { success: true, composed_video_url: finalUrl };
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : "Overlay composition failed";
    await supabase
      .from("compilations")
      .update({ overlay_status: "error", error: message })
      .eq("id", compilationId);
    throw error;
  }
}

Deno.serve(async (req: Request) => {
  const cors = buildCorsHeaders(req.headers.get("Origin"));

  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  try {
    let authenticatedUserId: string | null = null;
    if (internalCall(req)) {
      authenticatedUserId = null;
    } else {
      const { userId } = await requireUser(req);
      authenticatedUserId = userId;
    }

    const supabase = serviceClient();

    let body: ComposeRequest;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400, cors);
    }

    if (!body.episode_id && !body.clip_id && !body.compilation_id) {
      return jsonResponse(
        { error: "episode_id, clip_id, or compilation_id is required" },
        400,
        cors,
      );
    }

    if (body.episode_id) {
      if (!(await verifyOwnership(supabase, "episodes", body.episode_id, authenticatedUserId))) {
        return jsonResponse({ error: "Not found" }, 404, cors);
      }
    } else if (body.clip_id) {
      if (!(await verifyOwnership(supabase, "clips", body.clip_id, authenticatedUserId))) {
        return jsonResponse({ error: "Not found" }, 404, cors);
      }
    } else if (body.compilation_id) {
      if (!(await verifyOwnership(supabase, "compilations", body.compilation_id, authenticatedUserId))) {
        return jsonResponse({ error: "Not found" }, 404, cors);
      }
    }

    let result;

    if (body.episode_id) {
      result = await handleEpisodeCompose(supabase, body.episode_id);
    } else if (body.compilation_id) {
      result = await handleCompilationCompose(supabase, body.compilation_id);
    } else {
      result = await handleClipCompose(supabase, body.clip_id!);
    }

    return jsonResponse(result, 200, cors);
  } catch (err) {
    console.error("Compose overlay error:", err);
    return errorResponse(err, cors);
  }
});
