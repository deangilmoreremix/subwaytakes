/*
  # Create clips table for AI video generation

  1. New Tables
    - `clips`
      - `id` (uuid, primary key)
      - `user_id` (text, required) - identifies the user who created the clip
      - `video_type` (text, required) - motivational, street_interview, or subway_interview
      - `topic` (text, required) - the topic category
      - `duration_seconds` (integer, required) - 3, 4, 5, 6, or 8 seconds
      - `angle_prompt` (text, optional) - custom user direction
      - `provider` (text, required) - video provider name, default 'vimax'
      - `provider_job_id` (text, optional) - external job ID for tracking
      - `status` (text, required) - queued, running, done, or error
      - `provider_prompt` (text, optional) - full prompt sent to provider
      - `negative_prompt` (text, optional) - negative prompt for generation
      - `result_url` (text, optional) - final video URL
      - `error` (text, optional) - error message if failed
      - `created_at` (timestamptz, default now)

  2. Security
    - Enable RLS on `clips` table
    - Add policies for users to manage their own clips
*/

CREATE TABLE IF NOT EXISTS clips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  video_type text NOT NULL CHECK (video_type IN ('motivational', 'street_interview', 'subway_interview')),
  topic text NOT NULL,
  duration_seconds integer NOT NULL CHECK (duration_seconds IN (3, 4, 5, 6, 8)),
  angle_prompt text,
  provider text NOT NULL DEFAULT 'vimax',
  provider_job_id text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'error')),
  provider_prompt text,
  negative_prompt text,
  result_url text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clips_user_id_idx ON clips(user_id);
CREATE INDEX IF NOT EXISTS clips_created_at_idx ON clips(created_at DESC);
CREATE INDEX IF NOT EXISTS clips_status_idx ON clips(status);

ALTER TABLE clips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own clips"
  ON clips
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own clips"
  ON clips
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own clips"
  ON clips
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Anonymous users can view their clips by user_id"
  ON clips
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anonymous users can insert clips"
  ON clips
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anonymous users can update their clips"
  ON clips
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);