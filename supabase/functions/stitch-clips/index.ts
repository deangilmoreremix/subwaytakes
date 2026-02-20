import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

function getServiceConfig() {
  const serviceUrl = Deno.env.get("THUMBNAIL_SERVICE_URL") || Deno.env.get("FFMPEG_SERVICE_URL");
  const serviceKey = Deno.env.get("THUMBNAIL_SERVICE_KEY") || Deno.env.get("FFMPEG_SERVICE_KEY");
  return { serviceUrl, serviceKey };
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

    const response = await fetch(`${serviceUrl}/stitch-videos`, {
      method: "POST",
      headers,
      body: JSON.stringify({ videoUrls }),
    });

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

      return publicUrlData.publicUrl;
    }

    return data.videoUrl || null;
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
      const startTime = formatSrtTime(currentTime + entry.trim_start);
      const duration = clip.duration_seconds - entry.trim_start - (entry.trim_end || 0);
      const endTime = formatSrtTime(currentTime + entry.trim_start + duration - 0.5);

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
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: StitchClipsRequest = await req.json();
    const { compilation_id } = body;

    if (!compilation_id) {
      return new Response(
        JSON.stringify({ error: "compilation_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: compilation, error: compError } = await supabase
      .from("compilations")
      .select("*")
      .eq("id", compilation_id)
      .maybeSingle();

    if (compError || !compilation) {
      throw new Error(compError?.message || "Compilation not found");
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
      (e) => e.clips && e.clips.result_url && e.clips.status === "done"
    );

    if (!allReady) {
      return new Response(
        JSON.stringify({ error: "Not all clips are ready", status: "waiting" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const videoUrls = typedEntries.map((e) => e.clips.result_url!);

    let finalVideoUrl: string | null = null;

    const shotgunApiKey = Deno.env.get("SHOTGUN_API_KEY");
    if (shotgunApiKey) {
      try {
        const stitchResponse = await fetch("https://api.shotgun.video/v1/stitch", {
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
        });

        if (stitchResponse.ok) {
          const stitchResult = await stitchResponse.json();
          let attempts = 0;
          const maxAttempts = 120;

          while (attempts < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 5000));

            const statusResponse = await fetch(
              `https://api.shotgun.video/v1/jobs/${stitchResult.job_id}`,
              {
                headers: {
                  "Authorization": `Bearer ${shotgunApiKey}`,
                },
              }
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
          videoUrls,
          serviceUrl,
          serviceKey
        );
      }
    }

    if (!finalVideoUrl) {
      finalVideoUrl = videoUrls[0];
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

    return new Response(
      JSON.stringify({
        success: true,
        compilation_id,
        final_video_url: finalVideoUrl,
        caption_file_url: captionFileUrl,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Stitch clips error:", error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    try {
      const body = await req.clone().json().catch(() => ({}));
      if (body.compilation_id) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        await supabase
          .from("compilations")
          .update({
            status: "error",
            error: errorMessage,
          })
          .eq("id", body.compilation_id);
      }
    } catch {}

    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
