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

---

## 2. Queue protocol (`studio_render_jobs`)

| Step | Behavior |
|------|----------|
| Poll | Every `POLL_INTERVAL_MS` (3s) while `inFlight < MAX_CONCURRENCY` (1) |
| Claim | `SELECT` oldest `status='queued'` → `UPDATE ... SET status='running', worker_id, updated_at` **`WHERE id=? AND status='queued'` RETURNING *`**. No row returned ⇒ another worker won the race; nothing to do |
| Heartbeat | While rendering, `updated_at` is bumped every `HEARTBEAT_INTERVAL_MS` (30s); every progress update also refreshes it |
| Stale reclaim | Any `running` job whose `updated_at` is older than `JOB_TIMEOUT_MS` (15 min) is reset to `queued` with `worker_id=NULL` (jobs in flight **in this process** are skipped) |
| Progress | 5 → 85 → 100 on success; 0 + `error` message on failure |
| Done | `status='done'`, `output_url=<7-day signed URL>`, `progress=100` |

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
                                     timelines, bad trims)
  → sign Supabase storage assets    (private bucket objects are re-signed for
                                     1h so headless Chromium can fetch them)
  → write props.json                (mkdtemp under os.tmpdir(); NEVER argv)
  → remotion render                 (<REPO_ROOT>/node_modules/.bin/remotion render
                                     <entry> SubwayEditor <raw.mp4>
                                     --codec=h264 --pixel-format=yuv420p
                                     --concurrency=2 --timeout=600000(ms)
                                     --props=<props.json> --log=info)
  → ffprobe verify (raw)            (container mp4, video h264, 1080x1920,
                                     duration within 0.5s of the timeline —
                                     trims ARE the timeline duration)
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

`remotion/src/Root.tsx` currently imports the studio composition with a
wrong relative path (`../src/studio/...` resolves to
`remotion/src/studio/...`), which breaks `remotion render
remotion/src/index.ts` at bundle time for **every** composition. Until that
file (owned by another agent) is fixed, the worker renders through a bridge
entry, `render-worker/src/remotion-entry.tsx`, which registers the identical
`SubwayEditor` composition from the correct path. Switch back with:

```bash
REMOTION_ENTRY=remotion/src/index.ts
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
Verification failure fails the job; nothing invalid is ever marked `done`.

---

## 5. API

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /health` | none | `status`, `version`, `workerId`, ffmpeg/ffprobe versions, `chromium`, queue depth |
| `GET /status` | `WORKER_API_KEY` bearer (open when unset) | config + queue state |
| `POST /render` | same as `/status` | direct render, no queue/DB. Body: `{ project, renderSettings? }`. Used by the smoke test |

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
| `REMOTION_ENTRY` | `render-worker/src/remotion-entry.tsx` | bundler entry (see §3) |
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
npm test                       # vitest: test/queue-semantics.test.ts + test/render-pipeline.test.ts
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

---

## 8. Failure modes & troubleshooting

| Symptom | Likely cause / action |
|---------|-----------------------|
| `/health` `chromium: false` | Run `remotion browser ensure` (needs network) or rebuild the image |
| Job stuck `running` | Worker died; the stale reclaimer resets it after `JOB_TIMEOUT_MS`; check worker logs |
| `Invalid project_snapshot` | Editor produced a project that fails the same rules as `parseProject`; check `error` text |
| `Render verification failed` | Duration/dimension mismatch — usually a project whose timeline duration disagrees with its clips |
| `storage upload failed` | Wrong service-role key, missing `studio-exports` bucket, or RLS on a service-role client (should not happen) |
| Multiple workers, duplicate renders | `MAX_CONCURRENCY` total across workers should match CPU budget; the claim guard prevents double-claims |
| Hunted OOM in Chromium | Lower `REMOTION_CONCURRENCY`, or use projects with fewer simultaneous video clips |

## 9. Logging

- Every poll cycle logs at debug level (`[queue] poll complete: ...`).
- Claims, stale reclaims, completions and failures log at info/warn/error
  with the job id. Ship stdout to your log aggregator; there is no file
  logging by design.
