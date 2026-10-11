# render-worker

Production render worker for the SubwayTakes Interview Studio. A Node.js +
TypeScript service that polls the Supabase table `studio_render_jobs`,
renders `project_snapshot` rows to MP4 with the repo-local Remotion
installation, verifies + normalizes the output to the delivery spec with
FFmpeg, uploads to the private `studio-exports` bucket and stores a 7-day
signed URL on the job row.

## Architecture

```
studio_render_jobs (status='queued')
        |  poll every POLL_INTERVAL_MS (3s)
        v
[claim]  SELECT oldest queued -> UPDATE ... SET status='running',
         worker_id=<hostname-pid> WHERE id=? AND status='queued' RETURNING *
         (optimistic guard: no row returned = another worker won the race)
        v
[render] validate project_snapshot (src/render.ts mirror of parseProject)
         -> props.json in os.tmpdir() mkdtemp dir
         -> node_modules/.bin/remotion render <REMOTION_ENTRY> SubwayEditor
            --codec=h264 --pixel-format=yuv420p --concurrency --timeout --props
        v
[verify] ffprobe the RAW render: container mp4, video h264, duration within
         0.5s of the timeline duration, 1080x1920 (render_settings)
        v
[gate]   ffmpeg normalize to the exact delivery spec (always re-encodes once):
         H.264 libx264 crf20 medium + AAC 128k/48kHz, 1080x1920 letterboxed,
         30fps, yuv420p, +faststart
        v
[upload] <user_id>/<project_id>/render-<job_id>.mp4 into studio-exports
         (private) -> createSignedUrl(path, 604800)
        v
[done]   studio_render_jobs: status='done', output_url=<signed>, progress=100
```

**Entry point note:** `remotion/src/Root.tsx` has a broken composition import
(`../src/studio/...` resolves to `remotion/src/studio/...`, which does not
exist), so `remotion render remotion/src/index.ts` fails at bundle time for
every composition in this repo snapshot. Root.tsx is owned by another agent,
so the worker renders through a bridge entry
(`render-worker/src/remotion-entry.tsx`) that registers the identical
`SubwayEditor` composition from the correct path. Set
`REMOTION_ENTRY=remotion/src/index.ts` to switch back once Root.tsx is fixed.

Any failure (validation, render, probe, encode, upload) sets
`status='error'`, `progress=0` and a clear `error` message. A job is never
left `running`:

- a heartbeat bumps `updated_at` every 30s while rendering;
- a poll-cycle reclaimer resets any `running` job whose `updated_at` is
  older than `JOB_TIMEOUT_MS` (15 min default) back to `queued`;
- the `finally` block always marks the job error + deletes its temp dir.

## API

| Endpoint    | Auth                          | Purpose                                            |
|-------------|-------------------------------|----------------------------------------------------|
| `GET /health`  | none                      | health, ffmpeg/ffprobe versions, chromium presence, queue depth |
| `GET /status`  | `WORKER_API_KEY` bearer (open when unset) | worker config + queue state       |
| `POST /render` | same as `/status`          | direct render without the queue: `{ project, renderSettings? }` |

## Local development

```bash
cd render-worker
npm install
cp .env.example .env          # optional for smoke (no Supabase needed)
npx ts-node src/smoke.ts      # acceptance harness — real ffmpeg + remotion render
npm run dev                   # API + queue loop (needs SUPABASE_URL + key)
```

The smoke test generates its own 2s test videos + sine audio, builds a
project whose clips are trimmed (2s sources -> 2s timeline), runs the full
pipeline, prints the ffprobe JSON of the final MP4 and a PASS/FAIL summary.

## Docker

Build context is the repo root (the worker renders the repo composition):

```bash
docker build -f render-worker/Dockerfile -t render-worker .
docker run --env-file render-worker/.env -p 3010:3010 render-worker
```

The image pre-bakes Chromium via `remotion browser ensure` (network needed
at build time). On first boot without a pre-baked cache the worker runs
`remotion browser ensure` itself, which needs network egress.

## Environment variables

See `.env.example` — it documents every variable (PORT, WORKER_API_KEY,
SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, REPO_ROOT, FFMPEG_PATH,
FFPROBE_PATH, POLL_INTERVAL_MS, MAX_CONCURRENCY, JOB_TIMEOUT_MS,
HEARTBEAT_INTERVAL_MS, RENDER_TIMEOUT_MS, REMOTION_CONCURRENCY,
OUTPUT_WIDTH/HEIGHT/FPS/CRF, STORAGE_BUCKET, SIGNED_URL_EXPIRY_SECONDS).

## Files

| File            | Responsibility                                                        |
|-----------------|-----------------------------------------------------------------------|
| `src/index.ts`  | Express API (`/health`, `/status`, `/render`), chromium ensure at boot, queue start |
| `src/queue.ts`  | Poll loop, claim, stale-job reclaimer, concurrency gate                |
| `src/render.ts` | Snapshot validation, props writing, Remotion invocation, job orchestration (heartbeat, finally cleanup) |
| `src/probe.ts`  | ffprobe wrapper + delivery verification                                |
| `src/ffmpeg.ts` | Delivery-spec normalizer, xfade concat with transitions, loudnorm audio normalize |
| `src/storage.ts`| Supabase service-role client, claim/update/upload/sign                 |
| `src/config.ts` | Env config                                                             |
| `src/smoke.ts`  | Acceptance harness (CLI)                                               |
