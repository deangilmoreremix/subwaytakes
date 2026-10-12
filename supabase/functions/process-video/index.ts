import { type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { internalCall, requireUser, serviceClient } from "../_shared/auth.ts";
import { isSafeExternalHttpUrl } from "../_shared/muapi.ts";

interface ProcessVideoRequest {
  operation: 'thumbnail' | 'stitch' | 'add_captions' | 'convert' | 'trim' | 'get_info';
  videoUrls?: string[];
  videoUrl?: string;
  options?: {
    timestamp?: string;
    width?: number;
    height?: number;
    format?: string;
    startTime?: string;
    endTime?: string;
    quality?: 'low' | 'medium' | 'high';
    captionText?: string;
    captionStyle?: {
      fontSize?: number;
      fontColor?: string;
      position?: 'top' | 'bottom' | 'center';
    };
  };
}

function getServiceConfig(): { serviceUrl: string | undefined; serviceKey: string | undefined } {
  const serviceUrl = Deno.env.get("THUMBNAIL_SERVICE_URL") || Deno.env.get("FFMPEG_SERVICE_URL");
  const serviceKey = Deno.env.get("THUMBNAIL_SERVICE_KEY") || Deno.env.get("FFMPEG_SERVICE_KEY");
  return { serviceUrl, serviceKey };
}

function requireServiceConfig(): { serviceUrl: string; serviceKey: string | undefined } {
  const { serviceUrl, serviceKey } = getServiceConfig();
  if (!serviceUrl) {
    throw new Error(
      "FFmpeg service is not configured (set THUMBNAIL_SERVICE_URL or FFMPEG_SERVICE_URL)",
    );
  }
  return { serviceUrl, serviceKey };
}

function serviceHeaders(serviceKey: string | undefined): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (serviceKey) {
    headers["Authorization"] = `Bearer ${serviceKey}`;
  }
  return headers;
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

/**
 * SSRF guard for user-supplied media URLs: https only, and never localhost,
 * private ranges, or cloud metadata IPs.
 */
function isValidVideoUrl(url: string): boolean {
  return isSafeExternalHttpUrl(url);
}

async function uploadBase64ToStorage(
  supabase: SupabaseClient,
  base64DataUrl: string,
  fileName: string,
  bucket: string,
  contentType: string
): Promise<string> {
  const base64Data = base64DataUrl.split(",")[1];
  if (!base64Data) {
    throw new Error("FFmpeg service returned an empty data URL");
  }

  const binaryStr = atob(base64Data);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(`processed/${fileName}`, bytes, {
      contentType,
      upsert: true,
    });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  const { data: publicUrlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(data.path);

  if (!publicUrlData.publicUrl.startsWith("https://") && !publicUrlData.publicUrl.startsWith("http://")) {
    throw new Error("Storage did not return a public URL");
  }

  return publicUrlData.publicUrl;
}

/**
 * Normalize an FFmpeg service result into a usable media URL. Data URLs are
 * persisted to storage; http(s) URLs are passed through. Anything else is a
 * hard failure — we never substitute the input URL.
 */
async function resolveServiceMedia(
  data: Record<string, unknown>,
  media: 'thumbnail' | 'video',
  fileName: string,
  contentType: string,
  supabase: SupabaseClient,
): Promise<string> {
  const value = data[media];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`FFmpeg service returned no ${media === 'thumbnail' ? 'thumbnail' : 'video'}`);
  }

  if (value.startsWith("data:")) {
    return await uploadBase64ToStorage(supabase, value, fileName, "videos", contentType);
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  throw new Error(`FFmpeg service returned an unexpected ${media} value`);
}

Deno.serve(async (req: Request) => {
  const cors = buildCorsHeaders(req.headers.get("Origin"));

  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  try {
    if (!internalCall(req)) {
      await requireUser(req);
    }

    let body: ProcessVideoRequest;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400, cors);
    }
    const { operation, videoUrls, videoUrl, options } = body;

    if (!operation) {
      return jsonResponse({ error: "operation is required" }, 400, cors);
    }

    if (videoUrl && !isValidVideoUrl(videoUrl)) {
      return jsonResponse({ error: "Invalid video URL" }, 400, cors);
    }

    if (videoUrls) {
      for (const u of videoUrls) {
        if (!isValidVideoUrl(u)) {
          return jsonResponse({ error: "Invalid video URL in list" }, 400, cors);
        }
      }
    }

    const supabase = serviceClient();
    let result: Record<string, unknown>;

    switch (operation) {
      case 'thumbnail':
        if (!videoUrl) throw new Error("videoUrl is required for thumbnail operation");
        result = await generateThumbnail(supabase, videoUrl, options);
        break;
      case 'stitch':
        if (!videoUrls || videoUrls.length === 0) throw new Error("videoUrls array is required for stitch operation");
        result = await stitchVideos(supabase, videoUrls, options);
        break;
      case 'add_captions':
        if (!videoUrl) throw new Error("videoUrl is required for add_captions operation");
        result = await addCaptions(supabase, videoUrl, options);
        break;
      case 'convert':
        if (!videoUrl) throw new Error("videoUrl is required for convert operation");
        result = await convertVideo(supabase, videoUrl, options);
        break;
      case 'trim':
        if (!videoUrl) throw new Error("videoUrl is required for trim operation");
        result = await trimVideo(supabase, videoUrl, options);
        break;
      case 'get_info':
        if (!videoUrl) throw new Error("videoUrl is required for get_info operation");
        result = await getVideoInfo(videoUrl);
        break;
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return jsonResponse({ success: true, operation, result }, 200, cors);
  } catch (error) {
    console.error("Video processing error:", error);
    const message = error instanceof Error && error.message ? error.message : "Video processing failed";
    return jsonResponse({ error: message }, 500, cors);
  }
});

async function generateThumbnail(
  supabase: SupabaseClient,
  videoUrl: string,
  options?: ProcessVideoRequest['options']
): Promise<{ thumbnailUrl: string }> {
  const { serviceUrl, serviceKey } = requireServiceConfig();

  const response = await fetchWithTimeout(`${serviceUrl}/generate-thumbnail`, {
    method: 'POST',
    headers: serviceHeaders(serviceKey),
    body: JSON.stringify({
      videoUrl,
      options: {
        width: options?.width || 1280,
        height: options?.height || 720,
        timestamp: options?.timestamp || '00:00:01',
      },
    }),
  }, 60000);

  if (!response.ok) {
    throw new Error(`Thumbnail generation failed: ${response.status}`);
  }

  const data = await response.json() as Record<string, unknown>;
  const thumbnailUrl = await resolveServiceMedia(
    data,
    'thumbnail',
    `thumb_${Date.now()}.jpg`,
    'image/jpeg',
    supabase,
  );
  return { thumbnailUrl };
}

async function stitchVideos(
  supabase: SupabaseClient,
  videoUrls: string[],
  options?: ProcessVideoRequest['options']
): Promise<{ stitchedVideoUrl: string }> {
  const { serviceUrl, serviceKey } = requireServiceConfig();

  const response = await fetchWithTimeout(`${serviceUrl}/stitch-videos`, {
    method: 'POST',
    headers: serviceHeaders(serviceKey),
    body: JSON.stringify({ videoUrls, options }),
  }, 120000);

  if (!response.ok) {
    throw new Error(`Video stitching failed: ${response.status}`);
  }

  const data = await response.json() as Record<string, unknown>;
  const stitchedVideoUrl = await resolveServiceMedia(
    data,
    'video',
    `stitch_${Date.now()}.mp4`,
    'video/mp4',
    supabase,
  );
  return { stitchedVideoUrl };
}

async function addCaptions(
  supabase: SupabaseClient,
  videoUrl: string,
  options?: ProcessVideoRequest['options']
): Promise<{ captionedVideoUrl: string }> {
  if (!options?.captionText) {
    throw new Error("options.captionText is required for add_captions operation");
  }

  const { serviceUrl, serviceKey } = requireServiceConfig();

  const response = await fetchWithTimeout(`${serviceUrl}/add-captions`, {
    method: 'POST',
    headers: serviceHeaders(serviceKey),
    body: JSON.stringify({
      videoUrl,
      captionText: options.captionText,
      captionStyle: options.captionStyle,
    }),
  }, 90000);

  if (!response.ok) {
    throw new Error(`Caption addition failed: ${response.status}`);
  }

  const data = await response.json() as Record<string, unknown>;
  const captionedVideoUrl = await resolveServiceMedia(
    data,
    'video',
    `caption_${Date.now()}.mp4`,
    'video/mp4',
    supabase,
  );
  return { captionedVideoUrl };
}

async function convertVideo(
  supabase: SupabaseClient,
  videoUrl: string,
  options?: ProcessVideoRequest['options']
): Promise<{ convertedVideoUrl: string }> {
  const format = options?.format || 'mp4';
  const { serviceUrl, serviceKey } = requireServiceConfig();

  const response = await fetchWithTimeout(`${serviceUrl}/convert-video`, {
    method: 'POST',
    headers: serviceHeaders(serviceKey),
    body: JSON.stringify({
      videoUrl,
      format,
      quality: options?.quality,
    }),
  }, 90000);

  if (!response.ok) {
    throw new Error(`Video conversion failed: ${response.status}`);
  }

  const data = await response.json() as Record<string, unknown>;
  const convertedVideoUrl = await resolveServiceMedia(
    data,
    'video',
    `convert_${Date.now()}.${format}`,
    `video/${format}`,
    supabase,
  );
  return { convertedVideoUrl };
}

async function trimVideo(
  supabase: SupabaseClient,
  videoUrl: string,
  options?: ProcessVideoRequest['options']
): Promise<{ trimmedVideoUrl: string }> {
  if (!options?.startTime || !options?.endTime) {
    throw new Error("options.startTime and options.endTime are required for trim operation");
  }

  const { serviceUrl, serviceKey } = requireServiceConfig();

  const response = await fetchWithTimeout(`${serviceUrl}/trim-video`, {
    method: 'POST',
    headers: serviceHeaders(serviceKey),
    body: JSON.stringify({
      videoUrl,
      startTime: options.startTime,
      endTime: options.endTime,
    }),
  }, 90000);

  if (!response.ok) {
    throw new Error(`Video trimming failed: ${response.status}`);
  }

  const data = await response.json() as Record<string, unknown>;
  const trimmedVideoUrl = await resolveServiceMedia(
    data,
    'video',
    `trim_${Date.now()}.mp4`,
    'video/mp4',
    supabase,
  );
  return { trimmedVideoUrl };
}

async function getVideoInfo(
  videoUrl: string
): Promise<{ info: Record<string, unknown> }> {
  const { serviceUrl, serviceKey } = requireServiceConfig();

  const response = await fetchWithTimeout(`${serviceUrl}/get-video-info`, {
    method: 'POST',
    headers: serviceHeaders(serviceKey),
    body: JSON.stringify({ videoUrl }),
  }, 30000);

  if (!response.ok) {
    throw new Error(`Video info failed: ${response.status}`);
  }

  const data = await response.json() as Record<string, unknown>;
  if (!data.info || typeof data.info !== "object") {
    throw new Error("FFmpeg service returned no video info");
  }

  return { info: data.info as Record<string, unknown> };
}
