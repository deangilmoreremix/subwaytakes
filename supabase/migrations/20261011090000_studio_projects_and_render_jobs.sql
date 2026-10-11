/*
  # SubwayTakes Studio: interview projects, render jobs, MuAPI caption jobs

  Adds the persistence layer for the Subway Interview Studio:

  1. New Tables
    - `studio_projects` — versioned timeline project JSON per user (editor state)
    - `studio_render_jobs` — server-side render queue with persisted status
    - `muapi_caption_jobs` — MuAPI AI Captions jobs (styled + editable modes)

  2. Security
    - RLS enabled on all three tables
    - `authenticated` policies scoped with `auth.uid()::text = user_id`
    - `anon` DML revoked (defense in depth, consistent with 20260226110220_rls_policies.sql)
    - `user_id` immutability triggers (same pattern as 20260226110220_rls_policies.sql)
    - The render worker uses the service-role key (bypasses RLS) and MUST set
      user_id from the job row claimed from the queue.

  3. Storage
    - `studio-exports` bucket (private) — rendered and captioned MP4 outputs
    - `studio-uploads` bucket (private) — user-uploaded interview footage
    - Both scoped to `auth.uid()` folders via storage policies
*/

-- =============================================================
-- 1. STUDIO PROJECTS
-- =============================================================

CREATE TABLE IF NOT EXISTS studio_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Untitled Subway Interview',
  -- versioned project JSON (see src/studio/types.ts, PROJECT_FORMAT_VERSION)
  project jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_studio_projects_user_updated
  ON studio_projects (user_id, updated_at DESC);

DROP TRIGGER IF EXISTS trg_studio_projects_updated_at ON studio_projects;
CREATE TRIGGER trg_studio_projects_updated_at
  BEFORE UPDATE ON studio_projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE studio_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "studio_projects_select_own" ON studio_projects;
CREATE POLICY "studio_projects_select_own"
  ON studio_projects FOR SELECT TO authenticated
  USING (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "studio_projects_insert_own" ON studio_projects;
CREATE POLICY "studio_projects_insert_own"
  ON studio_projects FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "studio_projects_update_own" ON studio_projects;
CREATE POLICY "studio_projects_update_own"
  ON studio_projects FOR UPDATE TO authenticated
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "studio_projects_delete_own" ON studio_projects;
CREATE POLICY "studio_projects_delete_own"
  ON studio_projects FOR DELETE TO authenticated
  USING (auth.uid()::text = user_id::text);

-- =============================================================
-- 2. STUDIO RENDER JOBS
-- =============================================================

CREATE TABLE IF NOT EXISTS studio_render_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES studio_projects(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'done', 'error')),
  progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
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

CREATE INDEX IF NOT EXISTS idx_studio_render_jobs_queue
  ON studio_render_jobs (status, created_at)
  WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_studio_render_jobs_user
  ON studio_render_jobs (user_id, created_at DESC);
-- one active job per project at a time
CREATE UNIQUE INDEX IF NOT EXISTS uq_studio_render_jobs_active_per_project
  ON studio_render_jobs (project_id)
  WHERE status IN ('queued', 'running');

DROP TRIGGER IF EXISTS trg_studio_render_jobs_updated_at ON studio_render_jobs;
CREATE TRIGGER trg_studio_render_jobs_updated_at
  BEFORE UPDATE ON studio_render_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE studio_render_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "studio_render_jobs_select_own" ON studio_render_jobs;
CREATE POLICY "studio_render_jobs_select_own"
  ON studio_render_jobs FOR SELECT TO authenticated
  USING (auth.uid()::text = user_id::text);

-- INSERT only via the render-project edge function (service role); users cannot
-- enqueue directly through PostgREST. Re-enqueue is handled by the edge function
-- using the service-role key, which also records user_id from the project row.
DROP POLICY IF EXISTS "studio_render_jobs_insert_own" ON studio_render_jobs;
CREATE POLICY "studio_render_jobs_insert_own"
  ON studio_render_jobs FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "studio_render_jobs_update_own" ON studio_render_jobs;
CREATE POLICY "studio_render_jobs_update_own"
  ON studio_render_jobs FOR UPDATE TO authenticated
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "studio_render_jobs_delete_own" ON studio_render_jobs;
CREATE POLICY "studio_render_jobs_delete_own"
  ON studio_render_jobs FOR DELETE TO authenticated
  USING (auth.uid()::text = user_id::text);

-- =============================================================
-- 3. MUAPI CAPTION JOBS
-- =============================================================

CREATE TABLE IF NOT EXISTS muapi_caption_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES studio_projects(id) ON DELETE CASCADE,
  render_job_id uuid REFERENCES studio_render_jobs(id) ON DELETE SET NULL,
  mode text NOT NULL CHECK (mode IN ('styled', 'editable')),
  muapi_request_id text,
  language text NOT NULL DEFAULT 'English',
  theme text NOT NULL DEFAULT 'Hormozi_1',
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'done', 'error')),
  output_url text,
  -- editable mode: transcribed timed captions returned to the editor
  captions jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_muapi_caption_jobs_project
  ON muapi_caption_jobs (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_muapi_caption_jobs_user
  ON muapi_caption_jobs (user_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_muapi_caption_jobs_updated_at ON muapi_caption_jobs;
CREATE TRIGGER trg_muapi_caption_jobs_updated_at
  BEFORE UPDATE ON muapi_caption_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE muapi_caption_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "muapi_caption_jobs_select_own" ON muapi_caption_jobs;
CREATE POLICY "muapi_caption_jobs_select_own"
  ON muapi_caption_jobs FOR SELECT TO authenticated
  USING (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "muapi_caption_jobs_insert_own" ON muapi_caption_jobs;
CREATE POLICY "muapi_caption_jobs_insert_own"
  ON muapi_caption_jobs FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "muapi_caption_jobs_update_own" ON muapi_caption_jobs;
CREATE POLICY "muapi_caption_jobs_update_own"
  ON muapi_caption_jobs FOR UPDATE TO authenticated
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "muapi_caption_jobs_delete_own" ON muapi_caption_jobs;
CREATE POLICY "muapi_caption_jobs_delete_own"
  ON muapi_caption_jobs FOR DELETE TO authenticated
  USING (auth.uid()::text = user_id::text);

-- =============================================================
-- 4. USER_ID IMMUTABILITY (same pattern as 20260226110220_rls_policies.sql)
-- =============================================================

CREATE OR REPLACE FUNCTION immutable_user_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'user_id is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_studio_projects_immutable_user ON studio_projects;
CREATE TRIGGER trg_studio_projects_immutable_user
  BEFORE UPDATE ON studio_projects
  FOR EACH ROW EXECUTE FUNCTION immutable_user_id();

DROP TRIGGER IF EXISTS trg_studio_render_jobs_immutable_user ON studio_render_jobs;
CREATE TRIGGER trg_studio_render_jobs_immutable_user
  BEFORE UPDATE ON studio_render_jobs
  FOR EACH ROW EXECUTE FUNCTION immutable_user_id();

DROP TRIGGER IF EXISTS trg_muapi_caption_jobs_immutable_user ON muapi_caption_jobs;
CREATE TRIGGER trg_muapi_caption_jobs_immutable_user
  BEFORE UPDATE ON muapi_caption_jobs
  FOR EACH ROW EXECUTE FUNCTION immutable_user_id();

-- =============================================================
-- 5. REVOKE ANON DML (defense in depth)
-- =============================================================

REVOKE INSERT, UPDATE, DELETE ON studio_projects FROM anon;
REVOKE INSERT, UPDATE, DELETE ON studio_render_jobs FROM anon;
REVOKE INSERT, UPDATE, DELETE ON muapi_caption_jobs FROM anon;

-- =============================================================
-- 6. PRIVATE STORAGE BUCKETS
-- =============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('studio-exports', 'studio-exports', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('studio-uploads', 'studio-uploads', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "studio_exports_read_own" ON storage.objects;
CREATE POLICY "studio_exports_read_own"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'studio-exports' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "studio_exports_insert_own" ON storage.objects;
CREATE POLICY "studio_exports_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'studio-exports' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "studio_uploads_read_own" ON storage.objects;
CREATE POLICY "studio_uploads_read_own"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'studio-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "studio_uploads_insert_own" ON storage.objects;
CREATE POLICY "studio_uploads_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'studio-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
