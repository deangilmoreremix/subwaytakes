#!/usr/bin/env bash
# =====================================================================
# run_all.sh — full validation pipeline on a FRESH scratch database.
#
#   1. recreate scratch DB subwaytakes_migration_test
#   2. apply 00_substrate.sql (mock Supabase substrate + decoys + seeds)
#   3. inventory BEFORE the migration (decoy baseline)
#   4. 10_apply_studio_migration.sh (apply + re-apply + idempotency)
#   5. decoy byte-identical diff (before vs after)
#   6. 31_rls_tests_driver.sh (RLS/behaviour suite)
#   7. 40_rollback_test.sh (rollback -> re-apply -> re-run suite)
#   8. 50_static_compat_check.sh (worker/frontend column compatibility)
#
# All output is captured under scripts/migration-validation/logs/.
# =====================================================================
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="$HERE/logs"
mkdir -p "$OUT"
rm -f "$OUT"/*.log "$OUT"/*.txt

DB="subwaytakes_migration_test"

decoy_section() { sed -n '/DECOY FUNCTION: pg_get_functiondef(update_updated_at_column)/,/===INVENTORY_END===/p' "$1"; }

echo "############ 1. FRESH DATABASE ############"
runuser -u postgres -- dropdb --if-exists "$DB"
runuser -u postgres -- createdb "$DB"
runuser -u postgres -- psql -X -v ON_ERROR_STOP=1 -d "$DB" -c 'select version();' 2>&1 | tee "$OUT/version.log"

echo "############ 2. SUBSTRATE ############"
runuser -u postgres -- psql -X -v ON_ERROR_STOP=1 -d "$DB" -f "$HERE/00_substrate.sql" 2>&1 | tee "$OUT/substrate.log"

echo "############ 3. INVENTORY BEFORE MIGRATION (decoy baseline) ############"
runuser -u postgres -- psql -X -v ON_ERROR_STOP=1 -d "$DB" -f "$HERE/20_inventory.sql" 2>&1 | tee "$OUT/inventory_before_migration.log" > /dev/null

echo "############ 4. APPLY + RE-APPLY (idempotency) ############"
"$HERE/10_apply_studio_migration.sh" "$OUT" > "$OUT/apply_driver.log" 2>&1
apply_rc=$?
tail -12 "$OUT/apply_driver.log"

echo "############ 5. DECOY BYTE-IDENTICAL DIFF ############"
if diff <(decoy_section "$OUT/inventory_before_migration.log") \
        <(decoy_section "$OUT/inventory_after_2.log") > "$OUT/decoy_diff.txt"; then
  echo "PASS: decoy functions byte-identical before vs after migration (diff empty)"
  md5_before=$(decoy_section "$OUT/inventory_before_migration.log" | md5sum | cut -d' ' -f1)
  md5_after=$(decoy_section "$OUT/inventory_after_2.log" | md5sum | cut -d' ' -f1)
  echo "decoy-definition md5 before=$md5_before after=$md5_after"
else
  echo "FAIL: decoy function definitions changed:"
  cat "$OUT/decoy_diff.txt"
fi

echo "############ 6. RLS TEST SUITE ############"
"$HERE/31_rls_tests_driver.sh" "$OUT" > "$OUT/rls_driver.log" 2>&1
rls_rc=$?
grep -E 'SUMMARY_|COUNTS|RESULT' "$OUT/rls_driver.log"

echo "############ 7. ROLLBACK -> RE-APPLY ############"
"$HERE/40_rollback_test.sh" "$OUT" > "$OUT/rollback_driver.log" 2>&1
rb_rc=$?
grep -E '^== \[|PASS:|FAIL:|SUMMARY_PASSED|SUMMARY_FAILED|RESULT' "$OUT/rollback_driver.log"

echo "############ 8. STATIC COMPATIBILITY CHECK ############"
"$HERE/50_static_compat_check.sh" "$OUT" 2>&1 | tee "$OUT/static_compat.log"
static_rc=$?

echo "############ SUMMARY ############"
echo "apply/idempotency rc=$apply_rc  rls rc=$rls_rc  rollback rc=$rb_rc  static rc=$static_rc"
[ "$apply_rc" -eq 0 ] && [ "$rls_rc" -eq 0 ] && [ "$rb_rc" -eq 0 ] && [ "$static_rc" -eq 0 ] \
  && echo "ALL GREEN" || echo "SOMETHING FAILED"
