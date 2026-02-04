-- ============================================
-- Supabase Storage Setup for SubwayTakes
-- Run this SQL to enable storage functions
-- Then create buckets in Supabase Dashboard
-- ============================================

-- Enable Storage extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Storage buckets are managed via Supabase Storage API
-- Not via SQL. Use Supabase Dashboard to create buckets:
--
-- 1. Go to https://orcosohomdugkfcgydwj.supabase.co
-- 2. Click "Storage" in left sidebar
-- 3. Click "New Bucket" and create:
--
-- Bucket: videos
--   - Public bucket: No
--   - Allowed MIME types: video/*
--   - File size limit: 500 MB
--
-- Bucket: thumbnails  
--   - Public bucket: Yes
--   - Allowed MIME types: image/*
--   - File size limit: 10 MB
--
-- Bucket: avatars
--   - Public bucket: Yes
--   - Allowed MIME types: image/*
--   - File size limit: 5 MB
--
-- Bucket: subtitles
--   - Public bucket: No
--   - Allowed MIME types: .vtt, .srt
--   - File size limit: 2 MB
--
-- ============================================

-- Add storage columns to clips table if not exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clips' AND column_name = 'video_url') THEN
    ALTER TABLE clips ADD COLUMN video_url TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clips' AND column_name = 'thumbnail_url') THEN
    ALTER TABLE clips ADD COLUMN thumbnail_url TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clips' AND column_name = 'subtitle_url') THEN
    ALTER TABLE clips ADD COLUMN subtitle_url TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clips' AND column_name = 'storage_path') THEN
    ALTER TABLE clips ADD COLUMN storage_path TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clips' AND column_name = 'file_size') THEN
    ALTER TABLE clips ADD COLUMN file_size BIGINT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clips' AND column_name = 'duration_seconds') THEN
    ALTER TABLE clips ADD COLUMN duration_seconds INTEGER;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clips' AND column_name = 'processing_status') THEN
    ALTER TABLE clips ADD COLUMN processing_status TEXT DEFAULT 'complete' 
      CHECK (processing_status IN ('pending', 'processing', 'complete', 'failed'));
  END IF;
END $$;

-- Add indexes for storage queries
CREATE INDEX IF NOT EXISTS idx_clips_video_url ON clips(video_url);
CREATE INDEX IF NOT EXISTS idx_clips_processing_status ON clips(processing_status);

-- Update comments
COMMENT ON COLUMN clips.video_url IS 'Full URL to video file in Supabase Storage';
COMMENT ON COLUMN clips.thumbnail_url IS 'URL to thumbnail image';
COMMENT ON COLUMN clips.subtitle_url IS 'URL to subtitle file (.vtt or .srt)';
COMMENT ON COLUMN clips.storage_path IS 'Storage path: videos/{clip_id}/{filename}';
COMMENT ON COLUMN clips.file_size IS 'Video file size in bytes';
COMMENT ON COLUMN clips.duration_seconds IS 'Video duration in seconds';
COMMENT ON COLUMN clips.processing_status IS 'Video processing status: pending, processing, complete, failed';

-- ============================================
-- Storage Security Policies
-- These RLS policies allow authenticated users
-- to manage their own files
-- ============================================

-- Allow users to upload videos
-- (Buckets must be created in Dashboard first)

-- RLS for media_assets table
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own media assets" ON media_assets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can upload media" ON media_assets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own media" ON media_assets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own media" ON media_assets
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- Helper function to generate storage path
-- ============================================

CREATE OR REPLACE FUNCTION generate_storage_path(
  clip_id UUID,
  file_type TEXT
)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE file_type
    WHEN 'video' THEN 'videos/' || clip_id::TEXT || '/video.mp4'
    WHEN 'thumbnail' THEN 'thumbnails/' || clip_id::TEXT || '/thumbnail.jpg'
    WHEN 'subtitle' THEN 'subtitles/' || clip_id::TEXT || '/subtitles.vtt'
    ELSE 'other/' || clip_id::TEXT || '/file'
  END;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Storage bucket naming convention
-- ============================================

-- Videos bucket: Private, user-specific folders
-- Structure: videos/{user_id}/{clip_id}/{filename}

-- Thumbnails bucket: Public for sharing
-- Structure: thumbnails/{user_id}/{clip_id}/{filename}

-- Subtitles bucket: Private for video playback
-- Structure: subtitles/{user_id}/{clip_id}/{filename}
