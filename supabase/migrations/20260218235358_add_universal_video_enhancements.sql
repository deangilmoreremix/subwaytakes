/*
  # Universal Video Enhancement System

  1. Schema Changes
    - Update `clips.video_type` check constraint to include `studio_interview` and `wisdom_interview`
    - Add overlay/compose columns to `clips` table:
      - `overlay_status` (text) - tracks overlay composition progress
      - `composed_video_url` (text) - URL of the composed/enhanced video
      - `caption_file_url` (text) - URL of the generated SRT caption file
      - `thumbnail_url` (text) - URL of the generated thumbnail

  2. New Tables
    - `music_tracks` - Royalty-free background music library
      - `id` (uuid, primary key)
      - `name` (text) - track display name
      - `url` (text) - audio file URL
      - `mood` (text) - emotional category
      - `duration_seconds` (integer)
      - `bpm` (integer, nullable)
      - `is_system` (boolean) - whether system-provided
    - `sound_effects` - Type-specific ambient sounds and stingers
      - `id` (uuid, primary key)
      - `name` (text) - effect display name
      - `url` (text) - audio file URL
      - `category` (text) - subway/street/studio/motivational/wisdom/transition
      - `duration_seconds` (integer)
      - `is_system` (boolean)
    - `video_exports` - Multi-platform export variants
      - `id` (uuid, primary key)
      - `user_id` (text) - owner
      - `parent_id` (uuid) - reference to clip or episode
      - `parent_type` (text) - 'clip' or 'episode'
      - `platform` (text) - tiktok/instagram_reel/youtube_shorts/etc
      - `url` (text, nullable) - exported file URL
      - `width` (integer)
      - `height` (integer)
      - `duration_seconds` (integer)
      - `status` (text) - queued/processing/done/error
      - `error` (text, nullable)

  3. Template Enhancement Columns
    - Add to `video_templates`:
      - `lower_third_style` (text) - none/classic/modern/minimal/vintage
      - `lower_third_enabled` (boolean)
      - `music_track_id` (uuid, nullable FK to music_tracks)
      - `music_volume` (numeric) - 0 to 1
      - `sfx_enabled` (boolean)
      - `color_grade_preset` (text) - none/warm/cool/cinematic/vintage/dramatic
      - `caption_animation_style` (text) - static/word_by_word/typewriter/karaoke/pop_up
      - `endcard_enabled` (boolean)
      - `endcard_style` (text) - minimal/branded/cta/subscribe

  4. Security
    - Enable RLS on all new tables
    - Restrictive policies for authenticated access
    - System-level read access for music and sfx libraries
*/

-- 1. Update clips.video_type check constraint to include all 5 types
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name LIKE '%video_type%'
    AND constraint_schema = 'public'
  ) THEN
    ALTER TABLE clips DROP CONSTRAINT IF EXISTS clips_video_type_check;
  END IF;
END $$;

ALTER TABLE clips ADD CONSTRAINT clips_video_type_check
  CHECK (video_type = ANY (ARRAY['motivational'::text, 'street_interview'::text, 'subway_interview'::text, 'studio_interview'::text, 'wisdom_interview'::text]));

-- 2. Add overlay/compose columns to clips table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'overlay_status'
  ) THEN
    ALTER TABLE clips ADD COLUMN overlay_status text DEFAULT 'pending'
      CHECK (overlay_status = ANY (ARRAY['pending'::text, 'composing'::text, 'done'::text, 'error'::text, 'skipped'::text]));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'composed_video_url'
  ) THEN
    ALTER TABLE clips ADD COLUMN composed_video_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'caption_file_url'
  ) THEN
    ALTER TABLE clips ADD COLUMN caption_file_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'thumbnail_url'
  ) THEN
    ALTER TABLE clips ADD COLUMN thumbnail_url text;
  END IF;
END $$;

-- 3. Create music_tracks table
CREATE TABLE IF NOT EXISTS music_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL,
  mood text NOT NULL DEFAULT 'neutral'
    CHECK (mood = ANY (ARRAY['neutral'::text, 'energetic'::text, 'calm'::text, 'dramatic'::text, 'inspiring'::text, 'tense'::text, 'playful'::text, 'cinematic'::text])),
  duration_seconds integer NOT NULL DEFAULT 30,
  bpm integer,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE music_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read system music tracks"
  ON music_tracks FOR SELECT
  TO authenticated
  USING (is_system = true);

-- 4. Create sound_effects table
CREATE TABLE IF NOT EXISTS sound_effects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL,
  category text NOT NULL DEFAULT 'transition'
    CHECK (category = ANY (ARRAY['subway'::text, 'street'::text, 'studio'::text, 'motivational'::text, 'wisdom'::text, 'transition'::text, 'stinger'::text])),
  duration_seconds integer NOT NULL DEFAULT 3,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sound_effects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read system sound effects"
  ON sound_effects FOR SELECT
  TO authenticated
  USING (is_system = true);

-- 5. Create video_exports table
CREATE TABLE IF NOT EXISTS video_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  parent_id uuid NOT NULL,
  parent_type text NOT NULL CHECK (parent_type = ANY (ARRAY['clip'::text, 'episode'::text])),
  platform text NOT NULL CHECK (platform = ANY (ARRAY['tiktok'::text, 'instagram_reel'::text, 'youtube_shorts'::text, 'instagram_post'::text, 'facebook'::text, 'youtube'::text, 'twitter'::text])),
  url text,
  width integer NOT NULL DEFAULT 1080,
  height integer NOT NULL DEFAULT 1920,
  duration_seconds integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'queued' CHECK (status = ANY (ARRAY['queued'::text, 'processing'::text, 'done'::text, 'error'::text])),
  error text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE video_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own exports"
  ON video_exports FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can create own exports"
  ON video_exports FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update own exports"
  ON video_exports FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can delete own exports"
  ON video_exports FOR DELETE
  TO authenticated
  USING (user_id = auth.uid()::text);

-- 6. Add enhancement config columns to video_templates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'video_templates' AND column_name = 'lower_third_style'
  ) THEN
    ALTER TABLE video_templates ADD COLUMN lower_third_style text DEFAULT 'modern'
      CHECK (lower_third_style = ANY (ARRAY['none'::text, 'classic'::text, 'modern'::text, 'minimal'::text, 'vintage'::text]));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'video_templates' AND column_name = 'lower_third_enabled'
  ) THEN
    ALTER TABLE video_templates ADD COLUMN lower_third_enabled boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'video_templates' AND column_name = 'music_track_id'
  ) THEN
    ALTER TABLE video_templates ADD COLUMN music_track_id uuid REFERENCES music_tracks(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'video_templates' AND column_name = 'music_volume'
  ) THEN
    ALTER TABLE video_templates ADD COLUMN music_volume numeric DEFAULT 0.3;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'video_templates' AND column_name = 'sfx_enabled'
  ) THEN
    ALTER TABLE video_templates ADD COLUMN sfx_enabled boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'video_templates' AND column_name = 'color_grade_preset'
  ) THEN
    ALTER TABLE video_templates ADD COLUMN color_grade_preset text DEFAULT 'none'
      CHECK (color_grade_preset = ANY (ARRAY['none'::text, 'warm'::text, 'cool'::text, 'cinematic'::text, 'vintage'::text, 'dramatic'::text]));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'video_templates' AND column_name = 'caption_animation_style'
  ) THEN
    ALTER TABLE video_templates ADD COLUMN caption_animation_style text DEFAULT 'static'
      CHECK (caption_animation_style = ANY (ARRAY['static'::text, 'word_by_word'::text, 'typewriter'::text, 'karaoke'::text, 'pop_up'::text]));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'video_templates' AND column_name = 'endcard_enabled'
  ) THEN
    ALTER TABLE video_templates ADD COLUMN endcard_enabled boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'video_templates' AND column_name = 'endcard_style'
  ) THEN
    ALTER TABLE video_templates ADD COLUMN endcard_style text DEFAULT 'minimal'
      CHECK (endcard_style = ANY (ARRAY['minimal'::text, 'branded'::text, 'cta'::text, 'subscribe'::text]));
  END IF;
END $$;

-- 7. Create index on video_exports for fast lookups
CREATE INDEX IF NOT EXISTS idx_video_exports_parent ON video_exports(parent_id, parent_type);
CREATE INDEX IF NOT EXISTS idx_video_exports_user ON video_exports(user_id);
CREATE INDEX IF NOT EXISTS idx_clips_overlay_status ON clips(overlay_status) WHERE overlay_status != 'pending';
