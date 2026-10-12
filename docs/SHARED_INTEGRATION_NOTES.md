# Shared-Environment Integration Notes (Studio media + shared Supabase)

Scope: PHASE 1 (persistent media handling) and PHASE 2 (shared Supabase
integration) for SubwayTakes Studio, branch `feat/subway-interview-studio`.
Everything below is derived from source in this repository; **no database or
provider was contacted**, so every claim about live state is marked
`REQUIRES LIVE VERIFICATION`.

Companion documents: `docs/SHARED_DB_COMPATIBILITY.md` (shared-DB audit),
`docs/SHARED_AUTH_NOTES.md` (auth provisioning), `docs/RLS_TEST_EVIDENCE.md`
(RLS evidence), `docs/STAGING_RUNBOOK.md` (deployment).

---

## 1. Applying the migration — the ONLY sanctioned path

The Studio persistence layer is exactly ONE file:

```
supabase/migrations/20261011090000_studio_projects_and_render_jobs.sql
```

```bash
# 1. read-only self-check (no database contact, hash + forbidden-statement guards)
scripts/apply-studio-migration.sh --check

# 2. apply, exactly once, atomically
APPLY=yes SHARED_DB_URL="postgres://..." scripts/apply-studio-migration.sh
```

`SHARED_DB_URL` (or `SUPABASE_DB_URL`) is a PostgreSQL connection string;
nothing is defaulted. The script pins the file's sha256
(`7949c720b587469728ce323573c7217c87583926fe193760296573b75ce6cc0a`), refuses
any statement outside the studio-only allow-list, and wraps the apply in
`BEGIN; … COMMIT;` under `ON_ERROR_STOP=1`. Exit codes: `0` ok, `1` apply or
verification failure, `2` usage, `3` guard refusal (no DB contact).

The migration creates (all names `subwaytakes_*`-prefixed or Studio-specific):

| Object | Notes |
| --- | --- |
| `public.studio_projects` | RLS, owner CRUD (`authenticated`, `auth.uid()::text = user_id::text`) |
| `public.studio_render_jobs` | RLS, **SELECT-own only**; writes via service role |
| `public.muapi_caption_jobs` | RLS, **SELECT-own only**; writes via service role |
| `subwaytakes_guard_job_writes()` trigger | BEFORE INSERT/UPDATE on both job tables; raises unless the writer is a trusted server-side context (service-role JWT, `service_role`/`postgres`/`supabase_admin` session, or a no-op update) |
| `subwaytakes_guard_immutable_user_id()` trigger | `user_id` immutability on all three tables |
| `subwaytakes_set_updated_at()` trigger | replaces the shared `update_updated_at_column()` |
| `studio-exports`, `studio-uploads` buckets | private; storage policies scope objects to `<auth.uid()>/…` |

Column pairs that make URLs derived rather than identity:

- `studio_render_jobs.output_ref` / `captioned_output_ref` (jsonb) + `output_url` / `captioned_output_url` (text, last derived URL)
- `muapi_caption_jobs.output_ref` (jsonb) + `output_url` (text)

> `REQUIRES LIVE VERIFICATION`: the `videos` bucket (used by Studio scene and
> caption outputs under `studio-scenes/<uid>/…` and `studio-captions/<uid>/…`)
> is a **shared** bucket owned by the VideoRemix application. The Studio
> migration creates storage policies only for `studio-exports` and
> `studio-uploads`. Whether `authenticated` may read `videos` objects in the
> live project (i.e. whether client-side `createSignedUrl` on `videos` works)
> depends on policies from the other application's migrations. This is why
> Studio signing goes through the service-role `media-sign` function and never
> assumes a client-side storage policy.

---

## 2. `media-sign` contract (as implemented)

`POST /functions/v1/media-sign` — `Authorization: Bearer <user access token>`
(`requireUser` from `_shared/auth.ts`; the gateway `verify_jwt` stays enabled).

Request body:

```json
{ "bucket": "studio-uploads", "path": "<uid>/<project>/clip.mp4",
  "kind": "video", "ttl_seconds": 600 }
```

| Field | Required | Notes |
| --- | --- | --- |
| `bucket` | yes | must be one of `videos`, `studio-uploads`, `studio-exports` (400 otherwise) |
| `path` | yes | relative POSIX path, no `..`, no leading `/`, ≤1024 chars (400 otherwise) |
| `kind` | no | `video` \| `audio` \| `image`; defaults to `video` (only echoed/used for recovery) |
| `ttl_seconds` | no | clamped to `60…3600`; junk/`0`/negative → bounds; `≥3600` → 3600 (never long-lived) |

Responses:

```json
200 { "signedUrl": "https://…", "expiresAt": 1760000000000, "bucket": "studio-uploads", "path": "<uid>/<project>/clip.mp4" }
400 { "error": "bucket must be one of: videos, studio-uploads, studio-exports" }
401 { "error": "Invalid or expired token" }
404 { "error": "Not found" }
405 { "error": "POST is required" }
500 { "error": "Could not sign <bucket>/<path>: …" }
```

`expiresAt` is epoch milliseconds = `Date.now() + ttl * 1000`.

Properties:

- **No database writes** — the function reads (project rows for the ownership
  fallback) and calls `createSignedUrl` only, so it is safe to call on project
  load, on tab focus, and before every export/render.
- **Fail closed, no existence leak** — unauthorized paths get `404 "Not
  found"`, never 403/404-distinguishable behaviour.
- Implemented in `supabase/functions/media-sign/index.ts` on top of
  `supabase/functions/_shared/media.ts` (`assertRefOwnedOrThrow`, `signRef`,
  `clampSignTtl`, `assertMediaBucket`, `assertMediaPath`).

### Ownership model (two paths, else 404)

A caller may sign `{bucket, path}` when:

1. `path` starts with `<caller user id>/` — every Studio write is user-scoped:
   `studio-uploads/<uid>/…`, `studio-exports/<uid>/…`. No database read.
2. Otherwise the caller's `studio_projects` rows (service client) are loaded and
   checked for a clip whose `assetRef` equals `{bucket, path}` (the branding
   `logoRef` counts too). This covers the shared `videos` bucket, whose Studio
   objects live under `studio-scenes/<uid>/…` / `studio-captions/<uid>/…`
   prefixes where the first segment is not the user id.

Not covered by design: refs that live only in job rows (`muapi_caption_jobs
.output_ref`, `studio_render_jobs.output_ref`) and no project clip reference —
use the `output_url` the job row already carries, or the helpers in
`src/lib/studioProjects.ts` (`resolveRenderJobMedia`, `resolveCaptionJobMedia`).

`render-project` additionally enforces ref ownership at enqueue time: every
clip `assetRef` in the snapshot must be owned by the project's `user_id`
(400 listing the offending beats); external http(s) URLs stay allowed. The
snapshot keeps both refs and URLs — the worker resolves.

---

## 3. Client APIs (as implemented — other agents depend on these)

### `src/hooks/useMediaUrls.ts` (new)

```ts
export function useMediaUrls(
  project: StudioProject,
  options?: { signer?: MediaSigner; resolver?: MediaUrlResolver },
): {
  resolvedUrls: Map<string, string>;   // key = clip.assetUrl || clip.assetRef.path, plus 'branding.logo'
  refreshing: boolean;                 // a resolve/refresh pass is in flight
  refresh: () => Promise<void>;       // invalidates the cache and re-signs everything
  lastError: string | null;
  resolver: MediaUrlResolver;          // underlying resolver instance
};
```

- Resolves on project load/change, on `window` focus and on
  `visibilitychange` (visible only), and exposes `refresh()` for the editor to
  call before render/export.
- `resolvedUrls` keys follow `MediaUrlResolver.resolveProject` exactly:
  `clip.assetUrl || clip.assetRef.path` per clip, `'branding.logo'` for the
  logo. Options are optional, so `useMediaUrls(project)` type-checks.

### `src/hooks/useStudioProject.ts`

`useStudioProject(id, options)` keeps its previous result and adds:

```ts
mediaUrls: Map<string, string>;        // same keys as useMediaUrls
mediaRefreshing: boolean;
mediaError: string | null;
mediaResolver: MediaUrlResolver;       // shared with useMediaUrls when passed in
refreshMedia: () => Promise<StudioProject>;   // heal refs + re-sign; returns the hydrated project
```

- Loading always re-resolves media (`recoverProjectRefs` + `resolveProject` +
  `applyResolvedMediaUrls`) before `LOAD_PROJECT`, so the editor starts with
  fresh URLs and healed refs.
- `useStudioRender(projectId, project, options?)` accepts
  `options.refreshMedia?: () => Promise<unknown>` (pass
  `useStudioProject`'s `refreshMedia`): it refreshes media, saves, then
  enqueues. Job rows are shown with `output_ref` / `captioned_output_ref`
  mapped to fresh URLs (falls back to the row's last URL).

### `src/lib/studioProjects.ts`

```ts
uploadFootageRef(projectId, file, beatId?): Promise<{ ref: MediaRef; url: string; path: string }>
uploadFootage(projectId, file, beatId?): Promise<string>      // unchanged signature (session URL only)
recoverProjectRefs(project): StudioProject                    // legacy URL-only clips get a ref
applyResolvedMediaUrls(project, resolvedUrls): StudioProject  // swap in fresh session URLs
refreshProjectMedia(project, resolver?): Promise<StudioProject>
mediaResolver(signer?): MediaUrlResolver                      // process-wide resolver
resolveRenderJobMedia(job, resolver?): Promise<{ outputUrl: string|null; captionedOutputUrl: string|null }>
resolveCaptionJobMedia(job, resolver?): Promise<string | null>
resolveJobMediaUrl(url, ref, kind, resolver?): Promise<string | null>
```

- `uploadFootage` no longer mints a 10-year URL: `SIGNED_URL_TTL_SECONDS` is
  re-exported from `src/studio/mediaRefs.ts` (1 hour). `uploadFootageRef`
  returns both the ref and the session URL — new call sites should use it so
  the clip persists `assetRef`.
- `saveProject` heals refs before persisting, so autosave stores identity
  (bucket + path) next to the last session URL.
- `pollSceneStatus(...)` now returns `{ status, outputUrl, outputRef, clipId, error }`;
  `captionPoll(...)` returns `{ status, outputUrl, outputRef, captions, error }`.

### Edge-function response changes

- `scene-status` → `{ status: "done", assetUrl, assetRef: {bucket:"videos", path, kind:"video"}, clipId }`;
  `assetUrl` is a 1-hour signed URL (was 7 days).
- `muapi-captions` submit accepts an optional `clip_id`: the server loads the
  caller's project, finds the clip, and signs a 1-hour URL from its
  `assetRef` to hand to MuAPI (private buckets stay private). Without
  `clip_id` the caller-supplied `video_url` is used, as before. Poll `done`
  (styled) carries `output_ref: {bucket:"videos", path:"studio-captions/<uid>/<jobId>.mp4", kind:"video"}`
  plus a 1-hour `output_url`.

---

## 4. Studio queries vs. the shared environment (Phase 2 audit)

Verified against `supabase/migrations/20261011090000_…sql` and the code:

| Query | Where | Matches shared env? |
| --- | --- | --- |
| `studio_projects` insert/select/update | `src/lib/studioProjects.ts` (anon+user JWT) | ✅ owner-CRUD policies |
| `studio_projects` select/update | `scene-status`, `render-project`, `muapi-captions` (service role + explicit ownership check) | ✅ service role bypasses RLS |
| `studio_projects` select where `user_id = caller` | `_shared/media.ts` ownership fallback, `media-sign` | ✅ read-only |
| `studio_render_jobs` select | `loadLatestRenderJob` / `watchRenderJob` (user JWT) | ✅ SELECT-own policy |
| `studio_render_jobs` insert | `render-project` (service role) | ✅ no client write policy by design |
| `muapi_caption_jobs` insert/update/select | `muapi-captions` (service role) | ✅ |
| storage `studio-uploads` / `studio-exports` | client upload / service-role sign | ✅ per-user folder policies |
| storage `videos` (shared) | `scene-status`, `muapi-captions` (service role) | ⚠️ no Studio storage policy — see live-verification item below |

Mismatches found and fixed in this branch's files:

1. **Long-lived URLs as identity** (the Phase 1 bug): `scene-status` and
   `muapi-captions` persisted 7-day signed URLs, `uploadFootage` a 10-year URL.
   All three now persist a canonical ref + a 1-hour derived URL.
2. **`user_profiles` assumptions**: the credits chip and Settings degraded to
   `0` credits (misleading) rather than signalling "no profile data".
   `AppShell` and `SettingsPage` now render `–` when the profile row is absent;
   `auth.tsx` already had the full→minimal provisioning retry.
3. **`studio-captions/<uid>/…` paths are not `<uid>/…`** — by design (the
   shared `videos` bucket), so `media-sign` path rule (a) cannot cover them;
   they are covered by rule (b) while the caption job's output is a project
   clip, and by the job row's `output_url` otherwise (documented in §2).
4. `muapi_caption_jobs.project_id` is NOT NULL with an FK to `studio_projects`
   and `handleSubmit` keeps `assertProjectOwnership` — there is deliberately
   **no** non-Studio scope flag (clip/episode ids) for the legacy EnhancePage
   captions card; that card must be scoped to the caller's studio projects.

---

## 5. Live-verification checklist (no DB/provider access here)

1. Migration applies once, idempotently, on the shared project:
   `scripts/apply-studio-migration.sh --check` then `APPLY=yes SHARED_DB_URL=…`.
2. Post-apply inventory matches `docs/RLS_TEST_EVIDENCE.md` §4 (3 tables, 10
   policies, 8 triggers, 3 functions, 6 indexes, 2 buckets).
3. `videos` bucket in the shared project: private? size/MIME limits? Which
   policies exist for `authenticated` (the other application's). Decides
   whether the `studio-scenes`/`studio-captions` prefixes can stay there or
   Studio outputs must move to `studio-exports`.
4. `media-sign` deployed and exercised end-to-end with a real user JWT:
   `<uid>/…` path signs with no DB read; `studio-scenes/<uid>/…` signs only
   when a project clip references it; a foreign path returns `404 "Not found"`;
   ttl > 3600 is clamped.
5. `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `ALLOWED_ORIGINS` set for the deployed function set.
6. Render worker writes `studio_render_jobs.output_ref` /
   `captioned_output_ref` (jsonb `{bucket, path, kind}`) next to the URLs —
   the worker still writes only URLs in this branch; the resolver handles both.
7. Clips whose `assetRef` exists but `assetUrl` is empty are rejected by
   `_shared/project.ts#validateProjectForRender` ("must be an http(s) URL").
   The Studio editors always persist the last URL, so this is not hit today,
   but a ref-only project would need that validator relaxed (owned by the
   validation contract, not by the media layer).
8. MuAPI must be able to fetch the 1-hour signed URL handed to it (private
   bucket, no public access) — provider-side confirmation only.
9. Anonymous sign-ins enabled (the Studio boots guest sessions) and the
   `deduct_credits` RPC / `user_profiles` generic-name dependencies tolerated
   by the shared database (see `docs/SHARED_DB_COMPATIBILITY.md`).

---

## 6. Tests (all green in this workspace)

```
deno check  supabase/functions/{media-sign/index.ts,_shared/media.ts,scene-status/index.ts,muapi-captions/index.ts,render-project/index.ts,tests/media_test.ts}
deno test --allow-env --allow-net supabase/functions/tests/      # 58 passed
npx tsc --noEmit -p tsconfig.app.json                            # clean
npx eslint <touched TS files>                                    # clean
npx vitest run                                                   # 165 passed (11 files)
```
