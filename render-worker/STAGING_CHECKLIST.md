# Render Worker — Staging Validation Checklist

Validation suite: `render-worker/test/` (vitest, run with `cd render-worker && npm test`).
Everything below is either **proven locally** against an in-memory Supabase stub and
the real worker modules, or **requires a staging deploy** because it needs Docker,
Supabase, or the system ffmpeg — in which case the exact command to verify is given.

Legend
- `[LOCAL]` — proven by `render-worker/test/*.test.ts` in this environment (no Supabase, no Docker).
- `[STAGING]` — cannot be proven here; run the command on the staging host.

---

## Environment reality (read this first)

This machine has **no system `ffmpeg`/`ffprobe`** and **no Docker/Supabase**. The suite
detects and documents that itself (`test/render-pipeline.test.ts > binary discovery`):

```
[render-pipeline] NOTE: no ffmpeg/ffprobe capable of the delivery spec in this environment
  configured FFMPEG_PATH (/usr/bin/ffmpeg): ffmpeg missing
  /usr/local/bin: ffmpeg missing
  node_modules/@remotion/compositor-linux-x64-gnu: missing filters: pad, fps, setsar, testsrc2
  node_modules/@remotion/compositor-linux-x64-musl: ffprobe -filters failed
  => the real-encode tests below are SKIPPED
```

The `@remotion/compositor-*` builds in `node_modules` are real ffmpeg n7.1 binaries, but
they are trimmed (no `pad`/`fps`/`setsar` filters) and cannot encode the worker's
delivery-spec filter graph, so they are deliberately not used. On a host with the
system ffmpeg — i.e. the Docker image built from `render-worker/Dockerfile` — the same
tests automatically run the real encode + probe assertions (they self-enable by probing
each candidate binary for `scale,pad,fps,format,setsar,testsrc2 + libx264,aac`).

---

## Phase 3 checklist

### 1. Docker build
`[STAGING]` — the build needs Docker.

```bash
# build context MUST be the repo root (the worker renders the repo's Remotion composition)
docker build -f render-worker/Dockerfile -t render-worker .
docker run --rm -p 3010:3010 --env-file render-worker/.env render-worker
# or with compose (service: render-worker, healthcheck on /health, restart: unless-stopped)
docker compose up -d --build render-worker
```

Verify: container is `healthy` and boots with the expected log lines:

```bash
docker compose ps render-worker                 # Status: Up (healthy)
docker compose logs render-worker | grep -E "Render worker running|Repo root:|FFmpeg:|Auth:|Supabase:|queue\) loop started"
```

### 2. Chromium present (Remotion can render headless)
`[STAGING]` — needs the pre-baked browser; `/health` is the contract.

```bash
curl -sS http://localhost:3010/health | jq '{chromium, ffmpegVersion, ffprobeVersion, queue}'
# chromium must be true
```

If false: rebuild the image (`RUN ./node_modules/.bin/remotion browser ensure` in the
Dockerfile) or run `remotion browser ensure` manually (needs network). Local evidence for
the reporting logic: `test/queue-semantics.test.ts` boots `src/index.ts` with
`REMOTION_BROWSER_EXECUTABLE` set, so `/health` returns a `chromium` field; the *presence*
of a real browser can only be checked on the deployed image.

Full-pipeline proof on staging (real Remotion render + ffmpeg gate, no DB):

```bash
docker compose run --rm render-worker node render-worker/dist/smoke.js   # exit 0 = PASS
```

### 3. FFmpeg present
`[STAGING]` for the binary, `[LOCAL]` for the argument construction.

Local: `test/render-pipeline.test.ts` asserts the exact command `normalizeToDeliverySpec`
issues (`-y -i <raw> -vf scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,fps=30,format=yuv420p,setsar=1
-c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -r 30 -c:a aac -b:a 128k -ar 48000 -ac 2 -movflags +faststart <out>`),
one invocation, exit-code surfacing on failure.

Staging:

```bash
docker compose exec render-worker ffmpeg -version        # ffmpeg + libx264 + aac present
docker compose exec render-worker ffprobe -version
curl -sS http://localhost:3010/health | jq '{ffmpegVersion, ffprobeVersion}'
```

### 4. WORKER_API_KEY configured (auth on)
`[LOCAL]` — `test/queue-semantics.test.ts > API auth wiring` boots the real Express app and
proves: 401 without a bearer, 401 with a non-Bearer scheme, 403 with a wrong key,
200 with the right key, `/health` always open, and the open mode when the key is unset
(plus the boot log line `Auth: enabled|disabled (...)`).

Staging (with `WORKER_API_KEY` set in the compose env):

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3010/status                              # 401
curl -s -o /dev/null -w '%{http_code}\n' -H 'Authorization: Bearer WRONG' http://localhost:3010/status   # 403
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $WORKER_API_KEY" http://localhost:3010/status  # 200
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3010/health                              # 200 (orchestrators)
docker compose logs render-worker | grep 'Auth:'     # must say "enabled (WORKER_API_KEY)"
```

### 5. Secure Supabase connection (service role, queue access)
`[STAGING]` for the connection; `[LOCAL]` for the endpoint contract.

Local: the in-memory stub implements every PostgREST/Storage call the worker makes
(`claim SELECT/UPDATE`, heartbeat UPDATE, progress UPDATE, error/done UPDATE,
`studio_projects` fallback select, storage `upload`, `createSignedUrl`, `queueDepth`
counts) — see the header of `test/supabase-stub.ts`.

Staging:

```bash
# the key must be the SERVICE ROLE key (bypasses RLS), not the anon key
echo "$SUPABASE_SERVICE_ROLE_KEY" | cut -d. -f2 | base64 -d 2>/dev/null | jq '{role, iss}'

# service-role PostgREST access to the queue table
curl -sS -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
        -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
        "$SUPABASE_URL/rest/v1/studio_render_jobs?select=id,status&limit=1" | jq .

# the worker must never log a poll failure
docker compose logs render-worker | grep -E "queue\] poll failed|storage upload failed|signed url failed"
```

### 6. Exactly-once claim
`[LOCAL]` — `test/queue-semantics.test.ts > claimNextJob is exactly-once`: 5 concurrent
`claimNextJob()` calls over 1 queued job, all 5 SELECT the same row, exactly one guarded
`UPDATE ... WHERE id=? AND status='queued'` matches; the rest get `null`. The same
guarantee is re-asserted in "strict" mode (real PostgREST answers a zero-row `.single()`
with 406/PGRST116, which surfaces as `claim update failed: ...` — the poll loop catches it
and retries, so the row is still claimed exactly once). Also proven: oldest-first ordering,
`worker_id`/`updated_at` set on claim, and `null` when the queue drains.

Staging (two workers, watch for double claims):

```bash
docker compose up -d --scale render-worker=2
# enqueue jobs from the studio (render-project edge function), then:
docker compose logs render-worker | grep -c 'claimed job'          # == number of jobs
docker compose logs render-worker | grep 'claim update failed'    # races lost & retried (informational)

SELECT id, status, worker_id, progress, created_at, updated_at
FROM studio_render_jobs ORDER BY created_at DESC LIMIT 10;
-- every job has exactly one worker_id, and the unique index
-- uq_studio_render_jobs_active_per_project (status IN ('queued','running')) holds
```

### 7. Heartbeat
`[LOCAL]` — `heartbeatJob` bumps `updated_at` without touching status/progress; the guard
`.eq('status','running')` prevents resurrecting dead rows; `updateJobProgress` clamps to
0..100 *and* refreshes `updated_at`; and `a long render keeps refreshing updated_at (heartbeat)`
drives the real `processRenderJob` mid-flight and asserts `updated_at` advances while the
job is still `running`.

Staging (during a long render):

```sql
SELECT id, status, worker_id, updated_at, now() - updated_at AS age
FROM studio_render_jobs WHERE status = 'running';
-- `age` must stay well under JOB_TIMEOUT_MS (15 min; heartbeat every 30s)
```

```bash
docker compose logs render-worker | grep 'heartbeat failed'   # must be empty
```

### 8. Stale recovery (crashed worker)
`[LOCAL]` — `reclaimStaleJobs` resets `running` rows older than `JOB_TIMEOUT_MS` back to
`queued` with `worker_id=NULL`, leaves fresh rows alone, skips ids currently in flight in
this process, and a reclaimed job is claimable again.

Staging (kill the worker mid-render; set `JOB_TIMEOUT_MS=60000` for a fast test):

```bash
docker compose stop render-worker        # or: docker kill render-worker
sleep 90
SELECT id, status, worker_id, updated_at FROM studio_render_jobs WHERE status = 'running';
-- 0 rows: the killed job went back to 'queued'
docker compose start render-worker
docker compose logs render-worker | grep reclaimed
```

### 9. Private storage (`studio-exports`)
`[LOCAL]` — `uploadRender` uploads to `studio-exports` with `contentType: video/mp4`,
`upsert: true`, path `<user_id>/<project_id>/render-<job_id>.mp4`; `sanitizeStoragePath`
strips `..`/`.` traversal segments.

Staging:

```sql
SELECT id, public FROM storage.buckets WHERE id = 'studio-exports';   -- public = false
```

```bash
# an unauthenticated object fetch must NOT serve the render
curl -s -o /dev/null -w '%{http_code}\n' \
  "$SUPABASE_URL/storage/v1/object/studio-exports/<user_id>/<project_id>/render-<job_id>.mp4"
# 400/401 — anything 200/206 here means the bucket is public (must be fixed)
```

### 10. Signed downloads (7-day URL)
`[LOCAL]` — `createSignedRenderUrl` requests exactly `SIGNED_URL_EXPIRY_SECONDS`
(604800) for the uploaded object, returns `<host>/storage/v1/object/sign/<bucket>/<path>?token=...&expires_in=604800`,
and fails loudly when the object was never uploaded. `resolveAssetUrl` re-signs private
`/storage/v1/object/...` asset URLs with a 1h expiry and passes external/CDN URLs through.

Staging:

```bash
docker compose logs render-worker | grep 'job .* done in'
SIGNED=$(psql "$SUPABASE_DB_URL" -tAc \
  "SELECT output_url FROM studio_render_jobs WHERE status='done' ORDER BY updated_at DESC LIMIT 1")
curl -sI "$SIGNED" | head -1                       # HTTP/2 200
curl -sI "$SIGNED" | grep -i content-type           # video/mp4
# the URL must carry a token; after 7 days it must fail
curl -s -o /dev/null -w '%{http_code}\n' "$SIGNED"  # 200 (then 400/401 once expired)
```

### 11. Delivery spec — "never mark an unedited/unsuitable render as done"
`[LOCAL]` — `verifyDelivery` rejects a 640x360 render (`dimensions are 640x360, expected
1080x1920`), a non-h264 codec, a missing AAC track when the timeline has audio, a duration
outside ±0.5s of the timeline, an undeterminable duration, and a non-mp4 container. The
640x360 ffprobe payload is also run through the real `probeFile` code path with a stub
ffprobe. Real encode + real ffprobe assertions are the two `itReal` tests, which run
automatically wherever a capable ffmpeg exists (not here).

Staging:

```bash
docker compose run --rm render-worker node render-worker/dist/smoke.js
# [d] ffprobe JSON of final MP4 ... RESULT: PASS (1080x1920, h264, aac, duration ~= 2s)
```

### 12. Job failure never leaves a row `running`
`[LOCAL]` — driving the real `processRenderJob`: a missing remotion CLI, a render that
produces no output, and an invalid `project_snapshot` all settle the row as
`status='error'`, `progress=0`, with the cause in `error`, and the temp dir is removed in
the `finally`. `markJobError` is additionally guarded so it never overwrites a row another
worker already reclaimed.

Staging: watch a failing job (e.g. a project whose asset URLs are unreachable):

```sql
SELECT id, status, progress, error, updated_at FROM studio_render_jobs ORDER BY updated_at DESC LIMIT 5;
-- a failed job is status='error', progress=0, error != NULL
SELECT count(*) FROM studio_render_jobs WHERE status = 'running';   -- only jobs actually rendering
```

---

## What the suite covers / where the seams are

| File | Purpose |
|------|---------|
| `render-worker/test/supabase-stub.ts` | In-memory Supabase: PostgREST-shaped builders (`select/update/eq/lt/in/order/limit/single`), storage buckets with private objects + signed URLs, a mutex around store mutations, per-statement latency so concurrent claimers interleave, and a call/transition log used as evidence. |
| `render-worker/test/queue-semantics.test.ts` | Claim exactly-once, heartbeat, stale reclaim, terminal states, MAX_CONCURRENCY gate, startup config validation, API auth (boots the real `src/index.ts`). |
| `render-worker/test/render-pipeline.test.ts` | ffmpeg capability discovery + NOTE, encode-command argument construction, probe/verification logic, real encode + probe assertions (auto-skip without a capable ffmpeg). |
| `render-worker/vitest.config.ts` | `environment: node`, `include: test/**/*.test.ts`, stubbed `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` (so the queue loop believes Supabase exists — the injected factory replaces the real client), `PORT=0`, `REMOTION_BROWSER_EXECUTABLE=/bin/true` (no `remotion browser ensure` download), long `POLL_INTERVAL_MS`/`HEARTBEAT_INTERVAL_MS`. |

`cd render-worker && npm ci && npm test` → **41 passed, 2 skipped (real-encode tests)**, and
`npx tsc --noEmit` passes.

Only one production file changed: `render-worker/src/storage.ts` gained
`setSupabaseClientFactory()` / `resetSupabaseClient()` (an injectable client factory that
defaults to the real `createClient()` — behavior-preserving when unused).
