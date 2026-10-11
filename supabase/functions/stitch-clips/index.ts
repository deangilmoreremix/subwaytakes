import { type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { internalCall, requireUser, serviceClient } from "../_shared/auth.ts";

interface StitchClipsRequest {
  compilation_id: string;
}

interface CompilationClipRow {
  id: string;
  clip_id: string;
  sequence: number;
  trim_start: number;
  trim_end: number | null;
  clips: {
    id: string;
    result_url: string | null;
    status: string;
    duration_seconds: number;
    speech_script: string | null;
    topic: string;
  };
}

function getServiceConfig(): { serviceUrl: string | undefined; serviceKey: string | undefined } {
  const serviceUrl = Deno.env.get("THUMBNAIL_SERVICE_URL") || Deno.env.get("FFMPEG_SERVICE_URL");
  const serviceKey = Deno.env.get("THUMBNAIL_SERVICE_KEY") || Deno.env.get("FFMPEG_SERVICE_KEY");
  return { serviceUrl, serviceKey };
}

function isHttpUrl(value: string): boolean {
  return value.startsWith("https://") || value.startsWith("http://");
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function stitchWithFFmpegService(
  supabase: SupabaseClient,
  videoUrls: string[],
  serviceUrl: string,
  serviceKey: string | undefined
): Promise<string | null> {
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (serviceKey) {
      headers["Authorization"] = `Bearer ${serviceKey}`;
    }

    const response = await fetchWithTimeout(`${serviceUrl}/stitch-videos`, {
      method: "POST",
      headers,
      body: JSON.stringify({ videoUrls }),
    }, 120000);

    if (!response.ok) {
      console.error("FFmpeg stitch error:", response.status);
      return null;
    }

    const data = await response.json();

    if (typeof data.video === "string" && data.video.startsWith("data:")) {
      const base64Data = data.video.split(",")[1];
      if (!base64Data) return null;

      const binaryStr = atob(base64Data);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const fileName = `compilation_stitch_${Date.now()}.mp4`;
      const { data: uploadData, error } = await supabase.storage
        .from("videos")
        .upload(`compilations/${fileName}`, bytes, {
          contentType: "video/mp4",
          upsert: true,
        });

      if (error) {
        console.error("Storage upload error:", error);
        return null;
      }

      const { data: publicUrlData } = supabase.storage
        .from("videos")
        .getPublicUrl(uploadData.path);

      return isHttpUrl(publicUrlData.publicUrl) ? publicUrlData.publicUrl : null;
    }

    if (typeof data.videoUrl === "string" && isHttpUrl(data.videoUrl)) {
      return data.videoUrl;
    }

    console.error("FFmpeg stitch returned no usable video URL");
    return null;
  } catch (err) {
    console.error("FFmpeg service stitch error:", err);
    return null;
  }
}

function generateSrtCaptions(
  entries: CompilationClipRow[],
  transitionDuration: number
): string {
  let srt = "";
  let index = 1;
  let currentTime = 0;

  for (const entry of entries) {
    const clip = entry.clips;
    if (clip.speech_script) {
      const startTime = formatSrtTime(currentTime);
      const duration = clip.duration_seconds - entry.trim_start - (entry.trim_end || 0);
      const endTime = formatSrtTime(Math.max(0, currentTime + duration - 0.5));

      srt += `${index}\n`;
      srt += `${startTime} --> ${endTime}\n`;
      srt += `${clip.speech_script}\n\n`;
      index++;
    }
    const clipDuration = clip.duration_seconds - entry.trim_start - (entry.trim_end || 0);
    currentTime += clipDuration - transitionDuration;
  }

  return srt;
}

function formatSrtTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

Deno.serve(async (req: Request) => {
  const cors = buildCorsHeaders(req.headers.get("Origin"));

  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  let parsedBody: Record<string, unknown> = {};

  try {
    let authenticatedUserId: string | null = null;
    if (internalCall(req)) {
      authenticatedUserId = null;
    } else {
      const { userId } = await requireUser(req);
      authenticatedUserId = userId;
    }

    const supabase = serviceClient();

    let body: StitchClipsRequest;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400, cors);
    }
    parsedBody = body as unknown as Record<string, unknown>;
    const { compilation_id } = body;

    if (!compilation_id) {
      return jsonResponse({ error: "compilation_id is required" }, 400, cors);
    }

    const { data: compilation, error: compError } = await supabase
      .from("compilations")
      .select("*")
      .eq("id", compilation_id)
      .maybeSingle();

    if (compError || !compilation) {
      throw new Error(compError?.message || "Compilation not found");
    }

    if (authenticatedUserId && compilation.user_id && compilation.user_id !== authenticatedUserId) {
      return jsonResponse({ error: "Not found" }, 404, cors);
    }

    const { data: entries, error: entriesError } = await supabase
      .from("compilation_clips")
      .select("*, clips(*)")
      .eq("compilation_id", compilation_id)
      .order("sequence", { ascending: true });

    if (entriesError || !entries || entries.length === 0) {
      throw new Error("No clips found for compilation");
    }

    const typedEntries = entries as unknown as CompilationClipRow[];

    const allReady = typedEntries.every(
      (e) => e.clips && isHttpUrl(e.clips.result_url ?? "") && e.clips.status === "done"
    );

    if (!allReady) {
      return jsonResponse(
        { error: "Not all clips are ready", status: "waiting" },
        400,
        cors,
      );
    }

    const videoUrls = typedEntries.map((e) => e.clips.result_url!);

    let finalVideoUrl: string | null = null;

    const shotgunApiKey = Deno.env.get("SHOTGUN_API_KEY");
    if (shotgunApiKey) {
      try {
        const stitchResponse = await fetchWithTimeout("https://api.shotgun.video/v1/stitch", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${shotgunApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            videos: videoUrls,
            output: {
              format: "mp4",
              resolution: "1080x1920",
              fps: 30,
            },
            transitions: {
              type: compilation.transition_type || "crossfade",
              duration: compilation.transition_duration || 0.3,
            },
          }),
        }, 30000);

        if (stitchResponse.ok) {
          const stitchResult = await stitchResponse.json();
          let attempts = 0;
          const maxAttempts = 25;

          while (attempts < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 5000));

            const statusResponse = await fetchWithTimeout(
              `https://api.shotgun.video/v1/jobs/${stitchResult.job_id}`,
              {
                headers: {
                  "Authorization": `Bearer ${shotgunApiKey}`,
                },
              },
              15000
            );

            if (statusResponse.ok) {
              const statusData = await statusResponse.json();
              if (statusData.status === "completed") {
                finalVideoUrl = statusData.output_url;
                break;
              } else if (statusData.status === "failed") {
                throw new Error("Shotgun stitching failed");
              }
            }
            attempts++;
          }

          if (!finalVideoUrl) {
            throw new Error("Shotgun stitching timed out");
          }
        } else {
          throw new Error("Failed to start Shotgun stitching job");
        }
      } catch (shotgunError) {
        console.error("Shotgun API error, falling through to FFmpeg:", shotgunError);
        finalVideoUrl = null;
      }
    }

    if (!finalVideoUrl) {
      const { serviceUrl, serviceKey } = getServiceConfig();
      if (serviceUrl) {
        finalVideoUrl = await stitchWithFFmpegService(
          supabase,
          videoUrls,
          serviceUrl,
          serviceKey
        );
      }
    }

    if (!finalVideoUrl || !isHttpUrl(finalVideoUrl)) {
      const message = "Stitching failed: no stitch provider returned a usable video";
      await supabase
        .from("compilations")
        .update({ status: "error", error: message })
        .eq("id", compilation_id);
      return jsonResponse({ error: message }, 500, cors);
    }

    let captionFileUrl: string | null = null;
    const transitionDur = compilation.transition_type !== "cut"
      ? (compilation.transition_duration || 0.3)
      : 0;
    const captions = generateSrtCaptions(typedEntries, transitionDur);

    if (captions) {
      const captionFileName = `captions_compilation_${compilation_id}.srt`;
      const { data: uploadData } = await supabase.storage
        .from("captions")
        .upload(captionFileName, captions, {
          contentType: "text/plain",
          upsert: true,
        });

      if (uploadData) {
        const { data: publicUrl } = supabase.storage
          .from("captions")
          .getPublicUrl(captionFileName);
        captionFileUrl = publicUrl?.publicUrl || null;
      }
    }

    const thumbnailUrl = typedEntries[0]?.clips?.result_url || null;

    const { error: updateError } = await supabase
      .from("compilations")
      .update({
        status: "done",
        final_video_url: finalVideoUrl,
        caption_file_url: captionFileUrl,
        thumbnail_url: thumbnailUrl,
        completed_at: new Date().toISOString(),
      })
      .eq("id", compilation_id);

    if (updateError) {
      throw updateError;
    }

    return jsonResponse(
      {
        success: true,
        compilation_id,
        final_video_url: finalVideoUrl,
        caption_file_url: captionFileUrl,
      },
      200,
      cors,
    );
  } catch (error) {
    console.error("Stitch clips error:", error);

    try {
      const body = parsedBody || {};
      if (body.compilation_id) {
        const supabase = serviceClient();

        await supabase
          .from("compilations")
          .update({ status: "error", error: "Stitching failed" })
          .eq("id", body.compilation_id as string);
      }
    } catch { /* best effort */ }

    const message = error instanceof Error && error.message ? error.message : "Clip stitching failed";
    return jsonResponse({ error: message }, 500, cors);
  }
});
