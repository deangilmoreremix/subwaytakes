-- =====================================================================
-- 20_inventory.sql — object inventory produced by the Studio migration
-- Run as postgres against the scratch database at any point.
-- Prints (with section markers so it can be grepped/diffed):
--   TABLES / POLICIES / TRIGGERS / FUNCTIONS / INDEXES / BUCKETS
-- plus the decoy function definitions (byte-identical coexistence proof)
-- and the untouched pre-existing table.
-- =====================================================================

\echo ===INVENTORY_BEGIN===

\echo '--- TABLES (public schema) ---'
SELECT c.relkind, c.relname, n.nspname
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
ORDER BY c.relname;

\echo '--- STUDIO TABLE COLUMNS ---'
SELECT table_name, ordinal_position, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('studio_projects','studio_render_jobs','muapi_caption_jobs')
ORDER BY table_name, ordinal_position;

\echo '--- POLICIES ---'
SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname IN ('public','storage')
ORDER BY schemaname, tablename, policyname;

\echo '--- POLICY COUNT ---'
SELECT count(*) AS policy_count FROM pg_policies
WHERE policyname IN (
  'subwaytakes_studio_projects_select_own','subwaytakes_studio_projects_insert_own',
  'subwaytakes_studio_projects_update_own','subwaytakes_studio_projects_delete_own',
  'subwaytakes_studio_render_jobs_select_own',
  'subwaytakes_muapi_caption_jobs_select_own',
  'subwaytakes_studio_exports_read_own','subwaytakes_studio_exports_insert_own',
  'subwaytakes_studio_uploads_read_own','subwaytakes_studio_uploads_insert_own');

\echo '--- TRIGGERS ---'
SELECT c.relname AS on_table, t.tgname, p.proname AS function
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE NOT t.tgisinternal
  AND c.relnamespace = 'public'::regnamespace
ORDER BY c.relname, t.tgname;

\echo '--- FUNCTIONS (migration-created + decoys) ---'
SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args,
       p.prosecdef AS security_definer
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname IN ('subwaytakes_set_updated_at','subwaytakes_guard_immutable_user_id',
                    'subwaytakes_guard_job_writes',
                    'update_updated_at_column','immutable_user_id',
                    'uid','foldername')
ORDER BY n.nspname, p.proname;

\echo '--- INDEXES (public schema) ---'
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

\echo '--- BUCKETS ---'
SELECT id, name, public FROM storage.buckets ORDER BY id;

\echo '--- RLS ENABLED FLAG ---'
SELECT c.relname, c.relrowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('studio_projects','studio_render_jobs','muapi_caption_jobs')
ORDER BY c.relname;

\echo '--- ANON PRIVILEGES ON STUDIO TABLES (REVOKE proof) ---'
SELECT t.table_name,
       has_table_privilege('anon', ('public.'||t.table_name)::regclass, 'INSERT') AS anon_insert,
       has_table_privilege('anon', ('public.'||t.table_name)::regclass, 'UPDATE') AS anon_update,
       has_table_privilege('anon', ('public.'||t.table_name)::regclass, 'DELETE') AS anon_delete,
       has_table_privilege('anon', ('public.'||t.table_name)::regclass, 'SELECT') AS anon_select
FROM (VALUES ('studio_projects'),('studio_render_jobs'),('muapi_caption_jobs')) AS t(table_name)
WHERE to_regclass('public.'||t.table_name) IS NOT NULL
ORDER BY t.table_name;

\echo '--- PRE-EXISTING SHARED TABLE UNTOUCHED ---'
SELECT count(*) AS legacy_clips_rows FROM public.legacy_clips;

\echo '--- DECOY FUNCTION: pg_get_functiondef(update_updated_at_column) ---'
SELECT pg_get_functiondef(p.oid)
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'update_updated_at_column';

\echo '--- DECOY FUNCTION: pg_get_functiondef(immutable_user_id) ---'
SELECT pg_get_functiondef(p.oid)
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'immutable_user_id';

\echo ===INVENTORY_END===
