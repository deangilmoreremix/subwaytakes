import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
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

    const body: StitchRequest = await req.json();
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

    let finalVideoUrl: string;
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
              type: "crossfade",
              duration: 0.3,
            },
          }),
        });

        if (stitchResponse.ok) {
          const stitchResult = await stitchResponse.json();

          let attempts = 0;
          const maxAttempts = 60;

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
                throw new Error("Stitching failed");
              }
            }

            attempts++;
          }

          if (!finalVideoUrl!) {
            throw new Error("Stitching timed out");
          }
        } else {
          throw new Error("Failed to start stitching job");
        }
      } catch (stitchError) {
        console.error("Shotgun API error:", stitchError);
        finalVideoUrl = videoUrls[0] as string;
      }
    } else {
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

    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    try {
      const body = await req.clone().json().catch(() => ({}));
      if (body.episode_id) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        await supabase
          .from("episodes")
          .update({
            status: "error",
            error: errorMessage,
          })
          .eq("id", body.episode_id);
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

function generateSrtCaptions(shots: EpisodeShot[]): string {
  let srt = "";
  let index = 1;
  let currentTime = 0;

  for (const shot of shots) {
    if (shot.dialogue && shot.speaker) {
      const startTime = formatSrtTime(currentTime);
      const endTime = formatSrtTime(currentTime + shot.duration_seconds - 0.5);

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
