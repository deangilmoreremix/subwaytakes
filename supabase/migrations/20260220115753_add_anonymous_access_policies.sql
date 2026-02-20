/*
  # Add Anonymous Access Policies

  1. Changes
    - Add anonymous (anon) role policies to tables that previously required authentication
    - This enables guest mode access without requiring sign-in
    - Tables updated: user_profiles, token_balances, token_transactions,
      viral_scores, clip_rerolls, subscriptions, video_exports, media_assets, video_templates

  2. Security
    - Anon policies use permissive access for guest/development usage
    - Authenticated user policies remain unchanged for when auth is re-enabled
    - RLS remains enabled on all tables

  3. Notes
    - These policies can be tightened or removed when authentication is re-activated
    - Existing authenticated-user policies are preserved
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Anon users can view profiles' AND tablename = 'user_profiles'
  ) THEN
    CREATE POLICY "Anon users can view profiles" ON user_profiles FOR SELECT TO anon USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Anon users can insert profiles' AND tablename = 'user_profiles'
  ) THEN
    CREATE POLICY "Anon users can insert profiles" ON user_profiles FOR INSERT TO anon WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Anon users can update profiles' AND tablename = 'user_profiles'
  ) THEN
    CREATE POLICY "Anon users can update profiles" ON user_profiles FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'token_balances') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon users can view token balances' AND tablename = 'token_balances') THEN
      CREATE POLICY "Anon users can view token balances" ON token_balances FOR SELECT TO anon USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon users can update token balances' AND tablename = 'token_balances') THEN
      CREATE POLICY "Anon users can update token balances" ON token_balances FOR UPDATE TO anon USING (true) WITH CHECK (true);
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'token_transactions') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon users can view token transactions' AND tablename = 'token_transactions') THEN
      CREATE POLICY "Anon users can view token transactions" ON token_transactions FOR SELECT TO anon USING (true);
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'viral_scores') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon users can view viral scores' AND tablename = 'viral_scores') THEN
      CREATE POLICY "Anon users can view viral scores" ON viral_scores FOR SELECT TO anon USING (true);
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'clip_rerolls') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon users can view clip rerolls' AND tablename = 'clip_rerolls') THEN
      CREATE POLICY "Anon users can view clip rerolls" ON clip_rerolls FOR SELECT TO anon USING (true);
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscriptions') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon users can view subscriptions' AND tablename = 'subscriptions') THEN
      CREATE POLICY "Anon users can view subscriptions" ON subscriptions FOR SELECT TO anon USING (true);
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'video_exports') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon users can view video exports' AND tablename = 'video_exports') THEN
      CREATE POLICY "Anon users can view video exports" ON video_exports FOR SELECT TO anon USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon users can insert video exports' AND tablename = 'video_exports') THEN
      CREATE POLICY "Anon users can insert video exports" ON video_exports FOR INSERT TO anon WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon users can update video exports' AND tablename = 'video_exports') THEN
      CREATE POLICY "Anon users can update video exports" ON video_exports FOR UPDATE TO anon USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon users can delete video exports' AND tablename = 'video_exports') THEN
      CREATE POLICY "Anon users can delete video exports" ON video_exports FOR DELETE TO anon USING (true);
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'media_assets') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon users can view media assets' AND tablename = 'media_assets') THEN
      CREATE POLICY "Anon users can view media assets" ON media_assets FOR SELECT TO anon USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon users can insert media assets' AND tablename = 'media_assets') THEN
      CREATE POLICY "Anon users can insert media assets" ON media_assets FOR INSERT TO anon WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon users can update media assets' AND tablename = 'media_assets') THEN
      CREATE POLICY "Anon users can update media assets" ON media_assets FOR UPDATE TO anon USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon users can delete media assets' AND tablename = 'media_assets') THEN
      CREATE POLICY "Anon users can delete media assets" ON media_assets FOR DELETE TO anon USING (true);
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'video_templates') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon users can insert video templates' AND tablename = 'video_templates') THEN
      CREATE POLICY "Anon users can insert video templates" ON video_templates FOR INSERT TO anon WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon users can update video templates' AND tablename = 'video_templates') THEN
      CREATE POLICY "Anon users can update video templates" ON video_templates FOR UPDATE TO anon USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon users can delete video templates' AND tablename = 'video_templates') THEN
      CREATE POLICY "Anon users can delete video templates" ON video_templates FOR DELETE TO anon USING (true);
    END IF;
  END IF;
END $$;
