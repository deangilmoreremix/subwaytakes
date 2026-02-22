/*
  # Tighten RLS for Multi-Tenancy

  1. Security Changes
    - Remove all wide-open anonymous policies (USING true / WITH CHECK true) that allowed
      any unauthenticated user to read/write all data across tenants
    - Replace with restrictive anonymous policies that filter by user_id header or deny access
    - Add missing DELETE policy for authenticated users on `clips` table
    - Ensure every table enforces tenant isolation via auth.uid()

  2. Tables Affected
    - `clips` - remove anon open policies, add auth delete
    - `episodes` - remove anon open policies
    - `episode_scripts` - remove anon open policies
    - `episode_shots` - remove anon open policies
    - `character_bibles` - remove anon open policies
    - `compilations` - remove anon open policies
    - `compilation_clips` - remove anon open policies
    - `user_profiles` - remove anon open policies
    - `video_exports` - remove anon open policies

  3. Important Notes
    - After this migration, anonymous (guest) users will NOT be able to read/write data
    - Users must sign in to create, view, or manage their content
    - Guest mode in the UI remains for exploration, but data persistence requires authentication
    - Authenticated users can only access their own data (tenant isolation enforced at DB level)
*/

-- ============================================================
-- CLIPS: Remove open anon policies, add delete for authenticated
-- ============================================================
DROP POLICY IF EXISTS "Anonymous users can insert clips" ON clips;
DROP POLICY IF EXISTS "Anonymous users can update their clips" ON clips;
DROP POLICY IF EXISTS "Anonymous users can view their clips by user_id" ON clips;

CREATE POLICY "Authenticated users can delete own clips"
  ON clips FOR DELETE
  TO authenticated
  USING ((auth.uid())::text = user_id);

-- ============================================================
-- EPISODES: Remove open anon policies
-- ============================================================
DROP POLICY IF EXISTS "Anon users can insert episodes" ON episodes;
DROP POLICY IF EXISTS "Anon users can update episodes" ON episodes;
DROP POLICY IF EXISTS "Anon users can view own episodes" ON episodes;

-- ============================================================
-- EPISODE_SCRIPTS: Remove open anon policies
-- ============================================================
DROP POLICY IF EXISTS "Anon users can insert scripts" ON episode_scripts;
DROP POLICY IF EXISTS "Anon users can update scripts" ON episode_scripts;
DROP POLICY IF EXISTS "Anon users can view own scripts" ON episode_scripts;

-- ============================================================
-- EPISODE_SHOTS: Remove open anon policies
-- ============================================================
DROP POLICY IF EXISTS "Anon users can insert shots" ON episode_shots;
DROP POLICY IF EXISTS "Anon users can update shots" ON episode_shots;
DROP POLICY IF EXISTS "Anon users can view shots" ON episode_shots;

-- ============================================================
-- CHARACTER_BIBLES: Remove open anon policies
-- ============================================================
DROP POLICY IF EXISTS "Anon users can insert characters" ON character_bibles;
DROP POLICY IF EXISTS "Anon users can update characters" ON character_bibles;
DROP POLICY IF EXISTS "Anon users can view own characters" ON character_bibles;

-- ============================================================
-- COMPILATIONS: Remove open anon policies
-- ============================================================
DROP POLICY IF EXISTS "Anon users can insert compilations" ON compilations;
DROP POLICY IF EXISTS "Anon users can read compilations" ON compilations;
DROP POLICY IF EXISTS "Anon users can update compilations" ON compilations;

-- ============================================================
-- COMPILATION_CLIPS: Remove open anon policies
-- ============================================================
DROP POLICY IF EXISTS "Anon users can insert compilation clips" ON compilation_clips;
DROP POLICY IF EXISTS "Anon users can read compilation clips" ON compilation_clips;
DROP POLICY IF EXISTS "Anon users can update compilation clips" ON compilation_clips;
DROP POLICY IF EXISTS "Anon users can delete compilation clips" ON compilation_clips;

-- ============================================================
-- USER_PROFILES: Remove open anon policies
-- ============================================================
DROP POLICY IF EXISTS "Anon users can insert profiles" ON user_profiles;
DROP POLICY IF EXISTS "Anon users can update profiles" ON user_profiles;
DROP POLICY IF EXISTS "Anon users can view profiles" ON user_profiles;

-- ============================================================
-- VIDEO_EXPORTS: Remove open anon policies
-- ============================================================
DROP POLICY IF EXISTS "Anon users can insert video exports" ON video_exports;
DROP POLICY IF EXISTS "Anon users can update video exports" ON video_exports;
DROP POLICY IF EXISTS "Anon users can view video exports" ON video_exports;
