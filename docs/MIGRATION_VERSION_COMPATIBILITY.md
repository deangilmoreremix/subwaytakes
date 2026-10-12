# Migration Version Compatibility Audit — `20261011090000_studio_projects_and_render_jobs.sql`

**Artifact audited:** `supabase/migrations/20261011090000_studio_projects_and_render_jobs.sql` (399 lines, sha256 `a9447a108eeea58bfd3ebd49ed70b3d2eb4785673cf981a3066a45ea64239753`)
**Target:** shared Supabase project `bzxohkrxcwodllketcpz` ("VideoRemix Product"), branch `feat/subway-interview-studio`
**Method:** static, line-by-line source analysis only. **No database was contacted; no credentials exist in this environment.** Version claims cite the PostgreSQL release notes / manuals for the version in which each construct became available.
**Companion docs:** `docs/SHARED_DB_COMPATIBILITY.md` (self-containment §5, migration-history risk §7), `docs/RLS_TEST_EVIDENCE.md` (what was executed on a real PG engine), `docs/DEV_BRANCH_TEST_PLAN.md` (where this file gets re-verified on a live branch).

---

## 1. Verdict (up front)

| Question | Answer |
|---|---|
| Minimum PostgreSQL version this migration supports | **PostgreSQL 13** (as written, without `pgcrypto`) |
| Compatible with Supabase's currently supported versions (PG15, PG17) | **Yes — confirmed by construct audit** |
| Compatible with the PG14 instance it was validated on | **Yes — empirically proven** (`docs/RLS_TEST_EVIDENCE.md`: 38/38 behavioural tests, 44/44 static checks) |
| Any PG15/16/17-only feature used? | **No — zero** (§5) |
| Any pre-PG13 assumption that fails? | **No** (§6) — the file's only ≥13 dependency is `gen_random_uuid()`, a built-in from PG13 |
| Anything below PG13? | **Unsupported — do not apply** (§7) |

---

## 2. Version-sensitive construct inventory (every construct, with lines)

"Since" = the PostgreSQL major version in which the construct became available, verified against postgresql.org release notes/manuals. `Platform` = provided by Supabase (auth/storage), not by PostgreSQL — not version-sensitive.

| # | Construct (as used in the file) | Lines | Since | Notes |
|---|---|---|---|---|
| 1 | `gen_random_uuid()` in `DEFAULT` | 187, 241, 302 | **PG13** (core `pg_catalog`); PG9.4+ only via `pgcrypto` | PG13.0 release notes: *"Add function gen_random_uuid() … Previously UUID generation functions were only available in the external modules uuid-ossp and pgcrypto."* The migration never runs `CREATE EXTENSION pgcrypto` — so on ≤PG12 it fails unless pgcrypto happens to be installed. |
| 2 | `CREATE TABLE IF NOT EXISTS` | 186, 240, 301 | PG9.1 | 9.1 release notes: *"Add CREATE TABLE IF NOT EXISTS syntax"*. |
| 3 | Partial index `WHERE status = 'queued'` | 258–260 | PG7.2 | Partial index predicates (7.2 manual, "Partial Indexes"; 7.1 still documented them as unsupported). |
| 4 | Partial **unique** index `WHERE status IN ('queued','running')` | 264–266 | PG7.2 | Same feature; uniqueness is orthogonal to partialness. |
| 5 | `CREATE [UNIQUE] INDEX IF NOT EXISTS` | 197, 258, 261, 264, 320, 322 | PG9.5 | 9.5 added IF NOT EXISTS to CREATE INDEX (commit 08309aaf). |
| 6 | `CREATE POLICY … TO <role>` (10 policies) | 216, 221, 226, 232, 293, 349, 382, 387, 392, 397 (`TO authenticated` at 217, 222, 227, 233, 294, 350, 383, 388, 393, 398) | **PG9.5** | Row-level-security **policies** (and therefore `CREATE POLICY` with its `TO` clause, `USING`, `WITH CHECK`) were introduced in 9.5. Before 9.5 there was no `CREATE POLICY` statement at all; applying this to PG9.4 would be a syntax error, not a behaviour change. |
| 7 | `ALTER TABLE … ENABLE ROW LEVEL SECURITY` | 210, 285, 342 | PG9.5 | Same 9.5 RLS introduction as #6. |
| 8 | `SECURITY INVOKER` (explicit keyword) — **not used**; the three functions rely on the default | (functions at 80–89, 93–104, 123–180) | keyword documented in the PG9.0 grammar; invoker rights is the **default** for all PostgreSQL functions, always | The file omits `SECURITY DEFINER` everywhere; validated `prosecdef = f` on PG14 (`RLS_TEST_EVIDENCE.md` §4). Invoker rights is deliberate (comment at 119–121): a definer trigger function would defeat the job-write guard's trusted-role check (line 141). | |
| 9 | `SET search_path = ''` on functions | 83, 96, 126 | PG8.3 | `SET configuration_parameter` in CREATE FUNCTION; PG9.0 manual notes *"Before PostgreSQL version 8.3, the SET option was not available"*. |
| 10 | `current_setting('request.jwt.claims', true)` — two-argument (`missing_ok`) form | 132 | **PG9.6** | 9.6 release notes: *"Add an optional missing_ok argument to the current_setting() function"*. |
| 11 | `IS NOT DISTINCT FROM` row comparisons | 99, 147–156, 161–172 | SQL-standard; present in all supported versions | Null-safe comparison; far older than the PG13 floor. |
| 12 | `::jsonb` cast and `->>` operator | 132 (cast + `->>`); jsonb columns 191, 252, 253, 314; `'{}'::jsonb` default 253 | PG9.4 | The `jsonb` type and its operators arrived in 9.4. |
| 13 | `RAISE EXCEPTION` (plpgsql) | 100, 178 | ancient (present in the 8.x plpgsql manuals) | — |
| 14 | `DROP TRIGGER IF EXISTS … ON <table>` | 200, 205, 268, 273, 280, 325, 330, 337 | PG8.3 (IF EXISTS + ON clause both documented in the 8.3 manual) | Idempotency guard #2 of 4. |
| 15 | `REVOKE … FROM anon` | 357, 358, 359 | ancient | Revokes DML (not SELECT) on the three new tables; additive-only, defense in depth. |
| 16 | `storage.foldername()`, `storage.buckets`, `storage.objects` | 370–376, 381–399 | **Platform** | Supabase-provided storage schema — not a PostgreSQL feature. Presence verified by `SHARED_DB_COMPATIBILITY.md` §8 Q8 on the live project. |
| 17 | Trigger variables `TG_OP` / `TG_TABLE_NAME` | 145, 146, 160 | ancient (plpgsql trigger variables predate 9.0) | `subwaytakes_guard_job_writes()` branches on table name and event. |
| 18 | `CREATE TRIGGER … EXECUTE FUNCTION` | 203, 208, 271, 276, 283, 328, 333, 340 | **PG11** | PG11 made `EXECUTE FUNCTION` legal in CREATE TRIGGER (before: `EXECUTE PROCEDURE`). On PG10 the file is a **syntax error** at line 203. |
| 19 | plpgsql exception block `BEGIN … EXCEPTION WHEN OTHERS` | 131–135 | ≤PG8.2 ("Trapping Errors" documented in the 8.2 plpgsql manual) | Tolerates an unset/invalid `request.jwt.claims`. |
| 20 | `BEFORE INSERT OR UPDATE` trigger event list | 282, 339 | ancient (OR in trigger events predates 9.0) | — |
| 21 | `INSERT INTO storage.buckets … SELECT … WHERE NOT EXISTS` | 370–376 | ancient | Bucket creation without ON CONFLICT; leaves existing buckets untouched. |
| 22 | `current_user IN ('service_role', 'postgres', 'supabase_admin')` | 141 | ancient | Trusted-role branch of the write guard. |
| 23 | `REFERENCES auth.users(id) ON DELETE CASCADE / SET NULL` | 188, 242, 243, 303, 304, 305 | ancient; `auth.users` is **platform** | FK syntax is version-ancient; the referenced schema is Supabase-provided. |
| 24 | `CHECK (col IN (…))`, `timestamptz`, `DEFAULT now()`, `uuid` PKs, `::text` casts | 244–246, 306, 310–311, 193–194, 254–255, 316–317 | ancient | — |
| 25 | `DECLARE` + `:=` assignment in plpgsql | 128–129, 132 | ancient | — |
| 26 | `auth.uid()` inside policy predicates | 218, 223, 228, 234, 295, 351, 384, 389, 394, 399 | **Platform** | Supabase-provided auth helper, present in every project. |
| 27 | `CREATE OR REPLACE FUNCTION … LANGUAGE plpgsql` | 80, 93, 123 | ancient | Only ever `public.subwaytakes_*` names — never a shared/generic function (hardening per `SHARED_DB_COMPATIBILITY.md` §5.1/B1–B2). |

---

## 3. Minimum supported version

**PostgreSQL 13** — determined by the highest feature floor in §2:

- Floor by feature availability: `gen_random_uuid()` from `pg_catalog` = **PG13** (#1).
- Next-tightest: `EXECUTE FUNCTION` = **PG11** (#18).
- Everything else is ≤PG9.6.

Interpretation:

- **On PG13+ the file applies with no extension prerequisites** (no `CREATE EXTENSION`, no schema-qualified pgcrypto call).
- **On PG11–PG12** it would parse and run *only if* `pgcrypto` (or `uuid-ossp`'s namesake) were already installed in `public`/`pg_catalog`, which the migration does not guarantee — treat PG11/12 as **not supported by this artifact**.
- Supabase's shared-project posture removes the question entirely: **every current Supabase project runs PG15 or PG17** (§4), i.e. ≥2 major versions above the floor.

---

## 4. Supabase supported versions and compatibility

| Platform | Version(s) | This migration |
|---|---|---|
| Supabase platform (current) | **PostgreSQL 15 and PostgreSQL 17** (both GA lines remain supported; PG13 was already retired before 2026, PG14 support ended 2026-07-01 per the Supabase changelog) | **Compatible** — audit below; no construct requires ≥15 |
| Supabase self-hosted | `supabase/postgres:15.x` and `:17.x` lines | **Compatible** — same version coverage |
| Local validation scratch (this repo) | PostgreSQL 14.24 (`RLS_TEST_EVIDENCE.md` §1) | **Validated empirically** |

### 4.1 Explicit confirmation: NO PG15/16/17-only features are used

None of the following (the headline new-feature surface of 15/16/17) appears anywhere in the file: `MERGE`, SQL-standard JSON functions (`JSON_TABLE`, `JSON_QUERY/JSON_VALUE/JSON_EXISTS`, `JSON_SCALAR`, `JSON_SERIALIZE`), `UNIQUE NULLS NOT DISTINCT`, per-column security labels, `COPY … ON_ERROR`, `FAILED_LOGIN_ATTEMPTS`-era GUCs, new `pg_stat_io`-style catalog reliance, `REINDEX … VERBOSE` options, or any catalog query against ≥15 catalogs. The entire grammar surface of the file was available by **PG13** (§2/§3). Consequently the migration also runs on older shared instances down to PG13 — relevant if the "shared" project ever turns out to be a self-managed Postgres rather than the managed platform.

### 4.2 Explicit confirmation: no pre-PG13 assumptions

The only construct with a PG-version prerequisite is #1, `gen_random_uuid()`, which is a **PG13+ built-in**, exactly matching the floor. There is no reliance on:

- an extension not created by the file (pgcrypto, uuid-ossp) — none referenced, none needed;
- the pre-13 idiom of calling a schema-qualified `pgcrypto.gen_random_uuid()`;
- any behaviour removed or changed between 13 and 17 (nothing the file uses was deprecated in 15/16/17).

---

## 5. Cross-reference: what the PG14.24 validation proves — and what it does not

The migration was applied twice and exercised by a 38-test behavioural suite on a real **PostgreSQL 14.24** engine (`docs/RLS_TEST_EVIDENCE.md`), plus a 44-check static compatibility pass. That proves:

- the file **parses and executes** on a real PostgreSQL engine (release 14), twice, exit 0, with an identical object inventory (idempotency);
- `gen_random_uuid()` resolves from `pg_catalog` without pgcrypto (inventory: PK defaults created; RLS evidence §1, §4);
- the two-argument `current_setting(…, true)` semantics (NULL on unset) and the plpgsql exception block behave as designed (tests B01/D01 exceptions, F-tests);
- `EXECUTE FUNCTION` grammar, all 10 policies, 8 triggers, 6 indexes (incl. the partial unique one-active-job index), the REVOKEs, and the private-bucket inserts take effect exactly once;
- RLS isolation, service-role-only job writes, anon-DML revocation, and decoy-function coexistence hold at runtime.

It does **not** prove:

- PG15/16/17-specific behaviour — but none is used (§4.1), and the audit in §2–§3 covers that by construction;
- anything about the Supabase platform schemas (`auth`, `storage`) — those were mocked for the local run (`00_substrate.sql`); they are platform-provided and project-level, not PG-version-level (`SHARED_DB_COMPATIBILITY.md` §8 Q7/Q8 covers their live check);
- anything about the shared project's coexisting objects — `SHARED_DB_COMPATIBILITY.md` §8's read-only audit kit covers that, and `DEV_BRANCH_TEST_PLAN.md` covers re-running the whole kit on a live branch seeded from the shared schema.

Direction of the safety margin matters: validating on a **lower** version than production (14.24 < 15 < 17) is the conservative direction — a feature present in an older release is present in the newer ones; nothing used was removed in 15/16/17.

---

## 6. How to verify the live version (read-only)

Run against the shared project before applying (no writes; no service-role key needed for these):

```sql
-- Supabase Dashboard -> SQL Editor:
SELECT version();   -- expect PostgreSQL 15.x or 17.x (>= 13 suffices for this migration)
```

```bash
# From any machine with psql and the shared project's DB password:
psql "$SHARED_DB_URL" -c "select version()"

# Confirm gen_random_uuid is core (pg_catalog), not extension-provided —
# mirrors docs/SHARED_DB_COMPATIBILITY.md §8 Q7:
psql "$SHARED_DB_URL" -At -c \
  "select n.nspname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where p.proname = 'gen_random_uuid';"        -- expect: pg_catalog

# Confirm the Supabase-provided helpers exist (storage.foldername; §8 Q8):
psql "$SHARED_DB_URL" -At -c \
  "select n.nspname||'.'||p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname='storage' and p.proname in ('foldername','filename','extension');"
```

Note: `psql` accepts the `postgres://`/`postgresql://` connection URI directly as the dbname. For a Supabase branch, the same three queries run against the branch's connection string.

---

## 7. Version-compatibility verdict table

| PostgreSQL major | Verdict | Basis |
|---|---|---|
| ≤ 12 | ✗ **Unsupported** | `gen_random_uuid()` not in core before PG13 and the file installs no extension; additionally PG≤10 rejects `EXECUTE FUNCTION` (#18) |
| 13 | ✓ **Minimum** | All constructs available; nothing extension-dependent |
| 14 (14.24) | ✓ **Validated empirically** | Applied twice, 38/38 behavioural tests, 44/44 static checks, idempotency + rollback proofs (`RLS_TEST_EVIDENCE.md`) |
| 15 | ✓ **Compatible by audit** | No ≥15 construct used (§4.1); every construct ≥2 major versions older |
| 16 | ✓ **Compatible by audit** | same |
| 17 | ✓ **Compatible by audit** | same; nothing used was removed in 15–17 |

**Bottom line:** the migration is version-safe on every PostgreSQL release Supabase currently supports (15 and 17), was empirically proven on 14.24, and has a hard floor of PG13. `scripts/apply-studio-migration.sh` prints the target server's `SELECT version();` after every apply, so the operator records the live version at apply time.

---

## 8. Constructs I could NOT classify with absolute certainty (and why they don't matter)

All constructs in §2 are classified with a verified "since" version except the following, which are documented as *ancient* without a precisely dated introduction release in this audit (verified only that they exist in the PostgreSQL 8.x manuals):

1. **Trigger event lists with `OR`** (`BEFORE INSERT OR UPDATE`, lines 282, 339) — the OR-list grammar predates the 9.x manuals but I did not verify the exact introducing release. Irrelevant to the verdict: present on every PostgreSQL ≥9, and the file's documented floor is PG13.
2. **`REVOKE … FROM <role>` basics** (357–359) and **`current_user`** (141) — unchanged SQL-standard syntax shown in every modern manual; exact introduction release not dated. Same reasoning.
3. **plpgsql `DECLARE`/`:=` assignment** (128–132) — ancient plpgsql, not dated precisely.

None of these can move the minimum version upward past PG13 (each is present in the 8.x/9.x documentation, i.e. strictly older than the two binding floors: PG13 for `gen_random_uuid()` and PG11 for `EXECUTE FUNCTION`), and each was exercised at runtime on PG14.24 by the test suite (the guard-trigger lifecycles in tests B01–B08, D01–D06 cover items 1 and 3 directly).
