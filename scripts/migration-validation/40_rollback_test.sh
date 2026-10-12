#!/usr/bin/env bash
# =====================================================================
# 40_rollback_test.sh — rollback -> re-apply proof.
#
# Applies the rollback SQL for the shared DB. The rollback in
# docs/SHARED_DB_COMPATIBILITY.md §5.2 is prose and references object
# names that the CORRECTED migration renamed (see FINDINGS printed by
# this script). The SQL below is the adapted rollback using the ACTUAL
# names created by 20261011090000_studio_projects_and_render_jobs.sql:
#
#   doc §5.2 says                       actual migration object
#   ---------------------------------   ----------------------------------
#   trg_studio_projects_updated_at      trg_studio_projects_subwaytakes_updated_at
#   (etc. for all 6 triggers)           (+ trg_*_subwaytakes_guard_job_writes x2)
#   studio_projects_select_own          subwaytakes_studio_projects_select_own
#   (etc. for all 12 table policies)    (10 subwaytakes_* policies total)
#   idx_studio_projects_user_updated    subwaytakes_idx_studio_projects_user_updated
#   studio_exports_read_own             subwaytakes_studio_exports_read_own
#   (etc. for all 4 storage policies)   (4 subwaytakes_* storage policies)
#   subwaytakes_touch_updated_at()      subwaytakes_set_updated_at()
#   subwaytakes_immutable_user_id()     subwaytakes_guard_immutable_user_id()
#   (not mentioned in doc)              subwaytakes_guard_job_writes()
#
# Rollback actions (per §5.2, adapted): drop the 4 storage policies ->
# delete storage objects + the 2 bucket rows -> DROP the 3 tables
# CASCADE -> drop the 3 prefixed functions. Nothing shared/generic
# (update_updated_at_column, immutable_user_id) is ever touched.
# =====================================================================
set -euo pipefail

DB="subwaytakes_migration_test"
MIGRATION="/workspace/app/supabase/migrations/20261011090000_studio_projects_and_render_jobs.sql"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="${1:-$HERE/logs}"
mkdir -p "$OUT"

psql_q() { runuser -u postgres -- psql -X -v ON_ERROR_STOP=1 -d "$DB" "$@"; }

inventory() { psql_q -f "$HERE/20_inventory.sql" 2>&1; }

echo "== [0] inventory BEFORE rollback =="
inventory | tee "$OUT/inventory_before_rollback.log" > /dev/null

echo "== [1] ROLLBACK (adapted from docs/SHARED_DB_COMPATIBILITY.md §5.2) =="
psql_q 2>&1 <<'SQL' | tee "$OUT/rollback.log"
-- 4 storage.objects policies (actual names)
DROP POLICY IF EXISTS "subwaytakes_studio_exports_read_own" ON storage.objects;
DROP POLICY IF EXISTS "subwaytakes_studio_exports_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "subwaytakes_studio_uploads_read_own" ON storage.objects;
DROP POLICY IF EXISTS "subwaytakes_studio_uploads_insert_own" ON storage.objects;
-- objects + bucket rows
DELETE FROM storage.objects WHERE bucket_id IN ('studio-exports', 'studio-uploads');
DELETE FROM storage.buckets WHERE id IN ('studio-exports', 'studio-uploads');
-- 3 tables CASCADE (reverse FK order: caption jobs -> render jobs -> projects)
DROP TABLE IF EXISTS public.muapi_caption_jobs CASCADE;
DROP TABLE IF EXISTS public.studio_render_jobs CASCADE;
DROP TABLE IF EXISTS public.studio_projects CASCADE;
-- prefixed functions only (decoy functions update_updated_at_column /
-- immutable_user_id are NEVER dropped)
DROP FUNCTION IF EXISTS public.subwaytakes_guard_job_writes();
DROP FUNCTION IF EXISTS public.subwaytakes_guard_immutable_user_id();
DROP FUNCTION IF EXISTS public.subwaytakes_set_updated_at();
SQL

echo "== [2] verify rollback: 0 studio objects, decoys + shared table intact =="
psql_q -f "$HERE/20_inventory.sql" 2>&1 | tee "$OUT/inventory_after_rollback.log" > /dev/null

psql_q <<'SQL'
SELECT
  (SELECT count(*) FROM information_schema.tables WHERE table_schema='public'
     AND table_name IN ('studio_projects','studio_render_jobs','muapi_caption_jobs')) AS studio_tables,
  (SELECT count(*) FROM pg_policies WHERE policyname LIKE 'subwaytakes_%') AS studio_policies,
  (SELECT count(*) FROM pg_trigger t WHERE t.tgname LIKE 'trg_studio_%' OR t.tgname LIKE 'trg_muapi_%') AS studio_triggers,
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname LIKE 'subwaytakes_%') AS studio_functions,
  (SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND indexname LIKE 'subwaytakes_%') AS studio_indexes,
  (SELECT count(*) FROM storage.buckets WHERE id IN ('studio-exports','studio-uploads')) AS studio_buckets,
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname IN ('update_updated_at_column','immutable_user_id')) AS decoys_still_present,
  (SELECT count(*) FROM public.legacy_clips) AS legacy_clips_rows;
SQL

echo "== [3] RE-APPLY migration =="
psql_q -f "$MIGRATION" 2>&1 | tee "$OUT/reapply.log" > /dev/null

echo "== [4] inventory AFTER re-apply =="
inventory | tee "$OUT/inventory_after_reapply.log" > /dev/null

echo "== [5] compare pre-rollback vs post-re-apply inventory =="
if diff <(sed -n '/===INVENTORY_BEGIN===/,/===INVENTORY_END===/p' "$OUT/inventory_before_rollback.log") \
        <(sed -n '/===INVENTORY_BEGIN===/,/===INVENTORY_END===/p' "$OUT/inventory_after_reapply.log") \
        > "$OUT/rollback_reapply_diff.txt"; then
  echo "PASS: rollback -> re-apply reproduces the identical object inventory"
else
  echo "FAIL: inventory differs after rollback -> re-apply:"
  cat "$OUT/rollback_reapply_diff.txt"
  exit 1
fi

echo "== [6] re-run RLS suite against the re-applied schema =="
"$HERE/31_rls_tests_driver.sh" "$OUT" 2>&1 | tee "$OUT/rls_tests_after_reapply.log" | tail -5
rc=${PIPESTATUS[0]}
if [ "$rc" -ne 0 ]; then
  echo "FAIL: RLS suite failed after re-apply"
  exit 1
fi
echo "PASS: RLS suite green after rollback -> re-apply"
exit 0
