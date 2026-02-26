/*
  # Production Integrity: Unique Constraints, Indexes, and Deduplication

  1. Unique Constraints (prevent duplicate records)
    - `clips.provider_job_id` (partial, non-null only)
      Prevents a provider webhook retry from creating two clips for the same external job.
    - `episodes(user_id, episode_number)` (partial, non-null episode_number)
      Prevents two episodes from sharing the same number within one user account.
    - `question_bank.question`
      Prevents identical questions from being inserted twice.
    - `music_tracks.name`
      Prevents duplicate track names during seeding or manual entry.
    - `sound_effects.name`
      Prevents duplicate sound effect names during seeding or manual entry.
    - `video_exports(parent_id, parent_type, platform)`
      Prevents the same clip or episode from being exported to the same platform twice.
    - `prompt_fragments(category, key, video_type)` (partial, system rows only)
      Prevents duplicate system-level prompt fragments (user_id IS NULL).
    - `video_templates(user_id, name)`
      Prevents a user from creating two templates with the same name.

  2. New Indexes (speed up common queries)
    - `question_bank(category)` -- category filter on question picker
    - `question_bank(is_trending)` partial -- trending questions list
    - `music_tracks(mood)` -- mood filter in template editor
    - `sound_effects(category)` -- category filter in effects panel
    - `clips(provider_job_id)` partial -- webhook callback lookup
    - `video_exports(status)` -- processing queue polling
    - `prompt_generation_logs(clip_id)` partial -- log lookup by clip

  3. Redundant Index Cleanup
    - Drops exact-duplicate indexes that waste write I/O with no read benefit
    - `clips_status_idx` duplicates `idx_clips_status`
    - `idx_clips_user_created` duplicates `idx_clips_user_id_created_at`
    - `idx_clips_user_video_type` duplicates `idx_clips_user_id_video_type`
    - `idx_video_exports_user` duplicates `idx_video_exports_user_id`
    - `idx_prompt_fragments_category` duplicates `idx_prompt_fragments_category_key`
    - `idx_compilation_clips_compilation_id_sequence` duplicated by unique constraint

  4. Security
    - No RLS changes
    - No column drops
    - All operations use IF NOT EXISTS / IF EXISTS for safety
*/

-- =============================================================
-- 1. UNIQUE CONSTRAINTS
-- =============================================================

-- Clips: one record per external provider job
-- Prevents double-creation when a provider webhook fires twice
CREATE UNIQUE INDEX IF NOT EXISTS uq_clips_provider_job_id
  ON clips (provider_job_id)
  WHERE provider_job_id IS NOT NULL;

-- Episodes: one episode number per user
-- Prevents numbering collisions when creating episodes concurrently
CREATE UNIQUE INDEX IF NOT EXISTS uq_episodes_user_episode_number
  ON episodes (user_id, episode_number)
  WHERE episode_number IS NOT NULL;

-- Question bank: no duplicate question text
-- Prevents re-seeding from inserting the same question twice
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'uq_question_bank_question'
  ) THEN
    CREATE UNIQUE INDEX uq_question_bank_question ON question_bank (question);
  END IF;
END $$;

-- Music tracks: no duplicate names
-- Prevents seeding or manual entry from creating twin records
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'uq_music_tracks_name'
  ) THEN
    CREATE UNIQUE INDEX uq_music_tracks_name ON music_tracks (name);
  END IF;
END $$;

-- Sound effects: no duplicate names
-- Same rationale as music tracks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'uq_sound_effects_name'
  ) THEN
    CREATE UNIQUE INDEX uq_sound_effects_name ON sound_effects (name);
  END IF;
END $$;

-- Video exports: one export per content item per platform
-- Prevents the user from accidentally exporting the same clip to TikTok twice
CREATE UNIQUE INDEX IF NOT EXISTS uq_video_exports_parent_platform
  ON video_exports (parent_id, parent_type, platform);

-- Prompt fragments: system-level fragments must be unique by category+key+video_type
-- Prevents seed scripts from inserting duplicate system fragments
CREATE UNIQUE INDEX IF NOT EXISTS uq_prompt_fragments_system_category_key
  ON prompt_fragments (category, key, COALESCE(video_type, '__global__'))
  WHERE user_id IS NULL;

-- Video templates: one template name per user
-- Prevents confusing duplicate template names in the template picker
CREATE UNIQUE INDEX IF NOT EXISTS uq_video_templates_user_name
  ON video_templates (user_id, name);


-- =============================================================
-- 2. NEW INDEXES
-- =============================================================

-- Question bank: category filter used in question picker UI
CREATE INDEX IF NOT EXISTS idx_question_bank_category
  ON question_bank (category);

-- Question bank: trending questions shown prominently
CREATE INDEX IF NOT EXISTS idx_question_bank_trending
  ON question_bank (is_trending)
  WHERE is_trending = true;

-- Music tracks: mood-based filtering in template editor
CREATE INDEX IF NOT EXISTS idx_music_tracks_mood
  ON music_tracks (mood);

-- Sound effects: category filter in effects panel
CREATE INDEX IF NOT EXISTS idx_sound_effects_category
  ON sound_effects (category);

-- Clips: fast lookup by provider job ID for webhook callbacks
CREATE INDEX IF NOT EXISTS idx_clips_provider_job_id
  ON clips (provider_job_id)
  WHERE provider_job_id IS NOT NULL;

-- Video exports: processing queue polls by status
CREATE INDEX IF NOT EXISTS idx_video_exports_status
  ON video_exports (status);

-- Prompt generation logs: lookup logs for a specific clip
CREATE INDEX IF NOT EXISTS idx_prompt_generation_logs_clip_id
  ON prompt_generation_logs (clip_id)
  WHERE clip_id IS NOT NULL;


-- =============================================================
-- 3. REDUNDANT INDEX CLEANUP
-- =============================================================

-- clips_status_idx is byte-identical to idx_clips_status
DROP INDEX IF EXISTS clips_status_idx;

-- idx_clips_user_created is byte-identical to idx_clips_user_id_created_at
DROP INDEX IF EXISTS idx_clips_user_created;

-- idx_clips_user_video_type is byte-identical to idx_clips_user_id_video_type
DROP INDEX IF EXISTS idx_clips_user_video_type;

-- idx_video_exports_user is byte-identical to idx_video_exports_user_id
DROP INDEX IF EXISTS idx_video_exports_user;

-- idx_prompt_fragments_category is byte-identical to idx_prompt_fragments_category_key
DROP INDEX IF EXISTS idx_prompt_fragments_category;

-- idx_compilation_clips_compilation_id_sequence is redundant with the unique constraint
DROP INDEX IF EXISTS idx_compilation_clips_compilation_id_sequence;
