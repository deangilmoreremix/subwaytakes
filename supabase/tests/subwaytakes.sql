-- Assertions for 20261125000000_subwaytakes_schema.sql (the shared-project, bring-your-own-key backend).
\set ON_ERROR_STOP on
\set u1 '''00000000-0000-0000-0000-000000000a01'''
\set u2 '''00000000-0000-0000-0000-000000000a02'''

CREATE FUNCTION pg_temp.expect(name text, ok boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAIL: %', name; END IF; RAISE NOTICE 'PASS: %', name; END $$;
CREATE FUNCTION pg_temp.fails(name text, stmt text, expect_msg text DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE stmt; EXCEPTION WHEN OTHERS THEN
    IF expect_msg IS NOT NULL AND SQLERRM NOT LIKE '%' || expect_msg || '%' THEN RAISE EXCEPTION 'FAIL: % (wrong error: %)', name, SQLERRM; END IF;
    RAISE NOTICE 'PASS: %', name; RETURN;
  END;
  RAISE EXCEPTION 'FAIL: % (statement succeeded)', name;
END $$;
GRANT ALL ON FUNCTION pg_temp.expect(text, boolean), pg_temp.fails(text, text, text) TO PUBLIC;

INSERT INTO auth.users (id, email) VALUES (:u1, 'a@example.com'), (:u2, 'b@example.com');

-- ================================================================ nothing outside the schema changed
SELECT pg_temp.expect('the other app''s table and rows are untouched', (SELECT count(*) FROM public.projects WHERE payload = 'must not change') = 1);
SELECT pg_temp.expect('the other app''s function is untouched', public.other_app_fn() = 42);
SELECT pg_temp.expect('the other app''s bucket "media" is untouched', (SELECT count(*) FROM storage.buckets WHERE id = 'media' AND public) = 1);
SELECT pg_temp.expect('our objects are all in the subwaytakes schema (no new public tables)', (SELECT count(*) FROM pg_tables WHERE schemaname = 'public') = 1);
SELECT pg_temp.expect('no trigger was added to auth.users', (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'auth' AND NOT t.tgisinternal) = 0);
SELECT pg_temp.expect('our own bucket exists, separate from "media"', (SELECT count(*) FROM storage.buckets WHERE id = 'subwaytakes-media') = 1);
SELECT pg_temp.expect('the exposed schema list was appended to, not replaced',
  (SELECT split_part(c, '=', 2) FROM pg_roles r, unnest(r.rolconfig) c WHERE r.rolname = 'authenticator' AND c LIKE 'pgrst.db_schemas=%') = 'public, graphql_public, agentos, subwaytakes');
SELECT pg_temp.expect('every table has a [app: subwaytakes] comment',
  (SELECT count(*) FROM pg_tables t WHERE t.schemaname = 'subwaytakes' AND COALESCE(obj_description((quote_ident(t.schemaname) || '.' || quote_ident(t.tablename))::regclass, 'pg_class'), '') NOT LIKE '[app: subwaytakes]%') = 0);
SELECT pg_temp.expect('every table has row level security on', (SELECT count(*) FROM pg_tables WHERE schemaname = 'subwaytakes' AND NOT rowsecurity) = 0);

-- ================================================================ anon sees nothing
SET ROLE anon;
SELECT pg_temp.fails('anon cannot read projects', 'SELECT * FROM subwaytakes.projects', 'permission denied');
SELECT pg_temp.fails('anon cannot read profiles', 'SELECT * FROM subwaytakes.user_profiles', 'permission denied');
SELECT pg_temp.fails('anon cannot call rate_hit', 'SELECT subwaytakes.rate_hit(''' || '00000000-0000-0000-0000-000000000a01' || ''', ''free'')', 'permission denied');
SELECT pg_temp.fails('anon cannot create a project', 'SELECT * FROM subwaytakes.project_create(''x'', ''{}'')', 'permission denied');
SELECT pg_temp.expect('anon can report a browser error (limited)', subwaytakes.client_error_log('boom ' || random()::text, NULL, 'https://app.example/create'));
RESET ROLE;

-- ================================================================ a user: own rows, never the balance
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000a01', false);
INSERT INTO subwaytakes.user_profiles (id, default_city_style, default_duration) VALUES (:u1, 'nyc', 6);
SELECT pg_temp.expect('a user creates their own profile', (SELECT count(*) FROM subwaytakes.user_profiles) = 1);
SELECT pg_temp.fails('a user cannot create someone else''s profile', 'INSERT INTO subwaytakes.user_profiles (id) VALUES (''00000000-0000-0000-0000-000000000a02'')', 'row-level security');
SELECT pg_temp.fails('a user cannot change their balance', 'UPDATE subwaytakes.user_profiles SET credits_balance = 999999', 'permission denied');
SELECT pg_temp.fails('a user cannot change their tier', 'UPDATE subwaytakes.user_profiles SET subscription_tier = ''pro''', 'permission denied');
UPDATE subwaytakes.user_profiles SET display_name = 'Dee', default_duration = 8;
SELECT pg_temp.expect('a user can change their name and defaults', (SELECT display_name FROM subwaytakes.user_profiles) = 'Dee');
SELECT pg_temp.fails('defaults are range-checked', 'UPDATE subwaytakes.user_profiles SET default_duration = 99', 'check constraint');

INSERT INTO subwaytakes.character_bibles (user_id, name, role, voice_provider, voice_speed) VALUES (:u1, 'Maya', 'guest', 'elevenlabs', 1.1);
SELECT pg_temp.expect('a user can add a character', (SELECT count(*) FROM subwaytakes.character_bibles) = 1);
SELECT pg_temp.fails('a character cannot be created for someone else', 'INSERT INTO subwaytakes.character_bibles (user_id, name) VALUES (''00000000-0000-0000-0000-000000000a02'', ''x'')', 'row-level security');
SELECT pg_temp.fails('a bad voice provider is refused', 'UPDATE subwaytakes.character_bibles SET voice_provider = ''evil''', 'check constraint');
SELECT pg_temp.fails('a non-https portrait is refused', 'UPDATE subwaytakes.character_bibles SET portrait_url = ''http://x/y.png''', 'check constraint');

INSERT INTO subwaytakes.clip_jobs (user_id, pipeline, model) VALUES (:u1, 'dub', 'sync-lipsync');
SELECT pg_temp.expect('a user can add a job (including dubbing)', (SELECT count(*) FROM subwaytakes.clip_jobs) = 1);
SELECT pg_temp.fails('an unknown pipeline is refused', 'INSERT INTO subwaytakes.clip_jobs (user_id, pipeline, model) VALUES (''00000000-0000-0000-0000-000000000a01'', ''hack'', ''m'')', 'check constraint');

INSERT INTO subwaytakes.consents (user_id, kind, version) VALUES (:u1, 'face_upload', '1');
SELECT pg_temp.expect('a user records consent', (SELECT count(*) FROM subwaytakes.consents) = 1);
SELECT pg_temp.fails('consent cannot be deleted by the user', 'DELETE FROM subwaytakes.consents', 'permission denied');
SELECT pg_temp.fails('consent cannot be edited by the user', 'UPDATE subwaytakes.consents SET version = ''2''', 'permission denied');

INSERT INTO subwaytakes.user_settings (user_id, onboarding) VALUES (:u1, '{"dismissed":true}');
SELECT pg_temp.expect('a user keeps their checklist flags', (SELECT onboarding ->> 'dismissed' FROM subwaytakes.user_settings) = 'true');

-- brand kit: the logo must live in the user's own folder of OUR bucket
INSERT INTO subwaytakes.brand_kits (user_id, handle) VALUES (:u1, '@subway');
UPDATE subwaytakes.brand_kits SET logo_url = 'https://x.supabase.co/storage/v1/object/public/subwaytakes-media/00000000-0000-0000-0000-000000000a01/logo.png';
SELECT pg_temp.expect('the logo in my own folder is accepted', (SELECT logo_url IS NOT NULL FROM subwaytakes.brand_kits));
SELECT pg_temp.fails('a logo in someone else''s folder is refused', 'UPDATE subwaytakes.brand_kits SET logo_url = ''https://x.supabase.co/storage/v1/object/public/subwaytakes-media/00000000-0000-0000-0000-000000000a02/logo.png''', 'check constraint');
SELECT pg_temp.fails('a logo in the other app''s bucket is refused', 'UPDATE subwaytakes.brand_kits SET logo_url = ''https://x.supabase.co/storage/v1/object/public/media/00000000-0000-0000-0000-000000000a01/logo.png''', 'check constraint');
SELECT pg_temp.fails('an svg or odd path is refused', 'UPDATE subwaytakes.brand_kits SET logo_url = ''https://x.supabase.co/storage/v1/object/public/subwaytakes-media/00000000-0000-0000-0000-000000000a01/../x.png''', 'check constraint');

-- ideas: shared rows are read-only, custom rows are the user's own
RESET ROLE;
INSERT INTO subwaytakes.question_bank (category, question) VALUES ('food', 'Is a hot dog a sandwich?');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000a01', false);
SELECT pg_temp.expect('a user reads the shared ideas', (SELECT count(*) FROM subwaytakes.question_bank) = 1);
SELECT pg_temp.fails('a user cannot add a shared (non-custom) idea', 'INSERT INTO subwaytakes.question_bank (category, question, user_id, is_custom) VALUES (''x'', ''A sneaky shared one'', NULL, false)', 'row-level security');
INSERT INTO subwaytakes.question_bank (category, question, user_id, is_custom) VALUES ('mine', 'Is cereal soup?', :u1, true);
SELECT pg_temp.expect('a user can add their own custom idea', (SELECT count(*) FROM subwaytakes.question_bank) = 2);
SELECT pg_temp.fails('a user cannot edit ideas', 'UPDATE subwaytakes.question_bank SET question = ''changed''', 'permission denied');

-- ================================================================ projects: only through the functions, version checked
SELECT pg_temp.fails('a user cannot write the projects table directly', 'INSERT INTO subwaytakes.projects (user_id) VALUES (''00000000-0000-0000-0000-000000000a01'')', 'permission denied');
CREATE TEMP TABLE t_p AS SELECT * FROM subwaytakes.project_create('  ', '{"clips":[]}');
RESET ROLE;
GRANT ALL ON t_p TO authenticated;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000a01', false);
SELECT pg_temp.expect('a blank name becomes "Untitled episode", version 1', (SELECT p.name = 'Untitled episode' AND t.version = 1 FROM t_p t JOIN subwaytakes.projects p ON p.id = t.id));
SELECT pg_temp.expect('save with the right version bumps it', subwaytakes.project_save((SELECT id FROM t_p), 'Renamed', '{"clips":[1]}', 1) = 2);
SELECT pg_temp.fails('save with a stale version is a conflict', 'SELECT subwaytakes.project_save((SELECT id FROM t_p), ''x'', ''{}'', 1)', 'version_conflict');
SELECT pg_temp.fails('a huge project is refused', 'SELECT subwaytakes.project_save((SELECT id FROM t_p), ''x'', jsonb_build_object(''blob'', repeat(''x'', 600000)), 2)', 'check constraint');
SELECT pg_temp.fails('the muapi key can never be a "project name" longer than 80', 'SELECT subwaytakes.project_save((SELECT id FROM t_p), repeat(''k'', 81), ''{}'', 2)', 'check constraint');
SELECT set_config('request.jwt.claims', '{"is_anonymous":true}', false);
SELECT pg_temp.fails('a guest account cannot save to the account', 'SELECT * FROM subwaytakes.project_create(''g'', ''{}'')', 'account_required');
SELECT set_config('request.jwt.claims', '{}', false);

-- the other user sees and changes nothing of mine
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000a02', false);
SELECT pg_temp.expect('another user sees none of my projects, jobs, characters, consents or profile',
  (SELECT count(*) FROM subwaytakes.projects) = 0 AND (SELECT count(*) FROM subwaytakes.clip_jobs) = 0 AND (SELECT count(*) FROM subwaytakes.character_bibles) = 0
  AND (SELECT count(*) FROM subwaytakes.consents) = 0 AND (SELECT count(*) FROM subwaytakes.user_profiles) = 0 AND (SELECT count(*) FROM subwaytakes.brand_kits) = 0);
SELECT pg_temp.fails('another user cannot save my project', 'SELECT subwaytakes.project_save(''' || (SELECT id FROM t_p)::text || '''::uuid, ''hijack'', ''{}'', 2)', 'not_found');
SELECT pg_temp.expect('another user only sees the shared idea, not my custom one', (SELECT count(*) FROM subwaytakes.question_bank) = 1);
SELECT pg_temp.fails('a user cannot read the server-only tables', 'SELECT * FROM subwaytakes.client_errors', 'permission denied');
SELECT pg_temp.fails('a user cannot read safety terms', 'SELECT * FROM subwaytakes.safety_terms', 'permission denied');
SELECT pg_temp.fails('a user cannot call rate_hit', 'SELECT subwaytakes.rate_hit(''' || '00000000-0000-0000-0000-000000000a02' || ''', ''free'')', 'permission denied');
RESET ROLE;

-- ================================================================ the server: rate limit
SET ROLE service_role;
SELECT subwaytakes.rate_hit(:u1, 'submit') FROM generate_series(1, 30);
SELECT pg_temp.fails('the 31st submit in a minute is refused', 'SELECT subwaytakes.rate_hit(''00000000-0000-0000-0000-000000000a01'', ''submit'')', 'rate_limited');
SELECT pg_temp.expect('free calls have their own, larger limit', (SELECT true FROM (SELECT subwaytakes.rate_hit(:u1, 'free')) x) IS NOT NULL);
SELECT pg_temp.fails('an unknown kind is refused', 'SELECT subwaytakes.rate_hit(''00000000-0000-0000-0000-000000000a01'', ''zzz'')', 'bad_kind');
RESET ROLE;

-- ================================================================ the whole app can be removed in one statement
CREATE TEMP TABLE before_drop AS SELECT (SELECT count(*) FROM public.projects) AS p, (SELECT count(*) FROM pg_tables WHERE schemaname = 'public') AS t;
DROP SCHEMA subwaytakes CASCADE;
SELECT pg_temp.expect('dropping the schema leaves the other app exactly as it was', (SELECT p FROM before_drop) = (SELECT count(*) FROM public.projects) AND (SELECT t FROM before_drop) = (SELECT count(*) FROM pg_tables WHERE schemaname = 'public'));
