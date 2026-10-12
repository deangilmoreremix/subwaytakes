# Shared-DB Live Audit Plan — SubwayTakes Studio

**Target:** shared Supabase project `bzxohkrxcwodllketcpz` ("VideoRemix Product" — a Supabase project **shared by multiple applications**, with a migration history that differs from this repo's 37 files)
**Branch:** `feat/subway-interview-studio`
**Sole artifact to apply after this audit passes:** `supabase/migrations/20261011090000_studio_projects_and_render_jobs.sql`
**This is Phase 2:** *compare the live database objects against the exact PR-head migration, before applying anything.*

| Kit file | Role |
|---|---|
| `scripts/shared-db-audit/01_readonly_queries.sql` | The 24 read-only queries (Q1–Q24), labelled for both psql and the SQL Editor. |
| `scripts/shared-db-audit/run_audit.sh` | Runner: `psql` if `SHARED_DB_URL`/`PG*` is set (wraps each query in `SET TRANSACTION READ ONLY`, `--csv`); prints operator instructions and **exits 3** if there are no credentials. Refuses unknown args; fails closed on any DDL/DML. |
| `scripts/shared-db-audit/expected-results.md` | Expected output for every query + the GO/NO-GO summary + config-failure fallbacks. |
| `docs/SHARED_DB_AUDIT_RESULT.md` | **Generated** by the runner from live `psql` output (create-or-overwrite). Never fabricated. |
| `docs/SHARED_DB_AUDIT_PLAN.md` | This file. |

## 1. Purpose

Before the corrected Studio migration is applied to the shared project, prove **from the live database** that:

1. This really is a Supabase-managed instance with a migration history that diverges from this repo (so a single-file apply — not a full-history push — is the correct posture).
2. **None of the 32 objects the PR-head migration creates already exist** (no silent adoption / collision with another app).
3. The coexistence and dependency facts Studio relies on are **known**: the shared `videos` bucket (Blocker B3), `user_profiles` shape, anonymous-sign-in state, and any global `auth.users` provisioning trigger.

The audit is **read-only**. It never mutates the target. It is a gate, not the apply.

## 2. Constraints (read this first)

- **This audit cannot be executed in the current environment.** There are no Supabase credentials here, and the shared database must not be contacted from CI/agents. **All live results must be produced by an operator** (or the coordinator if credentials appear). Every live-state claim stays `REQUIRES VERIFICATION (no DB access)` until then.
- The kit only ever writes a result file when run **with** credentials; with none it **exits 3** and fabricates nothing.
- Naming authority: this plan and the queries use the **corrected PR-head migration's** names (`subwaytakes_*`). Two existing docs predate that rename — see §7.

## 3. Prerequisites

- One of: a `SHARED_DB_URL` connection string, or `PGHOST` + `PGPASSWORD` (plus optional `PGPORT`/`PGUSER`/`PGDATABASE`); **or** access to the Dashboard SQL Editor.
- `psql` on `PATH` (for the runner path).
- Right to connect as `postgres` (the Studio migration and its bookkeeping are owner-level operations; the audit itself only reads catalogs).

## 4. How to run (three paths)

### Path A — `run_audit.sh` over psql (recommended; enforces read-only)

```bash
# Option A1: full URI (Dashboard → Project Settings → Database → Connection string → URI)
export SHARED_DB_URL='postgresql://postgres.<ref>:<password>@db.<ref>.supabase.co:5432/postgres'
scripts/shared-db-audit/run_audit.sh

# Option A2: libpq env (host + password required)
export PGHOST="db.<ref>.supabase.co" PGPORT=5432 PGUSER=postgres \
       PGDATABASE=postgres PGPASSWORD='<database-password>'
scripts/shared-db-audit/run_audit.sh
```

Behavior:

- The file is split into Q-labelled blocks; **each block runs in `BEGIN; SET TRANSACTION READ ONLY; <q>; COMMIT;`** with `psql -X --csv -q -v ON_ERROR_STOP=1 -w`. Supabase's direct connection (and the transaction-mode pooler) both honour read-only transactions, so a write anywhere in the set would abort the transaction rather than commit.
- Raw CSV is written to `docs/SHARED_DB_AUDIT_RESULT.md` with a per-query `\echo` label and a markdown header; the transaction command-tag lines (`BEGIN`/`SET`/`COMMIT`) are suppressed by `-q`.
- `--dry-run` verifies files/guard and prints the plan **without connecting**; `--help` prints usage. **Any other argument is refused** (exit 1).
- **No credentials ⇒ exit 3** with the exact instructions above (nothing is contacted).

### Path B — Supabase SQL Editor (no connection string)

Dashboard → **SQL Editor** → *New query* → paste the **entire** contents of `scripts/shared-db-audit/01_readonly_queries.sql` → *Run*. Every statement is a `SELECT`, so it is safe; the `-- ===== Qn ...` lines are plain comments that label each result grid. Copy the grids into `docs/SHARED_DB_AUDIT_RESULT.md` and compare with `expected-results.md`.

Caveat: the SQL Editor auto-commits per statement and cannot wrap the run in a read-only transaction, so the read-only guarantee there rests on the statements being pure SELECTs (they are). Prefer Path A when a connection string is available.

### Path C — `supabase db execute` (CLI) — last resort, read the limits

- The CLI connects with the database password and pipes the file as-is: it has **no read-only transaction wrapper**, so again read-safety depends on the statements being SELECTs. The runner's DDL/DML guard (Path A) is the real safety net; the CLI provides none.
- Behavior/availability varies by CLI version (`supabase db execute` is relatively new).
- **Do NOT use `supabase db push`.** It reconciles this repo's 37-file local history against the divergent shared history and would try to apply all of them — several of which are destructive in a shared schema (see `docs/SHARED_DB_COMPATIBILITY.md` §7). The shared project takes exactly **one** file.

> After a GO decision, the actual single-file apply procedure is in `docs/SHARED_DB_COMPATIBILITY.md` §7.2 (apply in the SQL Editor/psql as owner, record the version in `supabase_migrations.schema_migrations`, then `notify pgrst, 'reload schema'`). That apply is **out of scope for this audit**.

## 5. Conflict matrix (Phase-2 deliverable)

Every object the PR-head migration creates, its probe, its expected live state (**ABSENT**), and the action if a conflict is found. Key mechanic: the migration is **idempotent/guarded**, so on a conflict it does not fail loudly — it silently attaches, adopts, or deterministically re-creates. That silent behavior is exactly what this pre-apply gate exists to catch.

### 5.1 Tables (3) — probe Q4/Q11 · expected ABSENT

| Object | What happens on conflict | If conflict found |
|---|---|---|
| `public.studio_projects` | `CREATE TABLE IF NOT EXISTS` attaches to the existing (foreign) table shape | **STOP.** Determine owner: a Studio prior apply with matching shape → safe to finish idempotently; another app → coordinate/rename (rename ripples into `src/lib/studioProjects.ts` + edge functions). |
| `public.studio_render_jobs` | same | same |
| `public.muapi_caption_jobs` | same | same |

### 5.2 Indexes (6) — probe Q5/Q11 · expected ABSENT

| Object | On conflict | Action |
|---|---|---|
| `subwaytakes_idx_studio_projects_user_updated` | index cannot exist without its table; `CREATE INDEX IF NOT EXISTS` no-ops | Treat as the §5.1 **table** conflict — STOP/investigate. |
| `subwaytakes_idx_studio_render_jobs_queue` | same | same |
| `subwaytakes_idx_studio_render_jobs_user` | same | same |
| `subwaytakes_uq_studio_render_jobs_active_per_project` (partial unique) | same | same |
| `subwaytakes_idx_muapi_caption_jobs_project` | same | same |
| `subwaytakes_idx_muapi_caption_jobs_user` | same | same |

### 5.3 Triggers (8) — probe Q6/Q11 · expected ABSENT

| Object | On conflict | Action |
|---|---|---|
| `trg_studio_projects_subwaytakes_updated_at` | `DROP TRIGGER IF EXISTS` + `CREATE` (deterministic) | On a Studio prior apply → benign. On a foreign `studio_projects` → the §5.1 table conflict applies (STOP). |
| `trg_studio_projects_subwaytakes_immutable_user` | same | same |
| `trg_studio_render_jobs_subwaytakes_updated_at` | same | same |
| `trg_studio_render_jobs_subwaytakes_immutable_user` | same | same |
| `trg_studio_render_jobs_subwaytakes_guard_job_writes` | same | same |
| `trg_muapi_caption_jobs_subwaytakes_updated_at` | same | same |
| `trg_muapi_caption_jobs_subwaytakes_immutable_user` | same | same |
| `trg_muapi_caption_jobs_subwaytakes_guard_job_writes` | same | same |

### 5.4 Functions (3) — probe Q7/Q11 · expected ABSENT (pre-apply)

| Object | On conflict | Action |
|---|---|---|
| `public.subwaytakes_set_updated_at()` | `CREATE OR REPLACE` overwrites | Prefixed ⇒ almost certainly Studio's own prior apply (idempotent). Confirm owner; a foreign owner of a `subwaytakes_*` name is near-impossible. Not a cross-app hazard. |
| `public.subwaytakes_guard_immutable_user_id()` | same | same |
| `public.subwaytakes_guard_job_writes()` | same | same |

### 5.5 Table policies (6) — probe Q8/Q11 · expected ABSENT

| Object | On conflict | Action |
|---|---|---|
| `subwaytakes_studio_projects_select_own` | `DROP POLICY IF EXISTS` + `CREATE` | Studio prior apply → benign. Another app reusing the exact name on a Studio table → coordinate. |
| `subwaytakes_studio_projects_insert_own` | same | same |
| `subwaytakes_studio_projects_update_own` | same | same |
| `subwaytakes_studio_projects_delete_own` | same | same |
| `subwaytakes_studio_render_jobs_select_own` | same | same |
| `subwaytakes_muapi_caption_jobs_select_own` | same | same |

### 5.6 Storage policies (4) — probe Q9/Q11 · expected ABSENT

`storage.objects` policy names live in a **shared, project-wide** namespace, so exact-name reuse by another app is conceivable. On conflict the migration `DROP POLICY IF EXISTS` + `CREATE`s.

| Object | Action if present |
|---|---|
| `subwaytakes_studio_exports_read_own` | Studio prior apply → benign; foreign exact-name reuse → coordinate before it is dropped. |
| `subwaytakes_studio_exports_insert_own` | same |
| `subwaytakes_studio_uploads_read_own` | same |
| `subwaytakes_studio_uploads_insert_own` | same |

### 5.7 Buckets (2) — probe Q10/Q11/Q14 · expected ABSENT

| Object | On conflict | Action |
|---|---|---|
| `studio-exports` | guarded insert leaves an existing bucket **untouched** (visibility/limits/MIME preserved) → Studio **silently adopts** a foreign bucket (possibly public, wrong limits) | **STOP.** Rename to `subwaytakes-exports` (migration + `render-worker/src/config.ts:67` + `render-worker/src/storage.ts`) and coordinate with the owner. |
| `studio-uploads` | same | Rename to `subwaytakes-uploads` (migration + `src/lib/studioProjects.ts`) and coordinate. |

### 5.8 Shared-object coexistence (informational — record, do not act)

These are **not** the migration's conflict surface (the corrected migration does not create/replace them), but the GO decision and risk picture depend on knowing their state.

| Object | Probe | Expected | Note |
|---|---|---|---|
| `public.update_updated_at_column()`, `public.immutable_user_id()` | Q12 | 0+ rows | **Must not be touched.** The corrected migration defines only `subwaytakes_*`; these are reported with full `pg_get_functiondef` for the record. (See §7 — the old B1/B2 blocker framing is resolved.) |
| `handle_new_user`, `deduct_credits`, `reorder_compilation_clips`, `get_analytics_summary`, `atomic_deduct_tokens`, `assign_episode_number` | Q13 | 0+ rows | Legacy/shared RPC surface; owner unknown. Studio editor needs none. |
| Bucket `videos` (public + limits + object count) | Q14/Q15 | record | **Blocker B3.** Decides whether `scene-status`/`muapi-captions` keep using it (public + MP4-compatible → keep; else repoint to `studio-exports`). Absent = AI-asset path has no home. |
| `storage.objects` policies | Q16 | record | Confirms no `subwaytakes_*` yet; reveals other apps' rules. |
| `auth.users` counts + `is_anonymous` | Q17 | record | Anonymous sign-in proxy. |
| `auth.users` provisioning/event triggers | Q18 | record | Any `on_auth_user_created`-style global trigger → report; Studio must not depend on / conflict with it. |
| `user_profiles` columns / RLS / grants / policies | Q19–Q21 | record | Decides whether the `auth.tsx` full-upsert works (drift degrades to the `{id}` upsert + one warn — non-fatal). |
| Grant pattern on a sample shared table | Q22 | confirm | `anon` SELECT-only, `authenticated` CRUD, `service_role` all — the default-grant assumption. |
| `auth.uid()` policy pattern | Q24 | record | Confirms house-style scoping is in use. |

## 6. GO / NO-GO

**GO** requires **all** of the following:

1. **Supabase-managed:** Q1 `supabase_managed_likely = t`.
2. **No Studio-object conflicts:** Q4–Q10 empty **and** Q11 = `0,0,0,0,0,0,0`.
3. **`videos` bucket visibility known:** Q14/Q15 executed. If present, `public` + limits recorded and the B3 disposition decided (keep `getPublicUrl` if public and MP4-compatible; otherwise repoint `scene-status`/`muapi-captions` to `studio-exports` before enabling the AI paths). If absent, a documented decision that the AI-scene/styled-caption paths are out of scope for this rollout.
4. **`user_profiles` shape known:** Q19–Q21 executed and recorded (expected columns present, or the tolerated drift documented).
5. **Anonymous auth confirmed or documented:** Q17 executed; ideally `anonymous_users > 0`, otherwise the operator confirms **Dashboard → Authentication → Providers → Anonymous** is enabled (the whole identity model starts with `signInAnonymously()`).
6. **No unexpected `auth.users` provisioning trigger conflict:** Q18 executed; a global `on_auth_user_created`-style trigger, if any, is recorded and confirmed non-conflicting (Studio adds none and its client upsert ladder handles both row states).
7. **Grant pattern confirmed:** Q22 non-empty (superseded-assumption check), **or** recorded as "no legacy candidate present" (not a Studio blocker).

**NO-GO** otherwise — with the exact blocker: the QID, what it showed, and the §5 action. Common NO-GO lines:

- `Q11 = <nonzero>` (or any Q4–Q10 non-empty) → *conflict on object(s) X, Y* → §5 action.
- `Q1 supabase_managed_likely = f` → *not a Supabase instance*.
- `Q15 videos` present but `public = f` or MP4-incompatible, with no decision to repoint → *B3 unresolved*.
- Anonymous sign-ins neither evidenced (Q17 `anonymous_users = 0`) nor confirmed in the Dashboard → *identity model unverified*.

## 7. Reconciliation with existing docs (why these names)

Two docs predate the corrected migration and carry **stale names/assumptions** (cataloged in `docs/RLS_TEST_EVIDENCE.md` §9):

- `docs/SHARED_DB_COMPATIBILITY.md` §2/§5 was written against a pre-hardening **draft** (12–16 policies, `idx_studio_*`/`trg_studio_*` names, a migration that *consumed* `update_updated_at_column()` and *redefined* `immutable_user_id()`). The **corrected PR-head migration** renames everything under the `subwaytakes_` prefix (or the already-Studio-specific `studio_*`/bucket names), defines only its own three `subwaytakes_*` functions, and touches **neither** generic function. Therefore blockers **B1/B2 are resolved**, and Q12 reports those two functions informationally only.
- Exact corrected inventory this audit proves absent (matches `RLS_TEST_EVIDENCE.md` §4): **3 tables · 6 indexes · 8 triggers · 3 functions · 10 policies (6 table + 4 storage) · 2 buckets.** Triggers are `trg_<table>_subwaytakes_<purpose>`; the updated_at function is `subwaytakes_set_updated_at()` (not `subwaytakes_touch_updated_at`).

## 8. How to read the result file

`docs/SHARED_DB_AUDIT_RESULT.md` is grouped by query, each with a `### Qn — title` header and a fenced CSV block (`\echo` label + header row + data rows).

1. Start at the **Sign-off summary** at the top: `Q11 conflict row` and the errored-query count.
2. **Q11** must be `0,0,0,0,0,0,0`. Any nonzero → open the matching probe Q4–Q10 to see the offending object(s), and apply the §5 action.
3. Scan **Q4–Q10** — each should show a header row and **no data rows**.
4. Read **Q1–Q3** to confirm the environment and that the migration history diverges.
5. Read **Q12–Q24** and compare against `expected-results.md`; record the values (they are informational but feed §6 GO/NO-GO).
6. If any query shows an `**ERROR**` block, the runner captured it honestly and continued — read it, then use the fallback query from `expected-results.md` §"Queries that can fail on a specific Supabase configuration".

## 9. How this kit itself was verified (no live DB)

The audit of `bzxohkrxcwodllketcpz` **was not** and **cannot** be run here (no credentials; the shared DB must not be contacted from an agent). The **kit** was verified without it:

- **Shell syntax:** `bash -n scripts/shared-db-audit/run_audit.sh` → OK.
- **No-credential run:** exits **3**, prints the exact connection-string/SQL-Editor instructions, writes **nothing**, fabricates **nothing**.
- **`--dry-run`:** exits 0, prints the plan, and does **not** create the result file. **`--help`:** usage. **Unknown arg:** refused (exit 1).
- **Guard:** the SQL file has **zero** DDL/DML statements — scanning after comment + single-quoted-string stripping yields no `INSERT/UPDATE/DELETE/DROP/CREATE/ALTER/GRANT/REVOKE/TRUNCATE` token; the runner fails closed if that ever changes. (The guard's word-boundary regex correctly ignores identifiers like `created_at`/`*_insert_own` and quoted values like `has_table_privilege(tbl,'INSERT')`.)
- **Query validity + expected results, on real PostgreSQL 14:** the whole Q1–Q24 set was run against a local PG14 mock shared-DB (divergent `supabase_migrations`, decoy `update_updated_at_column`/`immutable_user_id`, a public `videos` bucket, a `user_profiles`/`clips` pair, and a global `on_auth_user_created` trigger — but **no** Studio objects). Every SELECT parsed and ran; **Q11 = `0,0,0,0,0,0,0`**; Q4–Q10 empty; Q23 all `table_exists=f`; informational queries returned the seeded rows. Applying the **real** Studio migration to that mock and re-running flipped **Q11 to `3,6,8,3,6,4,2`** and populated Q4/Q7/Q10 — proving the probes detect real conflicts (no false negatives). CSV header rows are emitted even for zero-row results (so an empty probe still shows which columns were checked).
- **Runner plumbing:** the split → `SET TRANSACTION READ ONLY` → `--csv` → result-writer path was exercised end-to-end against that mock via a throwaway copy, writing results only to a scratch path (the repo's `docs/SHARED_DB_AUDIT_RESULT.md` is intentionally **absent** in this environment; it is created only by an operator run).

Reproduce locally: build a Supabase-like PG14/PG15 scratch DB (roles `anon`/`authenticated`/`service_role`, `auth.users`, `storage.buckets`/`storage.objects`/`foldername`, `supabase_migrations.schema_migrations`), point `SHARED_DB_URL` at it, and run `run_audit.sh` — clean state gives `0,0,0,0,0,0,0`; after `psql -f supabase/migrations/20261011090000_...sql` it gives `3,6,8,3,6,4,2`.
