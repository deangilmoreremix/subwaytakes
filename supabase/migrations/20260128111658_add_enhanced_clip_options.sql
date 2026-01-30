/*
  # Add Enhanced Clip Options

  This migration adds new columns to the clips table to support enhanced customization
  for all three video types: motivational, street interview, and subway interview.

  1. New Columns for Motivational Clips
    - `speaker_style` (text) - The style of motivational speaker (intense_coach, calm_mentor, etc.)
    - `motivational_setting` (text) - The visual setting (gym, stage, outdoor, etc.)
    - `camera_style` (text) - Camera movement type (dramatic_push, slow_orbit, etc.)
    - `lighting_mood` (text) - Lighting style (golden_hour, dramatic_shadows, etc.)

  2. New Columns for Street Interview Clips
    - `street_scene` (text) - The street location type (busy_sidewalk, coffee_shop_exterior, etc.)
    - `interview_style` (text) - Interview approach (quick_fire, deep_conversation, etc.)
    - `time_of_day` (text) - Time setting (morning, midday, golden_hour, etc.)

  3. Notes
    - All new columns are nullable to support existing clips
    - No data migration required as these are optional enhancement fields
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'speaker_style'
  ) THEN
    ALTER TABLE clips ADD COLUMN speaker_style text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'motivational_setting'
  ) THEN
    ALTER TABLE clips ADD COLUMN motivational_setting text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'camera_style'
  ) THEN
    ALTER TABLE clips ADD COLUMN camera_style text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'lighting_mood'
  ) THEN
    ALTER TABLE clips ADD COLUMN lighting_mood text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'street_scene'
  ) THEN
    ALTER TABLE clips ADD COLUMN street_scene text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'interview_style'
  ) THEN
    ALTER TABLE clips ADD COLUMN interview_style text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'time_of_day'
  ) THEN
    ALTER TABLE clips ADD COLUMN time_of_day text;
  END IF;
END $$;
