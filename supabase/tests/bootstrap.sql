-- Minimal stand-ins for what Supabase provides, so the migration can run on plain Postgres in tests.
-- Mirrors the pre-credits state of the real database: user_profiles with the permissive owner policies and the old deduct_credits().
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;

CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text, is_anonymous boolean NOT NULL DEFAULT false);
-- auth.uid() reads the JWT subject; tests set it with: SELECT set_config('request.jwt.claim.sub', '<uuid>', false)
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

-- auth.jwt() reads the claims; tests set them with: SELECT set_config('request.jwt.claims', '{"is_anonymous":true}', false)
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT COALESCE(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;

GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

CREATE TABLE user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  default_city_style text DEFAULT 'nyc',
  default_duration integer DEFAULT 6,
  credits_balance integer DEFAULT 100,
  subscription_tier text DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'enterprise')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON user_profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON user_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
GRANT SELECT, INSERT, UPDATE ON user_profiles TO authenticated;
GRANT ALL ON user_profiles TO service_role; -- Supabase grants service_role everything

-- the old function, exactly as shipped
CREATE OR REPLACE FUNCTION deduct_credits(p_user_id uuid, p_amount integer) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_current_balance integer;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN RETURN false; END IF;
  SELECT credits_balance INTO v_current_balance FROM user_profiles WHERE id = p_user_id FOR UPDATE;
  IF v_current_balance IS NULL OR v_current_balance < p_amount THEN RETURN false; END IF;
  UPDATE user_profiles SET credits_balance = credits_balance - p_amount, updated_at = now() WHERE id = p_user_id;
  RETURN true;
END $$;
GRANT EXECUTE ON FUNCTION deduct_credits(uuid, integer) TO authenticated;

-- the legacy token system, as shipped: SECURITY DEFINER, no owner check, executable by clients
CREATE TABLE token_balances (user_id uuid PRIMARY KEY, monthly_tokens int DEFAULT 0, purchased_tokens int DEFAULT 0, used_this_month int DEFAULT 0);
CREATE FUNCTION atomic_deduct_tokens(p_user_id uuid, p_amount int) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT true $$;
GRANT EXECUTE ON FUNCTION atomic_deduct_tokens(uuid, int) TO authenticated;

-- Two users that existed BEFORE the migration, one with the old 100 free credits (legacy), one with none.
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-0000000000a1', 'legacy@example.com'), ('00000000-0000-0000-0000-0000000000a2', 'zero@example.com');
INSERT INTO user_profiles (id, credits_balance) VALUES ('00000000-0000-0000-0000-0000000000a1', 100), ('00000000-0000-0000-0000-0000000000a2', 0);
