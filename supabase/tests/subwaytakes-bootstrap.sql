-- Stand-ins for a SHARED Supabase project, so the subwaytakes schema migration can be tested on plain Postgres:
-- roles, auth, storage, the API role with its exposed-schema list, and another app's objects that must stay untouched.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE ROLE authenticator NOLOGIN;
ALTER ROLE authenticator SET pgrst.db_schemas = 'public, graphql_public, agentos';

CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text, is_anonymous boolean NOT NULL DEFAULT false);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT COALESCE(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

CREATE SCHEMA storage;
CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
CREATE TABLE storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text, name text);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql AS $$ SELECT string_to_array(name, '/') $$;
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO anon, authenticated, service_role;

-- another app's things that already live in the shared database (with a colliding name)
INSERT INTO storage.buckets (id, name, public) VALUES ('media', 'media', true), ('smartcrm-contacts', 'smartcrm-contacts', true);
CREATE POLICY "media_public_read" ON storage.objects FOR SELECT TO public USING (bucket_id = 'media');
CREATE TABLE public.projects (id serial PRIMARY KEY, owner text, payload text);
INSERT INTO public.projects (owner, payload) VALUES ('other-app', 'must not change');
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.other_app_fn() RETURNS int LANGUAGE sql AS $$ SELECT 42 $$;
GRANT EXECUTE ON FUNCTION public.other_app_fn() TO anon;
