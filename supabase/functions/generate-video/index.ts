import { type SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  buildCorsHeaders,
  errorResponse,
  handleOptions,
  HttpError,
  jsonResponse,
} from "../_shared/cors.ts";
import { internalCall, requireUser, serviceClient } from "../_shared/auth.ts";
import {
  muapiPollResult,
  muapiSubmit,
  muapiVideoRequest,
  type MuapiVideoModel,
} from "../_shared/muapi.ts";

const VALID_VIDEO_TYPES = [
  "subway_interview",
  "street_interview",
  "motivational",
  "studio_interview",
  "wisdom_interview",
  "episode_shot",
] as const;

const PROVIDER_MAX_DURATION: Record<'minimax' | 'google', number> = {
  minimax: 160,
  google: 8,
};

const MUAPI_POLL_ATTEMPTS = 24;
const MUAPI_POLL_INTERVAL_MS = 5000;

interface OutputVerification {
  valid: boolean;
  issues: string[];
  warnings: string[];
  effectiveStatus: 'done' | 'error';
}

function verifyOutput(
  url: string | undefined,
  videoType: string,
  requestedDuration: number,
  provider: 'minimax' | 'google',
): OutputVerification {
  const issues: string[] = [];
  const warnings: string[] = [];

  if (!url || url.trim().length === 0) {
    issues.push('No result URL returned from provider');
  } else if (!url.startsWith('https://') && !url.startsWith('http://')) {
    issues.push('Result URL has unexpected format');
  }

  if (!VALID_VIDEO_TYPES.includes(videoType as typeof VALID_VIDEO_TYPES[number])) {
    issues.push(`Unknown video type: "${videoType}"`);
  }

  const maxDuration = PROVIDER_MAX_DURATION[provider];
  if (requestedDuration > maxDuration) {
    warnings.push(`Duration capped from ${requestedDuration}s to ${maxDuration}s (${provider} limit)`);
  }

  const effectiveStatus: OutputVerification['effectiveStatus'] =
    issues.length > 0 ? 'error' : 'done';

  return { valid: issues.length === 0, issues, warnings, effectiveStatus };
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
  /** When 'muapi', generate through the MuAPI video endpoints. */
  provider?: 'muapi';
  /** Which MuAPI video model to use (default veo3). */
  muapi_model?: MuapiVideoModel;
  /** Direct MuAPI endpoint override (e.g. "veo3-text-to-video"). */
  muapi_endpoint?: string;
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

function placeholderThumbnail(config: ThumbnailConfig): string {
  function escapeSvgText(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  const safeEmoji = escapeSvgText(config.emoji || '');
  const safeOverlay = config.overlayText ? escapeSvgText(config.overlayText) : '';
  const safeStyle = escapeSvgText(config.style || '');

  return `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#1a1a2e"/>
          <stop offset="100%" style="stop-color:#16213e"/>
        </linearGradient>
      </defs>
      <rect fill="url(#bg)" width="1280" height="720"/>
      <text x="50%" y="45%" text-anchor="middle" font-size="160" font-family="Arial">${safeEmoji}</text>
      ${safeOverlay ? `<text x="50%" y="70%" text-anchor="middle" font-size="48" fill="white" font-family="Arial">${safeOverlay}</text>` : ''}
      <text x="50%" y="92%" text-anchor="middle" font-size="24" fill="#888" font-family="Arial" text-transform="uppercase">${safeStyle}</text>
    </svg>
  `)}`;
}

/**
 * Thumbnail generation. The SVG data URL is only used when thumbnail
 * generation was NOT requested — it is a branded placeholder, never a stand-in
 * for a real frame. When generation was requested and every generator fails,
 * the url is null and the caller records a note instead of storing a fake.
 */
async function generateThumbnailWithFFmpeg(
  videoUrl: string,
  config: ThumbnailConfig
): Promise<{ url: string | null; note?: string }> {
  if (!config.enabled) {
    return { url: placeholderThumbnail(config) };
  }

  const ffmpegServiceUrl = Deno.env.get("FFMPEG_SERVICE_URL") || Deno.env.get("THUMBNAIL_SERVICE_URL");
  const ffmpegServiceKey = Deno.env.get("FFMPEG_SERVICE_KEY") || Deno.env.get("THUMBNAIL_SERVICE_KEY");

  if (ffmpegServiceUrl && ffmpegServiceKey) {
    try {
      const response = await fetchWithTimeout(`${ffmpegServiceUrl}/generate-thumbnail`, {
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
      }, 60000);

      if (response.ok) {
        const data = await response.json();
        if (typeof data.thumbnail === "string" && data.thumbnail.length > 0) {
          return { url: data.thumbnail };
        }
      } else {
        console.error("FFmpeg service error:", response.status);
      }
    } catch (error) {
      console.error("FFmpeg service request error:", error);
    }
  }

  const cloudinaryCloudName = Deno.env.get("CLOUDINARY_CLOUD_NAME");
  const cloudinaryApiKey = Deno.env.get("CLOUDINARY_API_KEY");
  const cloudinaryApiSecret = Deno.env.get("CLOUDINARY_API_SECRET");

  if (cloudinaryCloudName && cloudinaryApiKey && cloudinaryApiSecret) {
    try {
      const staticThumbnailUrl = `https://res.cloudinary.com/${cloudinaryCloudName}/video/upload/so_2,w_1280,h_720,c_fill,l_text:Arial_72:${encodeURIComponent(config.emoji)},fl_layer_apply,g_center/${encodeURIComponent(videoUrl)}.jpg`;
      return { url: staticThumbnailUrl };
    } catch (error) {
      console.error("Cloudinary error:", error);
    }
  }

  return {
    url: null,
    note: "Thumbnail generation failed (FFmpeg service and Cloudinary unavailable)",
  };
}

async function generateWithMiniMax(
  prompt: string,
  _durationSeconds: number,
  modelConfig: ModelConfig,
  speechScript?: string
): Promise<{ jobId: string }> {
  const apiKey = Deno.env.get("MINIMAX_API_KEY");
  if (!apiKey) throw new Error("MINIMAX_API_KEY not configured");

  const enhancedPrompt = speechScript
    ? `${prompt}\n\nThe person speaks the following dialogue naturally: "${speechScript}"`
    : prompt;

  const response = await fetchWithTimeout("https://api.minimax.chat/v1/video_generation", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modelConfig.apiModel || "video-01",
      prompt: enhancedPrompt,
      prompt_optimizer: true,
    }),
  }, 30000);

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
  const maxAttempts = 25;

  while (attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const response = await fetchWithTimeout(
      `https://api.minimax.chat/v1/query/video_generation?task_id=${jobId}`,
      {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
        },
      },
      15000
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

  const response = await fetchWithTimeout(
    `https://api.minimax.chat/v1/files/retrieve?file_id=${fileId}`,
    {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
    },
    15000
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
  modelConfig: ModelConfig,
  speechScript?: string,
  negativePrompt?: string
): Promise<string> {
  const apiKey = Deno.env.get("GOOGLE_AI_API_KEY");
  if (!apiKey) throw new Error("GOOGLE_AI_API_KEY not configured");

  const enhancedPrompt = speechScript
    ? `${prompt}\n\nDialogue: The person says: "${speechScript}"`
    : prompt;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 150000);

  const parameters: Record<string, unknown> = {
    aspectRatio: "9:16",
    durationSeconds: Math.min(durationSeconds, 8),
    personGeneration: "allow_adult",
    generateAudio: true,
  };

  if (negativePrompt) {
    parameters.negativePrompt = negativePrompt;
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelConfig.apiModel}:predictLongRunning`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        instances: [
          {
            prompt: enhancedPrompt,
          },
        ],
        parameters,
      }),
      signal: controller.signal,
    }
  );

  clearTimeout(timeoutId);

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Veo API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const operationName = data.name;

  let attempts = 0;
  const maxAttempts = 25;

  while (attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const statusResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${operationName}`,
      { headers: { "x-goog-api-key": apiKey } }
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

interface MuapiGenerationResult {
  requestId: string;
  url: string;
}

async function generateWithMuapi(
  supabase: SupabaseClient,
  table: "clips" | "episode_shots",
  clipId: string,
  prompt: string,
  durationSeconds: number,
  model: MuapiVideoModel | undefined,
  endpointOverride: string | undefined,
): Promise<MuapiGenerationResult> {
  const muapiKey = Deno.env.get("MUAPI_API_KEY");
  if (!muapiKey) {
    throw new Error("provider 'muapi' requested but MUAPI_API_KEY is not configured");
  }

  const selectedModel: MuapiVideoModel = model ?? "veo3";
  const { endpoint, payload } = muapiVideoRequest(selectedModel, prompt, {
    aspectRatio: "9:16",
    durationSec: Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : 5,
  });
  const finalEndpoint = endpointOverride ?? endpoint;
  const finalPayload = endpointOverride ? { prompt, aspect_ratio: "9:16" } : payload;

  const requestId = await muapiSubmit(finalEndpoint, finalPayload);

  // The generated Database types don't cover these tables, so the union table
  // name is narrowed to a single literal for the typed builder.
  await supabase
    .from(table as "clips")
    .update({ provider_job_id: requestId })
    .eq("id", clipId);

  for (let attempt = 0; attempt < MUAPI_POLL_ATTEMPTS; attempt++) {
    await sleep(MUAPI_POLL_INTERVAL_MS);

    const result = await muapiPollResult(requestId);

    if (result.status === "completed") {
      const url = result.outputs[0];
      if (!url || (!url.startsWith("https://") && !url.startsWith("http://"))) {
        throw new Error("MuAPI generation completed without a valid video URL");
      }
      return { requestId, url };
    }

    if (result.status === "failed" || result.status === "cancelled") {
      throw new Error(result.error || `MuAPI generation ${result.status}`);
    }
  }

  throw new Error("MuAPI generation timed out");
}

Deno.serve(async (req: Request) => {
  const cors = buildCorsHeaders(req.headers.get("Origin"));
  const fail = (status: number, message: string) => jsonResponse({ error: message }, status, cors);

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

    let body: GenerateRequest;
    try {
      body = await req.json();
    } catch {
      return fail(400, "Invalid JSON body");
    }
    parsedBody = body as unknown as Record<string, unknown>;
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
      provider,
      muapi_model,
      muapi_endpoint,
      effects,
    } = body;

    const thumbnailConfig: ThumbnailConfig = {
      enabled: effects?.thumbnail?.enabled ?? false,
      style: effects?.thumbnail?.style ?? 'viral',
      emoji: effects?.thumbnail?.emoji ?? '',
      overlayText: effects?.thumbnail?.overlayText,
    };

    if (!clip_id) {
      return fail(400, "clip_id is required");
    }

    if (prompt && prompt.length > 10000) {
      return fail(400, "prompt exceeds maximum length of 10000 characters");
    }

    if (speech_script && speech_script.length > 5000) {
      return fail(400, "speech_script exceeds maximum length of 5000 characters");
    }

    if (video_type && !VALID_VIDEO_TYPES.includes(video_type as typeof VALID_VIDEO_TYPES[number])) {
      return fail(400, `Invalid video_type. Must be one of: ${VALID_VIDEO_TYPES.join(", ")}`);
    }

    if (provider !== undefined && provider !== 'muapi') {
      return fail(400, `Invalid provider. Must be one of: muapi`);
    }

    if (muapi_model !== undefined && !['veo3', 'seedance', 'kling'].includes(muapi_model)) {
      return fail(400, `Invalid muapi_model. Must be one of: veo3, seedance, kling`);
    }

    if (muapi_endpoint !== undefined && (typeof muapi_endpoint !== 'string' || !/^[a-z0-9-]+$/i.test(muapi_endpoint))) {
      return fail(400, "Invalid muapi_endpoint");
    }

    const table = is_episode_shot ? "episode_shots" : "clips";

    if (authenticatedUserId) {
      if (is_episode_shot && episode_id) {
        const { data: epCheck, error: epCheckError } = await supabase
          .from("episodes")
          .select("user_id")
          .eq("id", episode_id)
          .maybeSingle();
        if (epCheckError || !epCheck) {
          return fail(404, "Not found");
        }
        if (epCheck.user_id !== authenticatedUserId) {
          return fail(404, "Not found");
        }
      } else {
        const { data: clipCheck, error: clipCheckError } = await supabase
          .from("clips")
          .select("user_id")
          .eq("id", clip_id)
          .maybeSingle();
        if (clipCheckError || !clipCheck) {
          return fail(404, "Not found");
        }
        if (clipCheck.user_id !== authenticatedUserId) {
          return fail(404, "Not found");
        }
      }
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

    const failGeneration = async (message: string) => {
      await supabase.from(table).update({ status: "error", error: message }).eq("id", clip_id);
      if (is_episode_shot && episode_id) {
        await supabase
          .from("episodes")
          .update({ status: "error", error: "One or more shots failed" })
          .eq("id", episode_id);
      }
      return fail(500, message);
    };

    let resultUrl: string;
    let muapiRequestId: string | null = null;
    let durationWarning: string | null = null;
    let usedProvider: 'muapi' | 'minimax' | 'google' = modelConfig.provider;

    try {
      if (provider === 'muapi') {
        const { requestId, url } = await generateWithMuapi(
          supabase,
          table,
          clip_id,
          prompt,
          duration_seconds,
          muapi_model,
          muapi_endpoint,
        );
        muapiRequestId = requestId;
        resultUrl = url;
        usedProvider = 'muapi';
      } else if (modelConfig.provider === 'minimax') {
        const hasMinimaxKey = !!Deno.env.get("MINIMAX_API_KEY");
        if (!hasMinimaxKey) {
          throw new Error("MINIMAX_API_KEY not configured");
        }
        const { jobId } = await generateWithMiniMax(prompt, duration_seconds, modelConfig, speech_script);

        await supabase
          .from(table)
          .update({ provider_job_id: jobId })
          .eq("id", clip_id);

        const fileId = await pollMiniMaxStatus(jobId);
        resultUrl = await getMiniMaxVideoUrl(fileId);
      } else {
        const hasGoogleKey = !!Deno.env.get("GOOGLE_AI_API_KEY");
        if (!hasGoogleKey) {
          throw new Error("GOOGLE_AI_API_KEY not configured");
        }
        if (duration_seconds > 8) {
          durationWarning = `Duration was capped from ${duration_seconds}s to 8s (Veo maximum)`;
          console.warn(`Veo duration capped: requested ${duration_seconds}s, using 8s max`);
          await supabase
            .from(table)
            .update({ error: durationWarning })
            .eq("id", clip_id);
        }
        resultUrl = await generateWithVeo(prompt, duration_seconds, modelConfig, speech_script, negative_prompt);
      }
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : "Video generation failed";
      console.error("Generation provider error:", error);
      return await failGeneration(message);
    }

    const outputVerification = verifyOutput(resultUrl, video_type, duration_seconds, modelConfig.provider);

    if (!outputVerification.valid) {
      console.error("Output verification failed:", outputVerification.issues);
      return await failGeneration(outputVerification.issues.join("; "));
    }

    if (outputVerification.warnings.length > 0) {
      console.warn("Output verification warnings:", outputVerification.warnings);
    }

    const providerLabel = usedProvider === 'muapi'
      ? 'muapi'
      : usedProvider === 'minimax'
        ? 'minimax'
        : 'google';

    if (is_episode_shot) {
      const { error: updateError } = await supabase
        .from("episode_shots")
        .update({
          status: outputVerification.effectiveStatus,
          result_url: resultUrl,
          ...(muapiRequestId ? { provider_job_id: muapiRequestId } : {}),
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

          try {
            const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
            const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
            const stitchResp = await fetch(`${supabaseUrl}/functions/v1/stitch-episode`, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${serviceRoleKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ episode_id }),
            });
            if (!stitchResp.ok) {
              await supabase.from("episodes").update({ status: "error", error: "Stitch trigger failed" }).eq("id", episode_id);
            }
          } catch {
            await supabase.from("episodes").update({ status: "error", error: "Stitch trigger failed" }).eq("id", episode_id);
          }
        }
      }
    } else {
      const { url: thumbnailUrl, note: thumbnailNote } = await generateThumbnailWithFFmpeg(
        resultUrl,
        thumbnailConfig,
      );

      const { error: updateError } = await supabase
        .from("clips")
        .update({
          status: outputVerification.effectiveStatus,
          result_url: resultUrl,
          thumbnail_url: thumbnailUrl,
          ...(muapiRequestId ? { provider_job_id: muapiRequestId } : {}),
          ...(durationWarning ? { error: durationWarning } : {}),
        })
        .eq("id", clip_id);

      if (updateError) {
        throw updateError;
      }

      return jsonResponse(
        {
          success: true,
          clip_id,
          result_url: resultUrl,
          thumbnail_url: thumbnailUrl,
          model_used: selectedModel,
          provider: providerLabel,
          is_episode_shot: false,
          ...(muapiRequestId ? { muapi_request_id: muapiRequestId } : {}),
          ...(durationWarning ? { duration_warning: durationWarning } : {}),
          ...(thumbnailNote ? { thumbnail_note: thumbnailNote } : {}),
        },
        200,
        cors,
      );
    }

    return jsonResponse(
      {
        success: true,
        clip_id,
        result_url: resultUrl,
        thumbnail_url: null,
        model_used: selectedModel,
        provider: providerLabel,
        is_episode_shot,
        ...(muapiRequestId ? { muapi_request_id: muapiRequestId } : {}),
        ...(durationWarning ? { duration_warning: durationWarning } : {}),
      },
      200,
      cors,
    );
  } catch (error) {
    console.error("Generation error:", error);

    try {
      const supabase = serviceClient();
      const body = parsedBody || {};
      if (body.clip_id) {
        if (body.is_episode_shot) {
          await supabase
            .from("episode_shots")
            .update({ status: "error", error: "Generation failed" })
            .eq("id", body.clip_id as string);

          if (body.episode_id) {
            await supabase
              .from("episodes")
              .update({ status: "error", error: "Shot generation failed" })
              .eq("id", body.episode_id as string);
          }
        } else {
          await supabase
            .from("clips")
            .update({ status: "error", error: "Generation failed" })
            .eq("id", body.clip_id as string);
        }
      }
    } catch { /* best effort cleanup */ }

    if (error instanceof HttpError) {
      return jsonResponse({ error: error.message }, error.status, cors);
    }
    return errorResponse(error, cors);
  }
});
