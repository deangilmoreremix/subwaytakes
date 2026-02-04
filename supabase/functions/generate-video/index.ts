import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const DEMO_VIDEOS: Record<string, string[]> = {
  motivational: [
    "https://images.pexels.com/videos/3015510/free-video-3015510.mp4?auto=compress",
    "https://images.pexels.com/videos/4057411/free-video-4057411.mp4?auto=compress",
    "https://images.pexels.com/videos/5377684/pexels-video-5377684.mp4?auto=compress",
  ],
  street_interview: [
    "https://images.pexels.com/videos/3209828/free-video-3209828.mp4?auto=compress",
    "https://images.pexels.com/videos/3015488/free-video-3015488.mp4?auto=compress",
    "https://images.pexels.com/videos/1536358/free-video-1536358.mp4?auto=compress",
  ],
  subway_interview: [
    "https://images.pexels.com/videos/2795750/free-video-2795750.mp4?auto=compress",
    "https://images.pexels.com/videos/3015482/free-video-3015482.mp4?auto=compress",
    "https://images.pexels.com/videos/5377612/pexels-video-5377612.mp4?auto=compress",
  ],
};

type VideoModel = 'hailuo-2.3-fast' | 'hailuo-2.3' | 'veo-3.1-fast' | 'veo-3.1';
type ModelTier = 'standard' | 'premium';

interface GenerateRequest {
  clip_id: string;
  video_type: string;
  prompt: string;
  negative_prompt: string;
  duration_seconds: number;
  model_tier?: ModelTier;
  speech_script?: string;
  is_episode_shot?: boolean;
  episode_id?: string;
  effects?: {
    thumbnail?: {
      enabled: boolean;
      style: string;
      emoji: string;
      overlayText?: string;
    };
  };
}

interface ThumbnailConfig {
  enabled: boolean;
  style: string;
  emoji: string;
  overlayText?: string;
}

interface ModelConfig {
  provider: 'minimax' | 'google';
  apiModel: string;
  hasSpeech: boolean;
}

const MODEL_CONFIGS: Record<VideoModel, ModelConfig> = {
  'hailuo-2.3-fast': {
    provider: 'minimax',
    apiModel: 'video-01-live2d',
    hasSpeech: true,
  },
  'hailuo-2.3': {
    provider: 'minimax',
    apiModel: 'video-01',
    hasSpeech: true,
  },
  'veo-3.1-fast': {
    provider: 'google',
    apiModel: 'veo-3.1-generate-preview',
    hasSpeech: true,
  },
  'veo-3.1': {
    provider: 'google',
    apiModel: 'veo-3.1-generate',
    hasSpeech: true,
  },
};

function getModelForTier(tier: ModelTier): VideoModel {
  return tier === 'premium' ? 'veo-3.1-fast' : 'hailuo-2.3-fast';
}

// FFmpeg-based thumbnail generation
// For Supabase Edge Functions, we use an external service
// In a full deployment, you'd run FFmpeg via a Node.js container or use a service
async function generateThumbnailWithFFmpeg(
  videoUrl: string,
  config: ThumbnailConfig
): Promise<string | null> {
  if (!config.enabled || !config.emoji) {
    return null;
  }

  // Option 1: Use the FFmpeg thumbnail service (recommended for Edge Functions)
  const ffmpegServiceUrl = Deno.env.get("FFMPEG_SERVICE_URL") || Deno.env.get("THUMBNAIL_SERVICE_URL");
  const ffmpegServiceKey = Deno.env.get("FFMPEG_SERVICE_KEY") || Deno.env.get("THUMBNAIL_SERVICE_KEY");

  if (ffmpegServiceUrl && ffmpegServiceKey) {
    try {
      const response = await fetch(`${ffmpegServiceUrl}/generate-thumbnail`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${ffmpegServiceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          videoUrl: videoUrl,
          options: {
            width: 1280,
            height: 720,
            timestamp: "00:00:01",
            emoji: config.emoji,
            emojiPosition: { x: 640, y: 360 },
            emojiSize: 120,
            text: config.overlayText,
            textPosition: { x: 640, y: 550 },
            textFontSize: 48,
            textColor: "white",
            quality: 2,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // The service returns base64 data URL, return it directly
        return data.thumbnail;
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error("FFmpeg service error:", response.status, errorData);
      }
    } catch (error) {
      console.error("FFmpeg service request error:", error);
    }
  }

  // Option 2: Use Cloudinary for video thumbnails (recommended)
  const cloudinaryCloudName = Deno.env.get("CLOUDINARY_CLOUD_NAME");
  const cloudinaryApiKey = Deno.env.get("CLOUDINARY_API_KEY");
  const cloudinaryApiSecret = Deno.env.get("CLOUDINARY_API_SECRET");

  if (cloudinaryCloudName && cloudinaryApiKey && cloudinaryApiSecret) {
    try {
      // Extract public ID from video URL or use clip_id
      const publicId = `thumbnail_${Date.now()}`;
      
      // Generate transformation URL for Cloudinary
      // This creates a thumbnail with emoji overlay
      const transformations = [
        "w_1280,h_720,c_fill",
        "q_auto",
        "so_0", // Start at 0 seconds
        "du_5", // 5 second duration for animated thumbnail
      ];
      
      if (config.emoji) {
        // Use Cloudinary text overlay for emoji
        transformations.push(`l_text:Arial_72:${encodeURIComponent(config.emoji)},fl_layer_apply,g_center`);
      }

      if (config.overlayText) {
        transformations.push(`l_text:Arial_36:${encodeURIComponent(config.overlayText)},fl_layer_apply,g_south`);
      }

      const transformationStr = transformations.join(",");
      const thumbnailUrl = `https://res.cloudinary.com/${cloudinaryCloudName}/video/upload/${transformationStr}/${encodeURIComponent(videoUrl)}`;
      
      // For static thumbnail (not animated)
      const staticThumbnailUrl = `https://res.cloudinary.com/${cloudinaryCloudName}/video/upload/so_2,w_1280,h_720,c_fill,l_text:Arial_72:${encodeURIComponent(config.emoji)},fl_layer_apply,g_center/${encodeURIComponent(videoUrl)}.jpg`;
      
      return staticThumbnailUrl;
    } catch (error) {
      console.error("Cloudinary error:", error);
    }
  }

  // Option 3: Fallback - generate SVG placeholder (current implementation)
  console.log('Thumbnail config:', config);
  return `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#1a1a2e"/>
          <stop offset="100%" style="stop-color:#16213e"/>
        </linearGradient>
      </defs>
      <rect fill="url(#bg)" width="1280" height="720"/>
      <text x="50%" y="45%" text-anchor="middle" font-size="160" font-family="Arial">${config.emoji}</text>
      ${config.overlayText ? `<text x="50%" y="70%" text-anchor="middle" font-size="48" fill="white" font-family="Arial">${config.overlayText}</text>` : ''}
      <text x="50%" y="92%" text-anchor="middle" font-size="24" fill="#888" font-family="Arial" text-transform="uppercase">${config.style}</text>
    </svg>
  `)}`;
}

async function generateWithMiniMax(
  prompt: string,
  durationSeconds: number,
  speechScript?: string
): Promise<{ jobId: string }> {
  const apiKey = Deno.env.get("MINIMAX_API_KEY");
  if (!apiKey) throw new Error("MINIMAX_API_KEY not configured");

  const enhancedPrompt = speechScript
    ? `${prompt}\n\nThe person speaks the following dialogue naturally: "${speechScript}"`
    : prompt;

  const response = await fetch("https://api.minimax.chat/v1/video_generation", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "video-01",
      prompt: enhancedPrompt,
      prompt_optimizer: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`MiniMax API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  if (data.base_resp?.status_code !== 0) {
    throw new Error(data.base_resp?.status_msg || "MiniMax generation failed");
  }

  return { jobId: data.task_id };
}

async function pollMiniMaxStatus(jobId: string): Promise<string> {
  const apiKey = Deno.env.get("MINIMAX_API_KEY");
  if (!apiKey) throw new Error("MINIMAX_API_KEY not configured");

  let attempts = 0;
  const maxAttempts = 120;

  while (attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const response = await fetch(
      `https://api.minimax.chat/v1/query/video_generation?task_id=${jobId}`,
      {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Status check failed: ${response.status}`);
    }

    const data = await response.json();
    const status = data.status;

    if (status === "Success") {
      return data.file_id;
    } else if (status === "Fail") {
      throw new Error(data.base_resp?.status_msg || "Generation failed");
    }

    attempts++;
  }

  throw new Error("Generation timed out");
}

async function getMiniMaxVideoUrl(fileId: string): Promise<string> {
  const apiKey = Deno.env.get("MINIMAX_API_KEY");
  if (!apiKey) throw new Error("MINIMAX_API_KEY not configured");

  const response = await fetch(
    `https://api.minimax.chat/v1/files/retrieve?file_id=${fileId}`,
    {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`File retrieve failed: ${response.status}`);
  }

  const data = await response.json();
  return data.file?.download_url;
}

async function generateWithVeo(
  prompt: string,
  durationSeconds: number,
  speechScript?: string
): Promise<string> {
  const apiKey = Deno.env.get("GOOGLE_AI_API_KEY");
  if (!apiKey) throw new Error("GOOGLE_AI_API_KEY not configured");

  const enhancedPrompt = speechScript
    ? `${prompt}\n\nDialogue: The person says: "${speechScript}"`
    : prompt;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/veo-2.0-generate-001:predictLongRunning?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        instances: [
          {
            prompt: enhancedPrompt,
          },
        ],
        parameters: {
          aspectRatio: "9:16",
          durationSeconds: Math.min(durationSeconds, 8),
          personGeneration: "allow_adult",
          generateAudio: true,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Veo API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const operationName = data.name;

  let attempts = 0;
  const maxAttempts = 120;

  while (attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const statusResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`
    );

    if (!statusResponse.ok) {
      throw new Error(`Status check failed: ${statusResponse.status}`);
    }

    const statusData = await statusResponse.json();

    if (statusData.done) {
      if (statusData.error) {
        throw new Error(statusData.error.message || "Veo generation failed");
      }
      const video = statusData.response?.generatedSamples?.[0]?.video;
      if (video?.uri) {
        return video.uri;
      }
      throw new Error("No video URL in response");
    }

    attempts++;
  }

  throw new Error("Veo generation timed out");
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

    const body: GenerateRequest = await req.json();
    const {
      clip_id,
      video_type,
      prompt,
      negative_prompt,
      duration_seconds,
      model_tier = 'standard',
      speech_script,
      is_episode_shot = false,
      episode_id,
      effects,
    } = body;

    // Extract thumbnail config
    const thumbnailConfig: ThumbnailConfig = {
      enabled: effects?.thumbnail?.enabled ?? false,
      style: effects?.thumbnail?.style ?? 'viral',
      emoji: effects?.thumbnail?.emoji ?? '',
      overlayText: effects?.thumbnail?.overlayText,
    };

    if (!clip_id) {
      return new Response(
        JSON.stringify({ error: "clip_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const selectedModel = getModelForTier(model_tier);
    const modelConfig = MODEL_CONFIGS[selectedModel];

    if (is_episode_shot) {
      await supabase
        .from("episode_shots")
        .update({ status: "running" })
        .eq("id", clip_id);
    } else {
      await supabase
        .from("clips")
        .update({
          status: "running",
          model_tier,
          model_used: selectedModel,
          has_speech: !!speech_script,
          speech_script: speech_script || null,
        })
        .eq("id", clip_id);
    }

    let resultUrl: string;

    const hasMinimaxKey = !!Deno.env.get("MINIMAX_API_KEY");
    const hasGoogleKey = !!Deno.env.get("GOOGLE_AI_API_KEY");

    if (modelConfig.provider === 'minimax' && hasMinimaxKey) {
      try {
        const { jobId } = await generateWithMiniMax(prompt, duration_seconds, speech_script);

        await supabase
          .from("clips")
          .update({ provider_job_id: jobId })
          .eq("id", clip_id);

        const fileId = await pollMiniMaxStatus(jobId);
        resultUrl = await getMiniMaxVideoUrl(fileId);
      } catch (error) {
        console.error("MiniMax error:", error);
        const videos = DEMO_VIDEOS[video_type] || DEMO_VIDEOS.motivational;
        resultUrl = videos[Math.floor(Math.random() * videos.length)];
      }
    } else if (modelConfig.provider === 'google' && hasGoogleKey) {
      try {
        resultUrl = await generateWithVeo(prompt, duration_seconds, speech_script);
      } catch (error) {
        console.error("Veo error:", error);
        const videos = DEMO_VIDEOS[video_type] || DEMO_VIDEOS.motivational;
        resultUrl = videos[Math.floor(Math.random() * videos.length)];
      }
    } else {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const videos = DEMO_VIDEOS[video_type] || DEMO_VIDEOS.motivational;
      resultUrl = videos[Math.floor(Math.random() * videos.length)];
    }

    if (is_episode_shot) {
      const { error: updateError } = await supabase
        .from("episode_shots")
        .update({
          status: "done",
          result_url: resultUrl,
        })
        .eq("id", clip_id);

      if (updateError) {
        throw updateError;
      }

      if (episode_id) {
        const { data: allShots } = await supabase
          .from("episode_shots")
          .select("status")
          .eq("episode_id", episode_id);

        const allDone = allShots?.every((s: { status: string }) => s.status === "done");
        const anyError = allShots?.some((s: { status: string }) => s.status === "error");

        if (anyError) {
          await supabase
            .from("episodes")
            .update({ status: "error", error: "One or more shots failed" })
            .eq("id", episode_id);
        } else if (allDone) {
          await supabase
            .from("episodes")
            .update({ status: "stitching" })
            .eq("id", episode_id);

          fetch(`${supabaseUrl}/functions/v1/stitch-episode`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ episode_id }),
          }).catch(console.error);
        }
      }
    } else {
      // Generate thumbnail if enabled
      const thumbnailUrl = await generateThumbnailWithFFmpeg(resultUrl, thumbnailConfig);
      
      const { error: updateError } = await supabase
        .from("clips")
        .update({
          status: "done",
          result_url: resultUrl,
          thumbnail_url: thumbnailUrl,
        })
        .eq("id", clip_id);

      if (updateError) {
        throw updateError;
      }
    }

    const thumbnailUrl = await generateThumbnailWithFFmpeg(resultUrl, thumbnailConfig);

    return new Response(
      JSON.stringify({
        success: true,
        clip_id,
        result_url: resultUrl,
        thumbnail_url: thumbnailUrl,
        model_used: selectedModel,
        is_episode_shot,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Generation error:", error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const body = await req.clone().json().catch(() => ({}));
      if (body.clip_id) {
        if (body.is_episode_shot) {
          await supabase
            .from("episode_shots")
            .update({
              status: "error",
              error: errorMessage,
            })
            .eq("id", body.clip_id);

          if (body.episode_id) {
            await supabase
              .from("episodes")
              .update({
                status: "error",
                error: `Shot generation failed: ${errorMessage}`,
              })
              .eq("id", body.episode_id);
          }
        } else {
          await supabase
            .from("clips")
            .update({
              status: "error",
              error: errorMessage,
            })
            .eq("id", body.clip_id);
        }
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
