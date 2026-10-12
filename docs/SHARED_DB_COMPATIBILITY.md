# Shared-Database Compatibility Analysis — SubwayTakes Studio

**Target project:** `bzxohkrxcwodllketcpz` ("VideoRemix Product" — a SUPABASE PROJECT SHARED BY MULTIPLE APPLICATIONS, with a DIFFERENT migration history than this repo's 37 files)
**Source branch:** `feat/subway-interview-studio`
**Sole artifact to apply to the shared project:** `supabase/migrations/20261011090000_studio_projects_and_render_jobs.sql` (259 lines)
**Method:** static source analysis only — `supabase/config.toml`, all 37 files in `supabase/migrations/`, every `.from(...)` / `.storage.from(...)` / `.rpc(...)` reference in `src/` and `supabase/functions/` (13 edge functions), plus `render-worker/`. **No live database was contacted.**
**Verification marker:** any statement about the live state of `bzxohkrxcwodllketcpz` is marked `REQUIRES VERIFICATION (no DB access)`. Operators must run §8 against the project BEFORE applying anything.

---

## 1. Executive summary

### Verdict: **CONDITIONALLY SAFE** — the Studio migration may be applied to the shared project only after the 3 blockers below are resolved and the §8 pre-apply queries return clean.

### 1.1 What is safe (no change required)

| Area | Why it is safe | Evidence |
|---|---|---|
| The 3 new tables | `studio_projects`, `studio_render_jobs`, `muapi_caption_jobs` are Studio-prefixed names unknown to any other VideoRemix app; `CREATE TABLE IF NOT EXISTS` is additive | `supabase/migrations/20261011090000_studio_projects_and_render_jobs.sql:29,75,138` |
| The 7 indexes | All `idx_studio_*` / `uq_studio_*` names, all on the 3 new tables | same file: `:40,:93,:96,:99,:157,:159` |
| The 6 table triggers | All `trg_studio_*` names, all on the 3 new tables; trigger names are scoped per-table in Postgres | same file: `:44,:104,:163,:207,:212,:217` |
| The 12 table policies | All `studio_*_own` names — policy names are unique per table, so no global namespace risk | same file: `:51,:57,:62,:68,:111,:119,:125,:131,:171,:175,:181,:187` |
| `auth.users(id)` FKs | `auth` schema exists in every Supabase project; FK + `ON DELETE CASCADE` | same file: `:31,:77,:140` |
| `gen_random_uuid()` | Built into `pg_catalog` on PG13+ (all current Supabase projects are PG15) | same file: `:30,:76,:139`; verify per §8 Q7 |
| `storage.buckets` / `storage.objects` / `storage.foldername()` | Built into every Supabase project's `storage` schema | same file: `:233–259` |
| `anon` DML revoke on the 3 tables | Strictly restrictive, new tables only | same file: `:225–227` |
| No `auth.users` triggers in the Studio migration | It contains zero `CREATE TRIGGER ... ON auth.users` statements — the only `auth.users` references are the 3 FKs | grep of same file: `:31,:77,:140` |
| No destructive statement | No `DROP TABLE`, no `DROP COLUMN`, no `DROP INDEX`, no policy-dropping loop, no data mutation of pre-existing tables | full-file review; contrast with history in §7 |

### 1.2 What is risky

1. **Shared generic function names.** The migration *consumes* `update_updated_at_column()` and *redefines* `immutable_user_id()` — two generic, unprefixed `public` function names that another VideoRemix app may own (Blocker B1/B2, §4.1–4.2, §5).
2. **The `videos` storage bucket.** Studio edge functions write generated scenes and styled captions into the generic `videos` bucket and read it back as a *public* bucket — a cross-application object the shared project may not have, may own differently, or may expose unintentionally (Blocker B3, §4.5).
3. **`user_profiles`.** The runtime resolves credits against the generically-named `user_profiles` table and `deduct_credits()` RPC; the shared project's `user_profiles` almost certainly belongs to another app or does not exist (§4.3).
4. **Storage-upsert vs. policy gap.** The Studio storage policies grant only `SELECT` + `INSERT` on `storage.objects`; browser code uploads with `upsert: true` (§4.7, W5).
5. **Realtime publication.** `studio_render_jobs` is not added to the `supabase_realtime` publication by the migration; the client polls as a fallback, so this degrades latency, not correctness (§3.1).

### 1.3 Top 3 blockers and exact resolutions

| # | Blocker | Evidence | Exact resolution |
|---|---|---|---|
| **B1** | **`immutable_user_id()` is redefined by the Studio migration via `CREATE OR REPLACE FUNCTION immutable_user_id()`.** In the shared DB, any identically-named function (owned by another app, or created by our own history with `SECURITY DEFINER` + `SET search_path = ''`) is silently overwritten, and the hardening attributes are dropped. Other apps' triggers firing this function change behavior and their exception messages change. | Studio migration `:194–204` (redefinition), usage `:206–219`; original definition with hardening attributes in our history: `supabase/migrations/20260226110220_rls_policies.sql:103–115` | Do not touch a shared generic name. Replace lines 194–204 with a SubwayTakes-prefixed function and re-point the 3 triggers at it (exact SQL in §5.1): `subwaytakes_immutable_user_id()` — keeping `SECURITY DEFINER` and `SET search_path = ''`. If the shared DB already has an `immutable_user_id()` created by *another* app, this migration's version would have destroyed it; the fix removes that hazard entirely. |
| **B2** | **The Studio migration depends on `public.update_updated_at_column()`, which it does NOT define.** The function exists only because of *our* 37-migration history (2026-02-03). In a shared DB with a different history the function may be absent (migration FAILS at trigger creation, line 46) or may exist with a different signature/body (silent wrong behavior). | Trigger creation at `:46,:106,:165`; the only definition in this repo's history: `supabase/migrations/20260203190000_add_age_appropriate_content.sql:131–137` — **not** in `20260226110220_rls_policies.sql` as sometimes assumed | Make the migration self-contained: add the definition of `subwaytakes_touch_updated_at()` inside the Studio migration (exact SQL in §5.2) and use it in the three `updated_at` triggers. After this change the migration references **zero** functions from our history and can be applied to any Supabase project that has only `auth` + `storage`. |
| **B3** | **Studio edge functions write to the shared generic `videos` bucket and read it as public.** `scene-status` uploads every generated scene to `videos` and builds a public URL; `muapi-captions` stores every styled captioned video there. In this repo's history `videos` is created **private** (`:78–83` of the storage migration), but the code calls `getPublicUrl`, so production evidently runs with `videos` public. In the shared project the bucket may be missing, owned by another app, private, or have a 100 MB limit / MIME allowlist that breaks 1080×1920 MP4 uploads. | `supabase/functions/scene-status/index.ts:118–135`; `supabase/functions/muapi-captions/index.ts:114–122`; bucket definition: `supabase/migrations/20260128195748_add_user_profiles_and_storage.sql:78–83` | Operator step first: run §8 Q2 against `bzxohkrxcwodllketcpz` and record `public`, `file_size_limit`, `allowed_mime_types` for `videos`. If absent or incompatible, the code fix (out of scope for the SQL migration — must land before Studio edge functions are enabled in the shared project) is to route Studio writes to this migration's own buckets: `studio-exports` for `scene-status` (`:119–134`) and `muapi-captions` (`:114–122`), keeping the `studio-uploads` upload path unchanged. Coordinate with the owning app before either option. `REQUIRES VERIFICATION (no DB access)` |

### 1.4 Watch items (not blockers)

- **W1 — bucket adoption by `ON CONFLICT DO NOTHING`.** `:233–239` inserts `studio-exports`/`studio-uploads` and silently does nothing if those ids already exist — the migration would then operate on *another app's* bucket row, possibly `public = true`, defeating the private-bucket assumption (§4.6). `REQUIRES VERIFICATION (no DB access)`.
- **W2 — `user_profiles` shape.** Studio's auth layer selects `*` and upserts fixed columns; another app's `user_profiles` with different columns breaks credits (§4.3). `REQUIRES VERIFICATION (no DB access)`.
- **W3 — anonymous sign-ins.** The whole identity model starts with `supabase.auth.signInAnonymously()`; if the shared project has anonymous sign-ins disabled, Studio is unusable (§6).
- **W4 — PostgREST schema cache.** New tables are not queryable until PostgREST reloads the schema cache (§8, post-apply step).
- **W5 — storage upsert policy gap.** Policies grant only SELECT+INSERT on `storage.objects`; browser uploads use `upsert: true` (§4.7).

---

## 2. Inventory: objects the Studio migration creates

Source: `supabase/migrations/20261011090000_studio_projects_and_render_jobs.sql` (the complete object list below is everything the migration creates). **Status for every row:** *does not exist in shared DB per mission statement (verify before apply)* — the shared project `bzxohkrxcwodllketcpz` is expected to contain none of these objects because they are Studio-specific; the operator must confirm with §8 Q1–Q6 before applying. `REQUIRES VERIFICATION (no DB access)`.

### 2.1 Tables (3)

| Object | Lines | Key contents |
|---|---|---|
| `public.studio_projects` | `:29–38` | `id uuid PK default gen_random_uuid()`, `user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`, `title text`, `project jsonb NOT NULL`, `version integer`, `created_at`/`updated_at timestamptz` |
| `public.studio_render_jobs` | `:75–91` | `id`, `user_id` FK→`auth.users`, `project_id` FK→`studio_projects`, `status text CHECK IN ('queued','running','done','error')`, `progress int 0–100`, `output_url`, `captioned_output_url`, `error`, `worker_id`, `project_snapshot jsonb NOT NULL`, `render_settings jsonb`, timestamps |
| `public.muapi_caption_jobs` | `:138–155` | `id`, `user_id` FK, `project_id` FK→`studio_projects`, `render_job_id` FK→`studio_render_jobs ON DELETE SET NULL`, `mode IN ('styled','editable')`, `muapi_request_id`, `language`, `theme`, `status`, `output_url`, `captions jsonb`, `error`, timestamps |

### 2.2 Indexes (7, incl. 1 partial unique)

| Index | Lines | Definition |
|---|---|---|
| `idx_studio_projects_user_updated` | `:40–41` | `(user_id, updated_at DESC)` |
| `idx_studio_render_jobs_queue` | `:93–95` | partial `(status, created_at) WHERE status = 'queued'` |
| `idx_studio_render_jobs_user` | `:96–97` | `(user_id, created_at DESC)` |
| `uq_studio_render_jobs_active_per_project` | `:99–101` | **partial unique** `(project_id) WHERE status IN ('queued','running')` — the one-active-job guard |
| `idx_muapi_caption_jobs_project` | `:157–158` | `(project_id, created_at DESC)` |
| `idx_muapi_caption_jobs_user` | `:159–160` | `(user_id, created_at DESC)` |

### 2.3 Triggers (6) and the functions they call

| Trigger | Lines | Timing | Function called |
|---|---|---|---|
| `trg_studio_projects_updated_at` | `:43–46` | BEFORE UPDATE | `update_updated_at_column()` — **NOT defined by this migration; see Blocker B2 / §5** |
| `trg_studio_render_jobs_updated_at` | `:103–106` | BEFORE UPDATE | `update_updated_at_column()` |
| `trg_muapi_caption_jobs_updated_at` | `:162–165` | BEFORE UPDATE | `update_updated_at_column()` |
| `trg_studio_projects_immutable_user` | `:206–209` | BEFORE UPDATE | `immutable_user_id()` — **redefined by this migration; see Blocker B1 / §5** |
| `trg_studio_render_jobs_immutable_user` | `:211–214` | BEFORE UPDATE | `immutable_user_id()` |
| `trg_muapi_caption_jobs_immutable_user` | `:216–219` | BEFORE UPDATE | `immutable_user_id()` |

### 2.4 Table policies (12, RLS enabled on all 3 tables at `:48,:108,:167`)

Naming pattern `<table>_<select/insert/update/delete>_own`, all `TO authenticated`, all `auth.uid()::text = user_id::text` (both `USING` and `WITH CHECK` on UPDATE):

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `studio_projects` | `:50–53` | `:55–58` | `:60–64` | `:66–69` |
| `studio_render_jobs` | `:110–113` | `:118–121` | `:123–127` | `:129–132` |
| `muapi_caption_jobs` | `:169–172` | `:174–177` | `:179–183` | `:185–188` |

### 2.5 Trigger function defined by the migration (1)

| Function | Lines | Notes |
|---|---|---|
| `immutable_user_id()` | `:194–204` | `CREATE OR REPLACE` — **Blocker B1.** Body: raises `'user_id is immutable'` iff `NEW.user_id IS DISTINCT FROM OLD.user_id`. Compared with our history's definition (`20260226110220_rls_policies.sql:103–115`) it **drops `SECURITY DEFINER` and `SET search_path = ''`** and changes the exception text — irrelevant in isolation, destructive if the shared DB's function belongs to another app |

### 2.6 Storage buckets (2) and storage policies (2 pairs = 4 policies)

| Object | Lines | Definition |
|---|---|---|
| Bucket `studio-exports` | `:233–235` | private; `INSERT INTO storage.buckets (id, name, public) ... ON CONFLICT (id) DO NOTHING` |
| Bucket `studio-uploads` | `:237–239` | private; same pattern |
| Policy pair `studio_exports_read_own` / `studio_exports_insert_own` | `:241–249` | on `storage.objects`, `TO authenticated`, `bucket_id = 'studio-exports' AND (storage.foldername(name))[1] = auth.uid()::text` |
| Policy pair `studio_uploads_read_own` / `studio_uploads_insert_own` | `:251–259` | same pattern for `studio-uploads` |

Grants/revokes: `REVOKE INSERT, UPDATE, DELETE ... FROM anon` on all three tables (`:225–227`). No `GRANT` statements.

**Consumers of these objects (must exist together):** render worker uploads/signs in `studio-exports` (`render-worker/src/config.ts:67`, `render-worker/src/storage.ts:233–255`); browser uploads/signs in `studio-uploads` (`src/lib/studioProjects.ts:30,:142–149`).

---

## 3. Inventory: objects the app RUNTIME depends on

Derived from grepping every `.from('<table>')`, `.storage.from('<bucket>')` and `.rpc(` call in `src/` and `supabase/functions/`. **Studio-only = safe in the shared DB (created by the Studio migration). Shared = requires the object to pre-exist and behave compatibly — `REQUIRES VERIFICATION (no DB access)`.**

### 3.1 Studio editor (browser client)

| Object | Columns used | Evidence | Status |
|---|---|---|---|
| `studio_projects` | insert `id, user_id, title, project, version`; select `project`; update `project, title, updated_at` | `src/lib/studioProjects.ts:73–113` | **Studio-only — safe** |
| `studio_render_jobs` | `select *`; columns consumed: `status, progress, output_url, captioned_output_url, error, worker_id, created_at` (row type: `src/studio/types.ts:140–152`) | `src/lib/studioProjects.ts:179–186,:221–225` | **Studio-only — safe** |
| bucket `studio-uploads` | `upload(path, {upsert:true})` + `createSignedUrl(path, 315360000)` at path `<user_id>/<project_id>/...` | `src/lib/studioProjects.ts:30,:32,:142–149` | **Studio-only — safe** |
| realtime `postgres_changes` on `studio_render_jobs` | `event:'*'`, filter `id=eq.<jobId>` | `src/lib/studioProjects.ts:207–217` | Studio-only table; **publication membership `REQUIRES VERIFICATION`** — `supabase_realtime` publication may not include it; the 3 s poll (`:190,:232–233`) is the fallback, so absence degrades latency only |
| edge functions `plan-interview`, `generate-scene`, `scene-status`, `render-project`, `muapi-captions` | invoked with the **user JWT** | `src/lib/studioProjects.ts:169,:296,:317,:370,:386,:441`; JWT wiring `src/lib/edgeFunctions.ts:24–25,:39` | Studio functions; must be deployed to the shared project (§6) |

### 3.2 Studio edge functions (server side)

| Function | DB / storage access | Evidence | Status |
|---|---|---|---|
| `render-project` | `studio_projects.select` (`service role`), `studio_render_jobs.select/insert` with `user_id` from JWT, `project_snapshot`, `render_settings`; relies on the partial unique index for 409 races | `supabase/functions/render-project/index.ts:85–138` | **Studio-only — safe** |
| `generate-scene` | ownership read of `studio_projects` only | `supabase/functions/generate-scene/index.ts:129–130` | **Studio-only — safe** |
| `scene-status` | `studio_projects.select/update`; **`storage.from('videos').upload` + `getPublicUrl`** at `studio-scenes/<user>/<project>/...` | `supabase/functions/scene-status/index.ts:118–135,:140–171` | table safe; **`videos` bucket = shared — Blocker B3** |
| `muapi-captions` | `muapi_caption_jobs.insert/select/update`; **`storage.from('videos').upload` + `getPublicUrl`** at `studio-captions/<user>/<job>.mp4` | `supabase/functions/muapi-captions/index.ts:114–122,:222–234,:251–254,:282–352` | table safe; **`videos` bucket = shared — Blocker B3** |
| render worker | `studio_render_jobs` claim/reclaim/progress/heartbeat/done/error; `studio_projects` snapshot fetch; uploads + signs in `studio-exports` (service role) | `render-worker/src/storage.ts:85–255,:301–309`; bucket default `render-worker/src/config.ts:67` | **Studio-only — safe** |
| `_shared/ownership.ts` `assertProjectOwnership` | `studio_projects.user_id` (service-role read, 404 on miss) | `supabase/functions/_shared/ownership.ts:62–69` | **Studio-only — safe** |
| `_shared/auth.ts` `requireUser` / `serviceClient` | `auth.getUser(token)` + service-role client from `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` env | `supabase/functions/_shared/auth.ts:34–55,:69–75` | project-level env; must point at `bzxohkrxcwodllketcpz` |

### 3.3 Legacy clip / episode / compilation flows (remain in the deployed app — NOT Studio)

These flows are part of the same frontend/edge-function bundle and therefore keep working only if the shared project contains compatible versions of these objects. They are **all shared — `REQUIRES VERIFICATION (no DB access)`** (the Studio migration does not create any of them):

| Area | Objects | Evidence |
|---|---|---|
| Clips | table `clips` (`user_id` is **text**, not uuid); ownership checks in edge functions | `src/lib/clips.ts:150–782`; table shape `supabase/migrations/20260127032356_create_clips_table.sql:26–41`; `supabase/functions/secure-clips-api/index.ts:287–434`; `assertClipOwnership` `supabase/functions/_shared/ownership.ts:75–77` |
| Episodes / shots / scripts / characters | `episodes`, `episode_shots`, `episode_scripts`, `character_bibles` | `src/lib/episodes.ts:34–341`, `src/lib/scriptEngine.ts:745–974`, `src/lib/characters.ts:120–194`; `supabase/functions/stitch-episode/index.ts:144–339`; `supabase/functions/generate-video/index.ts:596–852`; `supabase/functions/compose-overlay/index.ts:532–733` |
| Compilations | `compilations`, `compilation_clips` + rpc `reorder_compilation_clips` | `src/lib/compilations.ts:38–314,:206`; `supabase/functions/stitch-clips/index.ts:185–371`; rpc `supabase/migrations/20260223172226_add_batch_reorder_rpc.sql:14–37` |
| Templates / exports | `video_templates`, `video_exports` | `src/lib/templates.ts:46–355`; `supabase/functions/compose-overlay/index.ts:490–498` |
| Prompt admin | `prompt_templates`, `prompt_fragments`, `system_prompts`, `prompt_generation_logs` | `src/lib/promptAdmin.ts:43–98`; `supabase/functions/build-prompt/index.ts:726–805`; `supabase/functions/generate-script/index.ts:453` |
| Reference data | `question_bank`, `music_tracks`, `sound_effects` | `src/components/QuestionInput.tsx:25`; `src/lib/questionBank.ts:45–158`; `src/components/EnhancementPanel.tsx:162,:166` |
| Dashboard counts | `clips`, `episodes` | `src/pages/DashboardPage.tsx:180–196` |
| Analytics rpc | `get_analytics_summary(p_range_start, p_prev_start, p_prev_end)` | `src/pages/AnalyticsPage.tsx:68`; `supabase/migrations/20260223225526_add_analytics_aggregation_rpc.sql:18` |
| Legacy realtime | `postgres_changes` on legacy tables | `src/hooks/useRealtimeStatus.ts:29–31` |
| Legacy buckets | `videos` (uploads + public URLs: `supabase/functions/stitch-clips/index.ts:85–101`, `stitch-episode:78–95`, `compose-overlay:458–471`, `src/lib/ffmpeg.ts:253–264` path `processed/...`); `captions` (`stitch-clips:318–332`, `stitch-episode:291–299`); `template-logos` (`src/lib/templates.ts:152,:164–165`) | see §4.5 |

### 3.4 Auth / credits

| Object | Usage | Evidence | Status |
|---|---|---|---|
| `user_profiles` | `select *`, upsert `id, credits_balance:100, subscription_tier:'free', default_city_style, default_duration`; `update(..., updated_at)` | `src/lib/auth.tsx:11–21,:52–77,:142–150` | **Shared — `REQUIRES VERIFICATION`** (§4.3) |
| rpc `deduct_credits(p_user_id, p_amount)` | called with the profile id; reads `user_profiles.credits_balance` | `src/lib/auth.tsx:152–159`; `supabase/migrations/20260222124952_add_atomic_credit_deduction.sql:15–43` | **Shared — `REQUIRES VERIFICATION`**; note it is `SECURITY DEFINER` and writes `credits_balance`/`updated_at` — if another app owns `user_profiles` with a different column set, this RPC overwrites it |
| anonymous sign-in | `supabase.auth.signInAnonymously()` on cold start | `src/lib/auth.tsx:98–106` | project auth setting — §6, `REQUIRES VERIFICATION` |

**Net Studio-only surface:** 3 tables + 6 rules of policies + 2 buckets + 5 edge functions + 1 worker. Everything in §3.3/§3.4 is inherited shared-database surface.

---

## 4. Name-conflict analysis (CRITICAL)

The shared project hosts multiple VideoRemix apps. Every generic, unprefixed name in this repo is a potential collision. For each: **risk** + **resolution**.

### 4.1 `update_updated_at_column()` — **HIGH risk (consumed dependency)**

- Used at Studio migration `:46,:106,:165`; defined only in our history at `supabase/migrations/20260203190000_add_age_appropriate_content.sql:131–137`.
- Risk: (a) shared DB lacks it → Studio migration **fails at line 46** (trigger creation cannot find the function); (b) another app defines it with a different signature/body → Studio tables silently get foreign behavior; (c) our history's definition would *replace* theirs if ever replayed.
- Resolution: make the Studio migration self-contained with a prefixed function (§5.2). `REQUIRES VERIFICATION (no DB access)` whether the shared DB already has this name and who owns it (§8 Q3).

### 4.2 `immutable_user_id()` — **CRITICAL risk (redefined here)**

- Studio migration `:194–204` executes `CREATE OR REPLACE FUNCTION immutable_user_id()`, overwriting whatever exists under that generic name in the shared project.
- This is the **only** statement in the Studio migration that modifies a pre-existing object.
- Risk: another VideoRemix app's tenant-immutability trigger function (a natural name for exactly this purpose) is silently replaced: hardening attributes dropped (`SECURITY DEFINER`, `SET search_path = ''`), exception message changed; all of that app's triggers keep firing against the new body with no error anywhere.
- Resolution: define and use a SubwayTakes-prefixed `subwaytakes_immutable_user_id()` inside the Studio migration (§5.1); apply the 3 triggers to it. Never `CREATE OR REPLACE` an unprefixed function in a shared project.

### 4.3 `user_profiles` — **HIGH risk (shared runtime table)**

- Studio's auth layer assumes the exact column set `id, display_name, avatar_url, default_city_style, default_duration, credits_balance, subscription_tier, created_at, updated_at` (`src/lib/auth.tsx:11–21`), the table is created by our history (`supabase/migrations/20260128195748_add_user_profiles_and_storage.sql:28–38`), and `deduct_credits` writes `credits_balance` there (`20260222124952:27–39`).
- Risk: the shared DB's `user_profiles` is one of the most likely generic tables to exist with different columns/semantics (per-app profile tables are a common naming pattern). `select *` + typed cast would break the client; concurrent `deduct_credits` would fight another app's ledger.
- Resolution: **do not** create/rename `user_profiles` in the shared project. Verify its shape with §8 Q9. If the shape is incompatible, SubwayTakes needs its own prefixed credits table (e.g. `subwaytakes_credits`) and a code+migration change — out of scope for the current Studio migration. `REQUIRES VERIFICATION (no DB access)`.

### 4.4 Trigger names and table policy names — **LOW risk**

- `trg_studio_projects_updated_at`, `trg_studio_render_jobs_updated_at`, `trg_muapi_caption_jobs_updated_at`, `trg_studio_projects_immutable_user`, `trg_studio_render_jobs_immutable_user`, `trg_muapi_caption_jobs_immutable_user` (Studio migration `:44,:104,:163,:207,:212,:217`). Trigger names are scoped to their table in Postgres; all six are on tables this migration creates and all are prefixed — collision only conceivable if another app also owns a `studio_projects` table (see §4.6).
- Policy names `studio_*_own` (`:51`–`:188`) are scoped per table — no global namespace.
- The migration's `DROP TRIGGER IF EXISTS` / `DROP POLICY IF EXISTS` guards (`:43,:50,:55,:60,:66` …) would only remove an identically-named object on the same table; with studio-prefixed names on studio-prefixed tables this is safe.

### 4.5 Storage bucket names — **MEDIUM–HIGH risk**

Studio-relevant and legacy buckets referenced by the runtime:

| Bucket | Used by | Origin in this repo | Risk / resolution |
|---|---|---|---|
| `videos` | Studio `scene-status`, `muapi-captions`; legacy `stitch-clips`, `stitch-episode`, `compose-overlay`, `ffmpeg.ts` | `supabase/migrations/20260128195748_add_user_profiles_and_storage.sql:80` (private, 100 MB, video MIME allowlist) | **HIGH — Blocker B3.** Generic name; code treats it as public (`getPublicUrl`) although history creates it private. Verify existence, `public` flag, limits, and owning app (§8 Q2). If missing: create per this repo's definition or repoint Studio code to `studio-exports`. |
| `studio-exports` | render worker | Studio migration `:233–235` | **MEDIUM** — another app could have created the same id; `ON CONFLICT (id) DO NOTHING` would silently adopt their bucket (possibly public/wrong limits). Verify with §8 Q2; if taken, rename to `subwaytakes-exports` (migration `:233–259` + `render-worker/src/config.ts:67`). |
| `studio-uploads` | browser uploads | Studio migration `:237–239`; `src/lib/studioProjects.ts:30` | **MEDIUM** — same as above; rename to `subwaytakes-uploads` if taken. |
| `captions` | legacy stitch functions | **not created by any tracked migration** (dashboard-created historically) | MEDIUM — generic; in a shared DB it may belong to another app with different visibility. Verify (§8 Q2). Legacy flows only. |
| `template-logos` | template editor | mentioned only in a comment `supabase/migrations/20260218184921_add_template_logo_upload.sql:13`; never created by a migration | MEDIUM — verify existence (§8 Q2). |
| `thumbnails`, `avatars` | profile/template flows | `supabase/migrations/20260128195748_add_user_profiles_and_storage.sql:81–82` (public) | MEDIUM — public buckets with generic names; another app may own them. Verify if those flows are enabled. |

Note: there is **no `episodes` bucket** — `episodes/` is a *folder prefix* inside `videos` (`supabase/functions/stitch-episode/index.ts:81`). Do not confuse it with a bucket during verification.

Storage policy names on `storage.objects` — `studio_exports_read_own`, `studio_exports_insert_own`, `studio_uploads_read_own`, `studio_uploads_insert_own` (`:242,:248,:254,:258`) — live in the **`storage.objects` table-wide policy namespace** (shared by every bucket in the project). They are distinctive enough, but the `DROP POLICY IF EXISTS` guards would delete another app's policy only if it used the identical name (unlikely). LOW residual risk.

### 4.6 Table names — LOW for Studio, HIGH for replay

- Studio tables (`studio_projects`, `studio_render_jobs`, `muapi_caption_jobs`) — LOW; `CREATE TABLE IF NOT EXISTS` will not touch a same-named table from another app, but see W1: if one existed, we would attach to someone else's schema. §8 Q1 covers it.
- Legacy tables in this repo's history are all generic and would collide badly if replayed: `clips`, `episodes`, `episode_scripts`, `episode_shots`, `character_bibles`, `compilations`, `compilation_clips`, `video_templates`, `video_exports`, `question_bank`, `music_tracks`, `sound_effects`, `prompt_templates`, `prompt_fragments`, `system_prompts`, `prompt_generation_logs`, `token_balances`, `token_transactions`, `viral_scores`, `clip_rerolls`, `episode_beats`, `subscriptions`, `user_profiles`, plus (from the non-timestamped `COMPLETE_MIGRATION.sql`) `profiles`, `media_assets`, `age_appropriate_questions`, `topic_age_mappings`, `mature_word_filter`. See §7 — **none of these may be replayed**.

### 4.7 RPC / function names

| Function | Origin | Risk / resolution |
|---|---|---|
| `update_updated_at_column` | our history `20260203190000:131` | §4.1 — prefix in Studio migration |
| `immutable_user_id` | our history `20260226110220:103` | §4.2 — **CRITICAL** |
| `deduct_credits` | our history `20260222124952:15` | generic; writes `user_profiles.credits_balance`; only create if `user_profiles` is verified SubwayTakes-owned (§4.3) |
| `atomic_deduct_tokens` | our history `20260222201230:12` | generic; token-ledger semantics likely clash with another app; do not replay |
| `reorder_compilation_clips` | our history `20260223172226:14` | generic; legacy flow only |
| `get_analytics_summary` | our history `20260223225526:18` | generic; legacy flow only |
| `assign_episode_number` | our history `20260218182659:190` | generic; legacy flow only |
| `handle_new_user` + trigger `on_auth_user_created` | our history `20260128195748:59–75` | **HIGH if replayed** — an `auth.users` AFTER INSERT trigger provisioning `public.user_profiles` for **every** new user in the shared project (all apps); can also conflict with another app's provisioning trigger on the same event. Never replay (§6, §7) |

---

## 5. Self-containment analysis

### 5.1 Explicit dependency: the Studio migration is NOT self-contained

| # | Dependency | Provided by | Present in shared DB? |
|---|---|---|---|
| 1 | `public.update_updated_at_column()` — called at Studio migration `:46,:106,:165` | **Our migration history only**: `supabase/migrations/20260203190000_add_age_appropriate_content.sql:131–137` | `REQUIRES VERIFICATION (no DB access)` — likely absent (different migration history) → the Studio migration **fails** on a fresh shared DB at line 46 (`CREATE TRIGGER ... EXECUTE FUNCTION update_updated_at_column()` with no such function ⇒ `ERROR: function update_updated_at_column() does not exist`) |
| 2 | `public.immutable_user_id()` — the migration *redefines* it (`:194–204`), so it does not strictly depend on it existing | our history `20260226110220_rls_policies.sql:103–115`; other apps may own the same name | `REQUIRES VERIFICATION (no DB access)` — and redefining it is the B1 conflict regardless of who owns it |
| 3 | `auth.users(id)` | Supabase built-in `auth` schema — **always exists** in every Supabase project | safe |
| 4 | `storage.buckets`, `storage.objects`, `storage.foldername()` | Supabase built-in `storage` schema — **always exists** | safe (`storage.foldername` is a storage-schema helper installed by the platform; verify per §8 Q8) |
| 5 | `gen_random_uuid()` | `pg_catalog` built-in on PG13+ (Supabase is PG15); on PG12 it existed in `public` only via `pgcrypto` | `REQUIRES VERIFICATION (no DB access)` via §8 Q7 (`select version()`); effectively guaranteed on current Supabase |
| 6 | `auth.uid()` | built into every Supabase project's `auth` schema | safe |
| 7 | roles `anon` / `authenticated` | Supabase built-in roles — always exist | safe |

**Recommendation:** make the migration fully self-contained. Two exact patches for the migration author (this analysis does not modify the file):

**Patch for Blocker B2** — add at the top of the Studio migration and use it in the three `updated_at` triggers (`:46,:106,:165`):

```sql
-- SubwayTakes-owned; no dependency on any function from the 37-migration history
CREATE OR REPLACE FUNCTION subwaytakes_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
-- then: EXECUTE FUNCTION subwaytakes_touch_updated_at()   (3x)
```

**Patch for Blocker B1** — replace `:194–204`:

```sql
-- SubwayTakes-owned; MUST NOT reuse/replace the shared-name immutable_user_id()
CREATE OR REPLACE FUNCTION subwaytakes_immutable_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'user_id is immutable on %', TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END;
$$;
-- then point trg_studio_projects_immutable_user / trg_studio_render_jobs_immutable_user /
--      trg_muapi_caption_jobs_immutable_user (:206-219) at subwaytakes_immutable_user_id()
```

With both patches, the Studio migration's only external dependencies are Supabase platform-built-ins (`auth.users`, `storage.*`, `auth.uid()`, `gen_random_uuid()`), which exist in every Supabase project — the correct posture for a shared-database deployment.

### 5.2 Rollback in the shared DB (differs from the isolated-project rollback)

The rollback in `docs/STAGING_MIGRATION_AUDIT.md` §5 restores the original `immutable_user_id()` definition. **That step must NOT run in the shared project** — it would overwrite another app's function. Shared-DB rollback: drop the 4 storage policies → delete objects/bucket rows → `DROP TABLE ... CASCADE` (3 tables) → drop only the prefixed trigger functions (`subwaytakes_immutable_user_id()`, `subwaytakes_touch_updated_at()`) if the §5 patches were applied. `REQUIRES VERIFICATION (no DB access)` which function names the shared DB actually owns before any restore step.

---

## 6. Authentication assumptions

1. **Identity resolution — anonymous sign-in first.** On cold start with no session the app calls `supabase.auth.signInAnonymously()` (`src/lib/auth.tsx:98–106`); `is_anonymous` users are `isGuest` (`:48`). Every Studio write resolves `user_id` from `getUserId()` → the current `auth.users.id` (`src/lib/auth.tsx:189–193`, `src/lib/studioProjects.ts:36–42`). **Assumption requiring verification:** anonymous sign-ins must be ENABLED on `bzxohkrxcwodllketcpz` (Dashboard → Authentication → Sign-in providers → Anonymous). If disabled, Studio cannot persist anything. `REQUIRES VERIFICATION (no DB access)`.
2. **User JWTs to edge functions.** The client calls edge functions with the current session's access token, falling back to the anon key only when no session exists (`src/lib/edgeFunctions.ts:24–25,:39`). Functions validate the token themselves via `auth.getUser(token)` (`supabase/functions/_shared/auth.ts:34–55`) and use the service-role client only after explicit ownership checks (`:69–75`, `supabase/functions/_shared/ownership.ts:41–69`). The gateway JWT check (`verify_jwt = true` default) is a redundant outer layer (`supabase/config.toml:15–22`). No shared-DB-specific hazard; function env (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) must point at the shared project.
3. **`user_id = auth.uid()`** enforced by three layers on every Studio table: RLS policies `auth.uid()::text = user_id::text` (Studio migration `:53,:58,:63,:69,:113,:121,:127,:132,:172,:177,:183,:188`), the immutability trigger (§5.1), and edge-function ownership checks (`render-project/index.ts:83`; `_shared/ownership.ts:63`).
4. **FK to `auth.users(id)` with `ON DELETE CASCADE`** (`:31,:77,:140`). Anonymous users are real rows in `auth.users`, so the FK always resolves. Consequence for a shared project: deleting a user from *any* app's admin tooling cascades into SubwayTakes Studio data — acceptable by design, but the other apps' operators should be aware. `REQUIRES VERIFICATION (no DB access)` (no other-app policy depends on our FKs).
5. **No `auth.users` triggers and no global provisioning in this repo's Studio migration.** The migration contains zero `CREATE TRIGGER ... ON auth.users` statements (only FK references at `:31,:77,:140`), and profile provisioning is done lazily per-user by the client (`src/lib/auth.tsx:52–77`). **By contrast, our repo history DOES install an `auth.users` trigger** — `on_auth_user_created → public.handle_new_user()` inserting into `public.user_profiles` (`supabase/migrations/20260128195748_add_user_profiles_and_storage.sql:59–75`). In a shared project that trigger would provision `user_profiles` rows for users of *every* VideoRemix app and could conflict with another app's own provisioning trigger on the same event. It must never be replayed; the Studio deployment needs no `auth.users` trigger at all.

---

## 7. Migration-history risk

**Why replaying the full 37-file history into the shared project is unsafe**, and confirmation of the single artifact to apply.

### 7.1 The history is written for a dedicated, SubwayTakes-owned schema

- 35 CLI-tracked migrations (`20260127032356` → `20260226110220`) **plus 2 non-timestamped legacy scripts** (`supabase/migrations/COMPLETE_MIGRATION.sql`, `supabase/migrations/STORAGE_SETUP.sql`) that are skipped by `supabase db push` but tempting to paste into a SQL editor. Together they assume `public` is SubwayTakes-exclusive: generic tables (`clips`, `episodes`, `profiles`, `media_assets`, `token_balances`, `subscriptions`, …), generic buckets (`videos`, `captions`, `thumbnails`, `avatars`), and a project-wide `auth.users` provisioning trigger.
- **Destructive statements that would damage other apps** (none of these appear in the Studio migration):
  - `20260225065651_harden_rls_policies.sql:38–49` — a DO-block that drops **every RLS policy on every table in `public`**. In the shared project this erases other VideoRemix apps' row-level security. (Replay risk; not a Studio-migration risk.)
  - `20260222183424_restore_anon_policies_for_guest_mode.sql:19–93` — creates `anon` policies with `USING (true)` on `clips`, `episodes`, `episode_scripts`, `episode_shots`, `character_bibles`, `compilations`, `compilation_clips`, `video_exports` — would expose same-named tables of other apps to unauthenticated reads/writes.
  - `20260203194600_update_age_groups.sql:8,:14–18` — `DROP TYPE IF EXISTS age_group CASCADE`, rewrites `clips.target_age_group`, `UPDATE clips SET ...` — mutates another app's objects if names collide.
  - `20260226105754_production_integrity.sql:153–168` and `20260223034719_drop_permissive_anon_policies.sql` — drop indexes/policies by generic names.
- **Silent shape-drift:** history statements are guarded with `IF NOT EXISTS` (e.g. `CREATE TABLE IF NOT EXISTS clips` `20260127032356:26`), so replay against a foreign same-named table does not fail — it silently attaches, then later `ALTER TABLE ... ADD COLUMN` and `CHECK` constraints diverge from the other app's semantics, producing a half-migrated shared schema that is very hard to reason about.
- **Bucket adoption:** `20260128195748_add_user_profiles_and_storage.sql:78–83` inserts `videos`/`thumbnails`/`avatars` with `ON CONFLICT (id) DO NOTHING` and then attaches this repo's storage policies — in the shared project those buckets likely belong to another app with different visibility, so this repo's policies either fail to attach or visibly change other apps' access.
- **Provisioning trigger:** `20260128195748:59–75` (`handle_new_user` / `on_auth_user_created`) fires for **all** new users in the project (cross-app side effect, §6.5).
- **Migration-bookkeeping divergence:** `supabase db push` compares `supabase_migrations.schema_migrations` with local files; against a project with a different history the CLI either attempts to apply all 37 files or refuses. `supabase/config.toml` deliberately pins **no** `project_id` (`supabase/config.toml:10–13`), so the target is chosen by `supabase link --project-ref` — link to `bzxohkrxcwodllketcpz` only, never the historical production ref `orcosohomdugkfcgydwj` still recorded in `supabase/.temp/project-ref` (see `docs/STAGING_MIGRATION_AUDIT.md` §0/§4).

### 7.2 Confirmation of the single artifact to apply

**Only `supabase/migrations/20261011090000_studio_projects_and_render_jobs.sql` may be applied to the shared project** — subject to the §5 patches (B1/B2) and the §8 verification passing. No other file in `supabase/migrations/` (35 timestamped + 2 legacy scripts) is to be executed against `bzxohkrxcwodllketcpz`.

Recommended application procedure for the operator (divergent-history safe):
1. Run all of §8; confirm expected results.
2. Apply the file in the Dashboard SQL editor (or `psql`) as a privileged role, **with the §5 patches applied if adopted**.
3. Record the version so the repo's migration table stays in sync (column set varies by CLI version — inspect `supabase_migrations.schema_migrations` first): `insert into supabase_migrations.schema_migrations (version) values ('20261011090000') on conflict do nothing;` `REQUIRES VERIFICATION (no DB access)`.
4. `notify pgrst, 'reload schema';` (or wait for PostgREST's automatic reload) so the 3 new tables are queryable via PostgREST.
5. Deploy the 13 edge functions to the shared project with project secrets bound to `bzxohkrxcwodllketcpz` (`supabase/config.toml:15–22`), then point the frontend (`VITE_SUPABASE_URL`) and render worker (`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`, `render-worker/src/config.ts`) at the shared project.

---

## 8. Pre-apply verification SQL (run against `bzxohkrxcwodllketcpz` BEFORE applying)

Copy-pasteable. **Expected result for every Studio-owned object: absent / 0 rows.** Shared objects: record what exists and its shape; anything unexpected is a stop-and-coordinate moment. All expected values below are the prediction from source analysis — `REQUIRES VERIFICATION (no DB access)` until the operator runs them.

```sql
-- =============================================================
-- Q1. Studio tables must NOT exist (expect 0 rows)
-- =============================================================
select table_schema, table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('studio_projects', 'studio_render_jobs', 'muapi_caption_jobs');
-- expected: 0 rows. Any row => STOP: the Studio migration would CREATE TABLE IF NOT EXISTS
-- against another app's table; rename or coordinate before applying.

-- =============================================================
-- Q2. Buckets: Studio buckets absent; shared buckets recorded
-- =============================================================
select id, name, public, file_size_limit, allowed_mime_types, created_at
from storage.buckets
where id in ('studio-exports', 'studio-uploads', 'videos', 'captions',
             'thumbnails', 'avatars', 'template-logos')
order by id;
-- expected: NO rows for 'studio-exports' / 'studio-uploads'.
-- 'videos': RECORD public flag + limits (Blocker B3). 'captions'/'template-logos':
-- record existence (legacy flows). If 'studio-exports'/'studio-uploads' EXIST:
-- another app owns them (W1) -- do not proceed until renamed/coordinated.

-- =============================================================
-- Q3. Trigger-function names the Studio migration touches (expect 0 rows)
-- =============================================================
select n.nspname as schema, p.proname,
       pg_get_function_identity_arguments(p.oid) as arguments,
       p.prosecdef as security_definer,
       p.proconfig as config,
       pg_get_functiondef(p.oid) like '%NEW.updated_at%' as touches_updated_at
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where p.proname in ('update_updated_at_column', 'immutable_user_id',
                    'subwaytakes_touch_updated_at', 'subwaytakes_immutable_user_id');
-- expected: 0 rows. If 'update_updated_at_column' EXISTS (any schema): Blocker B2 --
-- the Studio migration consumes it (foreign body possible). If 'immutable_user_id'
-- EXISTS: Blocker B1 -- the Studio migration REDEFINES it and overwrites another
-- owner's function. In both cases apply the self-contained patch (section 5).

-- =============================================================
-- Q4. Studio trigger names must NOT exist (expect 0 rows)
-- =============================================================
select tgname, tgrelid::regclass::text as on_table
from pg_trigger
where tgname in ('trg_studio_projects_updated_at', 'trg_studio_render_jobs_updated_at',
                 'trg_muapi_caption_jobs_updated_at',
                 'trg_studio_projects_immutable_user',
                 'trg_studio_render_jobs_immutable_user',
                 'trg_muapi_caption_jobs_immutable_user');
-- expected: 0 rows.

-- =============================================================
-- Q5. Studio policy names must NOT exist (expect 0 rows)
-- =============================================================
select schemaname, tablename, policyname
from pg_policies
where policyname in (
  'studio_projects_select_own', 'studio_projects_insert_own',
  'studio_projects_update_own', 'studio_projects_delete_own',
  'studio_render_jobs_select_own', 'studio_render_jobs_insert_own',
  'studio_render_jobs_update_own', 'studio_render_jobs_delete_own',
  'muapi_caption_jobs_select_own', 'muapi_caption_jobs_insert_own',
  'muapi_caption_jobs_update_own', 'muapi_caption_jobs_delete_own',
  'studio_exports_read_own', 'studio_exports_insert_own',
  'studio_uploads_read_own', 'studio_uploads_insert_own');
-- expected: 0 rows (12 public-table policies + 4 storage.objects policies).

-- =============================================================
-- Q6. Studio index names must NOT exist (expect 0 rows)
-- =============================================================
select schemaname, indexname
from pg_indexes
where schemaname = 'public'
  and indexname in ('idx_studio_projects_user_updated', 'idx_studio_render_jobs_queue',
                    'idx_studio_render_jobs_user', 'uq_studio_render_jobs_active_per_project',
                    'idx_muapi_caption_jobs_project', 'idx_muapi_caption_jobs_user');
-- expected: 0 rows.

-- =============================================================
-- Q7. Platform assumptions: gen_random_uuid + server version
-- =============================================================
select version();                                    -- expect PostgreSQL 15.x (>=13 suffices)
select n.nspname as schema, p.proname
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where p.proname = 'gen_random_uuid';
-- expected: one row in pg_catalog (built-in PG13+). Zero rows => enable pgcrypto
-- and qualify calls; effectively impossible on current Supabase.

-- =============================================================
-- Q8. Storage schema helpers must exist
-- =============================================================
select n.nspname as schema, p.proname
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'storage'
  and p.proname in ('foldername', 'filename', 'extension');
-- expected: at least storage.foldername present (Supabase platform standard).

-- =============================================================
-- Q9. Legacy/shared runtime objects the app still assumes (RECORD, do not act)
-- =============================================================
-- Q9a. Tables
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('user_profiles', 'clips', 'episodes', 'episode_shots', 'episode_scripts',
                     'character_bibles', 'compilations', 'compilation_clips',
                     'video_templates', 'video_exports', 'question_bank', 'music_tracks',
                     'sound_effects', 'prompt_templates', 'prompt_fragments', 'system_prompts',
                     'prompt_generation_logs')
order by table_name;
-- expected for a Studio-only deployment: NONE are required. Record which exist:
-- each existing generic name is legacy-flow surface (verify shape) -- the Studio
-- migration itself needs none of them.

-- Q9b. user_profiles shape (Studio credits path) -- REQUIRED columns:
-- id, display_name, avatar_url, default_city_style, default_duration,
-- credits_balance, subscription_tier, created_at, updated_at
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'user_profiles'
order by ordinal_position;

-- Q9c. RPCs the runtime calls
select n.nspname as schema, p.proname, pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where p.proname in ('deduct_credits', 'reorder_compilation_clips', 'get_analytics_summary',
                    'atomic_deduct_tokens', 'handle_new_user');
-- expected for a Studio-only deployment: none required. Record owners; do NOT
-- create them from this repo's history in the shared project (section 7).

-- =============================================================
-- Q10. auth.users triggers already installed by other apps (RECORD)
-- =============================================================
select tgname,
       tgrelid::regclass::text as on_table,
       p.proname as function_name
from pg_trigger t
join pg_proc p on p.oid = t.tgfoid
where tgrelid = 'auth.users'::regclass and not tgisinternal;
-- expected: record all rows. Confirms whether another app already provisions from
-- auth.users; this repo's on_auth_user_created (20260128195748:71-75) must NOT be
-- replayed here (section 6.5). The Studio migration adds none.

-- =============================================================
-- Q11. Realtime publication membership (optional, latency only)
-- =============================================================
select pubname, schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime' and schemaname = 'public'
order by tablename;
-- expected: 'studio_render_jobs' absent is acceptable -- the client polls every 3s
-- (src/lib/studioProjects.ts:190,232-233). Adding it makes updates instant.

-- =============================================================
-- Q12. SIGN-OFF summary (pre-apply expected: 0 / 0 / 0 / 0)
-- =============================================================
select
  (select count(*) from information_schema.tables
     where table_schema = 'public'
       and table_name in ('studio_projects','studio_render_jobs','muapi_caption_jobs')) as studio_tables,
  (select count(*) from storage.buckets
     where id in ('studio-exports','studio-uploads')) as studio_buckets,
  (select count(*) from pg_proc
     where proname in ('update_updated_at_column','immutable_user_id')) as shared_trigger_functions,
  (select count(*) from pg_policies
     where policyname like 'studio%') as studio_policies;

-- =============================================================
-- Post-apply sanity (run AFTER the single migration is applied)
-- =============================================================
select has_table_privilege('anon', 'studio_projects', 'INSERT')   as anon_can_insert;  -- expect false
select has_table_privilege('anon', 'studio_render_jobs', 'UPDATE') as anon_can_update; -- expect false
select count(*) as studio_policies_live from pg_policies where policyname like 'studio%';  -- expect 16
```

---

## 9. Operator checklist (mapped to the mission's Phase 1 items)

### 9.1 Dependencies
- [ ] Q3 executed: `update_updated_at_column` and `immutable_user_id` inventory recorded; owner schema noted. `REQUIRES VERIFICATION (no DB access)`
- [ ] Q7/Q8 executed: `gen_random_uuid()` in `pg_catalog`, `storage.foldername()` present.
- [ ] If adopting self-containment: §5.1/§5.2 patches applied to the migration so it defines `subwaytakes_touch_updated_at()` and `subwaytakes_immutable_user_id()` and references nothing from our 37-file history.
- [ ] FK assumption confirmed: Studio migration references only platform-built-ins after patching (`auth.users`, `storage.*`, `auth.uid()`).

### 9.2 Naming conflicts
- [ ] Q1 executed: the 3 Studio table names are free (0 rows).
- [ ] Q3 executed: no foreign `immutable_user_id()` will be overwritten — if one exists, B1 patch is **mandatory before apply**.
- [ ] Q4/Q5/Q6 executed: no Studio trigger/policy/index names pre-exist.
- [ ] Generic-name inventory reviewed (§4): `update_updated_at_column`, `immutable_user_id`, `user_profiles`, `deduct_credits`, `handle_new_user`, `on_auth_user_created` — every occurrence must be treated as another app's until proven otherwise.

### 9.3 Storage conflicts
- [ ] Q2 executed: `studio-exports`/`studio-uploads` absent; if present, rename to `subwaytakes-*` (migration `:233–259`, `render-worker/src/config.ts:67`, `src/lib/studioProjects.ts:30`) before apply (W1).
- [ ] **Blocker B3 decision recorded:** `videos` bucket existence, `public` flag, `file_size_limit`, `allowed_mime_types` — either verified compatible for `studio-scenes/…` + `studio-captions/…` uploads, or Studio code repointed to `studio-exports` (`scene-status/index.ts:118–135`, `muapi-captions/index.ts:114–122`).
- [ ] Legacy buckets recorded: `captions`, `template-logos`, `thumbnails`, `avatars` (legacy flows only).
- [ ] Storage policy namespace reviewed: 4 new policies on `storage.objects` are studio-prefixed; no same-named foreign policy (part of Q5).
- [ ] W5 accepted or fixed: storage policies grant SELECT+INSERT only while browser uploads use `upsert: true` (`src/lib/studioProjects.ts:144`) — test one browser upload post-apply; add an UPDATE policy pair if upsert-over-existing fails.

### 9.4 Auth assumptions
- [ ] Anonymous sign-ins ENABLED on `bzxohkrxcwodllketcpz` (`src/lib/auth.tsx:98–106`). `REQUIRES VERIFICATION (no DB access)`
- [ ] Edge functions deployed to the shared project with `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` bound to `bzxohkrxcwodllketcpz` (`supabase/functions/_shared/auth.ts:15–21,:34–75`); frontend `VITE_SUPABASE_URL` and worker env point at the same project.
- [ ] Q10 executed: existing `auth.users` triggers recorded; confirmed this deployment adds **none** (Studio migration has zero; history's `on_auth_user_created` must not be replayed — §6.5).
- [ ] Credential hygiene: staging/production keys for the shared project are the shared project's own keys; no reuse of the historical production ref `orcosohomdugkfcgydwj` (`supabase/config.toml:10–13`, `docs/STAGING_MIGRATION_AUDIT.md` §4).

### 9.5 History risks
- [ ] Confirmed: **only** `20261011090000_studio_projects_and_render_jobs.sql` is applied; none of the other 36 files (35 timestamped + `COMPLETE_MIGRATION.sql`/`STORAGE_SETUP.sql`) is executed against the shared project (§7.2).
- [ ] Destructive history statements reviewed and excluded: drop-all-policies loop (`20260225065651:38–49`), anon `USING(true)` restoration (`20260222183424:19–93`), `DROP TYPE age_group CASCADE` + `UPDATE clips` (`20260203194600:8,:18`), index/policy drops (`20260226105754:153–168`, `20260223034719`), bucket/policy attach (`20260128195748:78–83`), `auth.users` provisioning trigger (`20260128195748:59–75`).
- [ ] Application method chosen for the divergent history: manual SQL-editor/`psql` apply of the single file, then optional `supabase_migrations.schema_migrations` version row, then `notify pgrst, 'reload schema';` (§7.2).
- [ ] Rollback plan understood for the shared DB: never restore/replace shared-name functions; drop only Studio-prefixed objects (§5.2).

---

### Evidence index (files cited in this report)

- `supabase/migrations/20261011090000_studio_projects_and_render_jobs.sql` (the sole artifact to apply)
- `supabase/migrations/20260226110220_rls_policies.sql` (`immutable_user_id` original, `:103–115`)
- `supabase/migrations/20260226105754_production_integrity.sql` (index cleanup, `:153–168`)
- `supabase/migrations/20260203190000_add_age_appropriate_content.sql` (`update_updated_at_column`, `:131–137`)
- `supabase/migrations/20260128195748_add_user_profiles_and_storage.sql` (`user_profiles`, buckets, `auth.users` trigger)
- `supabase/migrations/20260127032356_create_clips_table.sql`, `20260127222728_create_episode_system.sql`, `20260220223213_add_compilations_system.sql`, `20260222113516_add_prompt_management_system.sql`, `20260222124952_add_atomic_credit_deduction.sql`, `20260222201230_add_atomic_token_deduction_rpc.sql`, `20260223172226_add_batch_reorder_rpc.sql`, `20260223225526_add_analytics_aggregation_rpc.sql`, `20260225065651_harden_rls_policies.sql`, `20260222183424_restore_anon_policies_for_guest_mode.sql`, `20260203194600_update_age_groups.sql`, `COMPLETE_MIGRATION.sql`, `STORAGE_SETUP.sql`
- `supabase/config.toml`; `docs/STAGING_MIGRATION_AUDIT.md` (isolated-project audit cross-reference)
- `src/lib/auth.tsx`, `src/lib/studioProjects.ts`, `src/lib/edgeFunctions.ts`, `src/lib/clips.ts`, `src/lib/episodes.ts`, `src/lib/scriptEngine.ts`, `src/lib/characters.ts`, `src/lib/compilations.ts`, `src/lib/templates.ts`, `src/lib/promptAdmin.ts`, `src/lib/questionBank.ts`, `src/lib/ffmpeg.ts`, `src/hooks/useRealtimeStatus.ts`, `src/studio/types.ts`, `src/pages/DashboardPage.tsx`, `src/pages/AnalyticsPage.tsx`, `src/components/EnhancementPanel.tsx`, `src/components/QuestionInput.tsx`
- `supabase/functions/_shared/auth.ts`, `supabase/functions/_shared/ownership.ts`, and the 13 edge functions (`render-project`, `scene-status`, `generate-scene`, `muapi-captions`, `secure-clips-api`, `stitch-clips`, `stitch-episode`, `compose-overlay`, `generate-video`, `process-video`, `build-prompt`, `generate-script`, `plan-interview`)
- `render-worker/src/storage.ts`, `render-worker/src/config.ts`

---

# AMENDMENT 2026-10-12 — migration corrected and validated (this section supersedes stale names above)

**Status:** Blockers B1 and B2 from §1 are **RESOLVED**. The Studio migration was rewritten per the shared-DB hardening requirements and then **validated against a real PostgreSQL 14 instance** (38/38 RLS/behaviour tests, 44/44 static compatibility checks, idempotency + coexistence + rollback all proven — full evidence in `docs/RLS_TEST_EVIDENCE.md`). **No migration defects were found.**

Where the sections above reference pre-hardening object names (e.g. §2's `idx_studio_*`, `trg_studio_*_updated_at`, `subwaytakes_touch_updated_at()`, `subwaytakes_immutable_user_id()` in §5.1/§5.2), **the names below are authoritative**. The analysis (dependencies, conflicts, risks, pre-apply verification SQL in §8) remains valid.

## A.1 Definitive object inventory created by `20261011090000` (validated names)

| Kind | Count | Objects |
|---|---|---|
| Tables | 3 | `public.studio_projects`, `public.studio_render_jobs`, `public.muapi_caption_jobs` |
| Functions (all `SECURITY INVOKER`, `SET search_path = ''`) | 3 | `public.subwaytakes_set_updated_at()`, `public.subwaytakes_guard_immutable_user_id()`, `public.subwaytakes_guard_job_writes()` |
| Table indexes | 6 | `subwaytakes_idx_studio_projects_user_updated`, `subwaytakes_idx_studio_render_jobs_queue`, `subwaytakes_idx_studio_render_jobs_user`, `subwaytakes_uq_studio_render_jobs_active_per_project`, `subwaytakes_idx_muapi_caption_jobs_project`, `subwaytakes_idx_muapi_caption_jobs_user` |
| Triggers | 8 | `trg_*_subwaytakes_updated_at` (×3) → `subwaytakes_set_updated_at()`; `trg_*_subwaytakes_immutable_user` (×3) → `subwaytakes_guard_immutable_user_id()`; `trg_studio_render_jobs_subwaytakes_guard_job_writes`, `trg_muapi_caption_jobs_subwaytakes_guard_job_writes` → `subwaytakes_guard_job_writes()` |
| Table policies | 6 | `studio_projects`: `subwaytakes_studio_projects_select_own` / `_insert_own` / `_update_own` / `_delete_own` (full owner CRUD — the editor saves directly). `studio_render_jobs`: `subwaytakes_studio_render_jobs_select_own` **(SELECT only)**. `muapi_caption_jobs`: `subwaytakes_muapi_caption_jobs_select_own` **(SELECT only)** |
| Storage policies (on `storage.objects`) | 4 | `subwaytakes_studio_exports_read_own`, `subwaytakes_studio_exports_insert_own`, `subwaytakes_studio_uploads_read_own`, `subwaytakes_studio_uploads_insert_own` |
| Buckets | 2 | `studio-exports` (private), `studio-uploads` (private) — created with `INSERT ... WHERE NOT EXISTS`, existing settings untouched |
| Grants | — | No new GRANTs; `REVOKE INSERT, UPDATE, DELETE ... FROM anon` retained (validated: `anon` retains SELECT only) |

## A.2 What changed vs. the pre-amendment draft (all 10 hardening requirements)

1. RLS + per-owner SELECT on all three tables.
2. Job tables are **service-role-write-only**: no client INSERT/UPDATE/DELETE policies (jobs are created by the `render-project` / `muapi-captions` edge functions with the service role; updated by the render worker).
3. **Defense-in-depth guard** `public.subwaytakes_guard_job_writes()` (BEFORE INSERT OR UPDATE on both job tables) raises `subwaytakes: render/caption job writes are restricted to service-role context` for any non-service-role writer that changes server-owned columns (status, output_url, user_id, project_snapshot, progress, …). Validated: client INSERT → exception; client UPDATE → 0 rows/exception; service-role INSERT/UPDATE/heartbeat → success.
4. Caption jobs use the identical guard.
5. **No shared function is touched** — validated with decoy functions: md5(pg_get_functiondef) of pre-existing `update_updated_at_column` and `immutable_user_id` unchanged after apply.
6. All new functions/triggers/indexes/policies are `subwaytakes_*`-scoped (B1 fixed).
7. Bucket names unchanged and creation is non-destructive (B2 fixed: `subwaytakes_set_updated_at()` is defined in-file, so the migration depends on **zero** functions from this repo's history).
8. Every object explicitly schema-qualified.
9. Fully idempotent — re-apply exits 0 with an identical object inventory (validated).
10. No anon write grants.

## A.3 Corrected rollback SQL (supersedes §5.2 — the old names do not exist)

Run as `postgres` on the shared project **only with explicit authorization**:

```sql
-- 1. storage policies (on storage.objects)
DROP POLICY IF EXISTS "subwaytakes_studio_exports_read_own"   ON storage.objects;
DROP POLICY IF EXISTS "subwaytakes_studio_exports_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "subwaytakes_studio_uploads_read_own"   ON storage.objects;
DROP POLICY IF EXISTS "subwaytakes_studio_uploads_insert_own" ON storage.objects;

-- 2. tables (policies, triggers and indexes drop with them)
DROP TABLE IF EXISTS public.muapi_caption_jobs;
DROP TABLE IF EXISTS public.studio_render_jobs;
DROP TABLE IF EXISTS public.studio_projects;

-- 3. buckets (leave in place if another deployment stage already re-used them)
DELETE FROM storage.buckets WHERE id IN ('studio-exports', 'studio-uploads');

-- 4. SubwayTakes-specific functions (safe: no other app can own these names)
DROP FUNCTION IF EXISTS public.subwaytakes_guard_job_writes();
DROP FUNCTION IF EXISTS public.subwaytakes_guard_immutable_user_id();
DROP FUNCTION IF EXISTS public.subwaytakes_set_updated_at();
```

Validated: after rollback, all studio object counts are 0, the shared decoy functions and pre-existing app tables survive untouched, and re-applying the migration reproduces the identical inventory with the test suite green.

## A.4 Remaining open items (from §1) that are documentation/ops, not migration

- **B3 (residual)**: the Studio edge functions `scene-status` and `muapi-captions` upload generated scenes/captioned videos to the **shared `videos` bucket** under SubwayTakes-scoped paths (`studio-scenes/<user>/…`, `studio-captions/<user>/…`). This is intentional reuse of the existing public bucket (the Remotion player fetches these URLs directly) and is namespaced so it cannot collide with other apps' objects. If the shared `videos` bucket is private or absent in the target project, these two functions must be repointed at `studio-exports` + signed URLs — flagged for the operator, requires a live check (`REQUIRES VERIFICATION (no DB access)`).
- Run §8's pre-apply verification SQL against `bzxohkrxcwodllketcpz` before applying; all queries must return absent/0 rows.
