#!/usr/bin/env bash
# Tests the subwaytakes-schema migration (shared Supabase project, bring-your-own-key) on a throwaway local Postgres.
# Proves: it adds only what it should, touches nothing of another app, is re-runnable, enforces owner-only access, and can be dropped cleanly.
# Usage: scripts/test-subwaytakes-sql.sh   (needs the postgres 16 binaries)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)"
WORK="$(mktemp -d /tmp/subwaytakes-pgtest.XXXXXX)"
PORT=54331
run_pg() { if [ "$(id -u)" = 0 ]; then runuser -u postgres -- "$@"; else "$@"; fi; }
cleanup() { run_pg "$PGBIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT
chmod 755 "$WORK"; [ "$(id -u)" = 0 ] && chown postgres "$WORK"

run_pg "$PGBIN/initdb" -D "$WORK/data" -A trust -U postgres >/dev/null
run_pg "$PGBIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" -w start >/dev/null
PSQL=(psql -h "$WORK" -p "$PORT" -U postgres -X -q -v ON_ERROR_STOP=1)
"${PSQL[@]}" -c "CREATE DATABASE t" >/dev/null
PSQL+=(-d t)
MIG="$ROOT/supabase/migrations/20261125000000_subwaytakes_schema.sql"

"${PSQL[@]}" -f "$ROOT/supabase/tests/subwaytakes-bootstrap.sql" >/dev/null
"${PSQL[@]}" -f "$MIG" >/dev/null
echo "PASS: migration applies"
"${PSQL[@]}" -f "$MIG" >/dev/null 2>"$WORK/second.err" || { echo "FAIL: migration is not re-runnable"; cat "$WORK/second.err"; exit 1; }
echo "PASS: migration can be re-applied"
# the exposed list must not grow a second 'subwaytakes' on re-apply
LIST=$("${PSQL[@]}" -At -c "SELECT split_part(c, '=', 2) FROM pg_roles r, unnest(r.rolconfig) c WHERE r.rolname = 'authenticator' AND c LIKE 'pgrst.db_schemas=%'")
[ "$LIST" = "public, graphql_public, agentos, subwaytakes" ] && echo "PASS: exposed schemas appended once ($LIST)" || { echo "FAIL: exposed schemas ($LIST)"; exit 1; }

"${PSQL[@]}" -f "$ROOT/supabase/tests/subwaytakes.sql" 2>&1 | grep -E "PASS|FAIL|ERROR" | sed 's/^psql:[^ ]* //'
echo "done"
