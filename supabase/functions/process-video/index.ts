import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

function getServiceConfig() {
  const serviceUrl = Deno.env.get("THUMBNAIL_SERVICE_URL") || Deno.env.get("FFMPEG_SERVICE_URL");
  const serviceKey = Deno.env.get("THUMBNAIL_SERVICE_KEY") || Deno.env.get("FFMPEG_SERVICE_KEY");
  return { serviceUrl, serviceKey };
}

function serviceHeaders(serviceKey: string | undefined): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (serviceKey) {
    headers["Authorization"] = `Bearer ${serviceKey}`;
  }
  return headers;
}

async function uploadBase64ToStorage(
  base64DataUrl: string,
  fileName: string,
  bucket: string,
  contentType: string
): Promise<string | null> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const base64Data = base64DataUrl.split(",")[1];
    if (!base64Data) return null;

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
      console.error("Storage upload error:", error);
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return publicUrlData.publicUrl;
  } catch (err) {
    console.error("Upload error:", err);
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

  try {
    const body: ProcessVideoRequest = await req.json();
    const { operation, videoUrls, videoUrl, options } = body;

    if (!operation) {
      return new Response(
        JSON.stringify({ error: "operation is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let result: any;

    switch (operation) {
      case 'thumbnail':
        if (!videoUrl) throw new Error("videoUrl is required for thumbnail operation");
        result = await generateThumbnail(videoUrl, options);
        break;
      case 'stitch':
        if (!videoUrls || videoUrls.length === 0) throw new Error("videoUrls array is required for stitch operation");
        result = await stitchVideos(videoUrls, options);
        break;
      case 'add_captions':
        if (!videoUrl) throw new Error("videoUrl is required for add_captions operation");
        result = await addCaptions(videoUrl, options);
        break;
      case 'convert':
        if (!videoUrl) throw new Error("videoUrl is required for convert operation");
        result = await convertVideo(videoUrl, options);
        break;
      case 'trim':
        if (!videoUrl) throw new Error("videoUrl is required for trim operation");
        result = await trimVideo(videoUrl, options);
        break;
      case 'get_info':
        if (!videoUrl) throw new Error("videoUrl is required for get_info operation");
        result = await getVideoInfo(videoUrl);
        break;
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return new Response(
      JSON.stringify({ success: true, operation, result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Video processing error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function generateThumbnail(
  videoUrl: string,
  options?: ProcessVideoRequest['options']
): Promise<{ thumbnailUrl: string }> {
  const { serviceUrl, serviceKey } = getServiceConfig();

  if (serviceUrl) {
    const response = await fetch(`${serviceUrl}/generate-thumbnail`, {
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
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      throw new Error(`Thumbnail generation failed: ${response.status} ${errBody}`);
    }

    const data = await response.json();

    if (data.thumbnail && data.thumbnail.startsWith("data:")) {
      const storedUrl = await uploadBase64ToStorage(
        data.thumbnail,
        `thumb_${Date.now()}.jpg`,
        "videos",
        "image/jpeg"
      );
      if (storedUrl) return { thumbnailUrl: storedUrl };
    }

    return { thumbnailUrl: data.thumbnail };
  }

  return { thumbnailUrl: videoUrl };
}

async function stitchVideos(
  videoUrls: string[],
  options?: ProcessVideoRequest['options']
): Promise<{ stitchedVideoUrl: string }> {
  const { serviceUrl, serviceKey } = getServiceConfig();

  if (serviceUrl) {
    const response = await fetch(`${serviceUrl}/stitch-videos`, {
      method: 'POST',
      headers: serviceHeaders(serviceKey),
      body: JSON.stringify({ videoUrls, options }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      throw new Error(`Video stitching failed: ${response.status} ${errBody}`);
    }

    const data = await response.json();

    if (data.video && data.video.startsWith("data:")) {
      const storedUrl = await uploadBase64ToStorage(
        data.video,
        `stitch_${Date.now()}.mp4`,
        "videos",
        "video/mp4"
      );
      if (storedUrl) return { stitchedVideoUrl: storedUrl };
    }

    return { stitchedVideoUrl: data.videoUrl || videoUrls[0] };
  }

  return { stitchedVideoUrl: videoUrls[0] };
}

async function addCaptions(
  videoUrl: string,
  options?: ProcessVideoRequest['options']
): Promise<{ captionedVideoUrl: string }> {
  const { serviceUrl, serviceKey } = getServiceConfig();

  if (serviceUrl && options?.captionText) {
    const response = await fetch(`${serviceUrl}/add-captions`, {
      method: 'POST',
      headers: serviceHeaders(serviceKey),
      body: JSON.stringify({
        videoUrl,
        captionText: options.captionText,
        captionStyle: options.captionStyle,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      throw new Error(`Caption addition failed: ${response.status} ${errBody}`);
    }

    const data = await response.json();

    if (data.video && data.video.startsWith("data:")) {
      const storedUrl = await uploadBase64ToStorage(
        data.video,
        `caption_${Date.now()}.mp4`,
        "videos",
        "video/mp4"
      );
      if (storedUrl) return { captionedVideoUrl: storedUrl };
    }

    return { captionedVideoUrl: data.videoUrl || videoUrl };
  }

  return { captionedVideoUrl: videoUrl };
}

async function convertVideo(
  videoUrl: string,
  options?: ProcessVideoRequest['options']
): Promise<{ convertedVideoUrl: string }> {
  const format = options?.format || 'mp4';
  const { serviceUrl, serviceKey } = getServiceConfig();

  if (serviceUrl) {
    const response = await fetch(`${serviceUrl}/convert-video`, {
      method: 'POST',
      headers: serviceHeaders(serviceKey),
      body: JSON.stringify({
        videoUrl,
        format,
        quality: options?.quality,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      throw new Error(`Video conversion failed: ${response.status} ${errBody}`);
    }

    const data = await response.json();

    if (data.video && data.video.startsWith("data:")) {
      const storedUrl = await uploadBase64ToStorage(
        data.video,
        `convert_${Date.now()}.${format}`,
        "videos",
        `video/${format}`
      );
      if (storedUrl) return { convertedVideoUrl: storedUrl };
    }

    return { convertedVideoUrl: data.videoUrl || videoUrl };
  }

  return { convertedVideoUrl: videoUrl };
}

async function trimVideo(
  videoUrl: string,
  options?: ProcessVideoRequest['options']
): Promise<{ trimmedVideoUrl: string }> {
  const { serviceUrl, serviceKey } = getServiceConfig();

  if (serviceUrl && options?.startTime && options?.endTime) {
    const response = await fetch(`${serviceUrl}/trim-video`, {
      method: 'POST',
      headers: serviceHeaders(serviceKey),
      body: JSON.stringify({
        videoUrl,
        startTime: options.startTime,
        endTime: options.endTime,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      throw new Error(`Video trimming failed: ${response.status} ${errBody}`);
    }

    const data = await response.json();

    if (data.video && data.video.startsWith("data:")) {
      const storedUrl = await uploadBase64ToStorage(
        data.video,
        `trim_${Date.now()}.mp4`,
        "videos",
        "video/mp4"
      );
      if (storedUrl) return { trimmedVideoUrl: storedUrl };
    }

    return { trimmedVideoUrl: data.videoUrl || videoUrl };
  }

  return { trimmedVideoUrl: videoUrl };
}

async function getVideoInfo(
  videoUrl: string
): Promise<{ info: any }> {
  const { serviceUrl, serviceKey } = getServiceConfig();

  if (serviceUrl) {
    const response = await fetch(`${serviceUrl}/get-video-info`, {
      method: 'POST',
      headers: serviceHeaders(serviceKey),
      body: JSON.stringify({ videoUrl }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      throw new Error(`Video info failed: ${response.status} ${errBody}`);
    }

    const data = await response.json();
    return { info: data.info };
  }

  return {
    info: {
      duration: 0,
      size: 0,
      bitrate: 0,
      format: 'unknown',
      video: null,
      audio: null,
    }
  };
}
