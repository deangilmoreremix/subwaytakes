-- Phase 10: launch readiness. Operator blocklist, consent records, operational alerts, browser error log, health metrics.
-- Safe to re-run. Everything here is service_role only except: users may record and read their own consent, and any visitor may submit a
-- (rate-limited) browser error report through client_error_log.

-- ---------------------------------------------------------------- tables

CREATE TABLE IF NOT EXISTS safety_terms (
  term text PRIMARY KEY CHECK (char_length(term) BETWEEN 2 AND 60),
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS consents (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('face_upload')),
  version text NOT NULL CHECK (char_length(version) BETWEEN 1 AND 20),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, kind, version)
);

CREATE TABLE IF NOT EXISTS ops_alerts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind text NOT NULL CHECK (char_length(kind) BETWEEN 2 AND 60),
  severity text NOT NULL CHECK (severity IN ('info', 'warn', 'critical')),
  message text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid
);
-- one open alert per kind: a repeating problem updates the same row instead of flooding the list
CREATE UNIQUE INDEX IF NOT EXISTS ops_alerts_one_open_per_kind ON ops_alerts (kind) WHERE resolved_at IS NULL;

CREATE TABLE IF NOT EXISTS client_errors (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid,
  message text NOT NULL,
  stack text,
  url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_errors_created_idx ON client_errors (created_at DESC);

-- ---------------------------------------------------------------- access

ALTER TABLE safety_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_errors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "consents own select" ON consents;
CREATE POLICY "consents own select" ON consents FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "consents own insert" ON consents;
CREATE POLICY "consents own insert" ON consents FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

REVOKE ALL ON safety_terms, consents, ops_alerts, client_errors FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON consents TO authenticated;      -- a consent is a record: it can be added and read, never edited or removed by the user
GRANT ALL ON safety_terms, consents, ops_alerts, client_errors TO service_role;

-- ---------------------------------------------------------------- browser error log (anyone may report; heavily limited)

CREATE OR REPLACE FUNCTION client_error_log(p_message text, p_stack text DEFAULT NULL, p_url text DEFAULT NULL) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF p_message IS NULL OR btrim(p_message) = '' THEN RETURN false; END IF;
  -- a flood from anywhere is dropped silently (never an error the page would report again): global and per-signed-in-user caps
  IF (SELECT count(*) FROM client_errors WHERE created_at > now() - interval '1 minute') >= 120 THEN RETURN false; END IF;
  IF uid IS NOT NULL AND (SELECT count(*) FROM client_errors WHERE user_id = uid AND created_at > now() - interval '1 minute') >= 10 THEN RETURN false; END IF;
  INSERT INTO client_errors (user_id, message, stack, url) VALUES (uid, left(p_message, 300), left(p_stack, 2000), left(p_url, 300));
  RETURN true;
END $$;

-- ---------------------------------------------------------------- metrics and alerts (service_role only)

CREATE OR REPLACE FUNCTION ops_metrics() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object(
    'at', now(),
    'drifted_users', (SELECT count(*) FROM user_profiles p WHERE p.credits_balance IS DISTINCT FROM (SELECT COALESCE(sum(delta), 0) FROM credit_ledger l WHERE l.user_id = p.id)),
    'negative_balances', (SELECT count(*) FROM user_profiles WHERE credits_balance < 0),
    'stuck_holds', (SELECT count(*) FROM credit_holds WHERE status = 'held' AND created_at < now() - interval '2 hours'),
    'stale_calls', (SELECT count(*) FROM muapi_calls WHERE status = 'submitted' AND created_at < now() - interval '2 hours'),
    'calls_24h', (SELECT count(*) FROM muapi_calls WHERE created_at > now() - interval '24 hours'),
    'failed_calls_24h', (SELECT count(*) FROM muapi_calls WHERE status = 'failed' AND created_at > now() - interval '24 hours'),
    'paid_orders_24h', (SELECT count(*) FROM orders WHERE paid_at > now() - interval '24 hours'),
    'reversed_orders_24h', (SELECT count(*) FROM orders WHERE reversed_at > now() - interval '24 hours'),
    'needs_attention_24h', (SELECT count(*) FROM stripe_events WHERE outcome = 'needs_attention' AND processed_at > now() - interval '24 hours'),
    'client_errors_1h', (SELECT count(*) FROM client_errors WHERE created_at > now() - interval '1 hour'),
    'open_alerts', (SELECT count(*) FROM ops_alerts WHERE resolved_at IS NULL)
  )
$$;

-- Raise (or refresh) the single open alert of a kind. Returns true when it is NEW (so the caller notifies once, not every run).
CREATE OR REPLACE FUNCTION ops_alert_raise(p_kind text, p_severity text, p_message text, p_detail jsonb DEFAULT '{}') RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  BEGIN
    INSERT INTO ops_alerts (kind, severity, message, detail) VALUES (p_kind, p_severity, left(p_message, 300), COALESCE(p_detail, '{}'));
    RETURN true;
  EXCEPTION WHEN unique_violation THEN
    UPDATE ops_alerts SET last_seen_at = now(), severity = p_severity, message = left(p_message, 300), detail = COALESCE(p_detail, '{}') WHERE kind = p_kind AND resolved_at IS NULL;
    RETURN false;
  END;
END $$;

-- Close open alerts whose condition has cleared (every open kind NOT in p_active).
CREATE OR REPLACE FUNCTION ops_alert_clear_except(p_active text[]) RETURNS integer
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH c AS (UPDATE ops_alerts SET resolved_at = now() WHERE resolved_at IS NULL AND NOT (kind = ANY (COALESCE(p_active, '{}'))) RETURNING 1) SELECT count(*)::integer FROM c
$$;

CREATE OR REPLACE FUNCTION ops_alert_resolve(p_id bigint, p_actor uuid) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH r AS (UPDATE ops_alerts SET resolved_at = now(), resolved_by = p_actor WHERE id = p_id AND resolved_at IS NULL RETURNING 1) SELECT EXISTS (SELECT 1 FROM r)
$$;

-- Housekeeping, called by the scheduled check: browser errors are kept two weeks, resolved alerts ninety days.
CREATE OR REPLACE FUNCTION ops_prune() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE a integer; b integer;
BEGIN
  DELETE FROM client_errors WHERE created_at < now() - interval '14 days'; GET DIAGNOSTICS a = ROW_COUNT;
  DELETE FROM ops_alerts WHERE resolved_at IS NOT NULL AND resolved_at < now() - interval '90 days'; GET DIAGNOSTICS b = ROW_COUNT;
  RETURN a + b;
END $$;

REVOKE EXECUTE ON FUNCTION client_error_log(text, text, text), ops_metrics(), ops_alert_raise(text, text, text, jsonb), ops_alert_clear_except(text[]), ops_alert_resolve(bigint, uuid), ops_prune() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION client_error_log(text, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION ops_metrics(), ops_alert_raise(text, text, text, jsonb), ops_alert_clear_except(text[]), ops_alert_resolve(bigint, uuid), ops_prune() TO service_role;
