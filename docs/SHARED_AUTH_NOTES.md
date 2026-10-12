# Shared-Supabase Auth & Data Notes

**App:** SubwayTakes (branch `feat/subway-interview-studio`)
**Supabase project:** `bzxohkrxcwodllketcpz` — *"VideoRemix Product"* — **shared with other applications**
**Author's constraint:** no direct database access. Every client path below is written defensively and
must never assume the live schema.

This document records (1) how a user identity is established, (2) the `user_profiles` provisioning
hardening added to `src/lib/auth.tsx`, (3) a full dependency map split into **Studio-owned** vs
**shared/legacy** objects, (4) pre-deploy verification SQL for the operator, and (5) remaining risks.

---

## 1. Identity resolution

The app has exactly one entry point for identity — `AuthProvider` in `src/lib/auth.tsx`. There is no
custom auth server, no service-role usage in the browser, and no direct writes to `auth.users`.

### 1.1 Resolution sequence

```
mount AuthProvider (initializedRef guards a single boot)
  └─ supabase.auth.getSession()
       ├─ session exists ──► applySession(session)
       └─ no session ──────► supabase.auth.signInAnonymously()
                               ├─ ok ──► onAuthStateChange(SIGNED_IN, session) ──► applySession(session)
                               └─ err ─► applySession(null)  → unauthenticated
  └─ supabase.auth.onAuthStateChange(...) ──► applySession(session) on every auth event
```

`applySession` (`src/lib/auth.tsx:147`):

1. `setSession(s)` / `setUser(s?.user ?? null)`.
2. `setCurrentAuthUser(authUser.id)` — stores the UUID in the module-level `_currentAuthUserId`.
3. `fetchProfile(authUser.id).finally(() => setLoading(false))` — the `loading` flag stays `true`
   until the profile read/upsert settles, so `ProtectedRoute`/`AppShell` (`src/App.tsx:51`, `:74`)
   never render before an identity exists.
4. With no user: `setCurrentAuthUser(null)`, `setProfile(null)`, `setLoading(false)`.

`getUserId()` (`src/lib/auth.tsx:238`) throws `Not authenticated` when the module-level id is
missing. `studioProjects.authedUserId()` (`src/lib/studioProjects.ts:36`) wraps it into a user-facing
message: *"Not authenticated — sign in before you can create a project"*.

### 1.2 The Studio sends the user JWT to edge functions

`src/lib/edgeFunctions.ts:19` `callEdgeFunction(name, body)`:

```ts
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token ?? SUPABASE_ANON_KEY;   // anon key is only a last-resort fallback
fetch(`${SUPABASE_URL}/functions/v1/${name}`, { headers: { Authorization: `Bearer ${token}` } , ...})
```

Every Studio backend round-trip uses this helper — `render-project`, `generate-scene`,
`scene-status`, `muapi-captions`, `plan-interview` (see `src/lib/studioProjects.ts:168`, `:296`,
`:317`, `:370`, `:441`). The edge functions resolve the caller from the verified JWT
(`getUser(token)`), then re-check ownership server-side through `_shared/ownership.ts`
(`assertProjectOwnership` → 404 on both "missing row" and "row owned by somebody else"), so a
missing/anonymous caller can never read another tenant's project.

Legacy `clips.ts` / `episodes.ts` / `compilations.ts` / `templates.ts` call the same class of
functions with the same helper (`getAuthToken()` in `src/lib/supabase.ts:12`).

### 1.3 `studio_projects.user_id` is `auth.uid()`

* Client side: `createProject` (`src/lib/studioProjects.ts:70`) inserts `user_id: authedUserId(...)`,
  i.e. the value written by `setCurrentAuthUser(authUser.id)`, which comes from the session.
* Database side: `studio_projects.user_id uuid NOT NULL REFERENCES auth.users(id)`, with RLS
  policies `auth.uid()::text = user_id::text` for SELECT/INSERT/UPDATE/DELETE and a `user_id`
  immutability trigger (migration `supabase/migrations/20261011090000_studio_projects_and_render_jobs.sql`).
  The same shape is used by `studio_render_jobs` and `muapi_caption_jobs`.
* Server side: the `render-project` edge function re-reads the project row with the service-role
  client and copies `user_id` from that row into the render job, so the worker never trusts a
  client-supplied owner.

### 1.4 No code path creates `auth.users` rows or global auth triggers

Verified by grepping `src/` and `supabase/functions/`:

| Search | Result |
| --- | --- |
| `auth.admin.createUser` / `admin.createUser` | none |
| raw SQL / DDL from the browser | none — the client only speaks PostgREST + GoTrue |
| `signInAnonymously` | exactly one call site: `src/lib/auth.tsx:151` |
| auth API used | `getSession`, `signInAnonymously`, `onAuthStateChange`, `signUp`, `signInWithPassword`, `signOut` |

Auth rows are created **only** by Supabase GoTrue (server-side) as a side effect of
`signInAnonymously()` / `signUp()`. The only `auth.users` DDL in the repository is the *legacy*
migration `20260128195748_add_user_profiles_and_storage.sql`, which attaches a global trigger
`on_auth_user_created` → `public.handle_new_user()` that inserts `(id, display_name)` into
`user_profiles`. That is SQL applied out-of-band by a migration (not a code path, and not owned by
this change) — see *Risks* §5.3.

### 1.5 Anonymous users work normally

`signInAnonymously()` creates a **real `auth.users` row** and a **real session** whose JWT carries
role `authenticated` plus `is_anonymous: true`. Consequences:

* `auth.uid()` resolves to the anonymous user's UUID, so `studio_projects.user_id` ownership and the
  `TO authenticated` RLS policies on the Studio tables all work exactly as for email users.
* The Studio tables grant DML to `authenticated` only (anon DML is revoked as defence in depth),
  which anonymous sessions satisfy.
* `isGuest` (`!!user?.is_anonymous`) is only a UI affordance — e.g. a "guest" label; it does not
  change any database permission.

---

## 2. `user_profiles` provisioning hardening

### 2.1 Before

```ts
const { data, error } = await supabase.from('user_profiles').select('*').eq('id', userId).maybeSingle();
if (error || !data) {
  const { data: newProfile } = await supabase.from('user_profiles')
    .upsert({ id: userId, credits_balance: 100, subscription_tier: 'free',
              default_city_style: 'nyc', default_duration: 6 }, { onConflict: 'id' })
    .select().maybeSingle();
  setProfile(newProfile);        // errors ignored → silently null on a schema mismatch
} else { setProfile(data); }
```

In a shared database `user_profiles` may exist with a **different column set**. The full upsert then
fails with a PostgREST 400 (`PGRST204` "Could not find the 'credits_balance' column of
'user_profiles' in the schema cache" or `42703` undefined column). The failure was swallowed: no
throw, no log, `profile` became `null` — survivable, but it silently broke the credits display and
gave operators nothing to debug with.

### 2.2 After (`src/lib/auth.tsx`)

`fetchProfile` now runs a three-step ladder:

1. **Read** `select('*').maybeSingle()` — a row means the user already has a profile (possibly
   auto-created by the legacy `on_auth_user_created` trigger); `setProfile(data)`, done.
2. **Full upsert** (`{ id, credits_balance: 100, subscription_tier: 'free', default_city_style: 'nyc',
   default_duration: 6 }`, `onConflict: 'id'`, then `.select().maybeSingle()`) — byte-identical to the
   old payload. On success `setProfile(data ?? null)` — identical to the old `setProfile(newProfile)`.
3. **Minimal upsert** (`{ id }` only) — succeeds when the row is absent and the shared table's
   remaining columns either do not exist or carry their own defaults. The returned row (whatever
   columns the shared table has) becomes the profile.
4. **Give up**: `setProfile(null)` and emit **one** `console.warn` (guarded by a module-level flag so
   repeated sign-ins/sign-outs cannot spam the console) naming the shared-schema drift and the
   underlying Postgres error message.

A thrown exception (network failure, aborted request) still falls into the pre-existing
`try/catch { setProfile(null) }` branch, exactly as before.

### 2.3 Behaviour preservation

* **Current (App-owned) schema** — unchanged, byte for byte: the same read, the same upsert payload,
  the same `setProfile` results. The extra `{ id }` round-trip only happens when the full payload is
  rejected, which cannot occur on the schema this repo creates
  (`supabase/migrations/20260128195748_add_user_profiles_and_storage.sql`).
* **No other behaviour changed**: `refreshProfile`, `updateProfile`, `deductCredits`, sign-up /
  sign-in / sign-out, the `loading` flag, and every other consumer are untouched.
* Downstream consumers already treat a missing profile as "no credits" with optional chaining
  (`profile?.credits_balance ?? 0` in `AppShell.tsx:100`, `ClipPage.tsx:331`,
  `SettingsPage.tsx:106-111`), so the app renders normally while `profile === null`.

`src/lib/supabase.ts` needed **no change**: it only builds the anon-key client and returns the
current session's access token, both of which are correct and schema-independent.

---

## 3. Dependency map

Scope: every table, storage bucket and RPC referenced from `src/` (client) and
`supabase/functions/` (Studio backend). "Studio flow" = the Subway Interview Studio editor:
**create → upload footage → edit timeline → AI scenes → captions → render → download**.

### 3.1 STUDIO-ONLY (created by our migration `20261011090000_studio_projects_and_render_jobs.sql`)

| Object | Columns used by the client | Consumed by | Studio flow needs it? | If missing |
| --- | --- | --- | --- | --- |
| `studio_projects` | `id`, `user_id`, `title`, `project`, `version`, `created_at`, `updated_at` | `src/lib/studioProjects.ts` (create/load/save), `render-project`, `scene-status`, render worker | **Yes — core** | `createProject` throws a clear error; editor shows *"Could not open this project"*. No silent breakage. |
| `studio_render_jobs` | `id`, `user_id`, `project_id`, `status`, `progress`, `output_url`, `captioned_output_url`, `error`, `worker_id`, `project_snapshot`, `render_settings`, `created_at`, `updated_at` | `studioProjects.loadLatestRenderJob` / `watchRenderJob`, `useStudioRender`, `CaptionPanel`, `ExportPanel` | **Yes — render + download** | Enqueue/watch fail with a readable message; the Export panel reports the error. |
| `muapi_caption_jobs` | all columns (server-side only) | `muapi-captions` edge function | **Yes — captions** (never queried from the browser) | Caption submit/status fail with the edge function's error text. |
| Bucket `studio-uploads` (private) | `uploadPath`, `createSignedUrl(path, 10y)` | `studioProjects.uploadFootage` | **Yes — upload footage** | Upload panel reports *"Upload failed"*. |
| Bucket `studio-exports` (private) | worker-side upload + signing; `output_url` handed to the client | render worker (`render-worker/src/storage.ts`), `render-project` | **Yes — render output** | Render job ends in `error`; download link never appears. |

### 3.2 SHARED / LEGACY (pre-existing tables, buckets and RPCs)

| Object | Written / read | Consumed by | Studio flow needs it? | If missing / different |
| --- | --- | --- | --- | --- |
| `user_profiles` (`id`, `display_name`, `avatar_url`, `default_city_style`, `default_duration`, `credits_balance`, `subscription_tier`, `created_at`, `updated_at`) | `select('*')`, `upsert`, `update`; `credits_balance` read via `deduct_credits` | `src/lib/auth.tsx` (read + provision), `AppShell.tsx` (credits + tier), `SettingsPage.tsx`, `DashboardPage.tsx`, `ClipPage.tsx` | **No** | Credentials display degrades to `0 credits` / `free`; Settings profile edit reports an error. **The Studio editor never reads it** — hardened by §2. |
| `clips` (~40 columns incl. `user_id`, `status`, `result_url`, `provider_prompt`, `template_id`, `effects`, `batch_id`…) | insert / update / select / delete, scoped `user_id` | `src/lib/clips.ts`, `compilations.ts`, `templates.ts`, `DashboardPage`, `useRealtimeStatus`, `generate-video`/`compose-overlay` | **No** | All *legacy* clip creation, library, dashboard and compilation-creation flows break. Studio unaffected. |
| `episodes` | insert / update / select / delete, scoped `user_id`; embedded `script:episode_scripts(*)`, `character_bibles` FKs | `src/lib/episodes.ts`, `templates.ts`, `DashboardPage` | **No** | Legacy episode builder/detail/analytics break. Studio unaffected. |
| `episode_shots` | insert / update / select (`episode_id`, `status`, `provider_prompt`, `dialogue`, `sequence`) | `src/lib/episodes.ts`, `useRealtimeStatus` | **No** | Legacy episode generation breaks. Studio unaffected. |
| `episode_scripts` | insert / select / update | `src/lib/scriptEngine.ts`, `episodes.ts` | **No** | Legacy script generation/history breaks. Studio unaffected. |
| `character_bibles` | select / upsert | `src/lib/characters.ts`, `episodes.ts` | **No** | Legacy host/guest character lookups fall back to defaults or fail. Studio unaffected. |
| `compilations` + `compilation_clips` | insert / update / select / delete, scoped `user_id`; `overlay_status` | `src/lib/compilations.ts`, `useRealtimeStatus` | **No** | Legacy compilations UI breaks. Studio unaffected. |
| `video_templates` | select / insert / update (`is_system`, `is_default`, `logo_url`) | `src/lib/templates.ts` | **No** | Template manager and template pickers break. Studio unaffected. |
| `video_exports` | select | `src/lib/templates.ts`, `useRealtimeStatus` | **No** | Exports list breaks. Studio unaffected. |
| `prompt_templates`, `prompt_fragments`, `system_prompts` | select / insert / update | `src/lib/promptAdmin.ts`, `build-prompt` edge function | **No** | Prompt admin + backend prompt building degrade (client falls back to the local prompt engine). Studio's `plan-interview` builds its own script and does not read these. |
| `question_bank` | select | `src/lib/questionBank.ts`, `QuestionInput.tsx` | **No** | Question-bank suggestions are empty/erroring. Studio unaffected. |
| `music_tracks`, `sound_effects` | select | enhancement / audio pickers | **No** | Audio pickers empty. Studio's preset tracks are local (`studio/interviewPreset.ts`). |
| Bucket `videos` (shared) | upload + `getPublicUrl` | `supabase/functions/scene-status`, `supabase/functions/muapi-captions`, legacy `src/lib/ffmpeg.ts` | **Yes — partially** (AI scene generation and MuAPI styled/editable outputs are stored here) | Edge function returns a clear error (*"Failed to store generated scene"*); the editor stays usable for uploaded footage + render. Only the AI-generated-asset path needs it. |
| Buckets `thumbnails`, `avatars`, `template-logos` | public URL / upload | legacy `ffmpeg.ts`, `templates.ts`, `SettingsPage` avatar | **No** | Avatar/logo/thumbnail features break. Studio unaffected. |
| RPC `deduct_credits(p_user_id, p_amount)` | `auth.deductCredits` | `src/lib/auth.tsx:204` | **No** (returns `false` → UI blocks the paid action) | Credit-deducting actions refuse to run. Studio rendering is not credit-gated in the client. |
| RPC `reorder_compilation_clips(p_compilation_id, p_ordered_clip_ids)` | `src/lib/compilations.ts:206` | legacy compilations | **No** | Compilation re-ordering fails. |
| RPC `get_analytics_summary(p_range_start, p_prev_start, p_prev_end)` | `src/pages/AnalyticsPage.tsx:68` | analytics page | **No** | Analytics page shows an error / zeros. |

### 3.3 Conclusion

The **Studio editor flow** depends only on:

* `studio_projects`, `studio_render_jobs`, `muapi_caption_jobs` (our migration),
* buckets `studio-uploads` and `studio-exports` (our migration),
* the shared `videos` bucket for *AI-generated* scene assets and MuAPI outputs (degrades to a clear
  per-action error, never a crash),
* `user_profiles` **only** for the credits chip, which is now defensive and non-blocking.

Every other shared/legacy object is reachable from the legacy Clip / Episode / Compilation /
Template / Analytics pages — none of which the Studio editor imports (`src/pages/studio/*` and
`src/components/studio/*` import only `lib/studioProjects`, `hooks/useStudioProject`,
`studio/*`, `lib/studioReducer` and `studio/interviewPreset`). The Studio therefore works even if
every legacy table is missing or has a different shape.

---

## 4. Operator verification (run before deploy)

Execute in the **shared** project's SQL editor (`bzxohkrxcwodllketcpz`).

**4.1 Does `user_profiles` exist, and with which columns?**

```sql
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'user_profiles'
order by ordinal_position;
```

Expected for the App-owned schema: `id`, `display_name`, `avatar_url`, `default_city_style`,
`default_duration`, `credits_balance`, `subscription_tier`, `created_at`, `updated_at`.
If the list differs, note which of the upsert columns (`credits_balance`, `subscription_tier`,
`default_city_style`, `default_duration`) are absent — the client will fall back to `{ id }` and log
one `console.warn`, which is the expected, non-fatal outcome.

**4.2 Which columns are NOT NULL without a default?** (these can break even the `{ id }` insert)

```sql
select column_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'user_profiles'
  and is_nullable = 'NO'
  and column_default is null;
```

**4.3 RLS policies on `user_profiles`** (the client inserts as the signed-in user)

```sql
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'user_profiles'
order by policyname;
```

**4.4 Legacy global auth trigger** (does the shared DB auto-create profiles on sign-up?)

```sql
select tgname, tgrelid::regclass as on_table
from pg_trigger
where tgrelid = 'auth.users'::regclass and not tgisinternal;
```

**4.5 Studio-owned objects present?**

```sql
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in ('studio_projects', 'studio_render_jobs', 'muapi_caption_jobs')
order by table_name;

select id, public from storage.buckets
where id in ('studio-uploads', 'studio-exports', 'videos', 'thumbnails', 'avatars', 'template-logos')
order by id;

select proname from pg_proc
where proname in ('deduct_credits', 'reorder_compilation_clips', 'get_analytics_summary', 'update_updated_at_column')
order by proname;
```

`update_updated_at_column` must exist or the Studio migration's `BEFORE UPDATE` triggers fail.

**4.6 Runtime smoke test (no SQL access needed)**

1. Open the app in a fresh incognito window (guest path: `signInAnonymously`).
2. DevTools → Console: expect **no** `user_profiles` warning; if one appears, the shared table is
   drifting — the credits chip will read `0 credits`, everything else still works.
3. DevTools → Network: confirm `user_profiles` requests and `functions/v1/render-project` calls carry
   `Authorization: Bearer eyJ…` (an access token, not the anon key).
4. `/studio/new` → create a project → upload a clip → edit → **Export MP4** → poll for a download
   link. If this works, the Studio path is healthy regardless of legacy table state.

---

## 5. Remaining risks

1. **`videos` bucket is shared and required by AI scenes / MuAPI captions.** `scene-status` and
   `muapi-captions` upload generated MP4s there and use `getPublicUrl`, so the bucket must exist
   and be public-readable for the Studio's AI-scene and styled-caption outputs. Missing bucket ⇒
   per-action 500 with a clear message; uploaded-footage rendering is unaffected. If storage quota
   is exhausted app-wide, only this path fails.
2. **`user_profiles` column drift degrades credits UI.** With different columns, `profile` may be a
   row without `credits_balance` / `subscription_tier`. `AppShell`, `ClipPage` and `SettingsPage`
   already read them with `?? 0` / `|| 'free'` fallbacks; `DashboardPage.tsx:148` reads
   `profile.credits_balance` directly and will render `undefined` in the token widget. `deductCredits`
   still works server-side (it just calls the RPC), so no paid action silently succeeds without
   server validation.
3. **Legacy `on_auth_user_created` trigger on `auth.users`.** Migration
   `20260128195748_add_user_profiles_and_storage.sql` installs a *global* trigger that inserts
   `(id, display_name)` into `user_profiles` on every sign-up — including anonymous sign-ups — and
   it does `DROP TRIGGER IF EXISTS on_auth_user_created` first, so in a shared database it can
   collide with or overwrite another application's signup automation. Client code never relies on
   it (the upsert ladder covers the no-row case), but the migration is owned by another agent and
   should be reconciled with the shared project's owner before deploy.
4. **Anonymous sign-ins must be enabled** in the shared project's Auth settings (Authentication →
   Providers → Anonymous). If disabled, `signInAnonymously` errors, `applySession(null)` runs, and
   the Studio reports *"Not authenticated — sign in before you can create a project"* instead of a
   blank screen.
5. **Studio tables must exist.** `studio_projects` / `studio_render_jobs` / `muapi_caption_jobs` and
   the `studio-uploads` / `studio-exports` buckets come from migration
   `20261011090000_studio_projects_and_render_jobs.sql` (and it needs `update_updated_at_column()`
   from an earlier migration). Without them, every Studio call fails with a readable PostgREST error
   surfaced through `describeError` / `isAccessDenied` — no silent data loss, but no Studio either.
6. **Realtime publication.** `studio_render_jobs` is watched via `postgres_changes`; if the table is
   not in the `supabase_realtime` publication, `watchRenderJob`'s 3s poll still advances the UI
   (`src/lib/studioProjects.ts:199`), so progress is eventually consistent at worst.
7. **Shared-table name collisions beyond `user_profiles`.** If another app owns `clips`,
   `episodes`, `compilations`, … with different columns, the *legacy* pages in this app will surface
   per-feature errors. That is expected and out of scope here: the Studio editor does not import any
   of those modules.
