-- =====================================================================
-- 00_substrate.sql — mock Supabase substrate for local validation of
-- supabase/migrations/20261011090000_studio_projects_and_render_jobs.sql
--
-- Applied FIRST, as postgres, to a scratch database. Reproduces the
-- parts of a Supabase project that the Studio migration depends on:
--   * auth schema  (auth.users table + auth.uid())
--   * storage schema (buckets / objects / foldername())
--   * Supabase-like roles anon / authenticated / service_role
--   * Supabase-like default grants (BEFORE the target migration, so its
--     REVOKEs run against a genuinely granted state)
--   * DECOY shared functions under generic names, with deliberately
--     different behavior, to prove the corrected migration does not
--     overwrite them:
--       public.update_updated_at_column()  -> sets updated_at = '1999-01-01'
--       public.immutable_user_id()         -> no-op (RETURN NEW)
--   * two seed users in auth.users
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Roles (Supabase built-ins)
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END
$$;

-- ---------------------------------------------------------------------
-- 1. auth schema (created before storage so FKs from later objects work)
-- ---------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY,
  email text,
  is_anonymous boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- auth.uid() implemented the real Supabase way: read the `sub` claim of
-- request.jwt.claims (NULL when unset).
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid;
$$;

-- ---------------------------------------------------------------------
-- 2. storage schema
-- ---------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS storage;

CREATE TABLE IF NOT EXISTS storage.buckets (
  id text PRIMARY KEY,
  name text,
  public boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text,
  name text,
  owner uuid
);

-- storage.foldername(name) -> text[] (path segments), Supabase-style.
CREATE OR REPLACE FUNCTION storage.foldername(name text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE STRICT
AS $$
  SELECT string_to_array(name, '/');
$$;

-- storage.objects carries RLS in every real Supabase project (the
-- platform's own policies live here too). Enable it so the migration's
-- storage.objects policies are actually exercised.
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 3. DECOY shared functions (generic names, foreign behavior)
--    The corrected migration MUST NOT overwrite these. After the
--    migration, both must be byte-identical to what is created here.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := '1999-01-01'::timestamptz; -- SENTINEL: decoy behavior
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.immutable_user_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- SENTINEL: decoy no-op — does NOT reject user_id changes
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------
-- 4. Supabase-like grants
--    Explicit grants cover the tables created above; default privileges
--    make every table the target migration creates later inherit the
--    same grants, exactly like a real Supabase project (this is why
--    PostgREST works against freshly created tables there).
--    Applied BEFORE the target migration so that its REVOKEs run
--    against a genuinely granted state.
-- ---------------------------------------------------------------------
GRANT USAGE ON SCHEMA public, auth, storage TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public, auth, storage TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public, auth, storage TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public, auth, storage
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public, auth, storage
  GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public, auth, storage
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 5. Seed users (SECOND: user A; THIRD: user B)
-- ---------------------------------------------------------------------
INSERT INTO auth.users (id, email, is_anonymous)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'user-a@subwaytakes.test', true),
  ('22222222-2222-2222-2222-222222222222', 'user-b@subwaytakes.test', true)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 6. An "existing app table" (pre-migration shared-DB state) used to
--    prove the migration leaves other tables untouched.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.legacy_clips (     -- deliberately a shared/generic name
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.legacy_clips (user_id) VALUES ('11111111-1111-1111-1111-111111111111');

\echo 'substrate applied'
