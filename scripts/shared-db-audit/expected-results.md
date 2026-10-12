# Expected Results & GO/NO-GO — Shared DB Live Audit

**Target:** shared Supabase project `bzxohkrxcwodllketcpz` ("VideoRemix Product")
**Branch:** `feat/subway-interview-studio` · **Migration under audit:** `supabase/migrations/20261011090000_studio_projects_and_render_jobs.sql`
**Companion files:** `scripts/shared-db-audit/01_readonly_queries.sql` (queries), `scripts/shared-db-audit/run_audit.sh` (runner), `docs/SHARED_DB_AUDIT_PLAN.md` (plan + conflict matrix + how to read results).

## How expected values were produced

Every expectation below is the prediction from static source analysis **and** was validated two ways against a local PostgreSQL 14 "mock shared DB" (real PG14, mock `auth`/`storage`/`supabase_migrations`, decoy shared functions, a `user_profiles`/`clips` pair, a global `on_auth_user_created` trigger, and a public `videos` bucket):

- **Clean shared-DB state (no Studio objects)** → conflict probe **Q11 = `0,0,0,0,0,0,0`**, all of Q4–Q10 empty, Q23 `table_exists=f`.
- **After applying the real Studio migration** → **Q11 = `3,6,8,3,6,4,2`** (3 tables · 6 indexes · 8 triggers · 3 functions · 6 table policies · 4 storage policies · 2 buckets) and Q4/Q7/Q10 populate. That flip in both directions proves the probes detect real conflicts (no false negatives).

Task reminder: statements about the *live* shared DB remain `REQUIRES VERIFICATION (no DB access)` until an operator runs the kit; this environment has no credentials and the kit is never executed here.

## Legend

- **Conflict probes = Q4..Q11.** Expected **absent / zero**. One row ANYWHERE is a STOP condition.
- **Q1..Q3** describe the environment and prove the live migration history diverges from this repo.
- **Q12..Q24** are informational / coexistence checks — record, do not act, unless a GO criterion depends on them.

---

## Per-query expectations

### Q1 — Environment and platform fingerprint
- **Proves:** PostgreSQL version, database name, current user/role, and whether this is really a Supabase-managed instance (`auth` + `storage` + `supabase_migrations` schemas present).
- **Expected:** one row. On Supabase `postgres_version` = **`PostgreSQL 15.x`**, `server_major_version` = **15**, `supabase_managed_likely` = **`t`**, `current_user` = `postgres` (or `service_role`).
- **Signal:** `supabase_managed_likely = f` ⇒ **STOP** — this is not a Supabase instance; the rest of the kit assumes Supabase built-ins.

### Q2 — Migration bookkeeping: Studio version recorded? (totals)
- **Proves:** whether the Studio migration's version stamp `20261011090000` is already in the platform bookkeeping, plus total/earliest/latest versions.
- **Expected:** `studio_migration_version_recorded = 0` pre-apply; `total_migrations` = the live count (>0 on any real project).
- **Signal:** `= 1` means the version was recorded — cross-check the *objects* with Q11 (recorded-but-objects-absent = a manual rollback of objects; objects-present-but-not-recorded = applied via SQL Editor without bookkeeping). Bookkeeping is not ground truth.

### Q3 — Migration history listing (prove divergence)
- **Proves:** the live history differs from this repo's 37-file set. Lists every recorded version with its metadata (robust to the `schema_migrations` column set — `name` shown when present).
- **Expected:** versions that do **not** match this repo's `supabase/migrations/*.sql` bulk (e.g. you should **not** see `20260226110220`, `20260128195748`, `20260203190000` dominating the list). Studio's `20261011090000` absent unless already applied.
- **Signal:** if the list is essentially this repo's history verbatim, the "different history" assumption is wrong — coordinate before treating this as a divergent shared DB.

### Q4 — Conflict: Studio tables → expect 0 rows
### Q5 — Conflict: Studio indexes → expect 0 rows
### Q6 — Conflict: Studio triggers → expect 0 rows
### Q7 — Conflict: Studio trigger functions → expect 0 rows
### Q8 — Conflict: Studio table policies → expect 0 rows
### Q9 — Conflict: Studio storage policies → expect 0 rows
### Q10 — Conflict: Studio buckets → expect 0 rows
- **Proves (Q4–Q10):** none of the 32 objects the PR-head migration defines (`studio_projects`, `studio_render_jobs`, `muapi_caption_jobs`; the 6 `subwaytakes_*` indexes; the 8 `trg_*_subwaytakes_*` triggers; the 3 `subwaytakes_*` functions; the 6 `subwaytakes_studio_*` table policies; the 4 `subwaytakes_studio_{exports,uploads}_*` storage policies; buckets `studio-exports`/`studio-uploads`) already exist.
- **Expected:** header row + **zero data rows** in each.
- **Signal:** any data row ⇒ **NO-GO.** See the conflict matrix in `docs/SHARED_DB_AUDIT_PLAN.md` for the exact per-object action (rename vs. coordinate vs. idempotent-finish).

### Q11 — Sign-off conflict summary → expect `0,0,0,0,0,0,0`
- **Proves:** the single-row GO signal for conflicts; columns `studio_tables, studio_indexes, studio_triggers, studio_functions, studio_table_policies, studio_storage_policies, studio_buckets`.
- **Expected:** `0,0,0,0,0,0,0`.
- **Signal:** any nonzero ⇒ **NO-GO**; map it to the probe Q4–Q10 that will list the offending object(s).

### Q12 — Shared generic functions (informational)
- **Proves:** whether `public.update_updated_at_column()` / `public.immutable_user_id()` exist, with full `pg_get_functiondef`.
- **Expected:** 0+ rows. **Not a blocker for this migration** — the corrected PR-head migration defines only `subwaytakes_*` functions and does **not** create or replace these two. (Earlier docs `docs/SHARED_DB_COMPATIBILITY.md` B1/B2 treated these as blockers; that is resolved by the hardening. Do **not** act on them here.)
- **Signal:** record the definitions; do not modify them.

### Q13 — Other common VideoRemix functions (existence)
- **Proves:** presence of `handle_new_user`, `deduct_credits`, `reorder_compilation_clips`, `get_analytics_summary`, `atomic_deduct_tokens`, `assign_episode_number` (owner unknown).
- **Expected:** 0+ rows, recorded. None required by the Studio editor.

### Q14 — All storage buckets
- **Proves:** full bucket inventory with a `flag` column.
- **Expected:** **no** `STUDIO-CONFLICT` rows (that would contradict Q10); a `B3-VIDEOS` row for `videos`; legacy names (`captions`, `thumbnails`, `avatars`, `template-logos`) optional.
- **Signal:** a `STUDIO-CONFLICT` row ⇒ a studio bucket already exists (adoption hazard, see Q10).

### Q15 — `videos` bucket — Blocker B3
- **Proves:** does `videos` exist, is it `public`, its `file_size_limit`/`allowed_mime_types`, and object count. Decides whether Studio's `scene-status`/`muapi-captions` (upload + `getPublicUrl`) can keep using it.
- **Expected:** 0 or 1 row. If present: record `public` + limits; if `public=t` and limits accept 1080×1920 MP4 ⇒ keep; otherwise plan to repoint those edge functions to `studio-exports` before enabling the AI paths.
- **Signal:** 0 rows ⇒ `videos` absent ⇒ the AI-scene and MuAPI-output paths have no home; documented decision required (uploaded-footage rendering via `studio-uploads`/`studio-exports` is unaffected).

### Q16 — `storage.objects` policies currently defined
- **Proves:** names + predicates of existing storage policies; consistent with Q9 (no `subwaytakes_*` yet) and reveals other apps' rules.
- **Expected:** 0+ rows, recorded; **none** named `subwaytakes_studio_*`.

### Q17 — `auth.users` counts (anonymous sign-in proxy)
- **Proves:** total user rows and `is_anonymous` count — what is *checkable from SQL* about anonymous sign-ins (the definitive flag is a Dashboard setting).
- **Expected:** `total_users > 0`; `anonymous_users > 0` strongly implies anonymous sign-ins are **enabled and in use**. `anonymous_users = 0` is **inconclusive** until the toggle is checked.
- **Signal:** confirm **Dashboard → Authentication → Providers → Anonymous** is enabled (the identity model starts with `signInAnonymously()`).

### Q18 — `auth.users` event / provisioning triggers
- **Proves:** every non-internal trigger on `auth.users`, e.g. an `on_auth_user_created → public.handle_new_user()` that provisions `user_profiles` for **every** new user of **every** app.
- **Expected:** 0+ rows, recorded. The Studio migration adds **none** and does not depend on one. If a global provisioning trigger exists, confirm it doesn't conflict with the client's upsert ladder (it doesn't; the ladder handles both the row-exists and row-absent cases).

### Q19 — `user_profiles` columns
- **Proves:** the exact column shape vs. what `src/lib/auth.tsx` reads/upserts; the `is_expected_column` flag marks the 9 expected names.
- **Expected:** 0+ rows. Best case all `is_expected_column = t`. Drift (missing `credits_balance`/`subscription_tier`/`default_city_style`/`default_duration`) is **tolerated** by the client's full→minimal upsert ladder (degrades credits to one `console.warn`); record which are absent.

### Q20 — `user_profiles` existence, RLS and privilege state (+ NOT-NULL-without-default count)
- **Proves:** table present, RLS enabled, grant matrix, and `not_null_no_default_columns` — the one shape that breaks even the minimal `{ id }` upsert (a PK `id` is fine because the upsert supplies it).
- **Expected:** `user_profiles_exists` = t/f, `rls_enabled` = t when present, `not_null_no_default_columns` small (a lone `id` PK is normal), `authenticated_{select,insert,update}` = t when present.
- **Signal:** a `not_null_no_default_columns` value covering non-`id` columns ⇒ the minimal upsert can fail ⇒ credits degrade to the warn path (still non-fatal).

### Q21 — `user_profiles` policies
- **Proves:** whether the signed-in user can SELECT/INSERT/UPDATE its own row; shows predicates.
- **Expected:** an `auth.uid()`-scoped policy. A `USING (true)` / anon policy is a shared-DB concern — record it.

### Q22 — Privilege pattern on a sample existing shared table
- **Proves:** the assumed Supabase default grants on real shared tables, using the first present of `clips`/`episodes`/`user_profiles`/`legacy_clips`.
- **Expected:** `anon_select=t, anon_insert=f, authenticated_{select,insert,update,delete}=t, service_role_select=t`.
- **Signal:** confirms the default-grant assumption that makes Studio's fresh tables work. 0 rows ⇒ none of the candidates exist (informative; assumption still holds by Supabase convention).

### Q23 — Studio-table grants must be N/A
- **Proves:** the 3 studio tables are absent, so every privilege probe is `NULL` and `table_exists=f`.
- **Expected:** 3 rows, all `table_exists=f`, `authenticated_select` empty.
- **Signal:** any `t` ⇒ the table already exists (line up with Q4/Q11).

### Q24 — `auth.uid()` policy pattern in active use
- **Proves:** up to 20 non-Studio public policies scoping rows with `auth.uid()` — confirms the Studio migration matches house style.
- **Expected:** 0+ rows. 0 rows is weaker evidence, **not** a failure.

---

## GO / NO-GO

**GO** requires **all** of the following (authoritative detail in `docs/SHARED_DB_AUDIT_PLAN.md`):

1. **Supabase-managed** — Q1 `supabase_managed_likely = t`.
2. **No Studio-object conflicts** — Q4–Q10 empty **and** Q11 = `0,0,0,0,0,0,0`.
3. **`videos` bucket visibility known** — Q14/Q15 executed; if present, `public`+limits recorded and the B3 disposition decided (keep `getPublicUrl` if public+compatible, else repoint `scene-status`/`muapi-captions` to `studio-exports` before enabling the AI paths).
4. **`user_profiles` shape known** — Q19/Q20/Q21 executed; either expected columns present, or the drift is documented as the tolerated degrade-to-`{id}` upsert (non-fatal for Studio).
5. **Anonymous auth confirmed or documented** — Q17 executed; ideally `anonymous_users > 0`, else operator confirms the Dashboard Anonymous toggle is enabled. If left unknown and the Studio is expected to persist anything ⇒ **NO-GO**.
6. **No unexpected `auth.users` provisioning trigger that Studio conflicts with** — Q18 executed; if a global `on_auth_user_created`-style trigger exists, its target/behavior recorded and confirmed non-conflicting (Studio adds none and doesn't rely on one).
7. **Grant pattern confirmed** — Q22 non-empty (the default-grant assumption), **or** recorded as "no legacy candidate present" (not a Studio blocker).

**NO-GO** otherwise, quoting the exact blocker (which Q, what it showed, and the action from the conflict matrix).

---

## Queries that can fail on a specific Supabase configuration (and the fallback)

These are the only environment-dependent probes. If one errors, `run_audit.sh` records an `ERROR` block for it (never fabricates) and continues; run the fallback by hand in the SQL Editor.

| Query | Requires | If it fails, fallback |
|---|---|---|
| Q2, Q3, Q11 | `supabase_migrations.schema_migrations` | This schema/table exists on **every** Supabase project. If it errors you are likely **not** on Supabase (see Q1 `supabase_managed_likely`). Confirm the target is a real Supabase project first. |
| Q10, Q14, Q15, Q11 | `storage.buckets` columns `file_size_limit`, `allowed_mime_types` | Present on all current Supabase. Fallback: `SELECT id, name, public FROM storage.buckets ORDER BY id;` (drop the limit/MIME columns). |
| Q15 | `storage.objects.bucket_id` | Always present on Supabase. If the object-count expression alone is a concern, run `SELECT count(*) FROM storage.objects WHERE bucket_id='videos';` separately. |
| Q17 | `auth.users` column `is_anonymous` | Present since Supabase shipped anonymous sign-ins. Fallback: `SELECT count(*) AS total_users FROM auth.users;` and confirm the Dashboard Anonymous toggle. |

Everything else (Q1, Q4–Q9, Q12, Q13, Q16, Q18–Q24) reads only universally-present catalogs/schemas and does not depend on any Supabase-version-specific column.
