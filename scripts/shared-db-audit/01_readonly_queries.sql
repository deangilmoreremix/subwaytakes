-- =====================================================================
-- 01_readonly_queries.sql — READ-ONLY live-audit query set
-- Target: shared Supabase project bzxohkrxcwodllketcpz ("VideoRemix Product")
-- Branch: feat/subway-interview-studio
-- Migration under audit: supabase/migrations/20261011090000_studio_projects_and_render_jobs.sql
--
-- RULES (enforced by scripts/shared-db-audit/run_audit.sh):
--   * Every statement below is a catalog / information_schema / storage SELECT.
--   * No DDL, no DML, no persisted session settings, no writes of any kind.
--   * Each query carries a stable marker of the form:
--         -- ===== Q##: <title> =====
--     The runner splits the file on those markers and executes each query
--     inside its own "SET TRANSACTION READ ONLY" transaction (csv output).
--   * Safe to paste whole into the Supabase SQL Editor or to run under psql.
--     SQL Editor note: the "   --===== Qn ..." lines are plain comments there.
--
-- HOW TO READ THE RESULT FILE:
--   * Q4..Q11 are conflict probes for objects the PR-head migration defines.
--       -> EXPECTED: zero rows / zero counts. One row ANYWHERE here is a STOP
--          condition (another owner, or a partial previous apply).
--   * Q1..Q3 describe the environment and prove the live migration history
--     diverges from this repo's 37-file set.
--   * Q12..Q24 are informational / coexistence checks (record, do not act).
-- Expected values and GO/NO-GO live in scripts/shared-db-audit/expected-results.md
-- and docs/SHARED_DB_AUDIT_PLAN.md.
-- =====================================================================


-- ===== Q1: Environment and platform fingerprint =====
-- Proves: which PostgreSQL we are talking to, the database name, whether this
-- really is a Supabase-managed instance (supabase_migrations + auth + storage
-- schemas present), and the identity the runner is connected as.
SELECT
  version()                                                              AS postgres_version,
  current_setting('server_version_num')                                  AS server_version_num,
  (current_setting('server_version_num')::integer / 10000)               AS server_major_version,
  current_database()                                                     AS database_name,
  current_user                                                           AS current_user,
  session_user                                                           AS session_user,
  current_setting('is_superuser')                                        AS current_user_is_superuser,
  EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth')
                                                                         AS auth_schema_present,
  EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage')
                                                                         AS storage_schema_present,
  EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'supabase_migrations')
                                                                         AS supabase_migrations_schema_present,
  (EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth')
   AND EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage'))
                                                                         AS supabase_managed_likely;


-- ===== Q2: Migration bookkeeping — Studio version recorded and totals =====
-- Proves: whether the Studio migration's version stamp 20261011090000 is
-- already recorded in the platform's bookkeeping table, plus the earliest/
-- latest recorded versions. Bookkeeping only; the object checks (Q4..Q10) are
-- the ground truth for "already applied". Uses only the guaranteed "version"
-- column, so it is safe across every Supabase CLI schema_migrations shape.
SELECT
  count(*)::bigint                                        AS total_migrations,
  count(*) FILTER (WHERE version = '20261011090000')      AS studio_migration_version_recorded,
  min(version)                                            AS earliest_version,
  max(version)                                            AS latest_version
FROM supabase_migrations.schema_migrations;


-- ===== Q3: Migration history listing (prove divergence from this repo) =====
-- Proves: the live history differs from this repo's 37-file set. Emits every
-- recorded version with its metadata as JSON (robust to the column set: the
-- "name" column is shown when present; noise columns are stripped).
SELECT
  version,
  to_jsonb(m) - 'version' - 'statements'                 AS metadata
FROM supabase_migrations.schema_migrations m
ORDER BY version DESC
LIMIT 500;


-- ===== Q4: Conflict probe — Studio tables (expect zero rows) =====
-- If any row appears: a same-named table already exists in the shared schema.
-- The migration's guarded IF-NOT-EXISTS table step would silently attach to a
-- foreign table. STOP and coordinate before applying.
SELECT table_schema, table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('studio_projects', 'studio_render_jobs', 'muapi_caption_jobs')
ORDER BY table_name;


-- ===== Q5: Conflict probe — Studio indexes (expect zero rows) =====
-- An index cannot exist without its table; any row here implies Q4 already
-- tripped (a Studio or foreign owner of the studio_* table). Prefixed names.
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE indexname IN (
    'subwaytakes_idx_studio_projects_user_updated',
    'subwaytakes_idx_studio_render_jobs_queue',
    'subwaytakes_idx_studio_render_jobs_user',
    'subwaytakes_uq_studio_render_jobs_active_per_project',
    'subwaytakes_idx_muapi_caption_jobs_project',
    'subwaytakes_idx_muapi_caption_jobs_user')
ORDER BY indexname;


-- ===== Q6: Conflict probe — Studio triggers (expect zero rows) =====
-- The 8 trg_*_subwaytakes_* triggers defined by the PR-head migration. Any row
-- means the table (and trigger) already exists — a prior partial apply, or a
-- foreign owner of a studio_* table.
SELECT
  t.tgname            AS trigger_name,
  nsc.nspname         AS on_schema,
  c.relname           AS on_table,
  nf.nspname          AS function_schema,
  p.proname           AS function_name,
  t.tgenabled         AS enabled
FROM pg_trigger t
JOIN pg_class     c  ON c.oid = t.tgrelid
JOIN pg_namespace nsc ON nsc.oid = c.relnamespace
JOIN pg_proc      p  ON p.oid = t.tgfoid
JOIN pg_namespace nf ON nf.oid = p.pronamespace
WHERE t.tgname IN (
    'trg_studio_projects_subwaytakes_updated_at',
    'trg_studio_projects_subwaytakes_immutable_user',
    'trg_studio_render_jobs_subwaytakes_updated_at',
    'trg_studio_render_jobs_subwaytakes_immutable_user',
    'trg_studio_render_jobs_subwaytakes_guard_job_writes',
    'trg_muapi_caption_jobs_subwaytakes_updated_at',
    'trg_muapi_caption_jobs_subwaytakes_immutable_user',
    'trg_muapi_caption_jobs_subwaytakes_guard_job_writes')
  AND NOT t.tgisinternal
ORDER BY t.tgname;


-- ===== Q7: Conflict probe — Studio trigger functions (expect zero rows) =====
-- The three SubwayTakes-prefixed functions. Their prefixed names make a foreign
-- collision near-impossible, so any row almost certainly means a prior apply of
-- THIS migration (idempotent re-run is fine) — but confirm with the operator.
SELECT
  n.nspname                                   AS schema,
  p.proname,
  pg_get_function_identity_arguments(p.oid)   AS arguments,
  p.prosecdef                                 AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname IN ('subwaytakes_set_updated_at',
                    'subwaytakes_guard_immutable_user_id',
                    'subwaytakes_guard_job_writes')
ORDER BY p.proname;


-- ===== Q8: Conflict probe — Studio table policies (expect zero rows) =====
-- The 6 SubwayTakes-prefixed RLS policies on the three public tables. Any row
-- means a prior apply, or (very unlikely) another owner reusing the exact name.
SELECT schemaname, tablename, policyname, cmd, roles
FROM pg_policies
WHERE policyname IN (
    'subwaytakes_studio_projects_select_own',
    'subwaytakes_studio_projects_insert_own',
    'subwaytakes_studio_projects_update_own',
    'subwaytakes_studio_projects_delete_own',
    'subwaytakes_studio_render_jobs_select_own',
    'subwaytakes_muapi_caption_jobs_select_own')
ORDER BY tablename, policyname;


-- ===== Q9: Conflict probe — Studio storage policies (expect zero rows) =====
-- The 4 SubwayTakes-prefixed policies on storage.objects. storage.objects policy
-- names are shared cluster-wide, so a collision here is a real STOP condition.
SELECT schemaname, tablename, policyname, cmd, roles, qual
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname IN (
    'subwaytakes_studio_exports_read_own',
    'subwaytakes_studio_exports_insert_own',
    'subwaytakes_studio_uploads_read_own',
    'subwaytakes_studio_uploads_insert_own')
ORDER BY policyname;


-- ===== Q10: Conflict probe — Studio buckets (expect zero rows) =====
-- studio-exports / studio-uploads must be absent. The migration adopts an
-- existing bucket's settings unchanged, so a foreign owner of these ids would
-- silently give Studio another app's (possibly public / limited) bucket.
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id IN ('studio-exports', 'studio-uploads')
ORDER BY id;


-- ===== Q11: Sign-off conflict summary (EVERY value must be 0) =====
-- One row, the single GO signal for conflicts. Any non-zero cell = NO-GO; look
-- up the matching probe (Q4..Q10) for the offending object(s).
SELECT
  (SELECT count(*) FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name IN ('studio_projects','studio_render_jobs','muapi_caption_jobs'))
                                                                       AS studio_tables,
  (SELECT count(*) FROM pg_indexes
     WHERE indexname IN ('subwaytakes_idx_studio_projects_user_updated',
                         'subwaytakes_idx_studio_render_jobs_queue',
                         'subwaytakes_idx_studio_render_jobs_user',
                         'subwaytakes_uq_studio_render_jobs_active_per_project',
                         'subwaytakes_idx_muapi_caption_jobs_project',
                         'subwaytakes_idx_muapi_caption_jobs_user'))
                                                                       AS studio_indexes,
  (SELECT count(*) FROM pg_trigger t
     WHERE t.tgname IN ('trg_studio_projects_subwaytakes_updated_at',
                        'trg_studio_projects_subwaytakes_immutable_user',
                        'trg_studio_render_jobs_subwaytakes_updated_at',
                        'trg_studio_render_jobs_subwaytakes_immutable_user',
                        'trg_studio_render_jobs_subwaytakes_guard_job_writes',
                        'trg_muapi_caption_jobs_subwaytakes_updated_at',
                        'trg_muapi_caption_jobs_subwaytakes_immutable_user',
                        'trg_muapi_caption_jobs_subwaytakes_guard_job_writes')
       AND NOT t.tgisinternal)
                                                                       AS studio_triggers,
  (SELECT count(*) FROM pg_proc p
     WHERE p.proname IN ('subwaytakes_set_updated_at',
                         'subwaytakes_guard_immutable_user_id',
                         'subwaytakes_guard_job_writes'))
                                                                       AS studio_functions,
  (SELECT count(*) FROM pg_policies
     WHERE policyname IN ('subwaytakes_studio_projects_select_own',
                          'subwaytakes_studio_projects_insert_own',
                          'subwaytakes_studio_projects_update_own',
                          'subwaytakes_studio_projects_delete_own',
                          'subwaytakes_studio_render_jobs_select_own',
                          'subwaytakes_muapi_caption_jobs_select_own'))
                                                                       AS studio_table_policies,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'storage' AND tablename = 'objects'
       AND policyname IN ('subwaytakes_studio_exports_read_own',
                          'subwaytakes_studio_exports_insert_own',
                          'subwaytakes_studio_uploads_read_own',
                          'subwaytakes_studio_uploads_insert_own'))
                                                                       AS studio_storage_policies,
  (SELECT count(*) FROM storage.buckets
     WHERE id IN ('studio-exports','studio-uploads'))
                                                                       AS studio_buckets;


-- ===== Q12: Shared generic functions — informational definitions =====
-- update_updated_at_column() and immutable_user_id() are the generic names the
-- corrected migration deliberately does NOT define or replace (it uses only
-- subwaytakes_* functions). Reported here for the record with full definitions;
-- their presence or absence does NOT block the corrected migration. Earlier
-- docs (compat B1/B2) treated these as blockers; that is now resolved — do not
-- act on them for this migration.
SELECT
  n.nspname                                   AS schema,
  p.proname,
  pg_get_function_identity_arguments(p.oid)   AS arguments,
  p.prosecdef                                 AS security_definer,
  p.proconfig                                  AS config,
  pg_get_functiondef(p.oid)                   AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname IN ('update_updated_at_column', 'immutable_user_id')
ORDER BY n.nspname, p.proname;


-- ===== Q13: Other common VideoRemix functions — existence only =====
-- Which app owns each is unknown; simply record presence so the operator knows
-- what legacy/shared surface exists. None are required by the Studio editor.
SELECT
  n.nspname                                   AS schema,
  p.proname,
  pg_get_function_identity_arguments(p.oid)   AS arguments,
  p.prosecdef                                 AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname IN ('handle_new_user', 'deduct_credits',
                    'reorder_compilation_clips', 'get_analytics_summary',
                    'atomic_deduct_tokens', 'assign_episode_number')
ORDER BY p.proname;


-- ===== Q14: All storage buckets (flag conflict / B3 / legacy) =====
-- Full bucket inventory. studio-* rows would be a conflict (see Q10, expect
-- none); the videos row decides Blocker B3; legacy names are recorded for the
-- legacy flows. created_at is intentionally omitted so the query stays valid on
-- older storage schemas that lack it.
SELECT
  id, name, public, file_size_limit, allowed_mime_types,
  CASE
    WHEN id IN ('studio-exports','studio-uploads') THEN 'STUDIO-CONFLICT'
    WHEN id = 'videos'                          THEN 'B3-VIDEOS'
    WHEN id IN ('captions','template-logos','thumbnails','avatars') THEN 'legacy-shared'
    ELSE ''
  END AS flag
FROM storage.buckets
ORDER BY id;


-- ===== Q15: videos bucket — Blocker B3 disposition =====
-- Proves: does the shared generic "videos" bucket exist, is it public (Studio's
-- scene-status / muapi-captions call getPublicUrl), and what are its size/MIME
-- limits, plus how many objects live in it. Zero rows => bucket absent => the
-- AI-scene and MuAPI output paths have no home (decide before enabling them).
SELECT
  b.id,
  b.public,
  b.file_size_limit,
  b.allowed_mime_types,
  (SELECT count(*) FROM storage.objects o WHERE o.bucket_id = b.id) AS object_count
FROM storage.buckets b
WHERE b.id = 'videos';


-- ===== Q16: storage.objects policies currently defined =====
-- Names + predicates of every existing storage policy. Confirms no SubwayTakes
-- storage policy exists yet (consistent with Q9) and reveals other apps' rules.
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;


-- ===== Q17: auth.users counts — anonymous sign-in proxy =====
-- The definitive "anonymous sign-ins enabled" flag is a Dashboard setting, not
-- a SQL column; this reports what IS checkable: total user rows and the count of
-- is_anonymous users. is_anonymous > 0 strongly implies anonymous sign-ins are
-- enabled and in use; 0 is inconclusive until the operator checks the toggle.
SELECT
  (SELECT count(*) FROM auth.users)                AS total_users,
  (SELECT count(*) FROM auth.users WHERE is_anonymous) AS anonymous_users;


-- ===== Q18: auth.users event / provisioning triggers =====
-- Every non-internal trigger on auth.users. Any on_auth_user_created-style
-- trigger (repo history installs on_auth_user_created -> public.handle_new_user()
-- provisioning user_profiles for EVERY new user) must be reported: Studio must
-- neither depend on it nor collide with it. The Studio migration adds none.
SELECT
  t.tgname        AS trigger_name,
  t.tgenabled     AS enabled,
  nf.nspname      AS function_schema,
  p.proname       AS function_name
FROM pg_trigger t
JOIN pg_class     c  ON c.oid = t.tgrelid
JOIN pg_proc      p  ON p.oid = t.tgfoid
JOIN pg_namespace nf ON nf.oid = p.pronamespace
WHERE c.oid = to_regclass('auth.users')
  AND NOT t.tgisinternal
ORDER BY t.tgname;


-- ===== Q19: user_profiles columns — types, nullability, defaults =====
-- The exact shape the auth.tsx provisioning ladder reads/upserts. Compare with
-- the expected set: id, display_name, avatar_url, default_city_style,
-- default_duration, credits_balance, subscription_tier, created_at, updated_at.
-- The last column (expected_column_present) flags each expected upsert column.
SELECT
  column_name, data_type, is_nullable, column_default, ordinal_position,
  column_name IN ('id','display_name','avatar_url','default_city_style',
                  'default_duration','credits_balance','subscription_tier',
                  'created_at','updated_at') AS is_expected_column
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'user_profiles'
ORDER BY ordinal_position;


-- ===== Q20: user_profiles existence, RLS and privilege state =====
-- plus the NOT-NULL-without-default column count, which is the one shape that
-- breaks even the auth.tsx minimal { id } upsert. has_table_privilege() returns
-- NULL (not an error) while the table is absent, so this is safe pre-apply.
SELECT
  to_regclass('public.user_profiles') IS NOT NULL                    AS user_profiles_exists,
  COALESCE((SELECT c.relrowsecurity
              FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relname = 'user_profiles'), FALSE) AS rls_enabled,
  (SELECT count(*) FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'user_profiles'
       AND is_nullable = 'NO' AND column_default IS NULL)            AS not_null_no_default_columns,
  has_table_privilege('anon',          to_regclass('public.user_profiles'), 'SELECT') AS anon_select,
  has_table_privilege('anon',          to_regclass('public.user_profiles'), 'INSERT') AS anon_insert,
  has_table_privilege('authenticated', to_regclass('public.user_profiles'), 'SELECT') AS authenticated_select,
  has_table_privilege('authenticated', to_regclass('public.user_profiles'), 'INSERT') AS authenticated_insert,
  has_table_privilege('authenticated', to_regclass('public.user_profiles'), 'UPDATE') AS authenticated_update;


-- ===== Q21: user_profiles policies =====
-- Whether the signed-in user can read and write its own row.
-- A policy here should scope to auth.uid(); a USING(true) / anon policy would be
-- a shared-DB concern to record.
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'user_profiles'
ORDER BY policyname;


-- ===== Q22: Privilege pattern on a sample existing shared table =====
-- Confirms the assumed Supabase default privileges exist on real shared tables:
-- anon reads only; authenticated has read and write; service_role reads
-- everything. Picks the first present of a candidate list.
-- Zero rows => none of the candidates exist (itself informative).
WITH cand AS (
  SELECT 'clips'         AS t WHERE to_regclass('public.clips')          IS NOT NULL
  UNION ALL SELECT 'episodes'    WHERE to_regclass('public.episodes')    IS NOT NULL
  UNION ALL SELECT 'user_profiles' WHERE to_regclass('public.user_profiles') IS NOT NULL
  UNION ALL SELECT 'legacy_clips' WHERE to_regclass('public.legacy_clips')   IS NOT NULL
),
picked AS (
  SELECT t FROM cand
  ORDER BY CASE t WHEN 'clips' THEN 1 WHEN 'episodes' THEN 2
                  WHEN 'user_profiles' THEN 3 ELSE 4 END
  LIMIT 1
)
SELECT
  p.t                                                                AS sample_table,
  has_table_privilege('anon',          to_regclass('public.'||p.t), 'SELECT') AS anon_select,
  has_table_privilege('anon',          to_regclass('public.'||p.t), 'INSERT') AS anon_insert,
  has_table_privilege('authenticated', to_regclass('public.'||p.t), 'SELECT') AS authenticated_select,
  has_table_privilege('authenticated', to_regclass('public.'||p.t), 'INSERT') AS authenticated_insert,
  has_table_privilege('authenticated', to_regclass('public.'||p.t), 'UPDATE') AS authenticated_update,
  has_table_privilege('authenticated', to_regclass('public.'||p.t), 'DELETE') AS authenticated_delete,
  has_table_privilege('service_role',  to_regclass('public.'||p.t), 'SELECT') AS service_role_select
FROM picked p;


-- ===== Q23: Studio-table grants must be N/A (expect all table_exists=false) =====
-- The three migration tables must be absent, so every privilege probe returns
-- NULL and table_exists is false for all three. A true here means the table
-- already exists (see Q4). Confirms N/A by construction, not by opinion.
SELECT 'studio_projects'    AS studio_table, to_regclass('public.studio_projects')    IS NOT NULL AS table_exists, has_table_privilege('authenticated', to_regclass('public.studio_projects'),    'SELECT') AS authenticated_select
UNION ALL SELECT 'studio_render_jobs',   to_regclass('public.studio_render_jobs')   IS NOT NULL, has_table_privilege('authenticated', to_regclass('public.studio_render_jobs'),   'SELECT')
UNION ALL SELECT 'muapi_caption_jobs',   to_regclass('public.muapi_caption_jobs')   IS NOT NULL, has_table_privilege('authenticated', to_regclass('public.muapi_caption_jobs'),   'SELECT')
ORDER BY studio_table;


-- ===== Q24: auth.uid() policy pattern in active use elsewhere =====
-- A sample of non-Studio public policies that scope rows with auth.uid().
-- Confirms the shared project already uses the auth.uid()::text = <col>::text
-- convention the Studio migration follows (house-style match). Zero rows is not
-- a failure, only weaker evidence.
SELECT schemaname, tablename, policyname, cmd, roles, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual ILIKE '%auth.uid()%' OR with_check ILIKE '%auth.uid()%')
ORDER BY tablename, policyname
LIMIT 20;
