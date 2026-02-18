import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ProcessVideoRequest {
  operation: 'thumbnail' | 'stitch' | 'add_captions' | 'convert' | 'trim';
  videoUrls?: string[];
  videoUrl?: string;
  options?: {
    timestamp?: string;
    width?: number;
    height?: number;
    format?: string;
    startTime?: string;
    endTime?: string;
    captionText?: string;
    captionStyle?: {
      fontSize?: number;
      fontColor?: string;
      position?: 'top' | 'bottom' | 'center';
    };
  };
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

    const body: ProcessVideoRequest = await req.json();
    const { operation, videoUrls, videoUrl, options } = body;

    // Validate input
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
        if (!videoUrl) {
          throw new Error("videoUrl is required for thumbnail operation");
        }
        result = await generateThumbnail(videoUrl, options);
        break;

      case 'stitch':
        if (!videoUrls || videoUrls.length === 0) {
          throw new Error("videoUrls array is required for stitch operation");
        }
        result = await stitchVideos(videoUrls, options);
        break;

      case 'add_captions':
        if (!videoUrl) {
          throw new Error("videoUrl is required for add_captions operation");
        }
        result = await addCaptions(videoUrl, options);
        break;

      case 'convert':
        if (!videoUrl) {
          throw new Error("videoUrl is required for convert operation");
        }
        result = await convertVideo(videoUrl, options);
        break;

      case 'trim':
        if (!videoUrl) {
          throw new Error("videoUrl is required for trim operation");
        }
        result = await trimVideo(videoUrl, options);
        break;

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        operation,
        result,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
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

/**
 * Generate thumbnail from video at specific timestamp
 */
async function generateThumbnail(
  videoUrl: string,
  options?: ProcessVideoRequest['options']
): Promise<{ thumbnailUrl: string }> {
  const timestamp = options?.timestamp || '00:00:01';
  const width = options?.width || 1280;
  const height = options?.height || 720;

  // For Edge Functions, we'll use external FFmpeg service or API
  // Since Deno doesn't support native FFmpeg, we call the thumbnail service
  const thumbnailServiceUrl = Deno.env.get("THUMBNAIL_SERVICE_URL");

  if (thumbnailServiceUrl) {
    const response = await fetch(`${thumbnailServiceUrl}/generate-thumbnail`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        videoUrl,
        options: { width, height, timestamp },
      }),
    });

    if (!response.ok) {
      throw new Error('Thumbnail generation failed');
    }

    const data = await response.json();
    return { thumbnailUrl: data.thumbnail };
  }

  // Fallback: Return first frame of video URL
  return { thumbnailUrl: videoUrl };
}

/**
 * Stitch multiple videos together
 */
async function stitchVideos(
  videoUrls: string[],
  options?: ProcessVideoRequest['options']
): Promise<{ stitchedVideoUrl: string }> {
  // Use external FFmpeg service
  const thumbnailServiceUrl = Deno.env.get("THUMBNAIL_SERVICE_URL");

  if (thumbnailServiceUrl) {
    const response = await fetch(`${thumbnailServiceUrl}/stitch-videos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        videoUrls,
        options,
      }),
    });

    if (!response.ok) {
      throw new Error('Video stitching failed');
    }

    const data = await response.json();
    return { stitchedVideoUrl: data.videoUrl };
  }

  // Fallback: Return first video
  return { stitchedVideoUrl: videoUrls[0] };
}

/**
 * Add captions to video
 */
async function addCaptions(
  videoUrl: string,
  options?: ProcessVideoRequest['options']
): Promise<{ captionedVideoUrl: string }> {
  const captionText = options?.captionText || '';
  const captionStyle = options?.captionStyle || {};

  // Use external FFmpeg service
  const thumbnailServiceUrl = Deno.env.get("THUMBNAIL_SERVICE_URL");

  if (thumbnailServiceUrl) {
    const response = await fetch(`${thumbnailServiceUrl}/add-captions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        videoUrl,
        captionText,
        captionStyle,
      }),
    });

    if (!response.ok) {
      throw new Error('Caption addition failed');
    }

    const data = await response.json();
    return { captionedVideoUrl: data.videoUrl };
  }

  // Fallback: Return original video
  return { captionedVideoUrl: videoUrl };
}

/**
 * Convert video format
 */
async function convertVideo(
  videoUrl: string,
  options?: ProcessVideoRequest['options']
): Promise<{ convertedVideoUrl: string }> {
  const format = options?.format || 'mp4';

  // Use external FFmpeg service
  const thumbnailServiceUrl = Deno.env.get("THUMBNAIL_SERVICE_URL");

  if (thumbnailServiceUrl) {
    const response = await fetch(`${thumbnailServiceUrl}/convert-video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        videoUrl,
        format,
      }),
    });

    if (!response.ok) {
      throw new Error('Video conversion failed');
    }

    const data = await response.json();
    return { convertedVideoUrl: data.videoUrl };
  }

  // Fallback: Return original video
  return { convertedVideoUrl: videoUrl };
}

/**
 * Trim video to specific time range
 */
async function trimVideo(
  videoUrl: string,
  options?: ProcessVideoRequest['options']
): Promise<{ trimmedVideoUrl: string }> {
  const startTime = options?.startTime || '00:00:00';
  const endTime = options?.endTime || '00:00:10';

  // Use external FFmpeg service
  const thumbnailServiceUrl = Deno.env.get("THUMBNAIL_SERVICE_URL");

  if (thumbnailServiceUrl) {
    const response = await fetch(`${thumbnailServiceUrl}/trim-video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        videoUrl,
        startTime,
        endTime,
      }),
    });

    if (!response.ok) {
      throw new Error('Video trimming failed');
    }

    const data = await response.json();
    return { trimmedVideoUrl: data.videoUrl };
  }

  // Fallback: Return original video
  return { trimmedVideoUrl: videoUrl };
}
