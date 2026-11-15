-- Phase 8: checkout and entitlements.
-- Money rules: credits are granted for a purchase ONLY by order_fulfil (called by the Stripe webhook after the signature is verified);
-- the price always comes from `products`, never from the browser; a refund or dispute reverses the order exactly once and claws back
-- only credits that still exist (the balance never goes negative). Everything below is service_role only, except that users may READ
-- their own orders and entitlements and the active product list. Safe to re-run: admin edits to products survive.

-- ---------------------------------------------------------------- tables

CREATE TABLE IF NOT EXISTS products (
  key text PRIMARY KEY CHECK (key ~ '^[a-z0-9_]{2,40}$'),
  kind text NOT NULL CHECK (kind IN ('credits', 'bundle')),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  price_cents integer NOT NULL CHECK (price_cents >= 50 AND price_cents <= 1000000),
  currency text NOT NULL DEFAULT 'usd' CHECK (currency ~ '^[a-z]{3}$'),
  credits integer NOT NULL DEFAULT 0 CHECK (credits >= 0 AND credits <= 1000000),
  entitlements text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  sort integer NOT NULL DEFAULT 100,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (credits > 0 OR cardinality(entitlements) > 0),
  CHECK (credits <= price_cents * 3)   -- a mistyped or malicious edit cannot sell a million credits for 50 cents
);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_key text NOT NULL REFERENCES products(key),
  product_name text NOT NULL,
  amount_cents integer NOT NULL,
  currency text NOT NULL,
  credits integer NOT NULL,                 -- credits this order grants (snapshot of the product at order time)
  entitlements text[] NOT NULL,             -- entitlements this order grants (snapshot)
  stripe_session_id text UNIQUE,
  stripe_payment_intent text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'refunded', 'disputed')),
  credits_clawed integer NOT NULL DEFAULT 0,
  clawback_shortfall integer NOT NULL DEFAULT 0,  -- credits we wanted back but the customer had already spent
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  reversed_at timestamptz
);
CREATE INDEX IF NOT EXISTS orders_user_idx ON orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_payment_intent_idx ON orders (stripe_payment_intent) WHERE stripe_payment_intent IS NOT NULL;

CREATE TABLE IF NOT EXISTS entitlements (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key text NOT NULL CHECK (key ~ '^[a-z0-9_]{2,40}$'),
  source_order_id uuid REFERENCES orders(id),   -- NULL = granted by an admin
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  PRIMARY KEY (user_id, key)
);

-- Audit and dedupe of Stripe events. outcome 'needs_attention' = a customer paid but we could not match the order.
CREATE TABLE IF NOT EXISTS stripe_events (
  id text PRIMARY KEY,
  type text NOT NULL,
  outcome text NOT NULL DEFAULT 'processed' CHECK (outcome IN ('processed', 'ignored', 'needs_attention')),
  detail text,
  processed_at timestamptz NOT NULL DEFAULT now()
);

-- A refund or dispute that Stripe delivers BEFORE the purchase is fulfilled (events can arrive out of order): remembered here so that
-- order_fulfil never grants credits for a payment that has already been reversed.
CREATE TABLE IF NOT EXISTS pending_reversals (
  stripe_payment_intent text PRIMARY KEY,
  status text NOT NULL CHECK (status IN ('refunded', 'disputed')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Every operator action that changes money or unlocks leaves a row (who, what, before/after).
CREATE TABLE IF NOT EXISTS billing_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor uuid,
  action text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}',
  at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE gateway_settings ADD COLUMN IF NOT EXISTS enforce_entitlements boolean NOT NULL DEFAULT true;

-- ---------------------------------------------------------------- access

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_reversals ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products readable when active" ON products;
CREATE POLICY "products readable when active" ON products FOR SELECT TO authenticated USING (active);
DROP POLICY IF EXISTS "users read own orders" ON orders;
CREATE POLICY "users read own orders" ON orders FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "users read own entitlements" ON entitlements;
CREATE POLICY "users read own entitlements" ON entitlements FOR SELECT TO authenticated USING (auth.uid() = user_id);

REVOKE ALL ON products, orders, entitlements, stripe_events, pending_reversals, billing_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT ON products, orders, entitlements TO authenticated;
GRANT ALL ON products, orders, entitlements, stripe_events, pending_reversals, billing_audit TO service_role;

-- ---------------------------------------------------------------- placeholder catalogue (edit prices and credits in /admin before launch)

INSERT INTO products (key, kind, name, description, price_cents, credits, entitlements, sort, active) VALUES
  ('starter',         'bundle', 'Studio Starter',      'Everything to make your first episodes, with starter credits.', 3700, 2000, '{}', 10, true),
  ('credits_s',       'credits', '1,000 credits',      'Top up your balance.',                                        1000, 1000, '{}', 20, true),
  ('credits_m',       'credits', '3,000 credits',      'Top up your balance.',                                        2700, 3000, '{}', 30, true),
  ('credits_l',       'credits', '8,000 credits',      'Top up your balance.',                                        6400, 8000, '{}', 40, true),
  ('pro_pack',        'bundle', 'Pro Pack',            'All 25 cities, Cuts format, Cast characters with voices, host from Cast.', 9700, 1000, '{pro_pack}', 50, true),
  ('recast_happiness','bundle', 'Recast + Happiness',  'Recast any clip with your own performer and the Happiness show.', 4700,  500, '{recast,happiness}', 60, true),
  ('commercial',      'bundle', 'Commercial licence',  'Use episodes for client work.',                               14700,    0, '{commercial}', 70, false)
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------- functions (service_role only)

-- A pending order for a product, priced from the products table. Refuses unknown or inactive products, and a bundle whose unlocks the
-- user already owns (bundles are one-time; credit packs can be bought again).
CREATE OR REPLACE FUNCTION order_create_pending(p_user uuid, p_product text)
RETURNS TABLE (order_id uuid, amount_cents integer, currency text, product_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE pr products%ROWTYPE; oid uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM orders o WHERE o.user_id = p_user AND o.status = 'disputed') THEN RAISE EXCEPTION 'billing_blocked'; END IF;
  SELECT * INTO pr FROM products WHERE key = p_product AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown_product'; END IF;
  IF cardinality(pr.entitlements) > 0 AND NOT EXISTS (
       SELECT 1 FROM unnest(pr.entitlements) k
       WHERE NOT EXISTS (SELECT 1 FROM entitlements e WHERE e.user_id = p_user AND e.key = k AND e.revoked_at IS NULL)) THEN
    RAISE EXCEPTION 'already_owned';
  END IF;
  -- an abandoned checkout leaves a pending row; keep only a few per user
  IF (SELECT count(*) FROM orders o WHERE o.user_id = p_user AND o.status = 'pending' AND o.created_at > now() - interval '1 hour') >= 10 THEN
    RAISE EXCEPTION 'too_many_pending';
  END IF;
  INSERT INTO orders (user_id, product_key, product_name, amount_cents, currency, credits, entitlements)
  VALUES (p_user, pr.key, pr.name, pr.price_cents, pr.currency, pr.credits, pr.entitlements)
  RETURNING id INTO oid;
  RETURN QUERY SELECT oid, pr.price_cents, pr.currency, pr.name;
END $$;

-- Remember which Stripe Checkout Session belongs to the order (once).
CREATE OR REPLACE FUNCTION order_attach_session(p_order uuid, p_session text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  UPDATE orders SET stripe_session_id = p_session WHERE id = p_order AND stripe_session_id IS NULL AND status = 'pending'
$$;

-- Give the customer what they paid for, exactly once. Idempotent: a duplicate or concurrent call returns 'already'.
-- The amount and currency Stripe reports must equal the order's, or nothing is granted.
CREATE OR REPLACE FUNCTION order_fulfil(p_session text, p_payment_intent text, p_amount integer, p_currency text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE o orders%ROWTYPE; k text; early pending_reversals%ROWTYPE;
BEGIN
  SELECT * INTO o FROM orders WHERE stripe_session_id = p_session FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;
  IF o.status <> 'pending' THEN RETURN 'already'; END IF;
  IF o.amount_cents <> p_amount OR lower(o.currency) <> lower(p_currency) THEN RAISE EXCEPTION 'amount_mismatch'; END IF;
  SELECT * INTO early FROM pending_reversals WHERE stripe_payment_intent = p_payment_intent;
  IF FOUND THEN   -- Stripe already told us this payment was refunded or disputed: record it, grant nothing
    UPDATE orders SET status = early.status, paid_at = now(), reversed_at = now(), stripe_payment_intent = p_payment_intent WHERE id = o.id;
    DELETE FROM pending_reversals WHERE stripe_payment_intent = p_payment_intent;
    RETURN 'reversed_before_fulfil';
  END IF;
  UPDATE orders SET status = 'paid', paid_at = now(), stripe_payment_intent = p_payment_intent WHERE id = o.id;
  IF o.credits > 0 THEN
    PERFORM credit_apply(o.user_id, o.credits, 'grant', 'purchase: ' || o.product_name, 'order:' || o.id::text, NULL);
  END IF;
  FOREACH k IN ARRAY o.entitlements LOOP
    INSERT INTO entitlements (user_id, key, source_order_id) VALUES (o.user_id, k, o.id)
    ON CONFLICT (user_id, key) DO UPDATE
      SET source_order_id = EXCLUDED.source_order_id, granted_at = now(), revoked_at = NULL
      WHERE entitlements.revoked_at IS NOT NULL;   -- an active entitlement keeps its original source
  END LOOP;
  RETURN 'fulfilled';
END $$;

-- A full refund or a dispute: mark the order, revoke what it unlocked (unless another paid order also grants it) and take back the
-- credits that are still unspent. Whatever was already spent is recorded as a shortfall for the operator. Idempotent.
CREATE OR REPLACE FUNCTION order_reverse(p_payment_intent text, p_status text, p_reason text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE o orders%ROWTYPE; bal integer; claw integer := 0; k text;
BEGIN
  IF p_status NOT IN ('refunded', 'disputed') THEN RAISE EXCEPTION 'bad_status'; END IF;
  SELECT * INTO o FROM orders WHERE stripe_payment_intent = p_payment_intent FOR UPDATE;
  IF NOT FOUND THEN
    -- not matched yet: either not ours, or the purchase has not been fulfilled yet. Remember it (cheap, harmless if foreign).
    DELETE FROM pending_reversals WHERE created_at < now() - interval '45 days';
    INSERT INTO pending_reversals (stripe_payment_intent, status, reason) VALUES (p_payment_intent, p_status, left(p_reason, 200)) ON CONFLICT DO NOTHING;
    RETURN 'unknown';
  END IF;
  IF o.status <> 'paid' THEN RETURN 'already'; END IF;   -- refunded/disputed already reversed
  PERFORM 1 FROM user_profiles WHERE id = o.user_id FOR UPDATE;
  IF o.credits > 0 THEN
    SELECT credits_balance INTO bal FROM user_profiles WHERE id = o.user_id;
    claw := GREATEST(0, LEAST(o.credits, COALESCE(bal, 0)));
    IF claw > 0 THEN
      INSERT INTO credit_ledger (user_id, delta, kind, reason, ref) VALUES (o.user_id, -claw, 'adjust', left('order ' || p_status || ': ' || p_reason, 200), 'order-reverse:' || o.id::text);
    END IF;
  END IF;
  UPDATE orders SET status = p_status, reversed_at = now(), credits_clawed = claw, clawback_shortfall = o.credits - claw WHERE id = o.id;
  FOREACH k IN ARRAY o.entitlements LOOP
    UPDATE entitlements SET revoked_at = now() WHERE user_id = o.user_id AND key = k AND source_order_id = o.id AND revoked_at IS NULL;
    -- another paid order still grants it: hand the entitlement to that order instead of losing it
    UPDATE entitlements e SET revoked_at = NULL, source_order_id = (
        SELECT o2.id FROM orders o2 WHERE o2.user_id = o.user_id AND o2.status = 'paid' AND k = ANY (o2.entitlements) ORDER BY o2.paid_at LIMIT 1)
      WHERE e.user_id = o.user_id AND e.key = k AND e.revoked_at IS NOT NULL AND e.source_order_id = o.id
        AND EXISTS (SELECT 1 FROM orders o2 WHERE o2.user_id = o.user_id AND o2.status = 'paid' AND k = ANY (o2.entitlements));
  END LOOP;
  RETURN 'reversed';
END $$;

-- Active entitlement keys for a user (read by the gateway).
CREATE OR REPLACE FUNCTION entitlements_for(p_user uuid) RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT COALESCE(array_agg(key ORDER BY key), '{}') FROM entitlements WHERE user_id = p_user AND revoked_at IS NULL
$$;

-- Operator grant or revoke of one entitlement (for support and test accounts).
CREATE OR REPLACE FUNCTION entitlement_set(p_user uuid, p_key text, p_on boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF p_on THEN
    INSERT INTO entitlements (user_id, key, source_order_id) VALUES (p_user, p_key, NULL)
    ON CONFLICT (user_id, key) DO UPDATE SET revoked_at = NULL, granted_at = now(), source_order_id = NULL WHERE entitlements.revoked_at IS NOT NULL;
  ELSE
    UPDATE entitlements SET revoked_at = now(), source_order_id = NULL WHERE user_id = p_user AND key = p_key AND revoked_at IS NULL;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION billing_audit_write(p_actor uuid, p_action text, p_detail jsonb) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$ INSERT INTO billing_audit (actor, action, detail) VALUES (p_actor, left(p_action, 60), COALESCE(p_detail, '{}')) $$;

-- Record a processed Stripe event. Returns false when it was already recorded (a duplicate delivery).
CREATE OR REPLACE FUNCTION stripe_event_record(p_id text, p_type text, p_outcome text, p_detail text DEFAULT NULL) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO stripe_events (id, type, outcome, detail) VALUES (p_id, p_type, p_outcome, left(p_detail, 300));
  RETURN true;
EXCEPTION WHEN unique_violation THEN RETURN false;
END $$;

CREATE OR REPLACE FUNCTION stripe_event_seen(p_id text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$ SELECT EXISTS (SELECT 1 FROM stripe_events WHERE id = p_id) $$;

-- Money picture for the operator.
CREATE OR REPLACE FUNCTION billing_stats() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object(
    'paid_cents', COALESCE((SELECT sum(amount_cents) FROM orders WHERE status = 'paid'), 0),
    'refunded_cents', COALESCE((SELECT sum(amount_cents) FROM orders WHERE status IN ('refunded', 'disputed')), 0),
    'orders_paid', (SELECT count(*) FROM orders WHERE status = 'paid'),
    'orders_reversed', (SELECT count(*) FROM orders WHERE status IN ('refunded', 'disputed')),
    'clawback_shortfall_credits', COALESCE((SELECT sum(clawback_shortfall) FROM orders), 0),
    'needs_attention', (SELECT count(*) FROM stripe_events WHERE outcome = 'needs_attention')
  )
$$;

REVOKE EXECUTE ON FUNCTION order_create_pending(uuid, text), order_attach_session(uuid, text), order_fulfil(text, text, integer, text),
  order_reverse(text, text, text), entitlements_for(uuid), entitlement_set(uuid, text, boolean), stripe_event_record(text, text, text, text),
  stripe_event_seen(text), billing_stats(), billing_audit_write(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION order_create_pending(uuid, text), order_attach_session(uuid, text), order_fulfil(text, text, integer, text),
  order_reverse(text, text, text), entitlements_for(uuid), entitlement_set(uuid, text, boolean), stripe_event_record(text, text, text, text),
  stripe_event_seen(text), billing_stats(), billing_audit_write(uuid, text, jsonb) TO service_role;
