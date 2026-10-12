import { type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { internalCall, requireUser, serviceClient } from "../_shared/auth.ts";

interface StitchRequest {
  episode_id: string;
}

interface EpisodeShot {
  id: string;
  sequence: number;
  result_url: string | null;
  status: string;
  duration_seconds: number;
  dialogue: string | null;
  speaker: string | null;
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

      const fileName = `episode_stitch_${Date.now()}.mp4`;
      const { data: uploadData, error } = await supabase.storage
        .from("videos")
        .upload(`episodes/${fileName}`, bytes, {
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

    let body: StitchRequest;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400, cors);
    }
    parsedBody = body as unknown as Record<string, unknown>;
    const { episode_id } = body;

    if (!episode_id) {
      return jsonResponse({ error: "episode_id is required" }, 400, cors);
    }

    const { data: episode } = await supabase
      .from("episodes")
      .select("user_id")
      .eq("id", episode_id)
      .maybeSingle();

    if (!episode) {
      return jsonResponse({ error: "Not found" }, 404, cors);
    }

    if (authenticatedUserId && episode.user_id && episode.user_id !== authenticatedUserId) {
      return jsonResponse({ error: "Not found" }, 404, cors);
    }

    const { data: shots, error: shotsError } = await supabase
      .from("episode_shots")
      .select("*")
      .eq("episode_id", episode_id)
      .order("sequence", { ascending: true });

    if (shotsError || !shots || shots.length === 0) {
      throw new Error("No shots found for episode");
    }

    const typedShots = shots as unknown as EpisodeShot[];

    // Readiness gate: every shot must be 'done' with a usable result URL.
    // An 'error' (or unfinished) shot blocks stitching instead of stitching
    // the first shot silently.
    const allShotsComplete = typedShots.every(
      (shot) => shot.status === "done" && isHttpUrl(shot.result_url ?? "")
    );

    if (!allShotsComplete) {
      const anyError = typedShots.some((shot) => shot.status === "error");
      if (anyError) {
        await supabase
          .from("episodes")
          .update({ status: "error", error: "One or more shots failed" })
          .eq("id", episode_id);
        return jsonResponse({ error: "One or more shots failed" }, 400, cors);
      }
      return jsonResponse(
        { error: "Not all shots are complete", status: "waiting" },
        400,
        cors,
      );
    }

    const videoUrls = typedShots
      .slice()
      .sort((a, b) => a.sequence - b.sequence)
      .map((shot) => shot.result_url as string);

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
              type: "crossfade",
              duration: 0.3,
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
        .from("episodes")
        .update({ status: "error", error: message })
        .eq("id", episode_id);
      return jsonResponse({ error: message }, 500, cors);
    }

    let captionFileUrl: string | null = null;
    const captions = generateSrtCaptions(typedShots);

    if (captions) {
      const captionFileName = `captions_${episode_id}.srt`;
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

    const { error: updateError } = await supabase
      .from("episodes")
      .update({
        status: "done",
        final_video_url: finalVideoUrl,
        caption_file_url: captionFileUrl,
        thumbnail_url: videoUrls[0],
        completed_at: new Date().toISOString(),
      })
      .eq("id", episode_id);

    if (updateError) {
      throw updateError;
    }

    return jsonResponse(
      {
        success: true,
        episode_id,
        final_video_url: finalVideoUrl,
        caption_file_url: captionFileUrl,
      },
      200,
      cors,
    );
  } catch (error) {
    console.error("Stitch error:", error);

    try {
      const body = parsedBody || {};
      if (body.episode_id) {
        const supabase = serviceClient();

        await supabase
          .from("episodes")
          .update({ status: "error", error: "Stitching failed" })
          .eq("id", body.episode_id as string);
      }
    } catch { /* best effort */ }

    const message = error instanceof Error && error.message ? error.message : "Episode stitching failed";
    return jsonResponse({ error: message }, 500, cors);
  }
});

function generateSrtCaptions(shots: EpisodeShot[]): string {
  let srt = "";
  let index = 1;
  let currentTime = 0;

  for (const shot of shots) {
    if (shot.dialogue && shot.speaker) {
      const startTime = formatSrtTime(currentTime);
      const endTime = formatSrtTime(Math.max(0, currentTime + shot.duration_seconds - 0.5));

      srt += `${index}\n`;
      srt += `${startTime} --> ${endTime}\n`;
      srt += `${shot.dialogue}\n\n`;

      index++;
    }
    currentTime += shot.duration_seconds;
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
