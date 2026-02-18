/*
  # Add Logo Upload Support to Video Templates

  1. Modified Tables
    - `video_templates`
      - Add `logo_url` (text) - URL to user-uploaded custom logo image in Supabase storage
      - Add `logo_width` (int) - Display width for the logo in pixels
      - Add `logo_height` (int) - Display height for the logo in pixels

  2. Notes
    - Existing `logo_enabled` boolean controls whether the logo shows at all
    - When `logo_url` is set, the uploaded image is used instead of the text emoji
    - Logo images are stored in the 'template-logos' storage bucket
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'video_templates' AND column_name = 'logo_url'
  ) THEN
    ALTER TABLE video_templates ADD COLUMN logo_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'video_templates' AND column_name = 'logo_width'
  ) THEN
    ALTER TABLE video_templates ADD COLUMN logo_width int DEFAULT 40;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'video_templates' AND column_name = 'logo_height'
  ) THEN
    ALTER TABLE video_templates ADD COLUMN logo_height int DEFAULT 40;
  END IF;
END $$;
