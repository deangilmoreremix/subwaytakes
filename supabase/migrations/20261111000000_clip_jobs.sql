/*
  # clip_jobs: muapi generation jobs

  One row per generation (native, lipsync or recast). Stage state is persisted so
  multi-step pipelines survive reloads. Owner-only RLS; no anon access.
*/
CREATE TABLE IF NOT EXISTS clip_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clip_id uuid,
  pipeline text NOT NULL CHECK (pipeline IN ('native', 'lipsync', 'recast')),
  model text NOT NULL,
  request_id text,
  stage text NOT NULL DEFAULT 'queued',
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_url text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clip_jobs_user_created_idx ON clip_jobs (user_id, created_at DESC);

ALTER TABLE clip_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clip_jobs_select_own" ON clip_jobs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "clip_jobs_insert_own" ON clip_jobs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "clip_jobs_update_own" ON clip_jobs FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "clip_jobs_delete_own" ON clip_jobs FOR DELETE TO authenticated USING (user_id = auth.uid());
