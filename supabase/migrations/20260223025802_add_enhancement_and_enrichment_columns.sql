/*
  # Add Enhancement and Enrichment Columns to Clips

  1. Modified Tables
    - `clips`
      - `subway_line` (text, nullable) - Selected subway line for subway interviews
      - `subway_enhancements` (jsonb, nullable) - Full subway enhancement config (journey, crowd, soundscape, plot twist, poll, train arrival, seasonal, transfer)
      - `neighborhood` (text, nullable) - NYC neighborhood for street interviews
      - `street_enhancements` (jsonb, nullable) - Full street enhancement config (journey, crowd, soundscape, plot twist, poll, dramatic moment, seasonal, pivot)
      - `motivational_enhancements` (jsonb, nullable) - Full motivational enhancement config (arc, audience, soundscape, breakthrough, energy, challenge, archetype, pause, achievement, CTA)
      - `speaker_archetype` (text, nullable) - Selected speaker archetype for motivational clips
      - `target_age_group` (text, nullable) - Target audience age group (kids, teens, adults, older_adults, all_ages)
      - `guest_count` (integer, nullable) - Number of guests for studio interviews
      - `interview_mode` (text, nullable) - Interview mode (hot_take_challenge, rapid_fire, etc.)
      - `reroll_count` (integer, default 0) - Number of times clip has been rerolled
      - `parent_clip_id` (uuid, nullable) - Reference to original clip if this is a reroll/variation
      - `token_cost` (integer, nullable) - Token cost for generating this clip
      - `viral_score` (jsonb, nullable) - Viral scoring analysis results

  2. Important Notes
    - All columns are nullable to maintain backward compatibility
    - JSONB columns store complex nested configs that vary by clip type
    - No RLS changes needed as these columns inherit existing clips table policies
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'subway_line'
  ) THEN
    ALTER TABLE clips ADD COLUMN subway_line text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'subway_enhancements'
  ) THEN
    ALTER TABLE clips ADD COLUMN subway_enhancements jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'neighborhood'
  ) THEN
    ALTER TABLE clips ADD COLUMN neighborhood text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'street_enhancements'
  ) THEN
    ALTER TABLE clips ADD COLUMN street_enhancements jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'motivational_enhancements'
  ) THEN
    ALTER TABLE clips ADD COLUMN motivational_enhancements jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'speaker_archetype'
  ) THEN
    ALTER TABLE clips ADD COLUMN speaker_archetype text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'target_age_group'
  ) THEN
    ALTER TABLE clips ADD COLUMN target_age_group text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'guest_count'
  ) THEN
    ALTER TABLE clips ADD COLUMN guest_count integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'interview_mode'
  ) THEN
    ALTER TABLE clips ADD COLUMN interview_mode text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'reroll_count'
  ) THEN
    ALTER TABLE clips ADD COLUMN reroll_count integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'parent_clip_id'
  ) THEN
    ALTER TABLE clips ADD COLUMN parent_clip_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'token_cost'
  ) THEN
    ALTER TABLE clips ADD COLUMN token_cost integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'viral_score'
  ) THEN
    ALTER TABLE clips ADD COLUMN viral_score jsonb;
  END IF;
END $$;