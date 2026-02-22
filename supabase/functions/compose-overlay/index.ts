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

function buildClipOverlayEntries(
  template: VideoTemplate,
  clip: {
    topic: string;
    interview_question: string | null;
    speech_script: string | null;
    duration_seconds: number;
    video_type: string;
    interviewer_type: string | null;
    subject_demographic: string | null;
  }
): OverlayTextEntry[] {
  const entries: OverlayTextEntry[] = [];
  const totalDuration = clip.duration_seconds;

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

  const titleText = clip.interview_question
    ? `${template.watermark_text} ${clip.interview_question}`
    : `${template.watermark_text} ${clip.topic}`;

  const captionPos = positionToXY(template.caption_position, 1080, 1920);
  const titleEnd = Math.min(10, totalDuration);
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

  if (template.lower_third_enabled && clip.subject_demographic) {
    const label = clip.subject_demographic.replace(/_/g, ' ');
    entries.push({
      text: label,
      x: "32",
      y: "(h-th-200)",
      fontSize: 22,
      color: template.caption_color,
      startTime: 1,
      endTime: Math.min(8, totalDuration - 1),
      boxEnabled: true,
      boxColor: `black@0.5`,
    });
  }

  if (clip.speech_script && template.reaction_text_enabled) {
    const captionStart = titleEnd > 2 ? titleEnd - 1 : 1;
    entries.push({
      text: clip.speech_script.length > 80
        ? clip.speech_script.substring(0, 77) + "..."
        : clip.speech_script,
      x: "32",
      y: "(h-th-100)",
      fontSize: template.reaction_text_font_size,
      color: template.caption_color,
      startTime: captionStart,
      endTime: totalDuration - 1,
      boxEnabled: true,
      boxColor: `black@${template.caption_bg_opacity}`,
    });
  }

  if (template.endcard_enabled) {
    const endcardStart = Math.max(0, totalDuration - 3);
    const ctaText = template.endcard_style === 'subscribe'
      ? `Follow ${template.watermark_text}`
      : template.endcard_style === 'cta'
        ? `More at ${template.watermark_text}`
        : template.watermark_text;

    entries.push({
      text: ctaText,
      x: "(w-tw)/2",
      y: "(h-th)/2",
      fontSize: template.caption_font_size + 8,
      color: template.watermark_color,
      startTime: endcardStart,
      endTime: totalDuration,
      boxEnabled: true,
      boxColor: `black@0.7`,
    });
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

async function uploadComposedVideo(
  supabase: ReturnType<typeof createClient>,
  composedUrl: string,
  entityId: string,
  bucket: string
): Promise<string> {
  let finalUrl = composedUrl;

  if (composedUrl.startsWith("data:")) {
    const base64Data = composedUrl.split(",")[1];
    if (base64Data) {
      const binaryStr = atob(base64Data);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const fileName = `composed_${entityId}_${Date.now()}.mp4`;
      const { data: uploadData } = await supabase.storage
        .from(bucket)
        .upload(fileName, bytes, {
          contentType: "video/mp4",
          upsert: true,
        });

      if (uploadData) {
        const {
          data: { publicUrl },
        } = supabase.storage
          .from(bucket)
          .getPublicUrl(fileName);
        finalUrl = publicUrl;
      }
    }
  }

  return finalUrl;
}

async function getTemplate(
  supabase: ReturnType<typeof createClient>,
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
    if (data) return data;
  }

  const { data: defaultTemplate } = await supabase
    .from("video_templates")
    .select("*")
    .eq("is_default", true)
    .eq("is_system", true)
    .maybeSingle();

  if (defaultTemplate) return defaultTemplate;

  return {
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
}

async function handleEpisodeCompose(
  supabase: ReturnType<typeof createClient>,
  episodeId: string
) {
  const { data: episode, error: episodeError } = await supabase
    .from("episodes")
    .select("*, episode_scripts(*), video_templates(*)")
    .eq("id", episodeId)
    .maybeSingle();

  if (episodeError || !episode) {
    throw new Error(episodeError?.message || "Episode not found");
  }

  if (!episode.final_video_url) {
    throw new Error("Episode has no stitched video yet");
  }

  await supabase
    .from("episodes")
    .update({ overlay_status: "composing" })
    .eq("id", episodeId);

  const template = await getTemplate(supabase, episode.video_templates, episode.template_id);

  const { data: shots } = await supabase
    .from("episode_shots")
    .select("dialogue, speaker, duration_seconds, sequence, shot_type")
    .eq("episode_id", episodeId)
    .order("sequence");

  const hookQuestion = episode.episode_scripts?.hook_question || "Subway interview";
  const reactionLine = episode.episode_scripts?.reaction_line || null;

  const overlays = buildEpisodeOverlayEntries(
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
      .eq("id", episodeId);

    return {
      success: true,
      composed_video_url: episode.final_video_url,
      note: "No FFmpeg service configured, using raw video",
    };
  }

  const composedUrl = await composeWithFFmpegService(
    episode.final_video_url,
    overlays,
    serviceUrl,
    serviceKey
  );

  if (composedUrl) {
    const finalUrl = await uploadComposedVideo(supabase, composedUrl, episodeId, "episode-videos");

    await supabase
      .from("episodes")
      .update({
        overlay_status: "done",
        composed_video_url: finalUrl,
      })
      .eq("id", episodeId);

    return { success: true, composed_video_url: finalUrl };
  }

  await supabase
    .from("episodes")
    .update({
      overlay_status: "done",
      composed_video_url: episode.final_video_url,
    })
    .eq("id", episodeId);

  return {
    success: true,
    composed_video_url: episode.final_video_url,
    note: "Compose failed, using raw video as fallback",
  };
}

async function handleClipCompose(
  supabase: ReturnType<typeof createClient>,
  clipId: string
) {
  const { data: clip, error: clipError } = await supabase
    .from("clips")
    .select("*, video_templates(*)")
    .eq("id", clipId)
    .maybeSingle();

  if (clipError || !clip) {
    throw new Error(clipError?.message || "Clip not found");
  }

  if (!clip.result_url) {
    throw new Error("Clip has no generated video yet");
  }

  await supabase
    .from("clips")
    .update({ overlay_status: "composing" })
    .eq("id", clipId);

  const template = await getTemplate(supabase, clip.video_templates, clip.template_id);

  const overlays = buildClipOverlayEntries(template, {
    topic: clip.topic,
    interview_question: clip.interview_question,
    speech_script: clip.speech_script,
    duration_seconds: clip.duration_seconds,
    video_type: clip.video_type,
    interviewer_type: clip.interviewer_type,
    subject_demographic: clip.subject_demographic,
  });

  const { serviceUrl, serviceKey } = getServiceConfig();

  if (!serviceUrl) {
    await supabase
      .from("clips")
      .update({
        overlay_status: "done",
        composed_video_url: clip.result_url,
      })
      .eq("id", clipId);

    return {
      success: true,
      composed_video_url: clip.result_url,
      note: "No FFmpeg service configured, using raw video",
    };
  }

  const composedUrl = await composeWithFFmpegService(
    clip.result_url,
    overlays,
    serviceUrl,
    serviceKey
  );

  if (composedUrl) {
    const finalUrl = await uploadComposedVideo(supabase, composedUrl, clipId, "episode-videos");

    await supabase
      .from("clips")
      .update({
        overlay_status: "done",
        composed_video_url: finalUrl,
      })
      .eq("id", clipId);

    return { success: true, composed_video_url: finalUrl };
  }

  await supabase
    .from("clips")
    .update({
      overlay_status: "done",
      composed_video_url: clip.result_url,
    })
    .eq("id", clipId);

  return {
    success: true,
    composed_video_url: clip.result_url,
    note: "Compose failed, using raw video as fallback",
  };
}

function buildCompilationOverlayEntries(
  template: VideoTemplate,
  compilation: {
    name: string;
    total_duration_seconds: number;
  },
  clips: Array<{
    topic: string;
    speech_script: string | null;
    duration_seconds: number;
    sequence: number;
  }>
): OverlayTextEntry[] {
  const entries: OverlayTextEntry[] = [];
  const totalDuration = compilation.total_duration_seconds;

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

  const titleText = `${template.watermark_text} ${compilation.name}`;
  const captionPos = positionToXY(template.caption_position, 1080, 1920);
  const titleEnd = Math.min(10, totalDuration);
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
    let currentTime = 0;
    for (const clip of clips) {
      if (clip.speech_script) {
        const captionText = clip.speech_script.length > 80
          ? clip.speech_script.substring(0, 77) + "..."
          : clip.speech_script;
        entries.push({
          text: captionText,
          x: "32",
          y: "(h-th-100)",
          fontSize: template.reaction_text_font_size,
          color: template.caption_color,
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
    const endcardStart = Math.max(0, totalDuration - 3);
    const ctaText = template.endcard_style === 'subscribe'
      ? `Follow ${template.watermark_text}`
      : template.endcard_style === 'cta'
        ? `More at ${template.watermark_text}`
        : template.watermark_text;

    entries.push({
      text: ctaText,
      x: "(w-tw)/2",
      y: "(h-th)/2",
      fontSize: template.caption_font_size + 8,
      color: template.watermark_color,
      startTime: endcardStart,
      endTime: totalDuration,
      boxEnabled: true,
      boxColor: `black@0.7`,
    });
  }

  return entries;
}

async function handleCompilationCompose(
  supabase: ReturnType<typeof createClient>,
  compilationId: string
) {
  const { data: compilation, error: compError } = await supabase
    .from("compilations")
    .select("*, video_templates(*)")
    .eq("id", compilationId)
    .maybeSingle();

  if (compError || !compilation) {
    throw new Error(compError?.message || "Compilation not found");
  }

  if (!compilation.final_video_url) {
    throw new Error("Compilation has no stitched video yet");
  }

  await supabase
    .from("compilations")
    .update({ overlay_status: "composing" })
    .eq("id", compilationId);

  const template = await getTemplate(supabase, compilation.video_templates, compilation.template_id);

  const { data: clipEntries } = await supabase
    .from("compilation_clips")
    .select("sequence, clips(topic, speech_script, duration_seconds)")
    .eq("compilation_id", compilationId)
    .order("sequence");

  const clips = (clipEntries || []).map((e: Record<string, unknown>) => ({
    topic: (e.clips as Record<string, unknown>)?.topic as string || "",
    speech_script: (e.clips as Record<string, unknown>)?.speech_script as string | null,
    duration_seconds: (e.clips as Record<string, unknown>)?.duration_seconds as number || 0,
    sequence: e.sequence as number,
  }));

  const overlays = buildCompilationOverlayEntries(template, {
    name: compilation.name,
    total_duration_seconds: compilation.total_duration_seconds,
  }, clips);

  const { serviceUrl, serviceKey } = getServiceConfig();

  if (!serviceUrl) {
    await supabase
      .from("compilations")
      .update({
        overlay_status: "done",
        composed_video_url: compilation.final_video_url,
      })
      .eq("id", compilationId);

    return {
      success: true,
      composed_video_url: compilation.final_video_url,
      note: "No FFmpeg service configured, using raw video",
    };
  }

  const composedUrl = await composeWithFFmpegService(
    compilation.final_video_url,
    overlays,
    serviceUrl,
    serviceKey
  );

  if (composedUrl) {
    const finalUrl = await uploadComposedVideo(supabase, composedUrl, compilationId, "episode-videos");

    await supabase
      .from("compilations")
      .update({
        overlay_status: "done",
        composed_video_url: finalUrl,
      })
      .eq("id", compilationId);

    return { success: true, composed_video_url: finalUrl };
  }

  await supabase
    .from("compilations")
    .update({
      overlay_status: "done",
      composed_video_url: compilation.final_video_url,
    })
    .eq("id", compilationId);

  return {
    success: true,
    composed_video_url: compilation.final_video_url,
    note: "Compose failed, using raw video as fallback",
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header is required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: ComposeRequest = await req.json();

    if (!body.episode_id && !body.clip_id && !body.compilation_id) {
      return new Response(
        JSON.stringify({ error: "episode_id, clip_id, or compilation_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let result;

    if (body.episode_id) {
      result = await handleEpisodeCompose(supabase, body.episode_id);
    } else if (body.compilation_id) {
      result = await handleCompilationCompose(supabase, body.compilation_id);
    } else {
      result = await handleClipCompose(supabase, body.clip_id!);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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
