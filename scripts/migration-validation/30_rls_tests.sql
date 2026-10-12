-- =====================================================================
-- 30_rls_tests.sql — RLS / behaviour test suite for the corrected
-- SubwayTakes Studio migration, simulating PostgREST exactly as
-- Supabase does it:
--   * every test opens a transaction (each DO block = one transaction
--     in psql autocommit mode),
--   * switches the session role with set_config('role', X, true)
--     (== SET LOCAL ROLE X — reverts when the transaction ends),
--   * sets request.jwt.claims with set_config(..., true)
--     (== SET LOCAL request.jwt.claims = '{"sub":"...","role":"..."}'),
--   * runs the statement and asserts the outcome.
--
-- Every test prints exactly one line:
--     TEST <id>: PASS (<detail>)   or   TEST <id>: FAIL (<detail>)
-- and records it in public.harness_results. A bash driver
-- (31_rls_tests_driver.sh) runs this file, greps the TEST lines,
-- reports PASS/FAIL counts and exits non-zero on any failure.
--
-- Run as: postgres, against the scratch DB AFTER
--         00_substrate.sql + the target migration.
-- =====================================================================

\set ON_ERROR_STOP on

-- ---------------------------------------------------------------------
-- Seed / reset deterministic fixtures (runs as postgres; the job-write
-- guard allows current_user='postgres' via its trusted-role branch).
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS public.harness_results;
CREATE TABLE public.harness_results (
  seq bigserial PRIMARY KEY,
  test_id text NOT NULL,
  passed boolean NOT NULL,
  detail text NOT NULL
);

CREATE OR REPLACE FUNCTION public.harness_check(p_test text, p_ok boolean, p_detail text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.harness_results (test_id, passed, detail)
  VALUES (p_test, p_ok, p_detail);
  IF p_ok THEN
    RAISE NOTICE 'TEST %: PASS (%)', p_test, p_detail;
  ELSE
    RAISE NOTICE 'TEST %: FAIL (%)', p_test, p_detail;
  END IF;
END;
$$;

TRUNCATE public.studio_render_jobs, public.muapi_caption_jobs, public.studio_projects RESTART IDENTITY;
DELETE FROM storage.objects;
-- normalize the "other app" fixture to a deterministic state
DELETE FROM public.legacy_clips;
INSERT INTO public.legacy_clips (user_id) VALUES ('11111111-1111-1111-1111-111111111111');

-- users (already seeded by 00_substrate.sql; re-assert for standalone runs)
INSERT INTO auth.users (id, email, is_anonymous) VALUES
  ('11111111-1111-1111-1111-111111111111', 'user-a@subwaytakes.test', true),
  ('22222222-2222-2222-2222-222222222222', 'user-b@subwaytakes.test', true)
ON CONFLICT (id) DO NOTHING;

-- projects: A owns projA + projA2, B owns projB
INSERT INTO public.studio_projects (id, user_id, title, project, created_at, updated_at) VALUES
  ('10000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'A project', '{"version":1}'::jsonb, now() - interval '3 hours', now() - interval '3 hours'),
  ('10000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'B project', '{"version":1}'::jsonb, now() - interval '3 hours', now() - interval '3 hours'),
  ('10000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'A project 2', '{"version":1}'::jsonb, now() - interval '3 hours', now() - interval '3 hours');

-- render jobs: oldest queued = rjA (user A), newer queued = rjB (user B)
INSERT INTO public.studio_render_jobs (id, user_id, project_id, project_snapshot, status, created_at, updated_at) VALUES
  ('20000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '10000000-0000-0000-0000-000000000001', '{"beats":[]}'::jsonb, 'queued', now() - interval '2 hours', now() - interval '2 hours'),
  ('20000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', '10000000-0000-0000-0000-000000000002', '{"beats":[]}'::jsonb, 'queued', now() - interval '1 hour', now() - interval '1 hour');

-- caption jobs: capA (user A), capB (user B)
INSERT INTO public.muapi_caption_jobs (id, user_id, project_id, mode, status, created_at, updated_at) VALUES
  ('30000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '10000000-0000-0000-0000-000000000001', 'styled', 'queued', now() - interval '2 hours', now() - interval '2 hours'),
  ('30000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', '10000000-0000-0000-0000-000000000002', 'editable', 'queued', now() - interval '1 hour', now() - interval '1 hour');

-- storage objects: objA (user A), objB (user B) in studio-uploads
INSERT INTO storage.objects (id, bucket_id, name, owner) VALUES
  ('40000000-0000-0000-0000-000000000001', 'studio-uploads', '11111111-1111-1111-1111-111111111111/seeded/a.mp4', '11111111-1111-1111-1111-111111111111'),
  ('40000000-0000-0000-0000-000000000002', 'studio-uploads', '22222222-2222-2222-2222-222222222222/seeded/b.mp4', '22222222-2222-2222-2222-222222222222');

-- =====================================================================
-- A. studio_projects — authenticated ownership CRUD
-- =====================================================================

-- A01: user A SELECTs own row -> exactly 1 row
DO $$
DECLARE v_rows int;
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  SELECT count(*) INTO v_rows FROM public.studio_projects WHERE id = '10000000-0000-0000-0000-000000000001';
  PERFORM set_config('role', 'postgres', true);
  PERFORM public.harness_check('A01_select_own_project', v_rows = 1, format('rows=%s (expected 1)', v_rows));
END $$;

-- A02: user A cannot see user B's row -> 0 rows
DO $$
DECLARE v_rows int;
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  SELECT count(*) INTO v_rows FROM public.studio_projects WHERE id = '10000000-0000-0000-0000-000000000002';
  PERFORM set_config('role', 'postgres', true);
  PERFORM public.harness_check('A02_cannot_select_other_project', v_rows = 0, format('rows=%s (expected 0)', v_rows));
END $$;

-- A03: user A INSERTs own row -> success, 1 row
DO $$
DECLARE v_id uuid;
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  INSERT INTO public.studio_projects (id, user_id, title, project)
  VALUES ('10000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'A inserted', '{"version":1}'::jsonb)
  RETURNING id INTO v_id;
  PERFORM set_config('role', 'postgres', true);
  PERFORM public.harness_check('A03_insert_own_project', v_id = '10000000-0000-0000-0000-00000000000a', format('inserted id=%s', v_id));
END $$;

-- A04: user A cannot INSERT a row owned by user B -> RLS exception
DO $$
DECLARE v_err text;
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  BEGIN
    INSERT INTO public.studio_projects (id, user_id, title, project)
    VALUES ('10000000-0000-0000-0000-00000000000b', '22222222-2222-2222-2222-222222222222', 'B owned', '{"version":1}'::jsonb);
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
  END;
  PERFORM set_config('role', 'postgres', true);
  PERFORM public.harness_check('A04_cannot_insert_as_other_user',
    v_err LIKE '%row-level security%',
    coalesce(v_err, '<no exception>'));
END $$;

-- A05: user A cannot UPDATE user B's row -> 0 rows affected
DO $$
DECLARE v_rows int;
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  UPDATE public.studio_projects SET title = 'hijacked'
  WHERE id = '10000000-0000-0000-0000-000000000002';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  PERFORM set_config('role', 'postgres', true);
  PERFORM public.harness_check('A05_cannot_update_other_project', v_rows = 0, format('rows_affected=%s (expected 0)', v_rows));
END $$;

-- A06: user A cannot DELETE user B's row -> 0 rows affected, row survives
DO $$
DECLARE v_rows int; v_survives int;
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  DELETE FROM public.studio_projects WHERE id = '10000000-0000-0000-0000-000000000002';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  PERFORM set_config('role', 'postgres', true);
  SELECT count(*) INTO v_survives FROM public.studio_projects WHERE id = '10000000-0000-0000-0000-000000000002';
  PERFORM public.harness_check('A06_cannot_delete_other_project',
    v_rows = 0 AND v_survives = 1,
    format('rows_affected=%s, row_still_exists=%s', v_rows, v_survives));
END $$;

-- A07: user_id immutability — A updating own row's user_id -> exact exception
DO $$
DECLARE v_err text;
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  BEGIN
    UPDATE public.studio_projects SET user_id = '22222222-2222-2222-2222-222222222222'
    WHERE id = '10000000-0000-0000-0000-000000000001';
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
  END;
  PERFORM set_config('role', 'postgres', true);
  PERFORM public.harness_check('A07_user_id_immutable',
    v_err = 'subwaytakes: user_id is immutable',
    coalesce(v_err, '<no exception>'));
END $$;

-- A08: sanity — A CAN update own row's editable columns
DO $$
DECLARE v_rows int;
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  UPDATE public.studio_projects SET title = 'A project (edited)'
  WHERE id = '10000000-0000-0000-0000-000000000001';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  PERFORM set_config('role', 'postgres', true);
  PERFORM public.harness_check('A08_owner_can_update_own', v_rows = 1, format('rows_affected=%s (expected 1)', v_rows));
END $$;

-- =====================================================================
-- B. studio_render_jobs — client-restricted, service-role-only writes
-- =====================================================================

-- B01: client (authenticated) INSERT -> blocked by the guard trigger
DO $$
DECLARE v_err text;
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  BEGIN
    INSERT INTO public.studio_render_jobs (user_id, project_id, project_snapshot)
    VALUES ('11111111-1111-1111-1111-111111111111', '10000000-0000-0000-0000-000000000001', '{}'::jsonb);
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
  END;
  PERFORM set_config('role', 'postgres', true);
  PERFORM public.harness_check('B01_client_insert_blocked',
    v_err = 'subwaytakes: render/caption job writes are restricted to service-role context',
    coalesce(v_err, '<no exception>'));
END $$;

-- B02: client UPDATE changing status/output_url -> blocked (0 rows, no row changed)
DO $$
DECLARE v_rows int; v_status text;
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  BEGIN
    UPDATE public.studio_render_jobs
    SET status = 'done', output_url = 'https://attacker/evil.mp4', progress = 100
    WHERE id = '20000000-0000-0000-0000-000000000001';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    v_rows := -1; -- an exception ALSO counts as blocked
  END;
  PERFORM set_config('role', 'postgres', true);
  SELECT status INTO v_status FROM public.studio_render_jobs WHERE id = '20000000-0000-0000-0000-000000000001';
  PERFORM public.harness_check('B02_client_update_status_blocked',
    (v_rows = 0 OR v_rows = -1) AND v_status = 'queued',
    format('rows_affected=%s, status_after=%s', v_rows, v_status));
END $$;

-- B03: client UPDATE changing user_id -> blocked (0 rows, ownership intact)
DO $$
DECLARE v_rows int; v_owner uuid;
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  BEGIN
    UPDATE public.studio_render_jobs
    SET user_id = '11111111-1111-1111-1111-111111111111'
    WHERE id = '20000000-0000-0000-0000-000000000002';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    v_rows := -1;
  END;
  PERFORM set_config('role', 'postgres', true);
  SELECT user_id INTO v_owner FROM public.studio_render_jobs WHERE id = '20000000-0000-0000-0000-000000000002';
  PERFORM public.harness_check('B03_client_update_user_id_blocked',
    (v_rows = 0 OR v_rows = -1) AND v_owner = '22222222-2222-2222-2222-222222222222',
    format('rows_affected=%s, owner_after=%s', v_rows, v_owner));
END $$;

-- B04: client SELECT sees only own jobs (1 row; B's job invisible)
DO $$
DECLARE v_own int; v_other int;
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  SELECT count(*) INTO v_own FROM public.studio_render_jobs;
  SELECT count(*) INTO v_other FROM public.studio_render_jobs
  WHERE id = '20000000-0000-0000-0000-000000000002';
  PERFORM set_config('role', 'postgres', true);
  PERFORM public.harness_check('B04_client_select_own_jobs_only',
    v_own = 1 AND v_other = 0,
    format('own_rows=%s (expected 1), other_visible_rows=%s (expected 0)', v_own, v_other));
END $$;

-- B05: service_role INSERT -> success
DO $$
DECLARE v_id uuid;
BEGIN
  PERFORM set_config('role', 'service_role', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"service_role"}', true);
  INSERT INTO public.studio_render_jobs (id, user_id, project_id, project_snapshot, render_settings)
  VALUES ('20000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', '10000000-0000-0000-0000-000000000003', '{"beats":[]}'::jsonb, '{"fps":30}'::jsonb)
  RETURNING id INTO v_id;
  PERFORM set_config('role', 'postgres', true);
  PERFORM public.harness_check('B05_service_role_insert_ok', v_id = '20000000-0000-0000-0000-000000000003', format('inserted id=%s', v_id));
END $$;

-- B06: service_role UPDATE heartbeat-style (status/progress/output_url) -> success
DO $$
DECLARE v_rows int; v_status text; v_progress int; v_url text;
BEGIN
  PERFORM set_config('role', 'service_role', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"service_role"}', true);
  UPDATE public.studio_render_jobs
  SET status = 'running', progress = 42, output_url = 'https://svc.example/rj.mp4', worker_id = 'worker-test', updated_at = now()
  WHERE id = '20000000-0000-0000-0000-000000000003';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  PERFORM set_config('role', 'postgres', true);
  SELECT status, progress, output_url INTO v_status, v_progress, v_url
  FROM public.studio_render_jobs WHERE id = '20000000-0000-0000-0000-000000000003';
  PERFORM public.harness_check('B06_service_role_update_heartbeat',
    v_rows = 1 AND v_status = 'running' AND v_progress = 42 AND v_url = 'https://svc.example/rj.mp4',
    format('rows=%s status=%s progress=%s output_url=%s', v_rows, v_status, v_progress, v_url));
END $$;

-- B07: service_role lifecycle completion (done/100) -> success
DO $$
DECLARE v_rows int; v_status text;
BEGIN
  PERFORM set_config('role', 'service_role', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"service_role"}', true);
  UPDATE public.studio_render_jobs
  SET status = 'done', progress = 100, error = NULL, updated_at = now()
  WHERE id = '20000000-0000-0000-0000-000000000003';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  PERFORM set_config('role', 'postgres', true);
  SELECT status INTO v_status FROM public.studio_render_jobs WHERE id = '20000000-0000-0000-0000-000000000003';
  PERFORM public.harness_check('B07_service_role_lifecycle_done',
    v_rows = 1 AND v_status = 'done',
    format('rows=%s status=%s', v_rows, v_status));
END $$;

-- B08: service_role SELECT sees ALL rows (3)
DO $$
DECLARE v_all int;
BEGIN
  PERFORM set_config('role', 'service_role', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"service_role"}', true);
  SELECT count(*) INTO v_all FROM public.studio_render_jobs;
  PERFORM set_config('role', 'postgres', true);
  PERFORM public.harness_check('B08_service_role_select_all', v_all = 3, format('rows=%s (expected 3)', v_all));
END $$;

-- =====================================================================
-- C. Render-worker query compatibility — the actual claim/update shapes
--    from render-worker/src/storage.ts run as service_role.
-- =====================================================================

-- C01: worker two-step claim #1 (oldest queued job) -> claims exactly 1 row
DO $$
DECLARE v_rows int; v_id uuid; v_status text; v_worker text;
BEGIN
  PERFORM set_config('role', 'service_role', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"service_role"}', true);
  UPDATE public.studio_render_jobs
  SET status = 'running', worker_id = 'worker-integration-1', updated_at = now()
  WHERE id = (SELECT id FROM public.studio_render_jobs WHERE status = 'queued' ORDER BY created_at LIMIT 1)
    AND status = 'queued'
  RETURNING id, status, worker_id INTO v_id, v_status, v_worker;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  PERFORM set_config('role', 'postgres', true);
  PERFORM public.harness_check('C01_worker_claim_first',
    v_rows = 1 AND v_id = '20000000-0000-0000-0000-000000000001' AND v_status = 'running' AND v_worker = 'worker-integration-1',
    format('claimed=%s rows=%s status=%s worker=%s', v_id, v_rows, v_status, v_worker));
END $$;

-- C02: worker claim #2 -> claims the next queued job (exactly 1)
DO $$
DECLARE v_rows int; v_id uuid;
BEGIN
  PERFORM set_config('role', 'service_role', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"service_role"}', true);
  UPDATE public.studio_render_jobs
  SET status = 'running', worker_id = 'worker-integration-1', updated_at = now()
  WHERE id = (SELECT id FROM public.studio_render_jobs WHERE status = 'queued' ORDER BY created_at LIMIT 1)
    AND status = 'queued'
  RETURNING id INTO v_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  PERFORM set_config('role', 'postgres', true);
  PERFORM public.harness_check('C02_worker_claim_second',
    v_rows = 1 AND v_id = '20000000-0000-0000-0000-000000000002',
    format('claimed=%s rows=%s', v_id, v_rows));
END $$;

-- C03: worker claim #3 with an empty queue -> claims 0 rows (no crash)
DO $$
DECLARE v_rows int;
BEGIN
  PERFORM set_config('role', 'service_role', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"service_role"}', true);
  UPDATE public.studio_render_jobs
  SET status = 'running', worker_id = 'worker-integration-1', updated_at = now()
  WHERE id = (SELECT id FROM public.studio_render_jobs WHERE status = 'queued' ORDER BY created_at LIMIT 1)
    AND status = 'queued';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  PERFORM set_config('role', 'postgres', true);
  PERFORM public.harness_check('C03_worker_claim_empty_queue', v_rows = 0, format('rows=%s (expected 0)', v_rows));
END $$;

-- C04: completed job untouched by the claim sweep
DO $$
DECLARE v_status text;
BEGIN
  SELECT status INTO v_status FROM public.studio_render_jobs WHERE id = '20000000-0000-0000-0000-000000000003';
  PERFORM public.harness_check('C04_done_job_untouched', v_status = 'done', format('status=%s', v_status));
END $$;

-- =====================================================================
-- D. muapi_caption_jobs — same restriction model
-- =====================================================================

-- D01: client INSERT -> blocked by the guard trigger
DO $$
DECLARE v_err text;
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  BEGIN
    INSERT INTO public.muapi_caption_jobs (user_id, project_id, mode)
    VALUES ('11111111-1111-1111-1111-111111111111', '10000000-0000-0000-0000-000000000001', 'styled');
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
  END;
  PERFORM set_config('role', 'postgres', true);
  PERFORM public.harness_check('D01_client_insert_blocked',
    v_err = 'subwaytakes: render/caption job writes are restricted to service-role context',
    coalesce(v_err, '<no exception>'));
END $$;

-- D02: client UPDATE changing status/output_url/captions -> blocked (0 rows)
DO $$
DECLARE v_rows int; v_status text;
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  BEGIN
    UPDATE public.muapi_caption_jobs
    SET status = 'done', output_url = 'https://attacker/evil.mp4', captions = '[{"text":"fake"}]'::jsonb
    WHERE id = '30000000-0000-0000-0000-000000000001';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    v_rows := -1;
  END;
  PERFORM set_config('role', 'postgres', true);
  SELECT status INTO v_status FROM public.muapi_caption_jobs WHERE id = '30000000-0000-0000-0000-000000000001';
  PERFORM public.harness_check('D02_client_update_blocked',
    (v_rows = 0 OR v_rows = -1) AND v_status = 'queued',
    format('rows_affected=%s, status_after=%s', v_rows, v_status));
END $$;

-- D03: client SELECT isolation (own rows only)
DO $$
DECLARE v_own int; v_other int;
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  SELECT count(*) INTO v_own FROM public.muapi_caption_jobs;
  SELECT count(*) INTO v_other FROM public.muapi_caption_jobs
  WHERE id = '30000000-0000-0000-0000-000000000002';
  PERFORM set_config('role', 'postgres', true);
  PERFORM public.harness_check('D03_client_select_own_only',
    v_own = 1 AND v_other = 0,
    format('own_rows=%s (expected 1), other_visible_rows=%s (expected 0)', v_own, v_other));
END $$;

-- D04: service_role INSERT -> success
DO $$
DECLARE v_id uuid;
BEGIN
  PERFORM set_config('role', 'service_role', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"service_role"}', true);
  INSERT INTO public.muapi_caption_jobs (id, user_id, project_id, render_job_id, mode, language, theme)
  VALUES ('30000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
          '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 'styled', 'English', 'Hormozi_1')
  RETURNING id INTO v_id;
  PERFORM set_config('role', 'postgres', true);
  PERFORM public.harness_check('D04_service_role_insert_ok', v_id = '30000000-0000-0000-0000-000000000003', format('inserted id=%s', v_id));
END $$;

-- D05: service_role lifecycle updates (running w/ request id, then done w/ output+captions)
DO $$
DECLARE v_rows1 int; v_rows2 int; v_status text; v_req text; v_url text; v_caps jsonb;
BEGIN
  PERFORM set_config('role', 'service_role', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"service_role"}', true);
  UPDATE public.muapi_caption_jobs
  SET status = 'running', muapi_request_id = 'muapi-req-123', updated_at = now()
  WHERE id = '30000000-0000-0000-0000-000000000003';
  GET DIAGNOSTICS v_rows1 = ROW_COUNT;
  UPDATE public.muapi_caption_jobs
  SET status = 'done', output_url = 'https://svc.example/captioned.mp4', captions = '[{"text":"hello"}]'::jsonb, updated_at = now()
  WHERE id = '30000000-0000-0000-0000-000000000003';
  GET DIAGNOSTICS v_rows2 = ROW_COUNT;
  PERFORM set_config('role', 'postgres', true);
  SELECT status, muapi_request_id, output_url, captions INTO v_status, v_req, v_url, v_caps
  FROM public.muapi_caption_jobs WHERE id = '30000000-0000-0000-0000-000000000003';
  PERFORM public.harness_check('D05_service_role_lifecycle',
    v_rows1 = 1 AND v_rows2 = 1 AND v_status = 'done' AND v_req = 'muapi-req-123'
      AND v_url = 'https://svc.example/captioned.mp4' AND v_caps = '[{"text":"hello"}]'::jsonb,
    format('rows1=%s rows2=%s status=%s request=%s', v_rows1, v_rows2, v_status, v_req));
END $$;

-- D06: service_role SELECT sees ALL rows (3)
DO $$
DECLARE v_all int;
BEGIN
  PERFORM set_config('role', 'service_role', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"service_role"}', true);
  SELECT count(*) INTO v_all FROM public.muapi_caption_jobs;
  PERFORM set_config('role', 'postgres', true);
  PERFORM public.harness_check('D06_service_role_select_all', v_all = 3, format('rows=%s (expected 3)', v_all));
END $$;

-- =====================================================================
-- E. Storage — studio-uploads bucket policies
-- =====================================================================

-- E01: user A INSERTs a storage.objects row for studio-uploads in own folder
DO $$
DECLARE v_id uuid;
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  INSERT INTO storage.objects (id, bucket_id, name, owner)
  VALUES ('40000000-0000-0000-0000-000000000003', 'studio-uploads',
          '11111111-1111-1111-1111-111111111111/project/clip.mp4', '11111111-1111-1111-1111-111111111111')
  RETURNING id INTO v_id;
  PERFORM set_config('role', 'postgres', true);
  PERFORM public.harness_check('E01_storage_insert_own_folder_ok', v_id = '40000000-0000-0000-0000-000000000003', format('inserted id=%s', v_id));
END $$;

-- E02: user A SELECTs own uploaded row (2 visible: seeded + new)
DO $$
DECLARE v_own int; v_new int;
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  SELECT count(*) INTO v_own FROM storage.objects WHERE bucket_id = 'studio-uploads';
  SELECT count(*) INTO v_new FROM storage.objects WHERE id = '40000000-0000-0000-0000-000000000003';
  PERFORM set_config('role', 'postgres', true);
  PERFORM public.harness_check('E02_storage_select_own_ok',
    v_own = 2 AND v_new = 1,
    format('own_visible=%s (expected 2), new_row_visible=%s (expected 1)', v_own, v_new));
END $$;

-- E03: user A cannot SELECT user B's object row -> 0 rows
DO $$
DECLARE v_other int;
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  SELECT count(*) INTO v_other FROM storage.objects WHERE id = '40000000-0000-0000-0000-000000000002';
  PERFORM set_config('role', 'postgres', true);
  PERFORM public.harness_check('E03_storage_cannot_select_other', v_other = 0, format('rows=%s (expected 0)', v_other));
END $$;

-- E04: user A cannot INSERT into another user's folder (policy denial)
DO $$
DECLARE v_err text;
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  BEGIN
    INSERT INTO storage.objects (bucket_id, name, owner)
    VALUES ('studio-uploads', '22222222-2222-2222-2222-222222222222/attacker/x.mp4', '11111111-1111-1111-1111-111111111111');
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
  END;
  PERFORM set_config('role', 'postgres', true);
  PERFORM public.harness_check('E04_storage_insert_other_folder_blocked',
    v_err LIKE '%row-level security%',
    coalesce(v_err, '<no exception>'));
END $$;

-- E05: anon has no write grant on the studio tables (REVOKE proof)
DO $$
DECLARE v_err text;
BEGIN
  PERFORM set_config('role', 'anon', true);
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  BEGIN
    INSERT INTO public.studio_projects (user_id, title, project)
    VALUES ('11111111-1111-1111-1111-111111111111', 'anon attempt', '{}'::jsonb);
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
  END;
  PERFORM set_config('role', 'postgres', true);
  PERFORM public.harness_check('E05_anon_insert_revoked',
    v_err LIKE '%permission denied%',
    coalesce(v_err, '<no exception>'));
END $$;

-- E06: anon SELECT on studio tables -> 0 rows (RLS policies are authenticated-only)
DO $$
DECLARE v_rows int;
BEGIN
  PERFORM set_config('role', 'anon', true);
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  SELECT count(*) INTO v_rows FROM public.studio_projects;
  PERFORM set_config('role', 'postgres', true);
  PERFORM public.harness_check('E06_anon_select_isolation', v_rows = 0, format('rows=%s (expected 0)', v_rows));
END $$;

-- =====================================================================
-- F. updated_at triggers fire (and the DECOY is NOT what fires)
-- =====================================================================

-- F01: updating a project row refreshes updated_at to a recent value
DO $$
DECLARE v_before timestamptz; v_after timestamptz; v_created timestamptz;
BEGIN
  SELECT updated_at INTO v_before FROM public.studio_projects WHERE id = '10000000-0000-0000-0000-000000000001';
  SELECT created_at INTO v_created FROM public.studio_projects WHERE id = '10000000-0000-0000-0000-000000000001';
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  UPDATE public.studio_projects SET title = 'A project (edited again)'
  WHERE id = '10000000-0000-0000-0000-000000000001';
  PERFORM set_config('role', 'postgres', true);
  SELECT updated_at INTO v_after FROM public.studio_projects WHERE id = '10000000-0000-0000-0000-000000000001';
  PERFORM public.harness_check('F01_updated_at_trigger_fires',
    v_after > v_before
      AND v_after <> '1999-01-01'::timestamptz
      AND v_after > now() - interval '2 minutes'
      AND v_after >= v_created,
    format('before=%s after=%s (sentinel 1999-01-01 must NOT appear; after must be recent)', v_before, v_after));
END $$;

-- F02: studio triggers use subwaytakes_set_updated_at, never the decoy
DO $$
DECLARE v_decoys int; v_ours int;
BEGIN
  SELECT count(*) INTO v_decoys
  FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
  WHERE t.tgrelid IN ('public.studio_projects'::regclass, 'public.studio_render_jobs'::regclass, 'public.muapi_caption_jobs'::regclass)
    AND p.proname = 'update_updated_at_column';
  SELECT count(*) INTO v_ours
  FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
  WHERE t.tgrelid IN ('public.studio_projects'::regclass, 'public.studio_render_jobs'::regclass, 'public.muapi_caption_jobs'::regclass)
    AND p.proname = 'subwaytakes_set_updated_at';
  PERFORM public.harness_check('F02_trigger_uses_subwaytakes_function',
    v_decoys = 0 AND v_ours = 3,
    format('decoy_triggers=%s (expected 0), subwaytakes_triggers=%s (expected 3)', v_decoys, v_ours));
END $$;

-- F03: the decoy itself is untouched — it still writes the 1999-01-01 sentinel
DO $$
DECLARE v_sentinel timestamptz;
BEGIN
  EXECUTE 'CREATE TABLE IF NOT EXISTS public.harness_decoy_probe (id int PRIMARY KEY, updated_at timestamptz)';
  EXECUTE 'DELETE FROM public.harness_decoy_probe';
  EXECUTE 'INSERT INTO public.harness_decoy_probe VALUES (1, now())';
  EXECUTE 'DROP TRIGGER IF EXISTS trg_harness_decoy ON public.harness_decoy_probe';
  EXECUTE 'CREATE TRIGGER trg_harness_decoy BEFORE UPDATE ON public.harness_decoy_probe
           FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()';
  EXECUTE 'UPDATE public.harness_decoy_probe SET id = id WHERE id = 1'; -- no-op UPDATE, trigger still fires
  EXECUTE 'SELECT updated_at FROM public.harness_decoy_probe WHERE id = 1' INTO v_sentinel;
  EXECUTE 'DROP TRIGGER trg_harness_decoy ON public.harness_decoy_probe';
  EXECUTE 'DROP TABLE public.harness_decoy_probe';
  PERFORM public.harness_check('F03_decoy_still_writes_sentinel',
    v_sentinel = '1999-01-01'::timestamptz,
    format('decoy wrote updated_at=%s (expected 1999-01-01 00:00:00)', v_sentinel));
END $$;

-- =====================================================================
-- G. Shared-database coexistence — pre-existing objects untouched
-- =====================================================================

-- G01: pre-existing "other app" table untouched
DO $$
DECLARE v_rows int;
BEGIN
  SELECT count(*) INTO v_rows FROM public.legacy_clips;
  PERFORM public.harness_check('G01_existing_table_untouched', v_rows = 1, format('legacy_clips rows=%s (expected 1)', v_rows));
END $$;

-- G02: auth.users has the seeded users and no triggers added by the migration
DO $$
DECLARE v_users int; v_triggers int;
BEGIN
  SELECT count(*) INTO v_users FROM auth.users;
  SELECT count(*) INTO v_triggers FROM pg_trigger
  WHERE tgrelid = 'auth.users'::regclass AND NOT tgisinternal;
  PERFORM public.harness_check('G02_auth_users_untouched',
    v_users = 2 AND v_triggers = 0,
    format('users=%s (expected 2), triggers=%s (expected 0)', v_users, v_triggers));
END $$;

-- G03: no studio object or policy touched legacy_clips / storage.buckets pre-existing rows
DO $$
DECLARE v_policies int;
BEGIN
  SELECT count(*) INTO v_policies FROM pg_policies
  WHERE tablename = 'legacy_clips' OR (schemaname = 'storage' AND tablename = 'objects' AND policyname NOT LIKE 'subwaytakes_%');
  PERFORM public.harness_check('G03_no_foreign_policy_leak', v_policies = 0, format('policies=%s (expected 0)', v_policies));
END $$;

-- =====================================================================
-- SUMMARY
-- =====================================================================
DO $$
DECLARE v_pass int; v_fail int; v_failed text;
BEGIN
  SELECT count(*) INTO v_pass FROM public.harness_results WHERE passed;
  SELECT count(*) INTO v_fail FROM public.harness_results WHERE NOT passed;
  RAISE NOTICE 'SUMMARY_TOTAL=%', (SELECT count(*) FROM public.harness_results);
  RAISE NOTICE 'SUMMARY_PASSED=%', v_pass;
  RAISE NOTICE 'SUMMARY_FAILED=%', v_fail;
  IF v_fail > 0 THEN
    SELECT string_agg(test_id || ': ' || detail, ' | ') INTO v_failed
    FROM public.harness_results WHERE NOT passed;
    RAISE NOTICE 'FAILED_TESTS=%', v_failed;
  END IF;
END $$;
