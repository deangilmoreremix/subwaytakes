/*
  # Drop all overly permissive anonymous RLS policies

  1. Security Changes
    - Drops 28 anon-role policies that use USING(true) / WITH CHECK(true) across 9 tables
    - These policies allowed any unauthenticated request to read, insert, update, or delete data
    - After this migration, only authenticated users (including anonymous auth users via signInAnonymously) can access these tables
    - Existing authenticated-role policies already enforce proper ownership checks (auth.uid() = user_id)

  2. Affected Tables
    - clips: DROP 4 anon policies (SELECT, INSERT, UPDATE, DELETE)
    - episodes: DROP 3 anon policies (SELECT, INSERT, UPDATE)
    - episode_scripts: DROP 3 anon policies (SELECT, INSERT, UPDATE)
    - episode_shots: DROP 3 anon policies (SELECT, INSERT, UPDATE)
    - character_bibles: DROP 3 anon policies (SELECT, INSERT, UPDATE)
    - compilations: DROP 3 anon policies (SELECT, INSERT, UPDATE)
    - compilation_clips: DROP 4 anon policies (SELECT, INSERT, UPDATE, DELETE)
    - user_profiles: DROP 3 anon policies (SELECT, INSERT, UPDATE)
    - video_exports: DROP 3 anon policies (SELECT, INSERT, UPDATE)

  3. Important Notes
    - Guest mode must now use supabase.auth.signInAnonymously() which grants the authenticated role
    - System-scoped anon read policies on prompt_templates, prompt_fragments, system_prompts, and video_templates are NOT affected (they have proper WHERE clauses)
    - No data is lost; only access control is tightened
*/

-- clips: remove all 4 anon policies
DROP POLICY IF EXISTS "Anon can select clips" ON clips;
DROP POLICY IF EXISTS "Anon can insert clips" ON clips;
DROP POLICY IF EXISTS "Anon can update clips" ON clips;
DROP POLICY IF EXISTS "Anon can delete clips" ON clips;

-- episodes: remove 3 anon policies
DROP POLICY IF EXISTS "Anon can select episodes" ON episodes;
DROP POLICY IF EXISTS "Anon can insert episodes" ON episodes;
DROP POLICY IF EXISTS "Anon can update episodes" ON episodes;

-- episode_scripts: remove 3 anon policies
DROP POLICY IF EXISTS "Anon can select scripts" ON episode_scripts;
DROP POLICY IF EXISTS "Anon can insert scripts" ON episode_scripts;
DROP POLICY IF EXISTS "Anon can update scripts" ON episode_scripts;

-- episode_shots: remove 3 anon policies
DROP POLICY IF EXISTS "Anon can select shots" ON episode_shots;
DROP POLICY IF EXISTS "Anon can insert shots" ON episode_shots;
DROP POLICY IF EXISTS "Anon can update shots" ON episode_shots;

-- character_bibles: remove 3 anon policies
DROP POLICY IF EXISTS "Anon can select characters" ON character_bibles;
DROP POLICY IF EXISTS "Anon can insert characters" ON character_bibles;
DROP POLICY IF EXISTS "Anon can update characters" ON character_bibles;

-- compilations: remove 3 anon policies
DROP POLICY IF EXISTS "Anon can select compilations" ON compilations;
DROP POLICY IF EXISTS "Anon can insert compilations" ON compilations;
DROP POLICY IF EXISTS "Anon can update compilations" ON compilations;

-- compilation_clips: remove 4 anon policies
DROP POLICY IF EXISTS "Anon can select compilation clips" ON compilation_clips;
DROP POLICY IF EXISTS "Anon can insert compilation clips" ON compilation_clips;
DROP POLICY IF EXISTS "Anon can update compilation clips" ON compilation_clips;
DROP POLICY IF EXISTS "Anon can delete compilation clips" ON compilation_clips;

-- user_profiles: remove 3 anon policies
DROP POLICY IF EXISTS "Anon can select profiles" ON user_profiles;
DROP POLICY IF EXISTS "Anon can insert profiles" ON user_profiles;
DROP POLICY IF EXISTS "Anon can update profiles" ON user_profiles;

-- video_exports: remove 3 anon policies
DROP POLICY IF EXISTS "Anon can select exports" ON video_exports;
DROP POLICY IF EXISTS "Anon can insert exports" ON video_exports;
DROP POLICY IF EXISTS "Anon can update exports" ON video_exports;
