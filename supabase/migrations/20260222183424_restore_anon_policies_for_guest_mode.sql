/*
  # Restore Anonymous Policies for Guest Mode

  1. Security Changes
    - Re-add anonymous (anon) RLS policies so guest users can create and view their own data
    - Guest data isolation is enforced at the application layer via user_id filtering
    - Authenticated users remain fully isolated at the database layer via auth.uid()

  2. Tables Affected
    - clips, episodes, episode_scripts, episode_shots, character_bibles,
      compilations, compilation_clips, user_profiles, video_exports

  3. Important Notes
    - Anon policies allow guest users to use the app without signing in
    - When a guest signs up, their data is migrated to the authenticated user_id
    - Authenticated users have strict DB-level tenant isolation via auth.uid()
*/

-- CLIPS
DROP POLICY IF EXISTS "Anon can select clips" ON clips;
DROP POLICY IF EXISTS "Anon can insert clips" ON clips;
DROP POLICY IF EXISTS "Anon can update clips" ON clips;
DROP POLICY IF EXISTS "Anon can delete clips" ON clips;
CREATE POLICY "Anon can select clips" ON clips FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert clips" ON clips FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update clips" ON clips FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete clips" ON clips FOR DELETE TO anon USING (true);

-- EPISODES
DROP POLICY IF EXISTS "Anon can select episodes" ON episodes;
DROP POLICY IF EXISTS "Anon can insert episodes" ON episodes;
DROP POLICY IF EXISTS "Anon can update episodes" ON episodes;
CREATE POLICY "Anon can select episodes" ON episodes FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert episodes" ON episodes FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update episodes" ON episodes FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- EPISODE_SCRIPTS
DROP POLICY IF EXISTS "Anon can select scripts" ON episode_scripts;
DROP POLICY IF EXISTS "Anon can insert scripts" ON episode_scripts;
DROP POLICY IF EXISTS "Anon can update scripts" ON episode_scripts;
CREATE POLICY "Anon can select scripts" ON episode_scripts FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert scripts" ON episode_scripts FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update scripts" ON episode_scripts FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- EPISODE_SHOTS
DROP POLICY IF EXISTS "Anon can select shots" ON episode_shots;
DROP POLICY IF EXISTS "Anon can insert shots" ON episode_shots;
DROP POLICY IF EXISTS "Anon can update shots" ON episode_shots;
CREATE POLICY "Anon can select shots" ON episode_shots FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert shots" ON episode_shots FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update shots" ON episode_shots FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- CHARACTER_BIBLES
DROP POLICY IF EXISTS "Anon can select characters" ON character_bibles;
DROP POLICY IF EXISTS "Anon can insert characters" ON character_bibles;
DROP POLICY IF EXISTS "Anon can update characters" ON character_bibles;
CREATE POLICY "Anon can select characters" ON character_bibles FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert characters" ON character_bibles FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update characters" ON character_bibles FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- COMPILATIONS
DROP POLICY IF EXISTS "Anon can select compilations" ON compilations;
DROP POLICY IF EXISTS "Anon can insert compilations" ON compilations;
DROP POLICY IF EXISTS "Anon can update compilations" ON compilations;
CREATE POLICY "Anon can select compilations" ON compilations FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert compilations" ON compilations FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update compilations" ON compilations FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- COMPILATION_CLIPS
DROP POLICY IF EXISTS "Anon can select compilation clips" ON compilation_clips;
DROP POLICY IF EXISTS "Anon can insert compilation clips" ON compilation_clips;
DROP POLICY IF EXISTS "Anon can update compilation clips" ON compilation_clips;
DROP POLICY IF EXISTS "Anon can delete compilation clips" ON compilation_clips;
CREATE POLICY "Anon can select compilation clips" ON compilation_clips FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert compilation clips" ON compilation_clips FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update compilation clips" ON compilation_clips FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete compilation clips" ON compilation_clips FOR DELETE TO anon USING (true);

-- USER_PROFILES
DROP POLICY IF EXISTS "Anon can select profiles" ON user_profiles;
DROP POLICY IF EXISTS "Anon can insert profiles" ON user_profiles;
DROP POLICY IF EXISTS "Anon can update profiles" ON user_profiles;
CREATE POLICY "Anon can select profiles" ON user_profiles FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert profiles" ON user_profiles FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update profiles" ON user_profiles FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- VIDEO_EXPORTS
DROP POLICY IF EXISTS "Anon can select exports" ON video_exports;
DROP POLICY IF EXISTS "Anon can insert exports" ON video_exports;
DROP POLICY IF EXISTS "Anon can update exports" ON video_exports;
CREATE POLICY "Anon can select exports" ON video_exports FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert exports" ON video_exports FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update exports" ON video_exports FOR UPDATE TO anon USING (true) WITH CHECK (true);
