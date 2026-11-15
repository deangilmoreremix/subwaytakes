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
BILLING="$ROOT/supabase/migrations/20261121000000_checkout_entitlements.sql"
"${PSQL[@]}" -f "$BILLING" >/dev/null
echo "billing migration applied"

# Applying the migrations twice must be safe (idempotent apply).
"${PSQL[@]}" -f "$BILLING" >/dev/null 2>"$WORK/second-billing.err" || { echo "FAIL: billing migration is not re-runnable"; cat "$WORK/second-billing.err"; exit 1; }
echo "PASS: billing migration can be re-applied"
"${PSQL[@]}" -f "$ROOT/supabase/migrations/20261120000000_credits_ledger.sql" >/dev/null 2>"$WORK/second.err" || { echo "FAIL: migration is not re-runnable"; cat "$WORK/second.err"; exit 1; }
echo "PASS: migration can be re-applied"

"${PSQL[@]}" -f "$ROOT/supabase/tests/credits.sql" 2>&1 | grep -E "PASS|FAIL|ERROR" | sed 's/^psql:[^ ]* //'
"${PSQL[@]}" -f "$ROOT/supabase/tests/billing.sql" 2>&1 | grep -E "PASS|FAIL|ERROR" | sed 's/^psql:[^ ]* //'

# ---- re-applying the migration AFTER launch (users with grants and spends) must not change anyone's balance or add ledger rows.
BEFORE=$("${PSQL[@]}" -At -c "SELECT (SELECT count(*) FROM credit_ledger) || ',' || (SELECT sum(credits_balance) FROM user_profiles) || ',' || (SELECT count(*) FROM credit_ledger WHERE kind = 'opening')")
"${PSQL[@]}" -f "$ROOT/supabase/migrations/20261120000000_credits_ledger.sql" >/dev/null 2>&1 || { echo "FAIL: re-apply after activity errored"; exit 1; }
AFTER=$("${PSQL[@]}" -At -c "SELECT (SELECT count(*) FROM credit_ledger) || ',' || (SELECT sum(credits_balance) FROM user_profiles) || ',' || (SELECT count(*) FROM credit_ledger WHERE kind = 'opening')")
BAD=$("${PSQL[@]}" -At -c "SELECT count(*) FROM user_profiles p WHERE p.credits_balance IS DISTINCT FROM (SELECT COALESCE(sum(delta), 0) FROM credit_ledger l WHERE l.user_id = p.id)")
if [ "$BEFORE" = "$AFTER" ] && [ "$BAD" -eq 0 ]; then echo "PASS: re-applying the migration after launch changes no balance and adds no ledger rows ($AFTER)"; else echo "FAIL: re-apply after activity changed state ($BEFORE -> $AFTER, drifted users: $BAD)"; exit 1; fi

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

# ---- re-applying the billing migration keeps an operator's price edit and adds no products back
"${PSQL[@]}" -c "UPDATE products SET price_cents = 4200 WHERE key = 'starter'" >/dev/null
"${PSQL[@]}" -f "$BILLING" >/dev/null
P=$("${PSQL[@]}" -At -c "SELECT price_cents FROM products WHERE key = 'starter'")
[ "$P" -eq 4200 ] && echo "PASS: re-applying keeps the operator's product edits" || { echo "FAIL: product edit lost on re-apply ($P)"; exit 1; }

# ---- concurrency: 10 duplicate webhook deliveries for the same paid session grant exactly once.
"${PSQL[@]}" -c "INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-0000000000e1', 'dup@example.com'); INSERT INTO user_profiles (id) VALUES ('00000000-0000-0000-0000-0000000000e1'); SELECT order_attach_session((SELECT order_id FROM order_create_pending('00000000-0000-0000-0000-0000000000e1', 'credits_s')), 'cs_race');" >/dev/null
for i in $(seq 1 10); do
  ( "${PSQL[@]}" -At -c "SELECT order_fulfil('cs_race', 'pi_race', 1000, 'usd');" >"$WORK/ful-$i.out" 2>/dev/null || true ) &
done
wait
NF=$(cat "$WORK"/ful-*.out | grep -c fulfilled || true)
BE=$("${PSQL[@]}" -At -c "SELECT credits_balance FROM user_profiles WHERE id = '00000000-0000-0000-0000-0000000000e1'")
if [ "$NF" -eq 1 ] && [ "$BE" -eq 1000 ]; then echo "PASS: 10 concurrent duplicate deliveries granted once (balance $BE)"; else echo "FAIL: duplicate fulfilment (fulfilled=$NF balance=$BE)"; exit 1; fi

# ---- concurrency: a refund racing a spend never takes the balance negative and the ledger still balances.
( "${PSQL[@]}" -At -c "SELECT order_reverse('pi_race', 'refunded', 'race');" >"$WORK/rev.out" 2>/dev/null || true ) &
( "${PSQL[@]}" -At -c "SET ROLE service_role; SELECT credit_apply('00000000-0000-0000-0000-0000000000e1', -600, 'adjust', 'spend race', 'spend-race');" >"$WORK/spend.out" 2>/dev/null || true ) &
wait
NEG=$("${PSQL[@]}" -At -c "SELECT count(*) FROM user_profiles p WHERE p.credits_balance < 0 OR p.credits_balance IS DISTINCT FROM (SELECT COALESCE(sum(delta), 0) FROM credit_ledger l WHERE l.user_id = p.id)")
[ "$NEG" -eq 0 ] && echo "PASS: refund racing a spend keeps balances non-negative and the ledger exact" || { echo "FAIL: refund/spend race left a bad balance"; exit 1; }
echo "ALL SQL TESTS PASSED"
