#!/usr/bin/env bash
# Runs the credits migration and its assertions against a throwaway local Postgres (needs postgres 16 binaries and root or the postgres user).
# Also runs the concurrency test (two sessions racing for the same credits). Usage: scripts/test-credits-sql.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)"
# The postgres user must be able to reach the directory, so this uses a throwaway mktemp dir (removed on exit).
WORK="$(mktemp -d /tmp/credits-pgtest.XXXXXX)"
PORT=54329
run_pg() { if [ "$(id -u)" = 0 ]; then runuser -u postgres -- "$@"; else "$@"; fi; }
cleanup() { run_pg "$PGBIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT
chmod 755 "$WORK"; [ "$(id -u)" = 0 ] && chown postgres "$WORK"

run_pg "$PGBIN/initdb" -D "$WORK/data" -A trust -U postgres >/dev/null
run_pg "$PGBIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" -w start >/dev/null
PSQL=(psql -h "$WORK" -p "$PORT" -U postgres -X -q -v ON_ERROR_STOP=1)
"${PSQL[@]}" -c "CREATE DATABASE t" >/dev/null
PSQL+=(-d t)

"${PSQL[@]}" -f "$ROOT/supabase/tests/bootstrap.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT/supabase/migrations/20261120000000_credits_ledger.sql" >/dev/null
echo "migration applied"

# Applying the migration twice must be safe (idempotent apply).
"${PSQL[@]}" -f "$ROOT/supabase/migrations/20261120000000_credits_ledger.sql" >/dev/null 2>"$WORK/second.err" || { echo "FAIL: migration is not re-runnable"; cat "$WORK/second.err"; exit 1; }
echo "PASS: migration can be re-applied"

"${PSQL[@]}" -f "$ROOT/supabase/tests/credits.sql" 2>&1 | grep -E "PASS|FAIL|ERROR" | sed 's/^psql:[^ ]* //'

# ---- concurrency: 12 sessions race to reserve 40 credits each from a 100 credit balance. At most 2 may win.
"${PSQL[@]}" -c "INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-0000000000c1', 'race@example.com'); INSERT INTO user_profiles (id) VALUES ('00000000-0000-0000-0000-0000000000c1'); SET ROLE service_role; SELECT credit_apply('00000000-0000-0000-0000-0000000000c1', 100, 'grant', 'race', 'race-grant');" >/dev/null
"${PSQL[@]}" -c "UPDATE gateway_settings SET max_open_holds = 50, max_calls_per_minute = 500;" >/dev/null
for i in $(seq 1 12); do
  ( "${PSQL[@]}" -At -c "SET ROLE service_role; SELECT 'won' FROM credit_reserve('00000000-0000-0000-0000-0000000000c1', 40, 'x', 'race-$i');" >"$WORK/race-$i.out" 2>/dev/null || true ) &
done
wait
WON=$(cat "$WORK"/race-*.out | grep -c won || true)
BAL=$("${PSQL[@]}" -At -c "SELECT credits_balance FROM user_profiles WHERE id = '00000000-0000-0000-0000-0000000000c1'")
SUM=$("${PSQL[@]}" -At -c "SELECT sum(delta) FROM credit_ledger WHERE user_id = '00000000-0000-0000-0000-0000000000c1'")
if [ "$WON" -eq 2 ] && [ "$BAL" -eq 20 ] && [ "$BAL" -eq "$SUM" ]; then echo "PASS: concurrent reserves cannot overdraw (2 of 12 won, balance $BAL, ledger $SUM)"; else echo "FAIL: concurrency (won=$WON balance=$BAL ledger=$SUM)"; exit 1; fi

# ---- concurrency: settle and release racing for the same request: exactly one outcome, never a refund after delivery.
"${PSQL[@]}" -At -c "SET ROLE service_role; SELECT credit_apply('00000000-0000-0000-0000-0000000000c1', 100, 'grant', 'race2', 'race-grant-2'); SELECT hold_id FROM credit_reserve('00000000-0000-0000-0000-0000000000c1', 30, 'x', 'race-settle');" >"$WORK/hold.out"
HOLD=$(tail -1 "$WORK/hold.out")
"${PSQL[@]}" -c "SET ROLE service_role; SELECT credit_attach_request('$HOLD', 'race-req', 0.1);" >/dev/null
( "${PSQL[@]}" -At -c "SET ROLE service_role; SELECT credit_settle('race-req');" >"$WORK/s.out" ) &
( "${PSQL[@]}" -At -c "SET ROLE service_role; SELECT credit_release('race-req', 'race');" >"$WORK/r.out" ) &
wait
BAL2=$("${PSQL[@]}" -At -c "SELECT credits_balance FROM user_profiles WHERE id = '00000000-0000-0000-0000-0000000000c1'")
SUM2=$("${PSQL[@]}" -At -c "SELECT sum(delta) FROM credit_ledger WHERE user_id = '00000000-0000-0000-0000-0000000000c1'")
ST=$("${PSQL[@]}" -At -c "SELECT status FROM muapi_calls WHERE request_id = 'race-req'")
# before: 20 + 100 - 30 = 90. settle wins: 90 and completed. release wins: 120 and failed.
if { [ "$ST" = completed ] && [ "$BAL2" -eq 90 ]; } || { [ "$ST" = failed ] && [ "$BAL2" -eq 120 ]; }; then
  [ "$BAL2" -eq "$SUM2" ] && echo "PASS: settle vs release race ends in exactly one consistent state ($ST, balance $BAL2)" || { echo "FAIL: ledger mismatch after race"; exit 1; }
else echo "FAIL: settle vs release race ($ST, balance $BAL2)"; exit 1; fi
echo "ALL SQL TESTS PASSED"
