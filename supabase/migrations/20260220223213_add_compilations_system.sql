/*
  # Add Compilations System for Clip Stitching

  1. New Tables
    - `compilations`
      - `id` (uuid, primary key)
      - `user_id` (text, not null) - owner of the compilation
      - `name` (text) - user-given name for the compilation
      - `status` (text) - queued, stitching, done, error
      - `transition_type` (text) - crossfade, cut, dissolve
      - `transition_duration` (numeric) - seconds of overlap between clips
      - `total_duration_seconds` (integer) - calculated total duration
      - `final_video_url` (text) - URL of the stitched video
      - `caption_file_url` (text) - URL of the generated SRT file
      - `thumbnail_url` (text) - URL of the compilation thumbnail
      - `template_id` (uuid) - FK to video_templates for branding
      - `overlay_status` (text) - composing status for enhancements
      - `composed_video_url` (text) - URL of the enhanced/composed video
      - `error` (text) - error message if stitching fails
      - `created_at` (timestamptz) - creation timestamp
      - `completed_at` (timestamptz) - completion timestamp

    - `compilation_clips`
      - `id` (uuid, primary key)
      - `compilation_id` (uuid) - FK to compilations
      - `clip_id` (uuid) - FK to clips
      - `sequence` (integer) - ordering position
      - `trim_start` (numeric) - seconds to trim from clip start
      - `trim_end` (numeric) - seconds to trim from clip end
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Authenticated users can manage their own compilations
    - Anonymous users get read/write access for dev mode (matching existing pattern)
    - compilation_clips access controlled via compilation ownership

  3. Indexes
    - Index on compilations.user_id for fast user lookups
    - Index on compilation_clips.compilation_id for fast join lookups
*/

CREATE TABLE IF NOT EXISTS compilations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'queued',
  transition_type text NOT NULL DEFAULT 'crossfade',
  transition_duration numeric NOT NULL DEFAULT 0.3,
  total_duration_seconds integer NOT NULL DEFAULT 0,
  final_video_url text,
  caption_file_url text,
  thumbnail_url text,
  template_id uuid,
  overlay_status text,
  composed_video_url text,
  error text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS compilation_clips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compilation_id uuid NOT NULL REFERENCES compilations(id) ON DELETE CASCADE,
  clip_id uuid NOT NULL REFERENCES clips(id),
  sequence integer NOT NULL DEFAULT 0,
  trim_start numeric NOT NULL DEFAULT 0,
  trim_end numeric,
  created_at timestamptz DEFAULT now(),
  UNIQUE (compilation_id, sequence),
  UNIQUE (compilation_id, clip_id)
);

ALTER TABLE compilations ENABLE ROW LEVEL SECURITY;
ALTER TABLE compilation_clips ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_compilations_user_id ON compilations(user_id);
CREATE INDEX IF NOT EXISTS idx_compilation_clips_compilation_id ON compilation_clips(compilation_id);

CREATE POLICY "Authenticated users can read own compilations"
  ON compilations FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id);

CREATE POLICY "Authenticated users can insert own compilations"
  ON compilations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Authenticated users can update own compilations"
  ON compilations FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Authenticated users can delete own compilations"
  ON compilations FOR DELETE
  TO authenticated
  USING (auth.uid()::text = user_id);

CREATE POLICY "Anon users can read compilations"
  ON compilations FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon users can insert compilations"
  ON compilations FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon users can update compilations"
  ON compilations FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read own compilation clips"
  ON compilation_clips FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM compilations
      WHERE compilations.id = compilation_clips.compilation_id
      AND compilations.user_id = auth.uid()::text
    )
  );

CREATE POLICY "Authenticated users can insert own compilation clips"
  ON compilation_clips FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM compilations
      WHERE compilations.id = compilation_clips.compilation_id
      AND compilations.user_id = auth.uid()::text
    )
  );

CREATE POLICY "Authenticated users can update own compilation clips"
  ON compilation_clips FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM compilations
      WHERE compilations.id = compilation_clips.compilation_id
      AND compilations.user_id = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM compilations
      WHERE compilations.id = compilation_clips.compilation_id
      AND compilations.user_id = auth.uid()::text
    )
  );

CREATE POLICY "Authenticated users can delete own compilation clips"
  ON compilation_clips FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM compilations
      WHERE compilations.id = compilation_clips.compilation_id
      AND compilations.user_id = auth.uid()::text
    )
  );

CREATE POLICY "Anon users can read compilation clips"
  ON compilation_clips FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon users can insert compilation clips"
  ON compilation_clips FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon users can update compilation clips"
  ON compilation_clips FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon users can delete compilation clips"
  ON compilation_clips FOR DELETE
  TO anon
  USING (true);
