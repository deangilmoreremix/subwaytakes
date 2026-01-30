/*
  # Add Subway Interview Enhancements

  1. New Columns on `clips` table
    - `interview_question` (text, nullable) - The specific question being asked in subway interviews
    - `scene_type` (text, nullable) - Platform waiting, inside train, train arriving, etc.
    - `city_style` (text, nullable) - NYC, London, Tokyo visual style
    - `energy_level` (text, nullable) - Calm, conversational, high-energy
    - `batch_id` (uuid, nullable) - Links clips in the same series together
    - `batch_sequence` (integer, nullable) - Order within a batch/series

  2. New Table `question_bank`
    - `id` (uuid, primary key)
    - `category` (text) - Money, Career, Relationships, etc.
    - `question` (text) - The actual question text
    - `is_trending` (boolean) - Flag for popular questions
    - `usage_count` (integer) - Track popularity
    - `created_at` (timestamptz)

  3. Security
    - Enable RLS on `question_bank` table
    - Add policy for authenticated users to read questions
*/

-- Add new columns to clips table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'interview_question'
  ) THEN
    ALTER TABLE clips ADD COLUMN interview_question text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'scene_type'
  ) THEN
    ALTER TABLE clips ADD COLUMN scene_type text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'city_style'
  ) THEN
    ALTER TABLE clips ADD COLUMN city_style text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'energy_level'
  ) THEN
    ALTER TABLE clips ADD COLUMN energy_level text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'batch_id'
  ) THEN
    ALTER TABLE clips ADD COLUMN batch_id uuid;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'batch_sequence'
  ) THEN
    ALTER TABLE clips ADD COLUMN batch_sequence integer;
  END IF;
END $$;

-- Create index for batch queries
CREATE INDEX IF NOT EXISTS idx_clips_batch_id ON clips(batch_id) WHERE batch_id IS NOT NULL;

-- Create question_bank table
CREATE TABLE IF NOT EXISTS question_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  question text NOT NULL,
  is_trending boolean DEFAULT false,
  usage_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on question_bank
ALTER TABLE question_bank ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read questions (public content)
CREATE POLICY "Anyone can read questions"
  ON question_bank
  FOR SELECT
  TO authenticated
  USING (true);

-- Seed viral questions
INSERT INTO question_bank (category, question, is_trending) VALUES
  -- Money & Success
  ('money', 'How much do you make?', true),
  ('money', 'What''s your net worth?', true),
  ('money', 'What''s the most you''ve spent on something stupid?', false),
  ('money', 'Do you think money buys happiness?', false),
  ('money', 'What''s your biggest financial regret?', false),
  ('money', 'Are you rich or just comfortable?', true),
  
  -- Dating & Relationships
  ('dating', 'What''s your biggest dating ick?', true),
  ('dating', 'What''s your red flag?', true),
  ('dating', 'What''s your body count?', true),
  ('dating', 'Have you ever cheated?', false),
  ('dating', 'What''s the worst date you''ve been on?', false),
  ('dating', 'Do you believe in love at first sight?', false),
  ('dating', 'What''s a green flag you look for?', false),
  
  -- Personal & Self
  ('personal', 'What''s your toxic trait?', true),
  ('personal', 'Rate your life 1-10', true),
  ('personal', 'What''s your biggest insecurity?', false),
  ('personal', 'What''s your guilty pleasure?', false),
  ('personal', 'What''s something you''re secretly good at?', false),
  ('personal', 'What''s the craziest thing you''ve done?', false),
  ('personal', 'What keeps you up at night?', false),
  
  -- Career
  ('career', 'What do you do for work?', false),
  ('career', 'Do you love your job?', false),
  ('career', 'What''s your dream job?', false),
  ('career', 'Would you quit if you won the lottery?', true),
  ('career', 'What''s your side hustle?', false),
  ('career', 'What advice would you give your younger self?', false),
  
  -- Hot Takes
  ('hottakes', 'What''s your most controversial opinion?', true),
  ('hottakes', 'Is New York overrated?', true),
  ('hottakes', 'Pineapple on pizza?', false),
  ('hottakes', 'What''s something everyone loves but you hate?', false),
  ('hottakes', 'What''s the worst trend right now?', false),
  
  -- Life Philosophy
  ('philosophy', 'What''s the meaning of life?', false),
  ('philosophy', 'Are you living or surviving?', true),
  ('philosophy', 'What scares you the most?', false),
  ('philosophy', 'What would you tell your 16 year old self?', false),
  ('philosophy', 'Do you have any regrets?', false),
  
  -- NYC Specific
  ('nyc', 'What''s the worst thing about living in NYC?', true),
  ('nyc', 'How long have you lived in the city?', false),
  ('nyc', 'Where are you from originally?', false),
  ('nyc', 'Best neighborhood in NYC?', false),
  ('nyc', 'Would you ever leave New York?', false)
ON CONFLICT DO NOTHING;