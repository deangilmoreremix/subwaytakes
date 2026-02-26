import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface StitchRequest {
  episode_id: string;
}

interface EpisodeShot {
  id: string;
  sequence: number;
  result_url: string | null;
  duration_seconds: number;
  dialogue: string | null;
  speaker: string | null;
}

function getServiceConfig() {
  const serviceUrl = Deno.env.get("THUMBNAIL_SERVICE_URL") || Deno.env.get("FFMPEG_SERVICE_URL");
  const serviceKey = Deno.env.get("THUMBNAIL_SERVICE_KEY") || Deno.env.get("FFMPEG_SERVICE_KEY");
  return { serviceUrl, serviceKey };
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

    if (data.video && data.video.startsWith("data:")) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

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

      return publicUrlData.publicUrl;
    }

    return data.videoUrl || null;
  } catch (err) {
    console.error("FFmpeg service stitch error:", err);
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  let parsedBody: Record<string, unknown> = {};

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header is required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const isInternalCall = authHeader === `Bearer ${serviceRoleKey}`;
    let authenticatedUserId: string | null = null;

    if (!isInternalCall) {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const authClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user: authUser }, error: authError } = await authClient.auth.getUser();
      if (authError || !authUser) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      authenticatedUserId = authUser.id;
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let body: StitchRequest;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    parsedBody = body as unknown as Record<string, unknown>;
    const { episode_id } = body;

    if (!episode_id) {
      return new Response(
        JSON.stringify({ error: "episode_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: episode } = await supabase
      .from("episodes")
      .select("user_id")
      .eq("id", episode_id)
      .maybeSingle();

    if (authenticatedUserId && episode?.user_id && episode.user_id !== authenticatedUserId) {
      return new Response(
        JSON.stringify({ error: "Not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: shots, error: shotsError } = await supabase
      .from("episode_shots")
      .select("*")
      .eq("episode_id", episode_id)
      .order("sequence", { ascending: true });

    if (shotsError || !shots || shots.length === 0) {
      throw new Error("No shots found for episode");
    }

    const allShotsComplete = shots.every(
      (shot: EpisodeShot) => shot.result_url && shot.result_url.length > 0
    );

    if (!allShotsComplete) {
      return new Response(
        JSON.stringify({ error: "Not all shots are complete", status: "waiting" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const videoUrls = shots
      .sort((a: EpisodeShot, b: EpisodeShot) => a.sequence - b.sequence)
      .map((shot: EpisodeShot) => shot.result_url);

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
          videoUrls as string[],
          serviceUrl,
          serviceKey
        );
      }
    }

    const isStitchFallback = !finalVideoUrl;
    if (!finalVideoUrl) {
      finalVideoUrl = videoUrls[0] as string;
    }

    let captionFileUrl: string | null = null;
    const captions = generateSrtCaptions(shots as EpisodeShot[]);

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
        ...(isStitchFallback ? { error: "Stitching unavailable - using first shot as preview" } : {}),
      })
      .eq("id", episode_id);

    if (updateError) {
      throw updateError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        episode_id,
        final_video_url: finalVideoUrl,
        caption_file_url: captionFileUrl,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Stitch error:", error);

    try {
      const body = parsedBody || {};
      if (body.episode_id) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        await supabase
          .from("episodes")
          .update({ status: "error", error: "Stitching failed" })
          .eq("id", body.episode_id);
      }
    } catch { /* best effort */ }

    return new Response(
      JSON.stringify({ error: "Episode stitching failed" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
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
