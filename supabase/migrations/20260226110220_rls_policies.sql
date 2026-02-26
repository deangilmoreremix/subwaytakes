/*
  # RLS Policy Hardening: Privilege Reduction, Ownership Immutability, FK Protection

  This migration closes several defense-in-depth gaps discovered during a security audit.
  No existing RLS policies are removed. No columns are dropped.

  1. Privilege Revocations
    - Revoke TRUNCATE and TRIGGER from `anon` on ALL public tables
      (TRUNCATE bypasses RLS and could wipe entire tables without authentication)
    - Revoke all DML from `anon` on user-data tables
      (existing RLS blocks access, but grants should not exist as defense-in-depth)
    - Revoke INSERT/UPDATE/DELETE from `authenticated` on system reference tables
      (music_tracks, sound_effects, question_bank are admin-seeded, not user-mutable)

  2. Ownership Immutability Triggers
    - New trigger function `immutable_user_id()` that rejects any UPDATE changing user_id
    - Applied to 11 user-owned tables: clips, compilations, episodes, episode_scripts,
      character_bibles, video_exports, video_templates, prompt_fragments,
      prompt_generation_logs, prompt_templates, system_prompts
    - user_profiles already protected by existing triggers, not duplicated

  3. Parent FK Immutability Triggers
    - `compilation_clips.compilation_id` made immutable on UPDATE
      (prevents moving a clip entry to a different compilation, even one you own)
    - `compilation_clips.clip_id` made immutable on UPDATE
      (prevents swapping the referenced clip after creation)
    - `episode_shots.episode_id` made immutable on UPDATE
      (prevents moving a shot to a different episode)

  4. Policy Fix
    - Replace question_bank SELECT policy `USING (true)` with explicit auth check
      (functionally identical for authenticated role, but avoids blanket true predicate)

  5. Security Notes
    - All existing RLS policies are preserved
    - All existing columns are preserved
    - All operations are idempotent (safe to re-run)
    - No data is modified
*/


-- =============================================================
-- 1. REVOKE DANGEROUS PRIVILEGES FROM `anon`
-- =============================================================

-- TRUNCATE bypasses RLS. No anonymous user should ever truncate a table.
-- TRIGGER allows creating triggers, another unnecessary privilege for anon.
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('REVOKE TRUNCATE, TRIGGER ON public.%I FROM anon', tbl);
  END LOOP;
END $$;

-- Revoke all DML from anon on user-data tables.
-- Even though RLS blocks access (no anon policies exist), the grants should not be present.
REVOKE INSERT, UPDATE, DELETE ON
  clips,
  compilations,
  compilation_clips,
  episodes,
  episode_scripts,
  episode_shots,
  character_bibles,
  video_exports,
  video_templates,
  prompt_fragments,
  prompt_templates,
  prompt_generation_logs,
  system_prompts,
  user_profiles
FROM anon;

-- Revoke mutation grants from anon on system reference tables.
-- anon should only have SELECT on reference data, nothing else.
REVOKE INSERT, UPDATE, DELETE ON
  music_tracks,
  sound_effects,
  question_bank
FROM anon;

-- Revoke mutation grants from authenticated on system reference tables.
-- These tables are admin-seeded. No RLS policies allow user mutation,
-- but the grants should not exist as defense-in-depth.
REVOKE INSERT, UPDATE, DELETE ON
  music_tracks,
  sound_effects,
  question_bank
FROM authenticated;


-- =============================================================
-- 2. OWNERSHIP IMMUTABILITY TRIGGER FUNCTION
-- =============================================================

-- Prevents any UPDATE from changing the user_id column.
-- This is a defense-in-depth layer on top of RLS WITH CHECK clauses.
-- Even if a policy bug is introduced, ownership cannot be transferred.
CREATE OR REPLACE FUNCTION immutable_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Ownership transfer forbidden: user_id is immutable on %', TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END;
$$;

-- Apply to every table that has a user_id ownership column.
-- user_profiles is excluded because it uses `id` as the ownership field
-- and already has protect_user_profile_fields() and protect_profile_sensitive_fields() triggers.

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'clips',
      'compilations',
      'episodes',
      'episode_scripts',
      'character_bibles',
      'video_exports',
      'video_templates',
      'prompt_fragments',
      'prompt_generation_logs',
      'prompt_templates',
      'system_prompts'
    ])
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'trg_immutable_user_id_' || tbl
        AND tgrelid = ('public.' || tbl)::regclass
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER trg_immutable_user_id_%I
         BEFORE UPDATE ON public.%I
         FOR EACH ROW
         EXECUTE FUNCTION immutable_user_id()',
        tbl, tbl
      );
    END IF;
  END LOOP;
END $$;


-- =============================================================
-- 3. PARENT FK IMMUTABILITY TRIGGERS
-- =============================================================

-- Prevents moving a compilation_clip to a different compilation or swapping its clip reference.
-- Without this, a user could UPDATE compilation_clips SET compilation_id = <other-compilation>
-- and the RLS WITH CHECK would allow it if both compilations belong to the same user.
-- Business logic never requires re-parenting; block it at the database level.
CREATE OR REPLACE FUNCTION immutable_compilation_clip_parents()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.compilation_id IS DISTINCT FROM OLD.compilation_id THEN
    RAISE EXCEPTION 'compilation_id is immutable on compilation_clips';
  END IF;
  IF NEW.clip_id IS DISTINCT FROM OLD.clip_id THEN
    RAISE EXCEPTION 'clip_id is immutable on compilation_clips';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_immutable_compilation_clip_parents'
      AND tgrelid = 'public.compilation_clips'::regclass
  ) THEN
    CREATE TRIGGER trg_immutable_compilation_clip_parents
      BEFORE UPDATE ON public.compilation_clips
      FOR EACH ROW
      EXECUTE FUNCTION immutable_compilation_clip_parents();
  END IF;
END $$;

-- Prevents moving an episode_shot to a different episode.
-- Same rationale: re-parenting shots across episodes is never a valid operation.
CREATE OR REPLACE FUNCTION immutable_episode_shot_parent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.episode_id IS DISTINCT FROM OLD.episode_id THEN
    RAISE EXCEPTION 'episode_id is immutable on episode_shots';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_immutable_episode_shot_parent'
      AND tgrelid = 'public.episode_shots'::regclass
  ) THEN
    CREATE TRIGGER trg_immutable_episode_shot_parent
      BEFORE UPDATE ON public.episode_shots
      FOR EACH ROW
      EXECUTE FUNCTION immutable_episode_shot_parent();
  END IF;
END $$;


-- =============================================================
-- 4. FIX question_bank USING(true) POLICY
-- =============================================================

-- Replace the blanket USING (true) with an explicit auth check.
-- Functionally identical for the `authenticated` role, but avoids the
-- anti-pattern of a true predicate that could mask intent.
DROP POLICY IF EXISTS "Authenticated can read questions" ON question_bank;

CREATE POLICY "Authenticated can read questions"
  ON question_bank
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);
