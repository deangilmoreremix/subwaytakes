/*
  # Add effects column to clips table

  1. Modified Tables
    - `clips`
      - Added `effects` (jsonb, nullable) - Stores Remotion overlay effects configuration
        including captions, watermark, progress bar, color grading, and background settings

  2. Important Notes
    - This column was referenced in application code but missing from the database
    - Nullable so existing clips are unaffected
    - Stores a JSON object matching the RemotionEffectsConfig TypeScript interface
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'effects'
  ) THEN
    ALTER TABLE clips ADD COLUMN effects jsonb;
  END IF;
END $$;