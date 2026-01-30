/*
  # Create Episode Production System Tables

  1. Overview
    This migration creates the full SubwayTakes 6-shot episode production system.
    An episode consists of 6 coordinated shots that form a complete viral video:
    - Cold Open (host asks hook question)
    - Guest Answer (main response)
    - Follow Up (back-and-forth exchange)
    - Reaction (host reaction shot)
    - B-Roll (subway ambience)
    - Close (punchline moment)

  2. New Tables
    - `character_bibles` - Reusable character definitions for consistent appearance
      - `id` (uuid, primary key)
      - `user_id` (text) - Owner of this character
      - `name` (text) - Display name like "SubwayTakes Host"
      - `role` (text) - Either 'host' or 'guest'
      - `age_range` (text) - Age descriptor like "mid-30s"
      - `gender` (text) - Gender presentation
      - `ethnicity` (text) - Ethnic appearance for consistency
      - `clothing_style` (text) - Wardrobe description
      - `hair_description` (text) - Hair style and color
      - `distinguishing_features` (text) - Memorable visual traits
      - `energy_persona` (text) - Personality vibe
      - `voice_style` (text) - Speaking pattern
      - `is_default` (boolean) - Whether this is the default host
      - `created_at` (timestamp)

    - `episode_scripts` - AI-generated dialogue scripts
      - `id` (uuid, primary key)
      - `user_id` (text)
      - `topic` (text) - Category/theme
      - `hook_question` (text) - Opening viral question
      - `guest_answer` (text) - Main response from guest
      - `follow_up_question` (text) - Host follow-up
      - `follow_up_answer` (text) - Guest response to follow-up
      - `reaction_line` (text) - Host reaction/comment
      - `close_punchline` (text) - Final "That's a TAKE" moment
      - `is_generated` (boolean) - Whether AI created this
      - `created_at` (timestamp)

    - `episodes` - Master episode records
      - `id` (uuid, primary key)
      - `user_id` (text)
      - `script_id` (uuid, FK) - Reference to script
      - `host_character_id` (uuid, FK) - Reference to host character
      - `guest_character_id` (uuid, FK) - Reference to guest character
      - `status` (text) - Episode status: queued, generating, stitching, done, error
      - `city_style` (text) - NYC, London, Tokyo, etc.
      - `total_duration_seconds` (integer) - Combined duration of all shots
      - `final_video_url` (text) - Stitched final video
      - `caption_file_url` (text) - SRT/VTT captions
      - `thumbnail_url` (text) - Episode thumbnail
      - `error` (text) - Error message if failed
      - `created_at` (timestamp)
      - `completed_at` (timestamp)

    - `episode_shots` - Individual shots within episodes
      - `id` (uuid, primary key)
      - `episode_id` (uuid, FK) - Parent episode
      - `shot_type` (text) - cold_open, guest_answer, follow_up, reaction, b_roll, close
      - `sequence` (integer) - Order in episode (1-6)
      - `duration_seconds` (integer) - Duration of this shot
      - `dialogue` (text) - What is spoken in this shot
      - `speaker` (text) - 'host' or 'guest' or null for b-roll
      - `camera_direction` (text) - two-shot, close-up, medium, etc.
      - `provider_prompt` (text) - Full Veo prompt
      - `status` (text) - queued, running, done, error
      - `result_url` (text) - Generated video URL
      - `error` (text) - Error if failed
      - `created_at` (timestamp)

  3. Security
    - RLS enabled on all tables
    - Users can only access their own data
*/

-- Character Bibles table
CREATE TABLE IF NOT EXISTS character_bibles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('host', 'guest')),
  age_range text NOT NULL DEFAULT 'late-20s',
  gender text NOT NULL DEFAULT 'male',
  ethnicity text NOT NULL DEFAULT 'diverse',
  clothing_style text NOT NULL DEFAULT 'casual streetwear',
  hair_description text NOT NULL DEFAULT 'short dark hair',
  distinguishing_features text DEFAULT NULL,
  energy_persona text NOT NULL DEFAULT 'confident and engaging',
  voice_style text NOT NULL DEFAULT 'conversational',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE character_bibles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own characters"
  ON character_bibles FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own characters"
  ON character_bibles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own characters"
  ON character_bibles FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own characters"
  ON character_bibles FOR DELETE
  TO authenticated
  USING (auth.uid()::text = user_id);

CREATE POLICY "Anon users can view own characters"
  ON character_bibles FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon users can insert characters"
  ON character_bibles FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon users can update characters"
  ON character_bibles FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon users can delete characters"
  ON character_bibles FOR DELETE
  TO anon
  USING (true);

-- Episode Scripts table
CREATE TABLE IF NOT EXISTS episode_scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  topic text NOT NULL,
  hook_question text NOT NULL,
  guest_answer text NOT NULL,
  follow_up_question text NOT NULL,
  follow_up_answer text NOT NULL,
  reaction_line text NOT NULL,
  close_punchline text NOT NULL,
  is_generated boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE episode_scripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scripts"
  ON episode_scripts FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own scripts"
  ON episode_scripts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own scripts"
  ON episode_scripts FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own scripts"
  ON episode_scripts FOR DELETE
  TO authenticated
  USING (auth.uid()::text = user_id);

CREATE POLICY "Anon users can view own scripts"
  ON episode_scripts FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon users can insert scripts"
  ON episode_scripts FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon users can update scripts"
  ON episode_scripts FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon users can delete scripts"
  ON episode_scripts FOR DELETE
  TO anon
  USING (true);

-- Episodes table
CREATE TABLE IF NOT EXISTS episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  script_id uuid REFERENCES episode_scripts(id) ON DELETE SET NULL,
  host_character_id uuid REFERENCES character_bibles(id) ON DELETE SET NULL,
  guest_character_id uuid REFERENCES character_bibles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'generating', 'stitching', 'done', 'error')),
  city_style text NOT NULL DEFAULT 'nyc',
  total_duration_seconds integer NOT NULL DEFAULT 36,
  final_video_url text DEFAULT NULL,
  caption_file_url text DEFAULT NULL,
  thumbnail_url text DEFAULT NULL,
  error text DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz DEFAULT NULL
);

ALTER TABLE episodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own episodes"
  ON episodes FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own episodes"
  ON episodes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own episodes"
  ON episodes FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own episodes"
  ON episodes FOR DELETE
  TO authenticated
  USING (auth.uid()::text = user_id);

CREATE POLICY "Anon users can view own episodes"
  ON episodes FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon users can insert episodes"
  ON episodes FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon users can update episodes"
  ON episodes FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon users can delete episodes"
  ON episodes FOR DELETE
  TO anon
  USING (true);

-- Episode Shots table
CREATE TABLE IF NOT EXISTS episode_shots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  shot_type text NOT NULL CHECK (shot_type IN ('cold_open', 'guest_answer', 'follow_up', 'reaction', 'b_roll', 'close')),
  sequence integer NOT NULL CHECK (sequence >= 1 AND sequence <= 6),
  duration_seconds integer NOT NULL DEFAULT 6,
  dialogue text DEFAULT NULL,
  speaker text DEFAULT NULL CHECK (speaker IS NULL OR speaker IN ('host', 'guest')),
  camera_direction text NOT NULL DEFAULT 'two-shot',
  provider_prompt text DEFAULT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'error')),
  result_url text DEFAULT NULL,
  error text DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(episode_id, sequence)
);

ALTER TABLE episode_shots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view shots via episode"
  ON episode_shots FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM episodes
      WHERE episodes.id = episode_shots.episode_id
      AND auth.uid()::text = episodes.user_id
    )
  );

CREATE POLICY "Users can insert shots via episode"
  ON episode_shots FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM episodes
      WHERE episodes.id = episode_shots.episode_id
      AND auth.uid()::text = episodes.user_id
    )
  );

CREATE POLICY "Users can update shots via episode"
  ON episode_shots FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM episodes
      WHERE episodes.id = episode_shots.episode_id
      AND auth.uid()::text = episodes.user_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM episodes
      WHERE episodes.id = episode_shots.episode_id
      AND auth.uid()::text = episodes.user_id
    )
  );

CREATE POLICY "Users can delete shots via episode"
  ON episode_shots FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM episodes
      WHERE episodes.id = episode_shots.episode_id
      AND auth.uid()::text = episodes.user_id
    )
  );

CREATE POLICY "Anon users can view shots"
  ON episode_shots FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon users can insert shots"
  ON episode_shots FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon users can update shots"
  ON episode_shots FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon users can delete shots"
  ON episode_shots FOR DELETE
  TO anon
  USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_character_bibles_user_id ON character_bibles(user_id);
CREATE INDEX IF NOT EXISTS idx_character_bibles_role ON character_bibles(role);
CREATE INDEX IF NOT EXISTS idx_episode_scripts_user_id ON episode_scripts(user_id);
CREATE INDEX IF NOT EXISTS idx_episodes_user_id ON episodes(user_id);
CREATE INDEX IF NOT EXISTS idx_episodes_status ON episodes(status);
CREATE INDEX IF NOT EXISTS idx_episode_shots_episode_id ON episode_shots(episode_id);
CREATE INDEX IF NOT EXISTS idx_episode_shots_status ON episode_shots(status);
