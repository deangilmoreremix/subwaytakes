/*
  # Add Interviewer and Subject Character Options

  1. New Columns on `clips` table:
    - `interviewer_type` (text) - Style of interviewer: podcaster, documentary_journalist, casual_creator, news_reporter, hidden_voice_only
    - `interviewer_position` (text) - Camera position relative to interviewer: holding_mic, handheld_pov, two_shot_visible, over_shoulder
    - `subject_demographic` (text) - Broad category for interviewee: young_professional, college_student, middle_aged, senior, business_exec, creative_type, fitness_enthusiast, any
    - `subject_gender` (text) - Gender of subject: male, female, any
    - `subject_style` (text) - Clothing/appearance style: streetwear, business_casual, athletic, bohemian, corporate, casual

  2. Purpose:
    - Allows users to customize both the interviewer and interviewee characters in street and subway interview clips
    - Enables more specific video generation prompts for authentic interview scenarios
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'interviewer_type'
  ) THEN
    ALTER TABLE clips ADD COLUMN interviewer_type text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'interviewer_position'
  ) THEN
    ALTER TABLE clips ADD COLUMN interviewer_position text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'subject_demographic'
  ) THEN
    ALTER TABLE clips ADD COLUMN subject_demographic text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'subject_gender'
  ) THEN
    ALTER TABLE clips ADD COLUMN subject_gender text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'subject_style'
  ) THEN
    ALTER TABLE clips ADD COLUMN subject_style text;
  END IF;
END $$;