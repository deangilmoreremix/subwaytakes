/*
  # Harden RLS Policies -- Full Security Audit

  ## Summary
  Drops all existing policies and re-creates them with strict ownership enforcement.
  Removes all anonymous-role access. Adds cross-reference ownership checks to prevent
  IDOR attacks on join tables. Adds performance indexes for RLS subqueries.

  ## Ownership Model
  - **Tier 1 (direct ownership)**: user_profiles, clips, episodes, episode_scripts,
    character_bibles, compilations, video_exports, prompt_generation_logs
  - **Tier 2 (inherited via parent)**: episode_shots (via episodes), compilation_clips
    (via compilations AND clips -- cross-reference check)
  - **Tier 3 (mixed system + user)**: video_templates, prompt_fragments,
    prompt_templates, system_prompts
  - **Tier 4 (shared read-only)**: question_bank, music_tracks, sound_effects

  ## Vulnerabilities Fixed
  1. Removed 6 anon-role policies that exposed system data to unauthenticated callers
  2. Added clip ownership check to compilation_clips INSERT/UPDATE (IDOR fix)
  3. Added user_profiles DELETE policy (missing)
  4. Ensured all UPDATE policies have both USING and WITH CHECK to prevent ownership mutation
  5. Added performance indexes for RLS subquery joins

  ## Security Rules
  - Every policy scoped to `authenticated` role only
  - No `USING (true)` except question_bank (shared reference data, no user column)
  - UPDATE policies always enforce ownership immutability via WITH CHECK
  - INSERT policies always enforce auth.uid() in WITH CHECK
  - Child table policies always verify parent ownership via subquery
  - compilation_clips INSERT/UPDATE also verifies clip ownership (prevents IDOR)
*/

-- ============================================================
-- STEP 1: Drop all existing policies (clean slate)
-- ============================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;


-- ============================================================
-- STEP 2: Re-create all policies per table
-- ============================================================

-- ----------------------------------------------------------
-- 1. user_profiles (id = auth.uid())
-- ----------------------------------------------------------

CREATE POLICY "Owner can read own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Owner can create own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Owner can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Owner can delete own profile"
  ON user_profiles FOR DELETE
  TO authenticated
  USING (auth.uid() = id);


-- ----------------------------------------------------------
-- 2. clips (user_id = auth.uid()::text)
-- ----------------------------------------------------------

CREATE POLICY "Owner can read own clips"
  ON clips FOR SELECT
  TO authenticated
  USING ((auth.uid())::text = user_id);

CREATE POLICY "Owner can create own clips"
  ON clips FOR INSERT
  TO authenticated
  WITH CHECK ((auth.uid())::text = user_id);

CREATE POLICY "Owner can update own clips"
  ON clips FOR UPDATE
  TO authenticated
  USING ((auth.uid())::text = user_id)
  WITH CHECK ((auth.uid())::text = user_id);

CREATE POLICY "Owner can delete own clips"
  ON clips FOR DELETE
  TO authenticated
  USING ((auth.uid())::text = user_id);


-- ----------------------------------------------------------
-- 3. episodes (user_id = auth.uid()::text)
-- ----------------------------------------------------------

CREATE POLICY "Owner can read own episodes"
  ON episodes FOR SELECT
  TO authenticated
  USING ((auth.uid())::text = user_id);

CREATE POLICY "Owner can create own episodes"
  ON episodes FOR INSERT
  TO authenticated
  WITH CHECK ((auth.uid())::text = user_id);

CREATE POLICY "Owner can update own episodes"
  ON episodes FOR UPDATE
  TO authenticated
  USING ((auth.uid())::text = user_id)
  WITH CHECK ((auth.uid())::text = user_id);

CREATE POLICY "Owner can delete own episodes"
  ON episodes FOR DELETE
  TO authenticated
  USING ((auth.uid())::text = user_id);


-- ----------------------------------------------------------
-- 4. episode_scripts (user_id = auth.uid()::text)
-- ----------------------------------------------------------

CREATE POLICY "Owner can read own scripts"
  ON episode_scripts FOR SELECT
  TO authenticated
  USING ((auth.uid())::text = user_id);

CREATE POLICY "Owner can create own scripts"
  ON episode_scripts FOR INSERT
  TO authenticated
  WITH CHECK ((auth.uid())::text = user_id);

CREATE POLICY "Owner can update own scripts"
  ON episode_scripts FOR UPDATE
  TO authenticated
  USING ((auth.uid())::text = user_id)
  WITH CHECK ((auth.uid())::text = user_id);

CREATE POLICY "Owner can delete own scripts"
  ON episode_scripts FOR DELETE
  TO authenticated
  USING ((auth.uid())::text = user_id);


-- ----------------------------------------------------------
-- 5. episode_shots (inherited via episodes.user_id)
-- ----------------------------------------------------------

CREATE POLICY "Owner can read shots via episode"
  ON episode_shots FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM episodes
      WHERE episodes.id = episode_shots.episode_id
        AND (auth.uid())::text = episodes.user_id
    )
  );

CREATE POLICY "Owner can create shots via episode"
  ON episode_shots FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM episodes
      WHERE episodes.id = episode_shots.episode_id
        AND (auth.uid())::text = episodes.user_id
    )
  );

CREATE POLICY "Owner can update shots via episode"
  ON episode_shots FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM episodes
      WHERE episodes.id = episode_shots.episode_id
        AND (auth.uid())::text = episodes.user_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM episodes
      WHERE episodes.id = episode_shots.episode_id
        AND (auth.uid())::text = episodes.user_id
    )
  );

CREATE POLICY "Owner can delete shots via episode"
  ON episode_shots FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM episodes
      WHERE episodes.id = episode_shots.episode_id
        AND (auth.uid())::text = episodes.user_id
    )
  );


-- ----------------------------------------------------------
-- 6. character_bibles (user_id = auth.uid()::text)
-- ----------------------------------------------------------

CREATE POLICY "Owner can read own characters"
  ON character_bibles FOR SELECT
  TO authenticated
  USING ((auth.uid())::text = user_id);

CREATE POLICY "Owner can create own characters"
  ON character_bibles FOR INSERT
  TO authenticated
  WITH CHECK ((auth.uid())::text = user_id);

CREATE POLICY "Owner can update own characters"
  ON character_bibles FOR UPDATE
  TO authenticated
  USING ((auth.uid())::text = user_id)
  WITH CHECK ((auth.uid())::text = user_id);

CREATE POLICY "Owner can delete own characters"
  ON character_bibles FOR DELETE
  TO authenticated
  USING ((auth.uid())::text = user_id);


-- ----------------------------------------------------------
-- 7. compilations (user_id = auth.uid()::text)
-- ----------------------------------------------------------

CREATE POLICY "Owner can read own compilations"
  ON compilations FOR SELECT
  TO authenticated
  USING ((auth.uid())::text = user_id);

CREATE POLICY "Owner can create own compilations"
  ON compilations FOR INSERT
  TO authenticated
  WITH CHECK ((auth.uid())::text = user_id);

CREATE POLICY "Owner can update own compilations"
  ON compilations FOR UPDATE
  TO authenticated
  USING ((auth.uid())::text = user_id)
  WITH CHECK ((auth.uid())::text = user_id);

CREATE POLICY "Owner can delete own compilations"
  ON compilations FOR DELETE
  TO authenticated
  USING ((auth.uid())::text = user_id);


-- ----------------------------------------------------------
-- 8. compilation_clips (inherited via compilations + clips ownership check)
--    IDOR FIX: INSERT/UPDATE must verify BOTH compilation AND clip ownership
-- ----------------------------------------------------------

CREATE POLICY "Owner can read own compilation clips"
  ON compilation_clips FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM compilations
      WHERE compilations.id = compilation_clips.compilation_id
        AND (auth.uid())::text = compilations.user_id
    )
  );

CREATE POLICY "Owner can add own clips to own compilations"
  ON compilation_clips FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM compilations
      WHERE compilations.id = compilation_clips.compilation_id
        AND (auth.uid())::text = compilations.user_id
    )
    AND
    EXISTS (
      SELECT 1 FROM clips
      WHERE clips.id = compilation_clips.clip_id
        AND (auth.uid())::text = clips.user_id
    )
  );

CREATE POLICY "Owner can update own compilation clips"
  ON compilation_clips FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM compilations
      WHERE compilations.id = compilation_clips.compilation_id
        AND (auth.uid())::text = compilations.user_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM compilations
      WHERE compilations.id = compilation_clips.compilation_id
        AND (auth.uid())::text = compilations.user_id
    )
    AND
    EXISTS (
      SELECT 1 FROM clips
      WHERE clips.id = compilation_clips.clip_id
        AND (auth.uid())::text = clips.user_id
    )
  );

CREATE POLICY "Owner can delete own compilation clips"
  ON compilation_clips FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM compilations
      WHERE compilations.id = compilation_clips.compilation_id
        AND (auth.uid())::text = compilations.user_id
    )
  );


-- ----------------------------------------------------------
-- 9. video_exports (user_id = auth.uid()::text)
-- ----------------------------------------------------------

CREATE POLICY "Owner can read own exports"
  ON video_exports FOR SELECT
  TO authenticated
  USING ((auth.uid())::text = user_id);

CREATE POLICY "Owner can create own exports"
  ON video_exports FOR INSERT
  TO authenticated
  WITH CHECK ((auth.uid())::text = user_id);

CREATE POLICY "Owner can update own exports"
  ON video_exports FOR UPDATE
  TO authenticated
  USING ((auth.uid())::text = user_id)
  WITH CHECK ((auth.uid())::text = user_id);

CREATE POLICY "Owner can delete own exports"
  ON video_exports FOR DELETE
  TO authenticated
  USING ((auth.uid())::text = user_id);


-- ----------------------------------------------------------
-- 10. video_templates (mixed: system rows readable, user rows owned)
--     No anon access. System rows readable by authenticated only.
-- ----------------------------------------------------------

CREATE POLICY "Authenticated can read system templates"
  ON video_templates FOR SELECT
  TO authenticated
  USING (is_system = true);

CREATE POLICY "Owner can read own templates"
  ON video_templates FOR SELECT
  TO authenticated
  USING ((auth.uid())::text = user_id AND is_system = false);

CREATE POLICY "Owner can create own templates"
  ON video_templates FOR INSERT
  TO authenticated
  WITH CHECK ((auth.uid())::text = user_id AND is_system = false);

CREATE POLICY "Owner can update own templates"
  ON video_templates FOR UPDATE
  TO authenticated
  USING ((auth.uid())::text = user_id AND is_system = false)
  WITH CHECK ((auth.uid())::text = user_id AND is_system = false);

CREATE POLICY "Owner can delete own templates"
  ON video_templates FOR DELETE
  TO authenticated
  USING ((auth.uid())::text = user_id AND is_system = false);


-- ----------------------------------------------------------
-- 11. prompt_fragments (mixed: system rows user_id IS NULL, user rows owned)
--     No anon access.
-- ----------------------------------------------------------

CREATE POLICY "Authenticated can read system fragments"
  ON prompt_fragments FOR SELECT
  TO authenticated
  USING (user_id IS NULL);

CREATE POLICY "Owner can read own fragments"
  ON prompt_fragments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Owner can create own fragments"
  ON prompt_fragments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner can update own fragments"
  ON prompt_fragments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner can delete own fragments"
  ON prompt_fragments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);


-- ----------------------------------------------------------
-- 12. prompt_templates (mixed: system rows user_id IS NULL, user rows owned)
--     No anon access.
-- ----------------------------------------------------------

CREATE POLICY "Authenticated can read system prompt templates"
  ON prompt_templates FOR SELECT
  TO authenticated
  USING (user_id IS NULL);

CREATE POLICY "Owner can read own prompt templates"
  ON prompt_templates FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Owner can create own prompt templates"
  ON prompt_templates FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner can update own prompt templates"
  ON prompt_templates FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner can delete own prompt templates"
  ON prompt_templates FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);


-- ----------------------------------------------------------
-- 13. system_prompts (mixed: system rows user_id IS NULL, user rows owned)
--     No anon access.
-- ----------------------------------------------------------

CREATE POLICY "Authenticated can read system-level prompts"
  ON system_prompts FOR SELECT
  TO authenticated
  USING (user_id IS NULL);

CREATE POLICY "Owner can read own system prompts"
  ON system_prompts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Owner can create own system prompts"
  ON system_prompts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner can update own system prompts"
  ON system_prompts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner can delete own system prompts"
  ON system_prompts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);


-- ----------------------------------------------------------
-- 14. prompt_generation_logs (user_id = auth.uid())
-- ----------------------------------------------------------

CREATE POLICY "Owner can read own prompt logs"
  ON prompt_generation_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Owner can create own prompt logs"
  ON prompt_generation_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);


-- ----------------------------------------------------------
-- 15. question_bank (shared read-only, no user column)
--     Authenticated read only. No write access from client.
-- ----------------------------------------------------------

CREATE POLICY "Authenticated can read questions"
  ON question_bank FOR SELECT
  TO authenticated
  USING (true);


-- ----------------------------------------------------------
-- 16. music_tracks (shared read-only, system flag)
-- ----------------------------------------------------------

CREATE POLICY "Authenticated can read system tracks"
  ON music_tracks FOR SELECT
  TO authenticated
  USING (is_system = true);


-- ----------------------------------------------------------
-- 17. sound_effects (shared read-only, system flag)
-- ----------------------------------------------------------

CREATE POLICY "Authenticated can read system effects"
  ON sound_effects FOR SELECT
  TO authenticated
  USING (is_system = true);


-- ============================================================
-- STEP 3: Performance indexes for RLS subqueries
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_episodes_id_user_id
  ON episodes (id, user_id);

CREATE INDEX IF NOT EXISTS idx_compilations_id_user_id
  ON compilations (id, user_id);

CREATE INDEX IF NOT EXISTS idx_clips_id_user_id
  ON clips (id, user_id);
