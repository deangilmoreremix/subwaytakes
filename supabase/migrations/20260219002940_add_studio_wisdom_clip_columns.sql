/*
  # Add Studio and Wisdom Clip Columns

  1. New Columns on `clips`
    - `studio_setup` (text) - Studio environment type (podcast_desk, living_room, etc.)
    - `studio_lighting` (text) - Studio lighting style (three_point, dramatic_key, etc.)
    - `wisdom_tone` (text) - Wisdom interview tone (gentle, direct, funny, heartfelt)
    - `wisdom_format` (text) - Wisdom interview format (motivation, street_conversation, subway_take)
    - `wisdom_demographic` (text) - Wisdom speaker profile (retirees, grandparents, etc.)
    - `wisdom_setting` (text) - Wisdom interview setting (park_bench, coffee_shop, etc.)

  2. Notes
    - All columns are nullable to preserve compatibility with existing clips
    - No data migration needed as these are optional fields for new video types
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'studio_setup'
  ) THEN
    ALTER TABLE clips ADD COLUMN studio_setup text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'studio_lighting'
  ) THEN
    ALTER TABLE clips ADD COLUMN studio_lighting text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'wisdom_tone'
  ) THEN
    ALTER TABLE clips ADD COLUMN wisdom_tone text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'wisdom_format'
  ) THEN
    ALTER TABLE clips ADD COLUMN wisdom_format text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'wisdom_demographic'
  ) THEN
    ALTER TABLE clips ADD COLUMN wisdom_demographic text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'wisdom_setting'
  ) THEN
    ALTER TABLE clips ADD COLUMN wisdom_setting text;
  END IF;
END $$;