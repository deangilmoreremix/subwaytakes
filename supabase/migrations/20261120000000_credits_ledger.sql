/*
  # Credits ledger and gateway tables

  Why: customers must not hold a muapi key. The server holds it, meters every paid call and charges credits
  (1 credit = $0.01). This migration also closes two holes found before launch:
    1. user_profiles allowed the owner to UPDATE credits_balance (and subscription_tier) straight from the browser.
    2. The old deduct_credits() was callable by any signed-in user, and the client created profiles with 100 free credits.

  Model
    - credit_ledger: append-only; credits_balance = SUM(delta). A trigger applies each row to user_profiles.
    - A paid call first RESERVES credits (a 'spend' row plus a held credit_holds row). Success settles the hold (no ledger
      change). Failure releases it (a 'refund' row). Both are idempotent.
    - Every balance-changing function is SECURITY DEFINER and executable only by service_role (the gateway / admin functions).
    - Existing balances are kept as 'opening' ledger rows. Nothing is zeroed silently.
*/

-- ---------------------------------------------------------------- tables

CREATE TABLE IF NOT EXISTS credit_ledger (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta integer NOT NULL CHECK (delta <> 0),
  kind text NOT NULL CHECK (kind IN ('grant', 'spend', 'refund', 'adjust', 'opening')),
  reason text NOT NULL DEFAULT '',
  ref text,
  actor uuid,  -- the admin who made a grant or adjustment (null for system rows)
  created_at timestamptz NOT NULL DEFAULT now()
);
-- one row per (user, kind, ref): makes grants, spends and refunds idempotent
CREATE UNIQUE INDEX IF NOT EXISTS credit_ledger_ref_uidx ON credit_ledger (user_id, kind, ref) WHERE ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS credit_ledger_user_created_idx ON credit_ledger (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS credit_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'held' CHECK (status IN ('held', 'settled', 'released')),
  slug text NOT NULL,
  idem_key text,
  req_hash text,  -- sha256 of the slug and request body: a reused idempotency key must carry the same request
  created_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS credit_holds_idem_uidx ON credit_holds (user_id, idem_key) WHERE idem_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS credit_holds_open_idx ON credit_holds (user_id) WHERE status = 'held';
CREATE INDEX IF NOT EXISTS credit_holds_stale_idx ON credit_holds (created_at) WHERE status = 'held';

CREATE TABLE IF NOT EXISTS muapi_calls (
  request_id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hold_id uuid REFERENCES credit_holds(id),
  slug text NOT NULL,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'completed', 'failed')),
  estimated_usd numeric(10, 4),
  credits integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS muapi_calls_user_created_idx ON muapi_calls (user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS muapi_calls_hold_uidx ON muapi_calls (hold_id) WHERE hold_id IS NOT NULL; -- one muapi job per hold, ever
CREATE INDEX IF NOT EXISTS muapi_calls_open_idx ON muapi_calls (created_at) WHERE status = 'submitted';

-- Every gateway call (free or paid) leaves a row here, so limits count ATTEMPTS, not just finished jobs.
CREATE TABLE IF NOT EXISTS gateway_hits (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('free', 'submit')),
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gateway_hits_user_kind_at_idx ON gateway_hits (user_id, kind, at DESC);

CREATE TABLE IF NOT EXISTS gateway_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  margin numeric(6, 3) NOT NULL DEFAULT 2.5 CHECK (margin >= 1),
  max_credits_per_call integer NOT NULL DEFAULT 1500 CHECK (max_credits_per_call > 0),
  max_calls_per_minute integer NOT NULL DEFAULT 30 CHECK (max_calls_per_minute > 0),  -- paid submit ATTEMPTS per minute
  max_free_per_minute integer NOT NULL DEFAULT 240 CHECK (max_free_per_minute > 0),   -- quotes, polls and metadata per minute
  max_open_holds integer NOT NULL DEFAULT 10 CHECK (max_open_holds > 0),
  daily_credit_cap integer NOT NULL DEFAULT 5000 CHECK (daily_credit_cap > 0),
  kill_switch boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO gateway_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS model_prices (
  slug text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  margin numeric(6, 3) CHECK (margin IS NULL OR margin >= 1),
  min_credits integer NOT NULL DEFAULT 1 CHECK (min_credits >= 1)
);

CREATE TABLE IF NOT EXISTS admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);

-- RLS: users read only their own ledger. Everything else is service_role only (no policies).
ALTER TABLE credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE muapi_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE gateway_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE gateway_hits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "credit_ledger_select_own" ON credit_ledger;
CREATE POLICY "credit_ledger_select_own" ON credit_ledger FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Explicit privileges (Supabase's default grants would otherwise give signed-in users every privilege on new tables).
REVOKE ALL ON credit_ledger, credit_holds, muapi_calls, gateway_settings, model_prices, admin_users, gateway_hits FROM anon, authenticated;
GRANT SELECT ON credit_ledger TO authenticated;
GRANT ALL ON credit_ledger, credit_holds, muapi_calls, gateway_settings, model_prices, admin_users, gateway_hits TO service_role;

-- ---------------------------------------------------------------- profile balance: only the ledger may change it

ALTER TABLE user_profiles ALTER COLUMN credits_balance SET DEFAULT 0;

-- Opening balances. Safe to re-run: the apply trigger is dropped FIRST (so these rows never change the balance a second time),
-- and only users with NO ledger history at all get one (so a re-run after launch cannot double anyone's credits).
-- AUDIT BEFORE APPLYING: every existing balance becomes spendable credits, including the old 100 free credits and any value a
-- user wrote to their own row through the old UPDATE hole. See the README for the audit query.
DROP TRIGGER IF EXISTS credit_ledger_apply_trg ON credit_ledger;
INSERT INTO credit_ledger (user_id, delta, kind, reason, ref)
SELECT p.id, p.credits_balance, 'opening', 'Balance before the credits ledger', 'opening'
FROM user_profiles p
WHERE p.credits_balance IS NOT NULL AND p.credits_balance <> 0
  AND NOT EXISTS (SELECT 1 FROM credit_ledger l WHERE l.user_id = p.id)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION credit_ledger_apply() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  PERFORM set_config('app.ledger_write', 'on', true);
  UPDATE user_profiles SET credits_balance = COALESCE(credits_balance, 0) + NEW.delta, updated_at = now() WHERE id = NEW.user_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM set_config('app.ledger_write', 'off', true);
  IF n = 0 THEN RAISE EXCEPTION 'no profile for user %', NEW.user_id; END IF; -- never let the ledger and the balance drift apart
  RETURN NEW;
END $$;

CREATE TRIGGER credit_ledger_apply_trg AFTER INSERT ON credit_ledger FOR EACH ROW EXECUTE FUNCTION credit_ledger_apply();

-- Ledger rows are never edited or deleted.
CREATE OR REPLACE FUNCTION credit_ledger_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'credit_ledger is append-only'; END $$;
DROP TRIGGER IF EXISTS credit_ledger_immutable_trg ON credit_ledger;
CREATE TRIGGER credit_ledger_immutable_trg BEFORE UPDATE OR DELETE ON credit_ledger FOR EACH ROW EXECUTE FUNCTION credit_ledger_immutable();

-- Nobody can write credits_balance directly. A new profile always starts at 0 (a client that still sends 100 is ignored).
CREATE OR REPLACE FUNCTION user_profiles_guard_balance() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE(current_setting('app.ledger_write', true), 'off') = 'on' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.credits_balance := 0;
  ELSIF NEW.credits_balance IS DISTINCT FROM OLD.credits_balance THEN
    RAISE EXCEPTION 'credits_balance can only change through the credit ledger';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS user_profiles_guard_balance_trg ON user_profiles;
CREATE TRIGGER user_profiles_guard_balance_trg BEFORE INSERT OR UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION user_profiles_guard_balance();

-- Defence in depth: signed-in users may edit only harmless profile fields (not credits_balance or subscription_tier).
REVOKE UPDATE, INSERT, DELETE ON user_profiles FROM authenticated, anon; -- a profile (and its balance row) is never deletable from the browser
GRANT INSERT (id, display_name, avatar_url, default_city_style, default_duration) ON user_profiles TO authenticated;
GRANT UPDATE (display_name, avatar_url, default_city_style, default_duration, updated_at) ON user_profiles TO authenticated;

-- Legacy token system (unused by this app): its deduct function is SECURITY DEFINER with no owner check, so any signed-in user
-- could burn another user's tokens. Lock it down if it exists.
DO $$ BEGIN
  IF to_regprocedure('atomic_deduct_tokens(uuid, integer)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION atomic_deduct_tokens(uuid, integer) FROM PUBLIC, anon, authenticated;
  END IF;
END $$;

-- The old client-callable deduction is retired.
REVOKE EXECUTE ON FUNCTION deduct_credits(uuid, integer) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------- reserve / settle / release

-- Count one gateway attempt and refuse if the user is over the per-minute limit. Called BEFORE any muapi call, so a flood of
-- quotes, polls or rejected submits is stopped without touching the operator's muapi key. Errors: rate_limited.
CREATE OR REPLACE FUNCTION credit_hit(p_user uuid, p_kind text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s gateway_settings%ROWTYPE; n integer; lim integer;
BEGIN
  IF p_kind NOT IN ('free', 'submit') THEN RAISE EXCEPTION 'bad_kind'; END IF;
  SELECT * INTO s FROM gateway_settings WHERE id;
  lim := CASE WHEN p_kind = 'free' THEN s.max_free_per_minute ELSE s.max_calls_per_minute END;
  INSERT INTO gateway_hits (user_id, kind) VALUES (p_user, p_kind);
  SELECT count(*) INTO n FROM gateway_hits WHERE user_id = p_user AND kind = p_kind AND at > now() - interval '1 minute';
  IF random() < 0.02 THEN DELETE FROM gateway_hits WHERE at < now() - interval '1 hour'; END IF; -- cheap housekeeping
  IF n > lim THEN RAISE EXCEPTION 'rate_limited'; END IF;
END $$;

-- Reserve credits for one paid call. Atomic: the profile row is locked, so concurrent calls cannot overdraw.
-- p_hash identifies the exact request (slug + body). A reused idempotency key must carry the same hash:
--   same key, same request, hold still open  -> returns that hold (reused = true); the caller returns the existing job or says "in progress"
--   same key, DIFFERENT request              -> idem_mismatch (never a cheaper charge for a bigger job)
--   same key, hold already released/settled  -> idem_reused (a refunded key can never start a new, uncharged job)
-- Errors (the message is the code): killed, amount_too_large, rate_limited, too_many_open, daily_cap, insufficient_credits,
-- idem_mismatch, idem_reused.
CREATE OR REPLACE FUNCTION credit_reserve(p_user uuid, p_amount integer, p_slug text, p_idem text DEFAULT NULL, p_hash text DEFAULT NULL)
RETURNS TABLE (hold_id uuid, balance integer, reused boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s gateway_settings%ROWTYPE;
  bal integer;
  existing credit_holds%ROWTYPE;
  new_id uuid;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'bad_amount'; END IF;
  SELECT * INTO s FROM gateway_settings WHERE id;
  IF s.kill_switch THEN RAISE EXCEPTION 'killed'; END IF;
  IF p_amount > s.max_credits_per_call THEN RAISE EXCEPTION 'amount_too_large'; END IF;

  SELECT credits_balance INTO bal FROM user_profiles WHERE id = p_user FOR UPDATE;
  IF bal IS NULL THEN RAISE EXCEPTION 'insufficient_credits'; END IF;

  IF p_idem IS NOT NULL THEN
    SELECT * INTO existing FROM credit_holds WHERE user_id = p_user AND idem_key = p_idem;
    IF FOUND THEN
      IF existing.req_hash IS DISTINCT FROM p_hash OR existing.slug <> p_slug OR existing.amount <> p_amount THEN RAISE EXCEPTION 'idem_mismatch'; END IF;
      IF existing.status = 'released' THEN RAISE EXCEPTION 'idem_reused'; END IF;
      RETURN QUERY SELECT existing.id, bal, true;
      RETURN;
    END IF;
  END IF;

  IF (SELECT count(*) FROM credit_holds WHERE user_id = p_user AND status = 'held') >= s.max_open_holds THEN
    RAISE EXCEPTION 'too_many_open';
  END IF;
  -- daily cap counts GROSS spend (refunds do not give the quota back), so refund loops cannot be used to dodge it
  IF COALESCE((SELECT sum(-delta) FROM credit_ledger WHERE user_id = p_user AND kind = 'spend' AND created_at >= date_trunc('day', now())), 0) + p_amount > s.daily_credit_cap THEN
    RAISE EXCEPTION 'daily_cap';
  END IF;
  IF bal < p_amount THEN RAISE EXCEPTION 'insufficient_credits'; END IF;

  INSERT INTO credit_holds (user_id, amount, slug, idem_key, req_hash) VALUES (p_user, p_amount, p_slug, p_idem, p_hash) RETURNING id INTO new_id;
  INSERT INTO credit_ledger (user_id, delta, kind, reason, ref) VALUES (p_user, -p_amount, 'spend', p_slug, 'hold:' || new_id);
  SELECT credits_balance INTO bal FROM user_profiles WHERE id = p_user;
  RETURN QUERY SELECT new_id, bal, false;
END $$;

-- Remember which muapi request belongs to which user and hold (so only the owner can poll it, and settle/release find the hold).
CREATE OR REPLACE FUNCTION credit_attach_request(p_hold uuid, p_request_id text, p_estimated_usd numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE h credit_holds%ROWTYPE;
BEGIN
  SELECT * INTO h FROM credit_holds WHERE id = p_hold;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_such_hold'; END IF;
  INSERT INTO muapi_calls (request_id, user_id, hold_id, slug, estimated_usd, credits)
  VALUES (p_request_id, h.user_id, h.id, h.slug, p_estimated_usd, h.amount)
  ON CONFLICT (request_id) DO NOTHING;
END $$;

-- Success: keep the charge. Idempotent. Returns the resulting status.
CREATE OR REPLACE FUNCTION credit_settle(p_request_id text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c muapi_calls%ROWTYPE;
BEGIN
  SELECT * INTO c FROM muapi_calls WHERE request_id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'unknown'; END IF;
  IF c.status = 'failed' THEN RETURN 'failed'; END IF; -- a refund already happened; never flip back
  UPDATE muapi_calls SET status = 'completed' WHERE request_id = p_request_id;
  UPDATE credit_holds SET status = 'settled', settled_at = now() WHERE id = c.hold_id AND status = 'held';
  RETURN 'completed';
END $$;

-- Failure: give the credits back exactly once.
CREATE OR REPLACE FUNCTION credit_release(p_request_id text, p_reason text DEFAULT 'failed') RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c muapi_calls%ROWTYPE; h credit_holds%ROWTYPE;
BEGIN
  SELECT * INTO c FROM muapi_calls WHERE request_id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'unknown'; END IF;
  IF c.status = 'completed' THEN RETURN 'completed'; END IF; -- already charged and delivered
  SELECT * INTO h FROM credit_holds WHERE id = c.hold_id FOR UPDATE;
  IF h.status = 'held' THEN
    UPDATE credit_holds SET status = 'released', settled_at = now() WHERE id = h.id;
    INSERT INTO credit_ledger (user_id, delta, kind, reason, ref) VALUES (h.user_id, h.amount, 'refund', p_reason, 'hold:' || h.id) ON CONFLICT DO NOTHING;
  END IF;
  UPDATE muapi_calls SET status = 'failed' WHERE request_id = p_request_id;
  RETURN 'failed';
END $$;

-- Failure before muapi gave us a request id (submit rejected or network error): release by hold id.
CREATE OR REPLACE FUNCTION credit_release_hold(p_hold uuid, p_reason text DEFAULT 'submit failed') RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE h credit_holds%ROWTYPE;
BEGIN
  SELECT * INTO h FROM credit_holds WHERE id = p_hold FOR UPDATE;
  IF NOT FOUND THEN RETURN 'unknown'; END IF;
  IF h.status = 'held' THEN
    UPDATE credit_holds SET status = 'released', settled_at = now() WHERE id = h.id;
    INSERT INTO credit_ledger (user_id, delta, kind, reason, ref) VALUES (h.user_id, h.amount, 'refund', p_reason, 'hold:' || h.id) ON CONFLICT DO NOTHING;
  END IF;
  RETURN (SELECT status FROM credit_holds WHERE id = p_hold);
END $$;

-- Grants and adjustments by an operator (admin function, later the payment webhook). Idempotent per (user, kind, ref):
-- repeating the same ref with the same amount is a no-op, but the same ref with a DIFFERENT amount is an error, not a silent success.
CREATE OR REPLACE FUNCTION credit_apply(p_user uuid, p_delta integer, p_kind text, p_reason text, p_ref text DEFAULT NULL, p_actor uuid DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE bal integer; prior credit_ledger%ROWTYPE;
BEGIN
  IF p_kind NOT IN ('grant', 'adjust') THEN RAISE EXCEPTION 'bad_kind'; END IF;
  IF p_delta = 0 THEN RAISE EXCEPTION 'bad_amount'; END IF;
  IF p_kind = 'grant' AND p_delta < 0 THEN RAISE EXCEPTION 'bad_amount'; END IF;
  PERFORM 1 FROM user_profiles WHERE id = p_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_such_user'; END IF;
  IF p_ref IS NOT NULL THEN
    SELECT * INTO prior FROM credit_ledger WHERE user_id = p_user AND kind = p_kind AND ref = p_ref;
    IF FOUND THEN
      IF prior.delta <> p_delta THEN RAISE EXCEPTION 'ref_conflict'; END IF;
      SELECT credits_balance INTO bal FROM user_profiles WHERE id = p_user;
      RETURN bal;
    END IF;
  END IF;
  IF p_delta < 0 AND (SELECT credits_balance FROM user_profiles WHERE id = p_user) + p_delta < 0 THEN RAISE EXCEPTION 'would_go_negative'; END IF;
  INSERT INTO credit_ledger (user_id, delta, kind, reason, ref, actor) VALUES (p_user, p_delta, p_kind, p_reason, p_ref, p_actor);
  SELECT credits_balance INTO bal FROM user_profiles WHERE id = p_user;
  RETURN bal;
END $$;

-- Reaper, part 1: holds that never turned into a muapi job (the submit never completed or was never recorded) are refunded.
-- It deliberately does NOT touch holds that have a job: a job may still be running or may already be finished at muapi, and only
-- the gateway can ask muapi. Those are handled by credit_stale_calls + the gateway reaper (settle if completed, refund if failed).
CREATE OR REPLACE FUNCTION credit_reap_holds(p_minutes integer DEFAULT 60) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer := 0; r record;
BEGIN
  FOR r IN SELECT h.id FROM credit_holds h
           WHERE h.status = 'held' AND h.created_at < now() - make_interval(mins => p_minutes)
             AND NOT EXISTS (SELECT 1 FROM muapi_calls c WHERE c.hold_id = h.id)
           FOR UPDATE OF h SKIP LOCKED LOOP
    PERFORM credit_release_hold(r.id, 'timed out (auto refund)');
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

-- Reaper, part 2: jobs still marked "submitted" after p_minutes. The gateway asks muapi about each one.
CREATE OR REPLACE FUNCTION credit_stale_calls(p_minutes integer DEFAULT 30, p_limit integer DEFAULT 50)
RETURNS TABLE (request_id text, user_id uuid, age_minutes integer)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT c.request_id, c.user_id, (extract(epoch FROM now() - c.created_at) / 60)::int
  FROM muapi_calls c WHERE c.status = 'submitted' AND c.created_at < now() - make_interval(mins => p_minutes)
  ORDER BY c.created_at LIMIT p_limit
$$;

-- Only the server (service_role) may call any of these.
REVOKE EXECUTE ON FUNCTION credit_hit(uuid, text), credit_reserve(uuid, integer, text, text, text), credit_attach_request(uuid, text, numeric), credit_settle(text),
  credit_release(text, text), credit_release_hold(uuid, text), credit_apply(uuid, integer, text, text, text, uuid), credit_reap_holds(integer), credit_stale_calls(integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION credit_hit(uuid, text), credit_reserve(uuid, integer, text, text, text), credit_attach_request(uuid, text, numeric), credit_settle(text),
  credit_release(text, text), credit_release_hold(uuid, text), credit_apply(uuid, integer, text, text, text, uuid), credit_reap_holds(integer), credit_stale_calls(integer, integer)
  TO service_role;

-- ---------------------------------------------------------------- admin helpers (service_role only)

CREATE OR REPLACE FUNCTION credit_find_user(p_email text) RETURNS uuid
LANGUAGE sql SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(trim(p_email)) LIMIT 1
$$;

-- Money picture for the operator: credits sold and spent, and the muapi cost they represent.
CREATE OR REPLACE FUNCTION credit_stats() RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'credits_granted', COALESCE((SELECT sum(delta) FROM credit_ledger WHERE kind = 'grant'), 0),
    'credits_spent_net', COALESCE((SELECT -sum(delta) FROM credit_ledger WHERE kind IN ('spend', 'refund')), 0),
    'credits_outstanding', COALESCE((SELECT sum(credits_balance) FROM user_profiles), 0),
    'est_muapi_usd_completed', COALESCE((SELECT sum(estimated_usd) FROM muapi_calls WHERE status = 'completed'), 0),
    'est_muapi_usd_24h', COALESCE((SELECT sum(estimated_usd) FROM muapi_calls WHERE status = 'completed' AND created_at > now() - interval '24 hours'), 0),
    'calls_24h', (SELECT count(*) FROM muapi_calls WHERE created_at > now() - interval '24 hours'),
    'failed_24h', (SELECT count(*) FROM muapi_calls WHERE status = 'failed' AND created_at > now() - interval '24 hours'),
    'open_holds', (SELECT count(*) FROM credit_holds WHERE status = 'held')
  )
$$;

REVOKE EXECUTE ON FUNCTION credit_find_user(text), credit_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION credit_find_user(text), credit_stats() TO service_role;
