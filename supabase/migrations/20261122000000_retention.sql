-- Phase 9: retention. Account-saved projects, onboarding flags, brand kits, referrals, operator retention stats.
-- Safe to re-run. Money rule carried over: credits are only ever written through credit_apply / the ledger. Referral rewards are granted
-- ONLY by a trigger that fires when a referred customer's FIRST real purchase is fulfilled (order_fulfil), so a signup alone earns nothing.

-- ---------------------------------------------------------------- projects (the timeline, saved to the account)

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Untitled episode' CHECK (char_length(name) BETWEEN 1 AND 80),
  data jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(data) = 'object' AND pg_column_size(data) < 524288),
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS projects_user_updated_idx ON projects (user_id, updated_at DESC);

CREATE OR REPLACE FUNCTION projects_cap() RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF (SELECT count(*) FROM projects WHERE user_id = NEW.user_id) >= 50 THEN RAISE EXCEPTION 'project_limit'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS projects_cap_trg ON projects;
CREATE TRIGGER projects_cap_trg BEFORE INSERT ON projects FOR EACH ROW EXECUTE FUNCTION projects_cap();

-- ---------------------------------------------------------------- per-user flags (onboarding)

CREATE TABLE IF NOT EXISTS user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  onboarding jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(onboarding) = 'object' AND pg_column_size(onboarding) < 4096),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- brand kit

CREATE TABLE IF NOT EXISTS brand_kits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  handle text NOT NULL DEFAULT '' CHECK (handle ~ '^@?[A-Za-z0-9._]{0,30}$'),
  primary_color text NOT NULL DEFAULT '#ffb000' CHECK (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  accent_color text NOT NULL DEFAULT '#ffffff' CHECK (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  -- the logo must live in THIS user's folder of the public media bucket (https only)
  logo_url text CHECK (logo_url IS NULL OR logo_url ~ ('^https://[a-z0-9.-]+(:[0-9]+)?/storage/v1/object/public/media/' || user_id::text || '/[A-Za-z0-9._-]{1,200}$') AND logo_url !~ '\.\.'),
  sponsor_text text NOT NULL DEFAULT '' CHECK (char_length(sponsor_text) <= 80),
  show_watermark boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- referrals

CREATE TABLE IF NOT EXISTS referral_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  enabled boolean NOT NULL DEFAULT true,
  referrer_reward integer NOT NULL DEFAULT 300 CHECK (referrer_reward BETWEEN 0 AND 100000),
  referee_reward integer NOT NULL DEFAULT 200 CHECK (referee_reward BETWEEN 0 AND 100000),
  min_order_cents integer NOT NULL DEFAULT 1000 CHECK (min_order_cents >= 100),
  max_rewards_per_referrer integer NOT NULL DEFAULT 20 CHECK (max_rewards_per_referrer BETWEEN 0 AND 1000),
  -- each reward is also capped at this percentage of the credits the qualifying order granted, so a reward can never exceed the sale
  max_reward_pct integer NOT NULL DEFAULT 30 CHECK (max_reward_pct BETWEEN 0 AND 100),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO referral_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS referral_codes (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9]{8}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS referrals (
  referee_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  referrer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'claimed' CHECK (status IN ('claimed', 'rewarded', 'void')),
  reward_order_id uuid REFERENCES orders(id),
  referrer_reward integer NOT NULL DEFAULT 0,
  referee_reward integer NOT NULL DEFAULT 0,
  clawback_shortfall integer NOT NULL DEFAULT 0,   -- reward credits that could not be taken back after a refund (already spent)
  claimed_at timestamptz NOT NULL DEFAULT now(),
  rewarded_at timestamptz,
  CHECK (referee_id <> referrer_id)
);
CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON referrals (referrer_id, status);

-- ---------------------------------------------------------------- dubbing jobs use clip_jobs: allow the new pipeline value

DO $$
BEGIN
  IF to_regclass('public.clip_jobs') IS NOT NULL THEN
    ALTER TABLE clip_jobs DROP CONSTRAINT IF EXISTS clip_jobs_pipeline_check;
    ALTER TABLE clip_jobs ADD CONSTRAINT clip_jobs_pipeline_check CHECK (pipeline IN ('native', 'lipsync', 'recast', 'dub'));
  END IF;
END $$;

-- ---------------------------------------------------------------- access

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "projects own select" ON projects;
CREATE POLICY "projects own select" ON projects FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "projects own delete" ON projects;
CREATE POLICY "projects own delete" ON projects FOR DELETE TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "settings own select" ON user_settings;
CREATE POLICY "settings own select" ON user_settings FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "settings own insert" ON user_settings;
CREATE POLICY "settings own insert" ON user_settings FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "settings own update" ON user_settings;
CREATE POLICY "settings own update" ON user_settings FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "brand own select" ON brand_kits;
CREATE POLICY "brand own select" ON brand_kits FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "brand own insert" ON brand_kits;
CREATE POLICY "brand own insert" ON brand_kits FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "brand own update" ON brand_kits;
CREATE POLICY "brand own update" ON brand_kits FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "brand own delete" ON brand_kits;
CREATE POLICY "brand own delete" ON brand_kits FOR DELETE TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "referral codes own select" ON referral_codes;
CREATE POLICY "referral codes own select" ON referral_codes FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "referrals as referrer select" ON referrals;
CREATE POLICY "referrals as referrer select" ON referrals FOR SELECT TO authenticated USING (referrer_id = auth.uid() OR referee_id = auth.uid());

REVOKE ALL ON projects, user_settings, brand_kits, referral_settings, referral_codes, referrals FROM PUBLIC, anon, authenticated;
-- Projects: read and delete directly; creating and saving go through the functions below (they enforce the version check).
GRANT SELECT, DELETE ON projects TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON brand_kits TO authenticated;
GRANT SELECT ON referral_codes, referrals TO authenticated;
GRANT ALL ON projects, user_settings, brand_kits, referral_settings, referral_codes, referrals TO service_role;

-- ---------------------------------------------------------------- project functions (the caller's own rows only)

CREATE OR REPLACE FUNCTION project_create(p_name text, p_data jsonb) RETURNS TABLE (id uuid, version integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE uid uuid := auth.uid(); new_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) THEN RAISE EXCEPTION 'account_required'; END IF;
  INSERT INTO projects (user_id, name, data) VALUES (uid, COALESCE(NULLIF(trim(p_name), ''), 'Untitled episode'), COALESCE(p_data, '{}')) RETURNING projects.id INTO new_id;
  RETURN QUERY SELECT new_id, 1;
END $$;

-- Saves only when the caller's copy is based on the stored version; otherwise the other device wins until the user chooses.
CREATE OR REPLACE FUNCTION project_save(p_id uuid, p_name text, p_data jsonb, p_expected integer) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE uid uuid := auth.uid(); v integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  UPDATE projects SET name = COALESCE(NULLIF(trim(p_name), ''), name), data = COALESCE(p_data, data), version = version + 1, updated_at = now()
    WHERE id = p_id AND user_id = uid AND version = p_expected RETURNING version INTO v;
  IF v IS NULL THEN
    IF EXISTS (SELECT 1 FROM projects WHERE id = p_id AND user_id = uid) THEN RAISE EXCEPTION 'version_conflict'; END IF;
    RAISE EXCEPTION 'not_found';
  END IF;
  RETURN v;
END $$;

REVOKE EXECUTE ON FUNCTION project_create(text, jsonb), project_save(uuid, text, jsonb, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION project_create(text, jsonb), project_save(uuid, text, jsonb, integer) TO authenticated, service_role;

-- ---------------------------------------------------------------- referrals: codes and claims

-- The caller's own code (created on first use) and their referral numbers.
CREATE OR REPLACE FUNCTION my_referral() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE uid uuid := auth.uid(); c text; tries integer := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT code INTO c FROM referral_codes WHERE user_id = uid;
  WHILE c IS NULL AND tries < 10 LOOP
    tries := tries + 1;
    BEGIN
      c := upper(substr(translate(md5(random()::text || clock_timestamp()::text || uid::text), 'o01il', 'xyzvw'), 1, 8));
      INSERT INTO referral_codes (user_id, code) VALUES (uid, c);
    EXCEPTION WHEN unique_violation THEN
      SELECT code INTO c FROM referral_codes WHERE user_id = uid;   -- same user raced (keep their code) or the code collided (c becomes NULL, try again)
    END;
  END LOOP;
  IF c IS NULL THEN RAISE EXCEPTION 'code_unavailable'; END IF;
  RETURN jsonb_build_object('code', c,
    'claimed', (SELECT count(*) FROM referrals WHERE referrer_id = uid),
    'rewarded', (SELECT count(*) FROM referrals WHERE referrer_id = uid AND status = 'rewarded'),
    'credits_earned', COALESCE((SELECT sum(referrer_reward) FROM referrals WHERE referrer_id = uid AND status = 'rewarded'), 0),
    'enabled', (SELECT enabled FROM referral_settings WHERE id),
    'referrer_reward', (SELECT referrer_reward FROM referral_settings WHERE id),
    'referee_reward', (SELECT referee_reward FROM referral_settings WHERE id));
END $$;

-- Record that p_user was invited by the owner of p_code. Called by the referral-claim function (service_role) after it has checked the
-- account is real and confirmed. Nothing is granted here: rewards come only from a first purchase (trigger below).
CREATE OR REPLACE FUNCTION referral_claim(p_user uuid, p_code text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r uuid;
BEGIN
  IF NOT (SELECT enabled FROM referral_settings WHERE id) THEN RAISE EXCEPTION 'referrals_disabled'; END IF;
  SELECT user_id INTO r FROM referral_codes WHERE code = upper(trim(p_code));
  IF r IS NULL THEN RAISE EXCEPTION 'unknown_code'; END IF;
  IF r = p_user THEN RAISE EXCEPTION 'self_referral'; END IF;
  IF EXISTS (SELECT 1 FROM referrals WHERE referee_id = r AND referrer_id = p_user) THEN RAISE EXCEPTION 'reciprocal_referral'; END IF;
  IF EXISTS (SELECT 1 FROM orders WHERE user_id = p_user AND paid_at IS NOT NULL) THEN RAISE EXCEPTION 'not_new_customer'; END IF;
  INSERT INTO referrals (referee_id, referrer_id) VALUES (p_user, r) ON CONFLICT (referee_id) DO NOTHING;
  IF NOT FOUND THEN RAISE EXCEPTION 'already_claimed'; END IF;
  RETURN 'claimed';
END $$;

-- Reward: fires when an order turns paid. Only the referred customer's first real purchase of at least min_order_cents qualifies.
-- A failure here must never fail the purchase, so everything is inside a sub-transaction.
CREATE OR REPLACE FUNCTION referral_on_paid() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE s referral_settings%ROWTYPE; ref referrals%ROWTYPE; done integer; r1 integer; r2 integer;
BEGIN
  IF OLD.status <> 'pending' OR NEW.status <> 'paid' THEN RETURN NEW; END IF;
  BEGIN
    SELECT * INTO s FROM referral_settings WHERE id;
    IF NOT s.enabled OR NEW.amount_cents < s.min_order_cents THEN RETURN NEW; END IF;
    IF EXISTS (SELECT 1 FROM orders o WHERE o.user_id = NEW.user_id AND o.id <> NEW.id AND o.paid_at IS NOT NULL) THEN RETURN NEW; END IF;
    SELECT * INTO ref FROM referrals WHERE referee_id = NEW.user_id AND status = 'claimed' FOR UPDATE;
    IF NOT FOUND THEN RETURN NEW; END IF;
    -- serialise every reward for one referrer (so the cap holds under concurrency); lock both profiles in a fixed order
    PERFORM 1 FROM user_profiles WHERE id IN (ref.referrer_id, ref.referee_id) ORDER BY id FOR UPDATE;
    SELECT count(*) INTO done FROM referrals WHERE referrer_id = ref.referrer_id AND status = 'rewarded';
    IF done >= s.max_rewards_per_referrer THEN
      UPDATE referrals SET status = 'void' WHERE referee_id = ref.referee_id;
      RETURN NEW;
    END IF;
    r1 := LEAST(s.referrer_reward, (NEW.credits * s.max_reward_pct) / 100);
    r2 := LEAST(s.referee_reward, (NEW.credits * s.max_reward_pct) / 100);
    IF r1 > 0 THEN PERFORM credit_apply(ref.referrer_id, r1, 'grant', 'referral reward', 'referral:' || ref.referee_id::text || ':referrer', NULL); END IF;
    IF r2 > 0 THEN PERFORM credit_apply(ref.referee_id, r2, 'grant', 'referral welcome bonus', 'referral:' || ref.referee_id::text || ':referee', NULL); END IF;
    UPDATE referrals SET status = 'rewarded', reward_order_id = NEW.id, rewarded_at = now(), referrer_reward = r1, referee_reward = r2 WHERE referee_id = ref.referee_id;
  EXCEPTION
    WHEN deadlock_detected OR lock_not_available THEN RAISE;   -- never lose the reward silently: fail the fulfilment so Stripe retries it
    WHEN OTHERS THEN RAISE WARNING 'referral reward skipped: %', SQLERRM;
  END;
  RETURN NEW;
END $$;

-- Reversal: if the order that earned a reward is refunded or disputed, take both rewards back (up to what is left; never negative).
CREATE OR REPLACE FUNCTION referral_on_reverse() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE ref referrals%ROWTYPE; bal integer; claw integer; short integer;
BEGIN
  IF OLD.status <> 'paid' OR NEW.status NOT IN ('refunded', 'disputed') THEN RETURN NEW; END IF;
  BEGIN
    SELECT * INTO ref FROM referrals WHERE reward_order_id = NEW.id AND status = 'rewarded' FOR UPDATE;
    IF NOT FOUND THEN RETURN NEW; END IF;
    PERFORM 1 FROM user_profiles WHERE id = ref.referrer_id FOR UPDATE;
    SELECT credits_balance INTO bal FROM user_profiles WHERE id = ref.referrer_id;
    claw := GREATEST(0, LEAST(ref.referrer_reward, COALESCE(bal, 0)));
    IF claw > 0 THEN INSERT INTO credit_ledger (user_id, delta, kind, reason, ref) VALUES (ref.referrer_id, -claw, 'adjust', 'referral reward reversed', 'referral-reverse:' || ref.referee_id::text || ':referrer'); END IF;
    -- the referee's own profile lock is already held by order_reverse
    SELECT credits_balance INTO bal FROM user_profiles WHERE id = ref.referee_id;
    claw := GREATEST(0, LEAST(ref.referee_reward, COALESCE(bal, 0)));
    IF claw > 0 THEN INSERT INTO credit_ledger (user_id, delta, kind, reason, ref) VALUES (ref.referee_id, -claw, 'adjust', 'referral bonus reversed', 'referral-reverse:' || ref.referee_id::text || ':referee'); END IF;
    UPDATE referrals SET status = 'void' WHERE referee_id = ref.referee_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'referral reversal skipped: %', SQLERRM;
  END;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS orders_referral_paid ON orders;
CREATE TRIGGER orders_referral_paid AFTER UPDATE OF status ON orders FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status) EXECUTE FUNCTION referral_on_paid();
DROP TRIGGER IF EXISTS orders_referral_reverse ON orders;
CREATE TRIGGER orders_referral_reverse AFTER UPDATE OF status ON orders FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status) EXECUTE FUNCTION referral_on_reverse();

-- ---------------------------------------------------------------- operator retention numbers

CREATE OR REPLACE FUNCTION retention_stats() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object(
    'active_users_7d', (SELECT count(DISTINCT user_id) FROM credit_ledger WHERE kind = 'spend' AND created_at > now() - interval '7 days'),
    'paying_users', (SELECT count(DISTINCT user_id) FROM orders WHERE status = 'paid'),
    'repeat_buyers', (SELECT count(*) FROM (SELECT user_id FROM orders WHERE status = 'paid' GROUP BY user_id HAVING count(*) >= 2) t),
    'projects_saved', (SELECT count(*) FROM projects),
    'referrals_claimed', (SELECT count(*) FROM referrals),
    'referrals_rewarded', (SELECT count(*) FROM referrals WHERE status = 'rewarded'),
    'referral_clawback_shortfall', COALESCE((SELECT sum(clawback_shortfall) FROM referrals), 0)
  )
$$;

REVOKE EXECUTE ON FUNCTION my_referral(), referral_claim(uuid, text), referral_on_paid(), referral_on_reverse(), retention_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION referral_claim(uuid, text), referral_on_paid(), referral_on_reverse(), retention_stats() TO service_role;
GRANT EXECUTE ON FUNCTION my_referral() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION projects_cap() FROM PUBLIC, anon, authenticated;
