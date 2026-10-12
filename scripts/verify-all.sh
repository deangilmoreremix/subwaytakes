#!/usr/bin/env bash
# =====================================================================
# verify-all.sh — the whole LOCAL verification suite for SubwayTakes
# Studio, in order, with PASS/FAIL per step and a final summary.
#
# It runs the real browser acceptance suite (real Chrome decoding real
# ffmpeg-encoded MP4s), the unit tests, the edge-function tests, the
# render-worker tests, the Postgres migration/RLS suite and the
# (credential-less) provider preflight.
#
# LIVE provider checks are NOT part of this: there are no credentials in
# this environment, so the provider preflight is expected to report
# BLOCKED. Everything that CAN be executed locally is executed here.
#
# Usage:  bash scripts/verify-all.sh            (any working directory)
#         bash scripts/verify-all.sh --quick   (skip the browser suite)
#
# Exit code: 0 only when every executed step passed.
# =====================================================================
set -uo pipefail

# Resolve the repo root from the script location so any cwd works.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 3

LOGDIR="${VERIFY_LOG_DIR:-/tmp/kilo/verify-all}"
rm -rf "$LOGDIR" 2>/dev/null
mkdir -p "$LOGDIR"

# The browser suite needs a bundle built against a local stubbed Supabase.
export VITE_SUPABASE_URL="${VITE_SUPABASE_URL:-http://127.0.0.1:4173}"
export VITE_SUPABASE_ANON_KEY="${VITE_SUPABASE_ANON_KEY:-e2e-anon}"

CHROME_BIN="node_modules/.remotion/chrome-headless-shell/linux64/chrome-headless-shell-linux64/chrome-headless-shell"
STEP_NO=0
PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0
declare -a FAILED_STEPS=()

line() { printf '%s\n' "-------------------------------------------------------------"; }

have() { command -v "$1" >/dev/null 2>&1; }

# run_step <label> <timeout-seconds> <command...>
# Prints one PASS/FAIL line; full output goes to $LOGDIR/<n>.log.
# safe_log_label <label> — a label may contain '/', spaces and '&&' (e.g.
# "cd supabase/functions && deno test"); keep the log filename valid.
safe_log_label() { printf '%s' "$1" | tr -c 'A-Za-z0-9._-' '-'; }

run_step() {
  local label="$1" timeout_s="$2"; shift 2
  STEP_NO=$((STEP_NO + 1))
  local log="$LOGDIR/$(printf '%02d' "$STEP_NO")-$(safe_log_label "$label").log"
  local start end secs rc
  start=$(date +%s)
  printf '  %-52s ' "$label"
  if have timeout; then
    timeout --kill-after=20 "$timeout_s" "$@" >"$log" 2>&1
    rc=$?
  else
    "$@" >"$log" 2>&1
    rc=$?
  fi
  end=$(date +%s); secs=$((end - start))
  if [ "$rc" -eq 0 ]; then
    PASS_COUNT=$((PASS_COUNT + 1))
    printf 'PASS  (%ss)\n' "$secs"
    return 0
  fi
  if [ "$rc" -eq 124 ]; then
    FAIL_COUNT=$((FAIL_COUNT + 1))
    FAILED_STEPS+=("$label (TIMEOUT after ${timeout_s}s)")
    printf 'FAIL  (TIMEOUT after %ss)  log=%s\n' "$timeout_s" "$log"
    return 1
  fi
  FAIL_COUNT=$((FAIL_COUNT + 1))
  FAILED_STEPS+=("$label (exit $rc)")
  printf 'FAIL  (exit %s, %ss)  log=%s\n' "$rc" "$secs" "$log"
  return 1
}

skip_step() {
  local label="$1" reason="$2"
  STEP_NO=$((STEP_NO + 1))
  SKIP_COUNT=$((SKIP_COUNT + 1))
  printf '  %-52s SKIP  (%s)\n' "$label" "$reason"
}

# A step whose *expected* outcome is a specific condition in its output.
run_step_expect() {
  local label="$1" timeout_s="$2" pattern="$3"; shift 3
  STEP_NO=$((STEP_NO + 1))
  local log="$LOGDIR/$(printf '%02d' "$STEP_NO")-$(safe_log_label "$label").log"
  local start end secs rc
  start=$(date +%s)
  printf '  %-52s ' "$label"
  if have timeout; then
    timeout --kill-after=20 "$timeout_s" "$@" >"$log" 2>&1
    rc=$?
  else
    "$@" >"$log" 2>&1
    rc=$?
  fi
  end=$(date +%s); secs=$((end - start))
  if grep -Eq "$pattern" "$log"; then
    PASS_COUNT=$((PASS_COUNT + 1))
    printf 'PASS  (%ss)  [expected: %s]\n' "$secs" "$pattern"
    return 0
  fi
  FAIL_COUNT=$((FAIL_COUNT + 1))
  FAILED_STEPS+=("$label (exit $rc)")
  printf 'FAIL  (exit %s, %ss)  log=%s\n' "$rc" "$secs" "$log"
  return 1
}

# Set when a step's failure is fully explained by the diagnostic re-run that
# follows it (annotated in the summary, still counted as a failure).
KNOWN_FAILURE_NOTE=''

QUICK=0
for arg in "$@"; do
  case "$arg" in
    --quick) QUICK=1 ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

echo "SubwayTakes Studio — full local verification suite"
echo "repo:    $ROOT"
echo "logs:    $LOGDIR"
echo "built with VITE_SUPABASE_URL=$VITE_SUPABASE_URL (local stub boundary)"
line
echo "TOOL AVAILABILITY"
for tool in node npm tsc deno ffmpeg psql runuser; do
  if have "$tool"; then
    printf '  %-52s FOUND (%s)\n' "$tool" "$(command -v "$tool")"
  elif [ "$tool" = tsc ] && [ -x "node_modules/.bin/tsc" ]; then
    printf '  %-52s FOUND (node_modules/.bin/tsc, via npx)\n' "$tool"
  else
    printf '  %-52s MISSING\n' "$tool"
  fi
done
if [ -x "$CHROME_BIN" ]; then
  printf '  %-52s FOUND\n' "chrome-headless-shell"
else
  printf '  %-52s MISSING (%s)\n' "chrome-headless-shell" "$CHROME_BIN"
fi
line

echo "STEPS"

# 1. lint (eslint, 0 errors required — warnings are pre-existing and allowed)
if have npm; then
  run_step "lint (eslint .)" 300 npm run lint
else
  skip_step "lint (eslint .)" "npm not found"
fi

# 2. typecheck
if have tsc; then
  run_step "typecheck (tsc --noEmit -p tsconfig.app.json)" 300 npx tsc --noEmit -p tsconfig.app.json
elif have npm; then
  run_step "typecheck" 300 npm run typecheck
else
  skip_step "typecheck" "tsc/npm not found"
fi

# 3. production build (built against the local stub so the browser suite can run)
if have npm; then
  run_step "build (vite build, e2e env)" 600 npm run build
else
  skip_step "build" "npm not found"
fi

# 4. unit tests
if have npm; then
  run_step "unit tests (vitest run)" 600 npm test
else
  skip_step "unit tests" "npm not found"
fi

# 5. edge-function tests (deno) — run from supabase/functions so the deno
#    runner only discovers that package's tests (the repo root would also
#    type-check the render worker under a different module resolution).
if have deno; then
  # `deno task test` (supabase/functions/deno.json) grants the env/net
  # permissions the edge functions need — Deno cannot pre-grant permissions
  # in config, so the task entry point is the canonical runner.
  if run_step "edge functions (cd supabase/functions && deno task test)" 300 \
      bash -c 'cd supabase/functions && deno task test'; then
    :
  else
    echo "NOTE  edge functions: 'deno task test' failed — run 'deno check' to see"
    echo "      whether this is a logic failure or a missing dependency."
    NOGO=1
  fi
else
  skip_step "edge functions (deno test)" "deno not found"
fi

# 6. render worker tests
if have npm; then
  run_step "render worker (vitest run)" 600 npm test --prefix render-worker
else
  skip_step "render worker" "npm not found"
fi

# 7. Postgres migration / RLS suite
if have psql && have runuser; then
  run_step "migration + RLS suite (real Postgres)" 900 bash scripts/migration-validation/run_all.sh
else
  skip_step "migration + RLS suite" "psql/runuser (local Postgres) not found"
fi

# 8. provider preflight — expected: BLOCKED (no credentials in this environment)
if have node; then
  run_step_expect "provider preflight (expected BLOCKED)" 300 \
    'PREFLIGHT RESULT: (BLOCKED|PASS)' node scripts/provider-preflight.mjs
else
  skip_step "provider preflight" "node not found"
fi

# 9. real browser acceptance suite (Chrome + real ffmpeg-encoded MP4s)
if [ "$QUICK" -eq 1 ]; then
  skip_step "browser acceptance (node scripts/browser-acceptance.mjs)" "--quick requested"
elif [ -x "$CHROME_BIN" ] && have node; then
  # The browser suite serves dist/ — a concurrent `vite build` (or a clean) can
  # have emptied it between the build step and this one, so rebuild if needed.
  run_step "browser acceptance (Chrome + real MP4s)" 900 bash -c '
    if [ ! -f dist/index.html ]; then
      echo "NOTE  dist/index.html is missing (a concurrent build/clean?) — re-running the build first"
      npm run build || exit 3
    fi
    node scripts/browser-acceptance.mjs'
else
  skip_step "browser acceptance" "chrome-headless-shell or node not found"
fi

line
echo "===== SUMMARY ====="
printf 'steps executed: %s\n' "$((PASS_COUNT + FAIL_COUNT))"
printf 'passed:         %s\n' "$PASS_COUNT"
printf 'failed:         %s\n' "$FAIL_COUNT"
printf 'skipped:        %s\n' "$SKIP_COUNT"
if [ "$FAIL_COUNT" -gt 0 ]; then
  for step in "${FAILED_STEPS[@]}"; do
    printf '  FAILED  %s\n' "$step"
  done
  if [ -n "$KNOWN_FAILURE_NOTE" ]; then printf 'NOTE  %s\n' "$KNOWN_FAILURE_NOTE"; fi
  echo "RESULT: FAIL"
  exit 1
fi
echo "RESULT: PASS"
exit 0
