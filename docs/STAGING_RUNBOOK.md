# SubwayTakes — Staging Deployment Runbook

**Goal:** deploy the full stack (database + 13 edge functions + frontend + render worker)
to a **fresh staging Supabase project** that is fully isolated from production.
**Companion audit:** [`STAGING_MIGRATION_AUDIT.md`](./STAGING_MIGRATION_AUDIT.md) — the
single new migration applied here (`20261011090000_studio_projects_and_render_jobs.sql`)
was audited as purely additive and safe.

> **Status of this runbook:** it was authored from source review only. **Nothing in this
> repository was deployed and no live service was contacted** — no Supabase/MuAPI/OpenAI
> credentials exist in this environment. Every command below is intended to be executed
> by an operator on a machine with the Supabase CLI and Docker; "verify" steps are manual
> until then. See [Phase 8](#8-blocked-in-this-environment--what-unblocks-it).

---

## 0. Prerequisites

```bash
# Supabase CLI (https://supabase.com/docs/guides/cli)
supabase --version            # any recent 1.x/2.x; the CLI is NOT installed in the repo snapshot

# Docker + compose (frontend image + render worker)
docker --version && docker compose version

# Node 18+ (frontend build)
node --version

# You need access to: the staging Supabase project (Dashboard), MUAPI + OpenAI keys,
# and a host for the frontend (any static host) and the worker (any VM/container host).
```

**Do not use the production project.** A previous `supabase link` in this snapshot points
at project ref `orcosohomdugkfcgydwj` (`supabase/.temp/project-ref`), which is the
**production** project (`supabase/migrations/STORAGE_SETUP.sql:13`). Phase 2 re-links to
staging and overwrites that file.

---

## Phase 1 — Create / identify the staging Supabase project

```bash
# 1.1  In the Supabase Dashboard: New project -> e.g. "subwaytakes-staging",
#      region close to your users. WAIT until it is healthy.
# 1.2  Record the identifiers (needed by every later phase):

export STAGING_REF=xxxxxxxxxxxxxxxxxxxx            # project ref (Settings -> General)
export SUPABASE_URL=https://$STAGING.supabase.co   # Project URL (API settings)
export SUPABASE_ANON_KEY=eyJ...                    # anon/public key (API settings)
#      (service-role key is fetched in Phase 6; never commit it)
```

**Why:** a dedicated project gives staging its own database, its own auth users, its own
storage and its own edge-function secrets — the isolation requirements from the audit
(§4). Record the ref so every later command can be checked against it.

**Isolation self-check (do all three):**

```bash
# (a) the linked ref is NOT the production ref
[ "$STAGING_REF" != "orcosohomdugkfcgydwj" ] && echo "OK: distinct ref" || echo "FAIL: production ref"

# (b) the URL is the staging host only
echo "$SUPABASE_URL" | grep -q "https://$STAGING.supabase.co" && echo "OK: staging URL"

# (c) keys generated in the STAGING dashboard (Dashboard -> API) — production keys must
#     never appear in staging env files, and vice versa (audit §4.2)
```

---

## Phase 2 — Link and apply migrations (`supabase link` + `supabase db push`)

The repo has **35 CLI-tracked migrations** (`20260127032356` … `20261011090000`) plus two
legacy combined scripts the CLI ignores (`COMPLETE_MIGRATION.sql`, `STORAGE_SETUP.sql` —
they do not match the `<timestamp>_name.sql` naming pattern). The last one
(`20261011090000_studio_projects_and_render_jobs.sql`) is audited as purely additive.

> **Note:** `supabase/config.toml` was missing from the snapshot and has been created
> (comments only, no behavior overrides). If `db push`/`functions deploy` still complain
> about a missing project, run `supabase init` once (it will not overwrite the existing
> config) — never run `supabase link` against the production ref.

```bash
# 2.1  Pre-check: what the CLI thinks is pending vs applied.
#      Expect a long "Local | Remote" list on a FRESH project (nothing applied yet),
#      and ONLY 20261011090000 pending if a previous staging push already ran.
supabase migration list --linked          # or: supabase migration list --project-ref $STAGING_REF
#      Sanity: the LAST local migration must be 20261011090000 studio_projects_and_render_jobs.

# 2.2  Link this checkout to the STAGING project (writes supabase/.temp/project-ref).
supabase link --project-ref "$STAGING_REF"
#      -> enter the database password when prompted (Dashboard -> Settings -> Database).

# 2.3  Confirm the link really is staging (the old file held the production ref).
cat supabase/.temp/project-ref             # must print $STAGING_REF

# 2.4  Dry awareness of the target:
supabase db push --dry-run 2>/dev/null || true   # if supported by your CLI version

# 2.5  Apply all migrations in order (the last one is the additive studio migration).
supabase db push
#      Expected tail: "Finished supabase db push." with no errors.
```

### 2.6 Post-push verification (run in the SQL editor — we cannot run it here)

```sql
-- A. The three new tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('studio_projects','studio_render_jobs','muapi_caption_jobs')
ORDER BY table_name;                                   -- expect exactly 3 rows

-- B. RLS enabled on all three
SELECT relname, relrowsecurity FROM pg_class
WHERE relname IN ('studio_projects','studio_render_jobs','muapi_caption_jobs');
                                                     -- expect relrowsecurity = true x3

-- C. Policies present: 12 on the new tables + 4 on storage.objects
SELECT tablename, policyname, cmd, roles FROM pg_policies
WHERE tablename IN ('studio_projects','studio_render_jobs','muapi_caption_jobs')
   OR policyname LIKE 'studio_%'
ORDER BY tablename, policyname;                       -- expect 16 rows, all TO authenticated

-- D. Triggers present: updated_at + immutable user_id per table (6 total)
SELECT event_object_table AS table_name, trigger_name
FROM information_schema.triggers
WHERE event_object_table IN ('studio_projects','studio_render_jobs','muapi_caption_jobs')
ORDER BY 1, 2;    -- expect trg_*_updated_at and trg_*_immutable_user for each table

-- E. Storage buckets present and PRIVATE
SELECT id, name, public FROM storage.buckets
WHERE id IN ('studio-exports','studio-uploads');      -- expect 2 rows, public = false

-- F. Shared helper functions the triggers depend on exist
SELECT proname FROM pg_proc
WHERE proname IN ('update_updated_at_column','immutable_user_id');   -- expect 2 rows

-- G. anon has no DML grants on the new tables (defense in depth)
SELECT table_name, privilege_type FROM information_schema.role_table_grants
WHERE table_name IN ('studio_projects','studio_render_jobs','muapi_caption_jobs')
  AND grantee = 'anon';                               -- expect SELECT only
```

**Pass criteria:** A=3 rows · B=true ×3 · C=16 rows · D=6 rows · E=2 private buckets ·
F=2 functions · G=no INSERT/UPDATE/DELETE for `anon`.

---

## Phase 3 — Deploy ALL edge functions

There are **13 functions** in `supabase/functions/` (the mission's `thumbnail-info?`
does **not** exist in this snapshot — do not look for it). Deploy every one, from the repo
root:

```bash
supabase functions deploy build-prompt
supabase functions deploy compose-overlay
supabase functions deploy generate-script
supabase functions deploy generate-video
supabase functions deploy process-video
supabase functions deploy secure-clips-api
supabase functions deploy stitch-clips
supabase functions deploy stitch-episode
supabase functions deploy plan-interview
supabase functions deploy generate-scene
supabase functions deploy scene-status
supabase functions deploy muapi-captions
supabase functions deploy render-project
# (equivalent: `supabase functions deploy --all`, if your CLI version supports it)
```

### Per-function auth & `verify_jwt` considerations

**Every one of the 13 functions performs its own authentication**, so the platform
gateway JWT check (`verify_jwt = true`, the CLI default) is a redundant outer layer:

| Function | Auth mechanism (evidence) | Caller must send | `verify_jwt` note |
|---|---|---|---|
| `build-prompt` | Manual: requires `Authorization`; accepts either `Bearer <service-role-key>` (function-to-function) **or** a validated user JWT via `getUser()` (`index.ts:637–663`) | user JWT (client) or service-role key (internal) | keep default `true` |
| `compose-overlay` | `internalCall(req) ? skip : requireUser(req)` (`index.ts:749–756`) | user JWT / service-role key | keep default `true` |
| `generate-script` | Manual, same pattern as build-prompt (`index.ts:484–508`) | user JWT / service-role key | keep default `true` |
| `generate-video` | `internalCall` else `requireUser` (`index.ts:524–531`); calls `stitch-episode` with the service-role key (`index.ts:759–760`) | user JWT / service-role key | keep default `true` |
| `process-video` | `if (!internalCall(req)) await requireUser(req)` (`index.ts:149–150`) | user JWT / service-role key | keep default `true` |
| `secure-clips-api` | Validates the user JWT server-side via `getUser()`; **explicitly never trusts a service-role bearer** (`index.ts:91–130`, comment 98–102) | **user JWT only** | keep default `true` |
| `stitch-clips` | `internalCall` else `requireUser` (`index.ts:162–169`) | user JWT / service-role key | keep default `true` |
| `stitch-episode` | `internalCall` else `requireUser` (`index.ts:121–128`) | user JWT / service-role key | keep default `true` |
| `plan-interview` (**new**) | `requireUser(req)` (`index.ts:183`) — reads `OPENAI_API_KEY` | **user JWT** (client sends it automatically, `src/lib/edgeFunctions.ts:24–25`) | keep default `true` |
| `generate-scene` (**new**) | `requireUser` + `assertProjectOwnership` (`index.ts:87–130`) | **user JWT** | keep default `true` |
| `scene-status` (**new**) | `requireUser` + `assertProjectOwnership` (`index.ts:63–91`) | **user JWT** | keep default `true` |
| `muapi-captions` (**new**) | `requireUser` + `assertProjectOwnership` (`index.ts:365–378, 220`) | **user JWT** | keep default `true` |
| `render-project` (**new**) | `requireUser` + `assertProjectOwnership` + snapshot validation (`index.ts:68–99`) | **user JWT** | keep default `true` |

The client always attaches the **current user's access token** to
`/functions/v1/*` calls (`src/lib/edgeFunctions.ts:24–25`), so the new `requireUser`
functions work out of the box with a signed-in (including anonymous-auth) session.

**If function-to-function calls ever fail with gateway `401 Invalid JWT`** (happens when
the project's service-role key is a modern non-JWT secret `sb_secret_…` rather than a
legacy JWT key — the `internalCall` pattern sends the raw key as bearer), disable the
redundant gateway check **per function** in `supabase/config.toml` and redeploy that
function:

```toml
[functions.generate-video]
verify_jwt = false
# repeat for stitch-clips / stitch-episode / compose-overlay / process-video /
# build-prompt / generate-script only if they show the same failure
```

Do **not** add these preemptively: each of those functions validates its caller itself,
but keeping the gateway check costs nothing while keys are legacy JWTs.

---

## Phase 4 — Server-side secrets

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are **injected
automatically** into every edge function by the platform (the code reads them from
`Deno.env` — `_shared/auth.ts:40–41,62,70–71`; `build-prompt/index.ts:645–651`;
`generate-script/index.ts:492–497`; `secure-clips-api/index.ts:15–17`).
**Do not `supabase secrets set` them.**

```bash
# 4.1  REQUIRED — MuAPI (scene generation + AI captions) and OpenAI (interview planning)
supabase secrets set MUAPI_API_KEY=<muapi-staging-key>
supabase secrets set OPENAI_API_KEY=<openai-staging-key>

# 4.2  OPTIONAL overrides (defaults shown; set only if you deviate)
supabase secrets set MUAPI_BASE_URL=https://api.muapi.ai/api/v1   # default: _shared/muapi.ts:10,48
supabase secrets set OPENAI_MODEL=gpt-4o-mini                    # default: _shared/openai.ts:29

# 4.3  RECOMMENDED for staging — lock CORS to your staging frontend origin.
#      WARNING: when unset, _shared/cors.ts:28–38 defaults to "*" for every function
#      that uses it (plan-interview, generate-scene, scene-status, muapi-captions,
#      render-project); secure-clips-api falls back to localhost origins only
#      (secure-clips-api/index.ts:19–24). Set it explicitly for a shared staging host.
supabase secrets set ALLOWED_ORIGINS=https://staging.<your-frontend-host>

# 4.4  Legacy/optional pipelines — set ONLY if you exercise those paths:
#      THUMBNAIL_SERVICE_URL + THUMBNAIL_SERVICE_KEY  (ffmpeg pipeline: compose-overlay,
#        process-video, stitch-clips, stitch-episode, generate-video — each also accepts
#        the FFMPEG_SERVICE_* aliases; e.g. compose-overlay/index.ts:56–57)
#      MINIMAX_API_KEY / GOOGLE_AI_API_KEY / CLOUDINARY_*  (generate-video fallbacks,
#        generate-video/index.ts:244–246,269,303,342,370 — never fabricate demo clips)
#      SHOTGUN_API_KEY  (stitch-clips/index.ts:226, stitch-episode/index.ts:199)

# 4.5  Verify what landed (names only, never values)
supabase secrets list
```

### Per-function environment variable matrix (what each function actually reads)

| Function | `MUAPI_API_KEY` | `MUAPI_BASE_URL` | `OPENAI_API_KEY` | `OPENAI_MODEL` | `THUMBNAIL_SERVICE_URL` / `_KEY` | `ALLOWED_ORIGINS` | Auto-injected only |
|---|---|---|---|---|---|---|---|
| `build-prompt` | — | — | — | — | — | — | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| `compose-overlay` | — | — | — | — | **required** (ffmpeg pipeline) | via `_shared/cors` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `generate-script` | — | — | **required** (else template fallback, `index.ts:547–554`) | — | — | — | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| `generate-video` | **required** for MuAPI path (`index.ts:469`) | optional | — | — | optional (legacy path) | via `_shared/cors` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `process-video` | — | — | — | — | **required** (ffmpeg pipeline) | via `_shared/cors` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `secure-clips-api` | — | — | — | — | — | **read**, defaults to localhost | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| `stitch-clips` | — | — | — | — | **required** (ffmpeg pipeline) | via `_shared/cors` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `stitch-episode` | — | — | — | — | **required** (ffmpeg pipeline) | via `_shared/cors` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `plan-interview` | — | — | **required** (no fallback — errors if missing) | optional (default `gpt-4o-mini`) | — | via `_shared/cors` | `SUPABASE_URL`, `SUPABASE_ANON_KEY` (for `requireUser`) |
| `generate-scene` | **required** | optional (default `https://api.muapi.ai/api/v1`) | — | — | — | via `_shared/cors` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `scene-status` | **required** | optional | — | — | — | via `_shared/cors` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `muapi-captions` | **required** | optional | — | — | — | via `_shared/cors` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `render-project` | — | — | — | — | — | via `_shared/cors` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |

(Env sources: `_shared/muapi.ts:44,48`; `_shared/openai.ts:24,29`; `_shared/cors.ts:28`;
`_shared/auth.ts:16,40–41,62,70–71`; plus the per-function lines cited above.)

---

## Phase 5 — Frontend build & deploy

```bash
# 5.1  Build with the STAGING values. Vite inlines VITE_* into the bundle at build time.
cat > .env.production <<EOF
VITE_SUPABASE_URL=$SUPABASE_URL
VITE_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
EOF
# (.env.production holds only the public anon key, but keep it out of git —
#  it is environment-specific. `npm run build` reads it automatically.)

npm ci
npm run build          # -> dist/  (package.json: "build": "vite build")

# 5.2a  Static host (simplest): upload dist/ to any static host
#       (Vercel/Netlify/S3+CDN/nginx). SPA fallback to /index.html is required
#       (the app uses react-router). The anon key in the bundle is public by design.

# 5.2b  Container deploy — Dockerfile.app (multi-stage, repo root context).
#       IMPORTANT: Dockerfile.app declares NO build ARGs; the builder stage does
#       `COPY . .` then `npm run build`, so the VITE_* values must be present as a
#       dotenv file in the BUILD CONTEXT (the .env.production written above is
#       copied in and picked up by Vite):
docker build -f Dockerfile.app -t subwaytakes-app:staging --target production .
docker run -p 8080:80 subwaytakes-app:staging
#       -> nginx serves dist/ on :80 with SPA fallback + security headers (nginx.conf).
#       Note: docker-compose.yml's `app` service builds with no --target, so it uses
#       the LAST stage of Dockerfile.app (the *development* vite server on :5173) —
#       fine for local testing, NOT for staging. Use --target production as above.
```

**Why the VITE_ vars matter:** every `src/lib/*` module talks to
`$VITE_SUPABASE_URL/functions/v1/...` and authenticates with the current user session
(`src/lib/edgeFunctions.ts:24–44`). Pointing them at staging is what makes the whole
deployment staging-isolated.

---

## Phase 6 — Render worker (persistent staging service)

The worker polls `studio_render_jobs`, renders with Remotion, normalizes with FFmpeg and
uploads to the private `studio-exports` bucket
(`render-worker/README.md:12–36`, `render-worker/src/config.ts`).

```bash
# 6.1  Build the image — BUILD CONTEXT IS THE REPO ROOT (it needs repo deps + remotion).
#      The image pre-bakes Chromium (`remotion browser ensure`) — build needs network.
docker build -f render-worker/Dockerfile -t render-worker:staging .

# 6.2  Prepare the worker env file (see render-worker/.env.example for every var).
cat > render-worker/.env <<EOF
PORT=3010
WORKER_API_KEY=$(openssl rand -hex 32)          # MUST be set before the port is exposed
SUPABASE_URL=$SUPABASE_URL                      # staging project only
SUPABASE_SERVICE_ROLE_KEY=<staging-service-role-key>
REPO_ROOT=/repo                                 # inside the image: render-worker/Dockerfile:10,48
FFMPEG_PATH=/usr/bin/ffmpeg
FFPROBE_PATH=/usr/bin/ffprobe
POLL_INTERVAL_MS=3000
MAX_CONCURRENCY=1
JOB_TIMEOUT_MS=900000
HEARTBEAT_INTERVAL_MS=30000
RENDER_TIMEOUT_MS=600000
REMOTION_CONCURRENCY=2
# REMOTION_ENTRY: the repo Root.tsx is fixed, so the default remotion/src/index.ts is
# correct (render-worker/src/config.ts:60). render-worker/.env.example still pins the
# bridge entry render-worker/src/remotion-entry.tsx as a fallback — leave that line OUT
# unless the default fails to bundle.
STORAGE_BUCKET=studio-exports
SIGNED_URL_EXPIRY_SECONDS=604800
EOF

# 6.3a  Persistence on a staging VM — compose (restart policy + healthcheck included):
#       docker-compose.yml:45-74 defines the render-worker service exactly for this.
docker compose -f docker-compose.yml up -d render-worker
docker compose -f docker-compose.yml logs -f render-worker     # expect: queue loop started
#       (compose passes WORKER_API_KEY/SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY from your
#        shell env into the service — export them first)

# 6.3b  Single-container equivalent (same guarantee, explicit restart policy):
docker run -d --name render-worker --restart unless-stopped \
  --env-file render-worker/.env -p 127.0.0.1:3010:3010 render-worker:staging

# 6.3c  Fly.io / Railway equivalents: deploy the same image as a long-running machine
#       (fly launch --no-deploy; fly secrets set WORKER_API_KEY=... SUPABASE_URL=...
#       SUPABASE_SERVICE_ROLE_KEY=...; fly deploy) with the env vars from 6.2 set as
#       machine secrets. Give it 2 vCPU / >=4 GB RAM (Chromium + ffmpeg), persistent
#       process type "worker" — NOT an HTTP service.
```

**Security emphasis (non-negotiable):**

- `WORKER_API_KEY` must be set **before** the port is reachable. With it empty, the API
  runs **open** — `GET /status` and `POST /render` accept any caller
  (`render-worker/src/config.ts:31–35`; `render-worker/README.md:56–63`).
- Bind the port to localhost/private network (`-p 127.0.0.1:3010:3010`) or keep the
  service behind your private network/authenticated proxy. **Do not expose `3010`
  publicly without `WORKER_API_KEY`.** `GET /health` is intentionally unauthenticated
  and safe to expose to a load balancer.
- `SUPABASE_SERVICE_ROLE_KEY` shown to the worker is the **staging** key; it bypasses
  RLS, so the worker's host is effectively a trusted database client (audit §4.2).
- `REMOTION_ENTRY` note: `render-worker/README.md` and `render-worker/.env.example`
  still describe a broken `remotion/src/Root.tsx`; the file in this snapshot is fixed
  (`remotion/src/Root.tsx` imports `../../src/studio/SubwayEditorComposition`), and the
  worker default is `remotion/src/index.ts` (`render-worker/src/config.ts:60`). The
  bridge entry remains available if bundling fails.

---

## Phase 7 — Post-deploy smoke checks (manual, against staging)

```bash
# 7.1  Worker health — no auth expected
curl -s http://<worker-host>:3010/health | head -c 400
#      expect: status ok, ffmpeg/ffprobe versions, chromium: true, queue depth

# 7.2  Worker config/queue — requires the bearer
curl -s -H "Authorization: Bearer $WORKER_API_KEY" http://<worker-host>:3010/status

# 7.3  Get a REAL USER JWT (create a test user in Dashboard -> Authentication first):
JWT=$(curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"staging-test@example.com","password":"<password>"}' | jq -r .access_token)

# 7.4  plan-interview with the user JWT (OpenAI must be reachable; no fallback exists)
curl -s -X POST "$SUPABASE_URL/functions/v1/plan-interview" \
  -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d '{"topic":"Is it rude to talk on the subway?","handle":"@stagingtakes"}' | jq .
#      expect: { plan: { title, hookQuestion, handle, beats[7] } }

# 7.5  Create a project row (client or SQL editor), then enqueue a render:
#      INSERT INTO studio_projects (user_id, title, project)
#      VALUES ('<user-uuid>', 'smoke', '<project json from the editor format>');
curl -s -X POST "$SUPABASE_URL/functions/v1/render-project" \
  -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d '{"project_id":"<uuid>"}' | jq .
#      expect: { job_id, status: "queued" }; a second call while active -> 409

# 7.6  Watch the worker pick it up (job goes running -> done with output_url):
#      SQL: select id,status,progress,worker_id,output_url,error from studio_render_jobs
#      order by created_at desc limit 5;
docker compose -f docker-compose.yml logs -f render-worker
#      expect: claim -> render -> probe -> normalize -> upload -> done, output_url signed
#      (7-day signed URL into the private studio-exports bucket)

# 7.7  Optional MuAPI smoke (spends staging credits):
curl -s -X POST "$SUPABASE_URL/functions/v1/muapi-captions" \
  -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d '{"action":"submit","project_id":"<uuid>","video_url":"https://<public-mp4>",
       "mode":"editable"}' | jq .
#      then action:"poll" with the returned job_id until status=done (captions present)

# 7.8  Frontend: open https://staging.<your-frontend-host>, sign in as the test user,
#      confirm the app talks to staging (network tab -> *.supabase.co/functions/v1/*).
#      NOTE: this snapshot ships the studio engine (src/studio/types.ts,
#      SubwayEditorComposition.tsx) but NOT the studio UI pages yet — the new-function
#      smoke checks above are therefore API-level (curl), which is the documented
#      contract for the pending client.
```

**Console check for Phase 2 from the Dashboard:** SQL editor →
`select version from supabase_migrations.schema_migrations order by version desc limit 1;`
→ must return `20261011090000`.

---

## 8. BLOCKED in this environment — what unblocks it

| # | Blocked item | Why it matters | What to provide |
|---|---|---|---|
| 1 | **Staging Supabase project** (ref + URL + dashboard access + DB password) | Phases 1–3 cannot target anything; the only ref on disk is production `orcosohomdugkfcgydwj` (`supabase/.temp/project-ref`) | A new project ref, its URL, and dashboard/login access |
| 2 | **Staging service-role key** | `supabase link` needs the DB password; the render worker needs the key (bypasses RLS); secret-injection verification | Staging DB password + service-role key from the staging Dashboard |
| 3 | **`MUAPI_API_KEY`** | `generate-video`, `generate-scene`, `scene-status`, `muapi-captions` fail without it | A MuAPI staging key |
| 4 | **`OPENAI_API_KEY`** | `plan-interview` (hard error, no fallback) and `generate-script` | An OpenAI staging key (optional `OPENAI_MODEL`, default `gpt-4o-mini`) |
| 5 | **Staging host for the frontend + worker** | `dist/` needs a static host; the worker needs a persistent machine (VM/Fly/Railway) with `WORKER_API_KEY` set **before** exposing `:3010` | A static-host target and a small persistent container host (2 vCPU / ≥4 GB) |
| 6 | **Supabase CLI + Docker on the operator machine** | The repo snapshot has neither installed; all `supabase`/`docker` commands above are operator-run | Operator environment with CLI ≥1.x and Docker; then re-run Phases 0–7 |

**Explicitly not done here (by constraint):** no contact with Supabase, MuAPI or OpenAI;
no `supabase link`, `db push`, `functions deploy` or `secrets set` executed; no live
verification of any endpoint. Nothing in this runbook was executed against a live
service — every "expect" above is source-derived and must be confirmed by the operator
during the staging deploy.

---

## Coverage map (mission checklist → runbook)

| Mission item | Where |
|---|---|
| 1. Create/identify staging project (distinct ref/URL recorded) | Phase 1 (+ isolation self-check) |
| 2. `supabase link --project-ref` + `supabase db push` (pre-check `migration list`, verification SQL block) | Phase 2.1–2.6 |
| 3. Deploy ALL edge functions, enumerated, with per-function `verify_jwt` notes | Phase 3 (13 functions + table) |
| 4. Exact `supabase secrets set` commands; `SUPABASE_SERVICE_ROLE_KEY` documented as auto-injected; per-function env var matrix | Phase 4 |
| 5. Frontend `npm run build` with `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`; `Dockerfile.app` usage documented | Phase 5 |
| 6. Render worker build/run with `render-worker/.env.example` vars (`REPO_ROOT=/repo` in image, `WORKER_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WORKER_PORT`), persistence options, `WORKER_API_KEY`/exposure emphasis | Phase 6 |
| 7. Post-deploy smoke checks (health, plan-interview with real user JWT, one render job) | Phase 7 |
| 8. What is blocked here and exactly what to provide to unblock | Phase 8 |
