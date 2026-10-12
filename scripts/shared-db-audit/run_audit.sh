#!/usr/bin/env bash
# =====================================================================
# run_audit.sh — READ-ONLY live-audit runner for the shared Supabase
# database bzxohkrxcwodllketcpz ("VideoRemix Product").
#
# Design rules:
#   * Never contacts the database without credentials, and NEVER fabricates
#     output. With no credentials it prints how to get a connection string (or
#     to use the SQL Editor) and exits 3 (BLOCKED).
#   * Refuses to run on any argument other than --help / --dry-run.
#   * Verifies scripts/shared-db-audit/01_readonly_queries.sql contains no
#     DDL/DML (comments stripped) BEFORE executing; fails closed otherwise.
#   * Executes every labelled query inside its own
#         BEGIN; SET TRANSACTION READ ONLY; <query>; COMMIT;
#     transaction, psql --csv -v ON_ERROR_STOP=1, and writes the captured CSV
#     to docs/SHARED_DB_AUDIT_RESULT.md. Supabase's direct/pooled connections
#     both honour read-only transactions.
#
# Exit codes:
#   0  success (results written)
#   1  usage / guard / missing-file / missing-psql error
#   2  connection failure
#   3  BLOCKED: no credentials (nothing contacted)
# =====================================================================
set -uo pipefail

readonly SQL_FILE_NAME="01_readonly_queries.sql"
readonly RESULT_BASENAME="SHARED_DB_AUDIT_RESULT.md"
readonly STUDIO_VERSION="20261011090000"
readonly PROJECT_REF="bzxohkrxcwodllketcpz"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
SQL_FILE="$HERE/$SQL_FILE_NAME"
DOCS_DIR="$ROOT/docs"
RESULT_FILE="$DOCS_DIR/$RESULT_BASENAME"

# DDL/DML/statement keywords that must not appear outside comments. Word-bounded
# so identifiers like created_at / *_insert_own / reorder_compilation_clips do
# not trip the guard.
readonly FORBIDDEN_RE='\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|GRANT|REVOKE|TRUNCATE|MERGE|COPY|VACUUM|ANALYZE|REINDEX|CLUSTER)\b'

usage() {
  cat <<'EOF'
run_audit.sh — read-only live audit of shared Supabase bzxohkrxcwodllketcpz

USAGE
  scripts/shared-db-audit/run_audit.sh            # run (needs credentials)
  scripts/shared-db-audit/run_audit.sh --dry-run  # self-check only, no DB
  scripts/shared-db-audit/run_audit.sh --help      # this text

CONNECTION (provide exactly one; used read-only)
  SHARED_DB_URL   full URI, e.g.
    postgresql://postgres.<ref>:<password>@db.<ref>.supabase.co:5432/postgres
  (or) PGHOST + PGPASSWORD   libpq env (PGPORT/PGUSER/PGDATABASE optional)

Only --help / --dry-run are accepted; any other argument is refused.
EOF
}

# ---- argument gate: refuse anything but --help / --dry-run -----------------
WANT_HELP=0
DRY_RUN=0
for a in "$@"; do
  case "$a" in
    --help)    WANT_HELP=1 ;;
    --dry-run) DRY_RUN=1 ;;
    *)
      echo "run_audit.sh: REFUSING to run — unknown argument: '$a' (only --help / --dry-run allowed)" >&2
      echo >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [ "$WANT_HELP" -eq 1 ]; then usage; exit 0; fi

die() { echo "run_audit.sh: $*" >&2; exit 1; }

# ---- required files / tools ------------------------------------------------
[ -f "$SQL_FILE" ] || die "query file not found: $SQL_FILE"
[ -d "$DOCS_DIR" ]  || mkdir -p "$DOCS_DIR" || die "cannot create $DOCS_DIR"
command -v psql >/dev/null 2>&1 || die "psql not found on PATH (install postgresql-client)"

# ---- read-only guard over the SQL file (fail closed) -----------------------
# Remove -- line comments AND single-quoted string literals, then scan what
# remains (pure statement text) for statement commands. This is what lets the
# guard ignore legitimate catalog calls such as has_table_privilege(tbl,'INSERT')
# (a quoted string value) while still catching a real `INSERT INTO ...` (an
# unquoted leading command).
stripped_sql="$(awk '{ sub(/--.*$/, ""); print }' "$SQL_FILE" | sed "s/'[^']*'//g")"
if printf '%s\n' "$stripped_sql" | grep -Enq "$FORBIDDEN_RE"; then
  {
    echo "run_audit.sh: FAIL-CLOSED — $SQL_FILE_NAME contains a forbidden DDL/DML token"
    echo "(comments were stripped before this scan; only statement bodies should remain)."
    echo "matching line(s):"
    printf '%s\n' "$stripped_sql" | grep -En "$FORBIDDEN_RE" | head -n 20
  } >&2
  exit 1
fi

# count queries for reporting (marker lines)
NQ="$(grep -cE '^-- ===== Q[0-9]+:' "$SQL_FILE")"
[ "${NQ:-0}" -gt 0 ] || die "no Q-markers found in $SQL_FILE_NAME — nothing to run"

# ---- resolve credential target ---------------------------------------------
HAVE_URL=0
if [ -n "${SHARED_DB_URL:-}" ]; then
  HAVE_URL=1
  # Redacted display: strip userinfo (through the last '@').
  TARGET_REDACTED="${SHARED_DB_URL##*@}"
elif [ -n "${PGHOST:-}" ] && [ -n "${PGPASSWORD:-}" ]; then
  TARGET_REDACTED="${PGHOST}:${PGPORT:-5432}/${PGDATABASE:-postgres}(env PGHOST/PGPASSWORD)"
else
  TARGET_REDACTED=""
fi

# ---- --dry-run: verify only, no connection ---------------------------------
if [ "$DRY_RUN" -eq 1 ]; then
  echo "DRY-RUN OK (no database contacted):"
  echo "  query file : $SQL_FILE"
  echo "  queries    : $NQ (Q-markers), read-only guard passed"
  echo "  result file: $RESULT_FILE (would be created/overwritten on a real run)"
  if [ "$HAVE_URL" -eq 1 ]; then
    echo "  target     : $TARGET_REDACTED (from SHARED_DB_URL)"
  elif [ -n "${PGHOST:-}" ] && [ -n "${PGPASSWORD:-}" ]; then
    echo "  target     : $TARGET_REDACTED (from PGHOST/PGPASSWORD env)"
  else
    echo "  target     : NONE — a real run would exit 3 (BLOCKED: no credentials)"
  fi
  echo "  each query runs in: BEGIN; SET TRANSACTION READ ONLY; <q>; COMMIT;  (psql --csv -v ON_ERROR_STOP=1)"
  exit 0
fi

# ---- no credentials -> BLOCKED (exit 3), never fabricate -------------------
if [ "$HAVE_URL" -eq 0 ] && { [ -z "${PGHOST:-}" ] || [ -z "${PGPASSWORD:-}" ]; }; then
  cat >&2 <<EOF
run_audit.sh: BLOCKED — no database credentials (exit 3).

This kit is READ-ONLY for the shared project ${PROJECT_REF} ("VideoRemix Product").
No connection was attempted and NO results are fabricated. Provide exactly ONE of:

  1) SHARED_DB_URL — Dashboard -> Project Settings -> Database -> Connection string
     (URI), then:
        export SHARED_DB_URL='postgresql://postgres.<ref>:<password>@db.<ref>.supabase.co:5432/postgres'
        scripts/shared-db-audit/run_audit.sh

  2) libpq env vars (host + password required):
        export PGHOST="db.<ref>.supabase.co" PGPORT=5432 PGUSER=postgres \\
               PGDATABASE=postgres PGPASSWORD='<database-password>'
        scripts/shared-db-audit/run_audit.sh

  3) No credentials — use the Supabase SQL Editor instead:
        Dashboard -> SQL Editor -> New query -> paste the whole of
        scripts/shared-db-audit/${SQL_FILE_NAME} -> Run (every statement is a
        read-only SELECT). Paste the grids into
        docs/${RESULT_BASENAME} and compare with
        scripts/shared-db-audit/expected-results.md.

When run WITH credentials, output is written to docs/${RESULT_BASENAME}.
GO/NO-GO interpretation: docs/SHARED_DB_AUDIT_PLAN.md.
Nothing was contacted. Exit status 3 = BLOCKED: no credentials.
EOF
  exit 3
fi

# ---- scratch workspace ------------------------------------------------------
WORK="$(mktemp -d "${TMPDIR:-/tmp}/audit-sql.XXXXXX")" || die "cannot create scratch dir"
trap 'rm -rf "$WORK"' EXIT

# Split the SQL file into per-query blocks by the Q markers. Each block file is:
#   \echo '<label>'
#   BEGIN;
#   SET TRANSACTION READ ONLY;
#   <query body>
#   COMMIT;
awk -v dir="$WORK" -v man="$WORK/manifest.tsv" '
  function close_last(   lastfn) {
    if (n > 0) { lastfn = sprintf("%s/block_%03d.sql", dir, n); printf "COMMIT;\n" > lastfn }
  }
  BEGIN { n = 0 }
  /^-- ===== Q[0-9]+:/ {
    close_last()
    line = $0
    sub(/^-- ===== /, "", line)
    sub(/ =====[[:space:]]*$/, "", line)
    idx = index(line, ":")
    qid = substr(line, 1, idx - 1)
    title = substr(line, idx + 2)
    n++
    fn = sprintf("%s/block_%03d.sql", dir, n)
    printf "\\echo \047===== %s — %s =====\047\n", qid, title > fn
    printf "BEGIN;\nSET TRANSACTION READ ONLY;\n" > fn
    printf "%s\t%s\n", qid, title > man
    next
  }
  { if (n > 0) { fn = sprintf("%s/block_%03d.sql", dir, n); print > fn } }
  END { close_last() }
' "$SQL_FILE"

[ -s "$WORK/manifest.tsv" ] || die "failed to split $SQL_FILE_NAME into query blocks"

# ---- psql invocation base (read-only friendly) ------------------------------
# -q keeps \echo labels + CSV rows but drops the BEGIN/SET/COMMIT command tags.
PSQL_BASE=(psql -X --csv -q -v ON_ERROR_STOP=1 -w)
# Connection arguments as an array so the URL stays one token and the env path
# expands to two tokens (-d <name>).
if [ "$HAVE_URL" -eq 1 ]; then
  CONN=("$SHARED_DB_URL")
else
  CONN=(-d "${PGDATABASE:-postgres}")
fi

# ---- connectivity probe (SELECT 1, read-only) -------------------------------
if ! "${PSQL_BASE[@]}" "${CONN[@]}" -v ON_ERROR_STOP=1 -c 'SELECT 1;' >"$WORK/probe.out" 2>"$WORK/probe.err"; then
  echo "run_audit.sh: cannot connect to the database (exit 2)." >&2
  echo "  target: $TARGET_REDACTED" >&2
  echo "  error :" >&2
  sed 's/^/    /' "$WORK/probe.err" >&2
  echo "No results were written. Fix the connection string/env and re-run." >&2
  exit 2
fi

# ---- execute each block, capture CSV + stderr, remember for the summary -----
mapfile -t QIDS   < <(cut -f1 "$WORK/manifest.tsv")
mapfile -t TITLES < <(cut -f2 "$WORK/manifest.tsv")
NP=${#QIDS[@]}

declare -a OUTS
declare -a ERRS
ERR_COUNT=0

BODY_FILE="$WORK/body.md"
: > "$BODY_FILE"

i=0
while [ "$i" -lt "$NP" ]; do
  f=$(printf '%s/block_%03d.sql' "$WORK" "$((i + 1))")
  out="$("${PSQL_BASE[@]}" "${CONN[@]}" -f "$f" 2>"$WORK/err.$i")"
  rc=$?
  OUTS[$i]="$out"
  if [ "$rc" -ne 0 ]; then
    ERRS[$i]="$(cat "$WORK/err.$i")"
    ERR_COUNT=$((ERR_COUNT + 1))
  else
    ERRS[$i]=""
  fi

  {
    printf '\n### %s — %s\n\n' "${QIDS[$i]}" "${TITLES[$i]}"
    printf '```\n%s\n```\n' "$out"
    if [ "$rc" -ne 0 ]; then
      printf '\n**ERROR (psql exit %s):**\n```\n%s\n```\n' "$rc" "$(cat "$WORK/err.$i")"
    fi
  } >> "$BODY_FILE"
  i=$((i + 1))
done

# ---- surfacing the conflict sign-off row (Q11) verbatim (no adjudication) ----
Q11_LINE="(Q11 not found)"
i=0
while [ "$i" -lt "$NP" ]; do
  if [ "${QIDS[$i]}" = "Q11" ]; then
    # the single sign-off data row = comma-separated integers
    Q11_LINE="$(printf '%s\n' "${OUTS[$i]}" | grep -E '^[0-9]+(,[0-9]+)*$' | tail -n 1)"
    [ -z "$Q11_LINE" ] && Q11_LINE="(Q11 numeric sign-off row not found — inspect the Q11 block)"
  fi
  i=$((i + 1))
done

# ---- write the result markdown (never fabricate — only captured output) -----
RUN_TS_UTC="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
if [ "$HAVE_URL" -eq 1 ]; then CONN_DESC="SHARED_DB_URL"; else CONN_DESC="PGHOST/PGPASSWORD env"; fi
{
  echo "# Shared Database Live Audit — Result (generated)"
  echo
  echo "> Generated by \`scripts/shared-db-audit/run_audit.sh\`. Regenerate by re-running"
  echo "> with credentials (create-or-overwrite). Every value below is verbatim live"
  echo "> \`psql\` \`--csv\` output — nothing here is pre-filled or fabricated."
  echo
  echo "- **Project under audit:** \`${PROJECT_REF}\` (\"VideoRemix Product\")"
  echo "- **Connection used:** ${CONN_DESC} → \`${TARGET_REDACTED}\`"
  echo "- **Run (UTC):** ${RUN_TS_UTC}"
  echo "- **Queries:** ${NP} · **Queries errored:** ${ERR_COUNT}"
  echo "- **Read-only enforcement:** each query wrapped in \`BEGIN; SET TRANSACTION READ ONLY; <q>; COMMIT;\` (\`psql -X --csv -q -v ON_ERROR_STOP=1 -w\`)"
  echo
  echo "## Sign-off summary"
  echo
  echo "- **Q11 conflict row:** \`${Q11_LINE}\` — every column must be \`0\` for GO."
  if [ "$ERR_COUNT" -gt 0 ]; then
    echo "- **NOT A CLEAN RUN:** ${ERR_COUNT} query/queries errored (see ERROR blocks below). Resolve and re-run; see \`expected-results.md\`."
  else
    echo "- Run completed with 0 query errors."
  fi
  echo
  echo "GO/NO-GO criteria and interpretation: \`docs/SHARED_DB_AUDIT_PLAN.md\`."
  echo "Conflict probes are **Q4..Q11** (expected absent / zero); **Q12..Q24** are informational."
  echo
  echo "---"
  echo "## Per-query output (csv)"
  cat "$BODY_FILE"
} > "$RESULT_FILE"

# ---- final console summary (honest) -----------------------------------------
echo "run_audit.sh: wrote $RESULT_FILE"
echo "  queries=$NP errored=$ERR_COUNT"
echo "  Q11 conflict row: $Q11_LINE"
if [ "$ERR_COUNT" -gt 0 ]; then
  echo "  NOTE: $ERR_COUNT query/queries errored — inspect the ERROR blocks in $RESULT_FILE." >&2
fi
echo "  GO/NO-GO: see docs/SHARED_DB_AUDIT_PLAN.md (Q4..Q11 must all be absent/zero)."
exit 0
