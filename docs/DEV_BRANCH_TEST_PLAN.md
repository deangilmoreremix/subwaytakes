# Dev-Branch Test Plan — SubwayTakes Studio migration against the shared project

**Objective:** prove `supabase/migrations/20261011090000_studio_projects_and_render_jobs.sql` applies and behaves correctly **before** it touches the shared project `bzxohkrxcwodllketcpz` ("VideoRemix Product"), without modifying production.
**Method:** Supabase **preview branches** (a full, isolated copy of the project's database — never production) with the read-only audit kit plus the single-migration guard; a separate free project is the fallback when branching is unavailable.
**Constraints honoured here:** no git commands, no commits, no live database contact — every command below is for the operator to run. Companion docs: `docs/SHARED_DB_COMPATIBILITY.md` (§8 audit kit, §5 self-containment, §7 history risk), `docs/RLS_TEST_EVIDENCE.md` (PG14 evidence to reproduce), `docs/MIGRATION_VERSION_COMPATIBILITY.md` (version audit), `docs/STAGING_RUNBOOK.md` Phases 0–7 (deployment steps this plan reuses for the smoke tests).

---

## 1. Step 0 — Is dev branching available on this project? (check before planning)

Branching is a **paid platform feature**: *"Branching — Not included"* on the Free plan; available on **Pro / Team / Enterprise** at `$0.01344` per branch-hour (Micro compute) on the Supabase pricing/plan matrix. So availability depends on the **organization's plan**, not on the project itself.

```bash
# 0.1  CLI installed? (any recent 1.x / 2.x; the CLI is NOT in this repo snapshot)
supabase --version

# 0.2  Authenticate the operator
supabase login

# 0.3  Link this checkout to the SHARED project (writes supabase/.temp/project-ref).
#      You will be prompted for the database password (Dashboard -> Settings -> Database).
supabase link --project-ref bzxohkrxcwodllketcpz
#      After linking, confirm the ref and that the branches subcommand is usable:
cat supabase/.temp/project-ref          # must print bzxohkrxcwodllketcpz

# 0.4  THE branching-availability check itself (read-only):
supabase branches list
#      (older CLI versions ship these as experimental:
#         supabase --experimental branches list)
```

Interpretation:

| `supabase branches list` result | Meaning | Path |
|---|---|---|
| Prints a branch table (even empty, just `main / PRODUCTION`) | Branching available on this org's plan | §2 (branch plan) |
| Errors with a plan/entitlement message (branch not enabled, upgrade required, 4xx on the branches API) | Organization is on the **Free** plan — branching unavailable | §3 (fallback: fresh free project) |
| Dashboard check if the CLI is ambiguous: open the project → branch selector next to `main / PRODUCTION` → **Create branch**. Free-plan orgs see an upgrade banner instead of the create form (`supabase/` dashboard implements this with an entitlement check, `promptProPlanUpgrade`) | — | as above |

Reality note: if the shared project's organization is Free, **there is no way to branch it** — buying Pro is a decision, not an operator step. The fallback in §3 is the documented workaround.

---

## 2. Branch-based test plan (no production modification)

Preview branches are separate environments with all services (DB, Auth, Storage) of their own; **branching never touches the parent project**. By default a branch starts **data-less** (no rows/objects copied) — exactly what this plan wants, because every Studio object will be created fresh by the migration.

### 2.1 Create the branch

```bash
supabase branches create studio-release-test
#      (older CLI versions: supabase --experimental branches create studio-release-test)
#      Creates a PREVIEW branch (ephemeral by default; billed per hour until deleted — see 2.9)
supabase branches get studio-release-test       # capture the branch project ref + status
supabase branches list                          # confirm it appears alongside main / PRODUCTION
```

### 2.2 Capture the branch's connection coordinates

The branch has its **own** ref, API keys and database — never reuse the parent project's values.

```bash
BRANCH_REF=<ref-of-studio-release-test>          # from `supabase branches get studio-release-test`
# Branch connection string (Dashboard of the BRANCH -> Settings -> Database), e.g.
#   direct:   postgres://postgres:<password>@db.$BRANCH_REF.supabase.co:5432/postgres
#   pooler:   postgres://postgres.$BRANCH_REF:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
export SHARED_DB_URL="postgres://postgres:<password>@db.$BRANCH_REF.supabase.co:5432/postgres"
#      Prefer the DIRECT connection for DDL. If you must use the pooler, use SESSION mode.
#      Keep this URL (it contains a password) out of the repo and out of shell history files.

# API surface for the functional smoke tests:
BRANCH_URL=$(supabase status --project-ref "$BRANCH_REF" --output json 2>/dev/null | jq -r '.API_URL' || echo "https://$BRANCH_REF.supabase.co")
export BRANCH_URL
```

### 2.3 Understand the branch's migration history (why exactly one file applies)

> A branch is seeded from the **source project's database/state**, not from this repository's `supabase/migrations/` directory. The branch's `supabase_migrations.schema_migrations` therefore contains the shared project's history (or a snapshot schema), **not this repo's 37-file history**. Two consequences:
>
> 1. `supabase db push` from this checkout against the branch would treat **all 35 timestamped files** as pending and replay them — destructive and forbidden (see §4).
> 2. The only file that must be applied is the single Studio artifact, by hand, through the guard script.

Confirm the incomplete-history state, if desired:

```bash
# Against the branch: the parent's migration log, not this repo's (informational only)
psql "$SHARED_DB_URL" -At -c "select version from supabase_migrations.schema_migrations order by version desc limit 3;"
# Compare with this repo's head: supabase/migrations/20261011090000_studio_projects_and_render_jobs.sql
```

### 2.4 Run the READ-ONLY audit kit first

Run every query from `docs/SHARED_DB_COMPATIBILITY.md` §8 (Q1–Q12) against the branch, in order. They are pure `SELECT`s — no writes, no service-role key required.

Expected results on the branch:

| Query | Expected | Why |
|---|---|---|
| Q1 studio tables | 0 rows | branch is data-less and Studio objects don't exist in the parent |
| Q2 buckets | no `studio-exports` / `studio-uploads`; record the rest (incl. `videos` — Blocker B3) | B3's verification happens HERE harmlessly |
| Q3 function names | record whether the parent carries `update_updated_at_column` / `immutable_user_id` | proves the B1/B2 hazard is absent in the shared project |
| Q4/Q5/Q6 studio triggers/policies/indexes | 0 rows | — |
| Q7 version + `gen_random_uuid` | PG15/PG17, one row in `pg_catalog` | satisfies `docs/MIGRATION_VERSION_COMPATIBILITY.md` §6 |
| Q8 `storage.foldername()` | present | platform standard |
| Q9/Q10 shared/legacy objects, `auth.users` triggers | RECORD only | what Studio must coexist with — the whole point of testing on a branch |
| Q11 realtime publication | record | latency-only |
| Q12 sign-off | 0/0/0/0 | — |

```bash
# execute the kit from the file (copy §8's SQL blocks into a .sql file, or run inline), e.g.:
psql "$SHARED_DB_URL" -At -c "select count(*) from information_schema.tables
  where table_schema='public'
    and table_name in ('studio_projects','studio_render_jobs','muapi_caption_jobs');"   # expect 0
```

### 2.5 Apply ONLY the Studio migration, through the guard

```bash
# 2.5a   Pre-flight only (no APPLY, no DB contact): file present + pinned sha256 +
#        studio-only statement scan — must print READY
scripts/apply-studio-migration.sh --check

# 2.5b   Apply EXACTLY ONE file, atomically (BEGIN/COMMIT, ON_ERROR_STOP=1)
APPLY=yes SHARED_DB_URL="$SHARED_DB_URL" scripts/apply-studio-migration.sh
#        Expected tail (from the script's own post-apply verification):
#          PASS tables 3 · PASS policies 10 · PASS triggers 8 · PASS functions 3
#          PASS indexes 6 · PASS buckets 2 · PASS rls 3 · PASS anon_dml 0
#          server version ... PostgreSQL 15.x / 17.x
#          VERDICT .......... PASS
#        Exit 0. On any guard violation it exits 3 and contacts no database.
```

Optional bookkeeping on the branch (mirrors `SHARED_DB_COMPATIBILITY.md` §7.2):

```sql
INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('20261011090000') ON CONFLICT DO NOTHING;
SELECT pg_notify('pgrst', 'reload schema');   -- makes the 3 tables queryable via PostgREST now
```

### 2.6 Run the migration-validation harness against the branch

The harness in `scripts/migration-validation/` targets a **local** scratch database (`runuser -u postgres -- psql -d subwaytakes_migration_test`). On a machine with `psql` and the branch URL, run the equivalent invocations **against the branch** (same SQL files):

```bash
# (a) read-only object inventory
psql "$SHARED_DB_URL" -X -v ON_ERROR_STOP=1 -f scripts/migration-validation/20_inventory.sql
#     Expect: 3 tables · 10 policies · 8 triggers · 3 functions · 6 indexes · 2 buckets,
#     RLS enabled on all 4 tables, anon = SELECT-only.
#     NOTE: 20_inventory.sql ends with `SELECT count(*) FROM public.legacy_clips;` — a
#     substrate-only fixture. Create it first (ONCE, on the branch only) so the file runs
#     cleanly, or ignore that last section's error:
psql "$SHARED_DB_URL" -c "CREATE TABLE IF NOT EXISTS public.legacy_clips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now());"

# (b) static compatibility check (44 checks from docs/RLS_TEST_EVIDENCE.md §8) —
#     every worker/frontend column must exist (expect 0 rows):
psql "$SHARED_DB_URL" -At -c "
SELECT tab||'.'||col AS missing FROM (VALUES
 ('studio_projects','id'),('studio_projects','user_id'),('studio_projects','title'),
 ('studio_projects','project'),('studio_projects','version'),('studio_projects','created_at'),
 ('studio_projects','updated_at'),
 ('studio_render_jobs','id'),('studio_render_jobs','user_id'),('studio_render_jobs','project_id'),
 ('studio_render_jobs','status'),('studio_render_jobs','progress'),('studio_render_jobs','output_url'),
 ('studio_render_jobs','captioned_output_url'),('studio_render_jobs','error'),('studio_render_jobs','worker_id'),
 ('studio_render_jobs','project_snapshot'),('studio_render_jobs','render_settings'),
 ('studio_render_jobs','created_at'),('studio_render_jobs','updated_at'),
 ('muapi_caption_jobs','id'),('muapi_caption_jobs','user_id'),('muapi_caption_jobs','project_id'),
 ('muapi_caption_jobs','render_job_id'),('muapi_caption_jobs','mode'),('muapi_caption_jobs','muapi_request_id'),
 ('muapi_caption_jobs','language'),('muapi_caption_jobs','theme'),('muapi_caption_jobs','status'),
 ('muapi_caption_jobs','output_url'),('muapi_caption_jobs','captions'),('muapi_caption_jobs','error'),
 ('muapi_caption_jobs','created_at'),('muapi_caption_jobs','updated_at')
) AS w(tab,col)
WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns c
                  WHERE c.table_schema='public' AND c.table_name=w.tab AND c.column_name=w.col);"
psql "$SHARED_DB_URL" -At -c "SELECT id FROM storage.buckets WHERE id IN ('studio-uploads','studio-exports');"  # expect 2 rows

# (c) idempotency — re-run the guard; the inventory must be unchanged
APPLY=yes SHARED_DB_URL="$SHARED_DB_URL" scripts/apply-studio-migration.sh   # VERDICT PASS again

# (d) behavioural RLS suite (30_rls_tests.sql, 38 tests) — BRANCH ONLY (see §4):
psql "$SHARED_DB_URL" -X -v ON_ERROR_STOP=1 -f scripts/migration-validation/30_rls_tests.sql 2>&1 \
  | grep -E 'TEST |SUMMARY|RESULT'
#     Expect: PASS=38 FAIL=0. The suite seeds users A/B and its own rows itself.
#     If `set_config('role','authenticated',true)` fails with "permission denied to set role",
#     grant role membership to the connecting superuser ONCE on the branch:
#       psql "$SHARED_DB_URL" -c "GRANT anon, authenticated, service_role TO postgres;"

# (e) rollback proof — OPTIONAL, and only if you intend to discard the branch afterwards:
#     run scripts/migration-validation/40_rollback_test.sh's SQL by hand against the
#     branch (drop storage policies -> objects/buckets -> tables CASCADE -> the 3
#     subwaytakes_* functions), then re-run 2.5b and expect VERDICT PASS again.
#     On the branch this also proves shared/foreign objects survive.
```

Notes on harness-vs-branch differences (verified by reading the harness):

- **Do not run `00_substrate.sql` against a branch or the shared project.** It exists to fake a Supabase project on a local disk-only Postgres, and it executes `GRANT ALL ON ALL TABLES/FUNCTIONS IN SCHEMA public, auth, storage` — on a real Supabase database that would hand `anon` access to every table. On a branch the real platform provides all of it already.
- `30_rls_tests.sql` **truncates the three studio tables and deletes every row of `storage.objects`** (lines 52–55). Harmless on a data-less branch; forbidden anywhere near production data (§4).
- `DECOY` functions (`update_updated_at_column`, `immutable_user_id`) need not exist on the branch; the suite doesn't reference them. If the branch (copied from the parent) DOES have them, that is the B1/B2 confirmation from `SHARED_DB_COMPATIBILITY.md` §8 Q3 — record the md5 of `pg_get_functiondef()` before and after apply to prove coexistence.

### 2.7 Functional smoke (branch-scoped edge functions)

Deploy only what the smoke needs — the five Studio functions — with the branch's own secrets:

```bash
supabase functions deploy plan-interview  --project-ref "$BRANCH_REF"
supabase functions deploy generate-scene   --project-ref "$BRANCH_REF"
supabase functions deploy scene-status     --project-ref "$BRANCH_REF"
supabase functions deploy render-project   --project-ref "$BRANCH_REF"
supabase functions deploy muapi-captions   --project-ref "$BRANCH_REF"
supabase secrets set --project-ref "$BRANCH_REF" OPENAI_API_KEY=<openai-key> MUAPI_API_KEY=<muapi-key>
# (per-function auth surface: docs/STAGING_RUNBOOK.md Phase 3 table — all requireUser, keep verify_jwt=true)
```

Get a real user JWT on the branch (Dashboard of the BRANCH → Authentication → create a test user, or enable Anonymous sign-ins on the branch):

```bash
JWT=$(curl -s -X POST "$BRANCH_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $BRANCH_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"branch-test@example.com","password":"<password>"}' | jq -r .access_token)
```

Smoke sequence (mirrors `docs/STAGING_RUNBOOK.md` Phase 7, branch-scoped):

```bash
# 1. plan-interview with the user JWT (OpenAI must be reachable; no fallback exists)
curl -s -X POST "$BRANCH_URL/functions/v1/plan-interview" \
  -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d '{"topic":"Is it rude to talk on the subway?","handle":"@branchtakes"}' | jq .
#    expect: { plan: { title, hookQuestion, handle, beats[7] } }

# 2. one render job (partial unique index => exactly one active job per project)
psql "$SHARED_DB_URL" -c "INSERT INTO studio_projects (user_id, title, project)
  VALUES ('<user-uuid>', 'smoke', '<project json from the editor format>');"
curl -s -X POST "$BRANCH_URL/functions/v1/render-project" \
  -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d '{"project_id":"<uuid>"}' | jq .
#    expect: { job_id, status: 'queued' }; an immediate 2nd call -> 409
psql "$SHARED_DB_URL" -c "select id,status,worker_id,updated_at from studio_render_jobs order by created_at desc limit 1;"
#    job goes running -> done with a signed output_url in studio-exports (private bucket):
#      - run the render worker with SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY pointed at the
#        BRANCH (render-worker/.env.example, STORAGE_BUCKET=studio-exports), or
#      - prove the worker path with the service-role client, exactly as
#        render-worker/src/storage.ts does (claim -> progress -> done), which also
#        exercises subwaytakes_guard_job_writes()'s trusted-role branch.

# 3. one caption job
curl -s -X POST "$BRANCH_URL/functions/v1/muapi-captions" \
  -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d '{"action":"submit","project_id":"<uuid>","video_url":"https://<public-mp4>","mode":"editable"}' | jq .
#    then action:"poll" with the returned job_id until status=done (captions present)

# 4. PostgREST visibility of the new tables from an authenticated client session
curl -s "$BRANCH_URL/rest/v1/studio_projects?select=id,title&limit=1" \
  -H "apikey: $BRANCH_ANON_KEY" -H "Authorization: Bearer $JWT" | jq .
#    expect: the owner's own row only (RLS: auth.uid()::text = user_id::text)
```

### 2.8 Record the results

Copy this block into the PR/runbook and fill it in:

```
Branch:            studio-release-test (ref <...>)  created <utc timestamp>
Server version:    <output of SELECT version();>   (expect PostgreSQL 15.x / 17.x)
Audit kit §8:       Q1..Q12 recorded; Q12 = <0/0/0/0 | actual>
Guard --check:      READY (sha256 a9447a10… matches pin)
Guard apply:        exit <rc>; VERDICT <PASS|FAIL>; inventory 3/10/8/3/6/2, rls=3, anon_dml=0
Inventory (a):      <counts from 20_inventory.sql>
Static check (b):   <0 missing columns>; buckets=2
Idempotency (c):    second apply exit 0, inventory unchanged
RLS suite (d):      PASS=__ FAIL=__ PSQL_ERRORS=__ (expect 38/0/0)
Smoke:              plan-interview=<ok/err> render job=<id, final status> caption job=<id, final status>
Rollback (e):       <skipped | all studio counts returned to 0; foreign objects intact>
Decision:           <promote to shared project | investigate>
```

### 2.9 Delete (or reset) the branch — billing runs until deletion

```bash
supabase branches delete studio-release-test
# or, to reuse the same name for another cycle: delete + create again (preview branches
# are ephemeral by design; a persistent branch would keep billing at $0.01344/hour)
```

Only after §2.8 says "promote" should the shared project itself be touched, and then via `scripts/apply-studio-migration.sh` (same guards, `SHARED_DB_URL` = the shared project's connection string) — never via `supabase db push`.

---

## 3. Fallback plan — no branching (Free organization)

When §1 shows branching is unavailable:

1. Create a **new separate Free project** in the dashboard (a different ref from `bzxohkrxcwodllketcpz`), healthy.
2. Link to it **only** (`supabase link --project-ref <free-ref>`), export its URL/anon key.
3. Run §2.4's audit kit (expect all-zero, as on a fresh project), then §2.5's single-file apply via the guard script.
4. Run the inventory + static checks (§2.6 a–c) and, optionally, §2.6(d) with the same caveats; deploy the smoke edge functions with the free project's own secrets and repeat §2.7.
5. Free projects pause after a week of inactivity; delete it when done to avoid confusion.

**What this fallback does NOT prove:** coexistence with the real shared objects. A green run on an empty free project says nothing about the parent project's other apps — generic function names (`immutable_user_id`, `update_updated_at_column`), the `videos` bucket's `public` flag and limits (Blocker B3), `user_profiles`, `auth.users` provisioning triggers, PostgREST publication state, or RLS behaviour in the presence of foreign tables (Q3, Q9, Q10 of the audit kit). Those questions are answered only by §2 (a branch seeded from the shared schema) or by running the read-only audit kit against `bzxohkrxcwodllketcpz` before applying. The fallback validates the *migration in isolation*; the branch plan validates *the migration in place*.

---

## 4. DO NOT (non-negotiable)

1. **Never `supabase db push`** this repo's migration history — not to the shared project, **not even to a branch**. The 37 files contain a DO-block that drops **every RLS policy on every table in `public`**, anon `USING (true)` restorations on generic tables, `DROP TYPE … CASCADE` + `UPDATE clips`, and an `auth.users` provisioning trigger (full list: `SHARED_DB_COMPATIBILITY.md` §7.1). Use `scripts/apply-studio-migration.sh` for exactly one file.
2. **Never apply any file from `supabase/migrations/` other than `20261011090000_studio_projects_and_render_jobs.sql`** to the shared project or a branch — including the two legacy scripts (`COMPLETE_MIGRATION.sql`, `STORAGE_SETUP.sql`) that the CLI skips but a SQL editor will happily run.
3. **Never run the audit kit with a service-role key to WRITE.** The §8 kit is read-only by design (pure `SELECT`s); a service-role key is only ever needed for the smoke-test writes in §2.7 and the worker's claim/update path — and on a branch, with the branch's own key.
4. **Never run `30_rls_tests.sql` (destructive: `TRUNCATE` of the studio tables, `DELETE FROM storage.objects`) or `40_rollback_test.sh` (drops the studio objects) against the shared project** — they are branch/scratch-only.
5. **Never run `00_substrate.sql` against a branch or the shared project** — its `GRANT ALL … IN SCHEMA public, auth, storage` is safe only on a local scratch database.
6. **Never run `supabase link` against the historical production ref `orcosohomdugkfcgydwj`** (`supabase/.temp/project-ref` still holds it; `docs/STAGING_RUNBOOK.md` Phase 0). This plan links `bzxohkrxcwodllketcpz` and the branch ref only.
7. **Never set `APPLY=yes` without reading the pre-flight output** (pinned sha256 line must match `a9447a108eeea58bfd3ebd49ed70b3d2eb4785673cf981a3066a45ea64239753`, statement scan must print PASS). The script fails closed and contacts no database otherwise.
8. **Never commit or paste branch/connection-strings or keys into the repo** — branch DB URLs contain passwords.
9. **Never modify the SQL file between `--check` and apply** — the guard's sha256 pin exists precisely to make that impossible.
