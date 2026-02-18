import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface OverlayTextEntry {
  text: string;
  x: string;
  y: string;
  fontSize: number;
  color: string;
  startTime: number;
  endTime: number;
  boxEnabled?: boolean;
  boxColor?: string;
}

interface ComposeRequest {
  episode_id: string;
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
}

function getServiceConfig() {
  const serviceUrl =
    Deno.env.get("THUMBNAIL_SERVICE_URL") || Deno.env.get("FFMPEG_SERVICE_URL");
  const serviceKey =
    Deno.env.get("THUMBNAIL_SERVICE_KEY") || Deno.env.get("FFMPEG_SERVICE_KEY");
  return { serviceUrl, serviceKey };
}

function positionToXY(
  position: string,
  _width: number,
  _height: number
): { x: string; y: string } {
  const map: Record<string, { x: string; y: string }> = {
    "top-left": { x: "32", y: "48" },
    "top-right": { x: "(w-tw-32)", y: "48" },
    "top-center": { x: "(w-tw)/2", y: "48" },
    "bottom-left": { x: "32", y: "(h-th-120)" },
    "bottom-right": { x: "(w-tw-32)", y: "(h-th-120)" },
    "bottom-center": { x: "(w-tw)/2", y: "(h-th-120)" },
    top: { x: "(w-tw)/2", y: "48" },
    center: { x: "(w-tw)/2", y: "(h-th)/2" },
    bottom: { x: "32", y: "(h-th-100)" },
  };
  return map[position] || map["top-left"];
}

function buildOverlayEntries(
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
): OverlayTextEntry[] {
  const entries: OverlayTextEntry[] = [];

  const sortedShots = [...shots].sort((a, b) => a.sequence - b.sequence);

  const shotTimestamps: Array<{ start: number; end: number }> = [];
  let cumulative = 0;
  for (const shot of sortedShots) {
    shotTimestamps.push({
      start: cumulative,
      end: cumulative + shot.duration_seconds,
    });
    cumulative += shot.duration_seconds;
  }
  const totalDuration = cumulative;

  const watermarkPos = positionToXY(template.watermark_position, 1080, 1920);
  entries.push({
    text: template.watermark_text,
    x: watermarkPos.x,
    y: watermarkPos.y,
    fontSize: template.watermark_font_size,
    color: template.watermark_color,
    startTime: 0,
    endTime: totalDuration,
    boxEnabled: false,
  });

  const prefix = episodeNumber
    ? template.episode_prefix_format.replace("{number}", String(episodeNumber))
    : "";
  const titleText = prefix
    ? `${template.watermark_text} ${prefix} ${hookQuestion}`
    : `${template.watermark_text} ${hookQuestion}`;

  const captionPos = positionToXY(template.caption_position, 1080, 1920);
  const titleEnd = Math.min(14, totalDuration);
  entries.push({
    text: titleText,
    x: captionPos.x,
    y: captionPos.y,
    fontSize: template.caption_font_size,
    color: template.caption_color,
    startTime: 0,
    endTime: titleEnd,
    boxEnabled: true,
    boxColor: `black@${template.caption_bg_opacity}`,
  });

  if (template.reaction_text_enabled) {
    const reactionPos = positionToXY(
      template.reaction_text_position,
      1080,
      1920
    );

    for (let i = 0; i < sortedShots.length; i++) {
      const shot = sortedShots[i];
      const ts = shotTimestamps[i];

      if (shot.shot_type === "reaction" && reactionLine) {
        entries.push({
          text: reactionLine,
          x: reactionPos.x,
          y: reactionPos.y,
          fontSize: template.reaction_text_font_size,
          color: template.caption_color,
          startTime: ts.start + 0.5,
          endTime: ts.end - 0.3,
          boxEnabled: false,
        });
      } else if (shot.shot_type === "close" && shot.dialogue) {
        entries.push({
          text: shot.dialogue,
          x: reactionPos.x,
          y: reactionPos.y,
          fontSize: template.reaction_text_font_size,
          color: template.caption_color,
          startTime: ts.start + 1,
          endTime: ts.end - 0.5,
          boxEnabled: false,
        });
      }
    }
  }

  return entries;
}

async function composeWithFFmpegService(
  videoUrl: string,
  overlays: OverlayTextEntry[],
  serviceUrl: string,
  serviceKey: string | undefined
): Promise<string | null> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (serviceKey) {
      headers["Authorization"] = `Bearer ${serviceKey}`;
    }

    const response = await fetch(`${serviceUrl}/add-watermark`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        videoUrl,
        overlays,
      }),
    });

    if (!response.ok) {
      console.error("FFmpeg compose error:", response.status);
      return null;
    }

    const data = await response.json();
    return data.video || data.url || null;
  } catch (err) {
    console.error("Compose service error:", err);
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { episode_id }: ComposeRequest = await req.json();

    if (!episode_id) {
      return new Response(
        JSON.stringify({ error: "episode_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: episode, error: episodeError } = await supabase
      .from("episodes")
      .select(
        "*, episode_scripts(*), video_templates(*)"
      )
      .eq("id", episode_id)
      .maybeSingle();

    if (episodeError || !episode) {
      return new Response(
        JSON.stringify({
          error: episodeError?.message || "Episode not found",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!episode.final_video_url) {
      return new Response(
        JSON.stringify({
          error: "Episode has no stitched video yet",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    await supabase
      .from("episodes")
      .update({ overlay_status: "composing" })
      .eq("id", episode_id);

    let template: VideoTemplate;
    if (episode.video_templates) {
      template = episode.video_templates;
    } else {
      const { data: defaultTemplate } = await supabase
        .from("video_templates")
        .select("*")
        .eq("is_default", true)
        .eq("is_system", true)
        .maybeSingle();

      if (!defaultTemplate) {
        template = {
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
      } else {
        template = defaultTemplate;
      }
    }

    const { data: shots } = await supabase
      .from("episode_shots")
      .select("dialogue, speaker, duration_seconds, sequence, shot_type")
      .eq("episode_id", episode_id)
      .order("sequence");

    const hookQuestion =
      episode.episode_scripts?.hook_question || "Subway interview";
    const reactionLine =
      episode.episode_scripts?.reaction_line || null;

    const overlays = buildOverlayEntries(
      template,
      episode.episode_number,
      hookQuestion,
      reactionLine,
      shots || []
    );

    const { serviceUrl, serviceKey } = getServiceConfig();

    if (!serviceUrl) {
      await supabase
        .from("episodes")
        .update({
          overlay_status: "done",
          composed_video_url: episode.final_video_url,
        })
        .eq("id", episode_id);

      return new Response(
        JSON.stringify({
          success: true,
          composed_video_url: episode.final_video_url,
          note: "No FFmpeg service configured, using raw video",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const composedUrl = await composeWithFFmpegService(
      episode.final_video_url,
      overlays,
      serviceUrl,
      serviceKey
    );

    if (composedUrl) {
      let finalUrl = composedUrl;

      if (composedUrl.startsWith("data:")) {
        const base64Data = composedUrl.split(",")[1];
        if (base64Data) {
          const binaryStr = atob(base64Data);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }

          const fileName = `composed_${episode_id}_${Date.now()}.mp4`;
          const { data: uploadData } = await supabase.storage
            .from("episode-videos")
            .upload(fileName, bytes, {
              contentType: "video/mp4",
              upsert: true,
            });

          if (uploadData) {
            const {
              data: { publicUrl },
            } = supabase.storage
              .from("episode-videos")
              .getPublicUrl(fileName);
            finalUrl = publicUrl;
          }
        }
      }

      await supabase
        .from("episodes")
        .update({
          overlay_status: "done",
          composed_video_url: finalUrl,
        })
        .eq("id", episode_id);

      return new Response(
        JSON.stringify({ success: true, composed_video_url: finalUrl }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    await supabase
      .from("episodes")
      .update({
        overlay_status: "done",
        composed_video_url: episode.final_video_url,
      })
      .eq("id", episode_id);

    return new Response(
      JSON.stringify({
        success: true,
        composed_video_url: episode.final_video_url,
        note: "Compose failed, using raw video as fallback",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Compose overlay error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
