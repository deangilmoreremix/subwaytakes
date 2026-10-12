# Render Worker — Operations Guide

The render worker turns `studio_render_jobs` rows into delivered MP4s:
validate the project snapshot → Remotion render → verify → normalize to the
delivery spec → upload to Supabase Storage → store a 7-day signed URL.

Service port: **3010** · Repo root: `REPO_ROOT` (defaults to the directory
containing `node_modules/.bin/remotion`).

---

## 1. Deployment

### Docker

The build context is the **repo root** (the worker renders the repo's
Remotion composition, so the image needs the repo dependencies plus the
worker dependencies):

```bash
docker build -f render-worker/Dockerfile -t render-worker .
docker run --env-file render-worker/.env -p 3010:3010 render-worker
```

The image:

- Node 20 (`bookworm-slim`), system `ffmpeg`, DejaVu fonts, and the shared
  libraries chrome-headless-shell needs;
- `npm ci` at the repo root (remotion + `@remotion/cli`) and in
  `render-worker/` (express + supabase-js);
- compiles the worker with `tsc` (`render-worker/dist`);
- **pre-bakes Chromium** with `./node_modules/.bin/remotion browser ensure`.

### docker-compose

`render-worker` is defined in `docker-compose.yml` (repo-root build context,
port 3010, healthcheck on `/health`, `restart: unless-stopped`). Set
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `WORKER_API_KEY` in the
compose environment (see `render-worker/.env.example`).

### First boot without a pre-baked browser

If Chromium is not present, the worker runs `remotion browser ensure` at
startup, which **downloads Chrome for Testing and needs network egress**.
The Docker image pre-bakes it at build time, so this only affects
bare-metal installs. `/health` reports `chromium: true|false`.

### Remaining infrastructure actions (host deploy)

Everything below is **infrastructure work** — there is no container runtime,
Supabase project or DNS in the development sandbox, so none of it has been
executed here. Each item is required before the worker can take real traffic:

1. **Build the image on the deploy host** (repo root is the build context):
   ```bash
   git clone <repo> subwaytakes && cd subwaytakes
   git checkout feat/subway-interview-studio
   npm ci                     # repo root: remotion + @remotion/cli
   docker build -f render-worker/Dockerfile -t render-worker .
   ```
   The Dockerfile already installs system ffmpeg and pre-bakes Chromium
   (`remotion browser ensure`) — do **not** skip the browser step, it needs
   network egress at build time.
2. **Create the environment file** from `render-worker/.env.example` and fill
   in, at minimum: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `WORKER_API_KEY`, `REPO_ROOT=/repo` (path of the checkout inside the
   container), `STORAGE_BUCKET=studio-exports`.
3. **Apply the database migration**
   `supabase/migrations/20261011090000_studio_projects_and_render_jobs.sql`
   (see `docs/STAGING_RUNBOOK.md` and `docs/SHARED_DB_COMPATIBILITY.md` for the
   shared-database caveats). The worker needs the `studio_render_jobs` +
   `studio_projects` tables and the private `studio-exports` bucket
   (`<user_id>/<project_id>/render-<job_id>.mp4`).
4. **Run the worker** (compose or plain docker):
   ```bash
   docker run --env-file render-worker/.env -p 3010:3010 --restart unless-stopped render-worker
   ```
5. **Point the app at it**: the `render-project` edge function enqueues rows in
   `studio_render_jobs`; the worker polls that table with the service-role key,
   so no inbound route to the worker is needed. Keep port 3010 private (it only
   exposes `/health`, `/status`, `/render` behind `WORKER_API_KEY`).
6. **Verify after boot**:
   ```bash
   curl -s localhost:3010/health | jq            # chromium:true, ffmpeg version, queue depth
   curl -s -H "Authorization: Bearer $WORKER_API_KEY" localhost:3010/status | jq
   ```
   A missing `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` (or a missing
   ffmpeg/ffprobe binary) is logged at boot as `[worker] CONFIG INCOMPLETE —
   <var> ...` naming every variable.
7. **Smoke test** on the host (real ffmpeg + real render):
   ```bash
   cd render-worker && npx ts-node src/smoke.ts      # exit 0 = PASS
   ```

---

## 2. Queue protocol (`studio_render_jobs`)

| Step | Behavior |
|------|----------|
| Poll | Every `POLL_INTERVAL_MS` (3s) while `inFlight < MAX_CONCURRENCY` (1) |
| Claim | `SELECT` oldest `status='queued'` → `UPDATE ... SET status='running', worker_id, updated_at` **`WHERE id=? AND status='queued'` RETURNING *`**. No row returned ⇒ another worker won the race; nothing to do |
| Heartbeat | While rendering, `updated_at` is bumped every `HEARTBEAT_INTERVAL_MS` (30s); every progress update also refreshes it |
| Stale reclaim | Any `running` job whose `updated_at` is older than `JOB_TIMEOUT_MS` (15 min) is reset to `queued` with `worker_id=NULL` (jobs in flight **in this process** are skipped) |
| Progress | 5 → 85 → 100 on success; 0 + `error` message on failure |
| Done | `status='done'`, `output_url=<7-day signed URL>`, `progress=100` (guarded by `WHERE id=? AND status='running'`, so a job another worker reclaimed after a stall is never overwritten by a zombie writer) |

A worker crash mid-render leaves the job `running`; the next poll cycle (this
worker after restart, or any other worker) reclaims it via the stale rule —
jobs never stay `running` forever.

Notes:
- The claim is a two-step optimistic guard because PostgREST cannot do
  `UPDATE ... WHERE id = (SELECT ...) RETURNING` atomically, and DB functions
  (RPC) are owned by the migrations pipeline.
- `worker_id` is `<hostname>-<pid>` — one worker process per container/host.
- Rendering is CPU-heavy; keep `MAX_CONCURRENCY=1` per worker and scale
  horizontally (multiple worker containers) rather than vertically.

---

## 3. Render pipeline

```
job row (queued)
  → validate project_snapshot      (render-worker/src/render.ts — mirrors
                                      src/studio/types.ts parseProject rules;
                                      rejects non-http(s) asset URLs, empty
                                      timelines, bad trims, malformed media
                                      refs)
  → read the media owner            (studio_projects.user_id — read with the
                                      service-role client, never from the
                                      client; the job row's user_id is only a
                                      fallback when the project row is gone)
  → sign every clip asset           (private bucket objects and canonical
                                      refs are re-signed for 1h so headless
                                      Chromium can fetch them; the ref/path's
                                      FIRST SEGMENT must equal the owner, else
                                      the job fails — private media must never
                                      be resolvable cross-user)
  → write props.json                (mkdtemp under os.tmpdir(); NEVER argv;
                                      resolved URLs live here only, they are
                                      never written back to the DB)
  → remotion render                 (<REPO_ROOT>/node_modules/.bin/remotion render
                                      <entry> SubwayEditor <raw.mp4>
                                      --codec=h264 --pixel-format=yuv420p
                                      --concurrency=2 --timeout=600000(ms)
                                      --props=<props.json> --log=info)
  → ffprobe verify (raw)            (container mp4, video h264, 1080x1920,
                                      30fps, yuv420p, duration within 0.5s of the
                                      timeline — trims ARE the timeline duration)
  → ffmpeg normalize (encode gate)  (scale/pad to 1080x1920, libx264 crf20
                                      medium, yuv420p, 30fps, aac 128k 48kHz,
                                      +faststart — always runs once)
  → ffprobe verify (final)          (+ AAC required when the timeline has audio)
  → upload studio-exports            (<user_id>/<project_id>/render-<job_id>.mp4)
  → createSignedUrl(path, 604800)
  → status='done', output_url, progress=100
```

Any failure ⇒ `status='error'`, `progress=0`, clear `error` message; the
temp dir is always deleted in a `finally` block.

### Entry point note

`render-worker/src/remotion-entry.tsx` is a bridge entry that registers the
identical `SubwayEditor` composition; originally it existed because
`remotion/src/Root.tsx` imported the studio composition through a broken
relative path, which broke `remotion render remotion/src/index.ts` for **every**
composition. That path is fixed, so the default entry is now the repo's Remotion
root:

```bash
REMOTION_ENTRY=remotion/src/index.ts          # default
# REMOTION_ENTRY=render-worker/src/remotion-entry.tsx   # explicit bridge
```

---

## 4. Delivery spec (the encode gate)

| Property | Value |
|----------|-------|
| Container | MP4 (`+faststart`) |
| Video | H.264 (libx264), CRF 20, preset medium, yuv420p, 30fps |
| Resolution | 1080x1920 (letterboxed/padded, SAR 1:1) |
| Audio | AAC-LC, 128 kbps, 48 kHz, stereo |

The ffmpeg normalize step runs **even when the Remotion output already
complies** — one extra encode is cheap and guarantees the contract (mixed
SAR/pix_fmt or missing faststart breaks the app's `<video>` playback).
`verifyDelivery()` checks container, video codec, dimensions, frame rate,
pixel format and duration on **both** the raw and the final file, and adds the
AAC requirement when the timeline actually has audio. Verification failure
fails the job; nothing invalid is ever marked `done`.

---

## 4b. Media resolution & ownership

Every clip in a snapshot carries a canonical ref (`assetRef: {bucket, path,
kind}`) plus a derived, session-scoped `assetUrl`; legacy records only have a
storage URL. Before rendering, `resolveProjectMedia()` re-signs all of them
with the service-role client:

- a **ref** is signed with `storage.createSignedUrl()` (1h TTL);
- a **legacy storage URL** of ours (`<SUPABASE_URL>/storage/v1/object/...`) is
  parsed back to bucket+path and re-signed — private objects cannot be fetched
  by headless Chromium, which sends no Authorization header;
- an **external CDN URL** is passed through untouched (its own identity).

Every signature is gated by an ownership check: the first path segment of a
storage path is the owner's user id, and it must equal `studio_projects.user_id`
of the rendered project. A mismatch (`…ownership check failed for <bucket>/<path>:
path is not owned by project owner <uid>`) fails the job **before** Remotion
starts — no other user's footage can ever be rendered or signed by the worker.
The signed URLs are written to the props file only; the project row keeps refs
and is never updated with session URLs.

---

## 5. API

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /health` | none | `status`, `version`, `workerId`, ffmpeg/ffprobe versions, `chromium`, queue depth |
| `GET /status` | `WORKER_API_KEY` bearer (open when unset) | config + queue state |
| `POST /render` | same as `/status` | direct render, no queue/DB. Body: `{ project, renderSettings?, ownerUserId? }`. Used by the smoke test. `ownerUserId` (optional) turns on the same media-ownership check the queue path uses; without a DB row there is no project owner to compare against |

`WORKER_API_KEY` unset ⇒ the API runs **open** (same convention as
thumbnail-service with no `API_KEY`) — only acceptable on a private network.

---

## 6. Environment variables

See `render-worker/.env.example`. Summary:

| Var | Default | Meaning |
|-----|---------|---------|
| `PORT` | 3010 | HTTP port |
| `WORKER_API_KEY` | *(empty = open)* | bearer key for `/status`, `/render` |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | — | service-role client (bypasses RLS) |
| `REPO_ROOT` | auto (repo root) | dir with `node_modules/.bin/remotion` |
| `REMOTION_ENTRY` | `remotion/src/index.ts` | bundler entry (see §3) |
| `FFMPEG_PATH` / `FFPROBE_PATH` | `/usr/bin/...` | system binaries |
| `POLL_INTERVAL_MS` | 3000 | queue poll interval |
| `MAX_CONCURRENCY` | 1 | concurrent renders per worker |
| `JOB_TIMEOUT_MS` | 900000 | stale `running` threshold |
| `HEARTBEAT_INTERVAL_MS` | 30000 | heartbeat cadence |
| `RENDER_TIMEOUT_MS` | 600000 | Remotion `--timeout` (**milliseconds**) |
| `REMOTION_CONCURRENCY` | 2 | Remotion render concurrency |
| `OUTPUT_WIDTH` / `OUTPUT_HEIGHT` / `OUTPUT_FPS` / `OUTPUT_CRF` | 1080 / 1920 / 30 / 20 | delivery spec |
| `STORAGE_BUCKET` | `studio-exports` | private upload bucket |
| `SIGNED_URL_EXPIRY_SECONDS` | 604800 | signed URL lifetime (7 days) |

---

## 7. Verification

```bash
cd render-worker
npm install
npx tsc --noEmit        # typecheck
npx ts-node src/smoke.ts   # acceptance harness (real ffmpeg + Remotion render)
# or after `npm run build`:  node dist/smoke.js
```

The smoke test generates its own sources (2s test videos + sine audio),
builds a project whose clips are **trimmed** (2s sources → 2s timeline),
runs render → probe → normalize, prints the ffprobe JSON of the final MP4
and a PASS/FAIL summary (1080x1920, h264, aac, duration ≈ expected). An
untrimmed render would be ~4s, so the duration check proves the trim is
applied. Exit code 0 = PASS.

### Staging validation suite (no Supabase / Docker needed)

```bash
cd render-worker
npm test                       # vitest: queue-semantics + render-pipeline +
                               #        media-resolution
```

`render-worker/STAGING_CHECKLIST.md` maps every Phase 3 item to what these tests
prove locally versus what needs a staging deploy (with the exact curl/SQL to
run there). The queue suite runs the real `src/storage.ts`, `src/render.ts`,
`src/queue.ts` and `src/index.ts` against an in-memory Supabase stub injected
through `setSupabaseClientFactory()` — exactly-once claim, heartbeat, stale
reclaim, terminal states, MAX_CONCURRENCY and the API auth middleware. The
pipeline suite checks the ffmpeg encode-gate arguments and the probe
verification rules, and runs real encode + probe assertions wherever a capable
ffmpeg exists (it skips them, with a NOTE, when the environment has none).
The media suite (`test/media-resolution.test.ts`) injects a fake storage client
and proves: refs/legacy storage URLs are re-signed with the service-role
client, CDN URLs pass through, an unowned path **fails the job** before any
render, the resolved URLs reach the Remotion props file while the DB snapshot
stays byte-identical, and temp dirs are removed on every injected failure path
(media resolution, remotion exit, ffprobe failure, ffmpeg normalize failure,
missing output).

---

## 8. Failure modes & troubleshooting

| Symptom | Likely cause / action |
|---------|-----------------------|
| `/health` `chromium: false` | Run `remotion browser ensure` (needs network) or rebuild the image |
| Job stuck `running` | Worker died; the stale reclaimer resets it after `JOB_TIMEOUT_MS`; check worker logs |
| `Invalid project_snapshot` | Editor produced a project that fails the same rules as `parseProject`; check `error` text |
| `Render verification failed` | Duration/dimension mismatch — usually a project whose timeline duration disagrees with its clips |
| `media ownership check failed for …` | A clip ref/URL whose path is not owned by the project's `user_id` — the job fails instead of rendering another user's media. Fix the clip (re-upload through the editor) or the project's owner |
| `storage upload failed` | Wrong service-role key, missing `studio-exports` bucket, or RLS on a service-role client (should not happen) |
| `could not sign storage asset …` | Bucket missing, object deleted, or a path that does not start with the owner id |
| `[worker] CONFIG INCOMPLETE — …` at boot | Missing `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`, or a missing ffmpeg/ffprobe/remotion binary; the log names every variable |
| Multiple workers, duplicate renders | `MAX_CONCURRENCY` total across workers should match CPU budget; the claim guard prevents double-claims |
| Hunted OOM in Chromium | Lower `REMOTION_CONCURRENCY`, or use projects with fewer simultaneous video clips |

## 9. Logging

- Every poll cycle logs at debug level (`[queue] poll complete: ...`).
- Claims, stale reclaims, completions and failures log at info/warn/error
  with the job id. Ship stdout to your log aggregator; there is no file
  logging by design.
