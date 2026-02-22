/*
  # Prompt Management System

  1. New Tables
    - `prompt_templates` - Stores video generation prompt blueprints per video type
      - `id` (uuid, primary key)
      - `user_id` (uuid, nullable - null means system-level template)
      - `video_type` (text, not null) - one of the 5 clip types
      - `name` (text, not null) - descriptive template name
      - `version` (integer, default 1) - version number for tracking
      - `is_active` (boolean, default true) - whether this template is live
      - `base_prompt` (text, not null) - the core prompt template with placeholders
      - `negative_prompt` (text) - what to avoid in generation
      - `system_rules` (text) - mandatory rules block
      - `visual_anchors` (text) - critical visual elements
      - `forbidden_elements` (text) - explicitly forbidden items
      - `metadata` (jsonb) - flexible config: scene prompts, style prompts, etc.
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `prompt_fragments` - Reusable prompt building blocks
      - `id` (uuid, primary key)
      - `user_id` (uuid, nullable - null means system-level)
      - `category` (text, not null) - e.g. 'scene', 'camera', 'lighting', 'character', 'tone', 'setting'
      - `key` (text, not null) - lookup key, e.g. 'platform_waiting', 'golden_hour'
      - `video_type` (text) - nullable, null means shared across types
      - `content` (text, not null) - the actual prompt fragment text
      - `metadata` (jsonb) - additional config
      - `created_at` (timestamptz)

    - `system_prompts` - OpenAI system prompts for script generation
      - `id` (uuid, primary key)
      - `user_id` (uuid, nullable)
      - `video_type` (text, not null)
      - `name` (text, not null)
      - `version` (integer, default 1)
      - `is_active` (boolean, default true)
      - `system_prompt` (text, not null) - the system message for OpenAI
      - `user_prompt_template` (text, not null) - template for user message
      - `model` (text, default 'gpt-4o-mini')
      - `temperature` (real, default 0.9)
      - `max_tokens` (integer, default 600)
      - `metadata` (jsonb) - topic contexts, fallback configs, etc.
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `prompt_generation_logs` - Tracks prompt generation for analytics
      - `id` (uuid, primary key)
      - `user_id` (uuid, not null)
      - `clip_id` (uuid, nullable)
      - `video_type` (text, not null)
      - `template_id` (uuid, nullable)
      - `system_prompt_id` (uuid, nullable)
      - `input_params` (jsonb) - the user selections
      - `generated_prompt` (text) - the final assembled prompt
      - `generated_script` (jsonb) - the AI-generated script if applicable
      - `source` (text) - 'backend', 'client_fallback', 'template_fallback'
      - `created_at` (timestamptz)

  2. Security
    - RLS enabled on all tables
    - System templates (user_id IS NULL) readable by all authenticated users
    - User templates only accessible by their owner
    - Logs only accessible by the user who created them

  3. Important Notes
    - System-level records have user_id = NULL and serve as defaults
    - Users can create their own templates which override system defaults
    - Version tracking allows safe iteration without losing previous prompts
    - The metadata JSONB column provides flexibility for type-specific configuration
*/

-- prompt_templates table
CREATE TABLE IF NOT EXISTS prompt_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  video_type text NOT NULL CHECK (video_type IN ('subway_interview', 'street_interview', 'motivational', 'studio_interview', 'wisdom_interview')),
  name text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  base_prompt text NOT NULL,
  negative_prompt text DEFAULT '',
  system_rules text DEFAULT '',
  visual_anchors text DEFAULT '',
  forbidden_elements text DEFAULT '',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read system prompt templates"
  ON prompt_templates FOR SELECT
  TO authenticated
  USING (user_id IS NULL);

CREATE POLICY "Users can read own prompt templates"
  ON prompt_templates FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own prompt templates"
  ON prompt_templates FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own prompt templates"
  ON prompt_templates FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own prompt templates"
  ON prompt_templates FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- prompt_fragments table
CREATE TABLE IF NOT EXISTS prompt_fragments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  key text NOT NULL,
  video_type text CHECK (video_type IS NULL OR video_type IN ('subway_interview', 'street_interview', 'motivational', 'studio_interview', 'wisdom_interview')),
  content text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE prompt_fragments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read system prompt fragments"
  ON prompt_fragments FOR SELECT
  TO authenticated
  USING (user_id IS NULL);

CREATE POLICY "Users can read own prompt fragments"
  ON prompt_fragments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own prompt fragments"
  ON prompt_fragments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own prompt fragments"
  ON prompt_fragments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own prompt fragments"
  ON prompt_fragments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- system_prompts table
CREATE TABLE IF NOT EXISTS system_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  video_type text NOT NULL CHECK (video_type IN ('subway_interview', 'street_interview', 'motivational', 'studio_interview', 'wisdom_interview')),
  name text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  system_prompt text NOT NULL,
  user_prompt_template text NOT NULL,
  model text NOT NULL DEFAULT 'gpt-4o-mini',
  temperature real NOT NULL DEFAULT 0.9,
  max_tokens integer NOT NULL DEFAULT 600,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE system_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read system-level prompts"
  ON system_prompts FOR SELECT
  TO authenticated
  USING (user_id IS NULL);

CREATE POLICY "Users can read own system prompts"
  ON system_prompts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own system prompts"
  ON system_prompts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own system prompts"
  ON system_prompts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own system prompts"
  ON system_prompts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- prompt_generation_logs table
CREATE TABLE IF NOT EXISTS prompt_generation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clip_id uuid,
  video_type text NOT NULL,
  template_id uuid REFERENCES prompt_templates(id) ON DELETE SET NULL,
  system_prompt_id uuid REFERENCES system_prompts(id) ON DELETE SET NULL,
  input_params jsonb DEFAULT '{}'::jsonb,
  generated_prompt text DEFAULT '',
  generated_script jsonb,
  source text NOT NULL DEFAULT 'client_fallback',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE prompt_generation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own prompt logs"
  ON prompt_generation_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own prompt logs"
  ON prompt_generation_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_prompt_templates_video_type ON prompt_templates(video_type);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_active ON prompt_templates(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_prompt_fragments_category ON prompt_fragments(category, key);
CREATE INDEX IF NOT EXISTS idx_prompt_fragments_video_type ON prompt_fragments(video_type);
CREATE INDEX IF NOT EXISTS idx_system_prompts_video_type ON system_prompts(video_type);
CREATE INDEX IF NOT EXISTS idx_system_prompts_active ON system_prompts(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_prompt_logs_user ON prompt_generation_logs(user_id, created_at DESC);