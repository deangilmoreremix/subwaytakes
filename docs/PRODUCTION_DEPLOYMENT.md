# Subway Interview Studio — Production Deployment & Rollback Runbook (shared Supabase)

**Target:** shared Supabase project `bzxohkrxcwodllketcpz` ("VideoRemix Product") — a database used by MULTIPLE applications.
**Branch:** `feat/subway-interview-studio` (PR #1). **This runbook is NOT executed without explicit authorization** (see §8). No step of this runbook has been executed: the shared database has no credentials in the development environment, and the live read-only audit is still pending (kit ready: `scripts/shared-db-audit/`).

## 1. Scope & guardrails

**What deploys:**

| # | Artifact | Notes |
|---|---|---|
| 1 | DB migration `supabase/migrations/20261011090000_studio_projects_and_render_jobs.sql` | Adds 3 tables + 6 indexes + 8 triggers + 3 `subwaytakes_*` functions + 10 table policies + 4 storage policies + 2 private buckets. Additive only; validated on PG14 (`docs/RLS_TEST_EVIDENCE.md`), feature-compatible with PG13+ (`docs/MIGRATION_VERSION_COMPATIBILITY.md`) |
| 2 | Edge functions — 5 new: `plan-interview`, `generate-scene`, `scene-status`, `muapi-captions`, `render-project` | New functions require a user JWT (`requireUser`) + ownership checks |
| 3 | Edge functions — 8 existing redeployed unchanged: `build-prompt`, `compose-overlay`, `generate-script`, `generate-video`, `process-video`, `secure-clips-api`, `stitch-clips`, `stitch-episode` | Redeploy only to pick up the Phase-1 fixes (no demo fallbacks, strict ownership, real ffprobe/contract fixes) |
| 4 | Frontend build (`dist/`) | Studio routes `/studio/new`, `/studio/subway-editor/:projectId` |
| 5 | Render worker (`render-worker/`) | Queue worker rendering to 1080×1920 H.264/AAC |

**Hard guardrails — must NOT happen:**
- ❌ `supabase db push` of this repository's migration history (37 files contain destructive statements: drop-all-policies loops, `DROP TYPE … CASCADE`, global `auth.users` triggers). **Only the single Studio migration may ever be applied.**
- ❌ Any DDL touching other applications' tables/functions/policies/buckets. Our migration creates only `subwaytakes_*`-named and `studio_*`-named objects (validated: decoy shared functions md5-identical before/after).
- ❌ Writing to the shared `videos` bucket beyond SubwayTakes-scoped paths (`studio-scenes/<user>/…`, `studio-captions/<user>/…`) — see `REQUIRES VERIFICATION` V3.
- ❌ Setting `SUPABASE_SERVICE_ROLE_KEY` as a function secret (it is auto-injected; setting it is redundant and encourages misuse).
- ❌ Applying the migration without the read-only audit PASS (§2) and without the §8 authorization sign-off.

**Prerequisites checklist (all must be green before step 1):**
- [ ] Live read-only audit executed and PASS (`scripts/shared-db-audit/run_audit.sh` → `docs/SHARED_DB_AUDIT_RESULT.md`; GO criteria in `docs/SHARED_DB_AUDIT_PLAN.md`).
- [ ] Dev-branch or scratch-project test PASS (`docs/DEV_BRANCH_TEST_PLAN.md`) — migration + smoke tests on an isolated copy.
- [ ] `MUAPI_API_KEY`, `OPENAI_API_KEY` available (secrets will be set in step 5).
- [ ] Worker host ready (Docker) with `WORKER_API_KEY` chosen.
- [ ] Frontend hosting target chosen; `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` for the shared project available.
- [ ] Rollback rehearsal done on the branch/scratch DB (the drop SQL in §7 was validated there).

## 2. Pre-deployment backup (shared-DB safety)

1. **Confirm platform backups.** Supabase Dashboard → Database → Backups: confirm daily backups (and PITR if the plan includes it) and note the recovery window. `REQUIRES VERIFICATION` (V1) — depends on the shared project's plan.
2. **Targeted logical backup of the objects we add** (run immediately before applying the migration — expected to dump nothing, proving a clean starting point; run again after any soak period to create the rollback source):
   ```bash
   pg_dump "$SHARED_DB_URL" \
     --table=public.studio_projects \
     --table=public.studio_render_jobs \
     --table=public.muapi_caption_jobs \
     --data-only --column-inserts \
     --file=studio-backup-$(date +%Y%m%d-%H%M%S).sql
   ```
3. **Storage inventory** (objects we may create; the buckets themselves are created by the migration):
   ```bash
   psql "$SHARED_DB_URL" -c "SELECT bucket_id, count(*) FROM storage.objects WHERE bucket_id IN ('studio-uploads','studio-exports') GROUP BY 1;"
   ```
4. **Job-row snapshot for rollback** (if the migration has been live and jobs exist, snapshot them before any rollback):
   ```bash
   psql "$SHARED_DB_URL" --csv -c "SELECT * FROM public.studio_render_jobs;" > render-jobs-$(date +%Y%m%d-%H%M%S).csv
   psql "$SHARED_DB_URL" --csv -c "SELECT * FROM public.muapi_caption_jobs;" > caption-jobs-$(date +%Y%m%d-%H%M%S).csv
   ```
5. Store all artifacts off-box with the deploy record. Retention: 30 days minimum.

## 3. Deployment steps (in order — do not reorder)

### Step 1 — Apply the single Studio migration
```bash
# Pre-flight (no DB writes): prints plan + hash verification
scripts/apply-studio-migration.sh --check
# Apply (single file, one transaction, post-verify built in)
APPLY=yes SHARED_DB_URL='postgresql://postgres.<ref>:<password>@db.<ref>.supabase.co:5432/postgres' \
  scripts/apply-studio-migration.sh
```
The script: pins the file's sha256 (fails closed on unexpected content), scans for forbidden statements (comment-stripped, dollar-quote aware), applies inside `BEGIN/COMMIT`, then verifies the object inventory. Expected: `tables=3 policies=10 triggers=8 functions=3 indexes=6 buckets=2 rls=3 anon_dml=0`.

### Step 2 — Post-migration verification (SQL Editor or psql, read-only)
Re-run the audit kit (`scripts/shared-db-audit/run_audit.sh`) and confirm:
- The three tables exist with RLS enabled; `studio_projects` has 4 owner-CRUD policies; both job tables have exactly **1 SELECT-own policy** (no client write policies).
- Both triggers `trg_*_subwaytakes_guard_job_writes` exist; a client-context INSERT raises `subwaytakes: render/caption job writes are restricted to service-role context` (canary: `SET LOCAL request.jwt.claims='{"sub":"<uuid>","role":"authenticated"}'; SET LOCAL role='authenticated'; INSERT INTO public.studio_render_jobs (...) VALUES (...);` → expect the exception).
- Buckets `studio-exports`, `studio-uploads` are `public = false`.
- `anon` has no INSERT/UPDATE/DELETE grants on the three tables.
- Re-run Q12/Q13 of the audit kit: shared generic functions unchanged (informational).

### Step 3 — Deploy edge functions
```bash
supabase link --project-ref bzxohkrxcwodllketcpz   # or the dev branch ref for the dress rehearsal
supabase functions deploy plan-interview generate-scene scene-status muapi-captions render-project
supabase functions deploy build-prompt compose-overlay generate-script generate-video \
  process-video secure-clips-api stitch-clips stitch-episode
supabase functions list
```
Notes: new functions authenticate via `requireUser` (user JWT — the client sends it since `src/lib/edgeFunctions.ts`); the gateway JWT check stays on as a redundant outer layer. If function-to-function calls that send the service-role key as the bearer fail at the gateway with `401 Invalid JWT` (happens when the service key is a non-JWT `sb_secret_…` secret), add `verify_jwt = false` for **only** the affected function in `supabase/config.toml` — those functions validate the caller themselves.

### Step 4 — Set secrets
```bash
supabase secrets set MUAPI_API_KEY=<key> OPENAI_API_KEY=<key>
# optional overrides:
supabase secrets set MUAPI_BASE_URL=https://api.muapi.ai/api/v1 OPENAI_MODEL=gpt-4o-mini
supabase secrets set THUMBNAIL_SERVICE_URL=<url> THUMBNAIL_SERVICE_KEY=<key>   # legacy ffmpeg path
supabase secrets set ALLOWED_ORIGINS=https://<frontend-domain>                  # prod CORS allowlist
```
`SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_URL` / `SUPABASE_ANON_KEY` are auto-injected — do NOT set them.

### Step 5 — Deploy the frontend
```bash
VITE_SUPABASE_URL=https://bzxohkrxcwodllketcpz.supabase.co \
VITE_SUPABASE_ANON_KEY=<anon-key> \
npm run build      # tsc + eslint clean, vitest/deno suites green before this point
# deploy dist/ to the static host (or: docker build -f Dockerfile.app --target production -t app .)
```
Verify: the app loads, anonymous sign-in succeeds (the app calls `signInAnonymously`; **REQUIRES VERIFICATION V2** — anonymous sign-ins must be enabled on the shared project, Dashboard → Authentication → Providers → Anonymous), and `/studio/new` renders.

### Step 6 — Deploy the render worker
```bash
docker build -f render-worker/Dockerfile -t render-worker:<version> .
docker run -d --restart unless-stopped --name render-worker \
  -e SUPABASE_URL=https://bzxohkrxcwodllketcpz.supabase.co \
  -e SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
  -e WORKER_API_KEY=<strong-random-key> \
  -e REPO_ROOT=/repo -e WORKER_PORT=3010 \
  -p 127.0.0.1:3010:3010 render-worker:<version>
curl -s -H "Authorization: Bearer <WORKER_API_KEY>" http://127.0.0.1:3010/status
```
**`WORKER_API_KEY` is mandatory before the port is exposed beyond localhost.** The image bakes Chromium (`remotion browser ensure` at build) and ffmpeg (apt). Boot log must show the queue loop connected (no `poll failed`) and `Auth: enabled (WORKER_API_KEY)`.

### Step 7 — Smoke tests (all require live credentials — run post-deploy)
1. `GET /health` (worker) → chromium + ffmpeg present.
2. Authenticated `plan-interview` call with a real user JWT → a 7-beat plan (or run the preflight: `node scripts/provider-preflight.mjs` with the same keys).
3. Create a studio project via the UI → row present in `studio_projects` with the correct `user_id`.
4. Generate one scene (MuAPI) → clip asset URL on the project.
5. Queue one render → row goes `queued → running → done`; `output_url` is a signed URL that downloads a 1080×1920 H.264/AAC MP4.
6. One editable-caption job and one styled-caption job → `muapi_caption_jobs` rows reach `done` with `captions` / `output_url`.

## 4. Post-deployment monitoring (first 72h)

- **Worker logs**: `claim → running → done` transitions; no repeated `claim update failed` (a known PostgREST 406 on lost claim races — benign, retried); no stale-reclaim storms.
- **Job tables**: `SELECT status, count(*) FROM public.studio_render_jobs GROUP BY 1;` — no long-lived `running` without a heartbeat.
- **Edge function logs**: 4xx/5xx rates for the 5 new functions; MuAPI upstream errors surface as 500s with clear messages (no silent demo fallbacks exist).
- **Drift check (weekly, read-only)**: re-run the audit kit; `subwaytakes_*` object counts must remain exactly 3/10/8/3 (+2 buckets); other apps' object counts unchanged (Q22–Q24 baselines).
- **Alerts suggested**: any `studio_render_jobs` row `running` > 20 min; any worker `/status` auth failure; any 401/404 spike on studio endpoints (may indicate ownership/RLS problems).

## 5. Rollback triggers

Any of: cross-user data exposure (RLS failure); migration applied to the wrong database; another application reports breakage after deploy; render/caption pipelines failing > 30 min; provider keys invalid. Owner: the release officer on call.

## 6. Rollback procedure (in order — reverse of deploy)

**Rationale: stop new writes first, then remove schema.** Frontend revert first so no new projects/jobs are created.

1. **Frontend revert** to the previous deployment (hide/disable the Studio entry points). No new rows can be created by the UI afterwards.
2. **Worker stop + drain**: `docker stop render-worker` (in-flight Remotion renders are lost — acceptable; their rows are marked `error` by the process-error path or reclaimed as stale afterwards). Snapshot job rows per §2.4.
3. **Edge functions**: redeploy the previous versions of the 5 new functions from the prior commit (functions are stateless), or set `verify_jwt = true` (already default) and remove secrets if the functions must go dark immediately (`supabase secrets unset MUAPI_API_KEY OPENAI_API_KEY`).
4. **Database rollback** (validated SQL — the `subwaytakes_*` names are authoritative over any older doc):
   ```sql
   DROP POLICY IF EXISTS "subwaytakes_studio_exports_read_own"   ON storage.objects;
   DROP POLICY IF EXISTS "subwaytakes_studio_exports_insert_own" ON storage.objects;
   DROP POLICY IF EXISTS "subwaytakes_studio_uploads_read_own"   ON storage.objects;
   DROP POLICY IF EXISTS "subwaytakes_studio_uploads_insert_own" ON storage.objects;
   DROP TABLE IF EXISTS public.muapi_caption_jobs;   -- policies/triggers/indexes drop with the tables
   DROP TABLE IF EXISTS public.studio_render_jobs;
   DROP TABLE IF EXISTS public.studio_projects;
   DELETE FROM storage.buckets WHERE id IN ('studio-exports','studio-uploads');  -- optionally keep
   DROP FUNCTION IF EXISTS public.subwaytakes_guard_job_writes();
   DROP FUNCTION IF EXISTS public.subwaytakes_guard_immutable_user_id();
   DROP FUNCTION IF EXISTS public.subwaytakes_set_updated_at();
   ```
   Run inside one transaction, as `postgres`, after step 1–3. **If Studio data must be preserved instead of dropped**, restore from the §2.2 dump into the still-present tables (or export to CSV first), then drop.
5. **Storage cleanup** (optional): delete `studio-uploads`/`studio-exports` objects; buckets may remain (harmless, no policies).
6. **Verification that other applications are unaffected**: re-run the audit kit and compare Q12/Q13 (shared function definitions md5-identical), Q22–Q24 (grant/policy patterns), and the bucket list. Expect: zero `subwaytakes_*` objects remain; every other object identical to the pre-deploy audit.

**RTO/RPO:** RTO ≈ 30 min (frontend revert + function redeploy are the fast paths); RPO = Studio-created data since the last §2.2/§2.4 snapshot (default: acceptable to lose — the feature is new; preserve only if snapshots were taken).

## 7. Authorization gates

| Phase | Approver(s) | Evidence required |
|---|---|---|
| Live read-only audit execution | Shared-DB owner + SubwayTakes release officer | Audit result doc, Q11 = `0,0,0,0,0,0,0` (no conflicts) |
| Apply migration to shared project | Shared-DB owner **explicit written authorization** | Dev-branch/scratch test PASS + backup taken (§2) |
| Edge function + secret deployment | Shared-DB owner + release officer | Smoke test 2–3 plan |
| Frontend deploy | Release officer | Full local suite green (lint/tsc/build/vitest/deno/worker/browser) |
| Worker deploy (network-exposed) | Infra owner | `WORKER_API_KEY` set, health check green |
| Rollback | Release officer on call (single approver, time-critical) | Trigger from §5 |

## 8. REQUIRES VERIFICATION (facts this environment could not establish)

- **V1** — Backups/PITR availability on the shared project (plan-dependent).
- **V2** — Anonymous sign-ins enabled (the app uses `signInAnonymously` as its guest session; if disabled, guest mode breaks and this must be enabled or the UX changed).
- **V3** — `videos` bucket visibility/limits (decides whether Studio keeps uploading generated scenes/captioned videos there; if private/absent, repoint `scene-status`/`muapi-captions` to `studio-exports` + signed URLs — code change, needs a follow-up PR).
- **V4** — `user_profiles` column shape (the auth.tsx provisioning hardening handles drift, but the live shape should be recorded at audit time, Q19–Q21).
- **V5** — Supabase dev-branch entitlement on the shared project (Pro+; otherwise use the free-scratch-project fallback).
- **V6** — The live PostgreSQL major version (audit Q1; migration is PG13+ compatible and validated on PG14).

**Nothing in this runbook has been executed. No migration was applied to `bzxohkrxcwodllketcpz`. PR #1 is not merged.**
