/*
  # SubwayTakes Studio: its own schema (bring-your-own-key backend)

  For a Supabase project that is SHARED with other apps. Everything lives in the schema `subwaytakes`, so there are no name
  collisions with other apps' tables and the whole app can be removed with `DROP SCHEMA subwaytakes CASCADE`.

  What it creates (additive only, safe to run twice):
    - schema subwaytakes, tables: user_profiles, character_bibles, question_bank, clip_jobs, projects, user_settings, brand_kits,
      consents, safety_terms, client_errors, rate_hits
    - functions: project_create, project_save, client_error_log, rate_hit
    - storage bucket `subwaytakes-media` and its policies (all named subwaytakes_*)
    - exposes the schema to the API by APPENDING it to the authenticator role's pgrst.db_schemas (existing entries are kept)

  What it does NOT do: touch any object outside this schema (apart from its own storage bucket and policies), add triggers on auth.users,
  change auth settings, or create any credits, orders, entitlements or referral objects (those belong to the older credits mode, see
  20261120 to 20261124).
*/

CREATE SCHEMA IF NOT EXISTS subwaytakes;
COMMENT ON SCHEMA subwaytakes IS '[app: subwaytakes] SubwayTakes Studio (bring-your-own-muapi-key). Everything of this app lives here. Remove with DROP SCHEMA subwaytakes CASCADE.';

GRANT USAGE ON SCHEMA subwaytakes TO anon, authenticated, service_role;

-- ---------------------------------------------------------------- profile (one row per auth user, created by the app under RLS)

CREATE TABLE IF NOT EXISTS subwaytakes.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text CHECK (display_name IS NULL OR char_length(display_name) <= 60),
  avatar_url text,
  default_city_style text NOT NULL DEFAULT 'nyc' CHECK (char_length(default_city_style) <= 40),
  default_duration integer NOT NULL DEFAULT 6 CHECK (default_duration BETWEEN 3 AND 15),
  credits_balance integer NOT NULL DEFAULT 0,          -- unused when bringing your own key; never writable by the client
  subscription_tier text NOT NULL DEFAULT 'free',      -- unused when bringing your own key; never writable by the client
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE subwaytakes.user_profiles IS '[app: subwaytakes] One row per signed-in user: display name and defaults. Owner-only RLS.';

-- ---------------------------------------------------------------- cast (characters with a portrait and a voice)

CREATE TABLE IF NOT EXISTS subwaytakes.character_bibles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  role text NOT NULL DEFAULT 'guest' CHECK (role IN ('host', 'guest')),
  age_range text NOT NULL DEFAULT '' CHECK (char_length(age_range) <= 80),
  gender text NOT NULL DEFAULT '' CHECK (char_length(gender) <= 80),
  ethnicity text NOT NULL DEFAULT '' CHECK (char_length(ethnicity) <= 120),
  clothing_style text NOT NULL DEFAULT '' CHECK (char_length(clothing_style) <= 300),
  hair_description text NOT NULL DEFAULT '' CHECK (char_length(hair_description) <= 300),
  distinguishing_features text CHECK (distinguishing_features IS NULL OR char_length(distinguishing_features) <= 300),
  energy_persona text NOT NULL DEFAULT '' CHECK (char_length(energy_persona) <= 300),
  voice_style text NOT NULL DEFAULT '' CHECK (char_length(voice_style) <= 300),
  is_default boolean NOT NULL DEFAULT false,
  portrait_url text CHECK (portrait_url IS NULL OR portrait_url ~ '^https://'),
  voice_provider text CHECK (voice_provider IS NULL OR voice_provider IN ('elevenlabs', 'minimax')),
  voice_id text CHECK (voice_id IS NULL OR char_length(voice_id) <= 120),
  voice_speed numeric NOT NULL DEFAULT 1 CHECK (voice_speed >= 0.5 AND voice_speed <= 2),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS character_bibles_user_idx ON subwaytakes.character_bibles (user_id, created_at DESC);
COMMENT ON TABLE subwaytakes.character_bibles IS '[app: subwaytakes] Cast: host and guest characters with a portrait and a voice. Owner-only RLS.';

-- ---------------------------------------------------------------- ideas (take questions; the app falls back to a built-in list when empty)

CREATE TABLE IF NOT EXISTS subwaytakes.question_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL DEFAULT 'general' CHECK (char_length(category) <= 60),
  question text NOT NULL CHECK (char_length(question) BETWEEN 3 AND 300),
  is_trending boolean NOT NULL DEFAULT false,
  usage_count integer NOT NULL DEFAULT 0,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  is_custom boolean NOT NULL DEFAULT false,
  hook_type text,
  energy_level text,
  notes text CHECK (notes IS NULL OR char_length(notes) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS question_bank_question_uq ON subwaytakes.question_bank (question, COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS question_bank_category_idx ON subwaytakes.question_bank (category);
COMMENT ON TABLE subwaytakes.question_bank IS '[app: subwaytakes] Take ideas. Shared rows are admin-seeded and read-only; a user may add and remove their own custom rows.';

-- ---------------------------------------------------------------- generation jobs (muapi), staged and resumable

CREATE TABLE IF NOT EXISTS subwaytakes.clip_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clip_id uuid,
  pipeline text NOT NULL CHECK (pipeline IN ('native', 'lipsync', 'recast', 'dub')),
  model text NOT NULL,
  request_id text,
  stage text NOT NULL DEFAULT 'queued',
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_url text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS clip_jobs_user_created_idx ON subwaytakes.clip_jobs (user_id, created_at DESC);
COMMENT ON TABLE subwaytakes.clip_jobs IS '[app: subwaytakes] One row per generation (native, lipsync, recast, dub) with its stage state. Owner-only RLS.';

-- ---------------------------------------------------------------- saved projects (the timeline, saved to the account)

CREATE TABLE IF NOT EXISTS subwaytakes.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Untitled episode' CHECK (char_length(name) BETWEEN 1 AND 80),
  data jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(data) = 'object' AND pg_column_size(data) < 524288),
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS projects_user_updated_idx ON subwaytakes.projects (user_id, updated_at DESC);
COMMENT ON TABLE subwaytakes.projects IS '[app: subwaytakes] Saved episodes (timeline JSON, version-checked). Never contains the muapi key. Owner-only RLS.';

CREATE OR REPLACE FUNCTION subwaytakes.projects_cap() RETURNS trigger LANGUAGE plpgsql SET search_path = subwaytakes, pg_temp AS $$
BEGIN
  IF (SELECT count(*) FROM subwaytakes.projects WHERE user_id = NEW.user_id) >= 50 THEN RAISE EXCEPTION 'project_limit'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS projects_cap_trg ON subwaytakes.projects;
CREATE TRIGGER projects_cap_trg BEFORE INSERT ON subwaytakes.projects FOR EACH ROW EXECUTE FUNCTION subwaytakes.projects_cap();

-- ---------------------------------------------------------------- per-user flags (first-run checklist)

CREATE TABLE IF NOT EXISTS subwaytakes.user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  onboarding jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(onboarding) = 'object' AND pg_column_size(onboarding) < 4096),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE subwaytakes.user_settings IS '[app: subwaytakes] Per-user flags such as the dismissed first-run checklist. Owner-only RLS.';

-- ---------------------------------------------------------------- brand kit

CREATE TABLE IF NOT EXISTS subwaytakes.brand_kits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  handle text NOT NULL DEFAULT '' CHECK (handle ~ '^@?[A-Za-z0-9._]{0,30}$'),
  primary_color text NOT NULL DEFAULT '#ffb000' CHECK (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  accent_color text NOT NULL DEFAULT '#ffffff' CHECK (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  -- the logo must live in THIS user's folder of the subwaytakes-media bucket (https only)
  logo_url text CHECK (logo_url IS NULL OR (logo_url ~ ('^https://[a-z0-9.-]+(:[0-9]+)?/storage/v1/object/public/subwaytakes-media/' || user_id::text || '/[A-Za-z0-9._-]{1,200}$') AND logo_url !~ '\.\.')),
  sponsor_text text NOT NULL DEFAULT '' CHECK (char_length(sponsor_text) <= 80),
  show_watermark boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE subwaytakes.brand_kits IS '[app: subwaytakes] Logo, handle and colours used on exports. Logo must be in the owner''s own media folder. Owner-only RLS.';

-- ---------------------------------------------------------------- consent, safety terms, error log, rate limit

CREATE TABLE IF NOT EXISTS subwaytakes.consents (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('face_upload')),
  version text NOT NULL CHECK (version ~ '^[0-9]{1,3}$'),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, kind, version)
);
COMMENT ON TABLE subwaytakes.consents IS '[app: subwaytakes] Recorded consent to upload face photos. A record: can be added and read, never edited or removed by the user.';

CREATE TABLE IF NOT EXISTS subwaytakes.safety_terms (
  term text PRIMARY KEY CHECK (char_length(term) BETWEEN 2 AND 60),
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE subwaytakes.safety_terms IS '[app: subwaytakes] Operator-added blocked terms for the content screen. Server only.';

CREATE TABLE IF NOT EXISTS subwaytakes.client_errors (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid,
  message text NOT NULL,
  stack text,
  url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_errors_created_idx ON subwaytakes.client_errors (created_at DESC);
CREATE INDEX IF NOT EXISTS client_errors_message_idx ON subwaytakes.client_errors (message, created_at DESC);
COMMENT ON TABLE subwaytakes.client_errors IS '[app: subwaytakes] Browser error reports (rate-limited, bounded). Server only. Never holds keys or prompts.';

CREATE TABLE IF NOT EXISTS subwaytakes.rate_hits (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('free', 'submit')),
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rate_hits_user_kind_at_idx ON subwaytakes.rate_hits (user_id, kind, at DESC);
COMMENT ON TABLE subwaytakes.rate_hits IS '[app: subwaytakes] Per-user call counts for the per-minute limit on the muapi proxy. Server only.';

-- ---------------------------------------------------------------- access: row level security

ALTER TABLE subwaytakes.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subwaytakes.character_bibles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subwaytakes.question_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE subwaytakes.clip_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE subwaytakes.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE subwaytakes.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE subwaytakes.brand_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE subwaytakes.consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE subwaytakes.safety_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE subwaytakes.client_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE subwaytakes.rate_hits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "st profile select" ON subwaytakes.user_profiles;
CREATE POLICY "st profile select" ON subwaytakes.user_profiles FOR SELECT TO authenticated USING (id = auth.uid());
DROP POLICY IF EXISTS "st profile insert" ON subwaytakes.user_profiles;
CREATE POLICY "st profile insert" ON subwaytakes.user_profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS "st profile update" ON subwaytakes.user_profiles;
CREATE POLICY "st profile update" ON subwaytakes.user_profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "st cast select" ON subwaytakes.character_bibles;
CREATE POLICY "st cast select" ON subwaytakes.character_bibles FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "st cast insert" ON subwaytakes.character_bibles;
CREATE POLICY "st cast insert" ON subwaytakes.character_bibles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "st cast update" ON subwaytakes.character_bibles;
CREATE POLICY "st cast update" ON subwaytakes.character_bibles FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "st cast delete" ON subwaytakes.character_bibles;
CREATE POLICY "st cast delete" ON subwaytakes.character_bibles FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "st ideas select" ON subwaytakes.question_bank;
CREATE POLICY "st ideas select" ON subwaytakes.question_bank FOR SELECT TO authenticated USING (user_id IS NULL OR user_id = auth.uid());
DROP POLICY IF EXISTS "st ideas insert" ON subwaytakes.question_bank;
CREATE POLICY "st ideas insert" ON subwaytakes.question_bank FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND is_custom);
DROP POLICY IF EXISTS "st ideas delete" ON subwaytakes.question_bank;
CREATE POLICY "st ideas delete" ON subwaytakes.question_bank FOR DELETE TO authenticated USING (user_id = auth.uid() AND is_custom);

DROP POLICY IF EXISTS "st jobs select" ON subwaytakes.clip_jobs;
CREATE POLICY "st jobs select" ON subwaytakes.clip_jobs FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "st jobs insert" ON subwaytakes.clip_jobs;
CREATE POLICY "st jobs insert" ON subwaytakes.clip_jobs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "st jobs update" ON subwaytakes.clip_jobs;
CREATE POLICY "st jobs update" ON subwaytakes.clip_jobs FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "st jobs delete" ON subwaytakes.clip_jobs;
CREATE POLICY "st jobs delete" ON subwaytakes.clip_jobs FOR DELETE TO authenticated USING (user_id = auth.uid());

-- projects are written only through project_create / project_save (version-checked), so the client gets read and delete only
DROP POLICY IF EXISTS "st projects select" ON subwaytakes.projects;
CREATE POLICY "st projects select" ON subwaytakes.projects FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "st projects delete" ON subwaytakes.projects;
CREATE POLICY "st projects delete" ON subwaytakes.projects FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "st settings select" ON subwaytakes.user_settings;
CREATE POLICY "st settings select" ON subwaytakes.user_settings FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "st settings insert" ON subwaytakes.user_settings;
CREATE POLICY "st settings insert" ON subwaytakes.user_settings FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "st settings update" ON subwaytakes.user_settings;
CREATE POLICY "st settings update" ON subwaytakes.user_settings FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "st brand select" ON subwaytakes.brand_kits;
CREATE POLICY "st brand select" ON subwaytakes.brand_kits FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "st brand insert" ON subwaytakes.brand_kits;
CREATE POLICY "st brand insert" ON subwaytakes.brand_kits FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "st brand update" ON subwaytakes.brand_kits;
CREATE POLICY "st brand update" ON subwaytakes.brand_kits FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "st brand delete" ON subwaytakes.brand_kits;
CREATE POLICY "st brand delete" ON subwaytakes.brand_kits FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "st consents select" ON subwaytakes.consents;
CREATE POLICY "st consents select" ON subwaytakes.consents FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "st consents insert" ON subwaytakes.consents;
CREATE POLICY "st consents insert" ON subwaytakes.consents FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------- access: table privileges (nothing by default, then exactly what is needed)

REVOKE ALL ON ALL TABLES IN SCHEMA subwaytakes FROM PUBLIC, anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA subwaytakes TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA subwaytakes TO service_role;

-- the profile: the client may read it, create its own row and change only these columns (never the balance or tier)
GRANT SELECT ON subwaytakes.user_profiles TO authenticated;
GRANT INSERT (id, display_name, avatar_url, default_city_style, default_duration) ON subwaytakes.user_profiles TO authenticated;
GRANT UPDATE (display_name, avatar_url, default_city_style, default_duration, updated_at) ON subwaytakes.user_profiles TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON subwaytakes.character_bibles TO authenticated;
GRANT SELECT, DELETE ON subwaytakes.question_bank TO authenticated;
GRANT INSERT (category, question, user_id, is_custom, hook_type, energy_level, notes) ON subwaytakes.question_bank TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON subwaytakes.clip_jobs TO authenticated;
GRANT SELECT, DELETE ON subwaytakes.projects TO authenticated;
GRANT SELECT, INSERT, UPDATE ON subwaytakes.user_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON subwaytakes.brand_kits TO authenticated;
GRANT SELECT, INSERT ON subwaytakes.consents TO authenticated;      -- a consent is a record: added and read, never edited or removed by the user

-- ---------------------------------------------------------------- functions

-- Saved projects. Written only here, and only the caller's own rows. Anonymous (guest) accounts cannot save to the account.
CREATE OR REPLACE FUNCTION subwaytakes.project_create(p_name text, p_data jsonb) RETURNS TABLE (id uuid, version integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = subwaytakes, pg_temp AS $$
DECLARE uid uuid := auth.uid(); new_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) THEN RAISE EXCEPTION 'account_required'; END IF;
  INSERT INTO subwaytakes.projects (user_id, name, data) VALUES (uid, COALESCE(NULLIF(trim(p_name), ''), 'Untitled episode'), COALESCE(p_data, '{}')) RETURNING projects.id INTO new_id;
  RETURN QUERY SELECT new_id, 1;
END $$;

-- Saves only when the caller's copy is based on the stored version; otherwise the other device wins until the user chooses.
CREATE OR REPLACE FUNCTION subwaytakes.project_save(p_id uuid, p_name text, p_data jsonb, p_expected integer) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = subwaytakes, pg_temp AS $$
DECLARE uid uuid := auth.uid(); v integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  UPDATE subwaytakes.projects SET name = COALESCE(NULLIF(trim(p_name), ''), name), data = COALESCE(p_data, data), version = version + 1, updated_at = now()
    WHERE id = p_id AND user_id = uid AND version = p_expected RETURNING version INTO v;
  IF v IS NULL THEN
    IF EXISTS (SELECT 1 FROM subwaytakes.projects WHERE id = p_id AND user_id = uid) THEN RAISE EXCEPTION 'version_conflict'; END IF;
    RAISE EXCEPTION 'not_found';
  END IF;
  RETURN v;
END $$;

-- Browser error log (anyone may report; heavily limited; control characters removed so a report cannot forge log lines).
CREATE OR REPLACE FUNCTION subwaytakes.client_error_log(p_message text, p_stack text DEFAULT NULL, p_url text DEFAULT NULL) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = subwaytakes, pg_temp AS $$
DECLARE uid uuid := auth.uid(); msg text; stk text; u text;
BEGIN
  msg := left(btrim(regexp_replace(COALESCE(p_message, ''), '[\x00-\x1f\x7f]', ' ', 'g')), 300);
  IF msg = '' THEN RETURN false; END IF;
  stk := left(regexp_replace(COALESCE(p_stack, ''), '[\x00-\x08\x0b-\x1f\x7f]', ' ', 'g'), 2000);
  u := CASE WHEN p_url ~ '^https?://[^[:space:]]{1,255}$' THEN p_url ELSE NULL END;
  IF (SELECT count(*) FROM (SELECT 1 FROM subwaytakes.client_errors LIMIT 20001) t) > 20000 THEN RETURN false; END IF;
  IF (SELECT count(*) FROM subwaytakes.client_errors WHERE created_at > now() - interval '1 minute') >= 60 THEN RETURN false; END IF;
  IF uid IS NOT NULL AND (SELECT count(*) FROM subwaytakes.client_errors WHERE user_id = uid AND created_at > now() - interval '1 minute') >= 10 THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM subwaytakes.client_errors WHERE message = msg AND created_at > now() - interval '10 minutes') THEN RETURN false; END IF;
  INSERT INTO subwaytakes.client_errors (user_id, message, stack, url) VALUES (uid, msg, NULLIF(stk, ''), u);
  RETURN true;
END $$;

-- Count one proxy attempt and refuse when the user is over the per-minute limit (called before anything reaches muapi). Error: rate_limited.
CREATE OR REPLACE FUNCTION subwaytakes.rate_hit(p_user uuid, p_kind text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = subwaytakes, pg_temp AS $$
DECLARE n integer; lim integer;
BEGIN
  IF p_kind NOT IN ('free', 'submit') THEN RAISE EXCEPTION 'bad_kind'; END IF;
  lim := CASE WHEN p_kind = 'free' THEN 120 ELSE 30 END;
  INSERT INTO subwaytakes.rate_hits (user_id, kind) VALUES (p_user, p_kind);
  SELECT count(*) INTO n FROM subwaytakes.rate_hits WHERE user_id = p_user AND kind = p_kind AND at > now() - interval '1 minute';
  IF random() < 0.02 THEN DELETE FROM subwaytakes.rate_hits WHERE at < now() - interval '1 hour'; END IF;
  IF n > lim THEN RAISE EXCEPTION 'rate_limited'; END IF;
END $$;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA subwaytakes FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION subwaytakes.project_create(text, jsonb), subwaytakes.project_save(uuid, text, jsonb, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION subwaytakes.client_error_log(text, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION subwaytakes.rate_hit(uuid, text) TO service_role;
-- projects_cap is a trigger function: nobody calls it directly
REVOKE EXECUTE ON FUNCTION subwaytakes.projects_cap() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------- storage: its own bucket (other apps keep theirs)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('subwaytakes-media', 'subwaytakes-media', true, 104857600, ARRAY['image/*', 'audio/*', 'video/*'])
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "subwaytakes_media_public_read" ON storage.objects;
CREATE POLICY "subwaytakes_media_public_read" ON storage.objects FOR SELECT TO public USING (bucket_id = 'subwaytakes-media');

DROP POLICY IF EXISTS "subwaytakes_media_owner_insert" ON storage.objects;
CREATE POLICY "subwaytakes_media_owner_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'subwaytakes-media' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "subwaytakes_media_owner_update" ON storage.objects;
CREATE POLICY "subwaytakes_media_owner_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'subwaytakes-media' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'subwaytakes-media' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "subwaytakes_media_owner_delete" ON storage.objects;
CREATE POLICY "subwaytakes_media_owner_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'subwaytakes-media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------- API exposure: APPEND the schema, never replace the list

DO $$
DECLARE cur text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN RETURN; END IF;
  SELECT split_part(c, '=', 2) INTO cur FROM pg_roles r, unnest(r.rolconfig) c WHERE r.rolname = 'authenticator' AND c LIKE 'pgrst.db_schemas=%' LIMIT 1;
  IF cur IS NULL OR cur = '' THEN cur := 'public'; END IF;
  IF position('subwaytakes' IN cur) = 0 THEN
    EXECUTE format('ALTER ROLE authenticator SET pgrst.db_schemas = %L', cur || ', subwaytakes');
  END IF;
  PERFORM pg_notify('pgrst', 'reload config');
  PERFORM pg_notify('pgrst', 'reload schema');
END $$;
