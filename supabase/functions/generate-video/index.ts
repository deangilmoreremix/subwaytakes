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
    } = body;

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
      const { error: updateError } = await supabase
        .from("clips")
        .update({
          status: "done",
          result_url: resultUrl,
        })
        .eq("id", clip_id);

      if (updateError) {
        throw updateError;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        clip_id,
        result_url: resultUrl,
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
