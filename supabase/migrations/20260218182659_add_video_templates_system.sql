/*
  # Video Templates System

  1. New Tables
    - `video_templates`
      - `id` (uuid, primary key)
      - `user_id` (text) - Owner of the template
      - `name` (text) - Human-readable template name
      - `template_type` (text) - 'subway_takes' or 'custom'
      - `format` (text) - 'vertical', 'landscape', 'square'
      - `resolution_width` (int) - Video width in pixels
      - `resolution_height` (int) - Video height in pixels
      - `fps` (int) - Frames per second
      - `watermark_text` (text) - e.g., '@subwaytakes'
      - `watermark_position` (text) - Position on frame
      - `watermark_font_size` (int) - Font size in pixels
      - `watermark_color` (text) - Hex color code
      - `watermark_opacity` (numeric) - 0 to 1
      - `logo_enabled` (boolean) - Whether to show logo icon
      - `logo_position` (text) - Logo position
      - `episode_prefix_format` (text) - e.g., 'Episode {number}:'
      - `caption_font` (text) - Font family name
      - `caption_font_size` (int) - Font size for captions
      - `caption_color` (text) - Hex color
      - `caption_bg_opacity` (numeric) - Background opacity
      - `caption_position` (text) - top, center, bottom
      - `reaction_text_enabled` (boolean) - Show reaction overlays
      - `reaction_text_position` (text) - Position for reactions
      - `reaction_text_font_size` (int)
      - `color_temperature` (text) - warm, neutral, cool
      - `saturation_adjust` (numeric) - -1 to 1
      - `contrast_adjust` (numeric) - -1 to 1
      - `vignette_enabled` (boolean)
      - `progress_bar_enabled` (boolean)
      - `progress_bar_color` (text) - Hex color
      - `is_default` (boolean) - System default template
      - `is_system` (boolean) - Non-deletable system template
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Modified Tables
    - `episodes`
      - Add `template_id` (uuid FK) - Reference to video template
      - Add `episode_number` (int) - Auto-incrementing per user
      - Add `overlay_status` (text) - Post-processing status
      - Add `composed_video_url` (text) - Final branded video
      - Add `thumbnail_variants` (jsonb) - Multiple thumbnail sizes
    - `clips`
      - Add `template_id` (uuid FK) - Reference to video template

  3. Security
    - Enable RLS on `video_templates`
    - Policies for authenticated users to manage own templates
    - Policies for anyone to read system/default templates
    - Policy for reading own templates

  4. Seed Data
    - Insert "SubwayTakes Classic" as default system template
*/

-- Create video_templates table
CREATE TABLE IF NOT EXISTS video_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL DEFAULT 'system',
  name text NOT NULL,
  template_type text NOT NULL DEFAULT 'custom',
  format text NOT NULL DEFAULT 'vertical',
  resolution_width int NOT NULL DEFAULT 1080,
  resolution_height int NOT NULL DEFAULT 1920,
  fps int NOT NULL DEFAULT 30,
  watermark_text text DEFAULT '@subwaytakes',
  watermark_position text DEFAULT 'top-left',
  watermark_font_size int DEFAULT 18,
  watermark_color text DEFAULT '#FFFFFF',
  watermark_opacity numeric DEFAULT 0.85,
  logo_enabled boolean DEFAULT true,
  logo_position text DEFAULT 'top-left',
  episode_prefix_format text DEFAULT 'Episode {number}:',
  caption_font text DEFAULT 'Inter',
  caption_font_size int DEFAULT 40,
  caption_color text DEFAULT '#FFFFFF',
  caption_bg_opacity numeric DEFAULT 0.6,
  caption_position text DEFAULT 'bottom',
  reaction_text_enabled boolean DEFAULT true,
  reaction_text_position text DEFAULT 'bottom-right',
  reaction_text_font_size int DEFAULT 28,
  color_temperature text DEFAULT 'warm',
  saturation_adjust numeric DEFAULT 0,
  contrast_adjust numeric DEFAULT 0.05,
  vignette_enabled boolean DEFAULT false,
  progress_bar_enabled boolean DEFAULT true,
  progress_bar_color text DEFAULT '#F59E0B',
  is_default boolean DEFAULT false,
  is_system boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_template_type CHECK (template_type IN ('subway_takes', 'custom')),
  CONSTRAINT valid_format CHECK (format IN ('vertical', 'landscape', 'square')),
  CONSTRAINT valid_watermark_position CHECK (watermark_position IN ('top-left', 'top-right', 'bottom-left', 'bottom-right', 'top-center', 'bottom-center')),
  CONSTRAINT valid_caption_position CHECK (caption_position IN ('top', 'center', 'bottom')),
  CONSTRAINT valid_color_temperature CHECK (color_temperature IN ('warm', 'neutral', 'cool'))
);

ALTER TABLE video_templates ENABLE ROW LEVEL SECURITY;

-- Users can read system templates
CREATE POLICY "Anyone can read system templates"
  ON video_templates FOR SELECT
  TO authenticated
  USING (is_system = true);

-- Users can read their own templates
CREATE POLICY "Users can read own templates"
  ON video_templates FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::text);

-- Users can create their own templates
CREATE POLICY "Users can create own templates"
  ON video_templates FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid()::text AND is_system = false);

-- Users can update their own non-system templates
CREATE POLICY "Users can update own templates"
  ON video_templates FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid()::text AND is_system = false)
  WITH CHECK (user_id = auth.uid()::text AND is_system = false);

-- Users can delete their own non-system templates
CREATE POLICY "Users can delete own templates"
  ON video_templates FOR DELETE
  TO authenticated
  USING (user_id = auth.uid()::text AND is_system = false);

-- Add columns to episodes table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'episodes' AND column_name = 'template_id'
  ) THEN
    ALTER TABLE episodes ADD COLUMN template_id uuid REFERENCES video_templates(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'episodes' AND column_name = 'episode_number'
  ) THEN
    ALTER TABLE episodes ADD COLUMN episode_number int;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'episodes' AND column_name = 'overlay_status'
  ) THEN
    ALTER TABLE episodes ADD COLUMN overlay_status text DEFAULT 'pending';
    ALTER TABLE episodes ADD CONSTRAINT valid_overlay_status
      CHECK (overlay_status IN ('pending', 'composing', 'done', 'error', 'skipped'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'episodes' AND column_name = 'composed_video_url'
  ) THEN
    ALTER TABLE episodes ADD COLUMN composed_video_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'episodes' AND column_name = 'thumbnail_variants'
  ) THEN
    ALTER TABLE episodes ADD COLUMN thumbnail_variants jsonb DEFAULT '{}';
  END IF;
END $$;

-- Add template_id to clips table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'template_id'
  ) THEN
    ALTER TABLE clips ADD COLUMN template_id uuid REFERENCES video_templates(id);
  END IF;
END $$;

-- Create episode number sequence function
CREATE OR REPLACE FUNCTION assign_episode_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.episode_number IS NULL THEN
    SELECT COALESCE(MAX(episode_number), 0) + 1
    INTO NEW.episode_number
    FROM episodes
    WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto episode numbering
DROP TRIGGER IF EXISTS trg_assign_episode_number ON episodes;
CREATE TRIGGER trg_assign_episode_number
  BEFORE INSERT ON episodes
  FOR EACH ROW
  EXECUTE FUNCTION assign_episode_number();

-- Seed the default SubwayTakes Classic template
INSERT INTO video_templates (
  user_id, name, template_type, format,
  resolution_width, resolution_height, fps,
  watermark_text, watermark_position, watermark_font_size, watermark_color, watermark_opacity,
  logo_enabled, logo_position,
  episode_prefix_format,
  caption_font, caption_font_size, caption_color, caption_bg_opacity, caption_position,
  reaction_text_enabled, reaction_text_position, reaction_text_font_size,
  color_temperature, saturation_adjust, contrast_adjust, vignette_enabled,
  progress_bar_enabled, progress_bar_color,
  is_default, is_system
) VALUES (
  'system', 'SubwayTakes Classic', 'subway_takes', 'vertical',
  1080, 1920, 30,
  '@subwaytakes', 'top-left', 18, '#FFFFFF', 0.85,
  true, 'top-left',
  'Episode {number}:',
  'Inter', 40, '#FFFFFF', 0.6, 'bottom',
  true, 'bottom-right', 28,
  'warm', 0, 0.05, false,
  true, '#F59E0B',
  true, true
)
ON CONFLICT DO NOTHING;