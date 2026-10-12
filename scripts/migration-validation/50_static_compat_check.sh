#!/usr/bin/env bash
# =====================================================================
# 50_static_compat_check.sh — verifies every column / filter / bucket
# referenced by render-worker/src/storage.ts (+ render-worker/src/config.ts)
# and src/lib/studioProjects.ts exists in the FINAL schema produced by
# the corrected migration. Prints a PASS/FAIL table; exits non-zero on
# any missing object.
#
# Column references were extracted by reading both files (see evidence
# doc); each is checked live against information_schema after the
# migration is applied.
# =====================================================================
set -uo pipefail

DB="subwaytakes_migration_test"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="${1:-$HERE/logs}"
mkdir -p "$OUT"

fails=0
total=0

check() { # check <table> <column>
  local table="$1" col="$2"
  total=$((total+1))
  local exists
  exists=$(runuser -u postgres -- psql -X -At -d "$DB" -c \
    "SELECT count(*) FROM information_schema.columns
     WHERE table_schema='public' AND table_name='$table' AND column_name='$col';")
  if [ "$exists" = "1" ]; then
    printf 'PASS  %-22s %-20s exists\n' "$table" "$col"
  else
    printf 'FAIL  %-22s %-20s MISSING\n' "$table" "$col"
    fails=$((fails+1))
  fi
}

check_bucket() { # check_bucket <id>
  local id="$1"
  total=$((total+1))
  local exists
  exists=$(runuser -u postgres -- psql -X -At -d "$DB" -c \
    "SELECT count(*) FROM storage.buckets WHERE id='$id';")
  if [ "$exists" = "1" ]; then
    printf 'PASS  storage.buckets     %-20s exists\n' "$id"
  else
    printf 'FAIL  storage.buckets     %-20s MISSING\n' "$id"
    fails=$((fails+1))
  fi
}

echo "== studio_projects columns used by src/lib/studioProjects.ts =="
for c in id user_id title project version created_at updated_at; do check studio_projects "$c"; done

echo "== studio_render_jobs columns used by render-worker/src/storage.ts + src/lib/studioProjects.ts =="
for c in id user_id project_id status progress output_url captioned_output_url error worker_id \
         project_snapshot render_settings created_at updated_at; do check studio_render_jobs "$c"; done

echo "== muapi_caption_jobs columns used by supabase/functions/muapi-captions (row consumers) =="
for c in id user_id project_id render_job_id mode muapi_request_id language theme status output_url \
         captions error created_at updated_at; do check muapi_caption_jobs "$c"; done

echo "== storage buckets =="
check_bucket studio-uploads    # src/lib/studioProjects.ts:30 UPLOAD_BUCKET
check_bucket studio-exports    # render-worker/src/config.ts:67 storageBucket default

echo
echo "STATIC CHECK TOTAL=$total FAILS=$fails"

# Filter-shape assertions (the WHERE columns used by the worker/client queries)
echo
echo "== filter columns referenced by the worker/client queries =="
for pair in "studio_render_jobs:status" "studio_render_jobs:created_at" "studio_render_jobs:updated_at" \
            "studio_render_jobs:id" "studio_render_jobs:project_id" "studio_projects:id" \
            "muapi_caption_jobs:project_id" "muapi_caption_jobs:id"; do
  check "${pair%%:*}" "${pair##*:}"
done

echo "STATIC CHECK (incl. filters) TOTAL=$total FAILS=$fails"
[ "$fails" -eq 0 ]
