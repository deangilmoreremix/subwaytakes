#!/usr/bin/env bash
# =====================================================================
# 10_apply_studio_migration.sh
# Applies the target migration ONCE, captures the inventory, RE-APPLIES
# the same file to prove idempotency (second run must exit 0, produce no
# errors, and leave object counts unchanged), and captures the inventory
# again.
#
# Usage: 10_apply_studio_migration.sh [output_dir]
# =====================================================================
set -euo pipefail

DB="subwaytakes_migration_test"
MIGRATION="/workspace/app/supabase/migrations/20261011090000_studio_projects_and_render_jobs.sql"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="${1:-$HERE/logs}"
mkdir -p "$OUT"

psql_q() { runuser -u postgres -- psql -X -v ON_ERROR_STOP=1 -d "$DB" "$@"; }

counts_sql() {
  cat <<'SQL'
SELECT 'tables='  || (SELECT count(*) FROM information_schema.tables
                      WHERE table_schema='public' AND table_name IN
                      ('studio_projects','studio_render_jobs','muapi_caption_jobs')),
       'policies=' || (SELECT count(*) FROM pg_policies WHERE policyname LIKE 'subwaytakes_%'),
       'triggers=' || (SELECT count(*) FROM pg_trigger t
                       JOIN pg_class c ON c.oid=t.tgrelid
                       WHERE t.tgname LIKE 'trg_studio_%' OR t.tgname LIKE 'trg_muapi_%'),
       'functions=' || (SELECT count(*) FROM pg_proc p
                        JOIN pg_namespace n ON n.oid=p.pronamespace
                        WHERE n.nspname='public' AND p.proname LIKE 'subwaytakes_%'),
       'indexes=' || (SELECT count(*) FROM pg_indexes
                      WHERE schemaname='public' AND indexname LIKE 'subwaytakes_%'),
       'buckets=' || (SELECT count(*) FROM storage.buckets
                      WHERE id IN ('studio-exports','studio-uploads')),
       'decoys=' || (SELECT count(*) FROM pg_proc p
                     JOIN pg_namespace n ON n.oid=p.pronamespace
                     WHERE n.nspname='public'
                       AND p.proname IN ('update_updated_at_column','immutable_user_id'));
SQL
}

echo "== APPLY #1 (target migration) =="
psql_q -f "$MIGRATION" 2>&1 | tee "$OUT/apply_1.log"

echo "== INVENTORY after apply #1 =="
psql_q -f "$HERE/20_inventory.sql" 2>&1 | tee "$OUT/inventory_after_1.log"

echo "== APPLY #2 (idempotency re-run — must be a no-op) =="
psql_q -f "$MIGRATION" 2>&1 | tee "$OUT/apply_2.log"

echo "== INVENTORY after apply #2 =="
psql_q -f "$HERE/20_inventory.sql" 2>&1 | tee "$OUT/inventory_after_2.log"

echo "== OBJECT COUNTS =="
{ echo "after_apply_1:"; psql_q -c "$(counts_sql)"; echo "after_apply_2:"; psql_q -c "$(counts_sql)"; } \
  2>&1 | tee "$OUT/counts.log"

# Idempotency checks -----------------------------------------------------
fail=0
if grep -Eiq '\berror\b' "$OUT/apply_1.log"; then echo "FAIL: errors in apply #1"; fail=1; fi
if grep -Eiq '\berror\b' "$OUT/apply_2.log"; then echo "FAIL: errors in apply #2"; fail=1; fi
if ! diff <(sed -n '/===INVENTORY_BEGIN===/,/===INVENTORY_END===/p' "$OUT/inventory_after_1.log") \
        <(sed -n '/===INVENTORY_BEGIN===/,/===INVENTORY_END===/p' "$OUT/inventory_after_2.log") \
        > "$OUT/inventory_diff.txt"; then
  echo "FAIL: inventory changed between apply #1 and apply #2"
  cat "$OUT/inventory_diff.txt"; fail=1
else
  echo "PASS: idempotent — inventory identical after re-apply (diff empty)"
fi

exit $fail
