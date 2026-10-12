# RLS / Migration Validation Evidence — SubwayTakes Studio

**Target artifact (NOT modified):** `supabase/migrations/20261011090000_studio_projects_and_render_jobs.sql` (399 lines)
**Harness:** `scripts/migration-validation/` (`run_all.sh` reruns everything below on a fresh database)
**Network databases contacted:** NONE. All validation ran against a local PostgreSQL scratch database. No Supabase credentials were used or needed.
**Date:** 2026-10-12 · **Branch:** `feat/subway-interview-studio`

---

## 1. Environment

| Item | Value |
|---|---|
| OS | Ubuntu 22.04.5 LTS |
| PostgreSQL | **14.24** (`PostgreSQL 14.24 (Ubuntu 14.24+238) on x86_64-pc-linux-gnu`) — installed via `apt-get install -y postgresql`, cluster started with `pg_ctlcluster 14 main start` |
| `gen_random_uuid()` | built into `pg_catalog` on PG14 (no pgcrypto needed) |
| Scratch database | `subwaytakes_migration_test` (owned by `postgres`, created with `createdb`) |
| Roles (Supabase-like) | `anon`, `authenticated`, `service_role` (`service_role` has `BYPASSRLS`) |

Captured:

```
$ runuser -u postgres -- psql -d subwaytakes_migration_test -c 'select version();'
                                                                 version
----------------------------------------------------------------------------------------------------------------------------------------
 PostgreSQL 14.24 (Ubuntu 14.24-0ubuntu0.22.04.1) on x86_64-pc-linux-gnu, compiled by gcc (Ubuntu 11.4.0-3ubuntu1.3) ...
```

## 2. Exact commands

```bash
# install + start (Ubuntu 22.04 -> Postgres 14)
apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql
pg_ctlcluster 14 main start
runuser -u postgres -- createdb subwaytakes_migration_test

# full pipeline (fresh DB every run; all output under scripts/migration-validation/logs/)
scripts/migration-validation/run_all.sh
#   which runs, in order:
#   1. dropdb/createdb subwaytakes_migration_test            (fresh state)
#   2. psql -f scripts/migration-validation/00_substrate.sql (mock Supabase substrate, decoys, seeds)
#   3. psql -f scripts/migration-validation/20_inventory.sql  (pre-migration baseline)
#   4. scripts/migration-validation/10_apply_studio_migration.sh
#        psql -f supabase/migrations/20261011090000_studio_projects_and_render_jobs.sql   (apply #1)
#        psql -f 20_inventory.sql ; object counts snapshot
#        psql -f <migration>                                                              (apply #2 — idempotency)
#        psql -f 20_inventory.sql ; object counts snapshot ; diff vs apply #1
#   5. decoy-function diff (before vs after, md5 of pg_get_functiondef output)
#   6. scripts/migration-validation/31_rls_tests_driver.sh   (runs 30_rls_tests.sql)
#   7. scripts/migration-validation/40_rollback_test.sh      (rollback -> verify -> re-apply -> re-run suite)
#   8. scripts/migration-validation/50_static_compat_check.sh (worker/frontend column compatibility)

# individual pieces:
scripts/migration-validation/10_apply_studio_migration.sh
scripts/migration-validation/31_rls_tests_driver.sh
scripts/migration-validation/40_rollback_test.sh
scripts/migration-validation/50_static_compat_check.sh
```

### 2.1 Mock Supabase substrate (`00_substrate.sql`, applied first as `postgres`)

- `auth.users(id uuid PK, email text, is_anonymous bool DEFAULT false, created_at timestamptz DEFAULT now())`
- `auth.uid()` — the real Supabase way: `SELECT (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid` (NULL when unset)
- `storage.buckets(id text PK, name text, public bool DEFAULT false)`, `storage.objects(id uuid PK DEFAULT gen_random_uuid(), bucket_id text, name text, owner uuid)` with **RLS enabled** (as on every real Supabase project), `storage.foldername(name text) RETURNS text[]`
- Roles `anon`/`authenticated`/`service_role` (BYPASSRLS); `GRANT USAGE ON SCHEMA public, auth, storage` and `GRANT ALL ON ALL TABLES/FUNCTIONS` to all three, **plus `ALTER DEFAULT PRIVILEGES`** so every table the migration creates later inherits the grants — i.e. the migration's `REVOKE ... FROM anon` (lines 357–359) runs against a genuinely granted state, exactly like a Supabase project
- **Decoys (deliberately foreign behavior):** `public.update_updated_at_column()` sets `NEW.updated_at := '1999-01-01'::timestamptz` (sentinel); `public.immutable_user_id()` is a no-op (`RETURN NEW`)
- Seed users `11111111-1111-1111-1111-111111111111` (A) and `22222222-2222-2222-2222-222222222222` (B); one pre-existing "other app" table `public.legacy_clips` with 1 row
- PostgREST simulation in tests: each test = one transaction doing `set_config('role', X, true)` + `set_config('request.jwt.claims', '{"sub":"<uuid>","role":"..."}', true)` (identical semantics to `SET LOCAL ROLE` / `SET LOCAL request.jwt.claims`)

---

## 3. Test results — **38 / 38 PASS** (captured output)

Driver: `31_rls_tests_driver.sh` → `PASS=38 FAIL=0 PSQL_ERRORS=0`, `RESULT: PASS`.
Full raw log: `scripts/migration-validation/logs/rls_tests.log`.

### A. `studio_projects` — authenticated ownership (8 tests)

```
TEST A01_select_own_project: PASS (rows=1 (expected 1))
TEST A02_cannot_select_other_project: PASS (rows=0 (expected 0))
TEST A03_insert_own_project: PASS (inserted id=10000000-0000-0000-0000-00000000000a)
TEST A04_cannot_insert_as_other_user: PASS (new row violates row-level security policy for table "studio_projects")
TEST A05_cannot_update_other_project: PASS (rows_affected=0 (expected 0))
TEST A06_cannot_delete_other_project: PASS (rows_affected=0, row_still_exists=1)
TEST A07_user_id_immutable: PASS (subwaytakes: user_id is immutable)
TEST A08_owner_can_update_own: PASS (rows_affected=1 (expected 1))
```

A07 is the exact exception message from `subwaytakes_guard_immutable_user_id()` (migration line 100).

### B. `studio_render_jobs` — client-restricted, service-role-only writes (8 tests)

```
TEST B01_client_insert_blocked: PASS (subwaytakes: render/caption job writes are restricted to service-role context)
TEST B02_client_update_status_blocked: PASS (rows_affected=0, status_after=queued)
TEST B03_client_update_user_id_blocked: PASS (rows_affected=0, owner_after=22222222-2222-2222-2222-222222222222)
TEST B04_client_select_own_jobs_only: PASS (own_rows=1 (expected 1), other_visible_rows=0 (expected 0))
TEST B05_service_role_insert_ok: PASS (inserted id=20000000-0000-0000-0000-000000000003)
TEST B06_service_role_update_heartbeat: PASS (rows=1 status=running progress=42 output_url=https://svc.example/rj.mp4)
TEST B07_service_role_lifecycle_done: PASS (rows=1 status=done)
TEST B08_service_role_select_all: PASS (rows=3 (expected 3))
```

Observed behavior worth recording: a client INSERT fails with the **guard exception** (`subwaytakes: render/caption job writes are restricted to service-role context`) because the `BEFORE INSERT` trigger fires *before* RLS `WITH CHECK` is evaluated; a client UPDATE is stopped one layer earlier by RLS (**0 rows affected**, row untouched).

### C. Render-worker query compatibility (4 tests) — the worker's actual claim/update shapes as `service_role`

```ts
// render-worker/src/storage.ts:100-110 (claimNextJob), executed verbatim in SQL:
UPDATE studio_render_jobs
SET status='running', worker_id='worker-integration-1', updated_at=now()
WHERE id=(SELECT id FROM studio_render_jobs WHERE status='queued' ORDER BY created_at LIMIT 1)
  AND status='queued';
```

```
TEST C01_worker_claim_first: PASS (claimed=20000000-0000-0000-0000-000000000001 rows=1 status=running worker=worker-integration-1)
TEST C02_worker_claim_second: PASS (claimed=20000000-0000-0000-0000-000000000002 rows=1)
TEST C03_worker_claim_empty_queue: PASS (rows=0 (expected 0))
TEST C04_done_job_untouched: PASS (status=done)
```

The two-step optimistic claim claims **exactly one row** per invocation (the oldest `queued` job), the completed job is never reclaimed, and an empty queue is a clean 0-row no-op.

### D. `muapi_caption_jobs` — same restriction model (6 tests)

```
TEST D01_client_insert_blocked: PASS (subwaytakes: render/caption job writes are restricted to service-role context)
TEST D02_client_update_blocked: PASS (rows_affected=0, status_after=queued)
TEST D03_client_select_own_only: PASS (own_rows=1 (expected 1), other_visible_rows=0 (expected 0))
TEST D04_service_role_insert_ok: PASS (inserted id=30000000-0000-0000-0000-000000000003)
TEST D05_service_role_lifecycle: PASS (rows1=1 rows2=1 status=done request=muapi-req-123)
TEST D06_service_role_select_all: PASS (rows=3 (expected 3))
```

### E. Storage — `studio-uploads` bucket policies (6 tests)

```
TEST E01_storage_insert_own_folder_ok: PASS (inserted id=40000000-0000-0000-0000-000000000003)
TEST E02_storage_select_own_ok: PASS (own_visible=2 (expected 2), new_row_visible=1 (expected 1))
TEST E03_storage_cannot_select_other: PASS (rows=0 (expected 0))
TEST E04_storage_insert_other_folder_blocked: PASS (new row violates row-level security policy for table "objects")
TEST E05_anon_insert_revoked: PASS (permission denied for table studio_projects)
TEST E06_anon_select_isolation: PASS (rows=0 (expected 0))
```

E01: user A inserted `storage.objects` row `name='11111111-.../project/clip.mp4'`, `bucket_id='studio-uploads'` — allowed by `subwaytakes_studio_uploads_insert_own` and immediately SELECT-visible. E05 is the REVOKE proof: anon INSERT denied at the grant layer (`permission denied`), and the grant-level state after the migration is `anon_insert=f, anon_update=f, anon_delete=f, anon_select=t` on all three tables (see inventory §4).

### F. `updated_at` triggers + decoy coexistence (3 tests)

```
TEST F01_updated_at_trigger_fires: PASS (before=2026-10-12 01:20:28.072686+00 after=2026-10-12 01:20:28.093233+00 (sentinel 1999-01-01 must NOT appear; after must be recent))
TEST F02_trigger_uses_subwaytakes_function: PASS (decoy_triggers=0 (expected 0), subwaytakes_triggers=3 (expected 3))
TEST F03_decoy_still_writes_sentinel: PASS (decoy wrote updated_at=1999-01-01 00:00:00+00 (expected 1999-01-01 00:00:00))
```

F01 proves updating a project row refreshes `updated_at` to *now* (not the `1999-01-01` sentinel). F03 proves the decoy `update_updated_at_column()` itself is untouched (it still writes its sentinel when attached to a scratch table) — i.e. it is **not** what fires on the studio tables (F02: 0 studio triggers reference it; 3 reference `subwaytakes_set_updated_at`).

### G. Shared-database coexistence (3 tests)

```
TEST G01_existing_table_untouched: PASS (legacy_clips rows=1 (expected 1))
TEST G02_auth_users_untouched: PASS (users=2 (expected 2), triggers=0 (expected 0))
TEST G03_no_foreign_policy_leak: PASS (policies=0 (expected 0))
```

### Suite summary

```
SUMMARY_TOTAL=38   SUMMARY_PASSED=38   SUMMARY_FAILED=0
PASS=38 FAIL=0 PSQL_ERRORS=0 → RESULT: PASS
```

The same suite was executed a second time after the rollback→re-apply cycle (§7) with the identical result: `PASS=38 FAIL=0`.

---

## 4. Object inventory (before → after)

**Before the migration** (substrate only): public tables `harness_*`/`legacy_clips` only; 0 studio tables/policies/triggers/indexes; 0 `studio-*` buckets; both decoy functions present.

**After the migration** (captured from `20_inventory.sql`, post re-apply — raw log `logs/inventory_after_2.log`):

| Category | Count | Objects |
|---|---|---|
| Tables | **3** | `studio_projects` (7 cols), `studio_render_jobs` (13 cols incl. `project_snapshot jsonb NOT NULL`), `muapi_caption_jobs` (14 cols) |
| Policies | **10** | 4 × `subwaytakes_studio_projects_{select,insert,update,delete}_own`; 1 × `subwaytakes_studio_render_jobs_select_own`; 1 × `subwaytakes_muapi_caption_jobs_select_own`; 4 × `subwaytakes_studio_{exports,uploads}_{read,insert}_own` on `storage.objects` |
| Triggers | **8** | 3 × `trg_*_subwaytakes_updated_at` → `subwaytakes_set_updated_at`; 3 × `trg_*_subwaytakes_immutable_user` → `subwaytakes_guard_immutable_user_id`; 2 × `trg_{studio_render_jobs,muapi_caption_jobs}_subwaytakes_guard_job_writes` → `subwaytakes_guard_job_writes` |
| Functions (migration) | **3** | `subwaytakes_set_updated_at`, `subwaytakes_guard_immutable_user_id`, `subwaytakes_guard_job_writes` (all in `public`, all `SECURITY INVOKER` — `prosecdef = f`) |
| Indexes | **6** | `subwaytakes_idx_studio_projects_user_updated`, `subwaytakes_idx_studio_render_jobs_queue` (partial `WHERE status='queued'`), `subwaytakes_idx_studio_render_jobs_user`, `subwaytakes_uq_studio_render_jobs_active_per_project` (partial **unique** — the one-active-job guard), `subwaytakes_idx_muapi_caption_jobs_project`, `subwaytakes_idx_muapi_caption_jobs_user` |
| Buckets | **2** | `studio-exports` (private), `studio-uploads` (private) |
| RLS | enabled | `studio_projects=t`, `studio_render_jobs=t`, `muapi_caption_jobs=t`, `storage.objects=t` |

Grant state after migration (REVOKE proof): `anon` has `INSERT=f, UPDATE=f, DELETE=f, SELECT=t` on all three studio tables; `authenticated`/`service_role` unaffected.

---

## 5. Decoy-function coexistence proof

The migration contains **no** `CREATE OR REPLACE FUNCTION` / `CREATE FUNCTION` for `update_updated_at_column` or `immutable_user_id` — the only functions it defines are the three `subwaytakes_*` names (migration lines 80, 93, 123). Verdict: **byte-identical, confirmed.**

| Decoy | md5 of `pg_get_functiondef()` before migration | after apply #2 |
|---|---|---|
| `public.update_updated_at_column` (+ `immutable_user_id` section) | `815999759edc7203250073bfd117c67d` | `815999759edc7203250073bfd117c67d` |

Decoy definitions (unchanged, captured after double apply):

```sql
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at := '1999-01-01'::timestamptz; -- SENTINEL: decoy behavior
  RETURN NEW;
END;
$function$

CREATE OR REPLACE FUNCTION public.immutable_user_id()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- SENTINEL: decoy no-op — does NOT reject user_id changes
  RETURN NEW;
END;
$function$
```

Behavioral cross-checks: F03 (decoy still writes `1999-01-01`) and F01 (studio rows get a *recent* timestamp) together prove the studio triggers use `subwaytakes_set_updated_at`, not the decoy.

---

## 6. Idempotency proof

Apply #1 and apply #2 of the **same file** both completed with **exit 0 and zero ERROR lines** (apply #2 output contains only `... already exists, skipping` / `DROP ... IF EXISTS` NOTICEs — the latter are the guards firing, not errors).

```
after_apply_1:  tables=3 | policies=10 | triggers=8 | functions=3 | indexes=6 | buckets=2 | decoys=2
after_apply_2:  tables=3 | policies=10 | triggers=8 | functions=3 | indexes=6 | buckets=2 | decoys=2
```

`diff` of the full `20_inventory.sql` output between apply #1 and apply #2 is **empty** (`PASS: idempotent — inventory identical after re-apply (diff empty)`; `logs/inventory_diff.txt` is 0 bytes).

---

## 7. Rollback proof (from `docs/SHARED_DB_COMPATIBILITY.md` §5.2 — adapted, see §9)

Adapted rollback executed by `40_rollback_test.sh` (drops: 4 storage policies → storage objects + 2 bucket rows → 3 tables CASCADE → 3 `subwaytakes_*` functions):

```
== [1] ROLLBACK ==
DROP POLICY ×4 · DELETE 3 · DELETE 2 · DROP TABLE ×3 · DROP FUNCTION ×3   (all exit 0)

== [2] verify rollback ==
 studio_tables | studio_policies | studio_triggers | studio_functions | studio_indexes | studio_buckets | decoys_still_present | legacy_clips_rows
              0 |               0 |               0 |                0 |              0 |              0 |                    2 |                 1

== [5] compare pre-rollback vs post-re-apply inventory ==
PASS: rollback -> re-apply reproduces the identical object inventory      (diff empty)

== [6] re-run RLS suite against the re-applied schema ==
PASS=38 FAIL=0 PSQL_ERRORS=0 → RESULT: PASS
```

All 6 studio categories return to **0** after rollback, both decoys and the pre-existing `legacy_clips` table survive, and re-applying the migration rebuilds the **identical** inventory with the full RLS suite green.

---

## 8. Static compatibility check — worker + frontend vs final schema (44 checks, 0 failures)

`50_static_compat_check.sh` verified every column/filter used by `render-worker/src/storage.ts` (+ `render-worker/src/config.ts`) and `src/lib/studioProjects.ts` exists in the final schema (`STATIC CHECK TOTAL=44 FAILS=0`):

| Consumer | Query shape | Columns / filters used | Result |
|---|---|---|---|
| `render-worker/src/storage.ts:88-116` (`claimNextJob`) | select `*` `.eq('status','queued').order('created_at').limit(1)`; update `{status,worker_id,updated_at}.eq('id').eq('status','queued')` | `status`, `created_at`, `worker_id`, `updated_at`, `id` | PASS |
| `render-worker/src/storage.ts:129-152` (`reclaimStaleJobs`) | select `id, worker_id` `.eq('status','running').lt('updated_at',cutoff)`; update `.in('id', ids)` | `id`, `worker_id`, `status`, `updated_at` | PASS |
| `render-worker/src/storage.ts:155-205` (progress/heartbeat/done/error) | update `{progress,updated_at}`, `{updated_at}`, `{status,output_url,progress,error,updated_at}` | `progress`, `output_url`, `error`, `status`, `updated_at` | PASS |
| `render-worker/src/storage.ts:208-217` (`fetchProjectSnapshot`) | select `project` `.eq('id')` | `studio_projects.project`, `id` | PASS |
| `render-worker/src/config.ts:67` + `storage.ts:233-255` (upload/sign) | bucket `studio-exports`, upsert + `createSignedUrl` | bucket exists, private | PASS |
| `src/lib/studioProjects.ts:70-119` (project CRUD) | insert `{id,user_id,title,project,version}`; select `project`; update `{project,title,updated_at}` | all exist | PASS |
| `src/lib/studioProjects.ts:142-149` (`uploadFootage`) | bucket `studio-uploads` (`UPLOAD_BUCKET`), `upsert:true`, path `<user_id>/<project_id>/…` | bucket exists; INSERT policy matches first folder = `auth.uid()` (E01/E02) | PASS |
| `src/lib/studioProjects.ts:178-240` (`loadLatestRenderJob`, `watchRenderJob`) | select `*` `.eq('project_id').order('created_at')` / `.eq('id')`; realtime filter `id=eq.<jobId>` | `project_id`, `created_at`, `id`, all `StudioRenderJobRow` columns | PASS |
| `muapi_caption_jobs` consumers (row type) | — | all 14 columns incl. `captions`, `render_job_id`, `mode`, `muapi_request_id`, `language`, `theme` | PASS |

Note (documented, not a defect): the worker lives outside the browser realtime channel and the client additionally polls every 3 s (`src/lib/studioProjects.ts:190,232-233`), so realtime-publication membership of `studio_render_jobs` affects latency only.

---

## 9. Findings

### Migration defects: **NONE**

Every check passed against the real PostgreSQL 14 instance. Specifically confirmed: the migration is self-contained (defines all three functions it uses — lines 80/93/123 — and consumes nothing from the 37-file history), never touches the generic names (`update_updated_at_column`, `immutable_user_id`), is idempotent, revokes anon DML (lines 357–359) against a granted state, creates private buckets non-destructively (lines 370–376), enforces owner CRUD on `studio_projects` while confining client access on both job tables to SELECT-only with a BEFORE INSERT/UPDATE guard (lines 123–180, 280–283, 337–340), and leaves pre-existing tables/users untouched.

### Documentation mismatch found (real finding — adapted in the harness, reported here)

`docs/SHARED_DB_COMPATIBILITY.md` was written against the **pre-hardening draft** and §5.2's rollback (and §2's inventory, §5.1's patch suggestions) reference **names the corrected migration renamed**. A rollback executed verbatim from the doc would silently leave objects behind (orphaned functions) or fail to find objects:

| Doc reference | Doc name (stale) | Actual object created by the corrected migration |
|---|---|---|
| §5.2 rollback step 4 | `subwaytakes_touch_updated_at()` | **`subwaytakes_set_updated_at()`** — migration line 80 |
| §5.2 rollback step 4 | `subwaytakes_immutable_user_id()` | **`subwaytakes_guard_immutable_user_id()`** — migration line 93 |
| §5.2 (not mentioned) | — | **`subwaytakes_guard_job_writes()`** — migration line 123 (would be left orphaned by the doc's rollback) |
| §2.3 triggers | `trg_studio_projects_updated_at` etc. | `trg_studio_projects_subwaytakes_updated_at` etc. — lines 200–219; plus the two `trg_*_subwaytakes_guard_job_writes` triggers the doc never lists |
| §2.4 table policies | `studio_projects_select_own` etc. (16) | `subwaytakes_studio_projects_select_own` etc. — **10** policies, lines 215–234, 292–295, 348–351 |
| §2.6 storage policies | `studio_exports_read_own` etc. | `subwaytakes_studio_exports_read_own` etc. — lines 381–399 |
| §2.5 / §5.1 | `immutable_user_id()` (redefined) | **deliberately not created** — the corrected migration defines only `subwaytakes_*` functions |

The harness (`40_rollback_test.sh`) uses the **actual** names; the rollback was proven effective (all 6 categories → 0, §7). The doc should be updated to the renamed objects; the migration itself needs no change.

---

## 10. Phase-5 validation checklist → evidence map

| # | Mission Phase-5 validation item | Evidence |
|---|---|---|
| 1 | **Table creation** | Inventory §4: 3 tables, correct columns (incl. `project_snapshot jsonb NOT NULL`); apply log `CREATE TABLE` ×3; before-inventory 0 tables |
| 2 | **RLS policies** | Inventory §4: 10 policies exact `auth.uid()::text = user_id::text` / `foldername()[1] = auth.uid()::text` predicates; RLS enabled on 4 tables; tests A01–A06, B04, D03, E01–E04 |
| 3 | **Storage bucket access** | Buckets `studio-exports`/`studio-uploads` private; E01 (own-folder INSERT + SELECT), E04 (other-folder INSERT denied: `new row violates row-level security policy for table "objects"`) |
| 4 | **Authenticated ownership** | A01/A03/A08 (owner SELECT/INSERT/UPDATE succeed); A05/A06 (non-owner UPDATE/DELETE → 0 rows, row survives); A04 (insert-as-other-user → RLS violation) |
| 5 | **Cross-user isolation** | A02, B04 (`own_rows=1, other_visible_rows=0`), D03, E03; anon fully isolated (E06) |
| 6 | **Render-job permissions** | B01 (client INSERT → `subwaytakes: render/caption job writes are restricted to service-role context`), B02/B03 (client UPDATE → 0 rows, row untouched), B05–B08 (service-role INSERT/heartbeat/lifecycle/all-SELECT) |
| 7 | **Caption-job permissions** | D01–D06: identical restriction model incl. `captions`/`output_url` protection and full service-role lifecycle |
| 8 | **Shared functions unchanged** | §5: decoys byte-identical (md5 `815999759edc7203250073bfd117c67d` before == after); F02/F03 behavioral proof; G02/G03 |
| 9 | **Existing app tables unchanged** | G01 (`legacy_clips` rows=1), G02 (auth.users: 2 users, 0 triggers added), G03 (no foreign policy leak); inventory shows only additive `subwaytakes_*` objects |
| 10 | **Render-worker query compatibility** | C01–C04 (claim-two-step claims exactly 1 row; empty queue 0 rows; done job untouched); §8 static table (all worker columns/filters exist) |
| 11 | **Frontend query compatibility** | §8 static table (44/44): `src/lib/studioProjects.ts` insert/select/update columns, `studio-uploads` bucket, filters `id`/`project_id`/`created_at`, realtime filter column |

**Reproduce:** `scripts/migration-validation/run_all.sh` (fresh DB; every artifact above is regenerated under `scripts/migration-validation/logs/`).
