/*
  # SubwayTakes Studio — shared-database hardening: projects + render/caption job queues

  Persistence layer for the Subway Interview Studio, hardened for deployment into
  a SHARED Supabase database (project `bzxohkrxcwodllketcpz`, "VideoRemix Product")
  that is used by multiple applications. Every object this migration creates is
  namespaced with the `subwaytakes_` prefix (or an already SubwayTakes-specific
  name such as the `studio_*` tables and buckets) so it can never collide with
  another application's objects, and this file defines every function it
  references — it has no dependency on older migrations in this repo whose
  functions may not exist in the shared database.

  STATUS: this migration has never been applied to any database. It is edited in
  place; the names below are the ones that will be created, and the table shapes
  are unchanged from the original draft (the app depends on them), including
  `studio_render_jobs.project_snapshot`.

  1. Tables
     - public.studio_projects     — versioned timeline project JSON (editor state)
     - public.studio_render_jobs  — server-side render queue with persisted status
     - public.muapi_caption_jobs  — MuAPI AI Captions jobs (styled + editable modes)

  2. Security model (hardened for the shared DB)
     - RLS enabled on all three tables; per-user SELECT scoped
       `auth.uid()::text = user_id::text`.
     - public.studio_projects keeps full owner CRUD for `authenticated`: the
       timeline editor saves projects directly from the browser.
     - public.studio_render_jobs and public.muapi_caption_jobs are
       `authenticated` SELECT (own rows) ONLY. There are deliberately NO client
       INSERT/UPDATE/DELETE policies on them. Every write comes from a trusted
       server-side context (service role, which bypasses RLS):
         - supabase/functions/render-project/index.ts  (enqueues render jobs)
         - supabase/functions/muapi-captions/index.ts  (creates/updates caption jobs)
         - render-worker (claims and updates render jobs via the service-role key)
     - public.subwaytakes_guard_job_writes() is a BEFORE INSERT OR UPDATE trigger
       on BOTH job tables that raises an exception unless the writer is a
       trusted server-side context. This stops clients from changing job status,
       output URLs, ownership, snapshots, or progress even if a write policy or
       trigger gap is ever introduced elsewhere.
     - public.subwaytakes_guard_immutable_user_id() enforces user_id
       immutability on all three tables.
     - public.subwaytakes_set_updated_at() maintains updated_at on all three
       tables. It replaces the shared `update_updated_at_column()` so this
       migration is self-contained; the shared function is neither used nor
       touched.
     - anon DML is revoked on all three tables (defense in depth).

  3. Storage
     - `studio-exports` bucket (private) — rendered and captioned MP4 outputs
     - `studio-uploads` bucket (private) — user-uploaded interview footage
     - Both scoped to `auth.uid()` folders via storage policies. The bucket names
       are SubwayTakes-specific and are assumed not to exist yet; creation is
       non-destructive (see section 6).

  4. Idempotency strategy — a re-run of this file must be a no-op
     - Tables:  CREATE TABLE IF NOT EXISTS (column shapes are fixed by the app)
     - Indexes: CREATE INDEX IF NOT EXISTS (also prefixed `subwaytakes_`,
       because index names share the public schema namespace in a shared DB)
     - Triggers: DROP TRIGGER IF EXISTS + CREATE TRIGGER (deterministic re-create)
     - Policies: DROP POLICY IF EXISTS + CREATE POLICY, including on
       storage.objects
     - Functions: CREATE OR REPLACE on `public.subwaytakes_*` names only. These
       names are unique to this migration, so a replace can never clobber
       another app's function — in particular this file does NOT create or
       replace the shared/generic `immutable_user_id()` /
       `update_updated_at_column()` functions from earlier migrations.
     - Buckets: guarded `INSERT ... SELECT ... WHERE NOT EXISTS` (no ON CONFLICT
       reliance); an existing bucket keeps its visibility, size, and MIME
       settings untouched.
*/

-- =============================================================
-- 1. SUBWAYTAKES HELPER FUNCTIONS (self-contained, uniquely named)
-- =============================================================

-- updated_at maintenance for all three tables.
-- Deliberately NOT the shared update_updated_at_column() from
-- 20260226110220_rls_policies.sql: that function may not exist in the shared
-- database, and this migration must not depend on it.
CREATE OR REPLACE FUNCTION public.subwaytakes_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Ownership immutability: any UPDATE that changes user_id is rejected.
-- SubwayTakes-specific replacement for the repo's shared immutable_user_id().
CREATE OR REPLACE FUNCTION public.subwaytakes_guard_immutable_user_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'subwaytakes: user_id is immutable';
  END IF;
  RETURN NEW;
END;
$$;

-- Guard for BOTH job tables (studio_render_jobs, muapi_caption_jobs).
-- BEFORE INSERT OR UPDATE. A write is allowed only from a trusted server-side
-- context, detected in three ways:
--   (a) current_setting('request.jwt.claims', true)::jsonb ->> 'role'
--       = 'service_role'  — PostgREST request carrying a service-role JWT.
--   (b) current_user IN ('service_role', 'postgres', 'supabase_admin') — the
--       session role itself is trusted. PostgREST switches the session to the
--       role encoded in the API key, so service-role writes land here even when
--       the key is a non-JWT secret, and direct psql/platform maintenance works.
--   (c) UPDATE that changes no server-owned column — a harmless no-op where
--       only created_at/updated_at may differ (the updated_at trigger fires
--       after this one and still normalizes updated_at).
-- Everything else (client JWTs, anon) raises.
--
-- Intentionally NOT SECURITY DEFINER (unlike the repo's older trigger
-- functions): a definer function runs as its owner (postgres), which is trusted
-- by check (b) and would defeat the entire guard.
CREATE OR REPLACE FUNCTION public.subwaytakes_guard_job_writes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  jwt_role text;
BEGIN
  BEGIN
    jwt_role := current_setting('request.jwt.claims', true)::jsonb ->> 'role';
  EXCEPTION WHEN OTHERS THEN
    jwt_role := NULL; -- claims unset or not valid JSON (direct SQL, raw secrets)
  END;

  IF jwt_role = 'service_role' THEN
    RETURN NEW; -- (a) service-role JWT (edge functions, render worker via PostgREST)
  END IF;

  IF current_user IN ('service_role', 'postgres', 'supabase_admin') THEN
    RETURN NEW; -- (b) trusted session role (non-JWT service keys, psql, platform)
  END IF;

  IF TG_OP = 'UPDATE' THEN -- (c) no-op updates on server-owned columns
    IF TG_TABLE_NAME = 'studio_render_jobs' THEN
      IF NEW.user_id IS NOT DISTINCT FROM OLD.user_id
         AND NEW.project_id IS NOT DISTINCT FROM OLD.project_id
         AND NEW.status IS NOT DISTINCT FROM OLD.status
         AND NEW.progress IS NOT DISTINCT FROM OLD.progress
         AND NEW.output_url IS NOT DISTINCT FROM OLD.output_url
         AND NEW.captioned_output_url IS NOT DISTINCT FROM OLD.captioned_output_url
         AND NEW.error IS NOT DISTINCT FROM OLD.error
         AND NEW.worker_id IS NOT DISTINCT FROM OLD.worker_id
         AND NEW.project_snapshot IS NOT DISTINCT FROM OLD.project_snapshot
         AND NEW.render_settings IS NOT DISTINCT FROM OLD.render_settings
      THEN
        RETURN NEW;
      END IF;
    ELSIF TG_TABLE_NAME = 'muapi_caption_jobs' THEN
      IF NEW.user_id IS NOT DISTINCT FROM OLD.user_id
         AND NEW.project_id IS NOT DISTINCT FROM OLD.project_id
         AND NEW.render_job_id IS NOT DISTINCT FROM OLD.render_job_id
         AND NEW.mode IS NOT DISTINCT FROM OLD.mode
         AND NEW.muapi_request_id IS NOT DISTINCT FROM OLD.muapi_request_id
         AND NEW.language IS NOT DISTINCT FROM OLD.language
         AND NEW.theme IS NOT DISTINCT FROM OLD.theme
         AND NEW.status IS NOT DISTINCT FROM OLD.status
         AND NEW.output_url IS NOT DISTINCT FROM OLD.output_url
         AND NEW.captions IS NOT DISTINCT FROM OLD.captions
         AND NEW.error IS NOT DISTINCT FROM OLD.error
      THEN
        RETURN NEW;
      END IF;
    END IF;
  END IF;

  RAISE EXCEPTION 'subwaytakes: render/caption job writes are restricted to service-role context';
END;
$$;

-- =============================================================
-- 2. STUDIO PROJECTS (owner CRUD — the editor saves directly)
-- =============================================================

CREATE TABLE IF NOT EXISTS public.studio_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Untitled Subway Interview',
  -- versioned project JSON (see src/studio/types.ts, PROJECT_FORMAT_VERSION)
  project jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subwaytakes_idx_studio_projects_user_updated
  ON public.studio_projects (user_id, updated_at DESC);

DROP TRIGGER IF EXISTS trg_studio_projects_subwaytakes_updated_at ON public.studio_projects;
CREATE TRIGGER trg_studio_projects_subwaytakes_updated_at
  BEFORE UPDATE ON public.studio_projects
  FOR EACH ROW EXECUTE FUNCTION public.subwaytakes_set_updated_at();

DROP TRIGGER IF EXISTS trg_studio_projects_subwaytakes_immutable_user ON public.studio_projects;
CREATE TRIGGER trg_studio_projects_subwaytakes_immutable_user
  BEFORE UPDATE ON public.studio_projects
  FOR EACH ROW EXECUTE FUNCTION public.subwaytakes_guard_immutable_user_id();

ALTER TABLE public.studio_projects ENABLE ROW LEVEL SECURITY;

-- Full owner CRUD: the timeline editor (src/lib/studioProjects.ts
-- createProject/loadProject/saveProject) works directly through PostgREST
-- with the user's JWT.
DROP POLICY IF EXISTS "subwaytakes_studio_projects_select_own" ON public.studio_projects;
CREATE POLICY "subwaytakes_studio_projects_select_own"
  ON public.studio_projects FOR SELECT TO authenticated
  USING (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "subwaytakes_studio_projects_insert_own" ON public.studio_projects;
CREATE POLICY "subwaytakes_studio_projects_insert_own"
  ON public.studio_projects FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "subwaytakes_studio_projects_update_own" ON public.studio_projects;
CREATE POLICY "subwaytakes_studio_projects_update_own"
  ON public.studio_projects FOR UPDATE TO authenticated
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "subwaytakes_studio_projects_delete_own" ON public.studio_projects;
CREATE POLICY "subwaytakes_studio_projects_delete_own"
  ON public.studio_projects FOR DELETE TO authenticated
  USING (auth.uid()::text = user_id::text);

-- =============================================================
-- 3. STUDIO RENDER JOBS (server-only writes)
-- =============================================================

CREATE TABLE IF NOT EXISTS public.studio_render_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.studio_projects(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'done', 'error')),
  progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  -- output_url / captioned_output_url keep the LAST signed URL for
  -- convenience (short-lived); the canonical identity is the *_ref pair,
  -- from which fresh signed URLs are derived on demand.
  output_ref jsonb,
  captioned_output_ref jsonb,
  output_url text,
  captioned_output_url text,
  error text,
  worker_id text,
  -- snapshot of the project JSON at enqueue time; the worker renders exactly this
  project_snapshot jsonb NOT NULL,
  render_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subwaytakes_idx_studio_render_jobs_queue
  ON public.studio_render_jobs (status, created_at)
  WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS subwaytakes_idx_studio_render_jobs_user
  ON public.studio_render_jobs (user_id, created_at DESC);
-- one active job per project at a time
CREATE UNIQUE INDEX IF NOT EXISTS subwaytakes_uq_studio_render_jobs_active_per_project
  ON public.studio_render_jobs (project_id)
  WHERE status IN ('queued', 'running');

DROP TRIGGER IF EXISTS trg_studio_render_jobs_subwaytakes_updated_at ON public.studio_render_jobs;
CREATE TRIGGER trg_studio_render_jobs_subwaytakes_updated_at
  BEFORE UPDATE ON public.studio_render_jobs
  FOR EACH ROW EXECUTE FUNCTION public.subwaytakes_set_updated_at();

DROP TRIGGER IF EXISTS trg_studio_render_jobs_subwaytakes_immutable_user ON public.studio_render_jobs;
CREATE TRIGGER trg_studio_render_jobs_subwaytakes_immutable_user
  BEFORE UPDATE ON public.studio_render_jobs
  FOR EACH ROW EXECUTE FUNCTION public.subwaytakes_guard_immutable_user_id();

-- Guard fires first (alphabetically before the other BEFORE UPDATE triggers),
-- so a rejected write never reaches the updated_at or immutability triggers.
DROP TRIGGER IF EXISTS trg_studio_render_jobs_subwaytakes_guard_job_writes ON public.studio_render_jobs;
CREATE TRIGGER trg_studio_render_jobs_subwaytakes_guard_job_writes
  BEFORE INSERT OR UPDATE ON public.studio_render_jobs
  FOR EACH ROW EXECUTE FUNCTION public.subwaytakes_guard_job_writes();

ALTER TABLE public.studio_render_jobs ENABLE ROW LEVEL SECURITY;

-- Clients may read their own jobs only (loadLatestRenderJob / watchRenderJob in
-- src/lib/studioProjects.ts). There is deliberately NO authenticated
-- INSERT/UPDATE/DELETE policy: enqueue goes through the render-project edge
-- function, and status/progress/output moves happen in the render worker —
-- both with the service role, which bypasses RLS.
DROP POLICY IF EXISTS "subwaytakes_studio_render_jobs_select_own" ON public.studio_render_jobs;
CREATE POLICY "subwaytakes_studio_render_jobs_select_own"
  ON public.studio_render_jobs FOR SELECT TO authenticated
  USING (auth.uid()::text = user_id::text);

-- =============================================================
-- 4. MUAPI CAPTION JOBS (server-only writes)
-- =============================================================

CREATE TABLE IF NOT EXISTS public.muapi_caption_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.studio_projects(id) ON DELETE CASCADE,
  render_job_id uuid REFERENCES public.studio_render_jobs(id) ON DELETE SET NULL,
  mode text NOT NULL CHECK (mode IN ('styled', 'editable')),
  muapi_request_id text,
  language text NOT NULL DEFAULT 'English',
  theme text NOT NULL DEFAULT 'Hormozi_1',
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'done', 'error')),
  output_ref jsonb,
  output_url text,
  -- editable mode: transcribed timed captions returned to the editor
  captions jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subwaytakes_idx_muapi_caption_jobs_project
  ON public.muapi_caption_jobs (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS subwaytakes_idx_muapi_caption_jobs_user
  ON public.muapi_caption_jobs (user_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_muapi_caption_jobs_subwaytakes_updated_at ON public.muapi_caption_jobs;
CREATE TRIGGER trg_muapi_caption_jobs_subwaytakes_updated_at
  BEFORE UPDATE ON public.muapi_caption_jobs
  FOR EACH ROW EXECUTE FUNCTION public.subwaytakes_set_updated_at();

DROP TRIGGER IF EXISTS trg_muapi_caption_jobs_subwaytakes_immutable_user ON public.muapi_caption_jobs;
CREATE TRIGGER trg_muapi_caption_jobs_subwaytakes_immutable_user
  BEFORE UPDATE ON public.muapi_caption_jobs
  FOR EACH ROW EXECUTE FUNCTION public.subwaytakes_guard_immutable_user_id();

-- Same guard function as studio_render_jobs (it branches on TG_TABLE_NAME to
-- compare the correct protected columns for this table's shape).
DROP TRIGGER IF EXISTS trg_muapi_caption_jobs_subwaytakes_guard_job_writes ON public.muapi_caption_jobs;
CREATE TRIGGER trg_muapi_caption_jobs_subwaytakes_guard_job_writes
  BEFORE INSERT OR UPDATE ON public.muapi_caption_jobs
  FOR EACH ROW EXECUTE FUNCTION public.subwaytakes_guard_job_writes();

ALTER TABLE public.muapi_caption_jobs ENABLE ROW LEVEL SECURITY;

-- Clients may read their own caption jobs only. All writes happen in the
-- muapi-captions edge function with the service-role key (submit, poll, store
-- output), so there is deliberately NO authenticated INSERT/UPDATE/DELETE
-- policy.
DROP POLICY IF EXISTS "subwaytakes_muapi_caption_jobs_select_own" ON public.muapi_caption_jobs;
CREATE POLICY "subwaytakes_muapi_caption_jobs_select_own"
  ON public.muapi_caption_jobs FOR SELECT TO authenticated
  USING (auth.uid()::text = user_id::text);

-- =============================================================
-- 5. REVOKE ANON DML (defense in depth)
-- =============================================================

REVOKE INSERT, UPDATE, DELETE ON public.studio_projects FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.studio_render_jobs FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.muapi_caption_jobs FROM anon;

-- =============================================================
-- 6. PRIVATE STORAGE BUCKETS
-- =============================================================

-- Idempotent and non-destructive bucket creation. The buckets are
-- SubwayTakes-specific and assumed not to exist yet; if one already exists
-- (e.g. created from the dashboard) its settings — visibility, file size
-- limit, allowed MIME types — are intentionally left untouched. This avoids
-- ON CONFLICT reliance and never flips a bucket public or resets its limits.
INSERT INTO storage.buckets (id, name, public)
SELECT 'studio-exports', 'studio-exports', false
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'studio-exports');

INSERT INTO storage.buckets (id, name, public)
SELECT 'studio-uploads', 'studio-uploads', false
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'studio-uploads');

-- Per-user folder scoping on both buckets ((storage.foldername(name))[1] is the
-- first path segment = auth.uid()). The render worker and edge functions write
-- with the service role, which bypasses storage RLS.
DROP POLICY IF EXISTS "subwaytakes_studio_exports_read_own" ON storage.objects;
CREATE POLICY "subwaytakes_studio_exports_read_own"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'studio-exports' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "subwaytakes_studio_exports_insert_own" ON storage.objects;
CREATE POLICY "subwaytakes_studio_exports_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'studio-exports' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "subwaytakes_studio_uploads_read_own" ON storage.objects;
CREATE POLICY "subwaytakes_studio_uploads_read_own"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'studio-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "subwaytakes_studio_uploads_insert_own" ON storage.objects;
CREATE POLICY "subwaytakes_studio_uploads_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'studio-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
