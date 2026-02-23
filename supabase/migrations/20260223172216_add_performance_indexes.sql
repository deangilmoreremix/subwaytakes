/*
  # Add Performance Indexes for Scale

  1. New Indexes
    - `clips(user_id, created_at DESC)` composite for list queries
    - `clips(batch_id)` for batch deletion
    - `clips(user_id, video_type)` for filtered list queries
    - `episodes(user_id, created_at DESC)` composite for list queries
    - `compilations(user_id, created_at DESC)` composite for list queries
    - `character_bibles(user_id, created_at DESC)` composite for list queries
    - `character_bibles(user_id, role, is_default)` for default host lookup
    - `episode_scripts(user_id, created_at DESC)` composite for list queries
    - `video_templates(user_id)` for template filtering
    - `video_templates(is_system, is_default)` for default template lookup

  2. Notes
    - All indexes use IF NOT EXISTS to be safe for re-runs
    - These address query patterns found across all lib modules
*/

CREATE INDEX IF NOT EXISTS idx_clips_user_created
  ON clips(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_clips_batch_id
  ON clips(batch_id) WHERE batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clips_user_video_type
  ON clips(user_id, video_type);

CREATE INDEX IF NOT EXISTS idx_episodes_user_created
  ON episodes(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_compilations_user_created
  ON compilations(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_character_bibles_user_created
  ON character_bibles(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_character_bibles_user_role_default
  ON character_bibles(user_id, role, is_default) WHERE is_default = true;

CREATE INDEX IF NOT EXISTS idx_episode_scripts_user_created
  ON episode_scripts(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_video_templates_user_id
  ON video_templates(user_id) WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_video_templates_system_default
  ON video_templates(is_system, is_default) WHERE is_system = true;
