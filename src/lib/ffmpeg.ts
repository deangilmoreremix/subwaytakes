import { supabase } from './supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export interface ThumbnailOptions {
  width?: number;
  height?: number;
  timestamp?: string;
  emoji?: string;
  text?: string;
  quality?: number;
}

export interface CaptionStyle {
  fontSize?: number;
  fontColor?: string;
  position?: 'top' | 'bottom' | 'center';
  backgroundColor?: string;
}

export interface VideoInfo {
  duration: number;
  size: number;
  bitrate: number;
  format: string;
  video: {
    codec: string;
    width: number;
    height: number;
    fps: number;
    aspectRatio: string;
  } | null;
  audio: {
    codec: string;
    sampleRate: number;
    channels: number;
  } | null;
}

/**
 * Generate thumbnail from video URL
 */
export async function generateThumbnail(
  videoUrl: string,
  options?: ThumbnailOptions
): Promise<string> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/process-video`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        operation: 'thumbnail',
        videoUrl,
        options,
      }),
    });

    if (!response.ok) {
      throw new Error('Thumbnail generation failed');
    }

    const data = await response.json();
    return data.result.thumbnailUrl;
  } catch (error) {
    console.error('Error generating thumbnail:', error);
    throw error;
  }
}

/**
 * Stitch multiple videos together
 */
export async function stitchVideos(
  videoUrls: string[],
  options?: { transitionType?: 'fade' | 'crossfade' | 'none' }
): Promise<string> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/process-video`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        operation: 'stitch',
        videoUrls,
        options,
      }),
    });

    if (!response.ok) {
      throw new Error('Video stitching failed');
    }

    const data = await response.json();
    return data.result.stitchedVideoUrl;
  } catch (error) {
    console.error('Error stitching videos:', error);
    throw error;
  }
}

/**
 * Add captions to video
 */
export async function addCaptions(
  videoUrl: string,
  captionText: string,
  captionStyle?: CaptionStyle
): Promise<string> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/process-video`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        operation: 'add_captions',
        videoUrl,
        options: {
          captionText,
          captionStyle,
        },
      }),
    });

    if (!response.ok) {
      throw new Error('Caption addition failed');
    }

    const data = await response.json();
    return data.result.captionedVideoUrl;
  } catch (error) {
    console.error('Error adding captions:', error);
    throw error;
  }
}

/**
 * Convert video format
 */
export async function convertVideo(
  videoUrl: string,
  format: 'mp4' | 'webm' | 'mov',
  quality?: 'low' | 'medium' | 'high'
): Promise<string> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/process-video`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        operation: 'convert',
        videoUrl,
        options: { format, quality },
      }),
    });

    if (!response.ok) {
      throw new Error('Video conversion failed');
    }

    const data = await response.json();
    return data.result.convertedVideoUrl;
  } catch (error) {
    console.error('Error converting video:', error);
    throw error;
  }
}

/**
 * Trim video to specific time range
 */
export async function trimVideo(
  videoUrl: string,
  startTime: string,
  endTime: string
): Promise<string> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/process-video`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        operation: 'trim',
        videoUrl,
        options: { startTime, endTime },
      }),
    });

    if (!response.ok) {
      throw new Error('Video trimming failed');
    }

    const data = await response.json();
    return data.result.trimmedVideoUrl;
  } catch (error) {
    console.error('Error trimming video:', error);
    throw error;
  }
}

export async function getVideoInfo(videoUrl: string): Promise<VideoInfo> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/process-video`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        operation: 'get_info',
        videoUrl,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to get video info');
    }

    const data = await response.json();
    return data.result.info;
  } catch (error) {
    console.error('Error getting video info:', error);
    return {
      duration: 0,
      size: 0,
      bitrate: 0,
      format: 'unknown',
      video: null,
      audio: null,
    };
  }
}

/**
 * Upload video to Supabase Storage and get public URL
 */
export async function uploadVideoToStorage(
  videoBlob: Blob,
  fileName: string
): Promise<string> {
  try {
    const { data, error } = await supabase.storage
      .from('videos')
      .upload(`processed/${fileName}`, videoBlob, {
        contentType: 'video/mp4',
        upsert: true,
      });

    if (error) throw error;

    const { data: publicUrlData } = supabase.storage
      .from('videos')
      .getPublicUrl(data.path);

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error('Error uploading video:', error);
    throw error;
  }
}

/**
 * Download video from URL as Blob
 */
export async function downloadVideoAsBlob(videoUrl: string): Promise<Blob> {
  const response = await fetch(videoUrl);
  if (!response.ok) {
    throw new Error('Failed to download video');
  }
  return await response.blob();
}

/**
 * Convert base64 to Blob
 */
export function base64ToBlob(base64: string, contentType: string = 'video/mp4'): Blob {
  const parts = base64.split(',');
  const b64 = parts.length > 1 ? parts[1] : parts[0];
  const byteCharacters = atob(b64);
  const byteNumbers = new Array(byteCharacters.length);

  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: contentType });
}

/**
 * Helper: Process video and upload to storage
 */
export async function processAndUploadVideo(
  videoUrl: string,
  operation: 'thumbnail' | 'stitch' | 'add_captions' | 'convert' | 'trim',
  options?: Record<string, unknown>
): Promise<string> {
  let processedVideoUrl: string;

  const opts = (options ?? {}) as Record<string, unknown>;

  switch (operation) {
    case 'thumbnail':
      processedVideoUrl = await generateThumbnail(videoUrl, opts);
      break;
    case 'stitch':
      processedVideoUrl = await stitchVideos(opts.videoUrls as string[], opts);
      break;
    case 'add_captions':
      processedVideoUrl = await addCaptions(videoUrl, opts.captionText as string, opts.captionStyle as CaptionStyle);
      break;
    case 'convert':
      processedVideoUrl = await convertVideo(videoUrl, opts.format as 'mp4' | 'webm' | 'mov', opts.quality as 'low' | 'medium' | 'high' | undefined);
      break;
    case 'trim':
      processedVideoUrl = await trimVideo(videoUrl, opts.startTime as string, opts.endTime as string);
      break;
    default:
      throw new Error(`Unknown operation: ${operation}`);
  }

  // If result is base64, convert and upload
  if (processedVideoUrl.startsWith('data:')) {
    const blob = base64ToBlob(processedVideoUrl);
    const fileName = `${operation}-${Date.now()}.mp4`;
    return await uploadVideoToStorage(blob, fileName);
  }

  return processedVideoUrl;
}
