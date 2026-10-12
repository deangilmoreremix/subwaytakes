#!/usr/bin/env bash
# =====================================================================
# apply-studio-migration.sh — the ONLY sanctioned way to apply the
# SubwayTakes Studio migration to the shared Supabase project
# (`bzxohkrxcodllketcpz`, "VideoRemix Product") or to a preview branch /
# scratch project used for testing.
#
# GUARANTEES (see docs/SHARED_DB_COMPATIBILITY.md §7 and
# docs/DEV_BRANCH_TEST_PLAN.md):
#
#   1. APPLIES EXACTLY ONE FILE, hardcoded below:
#        supabase/migrations/20261011090000_studio_projects_and_render_jobs.sql
#      No other file in supabase/migrations/ (35 timestamped + 2 legacy
#      scripts) is ever read, copied or executed by this script.
#
#   2. FAILS CLOSED ON UNEXPECTED CONTENT. The file must still hash to the
#      pinned sha256 recorded below. A mismatch aborts before any database
#      contact and prints the exact procedure to update the pin.
#
#   3. REFUSES WITHOUT EXPLICIT INTENT: APPLY=yes must be set. Otherwise it
#      prints the plan and exits 3 without contacting any database.
#
#   4. REFUSES WITHOUT A DATABASE CONNECTION STRING: SHARED_DB_URL (or
#      SUPABASE_DB_URL) must be a postgres connection string. Nothing is
#      ever fabricated or defaulted, and the URL is only printed masked.
#
#   5. STATIC FORBIDDEN-STATEMENT GUARD before applying: after stripping SQL
#      comments (dollar-quoted function bodies kept), every DDL/DML
#      statement must match the studio-only allow-lists (studio_* tables,
#      storage.objects, storage.buckets, subwaytakes_* names). Any DROP
#      TABLE / ALTER of a non-studio object / DML on non-bucket tables /
#      auth-schema write / unprefixed function or policy creation is a hard
#      stop (exit 3).
#
#   6. ATOMIC APPLY: the file is executed as
#        BEGIN; \i <migration>; COMMIT;
#      under psql -v ON_ERROR_STOP=1; any error stops psql before COMMIT and
#      the whole migration rolls back.
#
#   7. POST-APPLY VERIFICATION with the inventory counts proven on PG14.24
#      (docs/RLS_TEST_EVIDENCE.md §4) and a PASS/FAIL verdict.
#
#   8. NO DATABASE CONTACT on any guard refusal or in --check mode.
#
# USAGE:
#   scripts/apply-studio-migration.sh                 # print plan + instructions (exit 3)
#   scripts/apply-studio-migration.sh --check         # read-only self-check (no DB)
#   APPLY=yes SHARED_DB_URL="postgres://..." \
#     scripts/apply-studio-migration.sh               # apply, exactly once
#
# ENVIRONMENT:
#   APPLY=yes        required for the apply path (exactly "yes")
#   SHARED_DB_URL    postgres connection string (preferred)
#   SUPABASE_DB_URL  fallback if SHARED_DB_URL is unset
#
# EXIT CODES: 0 ok · 1 apply or post-apply verification failed ·
#             2 usage error · 3 guard refusal (missing APPLY / DB URL /
#             file / hash / forbidden statement) — no database contacted.
# =====================================================================
set -euo pipefail

# ---------------------------------------------------------------- constants
SCRIPT_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATION_NAME="20261011090000_studio_projects_and_render_jobs.sql"
MIGRATION_PATH="$REPO_ROOT/supabase/migrations/$MIGRATION_NAME"

# sha256 of supabase/migrations/20261011090000_studio_projects_and_render_jobs.sql
# as of 2026-10-12 on branch feat/subway-interview-studio (399 lines). Update
# THIS constant — and only this constant — when the file is intentionally
# changed and reviewed (the exact procedure is printed on hash mismatch).
PINNED_SHA256="a9447a108eeea58bfd3ebd49ed70b3d2eb4785673cf981a3066a45ea64239753"

# Expected post-apply inventory (docs/RLS_TEST_EVIDENCE.md §4, PG14.24).
EXPECT_TABLES=3      EXPECT_POLICIES=10  EXPECT_TRIGGERS=8
EXPECT_FUNCTIONS=3   EXPECT_INDEXES=6    EXPECT_BUCKETS=2
EXPECT_RLS=3         EXPECT_ANON_DML=0

STUDIO_TABLES='studio_projects|studio_render_jobs|muapi_caption_jobs'

# ------------------------------------------------------------------ helpers
log()  { printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
fail3() { log "REFUSED: $*"; log "No database was contacted."; exit 3; }
mask_url() { sed -E 's#://([^:/?#]+):[^@]*@#://\1:***@#'; }
sha256_of() { sha256sum "$1" | cut -d' ' -f1; }

usage() {
  cat <<'EOF'
apply-studio-migration.sh — single-migration application guard

  scripts/apply-studio-migration.sh                        print the plan, exit 3 (no DB contact)
  scripts/apply-studio-migration.sh --check                read-only self-check (file, hash, statements)
  APPLY=yes SHARED_DB_URL=postgres://... scripts/apply-studio-migration.sh
                                                            apply EXACTLY ONE migration, atomically

Environment: APPLY=yes · SHARED_DB_URL (or SUPABASE_DB_URL) = postgres connection string
Docs:        docs/MIGRATION_VERSION_COMPATIBILITY.md · docs/DEV_BRANCH_TEST_PLAN.md
             docs/SHARED_DB_COMPATIBILITY.md §7 · docs/RLS_TEST_EVIDENCE.md
EOF
}

# ------------------------------------------------------------- argument parsing
MODE=apply
for arg in "$@"; do
  case "$arg" in
    --check) MODE=check ;;
    -h|--help) usage; exit 2 ;;
    *) log "unknown argument: $arg"; usage; exit 2 ;;
  esac
done

STATEMENTS="$(mktemp)"; WRAPPER="$(mktemp)"; APPLY_LOG="$(mktemp)"
trap 'rm -f "$STATEMENTS" "$WRAPPER" "$APPLY_LOG"' EXIT

# =========================================================================
# STEP 1 — the artifact: existence + pinned sha256 (fail closed)
# =========================================================================
log "repo root ......... $REPO_ROOT"
log "target ............ shared project bzxohkrxcwodllketcpz, or a preview branch / scratch project for testing"

if [ ! -f "$MIGRATION_PATH" ]; then
  fail3 "migration file missing: supabase/migrations/$MIGRATION_NAME — there is no migration content to apply and nothing is fabricated."
fi

ACTUAL_SHA256="$(sha256_of "$MIGRATION_PATH")"
log "migration file .... $MIGRATION_PATH ($(wc -l < "$MIGRATION_PATH") lines)"
log "pinned sha256 ..... $PINNED_SHA256"
log "computed sha256 ... $ACTUAL_SHA256"

if [ "$ACTUAL_SHA256" != "$PINNED_SHA256" ]; then
  cat >&2 <<EOF
FAIL CLOSED — the migration file no longer matches its pinned sha256.
  expected (pin) : $PINNED_SHA256
  computed       : $ACTUAL_SHA256
Refusing to apply unexpected content.

If this change is INTENTIONAL and has been reviewed:
  1. inspect the diff:
       git -C "$REPO_ROOT" diff -- supabase/migrations/$MIGRATION_NAME
  2. recompute the pin:
       sha256sum supabase/migrations/$MIGRATION_NAME
  3. edit PINNED_SHA256 in $SCRIPT_PATH
  4. re-run this script
EOF
  exit 3
fi
log "hash check ....... PASS (computed sha256 equals the pinned value)"

# =========================================================================
# STEP 2 — forbidden-statement scan (comments excluded; dollar quotes kept)
# =========================================================================
# Pass 1 (awk state machine): blanks out -- line comments and /* */ blocks
# (keeping the original line number in column 1), but prints string literals
# (quoted as x^y so no token inside a literal can fake SQL), dollar-quoted
# function bodies and all executable SQL verbatim.
# Pass 2: re-assembles each ;-terminated statement into ONE record so the
# allow-list scans below see whole statements, never commentary prose and
# never a multi-line statement split in half.

awk '
BEGIN { in_block = 0; in_dollar = 0; dollar_tag = "" }
{
  line = $0; out = ""; i = 1; n = length(line)
  while (i <= n) {
    rest = substr(line, i)
    if (in_block) { p = index(rest, "*/"); if (p == 0) { i = n + 1 } else { in_block = 0; i = i + p + 1 }; continue }
    if (in_dollar) {
      p = index(rest, dollar_tag)
      if (p == 0) { out = out rest; i = n + 1 }
      else { out = out substr(rest, 1, p - 1) dollar_tag; in_dollar = 0; i = i + p - 1 + length(dollar_tag) }
      continue
    }
    c2 = substr(line, i, 2)
    if (c2 == "/*") { in_block = 1; i += 2; continue }
    if (c2 == "--") { break }
    if (substr(line, i, 1) == "\047") {
      out = out "x^y"; i++
      while (i <= n) {
        ch = substr(line, i, 1)
        if (ch == "\047") {
          if (substr(line, i + 1, 1) == "\047") { out = out "x^y"; i += 2; continue }
          out = out "x^y"; i++; break
        }
        out = out ch; i++
      }
      continue
    }
    if (substr(line, i, 1) == "$" && match(rest, /^\$([A-Za-z_][A-Za-z_0-9]*)?\$/)) {
      dollar_tag = substr(rest, 1, RLENGTH); out = out dollar_tag; in_dollar = 1; i += RLENGTH; continue
    }
    out = out substr(line, i, 1); i++
  }
  sub(/[[:space:]]+$/, "", out)
  if (out != "") print NR "\t" out
}
' "$MIGRATION_PATH" | awk -F'\t' '
  { if (stmt == "") first = $1
    stmt = stmt (stmt == "" ? "" : " ") $2
    if ($2 ~ /;[[:space:]]*$/) { print first "\t" stmt; stmt = "" } }
  END { if (stmt != "") print first "\t" stmt }
' > "$STATEMENTS"

violations=0
# scan <label> <broad-regex> <safe-regex>: statement records matching the
# broad pattern but NOT the safe pattern are violations.
scan() {
  local label="$1" broad="$2" safe="$3" hits
  hits="$(grep -En "$broad" "$STATEMENTS" 2>/dev/null | grep -Ev "$safe" || true)"
  if [ -n "$hits" ]; then
    violations=$((violations + 1))
    log "  VIOLATION [$label] (line numbers are the statement start):"
    printf '%s\n' "$hits" | sed 's/^/    /'
  fi
}

log "statement scan ... running (comments excluded)"
scan "destructive-ddl" \
  '\bDROP[[:space:]]+(TABLE|SCHEMA|TYPE|DOMAIN|DATABASE|INDEX|FUNCTION|EXTENSION|OWNED|ROLE|USER|VIEW|SEQUENCE)\b|\bTRUNCATE\b|\bREINDEX\b|\bVACUUM\b' \
  'NO_POSSIBLE_SAFE_MATCH'
scan "drop-alter-targets" \
  '\b(DROP|ALTER)\b' \
  "DROP[[:space:]]+TRIGGER[[:space:]]+IF[[:space:]]+EXISTS[[:space:]]+trg_($STUDIO_TABLES)_subwaytakes_[a-z_]+[[:space:]]+ON[[:space:]]+public\.($STUDIO_TABLES)|DROP[[:space:]]+POLICY[[:space:]]+IF[[:space:]]+EXISTS[[:space:]]+\"subwaytakes_[a-z_]+\"[[:space:]]+ON[[:space:]]+(public\.($STUDIO_TABLES)|storage\.objects)|ALTER[[:space:]]+TABLE[[:space:]]+public\.($STUDIO_TABLES)[[:space:]]+ENABLE[[:space:]]+ROW[[:space:]]+LEVEL[[:space:]]+SECURITY"
scan "function-create" \
  'CREATE[[:space:]]+(OR[[:space:]]+REPLACE[[:space:]]+)?FUNCTION' \
  'public\.subwaytakes_[a-z_]+\(\)'
scan "trigger-create" \
  'CREATE[[:space:]]+TRIGGER' \
  "CREATE[[:space:]]+TRIGGER[[:space:]]+trg_($STUDIO_TABLES)_subwaytakes_[a-z_]+[[:space:]]+BEFORE[[:space:]]+(INSERT([[:space:]]+OR[[:space:]]+UPDATE)?|UPDATE)[[:space:]]+ON[[:space:]]+public\.($STUDIO_TABLES)[[:space:]]+FOR[[:space:]]+EACH[[:space:]]+ROW[[:space:]]+EXECUTE[[:space:]]+FUNCTION[[:space:]]+public\.subwaytakes_[a-z_]+\(\);"
scan "table-create" \
  'CREATE[[:space:]]+TABLE' \
  "CREATE[[:space:]]+TABLE[[:space:]]+IF[[:space:]]+NOT[[:space:]]+EXISTS[[:space:]]+public\.($STUDIO_TABLES)"
scan "policy-create" \
  'CREATE[[:space:]]+POLICY' \
  "CREATE[[:space:]]+POLICY[[:space:]]+\"subwaytakes_[a-z_]+\"[[:space:]]+ON[[:space:]]+(public\.($STUDIO_TABLES)|storage\.objects)"
scan "index-create" \
  'CREATE[[:space:]]+(UNIQUE[[:space:]]+)?INDEX' \
  "INDEX[[:space:]]+(IF[[:space:]]+NOT[[:space:]]+EXISTS[[:space:]]+)?subwaytakes_(idx|uq)_[a-z_]+[[:space:]]+ON[[:space:]]+public\.($STUDIO_TABLES)"
scan "dml-statements" \
  '\bINSERT[[:space:]]+INTO\b|\bDELETE[[:space:]]+FROM\b|\bUPDATE[[:space:]]+[A-Za-z_.]+[[:space:]]+SET\b' \
  'INSERT[[:space:]]+INTO[[:space:]]+storage\.buckets\b'
scan "grants" \
  '\b(GRANT|REVOKE)\b' \
  "REVOKE[[:space:]]+INSERT,[[:space:]]+UPDATE,[[:space:]]+DELETE[[:space:]]+ON[[:space:]]+public\.($STUDIO_TABLES)[[:space:]]+FROM[[:space:]]+anon"
scan "auth-schema-writes" \
  '\b(ALTER|DROP|INSERT|UPDATE|DELETE|TRUNCATE)\b.*\bauth\.(users|refresh_tokens|identities|sessions|mfa_factors|mfa_challenges|mfa_amr_claims|sso_providers|sso_domains|saml_relay_states|flow_state|schema)\b' \
  'REFERENCES[[:space:]]+auth\.users\(id\)'
scan "storage-relations" \
  'storage\.[A-Za-z_]+' \
  'storage\.(objects|buckets|foldername)'

if [ "$violations" -ne 0 ]; then
  log "statement scan ... FAIL ($violations forbidden statement class(es) in supabase/migrations/$MIGRATION_NAME)"
  fail3 "the migration contains statements outside the studio-only allow-list (see above); it was not applied."
fi
log "statement scan ... PASS (studio-only statements; comments excluded)"

# =========================================================================
# STEP 3 — pre-flight summary
# =========================================================================
log "pre-flight summary"
log "  file ............. supabase/migrations/$MIGRATION_NAME (the ONLY file applied)"
log "  sha256 ........... $ACTUAL_SHA256 (equals pin)"
log "  creates .......... 3 tables · 6 indexes (incl. 1 partial unique) · 8 triggers ·"
log "                     10 policies (6 table + 4 storage.objects) · 2 private buckets ·"
log "                     3 subwaytakes_* trigger functions · REVOKE anon DML"
log "  apply method ..... psql -v ON_ERROR_STOP=1, file executed inside BEGIN/COMMIT"
log "  on error ......... psql stops before COMMIT; the transaction rolls back"

# =========================================================================
# STEP 4 — --check mode: read-only, no APPLY, no database
# =========================================================================
if [ "$MODE" = "check" ]; then
  log "mode ............. --check (read-only; APPLY not required, no database contacted)"
  log "would apply ...... supabase/migrations/$MIGRATION_NAME"
  log "result ........... READY — file present, sha256 pinned, statement scan clean"
  exit 0
fi

# =========================================================================
# STEP 5 — explicit-intent guard: APPLY must be exactly "yes"
# =========================================================================
if [ "${APPLY:-}" != "yes" ]; then
  cat >&2 <<EOF
PLAN — nothing was applied and no database was contacted.

  This script applies EXACTLY ONE migration:
    supabase/migrations/$MIGRATION_NAME
  to the shared project bzxohkrxcwodllketcpz (or to a test branch / scratch
  project). It never touches any other file in supabase/migrations/.

  Pre-flight (verified above, without APPLY and without a database):
    - file present ................. yes
    - sha256 equals pin ............ yes ($ACTUAL_SHA256)
    - forbidden-statement scan ..... clean
    - version compatibility ........ PG13+ (audit: docs/MIGRATION_VERSION_COMPATIBILITY.md)

  To apply, set APPLY=yes and provide a postgres connection string in
  SHARED_DB_URL (preferred) or SUPABASE_DB_URL:

    APPLY=yes SHARED_DB_URL="postgres://postgres.<ref>:<password>@<host>:5432/postgres" \\
      scripts/apply-studio-migration.sh

  To re-run this pre-flight only (no APPLY, no DB contact):
    scripts/apply-studio-migration.sh --check
EOF
  exit 3
fi

# =========================================================================
# STEP 6 — database connection string guard (never fabricated)
# =========================================================================
DB_URL="${SHARED_DB_URL:-${SUPABASE_DB_URL:-}}"
if [ -z "$DB_URL" ]; then
  fail3 "no database connection string: set SHARED_DB_URL (or SUPABASE_DB_URL) to a postgres connection string. No default is invented."
fi
case "$DB_URL" in
  postgres://*|postgresql://*) : ;;
  *) fail3 "SHARED_DB_URL/SUPABASE_DB_URL does not look like a postgres connection string (must start with postgres:// or postgresql://). An API URL such as https://<ref>.supabase.co is not a database URL." ;;
esac
if ! command -v psql >/dev/null 2>&1; then
  fail3 "psql was not found on PATH — the migration is applied via psql only; install the PostgreSQL client first."
fi
log "database .......... $(printf '%s' "$DB_URL" | mask_url)"
log "apply mode ........ APPLY=yes confirmed"

# =========================================================================
# STEP 7 — atomic apply of the single file (BEGIN/COMMIT + ON_ERROR_STOP)
# =========================================================================
cat > "$WRAPPER" <<EOF
\\set ON_ERROR_STOP on
BEGIN;
\\i '$MIGRATION_PATH'
COMMIT;
EOF

log "applying .......... supabase/migrations/$MIGRATION_NAME (one BEGIN/COMMIT transaction)"
if psql -X -v ON_ERROR_STOP=1 "$DB_URL" -f "$WRAPPER" > "$APPLY_LOG" 2>&1; then
  apply_rc=0
else
  apply_rc=$?
fi
sed 's/^/    | /' "$APPLY_LOG"

if [ "$apply_rc" -ne 0 ] || grep -Eqi 'psql:.*error|error:' "$APPLY_LOG"; then
  log "apply FAILED (psql exit=$apply_rc) — the transaction was rolled back; no studio objects were created"
  exit 1
fi
log "apply OK .......... psql exit 0, transaction committed"

# =========================================================================
# STEP 8 — post-apply verification (inventory, docs/RLS_TEST_EVIDENCE.md §4)
# =========================================================================
q() { psql -X -At -v ON_ERROR_STOP=1 "$DB_URL" -c "$1"; }
verdict=0

check_count() { # check_count <label> <sql> <expected>
  local label="$1" sql="$2" expected="$3" actual
  if ! actual="$(q "$sql")"; then
    printf 'FAIL  %-16s verification query failed\n' "$label"; verdict=1; return 0
  fi
  if [ "$actual" = "$expected" ]; then
    printf 'PASS  %-16s %s (expected %s)\n' "$label" "$actual" "$expected"
  else
    printf 'FAIL  %-16s %s (expected %s)\n' "$label" "$actual" "$expected"; verdict=1
  fi
}

log "post-apply verification (inventory check)"
check_count tables    "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('studio_projects','studio_render_jobs','muapi_caption_jobs');" "$EXPECT_TABLES"
check_count policies  "SELECT count(*) FROM pg_policies WHERE policyname LIKE 'subwaytakes_%';" "$EXPECT_POLICIES"
check_count triggers  "SELECT count(*) FROM pg_trigger t WHERE t.tgname LIKE 'trg_studio_%' OR t.tgname LIKE 'trg_muapi_%';" "$EXPECT_TRIGGERS"
check_count functions "SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'subwaytakes_%';" "$EXPECT_FUNCTIONS"
check_count indexes   "SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND indexname LIKE 'subwaytakes_%';" "$EXPECT_INDEXES"
check_count buckets   "SELECT count(*) FROM storage.buckets WHERE id IN ('studio-exports','studio-uploads');" "$EXPECT_BUCKETS"
check_count rls       "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('studio_projects','studio_render_jobs','muapi_caption_jobs') AND c.relrowsecurity;" "$EXPECT_RLS"
check_count anon_dml  "SELECT count(*) FROM (VALUES
  (has_table_privilege('anon','public.studio_projects','INSERT')),
  (has_table_privilege('anon','public.studio_projects','UPDATE')),
  (has_table_privilege('anon','public.studio_projects','DELETE')),
  (has_table_privilege('anon','public.studio_render_jobs','INSERT')),
  (has_table_privilege('anon','public.studio_render_jobs','UPDATE')),
  (has_table_privilege('anon','public.studio_render_jobs','DELETE')),
  (has_table_privilege('anon','public.muapi_caption_jobs','INSERT')),
  (has_table_privilege('anon','public.muapi_caption_jobs','UPDATE')),
  (has_table_privilege('anon','public.muapi_caption_jobs','DELETE'))) AS t(priv) WHERE priv;" "$EXPECT_ANON_DML"

log "server version ... $(q 'SELECT version();' || echo 'version query failed')"

if [ "$verdict" -eq 0 ]; then
  log "VERDICT .......... PASS — inventory matches the PG14.24 validation (docs/RLS_TEST_EVIDENCE.md §4)"
  log "post-apply bookkeeping (optional, per docs/SHARED_DB_COMPATIBILITY.md §7.2):"
  log "  INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('20261011090000') ON CONFLICT DO NOTHING;"
  log "  SELECT pg_notify('pgrst', 'reload schema');"
  exit 0
fi
log "VERDICT .......... FAIL — inventory counts do not match the expected values above"
exit 1
