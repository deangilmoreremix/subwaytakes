/*
  # Add Scene Customization Columns

  1. Modified Tables
    - `clips`
      - `custom_location` (text, nullable) - Free-text custom location description when user selects 'custom' city style
      - `scenario_description` (text, nullable) - User-written scenario describing what happens in the scene
      - `social_dynamics` (jsonb, nullable) - Social interaction settings including crowd reaction, passerby interaction, and body language intensity

  2. Important Notes
    - All columns are nullable to maintain backward compatibility with existing clips
    - social_dynamics stores a JSON object with keys: crowdReaction, passerbyInteraction, bodyLanguage
    - No RLS changes needed as these columns inherit the existing clips table policies
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'custom_location'
  ) THEN
    ALTER TABLE clips ADD COLUMN custom_location text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'scenario_description'
  ) THEN
    ALTER TABLE clips ADD COLUMN scenario_description text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'social_dynamics'
  ) THEN
    ALTER TABLE clips ADD COLUMN social_dynamics jsonb;
  END IF;
END $$;
