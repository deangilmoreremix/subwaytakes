import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables not configured');
}

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder');

export interface UploadResult {
  success: boolean;
  url?: string;
  path?: string;
  error?: string;
}

export interface VideoUploadOptions {
  file: File;
  userId: string;
  clipId: string;
  onProgress?: (progress: number) => void;
}

/**
 * Upload a video to Supabase Storage
 * Bucket: videos (private)
 */
export async function uploadVideo({
  file,
  userId,
  clipId,
  onProgress
}: VideoUploadOptions): Promise<UploadResult> {
  const fileExt = file.name.split('.').pop() || 'mp4';
  const filePath = `${userId}/${clipId}/video.${fileExt}`;

  try {
    const { data, error } = await supabase.storage
      .from('videos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    // Report progress
    if (onProgress) {
      onProgress(100);
    }

    if (error) {
      return { success: false, error: error.message };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('videos')
      .getPublicUrl(filePath);

    return {
      success: true,
      path: data.path,
      url: urlData.publicUrl
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Upload failed'
    };
  }
}

/**
 * Upload a thumbnail image
 * Bucket: thumbnails (public)
 */
export async function uploadThumbnail(
  file: File,
  userId: string,
  clipId: string
): Promise<UploadResult> {
  const filePath = `${userId}/${clipId}/thumbnail.jpg`;

  try {
    const { data, error } = await supabase.storage
      .from('thumbnails')
      .upload(filePath, file, {
        cacheControl: '86400',
        upsert: true
      });

    if (error) {
      return { success: false, error: error.message };
    }

    const { data: urlData } = supabase.storage
      .from('thumbnails')
      .getPublicUrl(filePath);

    return {
      success: true,
      path: data.path,
      url: urlData.publicUrl
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Upload failed'
    };
  }
}

/**
 * Upload subtitle file (.vtt or .srt)
 * Bucket: subtitles (private)
 */
export async function uploadSubtitles(
  file: File,
  userId: string,
  clipId: string
): Promise<UploadResult> {
  const fileExt = file.name.split('.').pop() || 'vtt';
  const filePath = `${userId}/${clipId}/subtitles.${fileExt}`;

  try {
    const { data, error } = await supabase.storage
      .from('subtitles')
      .upload(filePath, file, {
        cacheControl: '86400',
        upsert: true
      });

    if (error) {
      return { success: false, error: error.message };
    }

    const { data: urlData } = supabase.storage
      .from('subtitles')
      .getPublicUrl(filePath);

    return {
      success: true,
      path: data.path,
      url: urlData.publicUrl
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Upload failed'
    };
  }
}

/**
 * Delete a video and associated files
 */
export async function deleteVideoFiles(
  userId: string,
  clipId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Delete from videos bucket
    const videoPrefix = `${userId}/${clipId}/`;
    const { data: videoFiles, error: videoListError } = await supabase.storage
      .from('videos')
      .list(userId, { search: clipId });
    
    if (videoListError) {
      return { success: false, error: videoListError.message };
    }
    
    if (videoFiles && videoFiles.length > 0) {
      const videoPaths = videoFiles.map(f => `${userId}/${f.name}`);
      const { error: videoDeleteError } = await supabase.storage
        .from('videos')
        .remove(videoPaths);
      
      if (videoDeleteError) {
        return { success: false, error: videoDeleteError.message };
      }
    }

    // Delete from thumbnails bucket
    const { data: thumbFiles, error: thumbListError } = await supabase.storage
      .from('thumbnails')
      .list(userId, { search: clipId });
    
    if (!thumbListError && thumbFiles && thumbFiles.length > 0) {
      const thumbPaths = thumbFiles.map(f => `${userId}/${f.name}`);
      await supabase.storage.from('thumbnails').remove(thumbPaths);
    }

    // Delete from subtitles bucket
    const { data: subFiles, error: subListError } = await supabase.storage
      .from('subtitles')
      .list(userId, { search: clipId });
    
    if (!subListError && subFiles && subFiles.length > 0) {
      const subPaths = subFiles.map(f => `${userId}/${f.name}`);
      await supabase.storage.from('subtitles').remove(subPaths);
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Delete failed'
    };
  }
}

/**
 * Get a signed URL for private video download
 */
export async function getSignedVideoUrl(
  path: string,
  expiresIn = 3600
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const { data, error } = await supabase.storage
      .from('videos')
      .createSignedUrl(path, expiresIn);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, url: data.signedUrl };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to get signed URL'
    };
  }
}

/**
 * List all videos for a user
 */
export async function listUserVideos(
  userId: string
): Promise<{ success: boolean; files?: any[]; error?: string }> {
  try {
    const { data, error } = await supabase.storage
      .from('videos')
      .list(userId, {
        limit: 100,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' }
      });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, files: data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'List failed'
    };
  }
}

/**
 * Upload avatar for a user
 */
export async function uploadAvatar(
  file: File,
  userId: string
): Promise<UploadResult> {
  const filePath = `${userId}/avatar.jpg`;

  try {
    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, {
        cacheControl: '86400',
        upsert: true
      });

    if (error) {
      return { success: false, error: error.message };
    }

    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    return {
      success: true,
      path: data.path,
      url: urlData.publicUrl
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Upload failed'
    };
  }
}
