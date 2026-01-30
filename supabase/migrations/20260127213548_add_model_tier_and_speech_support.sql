/*
  # Add Model Tier and Speech Support

  1. New Columns on `clips` table
    - `model_tier` (text, default 'standard') - Quality tier: 'standard' (Hailuo), 'premium' (Veo)
    - `model_used` (text, nullable) - Actual model name used for generation
    - `has_speech` (boolean, default false) - Whether the clip includes generated speech
    - `speech_script` (text, nullable) - The dialogue/speech script if provided

  2. Purpose
    - Track which AI model generates each video
    - Enable quality-based pricing tiers
    - Support speech-enabled video generation for interviews
    - Standard tier: MiniMax Hailuo 2.3 (affordable, good speech)
    - Premium tier: Google Veo 3.1 (best quality speech/dialogue)

  3. Notes
    - Interview clips (street_interview, subway_interview) require speech-capable models
    - Motivational clips can use any model (speech optional)
*/

-- Add model_tier column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'model_tier'
  ) THEN
    ALTER TABLE clips ADD COLUMN model_tier text DEFAULT 'standard';
  END IF;
END $$;

-- Add model_used column to track actual model
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'model_used'
  ) THEN
    ALTER TABLE clips ADD COLUMN model_used text;
  END IF;
END $$;

-- Add has_speech column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'has_speech'
  ) THEN
    ALTER TABLE clips ADD COLUMN has_speech boolean DEFAULT false;
  END IF;
END $$;

-- Add speech_script column for dialogue
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'speech_script'
  ) THEN
    ALTER TABLE clips ADD COLUMN speech_script text;
  END IF;
END $$;

-- Create index for model tier queries
CREATE INDEX IF NOT EXISTS idx_clips_model_tier ON clips(model_tier);

-- Update provider default to be more generic
COMMENT ON COLUMN clips.model_tier IS 'Quality tier: standard (Hailuo) or premium (Veo)';