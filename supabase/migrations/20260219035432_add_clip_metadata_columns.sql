/*
  # Add clip metadata columns for language, niche, format, and more

  1. Modified Tables
    - `clips`
      - `language` (text, nullable) - Selected language for the clip content
      - `niche` (text, nullable) - Niche category for targeting
      - `interview_format` (text, nullable) - Interview format style (solo, face_to_face, etc.)
      - `duration_preset` (text, nullable) - Duration preset selection
      - `caption_style` (text, nullable) - Caption style configuration
      - `export_platforms` (jsonb, nullable) - Selected export platforms
      - `product_placement` (jsonb, nullable) - Product placement configuration

  2. Notes
    - All columns are nullable to maintain backward compatibility
    - Existing clips will have NULL for these new fields
    - These columns store metadata collected from the Create page UI
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'language'
  ) THEN
    ALTER TABLE clips ADD COLUMN language text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'niche'
  ) THEN
    ALTER TABLE clips ADD COLUMN niche text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'interview_format'
  ) THEN
    ALTER TABLE clips ADD COLUMN interview_format text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'duration_preset'
  ) THEN
    ALTER TABLE clips ADD COLUMN duration_preset text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'caption_style'
  ) THEN
    ALTER TABLE clips ADD COLUMN caption_style text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'export_platforms'
  ) THEN
    ALTER TABLE clips ADD COLUMN export_platforms jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'product_placement'
  ) THEN
    ALTER TABLE clips ADD COLUMN product_placement jsonb;
  END IF;
END $$;
