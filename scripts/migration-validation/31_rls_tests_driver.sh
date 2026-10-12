#!/usr/bin/env bash
# =====================================================================
# 31_rls_tests_driver.sh — runs 30_rls_tests.sql, greps the TEST result
# lines, reports PASS/FAIL counts, exits non-zero on any failure.
#
# Usage: 31_rls_tests_driver.sh [output_dir]
# =====================================================================
set -uo pipefail

DB="subwaytakes_migration_test"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="${1:-$HERE/logs}"
mkdir -p "$OUT"

runuser -u postgres -- psql -X -v ON_ERROR_STOP=1 -d "$DB" -f "$HERE/30_rls_tests.sql" \
  > "$OUT/rls_tests.log" 2>&1
psql_rc=$?

echo "psql exit code: $psql_rc"
echo "---- TEST RESULTS ----"
grep -E '^psql:.*TEST |TEST [A-Z]|SUMMARY_|FAILED_TESTS' "$OUT/rls_tests.log" || true

pass=$(grep -cE 'TEST [^:]+: PASS' "$OUT/rls_tests.log" || true)
fail=$(grep -cE 'TEST [^:]+: FAIL' "$OUT/rls_tests.log" || true)
errors=$(grep -cE '^(psql:.*ERROR|ERROR:)' "$OUT/rls_tests.log" || true)

echo "---- COUNTS ----"
echo "PASS=$pass FAIL=$fail PSQL_ERRORS=$errors"

if [ "$psql_rc" -ne 0 ] || [ "$fail" -ne 0 ] || [ "$errors" -ne 0 ]; then
  echo "RESULT: FAIL"
  exit 1
fi
echo "RESULT: PASS"
exit 0
