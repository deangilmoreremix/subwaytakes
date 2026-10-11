# Staging Migration Safety Audit — `20261011090000_studio_projects_and_render_jobs.sql`

**Audited file:** `supabase/migrations/20261011090000_studio_projects_and_render_jobs.sql` (259 lines)
**Audited against:** the complete migration history in `supabase/migrations/` (37 files).
**Method:** static review of every statement in the audited migration plus every prior
migration. **No live database was contacted** — this audit is source-code evidence only,
suitable for a staging release sign-off. Operators must still run the verification queries
in `docs/STAGING_RUNBOOK.md` (Phase 2) against the staging project.

---

## 0. Migration history baseline (how this repo got here)

| Fact | Evidence |
|---|---|
| First tracked table creation (`clips` baseline) | `supabase/migrations/20260127032356_create_clips_table.sql:26` |
| 35 CLI-tracked migrations, `20260127032356` → `20260226110220` | directory listing of `supabase/migrations/` |
| 2 legacy non-timestamped scripts (NOT applied by the CLI — they do not match the `<14-digit-timestamp>_name.sql` pattern and are skipped by `supabase db push`) | `supabase/migrations/COMPLETE_MIGRATION.sql` (header: "Run this in Supabase SQL Editor", lines 1–5), `supabase/migrations/STORAGE_SETUP.sql` |
| Historical application method: schema was originally built by running the combined script in the SQL Editor, then maintained by timestamped migrations | `COMPLETE_MIGRATION.sql:1–5`, `STORAGE_SETUP.sql:1–5` |
| A previous `supabase link` exists in this snapshot, pointing at project ref `orcosohomdugkfcgydwj` | `supabase/.temp/project-ref:1`, `supabase/.temp/pooler-url:1` |
| That ref belongs to the production project | `STORAGE_SETUP.sql:13` references `https://orcosohomdugkfcgydwj.supabase.co` as the project whose dashboard creates the buckets |
| `supabase/config.toml` was **missing entirely** from the snapshot (only `supabase/.temp/*` existed) | repo listing; `git ls-files supabase` shows no `config.toml` |

The new migration is the newest file by timestamp; everything before it is additive
column/table/policy work on `clips`, `episodes`, prompt tables, RLS hardening and seeds.

---

## 1. Is the migration purely ADDITIVE? — **YES**

Complete statement inventory of `20261011090000_studio_projects_and_render_jobs.sql`:

| # | Statement type | Count | Lines | Target |
|---|---|---|---|---|
| 1 | `CREATE TABLE IF NOT EXISTS` | 3 | 29, 75, 138 | `studio_projects`, `studio_render_jobs`, `muapi_caption_jobs` (**new tables only**) |
| 2 | `CREATE INDEX IF NOT EXISTS` (incl. 1 partial unique) | 7 | 40, 93, 96, 99, 157, 159 | **new tables only** |
| 3 | `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER` | 6 pairs | 43–46, 103–106, 162–165, 206–209, 211–214, 216–219 | **new trigger names only** (`trg_studio_*`); the `DROP IF EXISTS` guards are no-ops on a fresh DB and exist for idempotent re-runs |
| 4 | `ALTER TABLE … ENABLE ROW LEVEL SECURITY` | 3 | 48, 108, 167 | **new tables only** |
| 5 | `DROP POLICY IF EXISTS` + `CREATE POLICY` | 12 on new tables + 4 on `storage.objects` | 50–69, 110–132, 169–188, 241–259 | **new policy names only** (`studio_*`); no pre-existing policy is dropped |
| 6 | `CREATE OR REPLACE FUNCTION immutable_user_id()` | 1 | 194–204 | **shared object — see Finding 2b** (the only statement touching an object created by an earlier migration) |
| 7 | `REVOKE INSERT, UPDATE, DELETE … FROM anon` | 3 | 225–227 | **new tables only** |
| 8 | `INSERT INTO storage.buckets … ON CONFLICT (id) DO NOTHING` | 2 | 233–239 | new bucket ids `studio-exports`, `studio-uploads` (required to create the buckets; idempotent) |

**Negative checks (all clean):**

- **No `DROP TABLE`** anywhere in the file.
- **No `ALTER TABLE` of any pre-existing table** — the only three `ALTER TABLE` statements enable RLS on the tables this migration itself creates (lines 48, 108, 167).
- **No `DROP COLUMN` / no column type changes** on any pre-existing table.
- **No data mutation of shared tables** — zero `INSERT`/`UPDATE`/`DELETE`/`TRUNCATE` against `clips`, `episodes`, `compilations`, `compilation_clips`, `episode_shots`, `video_templates`, `user_profiles`, `token_balances` (credits), `token_transactions`, `prompt_*`. The only writes at all are the two `storage.buckets` inserts (lines 233–239), which create this feature's own buckets.
- **No `TRUNCATE`** (grep across the file returns nothing).
- **No `DROP TYPE` / `DROP FUNCTION` / `DROP INDEX` / `DROP SCHEMA`** on anything pre-existing.
- **No `GRANT`.** The three `REVOKE`s (225–227) only *remove* privileges from `anon` on the new tables — strictly restrictive.
- Contrast with history (already-applied, not repeated here): the historical scripts do contain destructive statements — e.g. `DROP TYPE age_group CASCADE` and `UPDATE clips SET …` in `20260203194600_update_age_groups.sql:8,18`, a drop-all-policies loop in `20260225065651_harden_rls_policies.sql:38–49`, and `DROP INDEX` cleanup in `20260226105754_production_integrity.sql:153–168`. **None of these patterns appear in the audited migration.**

**Storage-policy dependency ordering (correct):** the `storage.buckets` rows are inserted at lines 233–239 *before* the dependent `storage.objects` policies are created at lines 241–259. The policies guard on `bucket_id = 'studio-exports' | 'studio-uploads'` and first path folder `auth.uid()::text` (lines 244, 249, 254, 259), matching the worker's upload layout `<user_id>/<project_id>/render-<job_id>.mp4` (`render-worker/README.md:32`).

### Observations (not safety issues)

1. **`studio_render_jobs` INSERT policy vs. its comment.** The comment at lines 115–117 says users enqueue only through the `render-project` edge function, but the `studio_render_jobs_insert_own` policy (118–121) permits a direct PostgREST INSERT as long as `auth.uid()::text = user_id::text` — i.e. a user may only ever insert rows owned by themselves. The policy is ownership-safe; only the comment overstates the restriction. The edge function still adds snapshot validation, the one-active-job-per-project guard, and 409 handling.
2. **Bucket definitions are minimal.** Unlike `20260128195748_add_user_profiles_and_storage.sql:78–83`, the new buckets are created without `file_size_limit`/`allowed_mime_types` (lines 233–239). Acceptable for staging; consider adding limits before production.
3. **`muapi_caption_jobs`/`studio_render_jobs` FKs use `ON DELETE CASCADE` to `studio_projects` (lines 78, 141)** — deleting a project destroys its jobs by design. That is the intended behavior for user-owned studio data, and `muapi_caption_jobs.render_job_id` is `ON DELETE SET NULL` (line 142), so a deleted render job preserves the caption row.
4. The render worker uploads to `studio-exports` (`render-worker/src/config.ts:67`), while `scene-status` and `muapi-captions` write generated scenes/styled captions to the legacy public `videos` bucket (`supabase/functions/scene-status/index.ts:120`, `supabase/functions/muapi-captions/index.ts:116`). Cross-check bucket governance before production; no migration safety impact.

---

## 2. Dependencies

| Dependency | Verdict | Evidence |
|---|---|---|
| `auth.users(id)` FK | **Satisfied** — Supabase built-in schema, present in every Supabase project | `20261011090000_…:31, 77, 140` |
| `update_updated_at_column()` | **Satisfied — with a correction to the brief.** It is **not** defined in `20260226110220_rls_policies.sql`; it is defined in **`20260203190000_add_age_appropriate_content.sql:131–137`** (`CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER … NEW.updated_at = NOW()`). The 2026-02-03 migration is well before the new 2026-10-11 migration, so the function exists when the new triggers are created | definition `20260203190000_add_age_appropriate_content.sql:131`; usage `20261011090000_…:46, 106, 165` |
| `moddatetime` extension | **Confirmed NOT used.** The new migration uses `update_updated_at_column()` + explicit `trg_*_updated_at` triggers only (lines 43–46, 103–106, 162–165). No `moddatetime` reference exists in the file | `20261011090000_…:43–46, 103–106, 162–165` |
| `immutable_user_id()` | **Satisfied, but redefined — see 2b** | definition `20260226110220_rls_policies.sql:103–115`; redefinition `20261011090000_…:194–204`; trigger usage `20261011090000_…:206–219` |
| `storage.buckets` / `storage.objects` / `storage.foldername()` | **Satisfied** — Supabase storage schema; buckets are inserted by this migration before the policies | `20261011090000_…:233–259` |
| `gen_random_uuid()` | **Satisfied** — built-in on PG13+ | `20261011090000_…:30, 76, 139` |

### 2b. FLAGGED (benign, non-destructive): shared function redefinition

`20261011090000_…:194–204` executes `CREATE OR REPLACE FUNCTION immutable_user_id()` on a function that already exists, created by `20260226110220_rls_policies.sql:103–115`. This is the **only statement in the migration that modifies a pre-existing shared object**. Differences in the replacement definition:

| Aspect | Original (`20260226110220:103–115`) | New (`20261011090000:194–204`) |
|---|---|---|
| Signature | `RETURNS trigger LANGUAGE plpgsql` | identical — so all existing triggers keep compiling |
| `SECURITY DEFINER` | yes | **removed** |
| `SET search_path = ''` | yes | **removed** |
| Exception message | `'Ownership transfer forbidden: user_id is immutable on %'` (includes table name) | `'user_id is immutable'` |
| Behavior | raises iff `NEW.user_id IS DISTINCT FROM OLD.user_id` | identical check |

Why it is safe: the function body references only `NEW`/`OLD` and `RAISE`, so removing
`SECURITY DEFINER`/`search_path` does not change behavior (trigger functions run in the
firing user's context either way; the ownership check is context-independent). The 11
existing triggers on legacy tables created at `20260226110220_rls_policies.sql:121–154`
continue to fire against the replaced body.

Why it is flagged anyway: (a) it silently downgrades two hardening attributes on a shared
security function; (b) anything matching the old exception text (logs, client error
handling) changes; (c) it makes the earlier migration's hardening less reproducible.
**Recommendation (optional follow-up, not a blocker):** either delete lines 194–204 from
the studio migration and reuse the existing function, or restore the hardened attributes
(`SECURITY DEFINER`, `SET search_path = ''`) in the replacement. Rollback SQL in §5
restores the original definition.

---

## 3. Ordering safety

- `20261011090000` is the **latest timestamp** in `supabase/migrations/` (next-newest is `20260226110220`), so it applies last — after every table, trigger, and function it references exists.
- It only references objects created in `20260127032356` (nothing — it creates its own tables), `20260203190000` (`update_updated_at_column`), `20260226110220` (`immutable_user_id`), plus built-ins (`auth.users`, `storage.*`).
- Every DDL is wrapped in `IF EXISTS` / `IF NOT EXISTS` / `ON CONFLICT DO NOTHING`, so the whole file is idempotent and re-runnable — consistent with the repo's established pattern (e.g. `20260226110220_rls_policies.sql:5` "All operations are idempotent (safe to re-run)").
- Applying on a fresh staging database (in filename order) is therefore expected to succeed without conflicts. No ordering hazard found.

---

## 4. Staging isolation check (how to confirm the project is isolated)

Document the following before deploying; each item is operator-verifiable in the staging
Dashboard / CLI (none can be verified from this repo snapshot):

1. **Distinct project ref/URL.** The ref recorded in this snapshot (`orcosohomdugkfcgydwj`, `supabase/.temp/project-ref:1`) is the **production** project (`STORAGE_SETUP.sql:13`). Staging must be a *different* project; after `supabase link --project-ref <staging-ref>` (runbook Phase 2), confirm `cat supabase/.temp/project-ref` shows the staging ref, and that `$SUPABASE_URL` (worker env, frontend `VITE_SUPABASE_URL`) points at the staging host only.
2. **No shared service-role key.** The staging project must have its own API keys generated in its own Dashboard. The render worker's `SUPABASE_SERVICE_ROLE_KEY` (`render-worker/.env.example:16`) must be the *staging* key — never reuse the production key. Cross-check that the frontend bundle contains only the staging anon key (`grep` the built `dist/` assets for the staging project ref).
3. **Own database.** A separate Supabase project is a separate Postgres database by construction; confirm no staging config points at the production pooler (`supabase/.temp/pooler-url:1` shows the production pooler host `aws-0-us-east-1.pooler.supabase.com` for ref `orcosohomdugkfcgydwj`).
4. **Separate edge-function secrets.** `supabase secrets set` is per-project; run it after linking staging so MUAPI/OpenAI staging keys land only on staging.

---

## 5. Rollback (exact SQL)

Run in the staging SQL editor **only if the studio migration must be undone**. Order
respects FKs. Safe to run as-is: the `DROP … IF EXISTS` guards make it idempotent.

```sql
-- Roll back 20261011090000_studio_projects_and_render_jobs.sql
-- (reverse order: policies -> storage -> tables -> shared function restore)

-- 1) Drop the 4 storage.objects policies added by the migration
DROP POLICY IF EXISTS "studio_exports_read_own"   ON storage.objects;
DROP POLICY IF EXISTS "studio_exports_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "studio_uploads_read_own"   ON storage.objects;
DROP POLICY IF EXISTS "studio_uploads_insert_own" ON storage.objects;

-- 2) Remove bucket rows (delete objects first; service-role context required)
DELETE FROM storage.objects WHERE bucket_id IN ('studio-exports', 'studio-uploads');
DELETE FROM storage.buckets  WHERE id        IN ('studio-exports', 'studio-uploads');

-- 3) Drop the three new tables (CASCADE also removes their triggers,
--    indexes, RLS and the 12 table policies created by the migration)
DROP TABLE IF EXISTS muapi_caption_jobs CASCADE;
DROP TABLE IF EXISTS studio_render_jobs CASCADE;
DROP TABLE IF EXISTS studio_projects CASCADE;

-- 4) Restore the ORIGINAL immutable_user_id() definition that the migration
--    replaced (copy of 20260226110220_rls_policies.sql:103-115).
--    DO NOT DROP the function itself: 11 legacy tables still depend on it.
CREATE OR REPLACE FUNCTION immutable_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Ownership transfer forbidden: user_id is immutable on %', TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END;
$$;

-- 5) Optional: forget the migration record so `supabase db push` can re-apply it
-- DELETE FROM supabase_migrations.schema_migrations WHERE version = '20261011090000';
```

Note: on a **fresh staging database** the same effect is achieved by terminating the
project and recreating it — rollback matters only if staging data already exists.

---

## 6. Verdict

| Question | Answer |
|---|---|
| Purely additive (3 new tables + 7 indexes + 6 triggers + RLS + revokes + 2 buckets)? | **Yes** — no `DROP`/`ALTER` of pre-existing tables or columns, no data mutation of shared tables (`clips`, `episodes`, `compilations`, `video_templates`, `user_profiles`, credits/tokens), no destructive statements. |
| Dependencies satisfied? | **Yes** — `auth.users` built-in; `update_updated_at_column()` defined in `20260203190000_add_age_appropriate_content.sql:131` (**not** in `20260226110220` as the brief hypothesized); `moddatetime` not used; storage buckets inserted before their policies. |
| Ordering safe? | **Yes** — newest timestamp, idempotent, applies cleanly after the full history. |
| Safe to apply on staging? | **Yes.** |
| Flagged items? | **One benign flag:** `CREATE OR REPLACE FUNCTION immutable_user_id()` at `20261011090000_…:194–204` redefines a shared security function (drops `SECURITY DEFINER`/`search_path=''`, changes the exception message) — behavior-equivalent, non-destructive, see §2b. Plus the observations in §1. No unsafe statement was found anywhere in the migration. |
